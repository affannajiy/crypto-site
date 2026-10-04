/**
 * Salsa20 — Daniel J. Bernstein, 2005.
 *
 * The cipher ChaCha20 was made from. Both build a 4 × 4 grid of 32-bit words
 * from a constant, the key, a nonce and a block counter, stir it for twenty
 * rounds with nothing but add, rotate and XOR, and add the starting grid back.
 * The 64 bytes that come out are keystream, XORed into the message.
 *
 * The differences from ChaCha20 are small and deliberate, and the explainer
 * walks through them:
 *
 *   - The grid. Salsa20 puts the four constants on the **diagonal** and spreads
 *     key, nonce and counter around them. ChaCha20 puts the constants in the top
 *     row.
 *   - The quarter-round. Salsa20 updates each word once, with rotations of 7, 9,
 *     13 and 18. ChaCha20 updates each word twice, with 16, 12, 8 and 7, which
 *     spreads a change faster.
 *   - The rounds. Salsa20 alternates **column** rounds and **row** rounds.
 *     ChaCha20 alternates columns and diagonals.
 *   - The nonce. Salsa20 has a 64-bit nonce and a 64-bit counter. RFC 8439's
 *     ChaCha20 has a 96-bit nonce and a 32-bit counter.
 *
 * eSTREAM, the European stream-cipher project, chose Salsa20/12 for its software
 * portfolio in 2008. That is the lecture's "software and hardware
 * implementations".
 *
 * **Do not use this file for anything real.** It is written to be read, and it
 * has had none of the care a real implementation needs.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { fromHex, toHex } from '../../../../lib/format';

export type Direction = 'encrypt' | 'decrypt';

export const ROUNDS = 20;
export const BLOCK_BYTES = 64;
export const NONCE_BYTES = 8;

/** "expand 32-byte k" and "expand 16-byte k", as four little-endian words each. */
export const SIGMA = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574] as const;
export const TAU = [0x61707865, 0x3120646e, 0x79622d36, 0x6b206574] as const;

export function rotl(value: number, by: number): number {
  return ((value << by) | (value >>> (32 - by))) >>> 0;
}

/**
 * The quarter-round on four words, in place.
 *
 *     b ^= (a + d) <<< 7
 *     c ^= (b + a) <<< 9
 *     d ^= (c + b) <<< 13
 *     a ^= (d + c) <<< 18
 */
export function quarterRound(s: number[], a: number, b: number, c: number, d: number): void {
  s[b] = ((s[b] ?? 0) ^ rotl(((s[a] ?? 0) + (s[d] ?? 0)) >>> 0, 7)) >>> 0;
  s[c] = ((s[c] ?? 0) ^ rotl(((s[b] ?? 0) + (s[a] ?? 0)) >>> 0, 9)) >>> 0;
  s[d] = ((s[d] ?? 0) ^ rotl(((s[c] ?? 0) + (s[b] ?? 0)) >>> 0, 13)) >>> 0;
  s[a] = ((s[a] ?? 0) ^ rotl(((s[d] ?? 0) + (s[c] ?? 0)) >>> 0, 18)) >>> 0;
}

/** Down each column, each starting at its diagonal word. */
export function columnRound(s: number[]): void {
  quarterRound(s, 0, 4, 8, 12);
  quarterRound(s, 5, 9, 13, 1);
  quarterRound(s, 10, 14, 2, 6);
  quarterRound(s, 15, 3, 7, 11);
}

/** Along each row, each starting at its diagonal word. */
export function rowRound(s: number[]): void {
  quarterRound(s, 0, 1, 2, 3);
  quarterRound(s, 5, 6, 7, 4);
  quarterRound(s, 10, 11, 8, 9);
  quarterRound(s, 15, 12, 13, 14);
}

export function wordAt(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16) | ((bytes[at + 3] ?? 0) << 24)) >>> 0
  );
}

/**
 * The starting grid. Constants on the diagonal; key around them; nonce and
 * counter in the middle.
 *
 *     c0  k0  k1  k2
 *     k3  c1  n0  n1
 *     b0  b1  c2  k4
 *     k5  k6  k7  c3
 *
 * A 128-bit key is used twice, with the constant TAU instead of SIGMA.
 */
export function initialState(key: Uint8Array, nonce: Uint8Array, counter: bigint): number[] {
  const long = key.length === 32;
  const c = long ? SIGMA : TAU;
  const k = (i: number) => wordAt(key, long ? i * 4 : (i % 4) * 4);
  const lo = Number(counter & 0xffffffffn) >>> 0;
  const hi = Number((counter >> 32n) & 0xffffffffn) >>> 0;
  return [
    c[0], k(0), k(1), k(2),
    k(3), c[1], wordAt(nonce, 0), wordAt(nonce, 4),
    lo, hi, c[2], k(4),
    k(5), k(6), k(7), c[3],
  ];
}

export interface BlockTrace {
  initial: number[];
  /** After the column round and after the row round of each double round. */
  rounds: { double: number; afterColumns: number[]; afterRows: number[] }[];
  final: number[];
}

/** The Salsa20 hash of the starting grid: twenty rounds, then add the start back. */
export function core(initial: number[]): { bytes: Uint8Array; trace: BlockTrace } {
  const state = [...initial];
  const rounds: BlockTrace['rounds'] = [];
  for (let double = 0; double < ROUNDS / 2; double += 1) {
    columnRound(state);
    const afterColumns = [...state];
    rowRound(state);
    rounds.push({ double: double + 1, afterColumns, afterRows: [...state] });
  }
  // Adding the input back is what stops the rounds being run in reverse to
  // recover the key from the keystream.
  const final = state.map((word, i) => (word + (initial[i] ?? 0)) >>> 0);
  const bytes = new Uint8Array(BLOCK_BYTES);
  final.forEach((word, i) => {
    bytes[i * 4] = word & 0xff;
    bytes[i * 4 + 1] = (word >>> 8) & 0xff;
    bytes[i * 4 + 2] = (word >>> 16) & 0xff;
    bytes[i * 4 + 3] = (word >>> 24) & 0xff;
  });
  return { bytes, trace: { initial, rounds, final } };
}

