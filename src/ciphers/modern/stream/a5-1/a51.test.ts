import { describe, expect, it } from 'vitest';
import { REGISTERS, a51, a51Trace, bursts, clockMajority, clockOne, majority, outputBit, readFrame, readKey } from './a51';
import { toHex } from '../../../../lib/format';
import a51Cipher from './index';

const KEY = new Uint8Array([0x12, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]);

describe('the 1999 reference implementation', () => {
  it('reproduces both bursts for key 12 23 45 67 89 AB CD EF, frame 0x134', () => {
    // Briceno, Goldberg and Wagner, "A pedagogical implementation of A5/1".
    const { aToB, bToA } = bursts(KEY, 0x134);
    expect(toHex(aToB)).toBe('534eaa582fe8151ab6e1855a728c00');
    expect(toHex(bToA)).toBe('24fd35a35d5fb6526d32f906df1ac0');
  });
});

describe('the registers', () => {
  it('are 19, 22 and 23 bits: 64 bits of state', () => {
    expect(REGISTERS.map((r) => r.length)).toEqual([19, 22, 23]);
    expect(REGISTERS.reduce((sum, r) => sum + r.length, 0)).toBe(64);
  });

  it('shift left and feed the XOR of the taps into bit 0', () => {
    const r1 = REGISTERS[0]!;
    // Only bit 13 set: one tap is 1, so the new bit 0 is 1 and bit 13 moves to 14.
    expect(clockOne(1 << 13, r1)).toBe((1 << 14) | 1);
    // The top bit falls off the end.
    expect(clockOne(1 << 18, r1)).toBe(1);
  });

  it('moves two or three registers on every clock, never fewer', () => {
    let state: [number, number, number] = [0x5a5a5, 0x2a2a2a, 0x355555];
    for (let i = 0; i < 200; i += 1) {
      const { next, moved } = clockMajority(state);
      expect(moved.filter(Boolean).length).toBeGreaterThanOrEqual(2);
      state = next;
    }
  });

  it('votes by the clocking bits and outputs the XOR of the top bits', () => {
    const state: [number, number, number] = [1 << 8, 1 << 10, 0];
    expect(majority(state)).toBe(1);
    expect(outputBit([1 << 18, 0, 0])).toBe(1);
    expect(outputBit([1 << 18, 1 << 21, 0])).toBe(0);
  });
});

describe('the cipher', () => {
  const options = { key: KEY, frame: 0x134 };

  it('XORs the first burst into the message', () => {
    const expected = 'Hi'.split('').map((c, i) => c.charCodeAt(0) ^ [0x53, 0x4e][i]!);
    expect(a51('Hi', options, 'encrypt')).toBe(toHex(new Uint8Array(expected)));
  });

  it('round-trips a message longer than one frame', () => {
    const text = 'A message long enough to need three or four GSM frames of keystream.';
    expect(a51(a51(text, options, 'encrypt'), options, 'decrypt')).toBe(text);
  });

  it('traces a setup step, then one step per frame', () => {
    const { steps } = a51Trace('x'.repeat(30), options, 'encrypt');
    expect(steps.map((s) => s.data?.['frame'] ?? 'setup')).toEqual(['setup', 0x134, 0x135, 0x136]);
  });

  it('checks its inputs', () => {
    expect(() => readKey('1234')).toThrow(/16 hex digits/);
    expect(() => readFrame(1 << 22)).toThrow(/22 bits/);
  });

  it('opens on the reference key', () => {
    expect(a51Cipher.examples?.[0]?.params).toEqual({ key: '1223456789abcdef', frame: 0x134 });
  });
});
