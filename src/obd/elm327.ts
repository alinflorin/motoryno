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
 *
 * On top of the raw command/response exchange, `ElmConnection` tracks the
 * adapter's addressing state (`ATSH` transmit header, `ATCRA` receive
 * filter, `ATSP` protocol) so callers can aim requests at a specific ECU and
 * reliably get back to plain OBD-II broadcast addressing afterwards - the
 * ELM327 keeps a custom header across `ATSP` changes, so "reset to defaults"
 * has to be explicit. It also exposes the adapter's passive bus-monitor mode
 * (`ATMA`), which some vehicles need for the odometer (see `odometer/`).
 */

import type { Device, Subscription } from 'react-native-ble-plx';

import { asciiToBase64, base64ToAscii } from '@/obd/base64';
import { obdLog } from '@/obd/log';

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
export const COMMAND_TIMEOUT_MS = 5000;

/**
 * A protocol auto-search (ELM327 trying ISO9141/KWP/CAN in turn to find the
 * one the vehicle actually speaks) reports back with "SEARCHING..." while
 * it's still working, then either the real response or "UNABLE TO CONNECT".
 * That search commonly takes well past the normal 5s command timeout on the
 * very first OBD data request after `ATSP0` (each protocol candidate gets
 * its own multi-second bus timeout before the adapter tries the next one) -
 * seeing that line means the adapter is still alive and working, so the
 * per-command timeout is pushed back rather than cutting it off mid-search.
 */
const SEARCHING_GRACE_MS = 10000;

/** How long to wait for the prompt after telling the adapter to stop monitoring. */
const MONITOR_STOP_TIMEOUT_MS = 3000;

/** The ELM327's default receive-side timeout (`ATST 32` = 50 x 4ms = 200ms). */
export const DEFAULT_ELM_TIMEOUT_HEX = '32';

/**
 * Explicit CAN addressing for one request: `header` is the 11-bit transmit
 * ID (`ATSH`), `receiveAddress` the ID the reply comes back on (`ATCRA`).
 * The adapter's automatic receive filter only covers the OBD-II convention
 * of "reply = request + 8" (7E0 -> 7E8); anything else - like Mercedes'
 * 0x6xx request / 0x4xx response pairs - needs the filter set by hand or
 * the reply is silently dropped and the request looks like "NO DATA".
 */
export interface ElmAddressing {
  header?: string;
  receiveAddress?: string;
}

export type ElmProtocol = 'auto' | 'can-11-500' | 'other';

/** The ELM327 protocol numbers (`ATSP`/`ATDPN`) - only the two this app selects explicitly. */
const PROTOCOL_NUMBER: Record<Exclude<ElmProtocol, 'other'>, string> = { auto: '0', 'can-11-500': '6' };

const OBD_FUNCTIONAL_HEADER = '7DF';

/** Upper-case hex without a 0x prefix; an 11-bit CAN ID is trimmed to the 3 digits `ATSH`/`ATCRA` expect. */
function normalizeHex(value: string | undefined): string | undefined {
  return value
    ?.replace(/^0x/i, '')
    .toUpperCase()
    .replace(/^0([0-9A-F]{3})$/, '$1');
}

/**
 * One open ELM327 command/response session over a connected `Device`. Create
 * with `openElmConnection`, always `close()` when done (even on error) so
 * the notify subscription doesn't leak.
 */
export class ElmConnection {
  private device: Device;
  private profile: UartProfile;
  private buffer = '';
  private pending: { resolve: (text: string) => void; reject: (err: Error) => void; command: string; startedAt: number } | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private subscription: Subscription;

  // Adapter-side state, mirrored here so the reset paths only send what's needed.
  private header: string | null = null;
  private receiveAddress: string | null = null;
  private protocol: ElmProtocol = 'auto';
  /** Cached `ATDPN` result, cleared whenever the protocol is changed. */
  private detectedProtocolNumber: string | null = null;