export function block(key: Uint8Array, nonce: Uint8Array, counter: bigint) {
  return core(initialState(key, nonce, counter));
}

export function keystream(key: Uint8Array, nonce: Uint8Array, counter: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let at = 0, n = counter; at < length; at += BLOCK_BYTES, n += 1n) {
    out.set(block(key, nonce, n).bytes.slice(0, Math.min(BLOCK_BYTES, length - at)), at);
  }
  return out;
}

export interface Options {
  key: Uint8Array;
  nonce: Uint8Array;
  counter: bigint;
}

export function readKey(hex: string): Uint8Array {
  const bytes = fromHex(hex.replace(/\s+/g, ''));
  if (bytes === null) throw new Error('The key must be hexadecimal: the digits 0-9 and a-f, two per byte.');
  if (bytes.length !== 32 && bytes.length !== 16) {
    throw new Error(
      `A Salsa20 key is 256 bits (64 hex digits) or 128 bits (32 hex digits). This one is ${bytes.length * 8} bits.`,
    );
  }
  return bytes;
}

export function readNonce(hex: string): Uint8Array {
  const bytes = fromHex(hex.replace(/\s+/g, ''));
  if (bytes === null || bytes.length !== NONCE_BYTES) {
    throw new Error('The Salsa20 nonce is 64 bits — exactly 16 hex digits — and must never repeat under one key.');
  }
  return bytes;
}

function messageBytes(text: string, direction: Direction): Uint8Array {
  if (direction === 'encrypt') return new TextEncoder().encode(text);
  const bytes = fromHex(text.replace(/\s+/g, ''));
  if (bytes === null) throw new Error('A Salsa20 ciphertext is hexadecimal, two digits per byte.');
  return bytes;
}

export function salsa20Bytes(bytes: Uint8Array, options: Options): Uint8Array {
  const stream = keystream(options.key, options.nonce, options.counter, bytes.length);
  return bytes.map((byte, i) => byte ^ (stream[i] ?? 0));
}

/** The cipher, untraced. */
export function salsa20(text: string, options: Options, direction: Direction): string {
  const out = salsa20Bytes(messageBytes(text, direction), options);
  return direction === 'encrypt' ? toHex(out) : new TextDecoder().decode(out);
}

/** Where in the original text each 64-byte block came from. */
function blockRanges(text: string, blockCount: number): { start: number; end: number }[] {
  const encoder = new TextEncoder();
  const ranges: { start: number; end: number }[] = [];
  let byteAt = 0;
  let charAt = 0;
  for (let b = 0; b < blockCount; b += 1) {
    const start = charAt;
    while (charAt < text.length && byteAt < (b + 1) * BLOCK_BYTES) {
      byteAt += encoder.encode(text.charAt(charAt)).length;
      charAt += 1;
    }
    ranges.push({ start, end: Math.max(start, charAt) });
  }
  return ranges;
}

const hexWord = (w: number) => w.toString(16).padStart(8, '0');

/** The cipher again, one `Step` per 64-byte block, with every round in `data`. */
export function salsa20Trace(text: string, options: Options, direction: Direction): TraceResult {
  const input = messageBytes(text, direction);
  const steps: Step[] = [];
  const out = new Uint8Array(input.length);
  const blockCount = Math.max(1, Math.ceil(input.length / BLOCK_BYTES));
  const ranges = direction === 'encrypt' ? blockRanges(text, blockCount) : [];

  for (let b = 0; b < blockCount; b += 1) {
    const counter = options.counter + BigInt(b);
    const { bytes: stream, trace } = block(options.key, options.nonce, counter);
    const start = b * BLOCK_BYTES;
    const slice = input.slice(start, start + BLOCK_BYTES);
    const result = slice.map((byte, i) => byte ^ (stream[i] ?? 0));
    out.set(result, start);

    steps.push({
      index: b,
      title: `Block ${b + 1}, counter ${counter}`,
      detail: `The grid is built from the constant "expand 32-byte k", the key, the nonce and the block counter ${counter}. Ten double rounds follow, each a column round and then a row round. Each quarter-round is add, rotate, XOR, with rotations 7, 9, 13 and 18. The starting grid is added back, and the 64 bytes that result are XORed into this block of the message.`,
      output: toHex(result),
      highlight: direction === 'encrypt' ? (ranges[b] ?? { start: 0, end: 0 }) : { start: start * 2, end: (start + slice.length) * 2 },
      outputHighlight:
        direction === 'encrypt' ? { start: start * 2, end: (start + slice.length) * 2 } : { start, end: start + slice.length },
      data: {
        isSalsa: true,
        block: b,
        counter: counter.toString(),
        initial: trace.initial.map(hexWord),
        rounds: trace.rounds.map((r) => ({
          double: r.double,
          afterColumns: r.afterColumns.map(hexWord),
          afterRows: r.afterRows.map(hexWord),
        })),
        final: trace.final.map(hexWord),
        keystream: toHex(stream.slice(0, slice.length)),
      },
    });
  }

  return { output: direction === 'encrypt' ? toHex(out) : new TextDecoder().decode(out), steps };
}
