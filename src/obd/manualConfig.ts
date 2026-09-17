/**
 * Form model for the OBD setup screen's manual overrides: the text the user
 * types <-> the persisted `ObdConfig` fields. Pure functions, no UI, so the
 * mapping and its validation are unit-testable.
 */

import type { DiagnosticRequest, OdometerSource, RequestOdometerSource, VinSource } from '@/obd/odometer/source';
import type { ObdConfig } from '@/storage/types';

export type ProtocolChoice = 'auto' | 'can-11-500';
export type EndianChoice = 'be' | 'le';

export interface RequestFormValues {
  enabled: boolean;
  protocol: ProtocolChoice;
  header: string;
  receiveAddress: string;
  session: string;
  request: string;
}

export interface OdometerFormValues extends RequestFormValues {
  offset: string;
  length: string;
  endian: EndianChoice;
  scale: string;
}

export interface ManualObdFormValues {
  /** One AT command per line. */
  initCommands: string;
  vin: RequestFormValues;
  odometer: OdometerFormValues;
}

export const MANUAL_VIN_LABEL = 'Manual VIN request';
export const MANUAL_ODOMETER_LABEL = 'Manual odometer request';

const EMPTY_REQUEST: RequestFormValues = { enabled: false, protocol: 'auto', header: '', receiveAddress: '', session: '', request: '' };

function requestToForm(request: DiagnosticRequest | null, enabled: boolean): RequestFormValues {
  if (!request) return { ...EMPTY_REQUEST, enabled };
  return {
    enabled,
    protocol: request.protocol ?? 'auto',
    header: request.header ?? '',
    receiveAddress: request.receiveAddress ?? '',
    session: request.session ?? '',
    request: request.request,
  };
}

/** Seeds the form from what's persisted. A learned/scanned odometer source is shown but the override stays off until the user opts in. */
export function manualFormFromObd(obd: ObdConfig): ManualObdFormValues {
  const odometer = obd.odometerSource?.kind === 'request' ? obd.odometerSource : null;
  return {
    initCommands: obd.initCommands.join('\n'),
    vin: requestToForm(obd.vinSource, obd.vinSource !== null),
    odometer: {
      ...requestToForm(odometer, odometer?.label === MANUAL_ODOMETER_LABEL),
      offset: String(odometer?.field.offset ?? 0),
      length: String(odometer?.field.length ?? 3),
      endian: odometer?.field.endian ?? 'be',
      scale: String(odometer?.field.scale ?? 1),
    },
  };
}

const HEX = /^[0-9A-Fa-f]*$/;

export function isHexBytes(value: string): boolean {
  const clean = value.replace(/\s+/g, '');
  return clean.length > 0 && clean.length % 2 === 0 && HEX.test(clean);
}

export function isCanId(value: string): boolean {
  const clean = value.trim();
  return /^[0-9A-Fa-f]{3,4}$/.test(clean) || /^[0-9A-Fa-f]{8}$/.test(clean);
}

function cleanHex(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

function optionalHex(value: string): string | undefined {
  const clean = cleanHex(value);
  return clean.length > 0 ? clean : undefined;
}

function toDiagnosticRequest(values: RequestFormValues): DiagnosticRequest {
  return {
    protocol: values.protocol === 'can-11-500' ? 'can-11-500' : undefined,
    header: optionalHex(values.header),
    receiveAddress: optionalHex(values.receiveAddress),
    session: optionalHex(values.session),
    request: cleanHex(values.request),
  };
}

/** Lines -> commands, blank lines dropped, upper-cased without inner spaces (the way the adapter wants them). */
export function parseInitCommands(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().toUpperCase().replace(/\s+/g, ''))
    .filter((line) => line.length > 0);
}

export function buildVinSource(values: RequestFormValues): VinSource | null {
  if (!values.enabled) return null;
  return { label: MANUAL_VIN_LABEL, ...toDiagnosticRequest(values) };
}

export function buildOdometerSource(values: OdometerFormValues): RequestOdometerSource | null {
  if (!values.enabled) return null;
  return {
    kind: 'request',
    label: MANUAL_ODOMETER_LABEL,
    ...toDiagnosticRequest(values),
    field: {
      offset: Number(values.offset),
      length: Number(values.length),
      endian: values.endian,
      scale: Number(values.scale),
    },
  };
}

/**
 * Applies the form to the persisted config. Turning the odometer override
 * off keeps a learned/scanned source (it wasn't the user's) and only drops
 * a previously manual one.
 */
export function applyManualForm(obd: ObdConfig, values: ManualObdFormValues): ObdConfig {
  const manualOdometer = buildOdometerSource(values.odometer);
  const previousWasManual = obd.odometerSource?.label === MANUAL_ODOMETER_LABEL;
  const odometerSource: OdometerSource | null = manualOdometer ?? (previousWasManual ? null : obd.odometerSource);
  return {
    ...obd,
    initCommands: parseInitCommands(values.initCommands),
    vinSource: buildVinSource(values.vin),
    odometerSource,
  };
}
