import { describe, expect, it } from '@jest/globals';

import {
  applyManualForm,
  buildOdometerSource,
  buildVinSource,
  isCanId,
  isHexBytes,
  MANUAL_ODOMETER_LABEL,
  manualFormFromObd,
  parseInitCommands,
} from '@/obd/manualConfig';
import type { ObdConfig } from '@/storage/types';

const obd: ObdConfig = {
  deviceName: 'OBDII',
  deviceAddress: 'AA',
  lastSyncedAt: null,
  initCommands: [],
  vinSource: null,
  odometerSource: null,
};

describe('manualConfig', () => {
  it('validates hex bytes and CAN ids', () => {
    expect(isHexBytes('22 01 00')).toBe(true);
    expect(isHexBytes('220100')).toBe(true);
    expect(isHexBytes('2201')).toBe(true);
    expect(isHexBytes('2')).toBe(false);
    expect(isHexBytes('zz')).toBe(false);
    expect(isCanId('612')).toBe(true);
    expect(isCanId('7E8')).toBe(true);
    expect(isCanId('18DAF110')).toBe(true);
    expect(isCanId('61')).toBe(false);
  });

  it('parses init commands one per line, normalised', () => {
    expect(parseInitCommands(' atsp6 \n\nat st 19\r\n')).toEqual(['ATSP6', 'ATST19']);
  });

  it('builds sources from form values and round-trips them', () => {
    const vin = buildVinSource({
      enabled: true,
      protocol: 'can-11-500',
      header: '612',
      receiveAddress: '482',
      session: '10 03',
      request: '22 f1 90',
    });
    expect(vin).toEqual({
      label: 'Manual VIN request',
      protocol: 'can-11-500',
      header: '612',
      receiveAddress: '482',
      session: '1003',
      request: '22F190',
    });

    const odometer = buildOdometerSource({
      enabled: true,
      protocol: 'auto',
      header: '',
      receiveAddress: '',
      session: '',
      request: '2142',
      offset: '0',
      length: '3',
      endian: 'be',
      scale: '1',
    });
    expect(odometer).toMatchObject({
      kind: 'request',
      label: MANUAL_ODOMETER_LABEL,
      request: '2142',
      field: { offset: 0, length: 3, endian: 'be', scale: 1 },
    });
    expect(odometer?.header).toBeUndefined();

    const vinForm = manualFormFromObd({ ...obd, vinSource: vin }).vin;
    const applied = applyManualForm(obd, {
      initCommands: 'ATSP6',
      vin: vinForm,
      odometer: manualFormFromObd({ ...obd, odometerSource: odometer }).odometer,
    });
    expect(applied.initCommands).toEqual(['ATSP6']);
    expect(applied.vinSource?.request).toBe('22F190');
    expect(applied.odometerSource?.label).toBe(MANUAL_ODOMETER_LABEL);
    expect(manualFormFromObd(applied).odometer.enabled).toBe(true);
    expect(manualFormFromObd(applied).vin.enabled).toBe(true);
  });

  it('keeps a learned source when the override is off, drops a manual one', () => {
    const learned: ObdConfig = {
      ...obd,
      odometerSource: { kind: 'request', label: 'learned', request: '2142', field: { offset: 0, length: 3, endian: 'be', scale: 1 } },
    };
    const form = manualFormFromObd(learned);
    expect(form.odometer.enabled).toBe(false);
    expect(form.odometer.request).toBe('2142');
    expect(applyManualForm(learned, form).odometerSource?.label).toBe('learned');

    const manual = applyManualForm(learned, { ...form, odometer: { ...form.odometer, enabled: true } });
    expect(manual.odometerSource?.label).toBe(MANUAL_ODOMETER_LABEL);
    expect(applyManualForm(manual, { ...form, odometer: { ...form.odometer, enabled: false } }).odometerSource).toBeNull();
  });
});
