import { describe, expect, it } from 'vitest';
import { columnRound, core, initialState, quarterRound, rowRound, salsa20, salsa20Trace } from './salsa20';
import { fromHex } from '../../../../lib/format';
import salsa20Cipher from './index';

const hex = (s: string) => fromHex(s) ?? new Uint8Array();

/**
 * Every expected value here is from Bernstein's "Salsa20 specification", the
 * examples given under each function.
 */
describe('the specification examples', () => {
  it('quarterround(1, 0, 0, 0)', () => {
    const s = [1, 0, 0, 0];
    quarterRound(s, 0, 1, 2, 3);
    expect(s).toEqual([0x08008145, 0x00000080, 0x00010200, 0x20500000]);
  });

  it('quarterround on four arbitrary words', () => {
    const s = [0xe7e8c006, 0xc4f9417d, 0x6479b4b2, 0x68c67137];
    quarterRound(s, 0, 1, 2, 3);
    expect(s).toEqual([0xe876d72b, 0x9361dfd5, 0xf1460244, 0x948541a3]);
  });

  it('rowround and columnround on a single 1', () => {
    const row = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    rowRound(row);
    expect(row).toEqual([
      0x08008145, 0x00000080, 0x00010200, 0x20500000, 0x20100001, 0x00048044, 0x00000080, 0x00010000,
      0x00000001, 0x00002000, 0x80040000, 0x00000000, 0x00000001, 0x00000200, 0x00402000, 0x88000100,
    ]);
    const column = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    columnRound(column);
    expect(column).toEqual([
      0x10090288, 0, 0, 0, 0x00000101, 0, 0, 0, 0x00020401, 0, 0, 0, 0x40a04001, 0, 0, 0,
    ]);
  });

  const nonceBytes = Array.from({ length: 16 }, (_, i) => i + 101);
  const nonce = new Uint8Array(nonceBytes.slice(0, 8));
  const counter = nonceBytes.slice(8).reduceRight((acc, byte) => (acc << 8n) | BigInt(byte), 0n);

  it('expands a 256-bit key exactly as section 10 shows', () => {
    const key = new Uint8Array([...Array.from({ length: 16 }, (_, i) => i + 1), ...Array.from({ length: 16 }, (_, i) => i + 201)]);
    expect([...core(initialState(key, nonce, counter)).bytes]).toEqual([
      69, 37, 68, 39, 41, 15, 107, 193, 255, 139, 122, 6, 170, 233, 217, 98, 89, 144, 182, 106, 21, 51, 200, 65, 239,
      49, 222, 34, 215, 114, 40, 126, 104, 197, 7, 225, 197, 153, 31, 2, 102, 78, 76, 176, 84, 245, 246, 184, 177, 160,
      133, 130, 6, 72, 149, 119, 192, 195, 132, 236, 234, 103, 246, 74,
    ]);
  });

  it('expands a 128-bit key exactly as section 10 shows', () => {
    const key = new Uint8Array(Array.from({ length: 16 }, (_, i) => i + 1));
    expect([...core(initialState(key, nonce, counter)).bytes]).toEqual([
      39, 173, 46, 248, 30, 200, 82, 17, 48, 67, 254, 239, 37, 18, 13, 247, 241, 200, 61, 144, 10, 55, 50, 185, 6, 47,
      246, 253, 143, 86, 187, 225, 134, 85, 110, 246, 161, 163, 43, 235, 231, 94, 171, 51, 145, 214, 112, 29, 14, 232,
      5, 16, 151, 140, 183, 141, 171, 9, 122, 181, 104, 182, 177, 193,
    ]);
  });
});

describe('the cipher', () => {
  const options = {
    key: hex('0102030405060708090a0b0c0d0e0f10c9cacbcccdcecfd0d1d2d3d4d5d6d7d8'),
    nonce: hex('65666768696a6b6c'),
    counter: 0n,
  };

  it('round-trips across a block boundary', () => {
    const text = 'x'.repeat(150) + ' Café';
    expect(salsa20(salsa20(text, options, 'encrypt'), options, 'decrypt')).toBe(text);
  });

  it('puts the constants on the diagonal', () => {
    const s = initialState(options.key, options.nonce, 0n);
    expect([s[0], s[5], s[10], s[15]]).toEqual([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]);
  });

  it('traces one step per 64-byte block, with all ten double rounds', () => {
    const { steps } = salsa20Trace('y'.repeat(100), options, 'encrypt');
    expect(steps).toHaveLength(2);
    expect((steps[0]?.data?.['rounds'] as unknown[]).length).toBe(10);
    expect(steps[1]?.data?.['counter']).toBe('1');
  });

  it('has no Attack tab because it works', () => {
    expect(salsa20Cipher.attack).toBeUndefined();
    expect(salsa20Cipher.security).toBe('secure');
  });
});
