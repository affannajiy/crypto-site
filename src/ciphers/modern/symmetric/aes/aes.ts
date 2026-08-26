/**
 * AES — Rijndael, FIPS-197, 2001.
 *
 * **Why this is hand-written and not WebCrypto.**
 *
 * Every other modern primitive on this site should use the browser's own
 * implementation, and CLAUDE.md says so. AES is the exception, and it is not a
 * shortcut: `crypto.subtle.encrypt` returns a ciphertext and nothing else. It
 * cannot show a round. It cannot show the state matrix after SubBytes. It cannot
 * show the key schedule. The entire purpose of this application is the middle of
 * the algorithm, and the browser API deliberately hides the middle.
 *
 * So this is written out in full — and then **checked against WebCrypto in the
 * tests**, block for block, so the trace on screen is provably the same function
 * the browser computes. That is a better position than either choice alone.
 *
 * **Do not use this file for anything real.** It is written for clarity, not for
 * safety: the table lookups are not constant-time, so a real attacker measuring
 * cache timing could recover the key. That is not a hypothetical — cache-timing
 * attacks on table-based AES are published and practical, and it is why real
 * implementations use hardware AES-NI instructions or bitsliced code.
 *
 * ## The shape of it
 *
 * The state is 16 bytes, thought of as a 4x4 grid filled **down the columns**.
 * Each round does four things:
 *
 *   - **SubBytes**    — replace every byte using one fixed 256-entry table. The
 *                       only non-linear step, and the only reason the whole cipher
 *                       is not a solvable system of equations. This is Shannon's
 *                       *confusion*.
 *   - **ShiftRows**   — row 0 stays, row 1 rotates left 1, row 2 by 2, row 3 by 3.
 *                       Moves bytes between columns.
 *   - **MixColumns**  — multiply each column by a fixed matrix over GF(2^8). Every
 *                       output byte of a column depends on all four input bytes.
 *                       This is Shannon's *diffusion*, and it is the Hill cipher's
 *                       idea in a field where every matrix is invertible.
 *   - **AddRoundKey** — XOR in 16 bytes of key schedule.
 *
 * Ten rounds for a 128-bit key, twelve for 192, fourteen for 256. The last round
 * has no MixColumns, which is not an oversight: it makes decryption the same shape
 * as encryption.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { fromHex, toHex } from '../../../../lib/format';

export type Direction = 'encrypt' | 'decrypt';
export type Mode = 'ECB' | 'CBC';

export const BLOCK_BYTES = 16;

/** The Rijndael S-box. One table, and the only non-linear thing in the cipher. */
export const SBOX: readonly number[] = buildSbox();
export const INV_SBOX: readonly number[] = buildInverse(SBOX);

/** Round constants for the key schedule: 1, 2, 4, 8, ... in GF(2^8). */
const RCON: readonly number[] = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d];

/** Multiply by x in GF(2^8), reducing by the Rijndael polynomial 0x11b. */
export function xtime(b: number): number {
  const shifted = (b << 1) & 0xff;
  return (b & 0x80) !== 0 ? shifted ^ 0x1b : shifted;
}

/** Multiplication in GF(2^8). Russian-peasant, so it is readable rather than fast. */
export function gmul(a: number, b: number): number {
  let result = 0;
  let x = a & 0xff;
  let y = b & 0xff;
  while (y !== 0) {
    if ((y & 1) !== 0) result ^= x;
    x = xtime(x);
    y >>= 1;
  }
  return result & 0xff;
}

/**
 * Builds the S-box rather than pasting 256 magic numbers.
 *
 * Each entry is the multiplicative inverse in GF(2^8) followed by a fixed affine
 * transform over GF(2). Both halves matter: the inverse is what makes it
 * non-linear, and the affine map removes the fixed points the inverse alone would
 * have (0 maps to 0, 1 maps to 1) and destroys its algebraic simplicity.
 */
function buildSbox(): number[] {
  // Log and antilog tables over the generator 3, so inverses are a subtraction.
  const exp = new Array<number>(256).fill(0);
  const log = new Array<number>(256).fill(0);
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = x;
    log[x] = i;
    x ^= (x << 1) ^ ((x & 0x80) !== 0 ? 0x1b : 0);
    x &= 0xff;
  }

  const box = new Array<number>(256).fill(0);
  for (let i = 0; i < 256; i += 1) {
    // The table has 255 entries (the multiplicative group), so the exponent must
    // be reduced mod 255. Without the modulo, the inverse of 1 reads exp[255],
    // which is past the end, and 1 wrongly maps to 0.
    const inverse = i === 0 ? 0 : (exp[(255 - (log[i] ?? 0)) % 255] ?? 0);
    let value = inverse;
    let result = inverse;
    for (let round = 0; round < 4; round += 1) {
      value = ((value << 1) | (value >> 7)) & 0xff;
      result ^= value;
    }
    box[i] = result ^ 0x63;
  }
  return box;
}

