/**
 * A small ELM327 command interpreter. Given one command line (as sent by
 * `ElmConnection.sendCommand` in the app - mode+PID concatenated, no spaces,
 * `\r`-terminated), returns the text response the app expects (without the
 * trailing `>` prompt; the transport layer appends that).
 *
 * Two simulated cars (`OBD_CAR`):
 * - `generic`: a modern car that answers the standard odometer PID (01 A6).
 * - `w204`: a Mercedes W204-generation car, modelled on what the app's
 *   Mercedes strategy (`src/obd/odometer/mercedes.ts`) expects to find - no
 *   01 A6, a UDS engine ECU at 7E0/7E8, a UDS EZS at 612/482 and a KWP2000
 *   cluster on the Daimler 0x6n2/0x48m scheme that needs session `10 92`
 *   before `21 xx` reads, plus a periodic km broadcast visible in monitor
 *   mode. The identifiers used for the km on the EZS/cluster are made up
 *   (the real ones aren't public - that's exactly what the app's learn flow
 *   exists to discover), so this exercises the discovery machinery, not a
 *   verified map of the real car.
 *
 * The adapter-side state that matters to the app is tracked: transmit
 * header (`ATSH`), receive filter (`ATCRA`), protocol (`ATSP`/`ATDPN`),
 * headers/spaces/auto-formatting flags and monitor mode (`ATMA`) - so the
 * app's addressing bugs show up here before they show up in a car.
 */

export type SimCar = 'generic' | 'w204';

export interface SimConfig {
  vin: string;
  odometerKm: number;
  car: SimCar;
}

/** Fictional identifiers the w204 sim serves the km on - see the module comment. */
export const W204_SIM = {
  ezs: { header: '612', response: '482', kmDid: '0100' },
  cluster: { header: '742', response: '4A8', kmLocalId: '42' },
  broadcastId: '00A8',
};

export interface SimState {
  header: string;
  receiveAddress: string | null;
  protocol: string;
  headersOn: boolean;
  spacesOn: boolean;
  autoFormat: boolean;
  monitoring: boolean;
  sessions: Map<string, string>;
}

export function createSimState(): SimState {
  return { header: '7DF', receiveAddress: null, protocol: '0', headersOn: false, spacesOn: false, autoFormat: true, monitoring: false, sessions: new Map() };
}

