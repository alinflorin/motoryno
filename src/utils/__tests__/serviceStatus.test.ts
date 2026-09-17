import { describe, expect, it } from '@jest/globals';

import type { Car } from '@/storage/types';
import { computeCarItemStatuses, computeTrackedItemStatus, getOverdueSummaryForAllCars } from '@/utils/serviceStatus';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 1);

function car(overrides: Partial<Car> = {}): Car {
  return {
    vin: 'WDD2040471F123456',
    displayName: 'C250',
    make: 'Mercedes-Benz',
    model: 'C250 CDI',
    year: 2011,
    odometerKm: 200_000,
    trackedServiceItems: [{ name: 'Engine oil', timeIntervalDays: 365, kmInterval: 10_000, isActive: true }],
    serviceVisits: [],
    obd: null,
    ...overrides,
  };
}

describe('computeTrackedItemStatus', () => {
  const item = { name: 'Engine oil', timeIntervalDays: 365, kmInterval: 10_000, isActive: true };

  it('reports "unknown" for a never-serviced item when that setting is on, overdue otherwise', () => {
    expect(computeTrackedItemStatus(item, car(), true, NOW).status).toBe('unknown');
    expect(computeTrackedItemStatus(item, car(), false, NOW).status).toBe('overdue');
  });

  it('uses whichever of time or distance is furthest along', () => {
    const recent = car({
      serviceVisits: [
        { uuid: '1', timestamp: NOW - 30 * DAY, odometerKm: 191_000, shopName: 'x', spend: 0, itemsDone: ['Engine oil'], comments: null },
      ],
    });
    const status = computeTrackedItemStatus(item, recent, true, NOW);
    expect(status.status).toBe('due-soon'); // 9,000 of 10,000 km = 0.9
    expect(status.progress).toBeCloseTo(0.9);
    expect(status.lastVisit?.uuid).toBe('1');
  });

  it('is overdue once either interval is exceeded and clamps progress to 1', () => {
    const old = car({
      serviceVisits: [
        { uuid: '1', timestamp: NOW - 400 * DAY, odometerKm: 199_000, shopName: 'x', spend: 0, itemsDone: ['Engine oil'], comments: null },
      ],
    });
    const status = computeTrackedItemStatus(item, old, true, NOW);
    expect(status.status).toBe('overdue');
    expect(status.progress).toBe(1);
  });

  it('treats an item with no interval as fine', () => {
    expect(computeTrackedItemStatus({ ...item, timeIntervalDays: null, kmInterval: null }, car(), true, NOW).status).toBe('ok');
  });
});

describe('computeCarItemStatuses / getOverdueSummaryForAllCars', () => {
  it('skips inactive items and cars with nothing overdue', () => {
    const withInactive = car({
      trackedServiceItems: [
        { name: 'Engine oil', timeIntervalDays: 365, kmInterval: null, isActive: true },
        { name: 'Battery', timeIntervalDays: 1, kmInterval: null, isActive: false },
      ],
    });
    expect(computeCarItemStatuses(withInactive, false, NOW).map((s) => s.item.name)).toEqual(['Engine oil']);
    expect(getOverdueSummaryForAllCars([withInactive], false, NOW)).toHaveLength(1);
    expect(getOverdueSummaryForAllCars([withInactive], true, NOW)).toHaveLength(0);
  });
});
