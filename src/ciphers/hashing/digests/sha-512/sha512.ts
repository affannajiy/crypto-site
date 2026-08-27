/**
 * SHA-512, written out.
 *
 * **Do not use this for anything real.** Same warning as every hand-written
 * algorithm here: it is written for legibility, and a digest you depend on should
 * come from `crypto.subtle.digest`. There is no known practical attack on SHA-512
 * itself, which makes the warning about this file rather than about the design.
 *
 * It is SHA-256 with everything widened. Sixty-four-bit words instead of
 * thirty-two, eighty rounds instead of sixty-four, 128-byte blocks instead of 64,
 * a 128-bit length field instead of 64, and different rotation amounts. The
 * structure is identical, which is why reading this after `sha-256/sha256.ts` is
 * mostly an exercise in noticing what a "wider" hash actually means.
 *
 * JavaScript has no 64-bit integer type, so the state is `bigint` and every
 * operation masks back to 64 bits. That is legible and slow — the Benchmark tab
 * shows SHA-512 running *slower* than SHA-256 here, which is the reverse of what
 * happens on a real 64-bit CPU. The explainer says so.
 *
 * Plain TypeScript. No React, no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { utf8Bytes } from '../../../../lib/bytes';

const MASK = (1n << 64n) - 1n;

/** Integer nth root of a BigInt, by Newton's method. Exact, no floats. */
function iroot(value: bigint, n: bigint): bigint {
  if (value < 2n) return value;
  let x = 1n << (BigInt(value.toString(2).length) / n + 1n);
  for (;;) {
    const next = ((n - 1n) * x + value / x ** (n - 1n)) / n;
    if (next >= x) return x;
    x = next;
  }
}

/** The first `count` primes. Small and slow and run once at module load. */
function primes(count: number): bigint[] {
  const found: bigint[] = [];
  for (let n = 2; found.length < count; n += 1) {
    if (found.every((p) => n % Number(p) !== 0)) found.push(BigInt(n));
  }
  return found;
}

/**
 * The first sixty-four bits of the fractional part of the nth root of a prime.
 *
 * SHA-512's eighty constants are usually pasted in as eighty 16-digit hex
 * literals that nobody checks. Computing them instead makes the
 * nothing-up-my-sleeve claim something a reader can verify by reading ten lines,
 * which is the entire reason the claim is made — and `sha512.test.ts` pins the
 * first and last against the published values in case this arithmetic drifts.
 */
function fractionalRoot(prime: bigint, n: bigint): bigint {
  // floor(prime^(1/n) * 2^64), then drop the integer part.
  return iroot(prime << (64n * n), n) & MASK;
}

const PRIMES = primes(80);

/** Cube roots of the first eighty primes. */
export const K: readonly bigint[] = PRIMES.map((p) => fractionalRoot(p, 3n));

/** Square roots of the first eight primes. */
const H0: readonly bigint[] = PRIMES.slice(0, 8).map((p) => fractionalRoot(p, 2n));

const rotr = (x: bigint, n: bigint) => ((x >> n) | (x << (64n - n))) & MASK;
const shr = (x: bigint, n: bigint) => x >> n;
const add = (...xs: bigint[]) => xs.reduce((a, b) => (a + b) & MASK, 0n);

// The rotation amounts are the only arithmetic difference from SHA-256, and they
// are not scaled versions of SHA-256's — they were chosen for the wider word.
const bigSigma0 = (x: bigint) => rotr(x, 28n) ^ rotr(x, 34n) ^ rotr(x, 39n);
const bigSigma1 = (x: bigint) => rotr(x, 14n) ^ rotr(x, 18n) ^ rotr(x, 41n);
const smallSigma0 = (x: bigint) => rotr(x, 1n) ^ rotr(x, 8n) ^ shr(x, 7n);
const smallSigma1 = (x: bigint) => rotr(x, 19n) ^ rotr(x, 61n) ^ shr(x, 6n);

const ch = (e: bigint, f: bigint, g: bigint) => (e & f) ^ (~e & MASK & g);
const maj = (a: bigint, b: bigint, c: bigint) => (a & b) ^ (a & c) ^ (b & c);

export const hex64 = (word: bigint) => (word & MASK).toString(16).padStart(16, '0');

export const BLOCK_BYTES = 128;
export const ROUNDS = 80;

