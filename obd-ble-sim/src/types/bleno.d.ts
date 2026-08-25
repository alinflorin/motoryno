// @abandonware/bleno ships no types. This is a minimal ambient declaration
// covering just the surface this project uses.
declare module '@abandonware/bleno' {
  import { EventEmitter } from 'events';

  export class Characteristic extends EventEmitter {
    constructor(options: {
      uuid: string;
      properties: Array<'read' | 'write' | 'writeWithoutResponse' | 'notify' | 'indicate'>;
      onReadRequest?: (offset: number, callback: (result: number, data?: Buffer) => void) => void;
      onWriteRequest?: (
        data: Buffer,
        offset: number,
        withoutResponse: boolean,
        callback: (result: number) => void
      ) => void;
      onSubscribe?: (maxValueSize: number, updateValueCallback: (data: Buffer) => void) => void;
      onUnsubscribe?: () => void;
    });
    static RESULT_SUCCESS: number;
    static RESULT_UNLIKELY_ERROR: number;
  }

  export class PrimaryService {
    constructor(options: { uuid: string; characteristics: Characteristic[] });
  }

  interface Bleno extends EventEmitter {
    startAdvertising(name: string, serviceUuids: string[], callback?: (error?: Error) => void): void;
    stopAdvertising(callback?: () => void): void;
    setServices(services: PrimaryService[], callback?: (error?: Error) => void): void;
    disconnect(): void;
    state: string;
  }

  const bleno: Bleno;
  export default bleno;
}