function buildInverse(box: readonly number[]): number[] {
  const out = new Array<number>(256).fill(0);
  box.forEach((value, i) => {
    out[value] = i;
  });
  return out;
}

/** Rounds for a key length: 10, 12 or 14. */
export function roundsFor(keyBytes: number): number {
  return keyBytes / 4 + 6;
}

/**
 * The key schedule: one 16-byte round key per round, plus one for the initial
 * AddRoundKey. A 128-bit key becomes 176 bytes of schedule.
 */
export function expandKey(key: Uint8Array): Uint8Array[] {
  const nk = key.length / 4;
  const rounds = roundsFor(key.length);
  const total = 4 * (rounds + 1);
  const words: number[][] = [];

  for (let i = 0; i < nk; i += 1) {
    words.push([key[4 * i] ?? 0, key[4 * i + 1] ?? 0, key[4 * i + 2] ?? 0, key[4 * i + 3] ?? 0]);
  }

  for (let i = nk; i < total; i += 1) {
    let temp = [...(words[i - 1] ?? [0, 0, 0, 0])];
    if (i % nk === 0) {
      // Rotate, substitute, and XOR the round constant. The rotation is what
      // stops the schedule from being a simple repetition of the key.
      temp = [temp[1] ?? 0, temp[2] ?? 0, temp[3] ?? 0, temp[0] ?? 0].map((b) => SBOX[b] ?? 0);
      temp[0] = (temp[0] ?? 0) ^ (RCON[i / nk - 1] ?? 0);
    } else if (nk > 6 && i % nk === 4) {
      // AES-256 only: an extra substitution every fourth word.
      temp = temp.map((b) => SBOX[b] ?? 0);
    }
    const previous = words[i - nk] ?? [0, 0, 0, 0];
    words.push(temp.map((b, j) => b ^ (previous[j] ?? 0)));
  }

  const schedule: Uint8Array[] = [];
  for (let r = 0; r <= rounds; r += 1) {
    const bytes = new Uint8Array(BLOCK_BYTES);
    for (let w = 0; w < 4; w += 1) {
      const word = words[r * 4 + w] ?? [0, 0, 0, 0];
      for (let b = 0; b < 4; b += 1) bytes[w * 4 + b] = word[b] ?? 0;
    }
    schedule.push(bytes);
  }
  return schedule;
}

export function subBytes(state: Uint8Array, box: readonly number[] = SBOX): Uint8Array {
  return state.map((b) => box[b] ?? 0);
}

/** Row `r` rotates left by `r`. The state is column-major: index = row + 4 * column. */
export function shiftRows(state: Uint8Array, inverse = false): Uint8Array {
  const out = new Uint8Array(BLOCK_BYTES);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const from = inverse ? (col - row + 4) % 4 : (col + row) % 4;
      out[row + 4 * col] = state[row + 4 * from] ?? 0;
    }
  }
  return out;
}

/** Each column times a fixed matrix over GF(2^8). Diffusion, and Hill's idea. */
export function mixColumns(state: Uint8Array, inverse = false): Uint8Array {
  const m = inverse
    ? [
        [14, 11, 13, 9],
        [9, 14, 11, 13],
        [13, 9, 14, 11],
        [11, 13, 9, 14],
      ]
    : [
        [2, 3, 1, 1],
        [1, 2, 3, 1],
        [1, 1, 2, 3],
        [3, 1, 1, 2],
      ];

  const out = new Uint8Array(BLOCK_BYTES);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let k = 0; k < 4; k += 1) {
        value ^= gmul(m[row]?.[k] ?? 0, state[k + 4 * col] ?? 0);
      }
      out[row + 4 * col] = value;
    }
  }
  return out;
}

export function addRoundKey(state: Uint8Array, key: Uint8Array): Uint8Array {
  return state.map((b, i) => b ^ (key[i] ?? 0));
}

/** What one round did, so the visualizer can show the state at each stage. */
export interface RoundTrace {
  round: number;
  /** 'initial', 'main' or 'final'. The final round has no MixColumns. */
  kind: 'initial' | 'main' | 'final';
  before: Uint8Array;
  afterSub?: Uint8Array;
  afterShift?: Uint8Array;
  afterMix?: Uint8Array;
  roundKey: Uint8Array;
  after: Uint8Array;
}

