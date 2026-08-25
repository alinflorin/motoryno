/**
 * VIN decoding: turns a 17-character VIN into make/model/year.
 *
 * `fallbackDecodeVin` below is a deliberately small stopgap - it only knows
 * the standardized model-year character (position 10) and a short list of
 * common World Manufacturer Identifiers (positions 1-3). It gets *make* and
 * *year* right for a lot of vehicles, but leaves *model* null: the model
 * (VDS, positions 4-8) isn't standardized, and correctly interpreting it
 * needs a real per-manufacturer dataset.
 *
 * Call `setVinDecoder` once a real decoding library/dataset is available to
 * replace this without touching any of its callers.
 */

import { isValidVin } from '@/utils/validation';

export interface DecodedVin {
  make: string | null;
  model: string | null;
  year: number | null;
}

export type VinDecoder = (vin: string) => DecodedVin | null;

// Model-year code cycles every 30 years; position 7 (index 6) distinguishes
// which cycle for VINs issued 2010+ (digit there means 2010+, letter means
// pre-2010) per NHTSA guidance. We don't have that reliably from BLE-scanned
// VINs alone, so pick whichever candidate year isn't in the future.
const YEAR_CODES: Record<string, number> = {
  A: 1980,
  B: 1981,
  C: 1982,
  D: 1983,
  E: 1984,
  F: 1985,
  G: 1986,
  H: 1987,
  J: 1988,
  K: 1989,
  L: 1990,
  M: 1991,
  N: 1992,
  P: 1993,
  R: 1994,
  S: 1995,
  T: 1996,
  V: 1997,
  W: 1998,
  X: 1999,
  Y: 2000,
  '1': 2001,
  '2': 2002,
  '3': 2003,
  '4': 2004,
  '5': 2005,
  '6': 2006,
  '7': 2007,
  '8': 2008,
  '9': 2009,
};

/** Starter WMI (VIN positions 1-3) → make table. Extend/replace as real VIN data comes in. */
const WMI_MAKES: Record<string, string> = {
  WDB: 'Mercedes-Benz',
  WDD: 'Mercedes-Benz',
  WDC: 'Mercedes-Benz',
  WDF: 'Mercedes-Benz',
  W1K: 'Mercedes-Benz',
  W1N: 'Mercedes-Benz',
  WBA: 'BMW',
  WBS: 'BMW',
  WBY: 'BMW',
  WBW: 'BMW',
  WAU: 'Audi',
  TRU: 'Audi',
  WVW: 'Volkswagen',
  WV1: 'Volkswagen',
  WV2: 'Volkswagen',
  '1VW': 'Volkswagen',
  TMB: 'Škoda',
  VF1: 'Renault',
  VF3: 'Peugeot',
  VF7: 'Citroën',
  VF8: 'Peugeot',
  ZFA: 'Fiat',
  ZFF: 'Ferrari',
  WP0: 'Porsche',
  WP1: 'Porsche',
  YV1: 'Volvo',
  YV4: 'Volvo',
  JHM: 'Honda',
  JH4: 'Acura',
  JTD: 'Toyota',
  JTM: 'Toyota',
  JT2: 'Toyota',
  JN1: 'Nissan',
  JN8: 'Nissan',
  KMH: 'Hyundai',
  KNA: 'Kia',
  '1HG': 'Honda',
  '2HG': 'Honda',
  '1FA': 'Ford',
  '1FT': 'Ford',
  '1G1': 'Chevrolet',
  '1GC': 'Chevrolet',
  '5YJ': 'Tesla',
  '7SA': 'Tesla',
};

function decodeYear(vin: string): number | null {
  const code = vin[9]?.toUpperCase();
  const base = code ? YEAR_CODES[code] : undefined;
  if (base === undefined) return null;

  const now = new Date().getFullYear();
  // Same letter/digit repeats every 30 years - pick the candidate that isn't in the future.
  const candidate = base + 30 <= now + 1 ? base + 30 : base;
  return candidate;
}

function decodeMake(vin: string): string | null {
  const wmi3 = vin.slice(0, 3).toUpperCase();
  const wmi2 = vin.slice(0, 2).toUpperCase();
  return WMI_MAKES[wmi3] ?? WMI_MAKES[wmi2] ?? null;
}

function fallbackDecodeVin(vin: string): DecodedVin {
  return {
    make: decodeMake(vin),
    model: null,
    year: decodeYear(vin),
  };
}

let activeDecoder: VinDecoder = fallbackDecodeVin;

/** Swaps in a real VIN-decoding library/dataset. Replaces `fallbackDecodeVin` for every future `decodeVin` call. */
export function setVinDecoder(decoder: VinDecoder): void {
  activeDecoder = decoder;
}

/** Restores the built-in fallback decoder - mainly useful in tests. */
export function resetVinDecoder(): void {
  activeDecoder = fallbackDecodeVin;
}

export function decodeVin(vin: string): DecodedVin | null {
  if (!isValidVin(vin)) return null;
  return activeDecoder(vin.toUpperCase());
}
