import { describe, expect, it } from '@jest/globals';

import { STANDARD_ODOMETER_SOURCE, vehicleOdometerSources } from '@/obd/odometer/candidates';
import { findFieldMatches, matchTolerance } from '@/obd/odometer/match';
import { daimlerDiagnosticAddress, isMercedesVehicle, mercedesDiscoveryTargets, mercedesModelSeries } from '@/obd/odometer/mercedes';
import { decodeField, isOdometerSource } from '@/obd/odometer/source';

describe('decodeField', () => {
  it('decodes big-endian and little-endian fields with scale', () => {
    const bytes = [0x00, 0x01, 0xe2, 0x40]; // 123456
    expect(decodeField(bytes, { offset: 1, length: 3, endian: 'be', scale: 1 })).toBe(123456);
    expect(decodeField(bytes, { offset: 0, length: 4, endian: 'be', scale: 0.1 })).toBeCloseTo(12345.6);
    expect(decodeField([0x40, 0xe2, 0x01], { offset: 0, length: 3, endian: 'le', scale: 1 })).toBe(123456);
  });

  it('returns null for out-of-range fields and the all-0xFF sentinel', () => {
    expect(decodeField([0x01], { offset: 0, length: 3, endian: 'be', scale: 1 })).toBeNull();
    expect(decodeField([0xff, 0xff, 0xff], { offset: 0, length: 3, endian: 'be', scale: 1 })).toBeNull();
  });

  it('decodes the standard PID A6 reply', () => {
    // 0x0012D687 = 1234567 * 0.1 km
    expect(decodeField([0x00, 0x12, 0xd6, 0x87], STANDARD_ODOMETER_SOURCE.field)).toBeCloseTo(123456.7);
  });
});

describe('findFieldMatches', () => {
  it('finds a 24-bit big-endian km value anywhere in a payload', () => {
    const payload = [0x12, 0x34, 0x02, 0xf5, 0xd0, 0x99]; // 0x02F5D0 = 194000 at offset 2
    const matches = findFieldMatches(payload, 194000);
    expect(matches[0]).toEqual({ field: { offset: 2, length: 3, endian: 'be', scale: 1 }, km: 194000 });
  });

  it('accepts a reading within tolerance and rejects one outside it', () => {
    const payload = [0x02, 0xf5, 0xd2]; // 194002
    expect(findFieldMatches(payload, 194000)).toHaveLength(1);
    expect(findFieldMatches(payload, 190000)).toHaveLength(0);
    expect(matchTolerance(194000)).toBeCloseTo(194);
    expect(matchTolerance(1000)).toBe(3);
  });

  it('recognises 0.1 km/bit and miles encodings', () => {
    expect(findFieldMatches([0x00, 0x1d, 0x9a, 0x20], 194000)).toContainEqual( // 0x1D9A20 = 1940000 x 0.1 km
      { field: { offset: 0, length: 4, endian: 'be', scale: 0.1 }, km: 194000 });
    const miles = Math.round(194000 / 1.60934); // 120546
    expect(findFieldMatches([(miles >> 16) & 0xff, (miles >> 8) & 0xff, miles & 0xff], 194000).some((m) => m.field.scale === 1.60934)).toBe(true);
  });

  it('never matches on 2-byte windows', () => {
    expect(findFieldMatches([0x30, 0x39], 12345)).toHaveLength(0);
  });
});

describe('Mercedes addressing', () => {
  it('reproduces the documented Daimler request/response pairs', () => {
    expect(daimlerDiagnosticAddress(1)).toEqual({ header: '612', receiveAddress: '482' }); // EZS / EIS_204
    expect(daimlerDiagnosticAddress(3)).toEqual({ header: '632', receiveAddress: '486' }); // ESP / ABR
    expect(daimlerDiagnosticAddress(11)).toEqual({ header: '6B2', receiveAddress: '496' }); // EPS
  });

  it('identifies Mercedes vehicles by WMI or make text and extracts the model series', () => {
    expect(isMercedesVehicle('WDD2040471F123456', null)).toBe(true);
    expect(isMercedesVehicle(null, 'Mercedes-Benz')).toBe(true);
    expect(isMercedesVehicle('WBA3A5C50DF123456', 'BMW')).toBe(false);
    expect(mercedesModelSeries('WDD2040471F123456')).toBe('204');
    expect(mercedesModelSeries('WDDGF8AB1EA123456')).toBeNull();
  });

  it('lists the EZS first, every Daimler index, and the engine ECU last', () => {
    const targets = mercedesDiscoveryTargets();
    expect(targets[0]).toMatchObject({ header: '612', receiveAddress: '482' });
    expect(targets[targets.length - 1]).toMatchObject({ header: '7E0', receiveAddress: '7E8' });
    expect(targets.filter((t) => t.header === '612')).toHaveLength(1);
    expect(targets.length).toBe(0x3f + 2);
  });
});

describe('vehicleOdometerSources', () => {
  it('puts the standard PID first and adds Mercedes-specific requests for a W204 VIN', () => {
    const sources = vehicleOdometerSources('WDD2040471F123456', 'Mercedes-Benz');
    expect(sources[0]).toBe(STANDARD_ODOMETER_SOURCE);
    expect(sources.some((s) => s.kind === 'request' && s.header === '612' && s.receiveAddress === '482')).toBe(true);
    expect(sources.every(isOdometerSource)).toBe(true);
  });

  it('falls back to just the standard PID for an unknown make', () => {
    expect(vehicleOdometerSources('ZZZ00000000000000', 'Unknown Motors')).toEqual([STANDARD_ODOMETER_SOURCE]);
  });
});

describe('isOdometerSource', () => {
  it('accepts well-formed sources and rejects malformed ones', () => {
    expect(isOdometerSource({ kind: 'broadcast', label: 'x', canId: '009E', field: { offset: 4, length: 3, endian: 'be', scale: 1 } })).toBe(true);
    expect(isOdometerSource({ kind: 'request', label: 'x', request: '01A6' })).toBe(false);
    expect(isOdometerSource(null)).toBe(false);
  });
});
