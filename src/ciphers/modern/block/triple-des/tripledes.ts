/**
 * Triple DES — TDEA, the way Lab 04 builds it.
 *
 *     ciphertext = E(K3, D(K2, E(K1, plaintext)))
 *     plaintext  = D(K1, E(K2, D(K3, ciphertext)))
 *
 * Three passes of the DES on this site, with nothing new inside. That is the
 * point of 3DES: it was a way to keep the DES hardware and the DES algorithm and
 * still get past the 56-bit key.
 *
 * **Why encrypt-decrypt-encrypt rather than three encryptions.** With K1 = K2 the
 * first two passes cancel, and what is left is single DES under K3. So a 3DES box
 * could talk to an old DES box. That is the "keying option 3" in the lab, and the
 * tests check that it reproduces the DES vector exactly.
 *
 * The keying options:
 *
 *   1. Three independent keys, 168 key bits, about 112 bits of real security.
 *   2. K3 = K1, 112 key bits. The lab's own keys are this option.
 *   3. K1 = K2 = K3: single DES, kept only for compatibility.
 *
 * **Do not use this for anything.** NIST withdrew 3DES in 2023. Its 64-bit block
 * is the problem the explainer describes.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { TraceResult } from '../../../types';
import { type MessageFormat, runMessage, traceMessage } from '../../../../lib/blockMessage';
import type { Direction, Mode } from '../../../../lib/modes';
import { toHex } from '../../../../lib/format';
import { BLOCK_BYTES, type RoundTrace, expandKey, processBlock, roundsAsData } from '../des/des';

export type Keying = '3-key' | '2-key' | '1-key';

export interface Options {
  k1: Uint8Array;
  k2: Uint8Array;
  k3: Uint8Array;
  keying: Keying;
  mode: Mode;
  iv: Uint8Array;
  format?: MessageFormat;
}

/** The three keys actually used, after the keying option has had its say. */
export function effectiveKeys(options: Pick<Options, 'k1' | 'k2' | 'k3' | 'keying'>): [Uint8Array, Uint8Array, Uint8Array] {
  if (options.keying === '1-key') return [options.k1, options.k1, options.k1];
  if (options.keying === '2-key') return [options.k1, options.k2, options.k1];
  return [options.k1, options.k2, options.k3];
}

/** One DES pass of the three. */
export interface Pass {
  label: string;
  key: string;
  direction: Direction;
  input: Uint8Array;
  output: Uint8Array;
  rounds: RoundTrace[];
}

/** One 8-byte block through all three passes. */
export function tripleBlock(block: Uint8Array, keys: [Uint8Array, Uint8Array, Uint8Array], direction: Direction): { out: Uint8Array; trace: Pass[] } {
  const [k1, k2, k3] = keys.map(expandKey) as [ReturnType<typeof expandKey>, ReturnType<typeof expandKey>, ReturnType<typeof expandKey>];
  const plan: [string, string, ReturnType<typeof expandKey>, Direction][] =
    direction === 'encrypt'
      ? [
          ['Encrypt with K1', toHex(keys[0]), k1, 'encrypt'],
          ['Decrypt with K2', toHex(keys[1]), k2, 'decrypt'],
          ['Encrypt with K3', toHex(keys[2]), k3, 'encrypt'],
        ]
      : [
          ['Decrypt with K3', toHex(keys[2]), k3, 'decrypt'],
          ['Encrypt with K2', toHex(keys[1]), k2, 'encrypt'],
          ['Decrypt with K1', toHex(keys[0]), k1, 'decrypt'],
        ];

  let state = block;
  const trace: Pass[] = [];
  for (const [label, key, schedule, dir] of plan) {
    const { out, trace: rounds } = processBlock(state, schedule, dir);
    trace.push({ label, key, direction: dir, input: state, output: out, rounds });
    state = out;
  }
  return { out: state, trace };
}

const PADDING_ERROR = 'The padding is not valid, which almost always means a key, the keying option, the IV or the mode is wrong.';

function messageOptions(options: Options) {
  const keys = effectiveKeys(options);
  return {
    mode: options.mode,
    iv: options.iv,
    blockBytes: BLOCK_BYTES,
    encryptBlock: (b: Uint8Array) => tripleBlock(b, keys, 'encrypt'),
    decryptBlock: (b: Uint8Array) => tripleBlock(b, keys, 'decrypt'),
    paddingError: PADDING_ERROR,
    format: options.format ?? 'text',
  };
}

/** The cipher over a whole message, untraced. */
export function tripleDes(text: string, options: Options, direction: Direction): string {
  return runMessage(text, messageOptions(options), direction);
}

/** The cipher again, one `Step` per block, with all three passes in `data`. */
export function tripleDesTrace(text: string, options: Options, direction: Direction): TraceResult {
  const keying = options.keying;
  return traceMessage(text, messageOptions(options), direction, {
    detail: (block) => {
      const [a, b, c] = block.trace;
      const chain = [a, b, c]
        .filter((p): p is Pass => p !== undefined)
        .map((p) => `${p.label.charAt(0).toLowerCase() + p.label.slice(1)} → ${toHex(p.output)}`)
        .join(', then ');
      return `Three DES passes: ${chain}.${keying === '1-key' ? ' With one key the first two passes cancel, so this is single DES.' : ''}`;
    },
    traceData: (passes: Pass[]) =>
      passes.map((p) => ({
        label: p.label,
        key: p.key,
        direction: p.direction,
        input: toHex(p.input),
        output: toHex(p.output),
        trace: roundsAsData(p.rounds),
      })),
    extra: { keying },
  });
}
