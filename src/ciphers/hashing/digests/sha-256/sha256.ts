/**
 * SHA-256, written out.
 *
 * **Do not use this for anything real.** It is written for legibility: the state
 * is eight named 32-bit words updated one round at a time, and every round is
 * recorded. A production implementation would not allocate a `Step` per round,
 * and a hash you actually depend on should come from `crypto.subtle.digest`.
 *
 * `crypto.subtle` was the obvious choice here and is the wrong one for this app
 * for the same reason it was wrong for AES: it returns a digest and nothing
 * else. It cannot show a round, and the rounds are the entire reason this page
 * exists. The safeguard is cross-checking instead of trust — `sha256.test.ts`
 * runs the FIPS 180-4 vectors *and* compares against `crypto.subtle.digest` on
 * random inputs.
 *
 * Plain TypeScript. No React, no DOM.
 */
import type { Step, TraceResult } from '../../../types';

/**
 * The first thirty-two bits of the fractional parts of the cube roots of the
 * first sixty-four primes. Nothing-up-my-sleeve numbers: they are here to be
 * arbitrary, and being derived from primes is how you can check that nobody
 * chose them for a reason they did not disclose.
 */
export const K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** Fractional parts of the square roots of the first eight primes. */
const H0: readonly number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;
const shr = (x: number, n: number) => x >>> n;

const bigSigma0 = (x: number) => (rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22)) >>> 0;
const bigSigma1 = (x: number) => (rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25)) >>> 0;
const smallSigma0 = (x: number) => (rotr(x, 7) ^ rotr(x, 18) ^ shr(x, 3)) >>> 0;
const smallSigma1 = (x: number) => (rotr(x, 17) ^ rotr(x, 19) ^ shr(x, 10)) >>> 0;

/** Choose: for each bit, e picks between f and g. */
const ch = (e: number, f: number, g: number) => ((e & f) ^ (~e & g)) >>> 0;
/** Majority: for each bit, whichever value two of the three agree on. */
const maj = (a: number, b: number, c: number) => ((a & b) ^ (a & c) ^ (b & c)) >>> 0;

export const hex32 = (word: number) => (word >>> 0).toString(16).padStart(8, '0');

/** UTF-8 bytes of a string. What actually gets hashed, rather than characters. */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * The padded message: the bytes, a single 1 bit, zeros, and the original length
 * in bits as a 64-bit big-endian integer.
 *
 * The length at the end is not decoration. Without it, "abc" and "abc" followed
 * by padding would hash identically, and appending to a message would be free.
 */
export function pad(bytes: Uint8Array): Uint8Array {
  const bitLength = BigInt(bytes.length) * 8n;
  // At least one byte for the 0x80, then zeros up to 56 mod 64, then eight bytes.
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setBigUint64(padded.length - 8, bitLength, false);
  return padded;
}

/**
 * The digest of raw bytes, as bytes.
 *
 * Exported for PBKDF2, which is defined as HMAC-SHA-256 run over and over and
 * needs to hash things that are not text — a salt, a counter, a previous digest.
 * A cross-cipher import rather than a second copy of SHA-256: if the two ever
 * disagreed, one of them would be wrong and nobody would find out.
 */
export function sha256Bytes(bytes: Uint8Array): Uint8Array {
  const words = digestWords(pad(bytes));
  const out = new Uint8Array(32);
  const view = new DataView(out.buffer);
  words.forEach((word, i) => view.setUint32(i * 4, word, false));
  return out;
}

/** The digest as lowercase hex. The fast path, with no steps allocated. */
export function sha256(text: string): string {
  return digestWords(pad(utf8Bytes(text)))
    .map(hex32)
    .join('');
}

function digestWords(padded: Uint8Array, onRound?: (round: RoundInfo) => void): number[] {
  const h = [...H0];
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  const blocks = padded.length / 64;

  for (let block = 0; block < blocks; block += 1) {
    // The message schedule: sixteen words from the block, then forty-eight more
    // mixed from the ones before them. This is why changing one input bit
    // reaches every round rather than only the round it landed in.
    const w = new Array<number>(64);
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(block * 64 + t * 4, false);
    for (let t = 16; t < 64; t += 1) {
      w[t] =
        (smallSigma1(w[t - 2] ?? 0) + (w[t - 7] ?? 0) + smallSigma0(w[t - 15] ?? 0) + (w[t - 16] ?? 0)) >>>
        0;
    }

    let [a, b, c, d, e, f, g, hh] = h as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];

    for (let t = 0; t < 64; t += 1) {
      const t1 = (hh + bigSigma1(e) + ch(e, f, g) + (K[t] ?? 0) + (w[t] ?? 0)) >>> 0;
      const t2 = (bigSigma0(a) + maj(a, b, c)) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
      onRound?.({ block, round: t, w: w[t] ?? 0, k: K[t] ?? 0, t1, t2, state: [a, b, c, d, e, f, g, hh] });
    }

    // Adding the block's result to what came in is what makes this one-way: the
    // round function itself is reversible, and this addition is what throws the
    // information away.
    const next = [a, b, c, d, e, f, g, hh];
    for (let i = 0; i < 8; i += 1) h[i] = ((h[i] ?? 0) + (next[i] ?? 0)) >>> 0;
  }

  return h;
}

interface RoundInfo {
  block: number;
  round: number;
  w: number;
  k: number;
  t1: number;
  t2: number;
  state: number[];
}

/** How many rounds to record. Sixty-four per block, and every block is shown. */
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * The digest, and every round that produced it.
 *
 * There is one step per compression round, plus one at the start for the padding
 * — which is where the reader can see the length being written into the tail,
 * and the reason two different messages cannot share a padded block.
 */
export function sha256Trace(text: string): TraceResult {
  const bytes = utf8Bytes(text);
  const padded = pad(bytes);
  const steps: Step[] = [];

  steps.push({
    index: 0,
    title: `Pad ${bytes.length} ${bytes.length === 1 ? 'byte' : 'bytes'} to ${padded.length}`,
    detail:
      `The message is ${bytes.length} bytes (${bytes.length * 8} bits) of UTF-8. Append one 1 bit, ` +
      `then zeros, then the original length as a 64-bit big-endian number — so ${padded.length} bytes ` +
      `in ${padded.length / 64} block${padded.length === 64 ? '' : 's'}. The length at the end is what ` +
      `stops a shorter message and its own padding from colliding.`,
    data: { padded: [...padded], messageLength: bytes.length },
  });

  const words = digestWords(padded, (round) => {
    const state = round.state.map((word, i) => `${LETTERS[i]}=${hex32(word)}`).join(' ');
    steps.push({
      index: steps.length,
      title: `Block ${round.block + 1}, round ${round.round + 1} of 64`,
      detail:
        `W[${round.round}] = ${hex32(round.w)}, K[${round.round}] = ${hex32(round.k)}. ` +
        `T1 = h + Σ1(e) + Ch(e,f,g) + K + W = ${hex32(round.t1)}, T2 = Σ0(a) + Maj(a,b,c) = ${hex32(round.t2)}. ` +
        `Then the eight words shift along, e picks up d + T1 and a becomes T1 + T2. ` +
        `New state: ${state}.`,
      data: { state: round.state, round: round.round, block: round.block },
    });
  });

  const digest = words.map(hex32).join('');
  steps.push({
    index: steps.length,
    title: 'Add the block result to the running hash',
    detail:
      `The eight words are added to the values this block started from, and that addition is where ` +
      `the information goes. Every round up to here is reversible; this is not. Digest: ${digest}.`,
    data: { digest },
  });

  return { output: digest, steps };
}
