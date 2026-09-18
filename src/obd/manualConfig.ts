/**
 * Form model for the manual OBD overrides (the OBD setup screen and the
 * car form's setup sheet): the text the user types <-> the persisted
 * `ObdConfig` fields. Pure functions, no UI, so the mapping and its
 * validation are unit-testable.
 */

import type {
  BusProtocol,
  ByteField,
  DiagnosticRequest,
  DistanceUnitCode,
  FieldEncoding,
  OdometerSource,
  RequestOdometerSource,
  VinSource,
} from '@/obd/odometer/source';
import { isBusProtocol } from '@/obd/odometer/source';
import type { ObdReadConfig } from '@/obd/scanVehicle';

export type ProtocolChoice = 'auto' | BusProtocol;
export type EndianChoice = 'be' | 'le';
export type OdometerMode = 'request' | 'broadcast';

export interface RequestFormValues {
  enabled: boolean;
  protocol: ProtocolChoice;
  header: string;
  receiveAddress: string;
  /** One AT command per line, applied for this request only. */
  atCommands: string;
  session: string;
  /** One hex request per line, sent in order after the session request. */
  setup: string;
  request: string;
}

export interface FieldFormValues {
  offset: string;
  length: string;
  endian: EndianChoice;
  encoding: FieldEncoding;
  scale: string;
  add: string;
  unit: DistanceUnitCode;
}

export interface OdometerFormValues extends RequestFormValues, FieldFormValues {
  mode: OdometerMode;
  /** Broadcast mode: the CAN ID of the frame that carries the reading. */
  canId: string;
}

export interface ManualObdFormValues {
  /** One AT command per line. */
  initCommands: string;
  vin: RequestFormValues;
  odometer: OdometerFormValues;
}

export const MANUAL_VIN_LABEL = 'Manual VIN request';
export const MANUAL_ODOMETER_LABEL = 'Manual odometer request';
export const MANUAL_BROADCAST_LABEL = 'Manual odometer frame';

const EMPTY_REQUEST: RequestFormValues = {
  enabled: false,
  protocol: 'auto',
  header: '',
  receiveAddress: '',
  atCommands: '',
  session: '',
  setup: '',
  request: '',
};

const DEFAULT_FIELD: FieldFormValues = { offset: '0', length: '3', endian: 'be', encoding: 'uint', scale: '1', add: '0', unit: 'km' };

function requestToForm(request: DiagnosticRequest | null, enabled: boolean): RequestFormValues {
  if (!request) return { ...EMPTY_REQUEST, enabled };
  return {
    enabled,
    protocol: request.protocol ?? 'auto',
    header: request.header ?? '',
    receiveAddress: request.receiveAddress ?? '',
    atCommands: (request.atCommands ?? []).join('\n'),
    session: request.session ?? '',
    setup: (request.setup ?? []).join('\n'),
    request: request.request,
  };
}

function fieldToForm(field: ByteField | undefined): FieldFormValues {
  if (!field) return DEFAULT_FIELD;
  return {
    offset: String(field.offset),
    length: String(field.length),
    endian: field.endian,
    encoding: field.encoding ?? 'uint',
    scale: String(field.scale),
    add: String(field.add ?? 0),
    unit: field.unit ?? 'km',
  };
}

/**
 * Seeds the form from what's persisted. A learned/scanned odometer source is
 * shown as a starting point (so the user can tweak it) but the override
 * stays off until they opt in.
 */
export function manualFormFromObd(obd: ObdReadConfig): ManualObdFormValues {
  const source = obd.odometerSource;
  const request = source?.kind === 'request' ? source : null;
  return {
    initCommands: obd.initCommands.join('\n'),
    vin: requestToForm(obd.vinSource, obd.vinSource !== null),
    odometer: {
      ...requestToForm(request, source?.manual === true),
      ...fieldToForm(source?.field),
      mode: source?.kind === 'broadcast' ? 'broadcast' : 'request',
      canId: source?.kind === 'broadcast' ? source.canId : '',
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

/** Every non-blank line must be a valid hex request. */
export function isHexLines(text: string): boolean {
  return splitLines(text).every(isHexBytes);
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function cleanHex(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

function optionalHex(value: string): string | undefined {
  const clean = cleanHex(value);
  return clean.length > 0 ? clean : undefined;
}

function optionalList(values: string[]): string[] | undefined {
  return values.length > 0 ? values : undefined;
}

/** Lines -> commands, blank lines dropped, upper-cased without inner spaces (the way the adapter wants them). */
export function parseInitCommands(text: string): string[] {
  return splitLines(text).map((line) => line.toUpperCase().replace(/\s+/g, ''));
}

/** Lines -> hex requests, blank lines dropped, spaces removed. */
export function parseHexLines(text: string): string[] {
  return splitLines(text).map(cleanHex);
}

function toDiagnosticRequest(values: RequestFormValues): DiagnosticRequest {
  return {
    protocol: isBusProtocol(values.protocol) ? values.protocol : undefined,
    header: optionalHex(values.header),
    receiveAddress: optionalHex(values.receiveAddress),
    atCommands: optionalList(parseInitCommands(values.atCommands)),
    session: optionalHex(values.session),
    setup: optionalList(parseHexLines(values.setup)),
    request: cleanHex(values.request),
  };
}

function toByteField(values: FieldFormValues): ByteField {
  const add = Number(values.add);
  return {
    offset: Number(values.offset),
    length: Number(values.length),
    endian: values.endian,
    scale: Number(values.scale),
    ...(values.encoding === 'bcd' ? { encoding: 'bcd' as const } : {}),
    ...(Number.isFinite(add) && add !== 0 ? { add } : {}),
    ...(values.unit === 'mi' ? { unit: 'mi' as const } : {}),
  };
}

export function buildVinSource(values: RequestFormValues): VinSource | null {
  if (!values.enabled) return null;
  return { label: MANUAL_VIN_LABEL, ...toDiagnosticRequest(values), manual: true };
}

export function buildOdometerSource(values: OdometerFormValues): OdometerSource | null {
  if (!values.enabled) return null;
  if (values.mode === 'broadcast') {
    return { kind: 'broadcast', label: MANUAL_BROADCAST_LABEL, canId: cleanHex(values.canId), field: toByteField(values), manual: true };
  }
  const source: RequestOdometerSource = {
    kind: 'request',
    label: MANUAL_ODOMETER_LABEL,
    ...toDiagnosticRequest(values),
    field: toByteField(values),
    manual: true,
  };
  return source;
}

/**
 * Applies the form to the persisted config. Turning the odometer override
 * off keeps a learned/scanned source (it wasn't the user's) and only drops
 * a previously manual one.
 */
export function applyManualForm<T extends ObdReadConfig>(obd: T, values: ManualObdFormValues): T {
  const manualOdometer = buildOdometerSource(values.odometer);
  const odometerSource: OdometerSource | null = manualOdometer ?? (obd.odometerSource?.manual ? null : obd.odometerSource);
  return {
    ...obd,
    initCommands: parseInitCommands(values.initCommands),
    vinSource: buildVinSource(values.vin),
    odometerSource,
  };
}
