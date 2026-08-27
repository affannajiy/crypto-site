/**
 * MD5, written out.
 *
 * **Do not use this for anything real**, and here the warning is not the usual
 * one about constant-time table lookups. MD5 itself is broken: collisions are
 * found in seconds on a laptop, and the Visualize tab shows two different inputs
 * with the same digest. Nothing about how carefully this file is written can fix
 * that.
 *
 * The structure is deliberately the same shape as `sha-256/sha256.ts` — pad,
 * split into 64-byte blocks, run rounds over a small state, add the result back
 * in — because the point of having both pages is that they are the same design
 * and only one of them survived.
 *
 * One difference matters and is easy to miss: MD5 is **little-endian** where
 * SHA-2 is big-endian, in both the message words and the final digest. That is
 * the bug everyone writes first.
 *
 * Plain TypeScript. No React, no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { bytesToHex, utf8Bytes } from '../../../../lib/bytes';

/** Per-round left rotations, four rounds of four repeating shifts. */
const SHIFTS: readonly number[] = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

/**
 * K[i] = floor(2^32 * abs(sin(i + 1))).
 *
 * Computed rather than pasted, so the "nothing up my sleeve" claim can be
 * checked by reading four lines instead of trusting sixty-four constants.
 */
export const K: readonly number[] = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32),
);

const A0 = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;
const add = (...xs: number[]) => xs.reduce((a, b) => (a + b) >>> 0, 0) >>> 0;

export const hex32 = (word: number) => (word >>> 0).toString(16).padStart(8, '0');

/** Which non-linear function and which message word each round uses. */
export function roundMix(i: number, b: number, c: number, d: number): { f: number; g: number; name: string } {
  if (i < 16) return { f: ((b & c) | (~b & d)) >>> 0, g: i, name: 'F' };
  if (i < 32) return { f: ((d & b) | (~d & c)) >>> 0, g: (5 * i + 1) % 16, name: 'G' };
  if (i < 48) return { f: (b ^ c ^ d) >>> 0, g: (3 * i + 5) % 16, name: 'H' };
  return { f: (c ^ (b | ~d)) >>> 0, g: (7 * i) % 16, name: 'I' };
}

/**
 * Padding: a 1 bit, zeros to 56 mod 64, then the bit length little-endian.
 *
 * Identical to SHA-256's padding except for that last word's byte order, which
 * is the whole of the difference and none of the reason MD5 fell.
 */
export function pad(bytes: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  new DataView(padded.buffer).setBigUint64(padded.length - 8, BigInt(bytes.length) * 8n, true);
  return padded;
}

interface RoundInfo {
  block: number;
  round: number;
  name: string;
  g: number;
  w: number;
  state: number[];
}

function digestWords(padded: Uint8Array, onRound?: (r: RoundInfo) => void): number[] {
  const h = [...A0];
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);

  for (let block = 0; block < padded.length / 64; block += 1) {
    // Little-endian, unlike SHA-2. Getting this backwards produces a perfectly
    // plausible-looking hash that matches nothing.
    const m = Array.from({ length: 16 }, (_, t) => view.getUint32(block * 64 + t * 4, true));

    let [a, b, c, d] = h as [number, number, number, number];

    for (let i = 0; i < 64; i += 1) {
      const { f, g, name } = roundMix(i, b, c, d);
      const rotated = rotl(add(a, f, K[i] ?? 0, m[g] ?? 0), SHIFTS[i] ?? 0);
      const next = add(b, rotated);
      [a, b, c, d] = [d, next, b, c];
      onRound?.({ block, round: i, name, g, w: m[g] ?? 0, state: [a, b, c, d] });
    }

    // Same one-way step as SHA-256, and worth noticing: MD5 did not fall here.
    // It fell because 128 bits is small and because the round function does not
    // diffuse a difference fast enough to stop one being steered.
    const out = [a, b, c, d];
    for (let i = 0; i < 4; i += 1) h[i] = add(h[i] ?? 0, out[i] ?? 0);
  }

  return h;
}

/** The digest as lowercase hex, from bytes. The fast path, no steps allocated. */
export function md5Bytes(bytes: Uint8Array): string {
  const words = digestWords(pad(bytes));
  const out = new Uint8Array(16);
  words.forEach((word, i) => new DataView(out.buffer).setUint32(i * 4, word, true));
  return bytesToHex(out);
}

export function md5(text: string): string {
  return md5Bytes(utf8Bytes(text));
}

const LETTERS = ['a', 'b', 'c', 'd'];

/** The digest, and every one of the sixty-four rounds that produced it. */
export function md5Trace(text: string): TraceResult {
  const bytes = utf8Bytes(text);
  const padded = pad(bytes);
  const steps: Step[] = [];

  steps.push({
    index: 0,
    title: `Pad ${bytes.length} ${bytes.length === 1 ? 'byte' : 'bytes'} to ${padded.length}`,
    detail:
      `${bytes.length} bytes (${bytes.length * 8} bits) of UTF-8, then a 1 bit, then zeros, then ` +
      `the original length as a 64-bit little-endian number — ${padded.length} bytes in ` +
      `${padded.length / 64} block${padded.length === 64 ? '' : 's'}. MD5 reads its words ` +
      `little-endian throughout, which is the only structural difference from SHA-256 here.`,
    data: { padded: [...padded], messageLength: bytes.length },
  });

  const words = digestWords(padded, (r) => {
    const state = r.state.map((word, i) => `${LETTERS[i]}=${hex32(word)}`).join(' ');
    steps.push({
      index: steps.length,
      title: `Block ${r.block + 1}, round ${r.round + 1} of 64 (${r.name})`,
      detail:
        `Round function ${r.name}, message word M[${r.g}] = ${hex32(r.w)}, rotate left ` +
        `${SHIFTS[r.round] ?? 0}. The four words shift along and b takes the new value. ` +
        `State: ${state}.`,
      data: { state: r.state, round: r.round, block: r.block, fn: r.name },
    });
  });

  const out = new Uint8Array(16);
  words.forEach((word, i) => new DataView(out.buffer).setUint32(i * 4, word, true));
  const digest = bytesToHex(out);

  steps.push({
    index: steps.length,
    title: 'Add the block result in, and write it out little-endian',
    detail:
      `The four words are added to what this block started from, and written least significant ` +
      `byte first. Digest: ${digest}. It is 128 bits, which is half of SHA-256 and a quarter of ` +
      `what a birthday attack would need to be out of reach.`,
    data: { digest },
  });

  return { output: digest, steps };
}
