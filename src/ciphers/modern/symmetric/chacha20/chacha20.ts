/**
 * ChaCha20 — Daniel J. Bernstein, 2008; standardised as RFC 8439.
 *
 * AES is a **block cipher**: it transforms 16 bytes of your data into 16 bytes of
 * ciphertext. ChaCha20 is a **stream cipher**, and it never touches your data at
 * all. It generates a pseudorandom keystream from the key, the nonce and a
 * counter, and the ciphertext is the plaintext XORed with it.
 *
 *     ciphertext = plaintext XOR keystream(key, nonce, counter)
 *
 * That is the One-Time Pad's construction with a keystream that is *computed*
 * rather than *shared*, and the entire difference between the two — the whole gap
 * between "provably unbreakable" and "unbreakable as far as anyone can tell" — is
 * that a pad's key is random and a stream cipher's only looks random.
 *
 * It also means **encryption and decryption are the same operation**, because XOR
 * is its own inverse. And it means the nonce is load-bearing in a way an IV is
 * not: reuse a nonce and you have reused a pad, with exactly the consequences the
 * One-Time Pad page demonstrates.
 *
 * ## The core
 *
 * Sixteen 32-bit words in a 4x4 grid: four constants spelling "expand 32-byte k",
 * eight words of key, one counter, three words of nonce. Twenty rounds of one
 * operation — the **quarter-round** — applied first down the columns and then
 * along the diagonals. Then the original state is added back in, which is what
 * makes the function one-way rather than a permutation you could simply reverse.
 *
 * The quarter-round is add, XOR, rotate. Nothing else. No S-box, no lookup table,
 * no data-dependent branch — which is why ChaCha20 is **naturally constant-time**
 * on any processor, while a table-based AES is not unless the hardware helps. That
 * is why it is the cipher of choice on phones and embedded devices, and why TLS
 * offers it alongside AES rather than instead of it.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { fromHex, toHex } from '../../../../lib/format';

export type Direction = 'encrypt' | 'decrypt';

export const ROUNDS = 20;
export const BLOCK_BYTES = 64;
export const KEY_BYTES = 32;
export const NONCE_BYTES = 12;

/** "expand 32-byte k" as four little-endian words. Not a nothing-up-my-sleeve joke:
 *  fixing these four words stops an attacker choosing a state with useful structure. */
export const CONSTANTS = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574] as const;

/** Rotate left, staying in 32 bits. JavaScript's shifts are signed, hence the >>> 0. */
export function rotl(value: number, by: number): number {
  return ((value << by) | (value >>> (32 - by))) >>> 0;
}

/**
 * The quarter-round: add, XOR, rotate, four times over.
 *
 * Every operation is on whole 32-bit words, none of them depends on the data to
 * decide what to do, and there is not a lookup table anywhere. That is what
 * "constant-time by construction" means.
 */
export function quarterRound(state: number[], a: number, b: number, c: number, d: number): void {
  state[a] = ((state[a] ?? 0) + (state[b] ?? 0)) >>> 0;
  state[d] = rotl((state[d] ?? 0) ^ (state[a] ?? 0), 16);
  state[c] = ((state[c] ?? 0) + (state[d] ?? 0)) >>> 0;
  state[b] = rotl((state[b] ?? 0) ^ (state[c] ?? 0), 12);
  state[a] = ((state[a] ?? 0) + (state[b] ?? 0)) >>> 0;
  state[d] = rotl((state[d] ?? 0) ^ (state[a] ?? 0), 8);
  state[c] = ((state[c] ?? 0) + (state[d] ?? 0)) >>> 0;
  state[b] = rotl((state[b] ?? 0) ^ (state[c] ?? 0), 7);
}

/** Little-endian 32-bit word at byte offset `at`. */
export function wordAt(bytes: Uint8Array, at: number): number {
  return (
    (((bytes[at] ?? 0) |
      ((bytes[at + 1] ?? 0) << 8) |
      ((bytes[at + 2] ?? 0) << 16) |
      ((bytes[at + 3] ?? 0) << 24)) >>>
      0)
  );
}

