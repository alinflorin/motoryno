import { describe, expect, it } from '@jest/globals';

import { parseHexResponse, parseMonitorFrames } from '@/obd/elm327';
import { classifyResponse, decodeAsciiVin, requestBytes } from '@/obd/protocol';

describe('parseHexResponse', () => {
  it('parses a single-frame reply', () => {
    expect(parseHexResponse('41A6000123AB\r')).toEqual([0x41, 0xa6, 0x00, 0x01, 0x23, 0xab]);
  });

  it('drops the ISO-TP byte-count line and frame indexes of a multi-frame reply', () => {
    const raw = '014\r0: 49 02 01 57 44 44\r1: 32 30 34 30 34 37 31\r2: 46 31 32 33 34 35 36\r';
    const bytes = parseHexResponse(raw);
    expect(bytes.slice(0, 3)).toEqual([0x49, 0x02, 0x01]);
    expect(String.fromCharCode(...bytes.slice(3))).toBe('WDD2040471F123456');
  });

  it('ignores adapter chatter', () => {
    expect(parseHexResponse('SEARCHING...\rNO DATA\r')).toEqual([]);
    expect(parseHexResponse('CAN ERROR\r')).toEqual([]);
    expect(parseHexResponse('?\r')).toEqual([]);
  });
});

describe('classifyResponse', () => {
  it('strips the service and parameter echo from a positive UDS reply', () => {
    const response = classifyResponse(requestBytes('22F190'), '62 F1 90 57 44 44');
    expect(response).toEqual({ status: 'ok', data: [0x57, 0x44, 0x44] });
  });

  it('strips the single-byte echo of a KWP local identifier read', () => {
    expect(classifyResponse(requestBytes('2142'), '61 42 01 E2 40')).toEqual({ status: 'ok', data: [0x01, 0xe2, 0x40] });
  });

  it('recognises a negative response', () => {
    expect(classifyResponse(requestBytes('220100'), '7F 22 31')).toEqual({ status: 'negative', code: 0x31 });
  });

  it('skips a leading response-pending line', () => {
    expect(classifyResponse(requestBytes('1003'), '7F 10 78\r50 03 00 32 01 F4')).toEqual({ status: 'ok', data: [0x00, 0x32, 0x01, 0xf4] });
  });

  it('reports no data when the bus stayed quiet', () => {
    expect(classifyResponse(requestBytes('3E00'), 'NO DATA')).toEqual({ status: 'no-data' });
  });

  it('flags a reply to some other request as unexpected', () => {
    expect(classifyResponse(requestBytes('2101'), '61 02 00')).toMatchObject({ status: 'unexpected' });
  });
});

describe('decodeAsciiVin', () => {
  it('tolerates padding around the 17 characters', () => {
    const bytes = [0x00, ...Array.from('WDD2040471F123456', (c) => c.charCodeAt(0)), 0x20];
    expect(decodeAsciiVin(bytes)).toBe('WDD2040471F123456');
  });
  it('rejects anything that is not 17 printable characters', () => {
    expect(decodeAsciiVin([0x41, 0x42])).toBeNull();
  });
});

describe('parseMonitorFrames', () => {
  it('parses headers-on, spaces-on monitor lines and skips chatter', () => {
    const frames = parseMonitorFrames(['09E 08 00 00 00 01 E2 40 FF', 'BUFFER FULL', '7E8 03 41 00 BE', '<DATA ERROR', 'zz', '0058 00 40']);
    expect(frames).toEqual([
      { id: '009E', data: [0x08, 0x00, 0x00, 0x00, 0x01, 0xe2, 0x40, 0xff] },
      { id: '07E8', data: [0x03, 0x41, 0x00, 0xbe] },
      { id: '0058', data: [0x00, 0x40] },
    ]);
  });
});
