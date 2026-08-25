/**
 * VIN decoding: make/year from a VIN, backed by the same bundled Delphi-OBD
 * asset catalogs used elsewhere in `obd/catalogs` (`wmiIndex.json` maps a
 * VIN's WMI - the first three characters - to one of the app's manufacturer
 * catalog keys; `manufacturerNames.json` maps that key to a display name).
 * Offline, no native module, works the same on every platform including web.
 * It doesn't decode model, only make/year, so `model` here is always null.
 *
 * Model year comes from VIN position 10 (the standard ISO 3779 year code),
 * disambiguated using position 7: a digit there marks a pre-2010 VIN, a
 * letter a 2010+ one (the same 30-year code cycle repeats every 30 years).
 *
 * `setVinDecoder`/`resetVinDecoder` exist as an extension point (tests, or a
 * different backend down the line) - everything else should just call
 * `decodeVin`.
 */

import manufacturerNames from '@/obd/catalogs/manufacturerNames.json';
import wmiIndex from '@/obd/catalogs/wmiIndex.json';
import { isValidVin } from '@/utils/validation';

export interface DecodedVin {
  make: string | null;
  model: string | null;
  year: number | null;
}

export type VinDecoder = (vin: string) => Promise<DecodedVin | null>;

/** ISO 3779 model-year code (VIN position 10) -> the two candidate years it can mean, 30 years apart. */
const YEAR_CODES: Record<string, [number, number]> = {
  A: [1980, 2010],
  B: [1981, 2011],
  C: [1982, 2012],
  D: [1983, 2013],
  E: [1984, 2014],
  F: [1985, 2015],
  G: [1986, 2016],
  H: [1987, 2017],
  J: [1988, 2018],
  K: [1989, 2019],
  L: [1990, 2020],
  M: [1991, 2021],
  N: [1992, 2022],
  P: [1993, 2023],
  R: [1994, 2024],
  S: [1995, 2025],
  T: [1996, 2026],
  V: [1997, 2027],
  W: [1998, 2028],
  X: [1999, 2029],
  Y: [2000, 2030],
  '1': [2001, 2031],
  '2': [2002, 2032],
  '3': [2003, 2033],
  '4': [2004, 2034],
  '5': [2005, 2035],
  '6': [2006, 2036],
  '7': [2007, 2037],
  '8': [2008, 2038],
  '9': [2009, 2039],
};

function decodeModelYear(vin: string): number | null {
  const [pre2010, post2010] = YEAR_CODES[vin.charAt(9)] ?? [];
  if (pre2010 === undefined) return null;
  // Position 7 (0-indexed 6) is a digit only in pre-2010 VINs (it's part of
  // the sequential vehicle number there; 2010+ VINs put a check letter/digit
  // there per the newer WMI+VDS scheme) - that's what breaks the 30-year tie.
  return /\d/.test(vin.charAt(6)) ? pre2010 : post2010;
}

function decodeMake(vin: string): string | null {
  const wmi = vin.slice(0, 3);
  const key = (wmiIndex as Record<string, string>)[wmi];
  if (!key) return null;
  return (manufacturerNames as Record<string, string>)[key] ?? null;
}

function baseDecoder(vin: string): DecodedVin | null {
  const make = decodeMake(vin);
  const year = decodeModelYear(vin);
  if (make === null && year === null) return null;
  return { make, model: null, year };
}

let activeDecoder: VinDecoder = async (vin) => baseDecoder(vin);

/** Swaps in a different VIN decoder - mainly for tests. */
export function setVinDecoder(decoder: VinDecoder): void {
  activeDecoder = decoder;
}

/** Restores the built-in catalog-backed decoder. */
export function resetVinDecoder(): void {
  activeDecoder = async (vin) => baseDecoder(vin);
}

export async function decodeVin(vin: string): Promise<DecodedVin | null> {
  if (!isValidVin(vin)) return null;
  return activeDecoder(vin.toUpperCase());
}
