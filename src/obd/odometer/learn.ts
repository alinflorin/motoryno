/**
 * "Learn by reference": finds where a car keeps its odometer by trying
 * everything plausible and letting the reading the user just copied off the
 * dashboard pick out the right answer. The winning `OdometerSource` is
 * persisted with the car and replayed by every later silent sync, so this
 * only ever has to run once per car.
 *
 * Passes, cheapest first, stopping at the first confirmed hit:
 *  1. Known candidates for the make (`candidates.ts`) - one request each.
 *  2. A few seconds of passive bus monitoring, scanning every captured
 *     frame for the reference value (clusters/gateways often broadcast it).
 *  3. ECU discovery on the make's diagnostic addressing scheme (tester
 *     present to each address), then, per ECU that answered, opening its
 *     diagnostic session and sweeping identifiers, scanning every positive
 *     reply for the reference value.
 *
 * A hit is only accepted after a second, independent read of the same
 * source returns the same value - a payload matching by coincidence won't
 * survive that.
 */

import type { Device } from 'react-native-ble-plx';

import { withAdapterLock } from '@/obd/adapterLock';
import { ElmConnection, openElmConnection, parseMonitorFrames, DEFAULT_ELM_TIMEOUT_HEX } from '@/obd/elm327';
import { obdLog } from '@/obd/log';
import { vehicleOdometerSources } from '@/obd/odometer/candidates';
import { findFieldMatches, matchTolerance, type FieldMatch } from '@/obd/odometer/match';
import { isMercedesVehicle, mercedesDiscoveryTargets, type DiscoveryTarget } from '@/obd/odometer/mercedes';
import { applySourceAddressing, readOdometerSource } from '@/obd/odometer/read';
import type { BroadcastOdometerSource, OdometerSource, RequestOdometerSource } from '@/obd/odometer/source';
import { sendRequest } from '@/obd/protocol';

export type LearnStep = 'connecting' | 'known-candidates' | 'monitoring' | 'discovering' | 'sweeping' | 'verifying';

export interface LearnProgress {
  step: LearnStep;
  /** What's being tried right now, for the UI - e.g. an ECU label. */
  detail?: string;
  /** 0..1 progress through the current sweep, when known. */
  fraction?: number;
}

export interface LearnResult {
  source: OdometerSource;
  odometerKm: number;
}

export interface LearnOptions {
  /** Give up once this much time has passed, whatever pass is running. */
  budgetMs?: number;
  signal?: AbortSignal;
  onProgress?: (progress: LearnProgress) => void;
}

/** A whole learn should fit comfortably inside a coffee break - the sweeps are the bulk of it. */
const DEFAULT_BUDGET_MS = 5 * 60 * 1000;
/** How long the passive monitor pass listens for a broadcast carrying the reading. */
const MONITOR_MS = 4000;
/** ELM327 receive timeout while sweeping identifiers (`ATST`, 4ms units): 0x19 = 100ms, enough for a UDS/KWP reply, quick on "NO DATA". */
const SWEEP_ELM_TIMEOUT_HEX = '19';
/** Standard OBD-II addresses to knock on for makes without a documented proprietary scheme. */
const STANDARD_PHYSICAL_ECUS = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({
  label: `OBD-II ECU 7E${n}`,
  header: `7E${n}`,
  receiveAddress: `7E${n + 8}`,
}));

class LearnAborted extends Error {}

function checkAbort(deadline: number, signal?: AbortSignal): void {
  if (signal?.aborted || Date.now() > deadline) throw new LearnAborted();
}

/**
 * Connects to `device` and runs the passes described above against
 * `referenceKm`. Resolves null if nothing matched (or the budget ran out);
 * rejects only if the adapter couldn't be connected to at all.
 */
export function learnOdometerSource(
  device: Device,
  vehicle: { vin: string | null; make: string | null },
  referenceKm: number,
  options: LearnOptions = {}
): Promise<LearnResult | null> {
  return withAdapterLock(device.id, () => runLearn(device, vehicle, referenceKm, options));
}

