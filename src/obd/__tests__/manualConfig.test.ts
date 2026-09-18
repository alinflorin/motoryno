import { describe, expect, it } from '@jest/globals';

import {
  applyManualForm,
  buildOdometerSource,
  buildVinSource,
  isCanId,
  isHexBytes,
  isHexLines,
  MANUAL_BROADCAST_LABEL,
  MANUAL_ODOMETER_LABEL,
  manualFormFromObd,
  parseHexLines,
  parseInitCommands,
  type OdometerFormValues,
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

const EMPTY_ODOMETER: OdometerFormValues = {
  enabled: false,
  mode: 'request',
  canId: '',
  protocol: 'auto',
  header: '',
  receiveAddress: '',
  atCommands: '',
  session: '',
  setup: '',
  request: '',
  offset: '0',
  length: '3',
  endian: 'be',
  encoding: 'uint',
  scale: '1',
  add: '0',
  unit: 'km',
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
    expect(isHexLines('3E 00\n2701\n\n')).toBe(true);
    expect(isHexLines('3E 0')).toBe(false);
  });

  it('parses hex request lines', () => {
    expect(parseHexLines(' 3e 00 \n\n27 01')).toEqual(['3E00', '2701']);
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
      atCommands: 'at fcsh 612\n',
      session: '10 03',
      setup: '3e 00\n27 01',
      request: '22 f1 90',
    });
    expect(vin).toEqual({
      label: 'Manual VIN request',
      protocol: 'can-11-500',
      header: '612',
      receiveAddress: '482',
      atCommands: ['ATFCSH612'],
      session: '1003',
      setup: ['3E00', '2701'],
      request: '22F190',
      manual: true,
    });

    const odometer = buildOdometerSource({ ...EMPTY_ODOMETER, enabled: true, request: '2142' });
    expect(odometer).toEqual({
      kind: 'request',
      label: MANUAL_ODOMETER_LABEL,
      request: '2142',
      field: { offset: 0, length: 3, endian: 'be', scale: 1 },
      manual: true,
    });

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

  it('builds broadcast sources and the full byte-field transform', () => {
    const source = buildOdometerSource({
      ...EMPTY_ODOMETER,
      enabled: true,
      mode: 'broadcast',
      canId: '3d0',
      offset: '2',
      length: '4',
      endian: 'le',
      encoding: 'bcd',
      scale: '0.1',
      add: '-5',
      unit: 'mi',
    });
    expect(source).toEqual({
      kind: 'broadcast',
      label: MANUAL_BROADCAST_LABEL,
      canId: '3D0',
      field: { offset: 2, length: 4, endian: 'le', scale: 0.1, encoding: 'bcd', add: -5, unit: 'mi' },
      manual: true,
    });
    const form = manualFormFromObd({ ...obd, odometerSource: source }).odometer;
    expect(form).toMatchObject({
      enabled: true,
      mode: 'broadcast',
      canId: '3D0',
      offset: '2',
      length: '4',
      endian: 'le',
      encoding: 'bcd',
      scale: '0.1',
      add: '-5',
      unit: 'mi',
    });
    expect(buildOdometerSource(form)).toEqual(source);
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
