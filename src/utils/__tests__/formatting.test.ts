import { describe, expect, it } from '@jest/globals';

import { formatDateDMY, parseDateDMY } from '@/utils/date';
import { DEFAULT_NOTIFICATION_TIME, formatCronTime, formatTimeLabel, parseCronTime } from '@/utils/notificationCron';
import { displayToKm, distanceUnitFor, kmToDisplay } from '@/utils/units';
import { isValidVin, isValidYear, sanitizeVinInput } from '@/utils/validation';

describe('date', () => {
  it('round-trips DD.MM.YYYY', () => {
    const timestamp = parseDateDMY('05.03.2024');
    expect(timestamp).not.toBeNull();
    expect(formatDateDMY(timestamp!)).toBe('05.03.2024');
  });

  it('rejects impossible dates instead of rolling them over', () => {
    expect(parseDateDMY('31.02.2024')).toBeNull();
    expect(parseDateDMY('not a date')).toBeNull();
  });
});

describe('notificationCron', () => {
  it('parses and formats the daily schedule', () => {
    expect(parseCronTime('30 7 * * *')).toEqual({ hour: 7, minute: 30 });
    expect(formatCronTime({ hour: 7, minute: 30 })).toBe('30 7 * * *');
    expect(formatTimeLabel({ hour: 7, minute: 5 })).toBe('07:05');
  });

  it('falls back to the default for null or malformed values', () => {
    expect(parseCronTime(null)).toEqual(DEFAULT_NOTIFICATION_TIME);
    expect(parseCronTime('99 99 * * *')).toEqual(DEFAULT_NOTIFICATION_TIME);
  });
});

describe('units', () => {
  it('converts between km and the display unit', () => {
    expect(distanceUnitFor(true)).toBe('mi');
    expect(kmToDisplay(160.934, 'mi')).toBeCloseTo(100);
    expect(displayToKm(100, 'mi')).toBeCloseTo(160.934);
    expect(displayToKm(100, 'km')).toBe(100);
  });
});

describe('validation', () => {
  it('sanitises and validates VINs', () => {
    expect(sanitizeVinInput('wdd2040471f123456ioq')).toBe('WDD2040471F123456');
    expect(isValidVin('WDD2040471F123456')).toBe(true);
    expect(isValidVin('WDD2040471I123456')).toBe(false);
  });

  it('bounds model years', () => {
    expect(isValidYear(2011)).toBe(true);
    expect(isValidYear(1850)).toBe(false);
    expect(isValidYear(new Date().getFullYear() + 5)).toBe(false);
  });
});