/** The starting 16-word state: constants, key, counter, nonce. */
export function initialState(key: Uint8Array, nonce: Uint8Array, counter: number): number[] {
  const state: number[] = [...CONSTANTS];
  for (let i = 0; i < 8; i += 1) state.push(wordAt(key, i * 4));
  state.push(counter >>> 0);
  for (let i = 0; i < 3; i += 1) state.push(wordAt(nonce, i * 4));
  return state;
}

/** The state after each double round, so the visualizer can step through them. */
export interface BlockTrace {
  initial: number[];
  /** One entry per double round: after the four columns, and after the four diagonals. */
  rounds: { double: number; afterColumns: number[]; afterDiagonals: number[] }[];
  beforeAdd: number[];
  final: number[];
}

/**
 * One 64-byte keystream block.
 *
 * The final addition of the original state is what stops the twenty rounds from
 * being a reversible permutation. Without it, anyone could run the rounds backwards
 * from the output and read the key straight out of the state.
 */
export function block(key: Uint8Array, nonce: Uint8Array, counter: number): { bytes: Uint8Array; trace: BlockTrace } {
  const initial = initialState(key, nonce, counter);
  const state = [...initial];
  const rounds: BlockTrace['rounds'] = [];

  for (let double = 0; double < ROUNDS / 2; double += 1) {
    // Columns.
    quarterRound(state, 0, 4, 8, 12);
    quarterRound(state, 1, 5, 9, 13);
    quarterRound(state, 2, 6, 10, 14);
    quarterRound(state, 3, 7, 11, 15);
    const afterColumns = [...state];
    // Diagonals. The offset is what carries a change from one column to another.
    quarterRound(state, 0, 5, 10, 15);
    quarterRound(state, 1, 6, 11, 12);
    quarterRound(state, 2, 7, 8, 13);
    quarterRound(state, 3, 4, 9, 14);
    rounds.push({ double: double + 1, afterColumns, afterDiagonals: [...state] });
  }

  const beforeAdd = [...state];
  const final = state.map((word, i) => (word + (initial[i] ?? 0)) >>> 0);

  const bytes = new Uint8Array(BLOCK_BYTES);
  final.forEach((word, i) => {
    bytes[i * 4] = word & 0xff;
    bytes[i * 4 + 1] = (word >>> 8) & 0xff;
    bytes[i * 4 + 2] = (word >>> 16) & 0xff;
    bytes[i * 4 + 3] = (word >>> 24) & 0xff;
  });

  return { bytes, trace: { initial, rounds, beforeAdd, final } };
}

/** The keystream for `length` bytes, starting at `counter`. */
export function keystream(key: Uint8Array, nonce: Uint8Array, counter: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let at = 0;
  let n = counter;
  while (at < length) {
    const { bytes } = block(key, nonce, n);
    out.set(bytes.slice(0, Math.min(BLOCK_BYTES, length - at)), at);
    at += BLOCK_BYTES;
    n += 1;
  }
  return out;
}

export interface Options {
  key: Uint8Array;
  nonce: Uint8Array;
  counter: number;
}

export function readKey(hex: string): Uint8Array {
  const bytes = fromHex(hex.replace(/\s+/g, ''));
  if (bytes === null) {
    throw new Error('The key must be hexadecimal: the digits 0-9 and a-f, two per byte.');
  }
  if (bytes.length !== KEY_BYTES) {
    throw new Error(
      `A ChaCha20 key is always 256 bits — exactly 64 hex digits. This one is ${bytes.length * 8} bits. There is no 128-bit variant in RFC 8439.`,
    );
  }
  return bytes;
}

export function readNonce(hex: string): Uint8Array {
  const bytes = fromHex(hex.replace(/\s+/g, ''));
  if (bytes === null || bytes.length !== NONCE_BYTES) {
    throw new Error('The nonce is 96 bits — exactly 24 hex digits — and must never be reused with the same key.');
  }
  return bytes;
}

