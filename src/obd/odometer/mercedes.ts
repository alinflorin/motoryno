/**
 * Mercedes-Benz specifics for the odometer read - written for the W204
 * C-Class (2007-2014, e.g. C250 CDI / OM651) and the platforms that share
 * its electrical architecture (W212/W207 E-Class, X204 GLK, W218 CLS, W197
 * SLS, R172 SLK, R231 SL).
 *
 * What's known about these cars (sources: Daimler CBF/J2534 traces shared in
 * the CaesarSuite project, rnd-ash's mercedes-hacking-docs, W211 CAN
 * reverse-engineering, and Xentry/Vediamo user reports):
 *
 * - Only the engine ECU (CRD3 for the OM651 diesel) sits at the OBD-II
 *   standard 0x7E0 -> 0x7E8 pair and speaks UDS. It answers Mode 09 02 (VIN)
 *   but has no Mode 01 A6 odometer - that PID postdates the car.
 * - The odometer is kept (and cross-checked) by the instrument cluster
 *   (IC204) and the ignition switch/gateway (EZS, a.k.a. EIS_204). Neither
 *   is on the OBD-II addresses: Daimler's own diagnostic CAN IDs are
 *   request 0x6n2 / response 0x48m - e.g. EZS 0x612 -> 0x482, ESP (ABR)
 *   0x632 -> 0x486, steering (EPS) 0x6B2 -> 0x496. The ELM327's automatic
 *   "reply = request + 8" receive filter doesn't cover these, so both the
 *   header and the receive filter must be set explicitly.
 * - The EZS speaks UDS (session `10 03` works); the cluster is a KWP2000-
 *   over-CAN ECU ("KW2C3PE") which expects Daimler's extended session
 *   `10 92` and serves live values through ReadDataByLocalIdentifier `21 xx`.
 * - The exact identifier holding the km isn't public for either ECU, and
 *   the cluster's diagnostic ID pair isn't published outside Daimler's CBF
 *   files. Hence the two-part strategy: try the handful of documented
 *   addresses/requests first (`mercedesKnownOdometerSources`), and let the
 *   learn flow discover the rest by probing the Daimler ID scheme
 *   (`mercedesDiscoveryTargets`) and sweeping identifiers against the
 *   reading the user copies off the dash - then remember what answered.
 * - Km broadcasts: on the previous generation (W211) the EZS and cluster
 *   periodically broadcast the odometer on the interior CAN (24-bit km at
 *   bytes 4-6 of frames 0x0058 / 0x009E); the gateway mirrors bus traffic
 *   onto the diagnostic connector, so passive monitoring can catch it. The
 *   W204-generation frame IDs differ, so this is left to the learn flow's
 *   monitor pass rather than hard-coded.
 */

import wmiIndex from '@/obd/catalogs/wmiIndex.json';
import type { OdometerSource } from '@/obd/odometer/source';

/** Daimler diagnostic-CAN addressing for ECU index `n`: request 0x600 + (n << 4) + 2, response 0x480 + (n << 1). */
export function daimlerDiagnosticAddress(index: number): { header: string; receiveAddress: string } {
  return {
    header: (0x600 + (index << 4) + 2).toString(16).toUpperCase(),
    receiveAddress: (0x480 + (index << 1)).toString(16).toUpperCase(),
  };
}

/** ECUs with documented IDs on this generation. */
export const MERCEDES_KNOWN_ECUS = {
  engine: { label: 'Engine ECU (CRD3/ME)', header: '7E0', receiveAddress: '7E8', session: '1003' as const },
  ezs: { label: 'EZS / EIS_204 (ignition switch & gateway)', ...daimlerDiagnosticAddress(1), session: '1003' as const },
} as const;

/** Daimler's extended KWP2000 diagnostic session, required before most `21 xx` reads on the CBF-era ECUs. */
export const DAIMLER_KWP_EXTENDED_SESSION = '1092';
/** UDS extended diagnostic session. */
export const UDS_EXTENDED_SESSION = '1003';

/** Highest ECU index the discovery probe walks (0x602 .. 0x9F2 requests). The documented ECUs fall well inside it. */
export const MERCEDES_DISCOVERY_MAX_INDEX = 0x3f;

export function isMercedesVehicle(vin: string | null, make: string | null): boolean {
  const wmi = vin && vin.length >= 3 ? vin.slice(0, 3).toUpperCase() : null;
  if (wmi && (wmiIndex as Record<string, string>)[wmi] === 'mercedes') return true;
  return /mercedes|daimler|\bmb\b/i.test(make ?? '');
}

