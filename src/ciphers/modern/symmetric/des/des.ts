/**
 * DES — the Data Encryption Standard, 1977.
 *
 * The first cipher a government ever published in full and asked the world to use.
 * That decision was not obvious in 1977 and it is why modern cryptography is a
 * public discipline: before DES, ciphers were secrets about secrets.
 *
 * DES is a **Feistel network**, and the Feistel construction is the idea worth
 * carrying away. Split the block in half. Each round, compute some function of the
 * right half and the round key, XOR it into the left half, and swap:
 *
 *     L(i) = R(i-1)
 *     R(i) = L(i-1) XOR F(R(i-1), K(i))
 *
 * The remarkable part is that **F does not have to be invertible**. Running the
 * rounds in reverse undoes them whatever F is, because the XOR cancels. So a
 * designer is free to make F as scrambled and irreversible as they like, which is
 * an enormous freedom. AES gave it up and pays for it with a separate inverse for
 * every step; the Visualize tab on the AES page shows what that costs.
 *
 * DES's F does four things: expand 32 bits to 48, XOR the round key, push the
 * result through eight **S-boxes** that each turn 6 bits into 4, and permute. The
 * S-boxes are the only non-linear part and the only thing that makes DES a cipher
 * rather than a system of linear equations.
 *
 * **The key is 64 bits of which only 56 are used** — every eighth bit was a parity
 * check — and 56 bits is what killed it. Nothing here is a flaw in the design; the
 * design has held up unusually well. It is simply too small, and it was arguably
 * too small when it shipped.
 *
 * **Do not use this for anything.** DES is broken by brute force and has been for
 * a quarter of a century. It is here because Feistel networks and S-boxes are the
 * vocabulary of everything that came after.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { fromHex, toHex } from '../../../../lib/format';

export type Direction = 'encrypt' | 'decrypt';
export type Mode = 'ECB' | 'CBC';

export const BLOCK_BYTES = 8;
export const KEY_BYTES = 8;
export const ROUNDS = 16;
/** 64 bits given, 56 used. Every eighth bit was a parity check, and is discarded. */
export const EFFECTIVE_KEY_BITS = 56;

/** Initial permutation. One-based, MSB first, as the standard prints it. */
const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
];

/** Final permutation, the exact inverse of IP. */
const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
];

/** Expansion: 32 bits to 48, by repeating the bits at each end of every group. */
const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11,
  12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21,
  22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
];

/** Permutation after the S-boxes, which spreads each S-box's output. */
const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25,
];

/** Permuted Choice 1: drops the eight parity bits, leaving 56. */
const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
];

/** Permuted Choice 2: picks 48 of the 56 bits for each round key. */
const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4,
  26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40,
  51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
];

const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

/**
 * The eight S-boxes: six bits in, four bits out.
 *
 * The only non-linear part of DES, and the part the NSA quietly changed before
 * publication. That change was suspected for years of being a back door and turned
 * out, when differential cryptanalysis became public knowledge in 1990, to have
 * made DES *stronger* against an attack nobody outside had discovered yet.
 */
const S: readonly (readonly number[])[] = [
  [
    14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
    0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
    4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
    15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13,
  ],
  [
    15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
    3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
    0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
    13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9,
  ],
  [
    10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
    13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
    13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
    1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12,
  ],
  [
    7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
    13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
    10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
    3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14,
  ],
  [
    2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
    14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
    4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
    11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3,
  ],
  [
    12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
    10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
    9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
    4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13,
  ],
  [
    4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
    13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
    1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
    6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12,
  ],
  [
    13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
    1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
    7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
    2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11,
  ],
];

/**
 * Bits, one per array slot.
 *
 * Slower than packing into integers and very much clearer, which is the right
 * trade for a page whose job is to be read. The Benchmark tab measures this
 * representation and the panel already says it measures the traced path.
 */
export type Bits = number[];

