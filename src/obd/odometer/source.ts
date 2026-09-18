/**
 * Where a car's odometer lives on its diagnostic bus, in a form that can be
 * persisted with the car (`ObdConfig.odometerSource`) and replayed on every
 * later sync without any guessing. Everything here is plain data - no
 * functions - so it round-trips through the app's JSON file.
 *
 * Two shapes:
 * - `request`: ask an ECU (optionally after opening a diagnostic session) and
 *   pick the reading out of the reply payload.
 * - `broadcast`: the reading is periodically broadcast on the bus by the
 *   cluster/gateway; capture that frame passively with the adapter's
 *   monitor mode and pick the reading out of it.
 */

export type ByteOrder = 'be' | 'le';
/** How the bytes encode the integer: plain binary, or packed BCD (two decimal digits per byte, e.g. 12 34 56 = 123456). */
export type FieldEncoding = 'uint' | 'bcd';
export type DistanceUnitCode = 'km' | 'mi';

export const KM_PER_MILE = 1.60934;

/** Which bytes of a payload hold the reading and how to turn them into km. */
export interface ByteField {
  /** Byte offset into the payload (reply data after the service/parameter echo, or the raw CAN frame data). */
  offset: number;
  /** 2, 3 or 4 bytes. */
  length: number;
  endian: ByteOrder;
  /** Multiplier from the raw integer to the unit, e.g. 1 for km, 0.1 for 0.1 km/bit, 1.60934 for miles (legacy - prefer `unit`). */
  scale: number;
  /** Integer encoding; undefined = plain unsigned binary. */
  encoding?: FieldEncoding;
  /** Added after scaling, before the unit conversion (some ECUs store km minus a constant). Undefined = 0. */
  add?: number;
  /** Unit of the scaled value; 'mi' converts to km. Undefined = km. */
  unit?: DistanceUnitCode;
}

/** The bus protocols a request may pin (`ATSP` numbers 1-9 on the ELM327). */
export type BusProtocol =
  'can-11-500' | 'can-29-500' | 'can-11-250' | 'can-29-250' | 'kwp-fast' | 'kwp-5baud' | 'iso9141' | 'j1850-pwm' | 'j1850-vpw';

export const BUS_PROTOCOLS: BusProtocol[] = [
  'can-11-500',
  'can-29-500',
  'can-11-250',
  'can-29-250',
  'kwp-fast',
  'kwp-5baud',
  'iso9141',
  'j1850-pwm',
  'j1850-vpw',
];

/** The ELM327 `ATSP` digit for each protocol. */
export const BUS_PROTOCOL_NUMBER: Record<BusProtocol, string> = {
  'j1850-pwm': '1',
  'j1850-vpw': '2',
  iso9141: '3',
  'kwp-5baud': '4',
  'kwp-fast': '5',
  'can-11-500': '6',
  'can-29-500': '7',
  'can-11-250': '8',
  'can-29-250': '9',
};

export function isBusProtocol(value: unknown): value is BusProtocol {
  return typeof value === 'string' && (BUS_PROTOCOLS as string[]).includes(value);
}

/**
 * One addressed diagnostic request: how to reach the ECU and what to send.
 * Shared by the odometer and VIN sources, and editable by hand on the OBD
 * setup screen when none of the built-in strategies fit a car.
 */
export interface DiagnosticRequest {
  /** Required bus protocol; undefined = whatever the adapter auto-detected. */
  protocol?: BusProtocol;
  /** Transmit CAN header (`ATSH`); undefined = OBD-II functional broadcast. */
  header?: string;
  /** Receive CAN ID filter (`ATCRA`); undefined = the adapter's automatic filter (header + 8). */
  receiveAddress?: string;
  /** Extra adapter AT commands for this request only (e.g. 'ATFCSH7E0', 'ATCAF0'), sent after the addressing and before any bus traffic. */
  atCommands?: string[];
  /** Diagnostic session request to send first (e.g. '1003' UDS extended, '1092' Daimler KWP extended), if any. */
  session?: string;
  /** Further requests sent in order after `session` and before `request` (tester present, security access, routine control...). Replies are logged, not required. */
  setup?: string[];
  /** The read request as hex, e.g. '01A6', '22F1A1', '2101'. */
  request: string;
  /** Set on sources the user typed in by hand - they're never replaced by a discovered/learned one. */
  manual?: true;
}

export interface RequestOdometerSource extends DiagnosticRequest {
  kind: 'request';
  /** Human-readable, e.g. 'Mercedes EZS (612/482) 22 0100'. Shown in logs/UI only. */
  label: string;
  field: ByteField;
}

