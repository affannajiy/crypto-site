/**
 * A block cipher over a whole message: text in, hex out, and one `Step` per block.
 *
 * AES, DES and Triple DES each used to carry their own copy of this loop, and
 * each copy knew only ECB and CBC. Adding CFB, OFB and CTR to three copies would
 * have been three chances to get one wrong. So the loop lives here, on top of
 * `modes.ts`, and each cipher supplies only its block function and its words.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../ciphers/types';
import { fromHex, toHex } from './format';
import { type Direction, type ModeBlock, type ModeOptions, needsPadding, runMode } from './modes';

/**
 * What the message box holds when encrypting.
 *
 * `text` is ordinary writing, UTF-8 encoded and padded. `hex` is raw bytes with
 * no padding, which is what a published test vector, a lab worksheet or a
 * weak-key experiment needs: the DES vector is the *bytes* 01 23 45 67 89 AB CD EF,
 * not the sixteen characters "0123456789ABCDEF".
 */
export type MessageFormat = 'text' | 'hex';

export const FORMAT_OPTIONS: { value: MessageFormat; label: string }[] = [
  { value: 'text', label: 'Text — UTF-8, padded with PKCS#7' },
  { value: 'hex', label: 'Hex — raw bytes, no padding (for test vectors)' },
];

export function readFormat(value: unknown): MessageFormat {
  return String(value ?? '') === 'hex' ? 'hex' : 'text';
}

export interface MessageOptions<T> extends ModeOptions<T> {
  /** Shown when decryption finds broken padding. */
  paddingError: string;
  format?: MessageFormat;
}

/** Turns the text box into bytes: UTF-8 or hex to encrypt, always hex to decrypt. */
export function messageBytes(
  text: string,
  direction: Direction,
  mode: ModeOptions<unknown>['mode'],
  blockBytes: number,
  format: MessageFormat = 'text',
): Uint8Array {
  if (direction === 'encrypt' && format === 'text') return new TextEncoder().encode(text);

  const bytes = fromHex(text.replace(/\s+/g, ''));
  if (direction === 'encrypt' && bytes === null) {
    throw new Error('In hex format the message is hexadecimal: two digits per byte, 0-9 and a-f.');
  }
  if (needsPadding(mode) && (format === 'hex' || direction === 'decrypt')) {
    if (bytes === null || bytes.length === 0 || bytes.length % blockBytes !== 0) {
      throw new Error(
        `In ${mode} mode ${direction === 'encrypt' ? 'raw hex input' : 'a ciphertext'} is a whole number of ${blockBytes}-byte blocks — ${blockBytes * 2} hex digits per block.`,
      );
    }
  } else if (bytes === null || bytes.length === 0) {
    throw new Error(
      `A ciphertext is written in hex, two digits per byte. In ${mode} mode it can be any length, because ${mode} needs no padding.`,
    );
  }
  return bytes;
}

/** Where in the original text each block's bytes came from, so a step can point at it. */
export function blockRanges(text: string, blockCount: number, blockBytes: number): { start: number; end: number }[] {
  const encoder = new TextEncoder();
  const ranges: { start: number; end: number }[] = [];
  let byteAt = 0;
  let charAt = 0;
  for (let b = 0; b < blockCount; b += 1) {
    const start = charAt;
    const limit = (b + 1) * blockBytes;
    while (charAt < text.length && byteAt < limit) {
      byteAt += encoder.encode(text.charAt(charAt)).length;
      charAt += 1;
    }
    ranges.push({ start, end: Math.max(start, charAt) });
  }
  return ranges;
}

function finish(out: Uint8Array, paddingOk: boolean, direction: Direction, paddingError: string, format: MessageFormat): string {
  if (direction === 'encrypt' || format === 'hex') return toHex(out);
  if (!paddingOk) throw new Error(paddingError);
  return new TextDecoder().decode(out);
}