export function bytesToBits(bytes: Uint8Array): Bits {
  const bits: Bits = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i -= 1) bits.push((byte >> i) & 1);
  }
  return bits;
}

export function bitsToBytes(bits: Bits): Uint8Array {
  const out = new Uint8Array(bits.length / 8);
  for (let i = 0; i < out.length; i += 1) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | (bits[i * 8 + b] ?? 0);
    out[i] = byte;
  }
  return out;
}

/** Applies a one-based permutation table. Every DES table is one of these. */
export function permute(bits: Bits, table: readonly number[]): Bits {
  return table.map((from) => bits[from - 1] ?? 0);
}

export function xorBits(a: Bits, b: Bits): Bits {
  return a.map((bit, i) => bit ^ (b[i] ?? 0));
}

function rotateLeft(bits: Bits, by: number): Bits {
  return [...bits.slice(by), ...bits.slice(0, by)];
}

export function bitsToHex(bits: Bits): string {
  return toHex(bitsToBytes(bits));
}

/** The sixteen 48-bit round keys. */
export function expandKey(key: Uint8Array): Bits[] {
  const permuted = permute(bytesToBits(key), PC1);
  let left = permuted.slice(0, 28);
  let right = permuted.slice(28);

  const keys: Bits[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    const by = SHIFTS[round] ?? 1;
    left = rotateLeft(left, by);
    right = rotateLeft(right, by);
    keys.push(permute([...left, ...right], PC2));
  }
  return keys;
}

/** What one S-box did, so the visualizer can show all eight. */
export interface SboxTrace {
  box: number;
  input: number;
  row: number;
  column: number;
  output: number;
}

/**
 * The round function: expand, XOR the key, substitute, permute.
 *
 * F is not invertible and does not need to be — that is the Feistel guarantee, and
 * it is what lets the S-boxes be as destructive as they are.
 */
export function feistelF(right: Bits, roundKey: Bits): { out: Bits; expanded: Bits; mixed: Bits; substituted: Bits; boxes: SboxTrace[] } {
  const expanded = permute(right, E);
  const mixed = xorBits(expanded, roundKey);

  const substituted: Bits = [];
  const boxes: SboxTrace[] = [];
  for (let box = 0; box < 8; box += 1) {
    const chunk = mixed.slice(box * 6, box * 6 + 6);
    // Outer two bits pick the row, inner four pick the column. That layout is
    // why the expansion repeats the edge bits: adjacent S-boxes share them.
    const row = ((chunk[0] ?? 0) << 1) | (chunk[5] ?? 0);
    const column =
      ((chunk[1] ?? 0) << 3) | ((chunk[2] ?? 0) << 2) | ((chunk[3] ?? 0) << 1) | (chunk[4] ?? 0);
    const value = S[box]?.[row * 16 + column] ?? 0;
    for (let i = 3; i >= 0; i -= 1) substituted.push((value >> i) & 1);
    boxes.push({
      box: box + 1,
      input: chunk.reduce((n, bit) => (n << 1) | bit, 0),
      row,
      column,
      output: value,
    });
  }

  return { out: permute(substituted, P), expanded, mixed, substituted, boxes };
}

/** What one Feistel round did. */
export interface RoundTrace {
  round: number;
  left: Bits;
  right: Bits;
  roundKey: Bits;
  expanded: Bits;
  mixed: Bits;
  substituted: Bits;
  fOut: Bits;
  newLeft: Bits;
  newRight: Bits;
  boxes: SboxTrace[];
}

