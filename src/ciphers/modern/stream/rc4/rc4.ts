/**
 * RC4 — Ron Rivest, 1987. Leaked in 1994.
 *
 * The whole cipher is a permutation S of the 256 byte values and two indices.
 *
 * **Key scheduling (KSA).** Start with S = 0, 1, …, 255. Walk i from 0 to 255,
 * and each time set j = j + S[i] + key[i mod keylength] and swap S[i] and S[j].
 *
 * **Keystream (PRGA).** Then, for every output byte:
 *
 *     i = i + 1
 *     j = j + S[i]
 *     swap S[i], S[j]
 *     K = S[S[i] + S[j]]
 *
 * All arithmetic is mod 256. The ciphertext is the plaintext XORed with K, so
 * decryption is the same operation.
 *
 * Ten lines, no tables, and fast in software, which is why it was everywhere:
 * WEP and WPA on wireless networks, SSL and TLS, PDF, Kerberos. It is also badly
 * biased, and those biases broke all of them. See the explainer.
 *
 * **Do not use this for anything.** RFC 7465 has prohibited RC4 in TLS since 2015.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { fromHex, toHex } from '../../../../lib/format';

export type Direction = 'encrypt' | 'decrypt';
export type KeyFormat = 'text' | 'hex';

/** How many output bytes keep a full snapshot of S for the visualizer. */
export const TRACED_BYTES = 64;

export function readRc4Key(value: string, format: KeyFormat): Uint8Array {
  if (format === 'hex') {
    const bytes = fromHex(value.replace(/\s+/g, ''));
    if (bytes === null || bytes.length === 0) {
      throw new Error('A hex key is hexadecimal, two digits per byte, at least one byte.');
    }
    if (bytes.length > 256) throw new Error('An RC4 key is at most 256 bytes.');
    return bytes;
  }
  const bytes = new TextEncoder().encode(value);
  if (bytes.length === 0) throw new Error('The key is empty. RC4 needs at least one byte of key.');
  if (bytes.length > 256) throw new Error('An RC4 key is at most 256 bytes.');
  return bytes;
}

/** The key-scheduling algorithm. Returns S after all 256 swaps. */
export function ksa(key: Uint8Array): number[] {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + (s[i] ?? 0) + (key[i % key.length] ?? 0)) & 0xff;
    [s[i], s[j]] = [s[j] ?? 0, s[i] ?? 0];
  }
  return s;
}

/** One PRGA step: what happened, so it can be shown. */
export interface PrgaStep {
  i: number;
  j: number;
  /** S[i] and S[j] after the swap. */
  si: number;
  sj: number;
  /** The index t = S[i] + S[j], and the keystream byte S[t]. */
  t: number;
  k: number;
}

/** A keystream generator that can be stepped one byte at a time. */
export function generator(key: Uint8Array) {
  const s = ksa(key);
  let i = 0;
  let j = 0;
  return {
    state: s,
    next(): PrgaStep {
      i = (i + 1) & 0xff;
      j = (j + (s[i] ?? 0)) & 0xff;
      [s[i], s[j]] = [s[j] ?? 0, s[i] ?? 0];
      const t = ((s[i] ?? 0) + (s[j] ?? 0)) & 0xff;
      return { i, j, si: s[i] ?? 0, sj: s[j] ?? 0, t, k: s[t] ?? 0 };
    },
  };
}

export function keystream(key: Uint8Array, length: number): Uint8Array {
  const g = generator(key);
  const out = new Uint8Array(length);
  for (let n = 0; n < length; n += 1) out[n] = g.next().k;
  return out;
}

export function rc4Bytes(bytes: Uint8Array, key: Uint8Array): Uint8Array {
  const stream = keystream(key, bytes.length);
  return bytes.map((byte, n) => byte ^ (stream[n] ?? 0));
}

function messageBytes(text: string, direction: Direction): Uint8Array {
  if (direction === 'encrypt') return new TextEncoder().encode(text);
  const bytes = fromHex(text.replace(/\s+/g, ''));
  if (bytes === null) throw new Error('An RC4 ciphertext is hexadecimal, two digits per byte.');
  return bytes;
}

