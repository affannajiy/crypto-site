/**
 * The Feistel structure, at the size of the lecture's worked example.
 *
 * Lecture 04 works one Feistel cipher by hand: an 8-bit block 10110110, three
 * rounds, round keys 0110, 1100 and 1010, and the round function
 *
 *     F(R, K) = R XOR K
 *
 * which gives the ciphertext 00010000. This module is that example, written so
 * that a reader can change the block, the keys and the number of rounds and
 * watch every half move.
 *
 * Each round:
 *
 *     L(i) = R(i-1)
 *     R(i) = L(i-1) XOR F(R(i-1), K(i))
 *
 * **The final swap.** The lecture's diagram ends with one more swap, so the
 * ciphertext is R(n) || L(n). The lecture's worked example does not, and gives
 * L(n) || R(n) = 00010000. The slide text says "some systems" add the swap. So it
 * is a parameter, and the default matches the worked example. DES does the swap.
 *
 * **Decryption** runs the same rounds with the keys in reverse order. Without the
 * final swap, the halves must be swapped going in and coming out. That is the
 * "left-right switch" the decryption slide mentions.
 *
 * This F is linear, so this cipher is a teaching model and nothing more. The
 * explainer says how one known plaintext breaks it.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { utf8Bytes } from '../../../../lib/bytes';

export type Direction = 'encrypt' | 'decrypt';

export const BLOCK_SIZES = [8, 16] as const;
export type BlockBits = (typeof BLOCK_SIZES)[number];
export const MAX_ROUNDS = 16;

/** A string of 0 and 1 only. Spaces are allowed between groups and ignored. */
export function cleanBits(text: string): string {
  return text.replace(/[\s_]+/g, '');
}

export function isBits(text: string): boolean {
  return /^[01]*$/.test(text);
}

export function xorBits(a: string, b: string): string {
  let out = '';
  for (let i = 0; i < a.length; i += 1) out += a.charAt(i) === b.charAt(i) ? '0' : '1';
  return out;
}

/** The lecture's round function. Linear, which is why the explainer can break it. */
export function roundFunction(right: string, key: string): string {
  return xorBits(right, key);
}

/** Reads the round keys: one binary group per round, each half a block wide. */
export function readKeys(text: string, blockBits: BlockBits): string[] {
  const half = blockBits / 2;
  const groups = text.trim().split(/[\s,;]+/).filter((g) => g !== '');
  if (groups.length === 0) {
    throw new Error('Give at least one round key, such as 0110. One key per round.');
  }
  if (groups.length > MAX_ROUNDS) {
    throw new Error(`This page stops at ${MAX_ROUNDS} rounds, the number DES uses. You gave ${groups.length} keys.`);
  }
  for (const [i, group] of groups.entries()) {
    if (!isBits(group) || group.length !== half) {
      throw new Error(
        `Round key ${i + 1} is "${group}". With a ${blockBits}-bit block each half is ${half} bits, so each key is ${half} binary digits, such as ${'01'.repeat(half / 2)}.`,
      );
    }
  }
  return groups;
}

/** Reads the message: whole blocks of binary, written together or in groups. */
export function readBlocks(text: string, blockBits: BlockBits, what: string): string[] {
  const bits = cleanBits(text);
  if (bits === '') return [];
  if (!isBits(bits)) {
    throw new Error(`The ${what} is binary: only 0 and 1. Spaces between blocks are fine.`);
  }
  if (bits.length % blockBits !== 0) {
    throw new Error(
      `The ${what} is ${bits.length} bits, which is not a whole number of ${blockBits}-bit blocks. Add ${blockBits - (bits.length % blockBits)} more bits, or change the block size.`,
    );
  }
  const blocks: string[] = [];
  for (let i = 0; i < bits.length; i += blockBits) blocks.push(bits.slice(i, i + blockBits));
  return blocks;
}

/** One round, as the lecture writes it out. */
export interface RoundTrace {
  round: number;
  left: string;
  right: string;
  key: string;
  f: string;
  newLeft: string;
  newRight: string;
}

export interface BlockTrace {
  input: string;
  /** The halves the rounds start from, after any decryption swap. */
  start: { left: string; right: string };
  rounds: RoundTrace[];
  /** True when the halves were swapped going in (decryption without a final swap). */
  swappedIn: boolean;
  /** True when the halves were swapped coming out. */
  swappedOut: boolean;
  output: string;
}

/**
 * One block through the network.
 *
 * Encryption with `finalSwap` false is exactly the lecture's worked example.
 * Every other case is the same rounds with a swap added at one end or the other,
 * which is the whole of the encryption-decryption symmetry.
 */
