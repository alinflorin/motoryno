import { describe, expect, it } from '@jest/globals';

import { normalizeAppData } from '@/storage/normalize';
import type { AppData } from '@/storage/types';
import { isValidAppData } from '@/storage/validate';

const legacy = {
  settings: {
    onboardingDone: true,
    theme: 'system',
    language: 'en',
    useImperialUnits: false,
    currency: 'EUR',
    notifications: { cron: null },
  },
  data: {
    cars: [
      {
        vin: 'WDD2040471F123456',
        displayName: 'C250',
        make: 'Mercedes-Benz',
        model: 'C250 CDI',
        year: 2011,
        odometerKm: 200000,
        trackedServiceItems: [{ name: 'Engine oil', timeIntervalDays: 365, kmInterval: 10000 }],
        serviceVisits: [{ uuid: '1', timestamp: 1, odometerKm: 1, shopName: 'x', spend: 1, itemsDone: [] }],
        obd: { deviceName: 'OBDII', deviceAddress: 'AA:BB', lastSyncedAt: null },
      },
    ],
  },
} as unknown as AppData;

describe('normalizeAppData', () => {
  it('fills in every field older data predates', () => {
    const normalized = normalizeAppData(legacy);
    const car = normalized.data.cars[0];
    expect(normalized.settings.useUnknownServiceStatus).toBe(true);
    expect(car.trackedServiceItems[0].isActive).toBe(true);
    expect(car.serviceVisits[0].comments).toBeNull();
    expect(car.obd?.odometerSource).toBeNull();
  });

  it('drops a malformed persisted odometer source but keeps a valid one', () => {
    const withSource = JSON.parse(JSON.stringify(legacy)) as AppData;
    withSource.data.cars[0].obd!.odometerSource = {
      kind: 'request',
      label: 'x',
      request: '01A6',
      field: { offset: 0, length: 4, endian: 'be', scale: 0.1 },
    };
    expect(normalizeAppData(withSource).data.cars[0].obd?.odometerSource?.kind).toBe('request');

    const malformed = JSON.parse(JSON.stringify(legacy)) as AppData;
    (malformed.data.cars[0].obd as unknown as Record<string, unknown>).odometerSource = { kind: 'request' };
    expect(normalizeAppData(malformed).data.cars[0].obd?.odometerSource).toBeNull();
  });
});

describe('isValidAppData', () => {
  it('accepts the legacy shape and rejects structurally broken blobs', () => {
    expect(isValidAppData(legacy)).toBe(true);
    expect(isValidAppData({ settings: {}, data: { cars: [{ vin: 1 }] } })).toBe(false);
    expect(isValidAppData({ settings: {}, data: { cars: [{ ...legacy.data.cars[0], obd: { deviceName: 1 } }] } })).toBe(false);
    expect(isValidAppData(null)).toBe(false);
  });
});