/** One block, encrypted, with every intermediate state kept. */
export function encryptBlock(block: Uint8Array, schedule: Uint8Array[]): { out: Uint8Array; trace: RoundTrace[] } {
  const rounds = schedule.length - 1;
  const trace: RoundTrace[] = [];

  const firstKey = schedule[0] ?? new Uint8Array(BLOCK_BYTES);
  let state = addRoundKey(block, firstKey);
  trace.push({ round: 0, kind: 'initial', before: block, roundKey: firstKey, after: state });

  for (let r = 1; r <= rounds; r += 1) {
    const before = state;
    const afterSub = subBytes(state);
    const afterShift = shiftRows(afterSub);
    const last = r === rounds;
    const afterMix = last ? afterShift : mixColumns(afterShift);
    const roundKey = schedule[r] ?? new Uint8Array(BLOCK_BYTES);
    state = addRoundKey(afterMix, roundKey);
    trace.push({
      round: r,
      kind: last ? 'final' : 'main',
      before,
      afterSub,
      afterShift,
      ...(last ? {} : { afterMix }),
      roundKey,
      after: state,
    });
  }

  return { out: state, trace };
}

/** One block, decrypted. Every step above, run backwards. */
export function decryptBlock(block: Uint8Array, schedule: Uint8Array[]): { out: Uint8Array; trace: RoundTrace[] } {
  const rounds = schedule.length - 1;
  const trace: RoundTrace[] = [];

  const firstKey = schedule[rounds] ?? new Uint8Array(BLOCK_BYTES);
  let state = addRoundKey(block, firstKey);
  trace.push({ round: 0, kind: 'initial', before: block, roundKey: firstKey, after: state });

  for (let r = rounds - 1; r >= 0; r -= 1) {
    const before = state;
    const afterShift = shiftRows(state, true);
    const afterSub = subBytes(afterShift, INV_SBOX);
    const roundKey = schedule[r] ?? new Uint8Array(BLOCK_BYTES);
    const added = addRoundKey(afterSub, roundKey);
    const last = r === 0;
    state = last ? added : mixColumns(added, true);
    trace.push({
      round: rounds - r,
      kind: last ? 'final' : 'main',
      before,
      afterShift,
      afterSub,
      ...(last ? {} : { afterMix: state }),
      roundKey,
      after: state,
    });
  }

  return { out: state, trace };
}

/** PKCS#7: pad to a whole block, always adding at least one byte. */
export function pad(bytes: Uint8Array): Uint8Array {
  const extra = BLOCK_BYTES - (bytes.length % BLOCK_BYTES);
  const out = new Uint8Array(bytes.length + extra);
  out.set(bytes);
  out.fill(extra, bytes.length);
  return out;
}

/** Removes PKCS#7 padding, or returns null when it is not valid. */
export function unpad(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length === 0 || bytes.length % BLOCK_BYTES !== 0) return null;
  const extra = bytes[bytes.length - 1] ?? 0;
  if (extra < 1 || extra > BLOCK_BYTES || extra > bytes.length) return null;
  for (let i = bytes.length - extra; i < bytes.length; i += 1) {
    if (bytes[i] !== extra) return null;
  }
  return bytes.slice(0, bytes.length - extra);
}

/** Cuts a byte array into 16-byte blocks. */
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

/** Reads a hex key of 16, 24 or 32 bytes, and says clearly when it cannot. */
export function readKey(hex: string): Uint8Array {
  const bytes = fromHex(hex.replace(/\s+/g, ''));
  if (bytes === null) {
    throw new Error('The key must be hexadecimal: the digits 0-9 and a-f, two per byte.');
  }
  if (bytes.length !== 16 && bytes.length !== 24 && bytes.length !== 32) {
    throw new Error(
      `AES keys are 128, 192 or 256 bits — that is 32, 48 or 64 hex digits. This one is ${bytes.length * 8} bits (${hex.replace(/\s+/g, '').length} digits).`,
    );
  }
  return bytes;
}

/** Reads a 16-byte IV. Only CBC uses it, and ECB's page says why it has none. */
export function readIv(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  if (cleaned === '') return new Uint8Array(BLOCK_BYTES);
  const bytes = fromHex(cleaned);
  if (bytes === null || bytes.length !== BLOCK_BYTES) {
    throw new Error('The IV must be exactly 32 hex digits — 16 bytes, one block.');
  }
  return bytes;
}

