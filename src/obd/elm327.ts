/**
 * Transport for talking to a Bluetooth LE ELM327-compatible OBD2 adapter.
 *
 * Cheap BLE OBD2 dongles almost universally wrap a serial (UART-style) link:
 * write AT/OBD command text to a "write" characteristic, read the adapter's
 * text response off a "notify" characteristic, commands/responses end with
 * a carriage return and the adapter signals "done" with a trailing '>'
 * prompt. There's no single standard GATT profile for this though, so
 * `KNOWN_UART_PROFILES` lists the service/characteristic UUIDs used by the
 * common clone chipsets, tried in order; `findUartProfile` falls back to
 * inspecting whatever the device actually advertises if none of those match.
 */

import type { Device, Subscription } from 'react-native-ble-plx';

import { asciiToBase64, base64ToAscii } from '@/obd/base64';

export interface UartProfile {
  label: string;
  serviceUUID: string;
  writeUUID: string;
  notifyUUID: string;
  /** Whether the write characteristic supports write-with-response; otherwise write-without-response is used. */
  writeWithResponse: boolean;
}

/**
 * Service/characteristic UUIDs seen on common BLE OBD2 adapter chipsets:
 * - FFE0/FFE1: HM-10/CC254x-style modules, very common in generic clones.
 * - FFF0/FFF1(notify)/FFF2(write): another widespread clone chipset pairing.
 * - Nordic UART Service: used by some OBDLink/Kiwi-style adapters.
 */
export const KNOWN_UART_PROFILES: UartProfile[] = [
  { label: 'HM-10 style (FFE0/FFE1)', serviceUUID: 'ffe0', writeUUID: 'ffe1', notifyUUID: 'ffe1', writeWithResponse: false },
  { label: 'FFF0 style (FFF1/FFF2)', serviceUUID: 'fff0', writeUUID: 'fff2', notifyUUID: 'fff1', writeWithResponse: false },
  {
    label: 'Nordic UART Service',
    serviceUUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    writeUUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    notifyUUID: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
    writeWithResponse: false,
  },
];

function uuidTail(uuid: string): string {
  // 16-bit UUIDs (e.g. 'ffe0') come back from discovery expanded to the full
  // 128-bit Bluetooth base UUID - compare on the short form embedded in it.
  return uuid.toLowerCase().replace(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/, '$1');
}

function uuidsMatch(a: string, b: string): boolean {
  return uuidTail(a) === uuidTail(b);
}

/**
 * Finds a usable write+notify characteristic pair for `device`, which must
 * already have `discoverAllServicesAndCharacteristics()` resolved. Tries the
 * known profiles first, then falls back to the first service that exposes
 * both a writable and a notifiable/indicatable characteristic.
 */
export async function findUartProfile(device: Device): Promise<UartProfile | null> {
  const services = await device.services();

  for (const profile of KNOWN_UART_PROFILES) {
    const service = services.find((s) => uuidsMatch(s.uuid, profile.serviceUUID));
    if (!service) continue;
    const characteristics = await device.characteristicsForService(service.uuid);
    const write = characteristics.find(
      (c) => uuidsMatch(c.uuid, profile.writeUUID) && (c.isWritableWithResponse || c.isWritableWithoutResponse)
    );
    const hasNotify = characteristics.some((c) => uuidsMatch(c.uuid, profile.notifyUUID) && (c.isNotifiable || c.isIndicatable));
    if (write && hasNotify) {
      return { ...profile, serviceUUID: service.uuid, writeWithResponse: write.isWritableWithResponse };
    }
  }

  // Fallback: scan every discovered service for any write+notify pairing.
  for (const service of services) {
    const characteristics = await device.characteristicsForService(service.uuid);
    const writable = characteristics.find((c) => c.isWritableWithResponse || c.isWritableWithoutResponse);
    const notifiable = characteristics.find((c) => c.isNotifiable || c.isIndicatable);
    if (writable && notifiable) {
      return {
        label: 'Generic fallback',
        serviceUUID: service.uuid,
        writeUUID: writable.uuid,
        notifyUUID: notifiable.uuid,
        writeWithResponse: writable.isWritableWithResponse,
      };
    }
  }

  return null;
}

const PROMPT_CHAR = '>';
const COMMAND_TIMEOUT_MS = 5000;

/**
 * One open ELM327 command/response session over a connected `Device`. Create
 * with `openElmConnection`, always `close()` when done (even on error) so
 * the notify subscription doesn't leak.
 */
export class ElmConnection {
  private device: Device;
  private profile: UartProfile;
  private buffer = '';
  private pending: { resolve: (text: string) => void; reject: (err: Error) => void } | null = null;
  private subscription: Subscription;

  constructor(device: Device, profile: UartProfile) {
    this.device = device;
    this.profile = profile;
    this.subscription = device.monitorCharacteristicForService(profile.serviceUUID, profile.notifyUUID, (error, characteristic) => {
      if (error) {
        this.pending?.reject(error);
        this.pending = null;
        return;
      }
      if (!characteristic?.value) return;
      this.buffer += base64ToAscii(characteristic.value);
      if (this.buffer.includes(PROMPT_CHAR) && this.pending) {
        const response = this.buffer.slice(0, this.buffer.indexOf(PROMPT_CHAR));
        this.buffer = '';
        const { resolve } = this.pending;
        this.pending = null;
        resolve(response);
      }
    });
  }