  constructor(device: Device, profile: UartProfile) {
    this.device = device;
    this.profile = profile;
    this.subscription = device.monitorCharacteristicForService(profile.serviceUUID, profile.notifyUUID, (error, characteristic) => {
      if (error) {
        this.settle((pending) => pending.reject(error));
        return;
      }
      if (!characteristic?.value) return;
      this.buffer += base64ToAscii(characteristic.value);

      if (this.buffer.includes(PROMPT_CHAR) && this.pending) {
        const response = this.buffer.slice(0, this.buffer.indexOf(PROMPT_CHAR));
        this.buffer = '';
        this.settle((pending) => pending.resolve(response));
      } else if (this.pending && /SEARCHING\.*/i.test(this.buffer)) {
        // Still mid protocol-search - extend the timeout instead of racing it.
        this.armTimeout(this.pending.command, SEARCHING_GRACE_MS);
      }
    });
  }

  private armTimeout(command: string, timeoutMs: number): void {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.timeoutHandle = setTimeout(() => {
      this.settle((pending) => pending.reject(new Error(`ElmConnection: "${command}" timed out`)));
    }, timeoutMs);
  }

  private settle(run: (pending: NonNullable<typeof this.pending>) => void): void {
    if (!this.pending) return;
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    const pending = this.pending;
    this.pending = null;
    run(pending);
  }

  private async writeRaw(text: string): Promise<void> {
    const payload = asciiToBase64(text);
    if (this.profile.writeWithResponse) {
      await this.device.writeCharacteristicWithResponseForService(this.profile.serviceUUID, this.profile.writeUUID, payload);
    } else {
      await this.device.writeCharacteristicWithoutResponseForService(this.profile.serviceUUID, this.profile.writeUUID, payload);
    }
  }

