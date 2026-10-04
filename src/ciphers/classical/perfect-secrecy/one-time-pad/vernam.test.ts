import { describe, expect, it } from 'vitest';
import { bits, vernam, vernamTrace } from './vernam';
import { bytesToHex, utf8Bytes } from '../../../../lib/bytes';
import oneTimePadCipher from './index';

const PAD = '0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f';

describe('the Vernam form', () => {
  it('XORs each byte with the pad byte', () => {
    // 'A' is 0x41 = 01000001. XOR 00001111 gives 01001110 = 0x4e.
    expect(bits(0x41)).toBe('01000001');
    expect(vernam('A', PAD)).toBe('4e');
    expect(vernam('AB', 'ff00')).toBe('be42');
  });

  it('decrypts with the same pad, because XOR is its own inverse', () => {
    for (const message of ['Meet me at dawn.', 'odd', 'café ☕']) {
      const pad = 'a5'.repeat(32);
      expect(vernam(vernam(message, pad), pad, 'decrypt')).toBe(message);
    }
  });

  it('accepts ciphertext hex with spaces', () => {
    expect(vernam('be 42', 'ff00', 'decrypt')).toBe('AB');
  });

  it('refuses a pad shorter than the message', () => {
    expect(() => vernam('ABC', 'ffff')).toThrow(/1 byte too short/);
  });

  it('refuses a pad that is not hex', () => {
    expect(() => vernam('A', 'zz')).toThrow(/hex pad/);
  });

  it('cancels the pad when it is used twice', () => {
    const pad = '3c'.repeat(8) + '91'.repeat(8);
    const c1 = vernam('ATTACK AT DAWN', pad);
    const c2 = vernam('RETREAT AT TEN', pad);
    const xorHex = (a: string, b: string) =>
      a.match(/../g)!.map((h, i) => (parseInt(h, 16) ^ parseInt(b.slice(i * 2, i * 2 + 2), 16)).toString(16).padStart(2, '0')).join('');
    const p1 = bytesToHex(utf8Bytes('ATTACK AT DAWN'));
    const p2 = bytesToHex(utf8Bytes('RETREAT AT TEN'));
    expect(xorHex(c1, c2)).toBe(xorHex(p1, p2));
  });

  it('traces one step per byte, with the bits in the title', () => {
    const { steps } = vernamTrace('A', PAD);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.title).toBe('Byte 1: 01000001 XOR 00001111 = 01001110');
    expect(steps[0]?.data?.['vernam']).toBe(true);
  });

  it('lights the character in the input and its two hex digits in the output', () => {
    // é is two bytes, so bytes 2 and 3 both point at character 1.
    const { steps } = vernamTrace('hé!', 'ff'.repeat(8));
    expect(steps.map((s) => s.highlight)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
    ]);
    expect(steps[3]?.outputHighlight).toEqual({ start: 6, end: 8 });
  });

  it('is a mode of the One-Time Pad page, with letters still the default', () => {
    const mode = oneTimePadCipher.params.find((p) => p.name === 'mode');
    expect(mode?.kind === 'select' ? mode.default : null).toBe('letters');
    const out = oneTimePadCipher.encrypt('Hi', { pad: 'AB', mode: 'vernam', hexPad: 'ffff' });
    expect(out instanceof Promise ? null : out.output).toBe('b796');
  });
});
