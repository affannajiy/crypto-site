/**
 * Row transposition's entry in the registry.
 *
 * The second transposition here, and the pair is the point: Rail Fence has a
 * key space you can exhaust by hand, this one has a factorial. Both are attacked
 * with `bigramScore` rather than chi-squared, because neither one replaces a
 * letter and chi-squared cannot tell their candidates apart.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { columnar, columnarTrace } from './columnar';
import { MAX_ATTACK_WIDTH, breakColumnar } from './attack';
import ColumnarGrid from './ColumnarGrid';

/** Params arrive as `string | number` because they come from form controls. */
function readKey(p: Params): string {
  return String(p['key'] ?? '');
}

function readPad(p: Params): boolean {
  return p['pad'] !== 'ragged';
}

const explainer = `
Write the message in rows. Then read the columns out in the order that the key gives.

    Key:        4 3 1 2 5 6 7
                a t t a c k p
                o s t p o n e
                d u n t i l t
                w o a m x y z

    Ciphertext: TTNAAPTMTSUOAODWCOIXKNLYPETZ

## How it works

- Write the message in rows under the key. Read the column numbered 1 first, then 2, and so on.
- A keyword works too: alphabetical order sets the numbers. KEYWORD gives 3 2 7 6 4 5 1.
- **Last row** fills the gap with x, y, z or leaves it short. Decrypting keeps the filler.

## Lecture note

- "attack postponed until two am" with the key 4 3 1 2 5 6 7 gives TTNA APTM TSUO AODW COIX KNLY PETZ.
- WORLD → RLDOW uses the order (3, 4, 5, 2, 1). As a key, that order is **54123**. The second example loads it.

## How this breaks

- **The Attack tab searches every column order up to ${MAX_ATTACK_WIDTH} columns.** It ranks each order by bigram fit. Past ${MAX_ATTACK_WIDTH} columns, the search stops.
- **Two messages in one key break it by multiple anagramming.** They must be the same length. Slide their columns until both read as English. This works for any key length.
- **The letter counts are still English.** That tells the attacker that this is a transposition.
`.trim();

const rowTranspositionCipher: CipherModule = {
  slug: 'row-transposition',
  name: 'Row Transposition',
  family: 'classical',
  year: '1500s',
  origin: 'European chancelleries',
  keyType: 'A column order, as numbers (4312567) or a keyword',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['transposition', 'columnar', 'grid', 'anagram', 'permutation', 'diffusion'],
  blurb: 'Write it in rows, read the columns out in the order the key gives.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key (numbers or a keyword)',
      default: '4312567',
      placeholder: '4312567, or a word whose letters set the order',
      randomise: { alphabet: 'letters', length: 6 },
    },
    {
      kind: 'select',
      name: 'pad',
      label: 'Last row',
      options: [
        { value: 'pad', label: 'Fill with x, y, z…' },
        { value: 'ragged', label: 'Leave it short' },
      ],
      default: 'pad',
    },
  ],
  examples: [
    {
      label: 'The textbook example',
      input: 'attackpostponeduntiltwoam',
      params: { key: '4312567', pad: 'pad' },
    },
    {
      label: 'Lecture intro: WORLD becomes RLDOW',
      input: 'WORLD',
      params: { key: '54123', pad: 'ragged' },
    },
    {
      label: 'A keyword instead of numbers',
      input: 'Meet me at the old bridge at midnight.',
      params: { key: 'KEYWORD', pad: 'pad' },
    },
    {
      label: 'Short enough for the attack to find',
      input: 'Hold the bridge until dawn.',
      params: { key: 'ZEBRA', pad: 'ragged' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return columnarTrace(input, readKey(p), 'encrypt', readPad(p));
  },

  benchmark(input: string, p: Params): string {
    return columnar(input, readKey(p), 'encrypt', readPad(p));
  },

  decrypt(input: string, p: Params): TraceResult {
    return columnarTrace(input, readKey(p), 'decrypt', readPad(p));
  },

  attack: breakColumnar,
  // Not chi-squared. A transposition leaves letter counts untouched, so the
  // statistic has to measure adjacency instead. See `attack.ts`.
  attackScoreLabel: 'bigram fit',

  visualize: ColumnarGrid,
};

export default rowTranspositionCipher;
