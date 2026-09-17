/**
 * Request/response layer on top of the raw ELM327 command exchange: sends
 * one diagnostic request (OBD-II mode+PID, UDS or KWP2000 service+parameter
 * - they all share the same "service byte, parameter bytes, data" shape over
 * ISO-TP) and classifies what came back.
 *
 * A positive response echoes the service byte + 0x40 followed by the
 * request's parameter bytes, then the payload; a negative one is
 * `7F <service> <code>`. Both are worth telling apart from "nothing answered
 * at all": a negative response still proves an ECU is listening at that
 * address, which the odometer discovery in `odometer/learn.ts` relies on.
 */

import { ElmConnection, parseHexResponse, COMMAND_TIMEOUT_MS } from '@/obd/elm327';

export type ObdResponse =
  /** Positive response; `data` is the payload with the service/parameter echo stripped. */
  | { status: 'ok'; data: number[] }
  /** ISO 14229/14230 negative response (`7F <service> <code>`). */
  | { status: 'negative'; code: number }
  /** The adapter reported no reply on the bus ("NO DATA", timeout, bus errors). */
  | { status: 'no-data' }
  /** Something answered but it wasn't a well-formed reply to this request. */
  | { status: 'unexpected'; bytes: number[] };

/** Negative response code "requestCorrectlyReceived-ResponsePending" - the ECU is still working on it. */
const NRC_RESPONSE_PENDING = 0x78;

export function requestBytes(requestHex: string): number[] {
  const clean = requestHex.replace(/\s+/g, '');
  const bytes: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  return bytes;
}

/**
 * Sends `requestHex` (e.g. '0902', '22F190', '2101') and classifies the
 * reply. Never throws for a bus-level "no answer" - that's a normal outcome
 * while probing - but does propagate adapter/BLE failures.
 */
export async function sendRequest(connection: ElmConnection, requestHex: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<ObdResponse> {
  const request = requestBytes(requestHex);
  if (request.length === 0) throw new Error(`sendRequest: empty request "${requestHex}"`);

  let raw: string;
  try {
    raw = await connection.sendCommand(request.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(''), timeoutMs);
  } catch (error) {
    if (error instanceof Error && /timed out/.test(error.message)) return { status: 'no-data' };
    throw error;
  }
  return classifyResponse(request, raw);
}

/** Pure half of `sendRequest`: interprets an adapter reply for `request`. Exported for tests. */
export function classifyResponse(request: number[], raw: string): ObdResponse {
  const bytes = parseHexResponse(raw);
  if (bytes.length === 0) return { status: 'no-data' };

  const service = request[0];
  const parameterCount = request.length - 1;

  // The adapter can surface a "response pending" (7F xx 78) line ahead of the
  // real reply on the same response - skip past it.
  let offset = 0;
  while (bytes[offset] === 0x7f && bytes[offset + 1] === service && bytes[offset + 2] === NRC_RESPONSE_PENDING) {
    offset += 3;
  }

  if (bytes[offset] === 0x7f && bytes[offset + 1] === service) {
    return { status: 'negative', code: bytes[offset + 2] ?? 0 };
  }

  if (bytes[offset] !== service + 0x40) return { status: 'unexpected', bytes: bytes.slice(offset) };

  const echoed = bytes.slice(offset + 1, offset + 1 + parameterCount);
  const expected = request.slice(1);
  if (echoed.length !== expected.length || echoed.some((b, i) => b !== expected[i])) {
    return { status: 'unexpected', bytes: bytes.slice(offset) };
  }

  return { status: 'ok', data: bytes.slice(offset + 1 + parameterCount) };
}

/** Requests the VIN via the standard Mode 09 PID 02 request and decodes it to ASCII. */
export async function requestVin(connection: ElmConnection): Promise<string | null> {
  const response = await sendRequest(connection, '0902');
  if (response.status !== 'ok') return null;
  // Positive response: 49 02 <number of data items> <VIN ASCII bytes...>
  return decodeAsciiVin(response.data.slice(1));
}

/** Turns a run of ASCII bytes (padding/garbage tolerated) into a 17-character VIN, or null. */
export function decodeAsciiVin(bytes: number[]): string | null {
  const vinBytes = bytes.filter((byte) => byte > 0x20 && byte < 0x7f);
  const vin = String.fromCharCode(...vinBytes).trim();
  return vin.length === 17 ? vin : null;
}
