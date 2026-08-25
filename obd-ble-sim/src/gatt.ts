import bleno, { Characteristic, PrimaryService } from '@abandonware/bleno';

import { handleCommand, SimConfig } from './elmSim';
import { UartProfile } from './profiles';

/** Default BLE ATT payload size (23-byte MTU minus the 3-byte ATT header) - matches most unnegotiated connections. */
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 15;

/**
 * Builds the GATT service for `profile`, wired to the ELM327 command
 * interpreter. Handles command reassembly (writes may arrive split across
 * multiple BLE packets) and chunks responses back out the same way a real
 * adapter's radio would.
 */
export function createGattService(profile: UartProfile, config: SimConfig): PrimaryService {
  let notifyCallback: ((data: Buffer) => void) | null = null;
  let inbound = '';

  function sendResponse(text: string) {
    const bytes = Buffer.from(text, 'ascii');
    let offset = 0;
    const sendNext = () => {
      if (offset >= bytes.length || !notifyCallback) return;
      notifyCallback(Buffer.from(bytes.subarray(offset, offset + CHUNK_SIZE)));
      offset += CHUNK_SIZE;
      if (offset < bytes.length) setTimeout(sendNext, CHUNK_DELAY_MS);
    };
    sendNext();
  }

  function onCommandLine(line: string) {
    const command = line.trim();
    if (!command) return;
    const response = handleCommand(command, config);
    console.log(`> ${command}`);
    console.log(`< ${response}`);
    sendResponse(`${response}\r\r>`);
  }

  function onWriteRequest(
    data: Buffer,
    _offset: number,
    _withoutResponse: boolean,
    callback: (result: number) => void
  ) {
    inbound += data.toString('ascii');
    let idx: number;
    while ((idx = inbound.indexOf('\r')) !== -1) {
      const line = inbound.slice(0, idx);
      inbound = inbound.slice(idx + 1);
      onCommandLine(line);
    }
    callback(Characteristic.RESULT_SUCCESS);
  }

  function onSubscribe(_maxValueSize: number, updateValueCallback: (data: Buffer) => void) {
    notifyCallback = updateValueCallback;
  }

  function onUnsubscribe() {
    notifyCallback = null;
  }

  const characteristics =
    profile.writeUUID === profile.notifyUUID
      ? [
          new Characteristic({
            uuid: profile.writeUUID,
            properties: ['write', 'writeWithoutResponse', 'notify'],
            onWriteRequest,
            onSubscribe,
            onUnsubscribe,
          }),
        ]
      : [
          new Characteristic({
            uuid: profile.writeUUID,
            properties: ['write', 'writeWithoutResponse'],
            onWriteRequest,
          }),
          new Characteristic({
            uuid: profile.notifyUUID,
            properties: ['notify'],
            onSubscribe,
            onUnsubscribe,
          }),
        ];

  return new PrimaryService({ uuid: profile.serviceUUID, characteristics });
}

export { bleno };