/**
 * A 1 bit, zeros to 112 mod 128, then the bit length as a **128-bit** big-endian
 * number.
 *
 * The length field is twice SHA-256's, which is what lets SHA-512 hash a message
 * longer than 2^64 bits. Nobody has such a message. It is there because widening
 * everything else and leaving the counter alone would have been the odd choice.
 */
export function pad(bytes: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil((bytes.length + 17) / BLOCK_BYTES) * BLOCK_BYTES);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = BigInt(bytes.length) * 8n;
  view.setBigUint64(padded.length - 16, bits >> 64n, false);
  view.setBigUint64(padded.length - 8, bits & MASK, false);
  return padded;
}

interface RoundInfo {
  block: number;
  round: number;
  w: bigint;
  k: bigint;
  state: bigint[];
}

function digestWords(padded: Uint8Array, onRound?: (r: RoundInfo) => void): bigint[] {
  const h = [...H0];
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);

  for (let block = 0; block < padded.length / BLOCK_BYTES; block += 1) {
    const w = new Array<bigint>(ROUNDS);
    for (let t = 0; t < 16; t += 1) w[t] = view.getBigUint64(block * BLOCK_BYTES + t * 8, false);
    for (let t = 16; t < ROUNDS; t += 1) {
      w[t] = add(smallSigma1(w[t - 2] ?? 0n), w[t - 7] ?? 0n, smallSigma0(w[t - 15] ?? 0n), w[t - 16] ?? 0n);
    }

    let [a, b, c, d, e, f, g, hh] = h as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

    for (let t = 0; t < ROUNDS; t += 1) {
      const t1 = add(hh, bigSigma1(e), ch(e, f, g), K[t] ?? 0n, w[t] ?? 0n);
      const t2 = add(bigSigma0(a), maj(a, b, c));
      hh = g;
      g = f;
      f = e;
      e = add(d, t1);
      d = c;
      c = b;
      b = a;
      a = add(t1, t2);
      onRound?.({ block, round: t, w: w[t] ?? 0n, k: K[t] ?? 0n, state: [a, b, c, d, e, f, g, hh] });
    }

    const next = [a, b, c, d, e, f, g, hh];
    for (let i = 0; i < 8; i += 1) h[i] = add(h[i] ?? 0n, next[i] ?? 0n);
  }

  return h;
}

/** The digest as lowercase hex. The fast path, no steps allocated. */
export function sha512(text: string): string {
  return digestWords(pad(utf8Bytes(text))).map(hex64).join('');
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** The digest, and every one of the eighty rounds per block. */
export function sha512Trace(text: string): TraceResult {
  const bytes = utf8Bytes(text);
  const padded = pad(bytes);
  const steps: Step[] = [];

  steps.push({
    index: 0,
    title: `Pad ${bytes.length} ${bytes.length === 1 ? 'byte' : 'bytes'} to ${padded.length}`,
    detail:
      `${bytes.length} bytes (${bytes.length * 8} bits) of UTF-8, a 1 bit, zeros, then the length ` +
      `as a 128-bit big-endian number — ${padded.length} bytes in ${padded.length / BLOCK_BYTES} ` +
      `block${padded.length === BLOCK_BYTES ? '' : 's'} of 128. Everything here is twice the ` +
      `width of SHA-256, including the counter that records how long the message was.`,
    data: { padded: [...padded], messageLength: bytes.length, message: text },
  });

  const words = digestWords(padded, (r) => {
    const state = r.state.map((word, i) => `${LETTERS[i]}=${hex64(word)}`).join(' ');
    steps.push({
      index: steps.length,
      title: `Block ${r.block + 1}, round ${r.round + 1} of ${ROUNDS}`,
      detail:
        `W[${r.round}] = ${hex64(r.w)}, K[${r.round}] = ${hex64(r.k)}. Same T1 and T2 as SHA-256, ` +
        `over 64-bit words and with rotations of 28/34/39 and 14/18/41 instead of 2/13/22 and ` +
        `6/11/25. State: ${state}.`,
      data: { state: r.state.map(hex64), round: r.round, block: r.block },
    });
  });

  const digest = words.map(hex64).join('');
  steps.push({
    index: steps.length,
    title: 'Add the block result to the running hash',
    detail:
      `The eight 64-bit words are added to what this block started from — the one step that ` +
      `cannot be undone. Digest: ${digest}. 512 bits, which is not "twice as secure" as SHA-256 ` +
      `so much as far past the point where the number matters.`,
    data: { digest },
  });

  return { output: digest, steps };
}