function toHexLine(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * Formats a response the way a real ELM327 does with CAN auto-formatting on
 * (its default) and headers off (`ATH0`, part of the app's init sequence):
 * a response that fits in one ISO-TP frame (<=7 bytes) is a single hex line;
 * anything longer - like the 20-byte VIN reply - is split across frames (6
 * data bytes in frame 0, 7 in each frame after) and preceded by a standalone
 * line giving the total reassembled byte count. Real adapters emit exactly
 * this shape, and the app has to parse it - a sim that only ever produced
 * single-line replies wouldn't exercise that path.
 */
function toAdapterResponse(bytes: number[]): string {
  if (bytes.length <= 7) return toHexLine(bytes);

  const lines = [bytes.length.toString(16).toUpperCase().padStart(3, '0')];
  let offset = 0;
  let frame = 0;
  while (offset < bytes.length) {
    const chunkSize = frame === 0 ? 6 : 7;
    lines.push(`${frame.toString(16).toUpperCase()}: ${toHexLine(bytes.slice(offset, offset + chunkSize))}`);
    offset += chunkSize;
    frame++;
  }
  return lines.join('\r\n');
}

function vinResponse(vin: string): string {
  const padded = vin.slice(0, 17).padEnd(17, ' ');
  const asciiBytes = Array.from(padded).map((ch) => ch.charCodeAt(0));
  // 49 02 <number of data items> <VIN ASCII bytes>, per SAE J1979 Mode 09 PID 02.
  return toAdapterResponse([0x49, 0x02, 0x01, ...asciiBytes]);
}

function km24(odometerKm: number): number[] {
  const raw = Math.round(odometerKm);
  return [(raw >> 16) & 0xff, (raw >> 8) & 0xff, raw & 0xff];
}

function standardOdometerResponse(odometerKm: number): string {
  const raw = Math.round(odometerKm * 10); // 0.1 km per bit
  return toHexLine([0x41, 0xa6, (raw >> 24) & 0xff, (raw >> 16) & 0xff, (raw >> 8) & 0xff, raw & 0xff]);
}

function negative(service: number, code: number): string {
  return toHexLine([0x7f, service, code]);
}

/** Standard OBD-II (engine ECU on 7DF/7E0) - shared by both simulated cars. */
function handleStandardObd(cmd: string, config: SimConfig): string | null {
  if (cmd === '0100') return toHexLine([0x41, 0x00, 0xbe, 0x3e, 0xb8, 0x11]);
  if (cmd === '0902') return vinResponse(config.vin);
  if (cmd === '01A6') return config.car === 'generic' ? standardOdometerResponse(config.odometerKm) : 'NO DATA';
  if (cmd === '3E00') return toHexLine([0x7e, 0x00]);
  if (cmd === '1003') return toHexLine([0x50, 0x03, 0x00, 0x32, 0x01, 0xf4]);
  if (cmd === '22F190') return toAdapterResponse([0x62, 0xf1, 0x90, ...Array.from(config.vin, (c) => c.charCodeAt(0))]);
  if (/^01[0-9A-F]{2}$/.test(cmd)) return 'NO DATA';
  if (/^22[0-9A-F]{4}$/.test(cmd)) return negative(0x22, 0x31);
  if (/^2[12][0-9A-F]+$/.test(cmd)) return negative(parseInt(cmd.slice(0, 2), 16), 0x11);
  return null;
}

/** The W204 EZS: UDS, answers only when the app has set the receive filter to its response ID. */
function handleEzs(cmd: string, config: SimConfig, state: SimState): string {
  const { ezs } = W204_SIM;
  if (state.receiveAddress !== ezs.response) return 'NO DATA'; // reply on 482 is filtered out by the adapter
  if (cmd === '3E00') return toHexLine([0x7e, 0x00]);
  if (cmd === '1003') {
    state.sessions.set(ezs.header, 'uds-extended');
    return toHexLine([0x50, 0x03, 0x00, 0x32, 0x01, 0xf4]);
  }
  if (cmd === '1092') return negative(0x10, 0x12);
  if (cmd === `22${ezs.kmDid}`) {
    if (state.sessions.get(ezs.header) !== 'uds-extended') return negative(0x22, 0x7f); // serviceNotSupportedInActiveSession
    return toHexLine([0x62, 0x01, 0x00, 0x00, ...km24(config.odometerKm)]); // a status byte, then km24 at offset 1
  }
  if (cmd === '22F100') return toHexLine([0x62, 0xf1, 0x00, 0x00, 0x12]);
  if (/^22[0-9A-F]{4}$/.test(cmd)) return negative(0x22, 0x31);
  if (/^21[0-9A-F]{2}$/.test(cmd)) return negative(0x21, 0x11);
  return 'NO DATA';
}

/** The W204 instrument cluster: KWP2000-over-CAN, needs Daimler's `10 92` session before local-identifier reads. */
function handleCluster(cmd: string, config: SimConfig, state: SimState): string {
  const { cluster } = W204_SIM;
  if (state.receiveAddress !== cluster.response) return 'NO DATA';
  if (cmd === '3E00') return negative(0x3e, 0x12); // KWP TesterPresent has no sub-function - but the reply still proves presence
  if (cmd === '1003') return negative(0x10, 0x12);
  if (cmd === '1092') {
    state.sessions.set(cluster.header, 'kwp-extended');
    return toHexLine([0x50, 0x92]);
  }
  if (cmd === `21${cluster.kmLocalId}`) {
    if (state.sessions.get(cluster.header) !== 'kwp-extended') return negative(0x21, 0x22); // conditionsNotCorrect
    return toHexLine([0x61, parseInt(cluster.kmLocalId, 16), ...km24(config.odometerKm), 0x00, 0x00]);
  }
  if (cmd === '2101') return toHexLine([0x61, 0x01, 0x00, 0x5a, 0x0c]); // some other live value
  if (/^21[0-9A-F]{2}$/.test(cmd)) return negative(0x21, 0x12);
  if (/^22[0-9A-F]{4}$/.test(cmd)) return negative(0x22, 0x11);
  return 'NO DATA';
}

function handleAt(cmd: string, state: SimState): string {
  if (cmd === 'ATZ') {
    Object.assign(state, createSimState());
    return 'ELM327 v1.5';
  }
  if (cmd === 'ATD') {
    Object.assign(state, createSimState());
    return 'OK';
  }
  if (cmd === 'ATDPN') return state.protocol === '0' ? 'A6' : state.protocol;
  if (/^ATSP[0-9A-C]$/.test(cmd)) {
    state.protocol = cmd.slice(4);
    return 'OK';
  }
  if (/^ATSH[0-9A-F]{3}$/.test(cmd)) {
    state.header = cmd.slice(4);
    return 'OK';
  }
  if (cmd === 'ATCRA') {
    state.receiveAddress = null;
    return 'OK';
  }
  if (/^ATCRA[0-9A-F]{3,8}$/.test(cmd)) {
    state.receiveAddress = cmd.slice(5).replace(/^0+(?=[0-9A-F]{3}$)/, '');
    return 'OK';
  }
  if (cmd === 'ATH0' || cmd === 'ATH1') {
    state.headersOn = cmd.endsWith('1');
    return 'OK';
  }
  if (cmd === 'ATS0' || cmd === 'ATS1') {
    state.spacesOn = cmd.endsWith('1');
    return 'OK';
  }
  if (cmd === 'ATCAF0' || cmd === 'ATCAF1') {
    state.autoFormat = cmd.endsWith('1');
    return 'OK';
  }
  if (cmd === 'ATMA') {
    state.monitoring = true;
    return ''; // frames are streamed by the transport layer until any byte arrives
  }
  if (/^AT(E|L|ST|AT|FC|CFC)/.test(cmd)) return 'OK';
  return 'OK';
}

/** One monitor-mode line (`ATMA` output with headers and spaces on) - a rotating set of frames, one of which carries the km. */
export function monitorFrame(config: SimConfig, tick: number): string {
  const frames: [string, number[]][] = [
    ['0008', [0x00, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]],
    ['0203', [0x0c, 0x7a, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00]],
    [W204_SIM.broadcastId, [0x08, 0x00, 0x00, 0x00, ...km24(config.odometerKm), 0xff]],
    ['0210', [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00, 0x00]],
  ];
  const [id, data] = frames[tick % frames.length];
  const idText = id.replace(/^0(?=[0-9A-F]{3}$)/, '');
  return `${idText} ${toHexLine(data)}`;
}

export function handleCommand(command: string, config: SimConfig, state: SimState): string {
  const cmd = command.trim().toUpperCase().replace(/\s+/g, '');

  if (cmd.startsWith('AT')) return handleAt(cmd, state);

  // Anything aimed at the OBD-II functional address or the engine ECU is plain OBD-II/UDS.
  if (state.header === '7DF' || state.header === '7E0') {
    return handleStandardObd(cmd, config) ?? '?';
  }

  if (config.car === 'w204') {
    if (state.header === W204_SIM.ezs.header) return handleEzs(cmd, config, state);
    if (state.header === W204_SIM.cluster.header) return handleCluster(cmd, config, state);
  }

  // No ECU at this address.
  if (/^[0-9A-F]+$/.test(cmd)) return 'NO DATA';
  return '?';
}