export function feistelBlock(block: string, keys: string[], finalSwap: boolean, direction: Direction): BlockTrace {
  const half = block.length / 2;
  const schedule = direction === 'encrypt' ? keys : [...keys].reverse();
  // Decryption must undo the output order before the rounds can run backwards.
  // With a final swap the ciphertext is already R||L, which is exactly what the
  // reversed rounds need, so no extra swap is required.
  const swappedIn = direction === 'decrypt' && !finalSwap;
  // Decryption always swaps on the way out: the reversed rounds leave R0 on the
  // left and L0 on the right, whichever way the ciphertext was joined.
  const swappedOut = direction === 'encrypt' ? finalSwap : true;

  let left = block.slice(0, half);
  let right = block.slice(half);
  if (swappedIn) [left, right] = [right, left];
  const start = { left, right };

  const rounds: RoundTrace[] = [];
  schedule.forEach((key, i) => {
    const f = roundFunction(right, key);
    const newLeft = right;
    const newRight = xorBits(left, f);
    rounds.push({ round: i + 1, left, right, key, f, newLeft, newRight });
    left = newLeft;
    right = newRight;
  });

  const output = swappedOut ? right + left : left + right;
  return { input: block, start, rounds, swappedIn, swappedOut, output };
}

/**
 * What the message box holds. `binary` is the lecture's form: blocks of 0 and 1.
 * `text` reads an ordinary message as its UTF-8 bytes, eight bits each, so the
 * same network can run on a sentence. The ciphertext is binary either way.
 */
export type Format = 'binary' | 'text';

export interface Options {
  blockBits: BlockBits;
  keys: string[];
  finalSwap: boolean;
  format?: Format;
}

/** Groups a bit string in fours, the way the slides print binary. */
export function nibbles(bits: string): string {
  return (bits.match(/.{1,4}/g) ?? []).join(' ');
}

interface Range {
  start: number;
  end: number;
}

/** For each UTF-8 byte of `text`, the character range it came from. */
export function byteSources(text: string): Range[] {
  const encoder = new TextEncoder();
  const ranges: Range[] = [];
  let at = 0;
  for (const char of text) {
    const count = encoder.encode(char).length;
    for (let i = 0; i < count; i += 1) ranges.push({ start: at, end: at + char.length });
    at += char.length;
  }
  return ranges;
}

export function bytesToBits(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');
}

