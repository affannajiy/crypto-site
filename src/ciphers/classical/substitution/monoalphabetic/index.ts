/**
 * The monoalphabetic substitution cipher's entry in the registry.
 *
 * The general case that Caesar, Atbash and Affine are special cases of. The key
 * is a whole shuffled alphabet, and the point of the page is that 26! keys buy
 * nothing against a statistic that ignores the key entirely.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import {
  TEXTBOOK_KEY,
  monoalphabetic,
  monoalphabeticTrace,
  randomAlphabet,
} from './monoalphabetic';
import MonoTable from './MonoTable';

/** Params arrive as `string | number` because they come from form controls. */
function readKey(p: Params): string {
  return String(p['key'] ?? '');
}

const explainer = `
Each letter is swapped for the letter under it in a shuffled alphabet.

    plain:  a b c d e f g h i j k l m n o p q r s t u v w x y z
    key:    D K V Q F I B J W P E S C X H T M Y A U O L R G Z N

## How it works

- The key is all 26 letters, in any order. That gives 26! ≈ 4 × 10²⁶ keys, which is more than DES has.
- To encrypt, find each letter in the top row and write down the letter under it. \`if we wish\` becomes \`WI RF RWAJ\`.
- To decrypt, go from the bottom row back up.
- Caesar is the special case where the bottom row is the alphabet slid along.

## How this breaks

- **It falls to frequency analysis.** A letter always becomes the same letter, so English letter counts survive, only relabelled. E, T, A and the word THE fall first. Al-Kindi described the method in the 9th century.
- **The shape of the message leaks.** A one-letter word is A or I.
- **This page has no Attack tab.** The real attack is a program that swaps key letters while the text keeps looking more like English. To count the letters, paste the ciphertext into Analyse.
- **A huge key space is not enough.** One fixed alphabet cannot hide the statistics.
`.trim();

const monoalphabeticCipher: CipherModule = {
  slug: 'monoalphabetic',
  name: 'Monoalphabetic Substitution',
  family: 'classical',
  year: 'ancient',
  origin: 'Widespread; broken by al-Kindi in the 9th century',
  keyType: 'A shuffled alphabet, all 26 letters once each',
  security: 'broken',
  difficulty: 'beginner',
  keywords: ['substitution', 'shuffled alphabet', 'permutation', 'frequency analysis', 'confusion'],
  blurb: 'Every letter is swapped for the one under it in a shuffled alphabet.',
  explainer,
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key alphabet (a to z)',
      default: TEXTBOOK_KEY,
      placeholder: 'All 26 letters, each once, in any order',
    },
  ],
  examples: [
    {
      label: 'The textbook key',
      input: 'if we wish to replace letters',
      params: { key: TEXTBOOK_KEY },
    },
    {
      label: 'A full sentence',
      input: 'Meet me at the old bridge at midnight.',
      params: { key: TEXTBOOK_KEY },
    },
    {
      label: 'A key with a letter missing',
      input: 'This key has two Qs and no N.',
      params: { key: 'DKVQFIBJWPESCXHTMYAUOLRGZQ' },
      demonstratesError: true,
    },
  ],

  randomKey(): Params {
    return { key: randomAlphabet() };
  },

  encrypt(input: string, p: Params): TraceResult {
    return monoalphabeticTrace(input, readKey(p), 'encrypt');
  },

  benchmark(input: string, p: Params): string {
    return monoalphabetic(input, readKey(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return monoalphabeticTrace(input, readKey(p), 'decrypt');
  },

  visualize: MonoTable,
};

export default monoalphabeticCipher;