/**
 * The cipher, untraced. Used by the benchmark.
 *
 * There is no `direction`. XOR is its own inverse, so encrypting a ciphertext with
 * the same key, nonce and counter returns the plaintext — and a test asserts it.
 */
export function chacha20(bytes: Uint8Array, options: Options): Uint8Array {
  const stream = keystream(options.key, options.nonce, options.counter, bytes.length);
  return bytes.map((byte, i) => byte ^ (stream[i] ?? 0));
}

/** Text in, hex out. */
export function encryptText(text: string, options: Options): string {
  return toHex(chacha20(new TextEncoder().encode(text), options));
}

/** Hex in, text out. */
export function decryptText(hex: string, options: Options): string {
  const bytes = fromHex(hex.replace(/\s+/g, ''));
  if (bytes === null) {
    throw new Error('A ChaCha20 ciphertext is hexadecimal — two digits per byte.');
  }
  return new TextDecoder().decode(chacha20(bytes, options));
}

/** Where in the original text each 64-byte block's bytes came from. */
export function blockRanges(text: string, blockCount: number): { start: number; end: number }[] {
  const encoder = new TextEncoder();
  const ranges: { start: number; end: number }[] = [];
  let byteAt = 0;
  let charAt = 0;
  for (let b = 0; b < blockCount; b += 1) {
    const start = charAt;
    const limit = (b + 1) * BLOCK_BYTES;
    while (charAt < text.length && byteAt < limit) {
      byteAt += encoder.encode(text.charAt(charAt)).length;
      charAt += 1;
    }
    ranges.push({ start, end: Math.max(start, charAt) });
  }
  return ranges;
}

/** The cipher again, one `Step` per 64-byte keystream block. */
export function chacha20Trace(text: string, options: Options, direction: Direction): TraceResult {
  const input =
    direction === 'encrypt'
      ? new TextEncoder().encode(text)
      : (fromHex(text.replace(/\s+/g, '')) ?? null);

  if (input === null) {
    throw new Error('A ChaCha20 ciphertext is hexadecimal — two digits per byte.');
  }

  const steps: Step[] = [];
  const out = new Uint8Array(input.length);
  const blockCount = Math.max(1, Math.ceil(input.length / BLOCK_BYTES));
  const ranges = direction === 'encrypt' ? blockRanges(text, blockCount) : [];

  for (let b = 0; b * BLOCK_BYTES < input.length || (b === 0 && input.length === 0); b += 1) {
    const counter = options.counter + b;
    const { bytes: stream, trace } = block(options.key, options.nonce, counter);
    const start = b * BLOCK_BYTES;
    const slice = input.slice(start, start + BLOCK_BYTES);
    const result = slice.map((byte, i) => byte ^ (stream[i] ?? 0));
    out.set(result, start);

    steps.push({
      index: b,
      title: `Block ${b + 1}, counter ${counter}`,
      detail: `The keystream for this block is computed from the key, the nonce and the counter ${counter} — and from nothing else. Your message is not an input to it. Twenty rounds of add-XOR-rotate produce 64 pseudorandom bytes, and the ciphertext is the plaintext XORed with them. That is the One-Time Pad's construction with a keystream that is computed rather than shared, which is exactly why it is only as unbreakable as the generator is unpredictable.`,
      output: toHex(result),
      ...(direction === 'encrypt'
        ? { highlight: ranges[b] ?? { start: 0, end: 0 } }
        : { highlight: { start: start * 2, end: (start + slice.length) * 2 } }),
      outputHighlight:
        direction === 'encrypt'
          ? { start: start * 2, end: (start + slice.length) * 2 }
          : { start, end: start + slice.length },
      data: {
        isBlock: true,
        block: b,
        counter,
        keystream: toHex(stream),
        input: toHex(slice),
        output: toHex(result),
        initial: trace.initial,
        rounds: trace.rounds,
        beforeAdd: trace.beforeAdd,
        final: trace.final,
      },
    });

    if (input.length === 0) break;
  }

  return {
    output: direction === 'encrypt' ? toHex(out) : new TextDecoder().decode(out),
    steps,
  };
}