  /** Sends one AT/OBD command and resolves with the adapter's raw text response (prompt char stripped). */
  async sendCommand(command: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<string> {
    if (this.pending) {
      throw new Error('ElmConnection: a command is already in flight');
    }

    obdLog('tx', command);
    const startedAt = Date.now();
    const responsePromise = new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject, command, startedAt };
    });
    this.armTimeout(command, timeoutMs);
    this.buffer = '';

    await this.writeRaw(`${command}\r`);

    try {
      const response = await responsePromise;
      obdLog('rx', `${JSON.stringify(response.trim())} (${Date.now() - startedAt}ms)`);
      return response;
    } catch (error) {
      obdLog('rx', `(${command}: ${error instanceof Error ? error.message : String(error)})`);
      throw error;
    } finally {
      this.pending = null;
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
        this.timeoutHandle = null;
      }
    }
  }

  /**
   * Sends an AT command and reports whether the adapter acknowledged it with
   * "OK". Never throws on an unsupported command ("?") or a timeout - most
   * AT tweaks are optional refinements the caller can carry on without.
   */
  async sendAt(command: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<boolean> {
    try {
      const response = await this.sendCommand(command, timeoutMs);
      return /OK/i.test(response);
    } catch {
      return false;
    }
  }

  /**
   * Aims subsequent requests at a specific ECU (`ATSH` + `ATCRA`), or
   * restores plain OBD-II broadcast addressing when called with `null`.
   * Idempotent: only the parts that actually changed are sent.
   */
  async setAddressing(addressing: ElmAddressing | null): Promise<void> {
    const header = normalizeHex(addressing?.header) ?? null;
    const receiveAddress = normalizeHex(addressing?.receiveAddress) ?? null;

    if (header !== this.header) {
      // Clearing a custom header = pointing at the OBD-II functional address again.
      const ok = await this.sendAt(`ATSH${header ?? OBD_FUNCTIONAL_HEADER}`);
      if (!ok && header) throw new Error(`ElmConnection: adapter rejected header ${header}`);
      this.header = header;
    }

    if (receiveAddress !== this.receiveAddress) {
      // `ATCRA` with no argument clears the filter (ELM327 v1.4b+).
      const ok = await this.sendAt(receiveAddress ? `ATCRA${receiveAddress}` : 'ATCRA');
      if (!ok && receiveAddress) throw new Error(`ElmConnection: adapter rejected receive address ${receiveAddress}`);
      this.receiveAddress = receiveAddress;
    }
  }

  /** Selects the bus protocol (`ATSP`). 'auto' lets the adapter search on the next request. */
  async setProtocol(protocol: Exclude<ElmProtocol, 'other'>): Promise<void> {
    if (protocol === this.protocol) return;
    const ok = await this.sendAt(`ATSP${PROTOCOL_NUMBER[protocol]}`);
    if (!ok) throw new Error(`ElmConnection: adapter rejected protocol ${protocol}`);
    this.protocol = protocol;
    this.detectedProtocolNumber = null;
  }

  /**
   * The protocol the adapter is currently using, as its `ATDPN` number
   * ('6' = ISO 15765-4 CAN 11-bit/500k, 'A6' = the same found by
   * auto-search, ...). Only meaningful after at least one OBD request has
   * gone through in auto mode, since that's what triggers the search.
   */
  async describeProtocolNumber(): Promise<string | null> {
    if (this.detectedProtocolNumber) return this.detectedProtocolNumber;
    try {
      const response = (await this.sendCommand('ATDPN')).trim().toUpperCase();
      const match = response.match(/^A?[0-9A-C]$/);
      this.detectedProtocolNumber = match ? match[0] : null;
    } catch {
      this.detectedProtocolNumber = null;
    }
    return this.detectedProtocolNumber;
  }

  /** Whether the adapter has settled on 11-bit 500 kbit/s CAN - the bus every 2008+ Mercedes (and most other cars) talks OBD-II on. */
  async isOnCan11Bit500k(): Promise<boolean> {
    const number = await this.describeProtocolNumber();
    return number === '6' || number === 'A6';
  }

  /**
   * Mirrors any addressing/protocol the user's custom init commands set, so
   * the idempotent setters above don't skip a needed reset later.
   */
  async noteInitCommands(commands: string[]): Promise<void> {
    for (const raw of commands) {
      const command = raw.trim().toUpperCase().replace(/\s+/g, '');
      const header = command.match(/^ATSH([0-9A-F]{3,8})$/)?.[1];
      if (header) this.header = normalizeHex(header) ?? null;
      const receive = command.match(/^ATCRA([0-9A-F]{3,8})$/)?.[1];
      if (receive) this.receiveAddress = normalizeHex(receive) ?? null;
      if (command === 'ATCRA') this.receiveAddress = null;
      const protocol = command.match(/^ATSP([0-9A-C])$/)?.[1];
      if (protocol) {
        this.protocol = protocol === '6' ? 'can-11-500' : protocol === '0' ? 'auto' : 'other';
        this.detectedProtocolNumber = null;
      }
    }
  }

  /** Sets the adapter's receive timeout (`ATST`, in 4ms units, hex). Shorter = faster "NO DATA" during sweeps. */
  async setResponseTimeout(hexUnits: string): Promise<void> {
    await this.sendAt(`ATST${hexUnits}`);
  }

  /**
   * Passively listens to the bus (`ATMA`) for `durationMs`, returning the raw
   * lines the adapter printed, one CAN frame per line as "<ID> <B0> <B1> ...".
   * Headers and spaces are switched on and ISO-TP formatting off for the
   * duration so frames come through raw and parseable, and everything is put
   * back afterwards. `receiveAddress` narrows the capture to one CAN ID.
   */
  async monitorBus(durationMs: number, receiveAddress?: string): Promise<string[]> {
    if (this.pending) {
      throw new Error('ElmConnection: a command is already in flight');
    }

    await this.sendAt('ATCAF0');
    await this.sendAt('ATH1');
    await this.sendAt('ATS1');
    if (receiveAddress) await this.setAddressing({ header: this.header ?? undefined, receiveAddress });

    obdLog('tx', `ATMA (${durationMs}ms)`);
    this.buffer = '';
    let captured = '';
    try {
      await this.writeRaw('ATMA\r');
      await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
      captured = this.buffer;
      this.buffer = '';

      // Any character stops the monitor; the adapter then prints "STOPPED" and a prompt.
      const stopped = new Promise<string>((resolve, reject) => {
        this.pending = { resolve, reject, command: 'ATMA stop', startedAt: Date.now() };
      });
      this.armTimeout('ATMA stop', MONITOR_STOP_TIMEOUT_MS);
      await this.writeRaw(' \r');
      try {
        captured += await stopped;
      } catch {
        // Some clones don't echo a prompt after stopping - carry on with what was captured.
      }
    } finally {
      this.pending = null;
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
        this.timeoutHandle = null;
      }
      this.buffer = '';
      await this.sendAt('ATS0');
      await this.sendAt('ATH0');
      await this.sendAt('ATCAF1');
      if (receiveAddress) await this.setAddressing(this.header ? { header: this.header } : null);
    }

    const lines = captured
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !/^(STOPPED|SEARCHING|BUFFER FULL|<DATA ERROR|ERROR|NO DATA|ATMA)/i.test(line));
    obdLog('rx', `${lines.length} monitored frame line(s)`);
    return lines;
  }

  close(): void {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.subscription.remove();
  }
}

