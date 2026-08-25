/**
 * Manufacturer fallback for reading the VIN over OBD2. Standard SAE J1979
 * Mode 09 PID 02 (see `requestVin` in `elm327.ts`) works on the vast majority
 * of vehicles and should always be tried first - this module only matters
 * when that comes back empty, which happens on makes/models that only expose
 * the VIN through a manufacturer UDS ReadDataByIdentifier request (Mode 0x22,
 * DID 0xF190) aimed at a specific ECU instead of the default/broadcast
 * address.
 *
 * The DID itself (0xF190, "vin") is essentially universal across the bundled
 * Delphi-OBD catalogs - every manufacturer catalog that defines it uses the
 * same PID, ASCII-encoded. What actually differs per brand is which ECU
 * header the request needs to be aimed at (or none, for makes that answer on
 * the default address). `vinEcuHeaders.json` is a deduplicated list of every
 * such header found across the bundled catalogs, extracted once at vendoring
 * time - so a VIN scan on an as-yet-unidentified vehicle (we don't know the
 * make until the VIN itself has been read) doesn't need to load every
 * manufacturer catalog file just to try them.
 */

import vinEcuHeaders from '@/obd/catalogs/vinEcuHeaders.json';

export interface VinDidCandidate {
  mode: string;
  pid: string;
  /** CAN header/ECU address to aim the request at, or undefined for default/auto addressing. */
  ecuHeader?: string;
}

const VIN_DID_MODE = '22';
const VIN_DID_PID = 'F190';

/** Every (mode, pid, ecuHeader) combination worth trying as a fallback VIN read, undefined-header last. */
export function vinDidCandidates(): VinDidCandidate[] {
  const headers = vinEcuHeaders as string[];
  return [...headers.map((ecuHeader) => ({ mode: VIN_DID_MODE, pid: VIN_DID_PID, ecuHeader })), { mode: VIN_DID_MODE, pid: VIN_DID_PID }];
}

/** Decodes a Mode 22 F190 response payload (data bytes only) as an ASCII VIN, or null if it doesn't look like one. */
export function decodeVinDidBytes(bytes: number[]): string | null {
  const printable = bytes.filter((byte) => byte > 0x20 && byte < 0x7f);
  const vin = String.fromCharCode(...printable).trim();
  return vin.length === 17 ? vin : null;
}