/** The whole message, with no `Step` allocated. */
export function runMessage<T>(text: string, options: MessageOptions<T>, direction: Direction): string {
  const format = options.format ?? 'text';
  const bytes = messageBytes(text, direction, options.mode, options.blockBytes, format);
  const { out, paddingOk } = runMode(bytes, { ...options, pad: format === 'text' }, direction);
  return finish(out, paddingOk, direction, options.paddingError, format);
}

/** The fields every block step carries, which the shared mode diagram reads. */
export function modeData<T>(block: ModeBlock<T>, mode: string): Record<string, unknown> {
  return {
    isBlock: true,
    block: block.index,
    mode,
    input: toHex(block.source),
    ...(block.xorStage === 'before' ? { chained: toHex(block.cipherIn) } : {}),
    cipherIn: toHex(block.cipherIn),
    cipherOut: toHex(block.cipherOut),
    xorWith: block.xorWith === null ? null : toHex(block.xorWith),
    xorStage: block.xorStage,
    ran: block.ran,
    cipher: toHex(block.result),
  };
}

/** A sentence on what the mode did to this block, shared by every block cipher. */
export function modeSentence<T>(block: ModeBlock<T>, mode: string, direction: Direction): string {
  const n = block.index + 1;
  const prev = block.index === 0 ? 'the IV' : `ciphertext block ${block.index}`;
  switch (mode) {
    case 'ECB':
      return `ECB: block ${n} goes through the cipher entirely on its own. Equal blocks give equal output, which is the problem with ECB.`;
    case 'CBC':
      return direction === 'encrypt'
        ? `CBC: block ${n} is XORed with ${prev} first, then encrypted.`
        : `CBC: block ${n} is decrypted, then XORed with ${prev}.`;
    case 'CFB':
      return `CFB: ${prev} is encrypted, and the result is XORed with this block. The cipher runs forwards even to decrypt.`;
    case 'OFB':
      return `OFB: the cipher encrypts ${block.index === 0 ? 'the IV' : 'its own previous output'}, and that keystream block is XORed in. The plaintext never reaches the cipher.`;
    case 'CTR':
      return `CTR: the cipher encrypts counter IV+${block.index}, and that keystream block is XORed in. Every block is independent, so this parallelises.`;
    default:
      return '';
  }
}

export interface TraceWords<T> {
  /** The sentence for one block, after the mode sentence. */
  detail: (block: ModeBlock<T>) => string;
  /** The cipher's own trace for one block call, as plain data for its visualizer. */
  traceData: (trace: T) => unknown;
  /** Anything else the visualizer wants on every block step. */
  extra?: Record<string, unknown>;
}

/** The whole message again, one `Step` per block. */
export function traceMessage<T>(
  text: string,
  options: MessageOptions<T>,
  direction: Direction,
  words: TraceWords<T>,
): TraceResult {
  const { mode, blockBytes } = options;
  const format = options.format ?? 'text';
  const bytes = messageBytes(text, direction, mode, blockBytes, format);
  const run = runMode(bytes, { ...options, pad: format === 'text' }, direction);
  const byChars = direction === 'encrypt' && format === 'text';
  const ranges = byChars ? blockRanges(text, run.blocks.length, blockBytes) : [];
  const hexIn = byChars ? '' : text.replace(/\s+/g, '');

  const steps: Step[] = run.blocks.map((block) => {
    const resultHex = toHex(block.result);
    const at = block.index * blockBytes * 2;
    return {
      index: block.index,
      title: `Block ${block.index + 1} → ${resultHex.length > 16 ? `${resultHex.slice(0, 8)}…` : resultHex}`,
      detail: `${modeSentence(block, mode, direction)} ${words.detail(block)}`.trim(),
      output: resultHex,
      highlight:
        byChars
          ? (ranges[block.index] ?? { start: 0, end: 0 })
          : { start: at, end: Math.min(hexIn.length, at + blockBytes * 2) },
      ...(direction === 'encrypt' ? { outputHighlight: { start: at, end: at + block.result.length * 2 } } : {}),
      data: { ...modeData(block, mode), ...words.extra, trace: words.traceData(block.trace) },
    };
  });

  return { output: finish(run.out, run.paddingOk, direction, options.paddingError, format), steps };
}