async function runLearn(
  device: Device,
  vehicle: { vin: string | null; make: string | null },
  referenceKm: number,
  options: LearnOptions
): Promise<LearnResult | null> {
  const { budgetMs = DEFAULT_BUDGET_MS, signal, onProgress } = options;
  const deadline = Date.now() + budgetMs;
  const report = (progress: LearnProgress) => onProgress?.(progress);

  report({ step: 'connecting' });
  let connection: ElmConnection | null = null;
  try {
    connection = await openElmConnection(device);
    obdLog('info', `learn: reference ${referenceKm} km (tolerance ${matchTolerance(referenceKm).toFixed(1)} km), vin=${vehicle.vin ?? '?'} make=${vehicle.make ?? '?'}`);

    // One plain OBD-II request first: it makes the adapter run its protocol
    // search now (so later "NO DATA"s are real), and tells us whether the car
    // is on 11-bit/500k CAN - the only bus the proprietary passes apply to.
    await sendRequest(connection, '0100');
    const onCan = await connection.isOnCan11Bit500k();
    obdLog('info', `learn: adapter protocol ${await connection.describeProtocolNumber()} (CAN 11/500: ${onCan})`);

    const hit =
      (await tryKnownCandidates(connection, vehicle, referenceKm, deadline, signal, report)) ??
      (onCan ? await tryMonitoring(connection, referenceKm, deadline, signal, report) : null) ??
      (onCan ? await tryDiscovery(connection, vehicle, referenceKm, deadline, signal, report) : null);

    if (hit) obdLog('info', `learn: found ${hit.source.label} = ${hit.odometerKm} km`);
    else obdLog('info', 'learn: nothing matched');
    return hit;
  } catch (error) {
    if (error instanceof LearnAborted) {
      obdLog('info', 'learn: aborted (cancelled or out of time)');
      return null;
    }
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.setResponseTimeout(DEFAULT_ELM_TIMEOUT_HEX);
        await connection.setAddressing(null);
      } catch {
        // Best-effort tidy-up; the connection is being dropped anyway.
      }
      connection.close();
    }
    try {
      await device.cancelConnection();
    } catch {
      // Already disconnected, or never connected - nothing to clean up.
    }
  }
}

function withinTolerance(km: number, referenceKm: number): boolean {
  return Math.abs(km - referenceKm) <= matchTolerance(referenceKm);
}

/** Re-reads `source` and accepts it only if it reports the reference again. */
async function verify(connection: ElmConnection, source: OdometerSource, referenceKm: number, report: (p: LearnProgress) => void): Promise<LearnResult | null> {
  report({ step: 'verifying', detail: source.label });
  const check = await readOdometerSource(connection, source);
  if (check.km !== null && withinTolerance(check.km, referenceKm)) return { source, odometerKm: check.km };
  obdLog('info', `learn: ${source.label} didn't repeat (${check.km ?? 'null'}) - discarding`);
  return null;
}