/** The three-digit model series (e.g. '204' for the W204/S204 C-Class) embedded in European Mercedes VINs, or null for other formats. */
export function mercedesModelSeries(vin: string | null): string | null {
  if (!vin || vin.length < 6) return null;
  const series = vin.slice(3, 6);
  return /^\d{3}$/.test(series) ? series : null;
}

/**
 * Requests to try up front on a Mercedes, cheapest and most likely first.
 * These target the ECUs whose addressing is documented; the identifier is
 * the best available guess, so a miss here just hands over to the learn
 * flow rather than meaning anything is wrong.
 */
export function mercedesKnownOdometerSources(vin: string | null, make: string | null): OdometerSource[] {
  if (!isMercedesVehicle(vin, make)) return [];
  const { engine, ezs } = MERCEDES_KNOWN_ECUS;
  return [
    {
      kind: 'request',
      label: `${ezs.label}: 22 0100`,
      protocol: 'can-11-500',
      header: ezs.header,
      receiveAddress: ezs.receiveAddress,
      session: ezs.session,
      request: '220100',
      field: { offset: 0, length: 3, endian: 'be', scale: 1 },
    },
    {
      kind: 'request',
      label: `${engine.label}: 22 0202 (Delphi catalog "mileage_km_24bit")`,
      protocol: 'can-11-500',
      header: engine.header,
      receiveAddress: engine.receiveAddress,
      request: '220202',
      field: { offset: 0, length: 3, endian: 'be', scale: 1 },
    },
  ];
}

export interface DiscoveryTarget {
  label: string;
  header: string;
  receiveAddress: string;
  /** Sessions to try, in order, before sweeping identifiers. */
  sessions: string[];
  /** Identifier sweeps to run, in order. */
  sweeps: IdentifierSweep[];
}

export interface IdentifierSweep {
  label: string;
  /** Builds the request for one identifier in the sweep. */
  request: (identifier: number) => string;
  from: number;
  to: number;
}

const KWP_LOCAL_IDENTIFIER_SWEEP: IdentifierSweep = {
  label: 'KWP ReadDataByLocalIdentifier 21 00..FF',
  request: (id) => `21${id.toString(16).toUpperCase().padStart(2, '0')}`,
  from: 0x00,
  to: 0xff,
};

/** UDS DIDs 0x0100..0x01FF - where Daimler's CBF-era UDS ECUs keep their live "Istwerte" (measured values). */
const UDS_DID_01XX_SWEEP: IdentifierSweep = {
  label: 'UDS ReadDataByIdentifier 22 0100..01FF',
  request: (id) => `22${(0x0100 + id).toString(16).toUpperCase().padStart(4, '0')}`,
  from: 0x00,
  to: 0xff,
};

/**
 * Every address the learn flow should knock on for a Mercedes, most
 * promising first: the documented EZS (holds the km, UDS), then the whole
 * Daimler index range - which is where the cluster lives - then the engine
 * ECU last, since it's the least likely to expose vehicle mileage.
 */
export function mercedesDiscoveryTargets(): DiscoveryTarget[] {
  const { engine, ezs } = MERCEDES_KNOWN_ECUS;
  const targets: DiscoveryTarget[] = [
    {
      label: ezs.label,
      header: ezs.header,
      receiveAddress: ezs.receiveAddress,
      sessions: [UDS_EXTENDED_SESSION],
      sweeps: [UDS_DID_01XX_SWEEP],
    },
  ];
  for (let index = 0; index <= MERCEDES_DISCOVERY_MAX_INDEX; index++) {
    if (index === 1) continue; // the EZS, already listed
    const address = daimlerDiagnosticAddress(index);
    targets.push({
      label: `Daimler ECU #${index} (${address.header}/${address.receiveAddress})`,
      ...address,
      sessions: [DAIMLER_KWP_EXTENDED_SESSION, UDS_EXTENDED_SESSION],
      sweeps: [KWP_LOCAL_IDENTIFIER_SWEEP, UDS_DID_01XX_SWEEP],
    });
  }
  targets.push({
    label: engine.label,
    header: engine.header,
    receiveAddress: engine.receiveAddress,
    sessions: [UDS_EXTENDED_SESSION],
    sweeps: [UDS_DID_01XX_SWEEP],
  });
  return targets;
}
