/**
 * Vigenere's entry in the registry.
 *
 * Metadata, the tiers it earns, its parameters, and thin wiring to the pure
 * functions next door. There is no algorithm in here — that lives in
 * `vigenere.ts` and `attack.ts`, where a test can reach it.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { vigenereTrace } from './vigenere';
import { breakVigenere } from './attack';
import VigenereTable from './VigenereTable';

/**
 * Params arrive as `string | number` because they come from form controls.
 * `normaliseKey` inside the algorithm throws the readable message when the key
 * has no letters at all, so there is nothing to check here beyond the type.
 */
function readKey(p: Params): string {
  return String(p['key'] ?? '');
}

const explainer = `
A repeating keyword gives every letter its own Caesar shift. Giovan Battista Bellaso published it in 1553.

## How it works

- Write the key under the message and repeat it as needed. Each key letter is a shift: A = 0, L = 11.
- For example, ATTACKATDAWN with the key LEMON gives **LXFOPVEFRNHR**.
- On paper, use the Vigenère table. The ciphertext letter is where the plaintext column meets the key row. The Visualize tab draws this table.
- The same letter encrypts differently each time, so letter counts flatten. A space does not use up a key letter.

## How this breaks

- **The key repeats.** If the key length is n, every nth letter is a plain Caesar cipher.
- **The key length can be found.** Kasiski's method (1863) uses the distances between repeated groups. Friedman's index of coincidence (1922) is the other method. The Attack tab uses both.
- **A short message defeats the attack.** It needs enough letters per column. A random key as long as the message, used once, is the one-time pad.
`.trim();

const vigenereCipher: CipherModule = {
  slug: 'vigenere',
  name: 'Vigenere Cipher',
  family: 'classical',
  year: '1553',
  origin: 'Giovan Battista Bellaso, misattributed to Blaise de Vigenere',
  keyType: 'A repeating keyword',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['polyalphabetic', 'kasiski', 'index of coincidence', 'tableau', 'le chiffre indechiffrable'],
  blurb: 'A repeating keyword gives every letter its own Caesar shift.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Keyword',
      default: 'DECEPTIVE',
      placeholder: 'Letters only. Spaces and punctuation are ignored',
      randomise: { alphabet: 'letters', length: 6 },
    },
  ],
  quizzes: [
    {
      question: 'Use the table: encrypt ATTACKATDAWN with the keyword LEMON.',
      run: { input: 'ATTACKATDAWN', params: { key: 'LEMON' } },
    },
    {
      question: 'Encrypt "we are discovered save yourself" with the keyword deceptive.',
      run: { input: 'wearediscoveredsaveyourself', params: { key: 'DECEPTIVE' } },
    },
  ],
  examples: [
    {
      label: 'The textbook keyword',
      input: 'we are discovered save yourself',
      params: { key: 'DECEPTIVE' },
    },
    {
      label: 'Lecture slide: ATTACKATDAWN with LEMON',
      input: 'ATTACKATDAWN',
      params: { key: 'LEMON' },
    },
    {
      label: 'Lab sheet: ThisisIASlab with LEMON',
      input: 'ThisisIASlab',
      params: { key: 'LEMON' },
    },
    {
      label: 'A one-letter key is a Caesar',
      input: 'A key of length one is only a shift.',
      params: { key: 'D' },
    },
    {
      label: 'Long enough to need Kasiski',
      input: 'We attack the eastern gate at dawn and hold the bridge until the second company arrives with the guns.',
      params: { key: 'NAVY' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return vigenereTrace(input, readKey(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return vigenereTrace(input, readKey(p), 'decrypt');
  },

  attack: breakVigenere,
  attackScoreLabel: 'chi-squared',

  visualize: VigenereTable,
};

export default vigenereCipher;
