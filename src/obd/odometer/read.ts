/**
 * Replays one `OdometerSource` against a live adapter connection: applies
 * the protocol/addressing it needs, opens its diagnostic session if any,
 * sends the request (or captures the broadcast frame) and decodes the km.
 */

import type { ElmConnection } from '@/obd/elm327';
import { parseMonitorFrames } from '@/obd/elm327';
import { obdLog } from '@/obd/log';
import { isPlausibleOdometerKm } from '@/obd/odometer/match';
import type { DiagnosticRequest, OdometerSource } from '@/obd/odometer/source';
import { decodeField } from '@/obd/odometer/source';
import { sendRequest, type ObdResponse } from '@/obd/protocol';
import { MAX_ODOMETER } from '@/utils/validation';

/** How long to listen for a known broadcast frame before giving up. Cluster/gateway km frames repeat every few hundred ms. */
const BROADCAST_CAPTURE_MS = 2500;

export interface OdometerReadResult {
  /** Rounded km, or null if the source didn't yield a plausible reading. */
  km: number | null;
  /** The raw positive-response payload (request sources) - what the learn flow scans for other encodings. */
  payload: number[] | null;
  response?: ObdResponse;
}

/** Points the adapter at the ECU a request targets (protocol + CAN IDs) and applies its own AT tweaks, if any. */
export async function applySourceAddressing(connection: ElmConnection, source: DiagnosticRequest): Promise<void> {
  if (source.protocol) await connection.setProtocol(source.protocol);
  await connection.setAddressing(
    source.header || source.receiveAddress ? { header: source.header, receiveAddress: source.receiveAddress } : null
  );
  for (const command of source.atCommands ?? []) {
    const ok = await connection.sendAt(command);
    if (!ok) obdLog('info', `request AT command "${command}" was not acknowledged`);
  }
}

/**
 * Sends the session request and then every setup request a source needs, in
 * order. A refusal isn't fatal - the read may still work in the default
 * session, and some setup steps (tester present) never answer "ok".
 */
export async function openSourceSession(connection: ElmConnection, source: DiagnosticRequest): Promise<void> {
  const steps = [...(source.session ? [source.session] : []), ...(source.setup ?? [])];
  for (const step of steps) {
    const response = await sendRequest(connection, step);
    if (response.status !== 'ok') obdLog('info', `setup request ${step} not accepted (${response.status}) - carrying on`);
  }
}

/** Addressing + session/setup: everything that has to happen before a source's read request. */
export async function prepareRequest(connection: ElmConnection, source: DiagnosticRequest): Promise<void> {
  await applySourceAddressing(connection, source);
  await openSourceSession(connection, source);
}

function toKm(raw: number | null): number | null {
  if (raw === null) return null;
  return isPlausibleOdometerKm(raw, MAX_ODOMETER) ? Math.round(raw) : null;
}

export async function readOdometerSource(connection: ElmConnection, source: OdometerSource): Promise<OdometerReadResult> {
  if (source.kind === 'broadcast') {
    const lines = await connection.monitorBus(BROADCAST_CAPTURE_MS, source.canId);
    const frame = parseMonitorFrames(lines).find((candidate) => candidate.id === source.canId.toUpperCase());
    if (!frame) return { km: null, payload: null };
    return { km: toKm(decodeField(frame.data, source.field)), payload: frame.data };
  }

  await prepareRequest(connection, source);
  const response = await sendRequest(connection, source.request);
  if (response.status !== 'ok') return { km: null, payload: null, response };
  return { km: toKm(decodeField(response.data, source.field)), payload: response.data, response };
}