/** Pass 1: the make's documented/catalogued requests, each read once and checked against the reference. */
async function tryKnownCandidates(
  connection: ElmConnection,
  vehicle: { vin: string | null; make: string | null },
  referenceKm: number,
  deadline: number,
  signal: AbortSignal | undefined,
  report: (p: LearnProgress) => void
): Promise<LearnResult | null> {
  const sources = vehicleOdometerSources(vehicle.vin, vehicle.make);
  for (const [index, source] of sources.entries()) {
    checkAbort(deadline, signal);
    report({ step: 'known-candidates', detail: source.label, fraction: index / sources.length });
    try {
      const result = await readOdometerSource(connection, source);
      if (result.km !== null && withinTolerance(result.km, referenceKm)) {
        const confirmed = await verify(connection, source, referenceKm, report);
        if (confirmed) return confirmed;
      } else if (result.payload) {
        // The documented field didn't match, but the same reply might still carry the reading elsewhere.
        const match = findFieldMatches(result.payload, referenceKm)[0];
        if (match && source.kind === 'request') {
          const confirmed = await verify(connection, { ...source, label: `${source.label} [learned field]`, field: match.field }, referenceKm, report);
          if (confirmed) return confirmed;
        }
      }
    } catch (error) {
      if (error instanceof LearnAborted) throw error;
      obdLog('info', `learn: ${source.label} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}

/** Pass 2: listen to the bus and look for the reference in any broadcast frame. */
async function tryMonitoring(
  connection: ElmConnection,
  referenceKm: number,
  deadline: number,
  signal: AbortSignal | undefined,
  report: (p: LearnProgress) => void
): Promise<LearnResult | null> {
  checkAbort(deadline, signal);
  report({ step: 'monitoring' });
  await connection.setAddressing(null);
  const frames = parseMonitorFrames(await connection.monitorBus(MONITOR_MS));
  obdLog('info', `learn: monitored ${frames.length} frames on ${new Set(frames.map((f) => f.id)).size} IDs`);

  // Count how many frames each (id, field) matched in - a real odometer
  // broadcast repeats; a coincidental byte pattern in one frame won't.
  const tallies = new Map<string, { source: BroadcastOdometerSource; count: number }>();
  for (const frame of frames) {
    for (const match of findFieldMatches(frame.data, referenceKm)) {
      const source: BroadcastOdometerSource = {
        kind: 'broadcast',
        label: `Broadcast frame ${frame.id} bytes ${match.field.offset}-${match.field.offset + match.field.length - 1}`,
        canId: frame.id,
        field: match.field,
      };
      const key = `${frame.id}:${match.field.offset}:${match.field.length}:${match.field.endian}:${match.field.scale}`;
      const tally = tallies.get(key) ?? { source, count: 0 };
      tally.count += 1;
      tallies.set(key, tally);
    }
  }

  const best = [...tallies.values()].sort((a, b) => b.count - a.count)[0];
  if (!best) return null;
  checkAbort(deadline, signal);
  return verify(connection, best.source, referenceKm, report);
}

/** Pass 3: knock on every address of the make's diagnostic scheme, then sweep identifiers on whatever answered. */
async function tryDiscovery(
  connection: ElmConnection,
  vehicle: { vin: string | null; make: string | null },
  referenceKm: number,
  deadline: number,
  signal: AbortSignal | undefined,
  report: (p: LearnProgress) => void
): Promise<LearnResult | null> {
  const targets: DiscoveryTarget[] = isMercedesVehicle(vehicle.vin, vehicle.make)
    ? mercedesDiscoveryTargets()
    : STANDARD_PHYSICAL_ECUS.map((ecu) => ({
        ...ecu,
        sessions: ['1003'],
        sweeps: [
          {
            label: 'UDS ReadDataByIdentifier 22 0100..01FF',
            request: (id: number) => `22${(0x0100 + id).toString(16).toUpperCase().padStart(4, '0')}`,
            from: 0,
            to: 0xff,
          },
        ],
      }));

  await connection.setProtocol('can-11-500');
  await connection.setResponseTimeout(SWEEP_ELM_TIMEOUT_HEX);

  // Presence probe: TesterPresent, then the first session request as a second knock
  // (some KWP ECUs stay silent on an unknown sub-function instead of rejecting it).
  // Any reply - positive or negative - means an ECU is listening there.
  const present: DiscoveryTarget[] = [];
  for (const [index, target] of targets.entries()) {
    checkAbort(deadline, signal);
    report({ step: 'discovering', detail: target.label, fraction: index / targets.length });
    await connection.setAddressing({ header: target.header, receiveAddress: target.receiveAddress });
    for (const probe of ['3E00', ...target.sessions.slice(0, 1)]) {
      const response = await sendRequest(connection, probe);
      if (response.status === 'no-data') continue;
      obdLog('info', `learn: ECU present at ${target.header}/${target.receiveAddress} (${probe} -> ${response.status})`);
      present.push(target);
      break;
    }
  }
  obdLog('info', `learn: ${present.length} ECU(s) answered the presence probe`);

  for (const target of present) {
    const hit = await sweepTarget(connection, target, referenceKm, deadline, signal, report);
    if (hit) return hit;
  }
  return null;
}

async function sweepTarget(
  connection: ElmConnection,
  target: DiscoveryTarget,
  referenceKm: number,
  deadline: number,
  signal: AbortSignal | undefined,
  report: (p: LearnProgress) => void
): Promise<LearnResult | null> {
  await connection.setAddressing({ header: target.header, receiveAddress: target.receiveAddress });

  // Open whichever session the ECU accepts; a KWP ECU rejects the UDS one and vice versa.
  let session: string | undefined;
  for (const candidate of target.sessions) {
    checkAbort(deadline, signal);
    const response = await sendRequest(connection, candidate);
    if (response.status === 'ok') {
      session = candidate;
      break;
    }
  }
  obdLog('info', `learn: ${target.label}: session ${session ?? 'none accepted (default)'}`);

  for (const sweep of target.sweeps) {
    const total = sweep.to - sweep.from + 1;
    for (let identifier = sweep.from; identifier <= sweep.to; identifier++) {
      checkAbort(deadline, signal);
      if ((identifier - sweep.from) % 8 === 0) {
        report({ step: 'sweeping', detail: `${target.label} - ${sweep.label}`, fraction: (identifier - sweep.from) / total });
      }
      const request = sweep.request(identifier);
      const response = await sendRequest(connection, request);
      if (response.status !== 'ok' || response.data.length < 3) continue;

      const match: FieldMatch | undefined = findFieldMatches(response.data, referenceKm)[0];
      if (!match) continue;

      const source: RequestOdometerSource = {
        kind: 'request',
        label: `${target.label}: ${request.replace(/^(..)/, '$1 ')} (learned)`,
        protocol: 'can-11-500',
        header: target.header,
        receiveAddress: target.receiveAddress,
        session,
        request,
        field: match.field,
      };
      obdLog('info', `learn: candidate ${source.label} -> ${match.km} km, verifying`);
      const confirmed = await verify(connection, source, referenceKm, report);
      if (confirmed) return confirmed;
      // Verification re-applied the addressing/session for this same target - carry on sweeping.
      await applySourceAddressing(connection, source);
    }
  }
  return null;
}