/** The cipher, untraced. */
export function rc4(text: string, key: Uint8Array, direction: Direction): string {
  const out = rc4Bytes(messageBytes(text, direction), key);
  return direction === 'encrypt' ? toHex(out) : new TextDecoder().decode(out);
}

function describeByte(byte: number): string {
  return byte >= 32 && byte < 127 ? `'${String.fromCharCode(byte)}' (${byte})` : `${byte}`;
}

/**
 * The cipher again, one `Step` per byte.
 *
 * The first step is the whole key schedule, because 256 swaps are one idea.
 * Each later step is one PRGA round. The first TRACED_BYTES of them also carry
 * the full state S, so the visualizer can draw the permutation as it changes.
 */
export function rc4Trace(text: string, key: Uint8Array, direction: Direction): TraceResult {
  const input = messageBytes(text, direction);
  const g = generator(key);
  const steps: Step[] = [];
  const out = new Uint8Array(input.length);

  // Map each byte back to its character, so the input pane can point at it.
  const charFor: number[] = [];
  if (direction === 'encrypt') {
    const encoder = new TextEncoder();
    let byteAt = 0;
    for (let c = 0; c < text.length; c += 1) {
      const width = encoder.encode(text.charAt(c)).length;
      for (let w = 0; w < width; w += 1) charFor[byteAt + w] = c;
      byteAt += width;
    }
  }

  steps.push({
    index: 0,
    title: `Key schedule: ${key.length}-byte key, 256 swaps`,
    detail: `S starts as 0, 1, 2, …, 255. For i from 0 to 255, j = j + S[i] + key[i mod ${key.length}], and S[i] swaps with S[j]. The key only ever chooses which swaps happen, so after this S is a shuffled permutation of all 256 byte values. Every byte appears exactly once.`,
    data: { isKsa: true, state: [...g.state], key: toHex(key) },
  });

  input.forEach((byte, n) => {
    const step = g.next();
    const result = byte ^ step.k;
    out[n] = result;
    const source = charFor[n] ?? n;
    steps.push({
      index: steps.length,
      title: `Byte ${n + 1}: ${describeByte(byte)} XOR ${step.k} = ${result}`,
      detail: `i = ${step.i}. j = j + S[i] = ${step.j}. Swap S[${step.i}] and S[${step.j}], so now S[i] = ${step.si} and S[j] = ${step.sj}. The keystream byte is S[S[i] + S[j]] = S[${step.t}] = ${step.k}. XOR it with the ${direction === 'encrypt' ? 'plaintext' : 'ciphertext'} byte ${describeByte(byte)} to get ${direction === 'encrypt' ? result : describeByte(result)}.`,
      input: String(byte),
      output: toHex(new Uint8Array([result])),
      highlight: direction === 'encrypt' ? { start: source, end: source + 1 } : { start: n * 2, end: n * 2 + 2 },
      outputHighlight: direction === 'encrypt' ? { start: n * 2, end: n * 2 + 2 } : { start: n, end: n + 1 },
      data: {
        isPrga: true,
        n,
        ...step,
        plain: byte,
        result,
        ...(n < TRACED_BYTES ? { state: [...g.state] } : {}),
      },
    });
  });

  return { output: direction === 'encrypt' ? toHex(out) : new TextDecoder().decode(out), steps };
}

/**
 * Measures the Mantin-Shamir bias: how often the SECOND keystream byte is 0.
 *
 * A fair generator gives 0 with probability 1/256. RC4 gives it about twice as
 * often, for any key. That is enough to recover a plaintext byte that was
 * encrypted many times under different keys, which is how RC4 in TLS was broken.
 */
export function secondByteZeroRate(trials: number, randomKey: () => Uint8Array): number {
  let zeros = 0;
  for (let t = 0; t < trials; t += 1) {
    const g = generator(randomKey());
    g.next();
    if (g.next().k === 0) zeros += 1;
  }
  return zeros / trials;
}