/** The cipher over a whole message, untraced. Used by the benchmark. */
export function aes(text: string, options: Options, direction: Direction): string {
  const schedule = expandKey(options.key);

  if (direction === 'encrypt') {
    const padded = pad(new TextEncoder().encode(text));
    let previous = options.iv;
    let out = '';
    for (const block of blocksOf(padded)) {
      const input = options.mode === 'CBC' ? xor(block, previous) : block;
      const { out: cipher } = encryptBlock(input, schedule);
      previous = cipher;
      out += toHex(cipher);
    }
    return out;
  }

  const bytes = fromHex(text.replace(/\s+/g, ''));
  if (bytes === null || bytes.length === 0 || bytes.length % BLOCK_BYTES !== 0) {
    throw new Error(
      'A ciphertext is a whole number of 16-byte blocks written in hex — 32 hex digits per block.',
    );
  }

  let previous = options.iv;
  const plain = new Uint8Array(bytes.length);
  blocksOf(bytes).forEach((block, i) => {
    const { out: decrypted } = decryptBlock(block, schedule);
    const result = options.mode === 'CBC' ? xor(decrypted, previous) : decrypted;
    previous = block;
    plain.set(result, i * BLOCK_BYTES);
  });

  const stripped = unpad(plain);
  if (stripped === null) {
    throw new Error(
      'The padding is not valid, which almost always means the key, the IV or the mode is wrong. (A real system must never tell an attacker this — see the explainer on padding oracles.)',
    );
  }
  return new TextDecoder().decode(stripped);
}

/** Where in the original text each block's bytes came from, so a step can point at it. */
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

/**
 * The cipher again, one `Step` per block.
 *
 * Per block rather than per round, because a round is not a self-contained event a
 * reader can act on and a block is. Every round's intermediate state travels in
 * `Step.data`, and the Visualize tab scrubs through them.
 */
export function aesTrace(text: string, options: Options, direction: Direction): TraceResult {
  const schedule = expandKey(options.key);
  const bits = options.key.length * 8;
  const rounds = roundsFor(options.key.length);
  const steps: Step[] = [];

  const asData = (trace: RoundTrace[]) =>
    trace.map((round) => ({
      round: round.round,
      kind: round.kind,
      before: toHex(round.before),
      afterSub: round.afterSub === undefined ? null : toHex(round.afterSub),
      afterShift: round.afterShift === undefined ? null : toHex(round.afterShift),
      afterMix: round.afterMix === undefined ? null : toHex(round.afterMix),
      roundKey: toHex(round.roundKey),
      after: toHex(round.after),
    }));

  if (direction === 'encrypt') {
    const padded = pad(new TextEncoder().encode(text));
    const blocks = blocksOf(padded);
    const ranges = blockRanges(text, blocks.length);
    let previous = options.iv;
    let output = '';

    blocks.forEach((block, i) => {
      const chained = options.mode === 'CBC' ? xor(block, previous) : block;
      const { out, trace } = encryptBlock(chained, schedule);
      const at = output.length;
      output += toHex(out);
      previous = out;

      steps.push({
        index: i,
        title: `Block ${i + 1} → ${toHex(out).slice(0, 8)}…`,
        detail: `${bits}-bit key, so ${rounds} rounds${options.mode === 'CBC' ? `, and in CBC mode this block is XORed with the previous ciphertext block before any of them` : ', and in ECB mode this block is encrypted entirely on its own — which is the problem with ECB'}. Each round does SubBytes, ShiftRows, MixColumns and AddRoundKey; the last round leaves out MixColumns, which is what makes decryption the same shape as encryption rather than a special case.`,
        output: toHex(out),
        highlight: ranges[i] ?? { start: 0, end: 0 },
        outputHighlight: { start: at, end: at + BLOCK_BYTES * 2 },
        data: {
          isBlock: true,
          block: i,
          mode: options.mode,
          bits,
          rounds,
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
      'A ciphertext is a whole number of 16-byte blocks written in hex — 32 hex digits per block.',
    );
  }

  let previous = options.iv;
  const plain = new Uint8Array(bytes.length);
  const cipherBlocks = blocksOf(bytes);

  cipherBlocks.forEach((block, i) => {
    const { out, trace } = decryptBlock(block, schedule);
    const result = options.mode === 'CBC' ? xor(out, previous) : out;
    previous = block;
    plain.set(result, i * BLOCK_BYTES);

    steps.push({
      index: i,
      title: `Block ${i + 1} → ${toHex(result).slice(0, 8)}…`,
      detail: `Each round is run backwards: InvShiftRows, InvSubBytes, AddRoundKey, InvMixColumns.${options.mode === 'CBC' ? ' Then the previous ciphertext block is XORed back out, which is what CBC chaining costs to undo.' : ''}`,
      output: toHex(result),
      highlight: { start: i * BLOCK_BYTES * 2, end: (i + 1) * BLOCK_BYTES * 2 },
      data: {
        isBlock: true,
        block: i,
        mode: options.mode,
        bits,
        rounds,
        input: toHex(block),
        cipher: toHex(result),
        trace: asData(trace),
      },
    });
  });

  const stripped = unpad(plain);
  if (stripped === null) {
    throw new Error(
      'The padding is not valid, which almost always means the key, the IV or the mode is wrong. (A real system must never tell an attacker this — see the explainer on padding oracles.)',
    );
  }

  return { output: new TextDecoder().decode(stripped), steps };
}
