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

/** Which bytes of a payload hold the reading and how to turn them into km. */
export interface ByteField {
  /** Byte offset into the payload (reply data after the service/parameter echo, or the raw CAN frame data). */
  offset: number;
  /** 2, 3 or 4 bytes. */
  length: number;
  endian: ByteOrder;
  /** Multiplier from the raw integer to km, e.g. 1 for km, 0.1 for 0.1 km/bit, 1.60934 for miles. */
  scale: number;
}

/**
 * One addressed diagnostic request: how to reach the ECU and what to send.
 * Shared by the odometer and VIN sources, and editable by hand on the OBD
 * setup screen when none of the built-in strategies fit a car.
 */
export interface DiagnosticRequest {
  /** Required bus protocol; undefined = whatever the adapter auto-detected. */
  protocol?: 'can-11-500';
  /** Transmit CAN header (`ATSH`); undefined = OBD-II functional broadcast. */
  header?: string;
  /** Receive CAN ID filter (`ATCRA`); undefined = the adapter's automatic filter (header + 8). */
  receiveAddress?: string;
  /** Diagnostic session request to send first (e.g. '1003' UDS extended, '1092' Daimler KWP extended), if any. */
  session?: string;
  /** The read request as hex, e.g. '01A6', '22F1A1', '2101'. */
  request: string;
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
}

export type OdometerSource = RequestOdometerSource | BroadcastOdometerSource;

/** Reads `field` out of `bytes` and converts to km; null if the bytes don't cover it or are the all-0xFF "unset" sentinel. */
export function decodeField(bytes: number[], field: ByteField): number | null {
  if (field.offset < 0 || field.offset + field.length > bytes.length) return null;
  const slice = bytes.slice(field.offset, field.offset + field.length);
  const ordered = field.endian === 'le' ? [...slice].reverse() : slice;
  const raw = ordered.reduce((acc, byte) => acc * 256 + byte, 0);
  if (raw === 2 ** (field.length * 8) - 1) return null;
  return raw * field.scale;
}

function isByteField(value: unknown): value is ByteField {
  if (!value || typeof value !== 'object') return false;
  const field = value as Record<string, unknown>;
  return (
    typeof field.offset === 'number' &&
    typeof field.length === 'number' &&
    (field.endian === 'be' || field.endian === 'le') &&
    typeof field.scale === 'number'
  );
}

function isDiagnosticRequest(value: Record<string, unknown>): boolean {
  return (
    typeof value.request === 'string' &&
    (value.header === undefined || typeof value.header === 'string') &&
    (value.receiveAddress === undefined || typeof value.receiveAddress === 'string') &&
    (value.session === undefined || typeof value.session === 'string') &&
    (value.protocol === undefined || value.protocol === 'can-11-500')
  );
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
  if (source.kind === 'broadcast') return typeof source.canId === 'string';
  return false;
}

/** Stable identity for de-duplicating candidates: same target + request/frame + field. */
export function odometerSourceKey(source: OdometerSource): string {
  const field = `${source.field.offset}:${source.field.length}:${source.field.endian}:${source.field.scale}`;
  return source.kind === 'request'
    ? `req:${source.header ?? ''}:${source.receiveAddress ?? ''}:${source.session ?? ''}:${source.request}:${field}`
    : `bc:${source.canId}:${field}`;
}
