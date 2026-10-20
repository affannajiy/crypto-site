import { describe, expect, it } from 'vitest';
import { mixColumnByHand, readColumn, sboxLookup, times2, times3 } from './byHand';
import { mixColumns } from './aes';

describe('AES by hand', () => {
  it('reproduces the lecture S-box example, 45 -> 6e', () => {
    const lookup = sboxLookup(0x45);
    expect(lookup.row).toBe(4);
    expect(lookup.column).toBe(5);
    expect(lookup.output).toBe(0x6e);
  });

  it('keeps the two cases of 02 x b apart', () => {
    // Top bit 0: a plain shift.
    expect(times2(0x45)).toMatchObject({ msbSet: false, output: 0x8a });
    // Top bit 1: shift, then XOR 1B.
    expect(times2(0x87)).toMatchObject({ msbSet: true, shifted: 0x0e, output: 0x15 });
  });

  it('builds 03 x b from 02 x b', () => {
    expect(times3(0x87).output).toBe(0x15 ^ 0x87);
  });

  it('gives the FIPS-197 column d4 bf 5d 30 -> 04 66 81 e5', () => {
    const rows = mixColumnByHand(readColumn('d4 bf 5d 30'));
    expect(rows.map((r) => r.output)).toEqual([0x04, 0x66, 0x81, 0xe5]);
  });

  it('agrees with the cipher on every column', () => {
    const state = new Uint8Array(16).map((_, i) => (i * 37 + 11) & 0xff);
    const mixed = mixColumns(state);
    for (let col = 0; col < 4; col += 1) {
      const byHand = mixColumnByHand(Array.from(state.slice(col * 4, col * 4 + 4))).map((r) => r.output);
      expect(byHand).toEqual(Array.from(mixed.slice(col * 4, col * 4 + 4)));
    }
  });
});