export function bitsToBytes(bits: string): Uint8Array {
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

/** The message as bits, with one zero byte added when a 16-bit block needs it. */
function textBits(text: string, blockBits: BlockBits): { bits: string; padded: boolean } {
  const bytes = Array.from(utf8Bytes(text));
  const padded = blockBits === 16 && bytes.length % 2 === 1;
  if (padded) bytes.push(0);
  return { bits: bytesToBits(new Uint8Array(bytes)), padded };
}

/** Plaintext bits back to text, dropping the zero byte a 16-bit block added. */
function bitsText(bits: string, blockBits: BlockBits): string {
  let bytes = bitsToBytes(bits);
  if (blockBits === 16 && bytes.length > 0 && bytes[bytes.length - 1] === 0) bytes = bytes.slice(0, -1);
  return new TextDecoder().decode(bytes);
}

/** The cipher over every block, untraced. */
export function feistel(text: string, options: Options, direction: Direction): string {
  return feistelTrace(text, options, direction).output;
}

/**
 * The cipher again, as the lecture writes it: a step for the split, a step per
 * round, and a step for the join.
 */
export function feistelTrace(text: string, options: Options, direction: Direction): TraceResult {
  const what = direction === 'encrypt' ? 'plaintext' : 'ciphertext';
  const textIn = options.format === 'text' && direction === 'encrypt';
  const textOut = options.format === 'text' && direction === 'decrypt';
  const prepared = textIn ? textBits(text, options.blockBits) : { bits: text, padded: false };
  const blocks = readBlocks(prepared.bits, options.blockBits, what);
  const traces = blocks.map((block) => feistelBlock(block, options.keys, options.finalSwap, direction));
  const steps: Step[] = [];
  const half = options.blockBits / 2;
  const bytesPerBlock = options.blockBits / 8;

  // Binary groups out, or the decrypted text when the format is text.
  const outBits = traces.map((t) => t.output);
  const output = textOut ? bitsText(outBits.join(''), options.blockBits) : outBits.join(' ');

  // Where each block sits in the input box and in the output, so the panes can
  // light it. Binary may be typed with spaces, so map bit index to character.
  // Text maps through the bytes each character became.
  const bitAt: number[] = [];
  for (let i = 0; i < text.length; i += 1) if (text.charAt(i) === '0' || text.charAt(i) === '1') bitAt.push(i);
  const inBytes = textIn ? byteSources(text) : [];
  const outBytes = textOut ? byteSources(output) : [];
  const byteRange = (sources: Range[], b: number): Range => {
    const first = sources[Math.min(b * bytesPerBlock, sources.length - 1)];
    const last = sources[Math.min((b + 1) * bytesPerBlock - 1, sources.length - 1)];
    return { start: first?.start ?? 0, end: last?.end ?? 0 };
  };
  const charsOf = (source: string, sources: Range[], b: number): string => {
    const r = byteRange(sources, b);
    return source.slice(r.start, r.end);
  };

  traces.forEach((trace, b) => {
    const block = blocks[b] ?? '';
    const inRange = textIn
      ? byteRange(inBytes, b)
      : { start: bitAt[b * options.blockBits] ?? 0, end: (bitAt[(b + 1) * options.blockBits - 1] ?? 0) + 1 };
    const outRange = textOut
      ? byteRange(outBytes, b)
      : { start: b * (options.blockBits + 1), end: b * (options.blockBits + 1) + options.blockBits };
    const label = blocks.length > 1 ? `Block ${b + 1}: ` : '';
    const base = { block: b, blockCount: blocks.length, isFeistel: true, half, finalSwap: options.finalSwap, direction };
    const padNote =
      textIn && prepared.padded && b === blocks.length - 1
        ? ' The message has an odd number of bytes, so a zero byte fills the last 16-bit block.'
        : '';
    const fromText = textIn
      ? `"${charsOf(text, inBytes, b)}" is the UTF-8 byte${bytesPerBlock > 1 ? 's' : ''} ${nibbles(block)}.${padNote} `
      : '';

    steps.push({
      index: steps.length,
      title: `${label}Split ${nibbles(block)} into L0 = ${trace.start.left}, R0 = ${trace.start.right}`,
      detail:
        fromText +
        (trace.swappedIn
          ? `To decrypt, read the ciphertext ${nibbles(block)} as L${trace.rounds.length} || R${trace.rounds.length} and swap the halves, so the rounds can run backwards with the keys in reverse order (${[...options.keys].reverse().join(', ')}). This is the left-right switch on the decryption slide.`
          : direction === 'decrypt'
            ? `The ciphertext already ends with the final swap, so the halves go straight in, and the keys run in reverse order (${[...options.keys].reverse().join(', ')}).`
            : `A ${options.blockBits}-bit block splits into two ${half}-bit halves: the left half L0 and the right half R0.`),
      input: block,
      highlight: inRange,
      data: { ...base, stage: 'split', left: trace.start.left, right: trace.start.right, rounds: trace.rounds },
    });

    for (const round of trace.rounds) {
      const i = round.round;
      steps.push({
        index: steps.length,
        title: `${label}Round ${i}: L${i} = ${round.newLeft}, R${i} = ${round.newRight}`,
        detail: `F${i - 1} = R${i - 1} XOR K${i - 1} = ${round.right} XOR ${round.key} = ${round.f}. Then R${i} = F${i - 1} XOR L${i - 1} = ${round.f} XOR ${round.left} = ${round.newRight}, and L${i} = R${i - 1} = ${round.newLeft}. The old right half crosses to the left unchanged.`,
        input: round.left + round.right,
        output: round.newLeft + round.newRight,
        highlight: inRange,
        data: { ...base, stage: 'round', round: i, left: round.left, right: round.right, key: round.key, f: round.f, newLeft: round.newLeft, newRight: round.newRight, rounds: trace.rounds },
      });
    }

    const n = trace.rounds.length;
    const asText = textOut ? ` As text, that is "${charsOf(output, outBytes, b)}".` : '';
    steps.push({
      index: steps.length,
      title: `${label}Join → ${nibbles(trace.output)}`,
      detail:
        (trace.swappedOut
          ? `Swap the halves one last time and join them: R${n} || L${n} = ${trace.output}.${direction === 'decrypt' ? ' That is the plaintext.' : ' This is the extra step "some systems" add after the last round.'}`
          : `Join the halves without a final swap: L${n} || R${n} = ${trace.output}. This is how the lecture's worked example ends.`) + asText,
      output: trace.output,
      highlight: inRange,
      outputHighlight: outRange,
      data: { ...base, stage: 'join', output: trace.output, swappedOut: trace.swappedOut, rounds: trace.rounds },
    });
  });

  return { output, steps };
}
