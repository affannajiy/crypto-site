/**
 * SHA-1, written out.
 *
 * **Do not use this for anything real.** SHA-1 is broken: a collision was
 * published in 2017 and a chosen-prefix collision in 2019. It is here because it
 * sits exactly between [MD5](#/cipher/md5) and [SHA-256](#/cipher/sha-256) and
 * shows what was added each time, including one rotation that turned out to be
 * the difference between SHA-0 and SHA-1.
 *
 * `expandRotate` is a parameter here rather than a constant, and that is the
 * point of the file: passing 0 gives SHA-0, the withdrawn 1993 version, and
 * passing 1 gives SHA-1. Same eighty rounds, same constants, one rotate-left-one
 * in the message schedule. The Visualize tab runs both.
 *
 * Plain TypeScript. No React, no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { utf8Bytes } from '../../../../lib/bytes';

const H0: readonly number[] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

/**
 * One constant per twenty rounds. These are √2, √3, √5 and √10 scaled — four
 * numbers rather than SHA-256's sixty-four, which is one measure of how much
 * less there is to SHA-1.
 */
export const STAGE_K: readonly number[] = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];

export const STAGES = [
  { from: 0, to: 19, name: 'Ch', formula: '(b AND c) OR (NOT b AND d)' },
  { from: 20, to: 39, name: 'Parity', formula: 'b XOR c XOR d' },
  { from: 40, to: 59, name: 'Maj', formula: '(b AND c) OR (b AND d) OR (c AND d)' },
  { from: 60, to: 79, name: 'Parity', formula: 'b XOR c XOR d' },
] as const;

const rotl = (x: number, n: number) => (n === 0 ? x >>> 0 : ((x << n) | (x >>> (32 - n))) >>> 0);
const add = (...xs: number[]) => xs.reduce((a, b) => (a + b) >>> 0, 0) >>> 0;

export const hex32 = (word: number) => (word >>> 0).toString(16).padStart(8, '0');

export function stageOf(round: number): number {
  return Math.min(3, Math.floor(round / 20));
}

function mix(round: number, b: number, c: number, d: number): number {
  if (round < 20) return ((b & c) | (~b & d)) >>> 0;
  if (round < 40) return (b ^ c ^ d) >>> 0;
  if (round < 60) return ((b & c) | (b & d) | (c & d)) >>> 0;
  return (b ^ c ^ d) >>> 0;
}

/** A 1 bit, zeros, then the bit length big-endian. Same as SHA-256's. */
export function pad(bytes: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  new DataView(padded.buffer).setBigUint64(padded.length - 8, BigInt(bytes.length) * 8n, false);
  return padded;
}

interface RoundInfo {
  block: number;
  round: number;
  w: number;
  state: number[];
}

function digestWords(
  padded: Uint8Array,
  expandRotate: 0 | 1,
  onRound?: (r: RoundInfo) => void,
): number[] {
  const h = [...H0];
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);

  for (let block = 0; block < padded.length / 64; block += 1) {
    const w = new Array<number>(80);
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(block * 64 + t * 4, false);
    for (let t = 16; t < 80; t += 1) {
      // The whole of SHA-0 versus SHA-1 is the rotation on this line. Without it
      // a difference in one word can travel down the schedule without spreading
      // sideways, and that is what the 1998 attack on SHA-0 exploited.
      const mixed = ((w[t - 3] ?? 0) ^ (w[t - 8] ?? 0) ^ (w[t - 14] ?? 0) ^ (w[t - 16] ?? 0)) >>> 0;
      w[t] = rotl(mixed, expandRotate);
    }

    let [a, b, c, d, e] = h as [number, number, number, number, number];
    for (let t = 0; t < 80; t += 1) {
      const temp = add(rotl(a, 5), mix(t, b, c, d), e, STAGE_K[stageOf(t)] ?? 0, w[t] ?? 0);
      [a, b, c, d, e] = [temp, a, rotl(b, 30), c, d];
      onRound?.({ block, round: t, w: w[t] ?? 0, state: [a, b, c, d, e] });
    }

    const out = [a, b, c, d, e];
    for (let i = 0; i < 5; i += 1) h[i] = add(h[i] ?? 0, out[i] ?? 0);
  }

  return h;
}

/** The digest as lowercase hex. The fast path, no steps allocated. */
export function sha1(text: string, expandRotate: 0 | 1 = 1): string {
  return digestWords(pad(utf8Bytes(text)), expandRotate).map(hex32).join('');
}

/** SHA-0: the 1993 publication, withdrawn two years later over this one rotation. */
export const sha0 = (text: string) => sha1(text, 0);

const LETTERS = ['a', 'b', 'c', 'd', 'e'];

/** The digest, and every one of the eighty rounds per block. */
export function sha1Trace(text: string): TraceResult {
  const bytes = utf8Bytes(text);
  const padded = pad(bytes);
  const steps: Step[] = [];

  steps.push({
    index: 0,
    title: `Pad ${bytes.length} ${bytes.length === 1 ? 'byte' : 'bytes'} to ${padded.length}`,
    detail:
      `${bytes.length} bytes (${bytes.length * 8} bits) of UTF-8, a 1 bit, zeros, then the length ` +
      `as a 64-bit big-endian number — ${padded.length} bytes in ${padded.length / 64} ` +
      `block${padded.length === 64 ? '' : 's'}. Sixteen words per block are expanded to eighty.`,
    data: { padded: [...padded], messageLength: bytes.length, message: text },
  });

  const words = digestWords(padded, 1, (r) => {
    const stage = STAGES[stageOf(r.round)];
    const state = r.state.map((word, i) => `${LETTERS[i]}=${hex32(word)}`).join(' ');
    steps.push({
      index: steps.length,
      title: `Block ${r.block + 1}, round ${r.round + 1} of 80 (${stage?.name ?? '?'})`,
      detail:
        `W[${r.round}] = ${hex32(r.w)}, K = ${hex32(STAGE_K[stageOf(r.round)] ?? 0)}. ` +
        `temp = rotl(a,5) + ${stage?.name ?? '?'}(b,c,d) + e + K + W. Then b is rotated left 30 ` +
        `and everything shifts along. State: ${state}.`,
      data: { state: r.state, round: r.round, block: r.block, stage: stageOf(r.round) },
    });
  });

  const digest = words.map(hex32).join('');
  steps.push({
    index: steps.length,
    title: 'Add the block result to the running hash',
    detail:
      `The five words are added to what this block started from, and that addition is the ` +
      `irreversible step. Digest: ${digest}. 160 bits — more than MD5's 128, and still not ` +
      `enough: a collision was found in 2017.`,
    data: { digest },
  });

  return { output: digest, steps };
}
