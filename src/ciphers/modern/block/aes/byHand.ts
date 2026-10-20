/**
 * AES by hand, the way slides 35 to 39 of Lecture 04 work it.
 *
 * - SubBytes: split the byte into a row nibble X and a column nibble Y, and read
 *   the S-box at (X, Y). The slide's example is 45 -> 6e.
 * - MixColumns: multiply the column by the fixed matrix. Only 01, 02 and 03 occur:
 *   02 x b is "shift left one bit, then XOR 1B if the top bit was 1", and
 *   03 x b is (02 x b) XOR b.
 *
 * The slides call the matrix a "circulant MD5 matrix". It is an MDS matrix
 * (maximum distance separable). MD5 is a hash function and has nothing to do with it.
 *
 * Plain TypeScript. Imports nothing from React. The answers come from the same
 * `SBOX` and `xtime` the cipher uses, so this page cannot disagree with the cipher.
 */
import { SBOX, xtime } from './aes';

export const MIX_MATRIX: readonly (readonly number[])[] = [
  [2, 3, 1, 1],
  [1, 2, 3, 1],
  [1, 1, 2, 3],
  [3, 1, 1, 2],
];

export const hex2 = (b: number) => b.toString(16).padStart(2, '0');
export const bin8 = (b: number) => b.toString(2).padStart(8, '0');

export interface SboxLookup {
  input: number;
  row: number;
  column: number;
  output: number;
}

export function sboxLookup(byte: number): SboxLookup {
  return { input: byte, row: byte >> 4, column: byte & 0x0f, output: SBOX[byte] ?? 0 };
}

export interface Times2 {
  input: number;
  msbSet: boolean;
  /** The byte shifted left one bit, with the top bit dropped. */
  shifted: number;
  output: number;
}

/** 02 x b, with the slide's two cases kept apart. */
export function times2(byte: number): Times2 {
  const shifted = (byte << 1) & 0xff;
  return { input: byte, msbSet: (byte & 0x80) !== 0, shifted, output: xtime(byte) };
}

/** 03 x b = (02 x b) XOR b. */
export function times3(byte: number): { input: number; twice: number; output: number } {
  const twice = xtime(byte);
  return { input: byte, twice, output: twice ^ byte };
}

export interface MixTerm {
  multiplier: number;
  byte: number;
  product: number;
}

/** One output byte of MixColumns: four products, XORed. */
export interface MixRow {
  terms: MixTerm[];
  output: number;
}

export function multiply(multiplier: number, byte: number): number {
  if (multiplier === 1) return byte;
  if (multiplier === 2) return times2(byte).output;
  if (multiplier === 3) return times3(byte).output;
  throw new Error(`MixColumns only multiplies by 01, 02 and 03, not ${multiplier}.`);
}

/** The whole column, one row of the matrix at a time. */
export function mixColumnByHand(column: readonly number[]): MixRow[] {
  if (column.length !== 4) throw new Error('A column is four bytes.');
  return MIX_MATRIX.map((row) => {
    const terms = row.map((multiplier, k) => {
      const byte = column[k] ?? 0;
      return { multiplier, byte, product: multiply(multiplier, byte) };
    });
    return { terms, output: terms.reduce((acc, t) => acc ^ t.product, 0) };
  });
}

/** Reads "d4 bf 5d 30" or "d4bf5d30" as four bytes, or throws a sentence. */
export function readColumn(text: string): number[] {
  const clean = text.replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]{8}$/.test(clean)) {
    throw new Error('A column is four bytes: eight hex digits, such as d4 bf 5d 30.');
  }
  return (clean.match(/.{2}/g) ?? []).map((pair) => parseInt(pair, 16));
}

/** Reads one byte as two hex digits, or throws a sentence. */
export function readByte(text: string): number {
  const clean = text.trim();
  if (!/^[0-9a-fA-F]{1,2}$/.test(clean)) throw new Error('A byte is one or two hex digits, such as 45.');
  return parseInt(clean, 16);
}