/** A manual VIN request: the reply payload is scanned for 17 printable ASCII characters. */
export interface VinSource extends DiagnosticRequest {
  label: string;
}

export interface BroadcastOdometerSource {
  kind: 'broadcast';
  label: string;
  /** CAN ID of the broadcast frame, upper-case hex (4 digits for 11-bit IDs). */
  canId: string;
  field: ByteField;
  /** Set on sources the user typed in by hand - they're never replaced by a discovered/learned one. */
  manual?: true;
}

export type OdometerSource = RequestOdometerSource | BroadcastOdometerSource;

/** Reads `field` out of `bytes` and converts to km; null if the bytes don't cover it, are the all-0xFF "unset" sentinel, or aren't valid BCD. */
export function decodeField(bytes: number[], field: ByteField): number | null {
  if (field.offset < 0 || field.offset + field.length > bytes.length) return null;
  const slice = bytes.slice(field.offset, field.offset + field.length);
  const ordered = field.endian === 'le' ? [...slice].reverse() : slice;
  if (slice.every((byte) => byte === 0xff)) return null;
  let raw: number;
  if (field.encoding === 'bcd') {
    raw = 0;
    for (const byte of ordered) {
      const high = byte >> 4;
      const low = byte & 0x0f;
      if (high > 9 || low > 9) return null;
      raw = raw * 100 + high * 10 + low;
    }
  } else {
    raw = ordered.reduce((acc, byte) => acc * 256 + byte, 0);
  }
  const scaled = raw * field.scale + (field.add ?? 0);
  return field.unit === 'mi' ? scaled * KM_PER_MILE : scaled;
}

function isByteField(value: unknown): value is ByteField {
  if (!value || typeof value !== 'object') return false;
  const field = value as Record<string, unknown>;
  return (
    typeof field.offset === 'number' &&
    typeof field.length === 'number' &&
    (field.endian === 'be' || field.endian === 'le') &&
    typeof field.scale === 'number' &&
    (field.encoding === undefined || field.encoding === 'uint' || field.encoding === 'bcd') &&
    (field.add === undefined || typeof field.add === 'number') &&
    (field.unit === undefined || field.unit === 'km' || field.unit === 'mi')
  );
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isDiagnosticRequest(value: Record<string, unknown>): boolean {
  return (
    typeof value.request === 'string' &&
    (value.header === undefined || typeof value.header === 'string') &&
    (value.receiveAddress === undefined || typeof value.receiveAddress === 'string') &&
    (value.session === undefined || typeof value.session === 'string') &&
    (value.setup === undefined || isStringArray(value.setup)) &&
    (value.atCommands === undefined || isStringArray(value.atCommands)) &&
    (value.protocol === undefined || isBusProtocol(value.protocol)) &&
    (value.manual === undefined || value.manual === true)
  );
}

/**
 * The odometer source to persist after a sync: a hand-configured source is
 * the user's decision and always wins; otherwise a newly discovered one
 * replaces whatever was there, and nothing found keeps the current one.
 */
export function mergeOdometerSource(current: OdometerSource | null, found: OdometerSource | null): OdometerSource | null {
  if (current?.manual) return current;
  return found ?? current;
}

/** Structural check for a persisted VIN source. */
export function isVinSource(value: unknown): value is VinSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return typeof source.label === 'string' && isDiagnosticRequest(source);
}

/** Structural check for a persisted source (the JSON file may have been edited/imported). */
export function isOdometerSource(value: unknown): value is OdometerSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  if (typeof source.label !== 'string' || !isByteField(source.field)) return false;
  if (source.kind === 'request') return isDiagnosticRequest(source);
  if (source.kind === 'broadcast') return typeof source.canId === 'string' && (source.manual === undefined || source.manual === true);
  return false;
}

/** Stable identity for de-duplicating candidates: same target + request/frame + field. */
export function odometerSourceKey(source: OdometerSource): string {
  const f = source.field;
  const field = `${f.offset}:${f.length}:${f.endian}:${f.scale}:${f.encoding ?? 'uint'}:${f.add ?? 0}:${f.unit ?? 'km'}`;
  return source.kind === 'request'
    ? `req:${source.header ?? ''}:${source.receiveAddress ?? ''}:${source.session ?? ''}:${(source.setup ?? []).join(',')}:${source.request}:${field}`
    : `bc:${source.canId}:${field}`;
}
