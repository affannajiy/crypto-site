/**
 * Caesar's entry in the registry.
 *
 * This file is the template every other cipher follows: metadata, the tiers it
 * earns, its parameters, and thin wiring to the pure functions next door. There
 * is no algorithm in here — that lives in `caesar.ts`, where a test can reach it.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { caesar, caesarTrace } from './caesar';
import { bruteForceCaesar } from './attack';
import CaesarStrips from './CaesarStrips';

/**
 * Params arrive as `string | number` because they come from form controls. The
 * message is written for the person who will read it, not for a log.
 */
function readShift(p: Params): number {
  const shift = Number(p['shift']);
  if (!Number.isFinite(shift)) {
    throw new Error('Shift needs to be a whole number between 1 and 25.');
  }
  return Math.trunc(shift);
}

const explainer = `
Every letter slides a fixed number of places along the alphabet. Julius Caesar used a shift of 3.

## How it works

- Pick a **shift** from 1 to 25.
- Move each letter that many places forward, wrapping from Z to A. That is addition modulo 26.
- To decrypt, move back by the same shift.
- Spaces, digits and punctuation pass through unchanged.

## Lecture note

- The lecture's table, A→D, B→E, C→F, is a shift of 3. That is the first example.
- The lecture uses Caesar as its example of **confusion**, which means substitution.
- Lab 03 calls Caesar "monoalphabetic". That is true, but only 25 of the 26! monoalphabetic keys are shifts. The Monoalphabetic page shows the general case.

## How this breaks

- **There are only 25 keys.** The Attack tab tries every one of them instantly.
- **Letter frequencies survive.** The most common ciphertext letter is probably E. The Attack tab ranks each key by chi-squared, which needs a sentence or more of text.
- **The shape of the message leaks.** Word lengths and punctuation pass straight through.
`.trim();

const caesarCipher: CipherModule = {
  slug: 'caesar',
  name: 'Caesar Cipher',
  family: 'classical',
  year: '~50 BC',
  origin: 'Julius Caesar, by the account of Suetonius',
  keyType: 'A single integer shift, 1 to 25',
  security: 'broken',
  difficulty: 'beginner',
  keywords: ['shift', 'monoalphabetic', 'brute force', 'frequency analysis', 'rome'],
  blurb: 'Every letter slides a fixed number of places along the alphabet.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'number',
      name: 'shift',
      label: 'Shift',
      min: 1,
      max: 25,
      default: 3,
    },
  ],
  examples: [
    {
      label: 'Lecture example: shift of three',
      input: 'meet me after the toga party',
      params: { shift: 3 },
    },
    {
      label: 'A shift of thirteen is ROT13',
      input: 'Caesar with a shift of 13 is its own inverse.',
      params: { shift: 13 },
    },
    {
      label: 'Something to break on the Attack tab',
      input: 'Wkh ohjlrqv pdufk dw gdzq.',
      params: { shift: 3 },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return caesarTrace(input, readShift(p), 'encrypt');
  },

  benchmark(input: string, p: Params): string {
    return caesar(input, readShift(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return caesarTrace(input, readShift(p), 'decrypt');
  },

  attack: bruteForceCaesar,
  attackScoreLabel: 'chi-squared',

  visualize: CaesarStrips,
};

export default caesarCipher;