/** Standard ELM327 reset/configure sequence: echo/linefeeds/spaces/headers off, auto-detect protocol. */
const INIT_COMMANDS = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];

export interface OpenElmOptions {
  /** Extra AT commands to send after the standard init, in order. Failures are logged, not fatal. */
  initCommands?: string[];
}

/** Connects to `device` (if not already connected), discovers services, and opens an initialized ELM327 session. */
export async function openElmConnection(device: Device, options: OpenElmOptions = {}): Promise<ElmConnection> {
  const connected = await device.isConnected();
  const activeDevice = connected ? device : await device.connect();
  await activeDevice.discoverAllServicesAndCharacteristics();

  const profile = await findUartProfile(activeDevice);
  if (!profile) {
    throw new Error('No compatible OBD2 serial characteristic found on this device');
  }
  obdLog('info', `connected via ${profile.label}`);

  const connection = new ElmConnection(activeDevice, profile);
  for (const command of INIT_COMMANDS) {
    // ATZ (reset) can take a moment to come back and some clones stay quiet on it - tolerate a timeout there.
    try {
      await connection.sendCommand(command, command === 'ATZ' ? 3000 : COMMAND_TIMEOUT_MS);
    } catch (error) {
      if (command !== 'ATZ') throw error;
    }
  }
  for (const command of options.initCommands ?? []) {
    const trimmed = command.trim();
    if (!trimmed) continue;
    const ok = await connection.sendAt(trimmed);
    if (!ok) obdLog('info', `custom init command "${trimmed}" was not acknowledged`);
  }
  await connection.noteInitCommands(options.initCommands ?? []);
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
    .filter(
      (line) =>
        line.length > 0 &&
        !/^(SEARCHING|STOPPED|NO DATA|UNABLE TO CONNECT|ERROR|BUS INIT|CAN ERROR|BUS BUSY|DATA ERROR|<DATA ERROR|BUFFER FULL|FB ERROR|\?)/i.test(
          line
        )
    );

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

/** One raw CAN frame as captured by `ElmConnection.monitorBus`. */
export interface CanFrame {
  /** Upper-case hex, no 0x prefix, e.g. '009E' or '7E8'. */
  id: string;
  data: number[];
}

/**
 * Parses monitor-mode lines ("<ID> <B0> <B1> ..." with headers and spaces
 * on, ISO-TP formatting off) into frames. Lines that don't look like a
 * frame (adapter chatter, truncated lines) are skipped.
 */
export function parseMonitorFrames(lines: string[]): CanFrame[] {
  const frames: CanFrame[] = [];
  for (const line of lines) {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 2) continue;
    const [id, ...rest] = tokens;
    // 11-bit IDs print as 3 hex digits (4 on some clones), 29-bit as 8; anything else isn't a frame.
    if (!/^[0-9A-Fa-f]{3,4}$/.test(id) && !/^[0-9A-Fa-f]{8}$/.test(id)) continue;
    if (!rest.every((token) => /^[0-9A-Fa-f]{2}$/.test(token))) continue;
    frames.push({ id: id.toUpperCase().padStart(4, '0'), data: rest.map((token) => parseInt(token, 16)) });
  }
  return frames;
}