/** One block through sixteen rounds. Decryption is the same, keys reversed. */
export function processBlock(block: Uint8Array, keys: Bits[], direction: Direction): { out: Uint8Array; trace: RoundTrace[] } {
  const schedule = direction === 'encrypt' ? keys : [...keys].reverse();
  const permuted = permute(bytesToBits(block), IP);
  let left = permuted.slice(0, 32);
  let right = permuted.slice(32);
  const trace: RoundTrace[] = [];

  for (let round = 0; round < ROUNDS; round += 1) {
    const roundKey = schedule[round] ?? [];
    const f = feistelF(right, roundKey);
    const newRight = xorBits(left, f.out);
    trace.push({
      round: round + 1,
      left,
      right,
      roundKey,
      expanded: f.expanded,
      mixed: f.mixed,
      substituted: f.substituted,
      fOut: f.out,
      newLeft: right,
      newRight,
      boxes: f.boxes,
    });
    left = right;
    right = newRight;
  }

  // The halves are swapped once at the end, which is what makes the whole
  // sixteen-round structure its own inverse under a reversed key schedule.
  return { out: bitsToBytes(permute([...right, ...left], FP)), trace };
}

/** PKCS#7 over eight-byte blocks. */
export function pad(bytes: Uint8Array): Uint8Array {
  const extra = BLOCK_BYTES - (bytes.length % BLOCK_BYTES);
  const out = new Uint8Array(bytes.length + extra);
  out.set(bytes);
  out.fill(extra, bytes.length);
  return out;
}

export function unpad(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length === 0 || bytes.length % BLOCK_BYTES !== 0) return null;
  const extra = bytes[bytes.length - 1] ?? 0;
  if (extra < 1 || extra > BLOCK_BYTES || extra > bytes.length) return null;
  for (let i = bytes.length - extra; i < bytes.length; i += 1) {
    if (bytes[i] !== extra) return null;
  }
  return bytes.slice(0, bytes.length - extra);
}

export function blocksOf(bytes: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += BLOCK_BYTES) out.push(bytes.slice(i, i + BLOCK_BYTES));
  return out;
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  return a.map((byte, i) => byte ^ (b[i] ?? 0));
}

export interface Options {
  key: Uint8Array;
  mode: Mode;
  iv: Uint8Array;
}

export function readKey(hex: string): Uint8Array {
  const bytes = fromHex(hex.replace(/\s+/g, ''));
  if (bytes === null) {
    throw new Error('The key must be hexadecimal: the digits 0-9 and a-f, two per byte.');
  }
  if (bytes.length !== KEY_BYTES) {
    throw new Error(
      `A DES key is 64 bits — exactly 16 hex digits. This one is ${bytes.length * 8} bits. Only 56 of the 64 are used; every eighth bit was a parity check.`,
    );
  }
  return bytes;
}

export function readIv(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  if (cleaned === '') return new Uint8Array(BLOCK_BYTES);
  const bytes = fromHex(cleaned);
  if (bytes === null || bytes.length !== BLOCK_BYTES) {
    throw new Error('The IV must be exactly 16 hex digits — 8 bytes, one block.');
  }
  return bytes;
}

/** The cipher over a whole message, untraced. Used by the benchmark. */
export function des(text: string, options: Options, direction: Direction): string {
  const keys = expandKey(options.key);

  if (direction === 'encrypt') {
    const padded = pad(new TextEncoder().encode(text));
    let previous = options.iv;
    let out = '';
    for (const block of blocksOf(padded)) {
      const input = options.mode === 'CBC' ? xor(block, previous) : block;
      const { out: cipher } = processBlock(input, keys, 'encrypt');
      previous = cipher;
      out += toHex(cipher);
    }
    return out;
  }

  const bytes = fromHex(text.replace(/\s+/g, ''));
  if (bytes === null || bytes.length === 0 || bytes.length % BLOCK_BYTES !== 0) {
    throw new Error(
      'A ciphertext is a whole number of 8-byte blocks written in hex — 16 hex digits per block.',
    );
  }

  let previous = options.iv;
  const plain = new Uint8Array(bytes.length);
  blocksOf(bytes).forEach((block, i) => {
    const { out } = processBlock(block, keys, 'decrypt');
    const result = options.mode === 'CBC' ? xor(out, previous) : out;
    previous = block;
    plain.set(result, i * BLOCK_BYTES);
  });

  const stripped = unpad(plain);
  if (stripped === null) {
    throw new Error('The padding is not valid, which almost always means the key or the mode is wrong.');
  }
  return new TextDecoder().decode(stripped);
}