  /** Sends one AT/OBD command and resolves with the adapter's raw text response (prompt char stripped). */
  async sendCommand(command: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<string> {
    if (this.pending) {
      throw new Error('ElmConnection: a command is already in flight');
    }

    const responsePromise = new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };
    });

    const payload = asciiToBase64(`${command}\r`);
    if (this.profile.writeWithResponse) {
      await this.device.writeCharacteristicWithResponseForService(this.profile.serviceUUID, this.profile.writeUUID, payload);
    } else {
      await this.device.writeCharacteristicWithoutResponseForService(this.profile.serviceUUID, this.profile.writeUUID, payload);
    }

    const timeout = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error(`ElmConnection: "${command}" timed out`)), timeoutMs);
    });

    try {
      return await Promise.race([responsePromise, timeout]);
    } finally {
      this.pending = null;
    }
  }

  close(): void {
    this.subscription.remove();
  }
}

/** Standard ELM327 reset/configure sequence: echo/linefeeds/spaces/headers off, auto-detect protocol. */
const INIT_COMMANDS = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];

/** Connects to `device` (if not already connected), discovers services, and opens an initialized ELM327 session. */
export async function openElmConnection(device: Device): Promise<ElmConnection> {
  const connected = await device.isConnected();
  const activeDevice = connected ? device : await device.connect();
  await activeDevice.discoverAllServicesAndCharacteristics();

  const profile = await findUartProfile(activeDevice);
  if (!profile) {
    throw new Error('No compatible OBD2 serial characteristic found on this device');
  }

  const connection = new ElmConnection(activeDevice, profile);
  for (const command of INIT_COMMANDS) {
    // ATZ (reset) can take a moment to come back and some clones stay quiet on it - tolerate a timeout there.
    try {
      await connection.sendCommand(command, command === 'ATZ' ? 3000 : COMMAND_TIMEOUT_MS);
    } catch (error) {
      if (command !== 'ATZ') throw error;
    }
  }
  return connection;
}

/**
 * Parses an ELM327 text response into its raw data bytes, tolerant of the
 * adapter's optional multi-frame line prefixes (e.g. "0:", "1:" for
 * reassembled ISO-TP responses) and chatter like "SEARCHING..." or "STOPPED".
 */
export function parseHexResponse(raw: string): number[] {
  const bytes: number[] = [];
  const lines = raw
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^(SEARCHING|STOPPED|NO DATA|UNABLE TO CONNECT|ERROR|BUS INIT)/i.test(line));

  // With CAN auto-formatting on (the adapter's default) and headers off, a
  // response that spans multiple ISO-TP frames - e.g. the VIN, which never
  // fits in one 7-byte frame - is preceded by a standalone line giving the
  // total reassembled byte count (e.g. "014"), before the "0:"/"1:"/... frame
  // lines. It has no colon so the frame-index strip below leaves it alone,
  // and being pure hex digits it would otherwise be misread as a data byte -
  // drop it.
  if (lines.length > 1 && /^[0-9A-Fa-f]{1,3}$/.test(lines[0]) && /^[0-9A-Fa-f]:/.test(lines[1])) {
    lines.shift();
  }

  for (const line of lines) {
    // Strip an optional leading ISO-TP frame index like "0:" or "1:".
    const withoutFrameIndex = line.replace(/^[0-9A-Fa-f]:\s*/, '');
    const hexPairs = withoutFrameIndex.match(/[0-9A-Fa-f]{2}/g);
    if (!hexPairs) continue;
    for (const pair of hexPairs) {
      bytes.push(parseInt(pair, 16));
    }
  }
  return bytes;
}

/**
 * Sends a Mode/PID request (e.g. mode '01', pid 'A6') and returns just the
 * data bytes, with the mode+PID echo (e.g. `41 A6`) stripped off. Returns
 * null if the adapter reported no data for this request.
 */
export async function requestPid(connection: ElmConnection, mode: string, pid: string): Promise<number[] | null> {
  const raw = await connection.sendCommand(`${mode}${pid}`);
  const bytes = parseHexResponse(raw);
  if (bytes.length === 0) return null;

  // Positive response echoes back mode+0x40 then the PID/DID before the data.
  const modeEcho = parseInt(mode, 16) + 0x40;
  if (bytes[0] !== modeEcho) return null;

  // Mode 01 echoes a single PID byte; Mode 22 (and other UDS services) echo a two-byte DID.
  const pidByteCount = pid.length <= 2 ? 1 : pid.length / 2;
  return bytes.slice(1 + pidByteCount);
}

/** Requests the VIN via the standard Mode 09 PID 02 request and decodes it to ASCII. */
export async function requestVin(connection: ElmConnection): Promise<string | null> {
  const raw = await connection.sendCommand('0902');
  const bytes = parseHexResponse(raw);
  // Positive response: 49 02 <number of data items> <VIN ASCII bytes...>
  if (bytes.length < 3 || bytes[0] !== 0x49 || bytes[1] !== 0x02) return null;

  const vinBytes = bytes.slice(3).filter((byte) => byte > 0x20 && byte < 0x7f);
  const vin = String.fromCharCode(...vinBytes).trim();
  return vin.length === 17 ? vin : null;
}
