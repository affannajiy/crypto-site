/**
 * PBKDF2-HMAC-SHA-256, written out.
 *
 * **Do not use this for anything real.** The usual warning, and an unusual second
 * one: PBKDF2 is the first thing in this app whose *purpose* is to be slow, and
 * this implementation is slow for the wrong reason. A real one is slow because
 * you asked for 600,000 iterations. This one is additionally slow because it
 * hashes through a hand-written SHA-256 written for legibility. The iteration
 * count is still the thing that moves the number, which is what the Benchmark tab
 * is there to show.
 *
 * It is built from `sha-256/sha256.ts` rather than from a second copy, because
 * PBKDF2 *is* HMAC repeated and HMAC *is* SHA-256 twice. Writing that out is the
 * page.
 *
 * Plain TypeScript. No React, no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { bytesToHex, utf8Bytes, xorBytes } from '../../../../lib/bytes';
import { sha256Bytes } from '../sha-256/sha256';

const BLOCK_BYTES = 64;
export const HASH_BYTES = 32;

/**
 * HMAC-SHA-256.
 *
 * Two hashes, not one, and the reason is length extension: `sha256(key + message)`
 * can be extended by anyone who knows the length of the key, so the naive
 * construction authenticates nothing. Hashing the result again with a different
 * padded key closes it.
 *
 * The two constants are 0x36 and 0x5c repeated. They are not secret and not
 * clever — they only have to differ from each other in enough bits.
 */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  // A key longer than the block is hashed down first; a shorter one is zero-padded.
  const block = new Uint8Array(BLOCK_BYTES);
  block.set(key.length > BLOCK_BYTES ? sha256Bytes(key) : key);

  const inner = new Uint8Array(BLOCK_BYTES);
  const outer = new Uint8Array(BLOCK_BYTES);
  for (let i = 0; i < BLOCK_BYTES; i += 1) {
    inner[i] = (block[i] ?? 0) ^ 0x36;
    outer[i] = (block[i] ?? 0) ^ 0x5c;
  }

  const innerInput = new Uint8Array(BLOCK_BYTES + message.length);
  innerInput.set(inner);
  innerInput.set(message, BLOCK_BYTES);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(BLOCK_BYTES + HASH_BYTES);
  outerInput.set(outer);
  outerInput.set(innerHash, BLOCK_BYTES);
  return sha256Bytes(outerInput);
}

export interface Options {
  salt: string;
  iterations: number;
  keyBytes: number;
}

/** salt || counter, big-endian, as RFC 8018 specifies. */
function saltWithCounter(salt: Uint8Array, counter: number): Uint8Array {
  const out = new Uint8Array(salt.length + 4);
  out.set(salt);
  new DataView(out.buffer).setUint32(salt.length, counter, false);
  return out;
}

/**
 * One output block: U1 = HMAC(password, salt || i), then Un = HMAC(password,
 * Un-1), all XORed together.
 *
 * The XOR is the part worth reading. Every iteration's output is folded in, so
 * there is no shortcut that jumps to the last one — an attacker has to walk the
 * whole chain exactly as the defender did. That is the entire mechanism.
 */
function block(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  counter: number,
  onIteration?: (n: number, u: Uint8Array, accumulated: Uint8Array) => void,
): Uint8Array {
  let u = hmacSha256(password, saltWithCounter(salt, counter));
  let accumulated = u;
  onIteration?.(1, u, accumulated);

  for (let n = 2; n <= iterations; n += 1) {
    u = hmacSha256(password, u);
    accumulated = xorBytes(accumulated, u);
    onIteration?.(n, u, accumulated);
  }

  return accumulated;
}

/** The derived key as lowercase hex. The fast path, no steps allocated. */
export function pbkdf2(password: string, options: Options): string {
  const pw = utf8Bytes(password);
  const salt = utf8Bytes(options.salt);
  const out = new Uint8Array(options.keyBytes);

  for (let counter = 1; out.length > (counter - 1) * HASH_BYTES; counter += 1) {
    const chunk = block(pw, salt, options.iterations, counter);
    out.set(chunk.slice(0, out.length - (counter - 1) * HASH_BYTES), (counter - 1) * HASH_BYTES);
  }

  return bytesToHex(out);
}

/**
 * How many iterations get their own step.
 *
 * A trace cannot hold 600,000 steps, and would teach nothing if it could: the
 * iterations are identical by design. So the first few and the last are recorded,
 * and the step that stands for the gap says how many were skipped rather than
 * pretending they did not happen.
 */
const TRACED_HEAD = 6;

export function pbkdf2Trace(password: string, options: Options): TraceResult {
  const pw = utf8Bytes(password);
  const salt = utf8Bytes(options.salt);
  const steps: Step[] = [];
  const blocks = Math.ceil(options.keyBytes / HASH_BYTES);

  steps.push({
    index: 0,
    title: `Derive ${options.keyBytes} bytes from a ${pw.length}-byte password`,
    detail:
      `PBKDF2 with HMAC-SHA-256, salt "${options.salt}" (${salt.length} bytes), ` +
      `${options.iterations.toLocaleString('en-GB')} iterations. Each 32-byte output block costs ` +
      `${options.iterations.toLocaleString('en-GB')} HMACs, and each HMAC is two SHA-256 ` +
      `compressions — so this key costs about ` +
      `${(blocks * options.iterations * 2).toLocaleString('en-GB')} of them. That cost is the ` +
      `feature.`,
    data: { iterations: options.iterations, salt: options.salt, keyBytes: options.keyBytes },
  });

  const out = new Uint8Array(options.keyBytes);

  for (let counter = 1; counter <= blocks; counter += 1) {
    let skipped = 0;
    const chunk = block(pw, salt, options.iterations, counter, (n, u, accumulated) => {
      const isTail = n === options.iterations;
      if (n > TRACED_HEAD && !isTail) {
        skipped += 1;
        return;
      }
      if (skipped > 0) {
        steps.push({
          index: steps.length,
          title: `${skipped.toLocaleString('en-GB')} more iterations, all identical`,
          detail:
            `Each one is HMAC-SHA-256 of the previous result, XORed into the running total. ` +
            `There is no shortcut past them: the only way to reach iteration ` +
            `${options.iterations.toLocaleString('en-GB')} is to compute iterations 1 to ` +
            `${(options.iterations - 1).toLocaleString('en-GB')} first. An attacker guessing ` +
            `passwords pays this for every guess.`,
          data: { skipped },
        });
        skipped = 0;
      }
      steps.push({
        index: steps.length,
        title: n === 1 ? `Block ${counter}: U1 = HMAC(password, salt || ${counter})` : `U${n} = HMAC(password, U${n - 1})`,
        detail:
          `U${n} = ${bytesToHex(u)}. ` +
          (n === 1
            ? 'The salt goes in here, with the block number after it. Two people with the same password get different first values, which is what stops one precomputed table covering everybody.'
            : `XORed into the running total: ${bytesToHex(accumulated)}.`),
        data: { u: bytesToHex(u), accumulated: bytesToHex(accumulated), iteration: n, block: counter },
      });
    });

    out.set(chunk.slice(0, out.length - (counter - 1) * HASH_BYTES), (counter - 1) * HASH_BYTES);
  }

  const derived = bytesToHex(out);
  steps.push({
    index: steps.length,
    title: 'The derived key',
    detail:
      `${options.keyBytes} bytes: ${derived}. Store this beside the salt and the iteration count — ` +
      `all three are needed to check a password later, and none of them is a secret except the ` +
      `password itself, which is not stored at all.`,
    data: { derived },
  });

  return { output: derived, steps };
}