/** Where in the original text each block's bytes came from. */
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

/** The cipher again, one `Step` per block, with all sixteen rounds in `data`. */
export function desTrace(text: string, options: Options, direction: Direction): TraceResult {
  const keys = expandKey(options.key);
  const steps: Step[] = [];

  const asData = (trace: RoundTrace[]) =>
    trace.map((round) => ({
      round: round.round,
      left: bitsToHex(round.left),
      right: bitsToHex(round.right),
      roundKey: round.roundKey.join(''),
      expanded: round.expanded.join(''),
      mixed: round.mixed.join(''),
      substituted: bitsToHex(round.substituted),
      fOut: bitsToHex(round.fOut),
      newLeft: bitsToHex(round.newLeft),
      newRight: bitsToHex(round.newRight),
      boxes: round.boxes,
    }));

  if (direction === 'encrypt') {
    const padded = pad(new TextEncoder().encode(text));
    const blocks = blocksOf(padded);
    const ranges = blockRanges(text, blocks.length);
    let previous = options.iv;
    let output = '';

    blocks.forEach((block, i) => {
      const chained = options.mode === 'CBC' ? xor(block, previous) : block;
      const { out, trace } = processBlock(chained, keys, 'encrypt');
      const at = output.length;
      output += toHex(out);
      previous = out;

      steps.push({
        index: i,
        title: `Block ${i + 1} → ${toHex(out)}`,
        detail: `Sixteen Feistel rounds. Each one takes the right half, runs it through F with this round's 48-bit key, XORs the result into the left half, and swaps. F is not invertible and does not need to be — reversing the key schedule undoes the whole thing regardless, which is the guarantee Feistel gives and the reason DES could afford eight S-boxes that destroy information.`,
        output: toHex(out),
        highlight: ranges[i] ?? { start: 0, end: 0 },
        outputHighlight: { start: at, end: at + BLOCK_BYTES * 2 },
        data: {
          isBlock: true,
          block: i,
          mode: options.mode,
          input: toHex(block),
          chained: toHex(chained),
          cipher: toHex(out),
          trace: asData(trace),
        },
      });
    });

    return { output, steps };
  }

  const bytes = fromHex(text.replace(/\s+/g, ''));
  if (bytes === null || bytes.length === 0 || bytes.length % BLOCK_BYTES !== 0) {
    throw new Error(
      'A ciphertext is a whole number of 8-byte blocks written in hex — 16 hex digits per block.',
    );
  }

  let previous = options.iv;
  const plain = new Uint8Array(bytes.length);

  blocksOf(bytes).forEach((block, i) => {
    const { out, trace } = processBlock(block, keys, 'decrypt');
    const result = options.mode === 'CBC' ? xor(out, previous) : out;
    previous = block;
    plain.set(result, i * BLOCK_BYTES);

    steps.push({
      index: i,
      title: `Block ${i + 1} → ${toHex(result)}`,
      detail: `The same sixteen rounds, with the key schedule reversed. Nothing else changes — no inverse S-boxes, no inverse permutation inside the round — because a Feistel network is its own inverse when the keys are applied backwards.`,
      output: toHex(result),
      highlight: { start: i * BLOCK_BYTES * 2, end: (i + 1) * BLOCK_BYTES * 2 },
      data: {
        isBlock: true,
        block: i,
        mode: options.mode,
        input: toHex(block),
        cipher: toHex(result),
        trace: asData(trace),
      },
    });
  });

  const stripped = unpad(plain);
  if (stripped === null) {
    throw new Error('The padding is not valid, which almost always means the key or the mode is wrong.');
  }

  return { output: new TextDecoder().decode(stripped), steps };
}
