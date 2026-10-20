/**
 * Rail Fence's entry in the registry.
 *
 * Metadata, the tiers it earns, its parameters, and thin wiring to the pure
 * functions next door. There is no algorithm in here — that lives in
 * `railfence.ts` and `attack.ts`, where a test can reach it.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { MAX_RAILS, MIN_RAILS, railFenceTrace } from './railfence';
import { breakRailFence } from './attack';
import RailFenceZigzag from './RailFenceZigzag';

/**
 * Params arrive as `string | number` because they come from form controls. The
 * message is written for the person who will read it, not for a log.
 */
function readRails(p: Params): number {
  const rails = Number(p['rails']);
  if (!Number.isFinite(rails)) {
    throw new Error(`Rails needs to be a whole number between ${MIN_RAILS} and ${MAX_RAILS}.`);
  }
  return Math.trunc(rails);
}

const explainer = `
Letters are not changed, only reordered on a zigzag. This kind of cipher is called a **transposition**.

## How it works

- Write the message in a zigzag down and up across the rails.
- Read each rail from left to right, top rail first. WEAREDISCOVERED on 3 rails gives **WECRERDSOEEAIVD**.
- To decrypt, rebuild the empty fence from the length and the rail count. Fill the rails, then read the zigzag.
- Spaces and punctuation count as characters here.

## Lecture note

- "meet me after the toga party" at depth 2 gives MEMATRHTGPRYETEFETEOAAT.
- HELLOWORLD on 3 rails gives HOLELWRDLO.
- Lab 03 gives ILOVEIAS on 3 rails as IELVASOI. The correct answer is **IELVISOA**. The lab swaps two letters.

## How this breaks

- **Letter counts do not help.** Every candidate has the same letters, so chi-squared gives them all the same score.
- **Letter pairs do help.** A wrong arrangement makes pairs such as QZ. The Attack tab scores the bigram fit of every rail count.
- **The key space is tiny.** There are only 2 to 10 rails.
`.trim();

const railFenceCipher: CipherModule = {
  slug: 'rail-fence',
  name: 'Rail Fence Cipher',
  family: 'classical',
  year: '~500 BC',
  origin: 'Classical; the scytale idea in two dimensions',
  keyType: 'A rail count',
  security: 'broken',
  difficulty: 'beginner',
  keywords: ['transposition', 'zigzag', 'scytale', 'permutation'],
  blurb: 'The message zigzags across a set of rails, then is read off row by row.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'number',
      name: 'rails',
      label: 'Rails',
      min: MIN_RAILS,
      max: MAX_RAILS,
      default: 2,
    },
  ],
  quizzes: [
    {
      question: 'What is the encrypted text of "meet me after the toga party" with a rail fence of depth 2?',
      run: { input: 'meetmeafterthetogaparty', params: { rails: 2 } },
    },
    {
      question: 'What is the encrypted text if the rail fence depth is 4?',
      run: { input: 'meetmeafterthetogaparty', params: { rails: 4 } },
    },
  ],
  examples: [
    {
      label: 'The textbook example, depth 2',
      input: 'meetmeafterthetogaparty',
      params: { rails: 2 },
    },
    {
      label: 'Lecture quiz: the same text at depth 4',
      input: 'meetmeafterthetogaparty',
      params: { rails: 4 },
    },
    {
      label: 'Lecture quiz diagram: HELLOWORLD, 3 rails',
      input: 'HELLOWORLD',
      params: { rails: 3 },
    },
    {
      label: 'Lab sheet: ILOVEIAS, 3 rails',
      input: 'ILOVEIAS',
      params: { rails: 3 },
    },
    {
      label: 'Three rails',
      input: 'Meet me at the old bridge at midnight.',
      params: { rails: 3 },
    },
    {
      label: 'Two rails is barely a cipher',
      input: 'With two rails the letters simply alternate.',
      params: { rails: 2 },
    },
    {
      label: 'Seven rails',
      input: 'Send the guns to the eastern gate before dawn.',
      params: { rails: 7 },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return railFenceTrace(input, readRails(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return railFenceTrace(input, readRails(p), 'decrypt');
  },

  attack: breakRailFence,
  attackScoreLabel: 'bigram fit',

  visualize: RailFenceZigzag,
};

export default railFenceCipher;
