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
Write the alphabet out. Under it, write the same 26 letters in any order. That
second row is the key.

    plain:  a b c d e f g h i j k l m n o p q r s t u v w x y z
    key:    D K V Q F I B J W P E S C X H T M Y A U O L R G Z N

To encrypt, find each letter of the message in the top row and write down the
letter under it, whereby \`if we wish\` becomes \`WI RF RWAJ\`. To decrypt, go
from the bottom row back up.

To illustrate how this relates to the others, Caesar is this cipher with the
bottom row forced to be the top row slid along. Atbash is this cipher with the
bottom row reversed, and Affine is this cipher with the bottom row set by a
formula. Here, the bottom row is free, so there are

    26! = 403,291,461,126,605,635,584,000,000

possible keys, about 4 × 10²⁶. That is more than 2⁸⁸, which is more keys than DES
had. As a result, no one will ever try them all.

## How this breaks

**It does not matter how many keys there are.** Each plaintext letter always
becomes the same ciphertext letter, so the letter frequencies of English survive
intact and are only relabelled. E is about 12% of English text, so the most common
ciphertext letter is probably E, followed by T and A. Furthermore, THE is the most
common three-letter word, so a common three-letter group that ends in the guessed
E is probably THE. Now three letters are known, and each guess makes the next one
easier.

That process is **frequency analysis**. Al-Kindi described it in the ninth
century, and it breaks this cipher on a paragraph of text with pencil and paper.
The Analyse page counts the letters automatically, whereby a ciphertext from here
can be pasted in and its shape compared with English.

**The shape of the message leaks too.** Spaces, punctuation and capitals pass
straight through. A one-letter word is almost certainly A or I, and an apostrophe
followed by one letter is probably S or T.

This page has no Attack tab. A computer does not try 26! keys either. Instead, it
starts from a frequency guess and swaps pairs of key letters for as long as the
result looks more like English, which is a hill-climbing program rather than a
button. The lesson is already complete without it: **a huge key space is
necessary, but not sufficient.** The key has to hide the statistics of the
message, and one fixed alphabet cannot. Therefore, the polyalphabetic ciphers,
starting with Vigenère, are the attempt to fix exactly this.
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
