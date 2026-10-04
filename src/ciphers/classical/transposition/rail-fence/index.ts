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
Rail Fence is the first cipher here that does not substitute anything. Caesar and
Vigenere both answer the question "what does this letter become". Rail Fence
answers a different one: **"where does this letter go"**. Every character survives
untouched, and only the order changes.

That family of cipher is called a **transposition**, and it is worth meeting
early, because it fails in a completely different way from everything before it.

## How it works

Firstly, pick a number of rails. Then write the message in a zigzag down and up
across them, one character per column:

- Rail 1: **W . . . E . . . C . . . R . .**
- Rail 2: **. E . R . D . S . O . E . E .**
- Rail 3: **. . A . . . I . . . V . . . D**

Next, read the rails off one at a time, left to right and top to bottom: WECR,
then ERDSOEE, then AIVD. The ciphertext is **WECRERDSOEEAIVD**.

To decrypt, the receiver rebuilds the same empty fence, which needs only the
length of the message and the rail count. The ciphertext is then written back
along the rails, and the zigzag is read off.

This cipher is a **permutation** and nothing more, which is a rule for shuffling
positions. That is the whole of it, and the Visualize tab draws exactly that: the
same character marked on the fence where it was written and in the readout where
it lands.

Every character takes part here, spaces and punctuation included. Historically,
the spacing was stripped out first, and keeping it makes the cipher weaker rather
than stronger, because the count and placement of spaces is evidence that an
attacker can use. It is kept here because the cipher then preserves the message
exactly, so the message can be seen surviving intact inside the scramble.

## Where it still appears

Transposition on its own is finished as a cipher, but it did not disappear.
Instead, it got absorbed. Modern block ciphers are built by alternating
substitution with **permutation**, over and over, in what is called a
substitution-permutation network. AES does this ten to fourteen times. The idea
below the zigzag is still running in the encryption on every phone, except that it
never runs alone.

## Lecture note

The lecture example is "meet me after the toga party" at depth 2, which gives
MEMATRHTGPRYETEFETEOAAT. That is the first example above. The quiz asks for the
same text at depth 4, and for the HELLOWORLD diagram, which reads HOLELWRDLO.

Lab 03 writes ILOVEIAS on 3 rails and gives the ciphertext as IELVASOI. The rails
actually read I·E, L·V·I·S and O·A, so the correct ciphertext is **IELVISOA**. The
lab's answer swaps two letters. Load the lab example and check each rail on the
Visualize tab.

## How this breaks

**Frequency analysis stops working, and that is not good news.** This is the
interesting part. The attack that breaks Caesar and Vigenere counts letters, and
against this cipher it is worth precisely nothing, since the ciphertext has
exactly the same letters as the plaintext, in the same quantities. Every candidate
decryption scores identically. An attacker who knew only that one technique would
conclude that the cipher was strong. It is not, and the attacker was simply
holding the wrong tool.

**Counting pairs works instead.** Transposition preserves letters and destroys
*adjacency*, which is which letter sits next to which. English is full of TH, HE,
IN and ER and almost devoid of QZ or JX, so a wrong arrangement manufactures pairs
that English would never write. The Attack tab scores each candidate on its letter
pairs rather than its letters, and the right rail count stands out immediately.
The lesson generalises: **the right statistic depends on what the cipher
destroys.**

**The key space is absurd.** The key is a small whole number. This app offers 2 to
10, and even unbounded, it can never usefully exceed the length of the message.
Nine guesses is not a key space, and the Attack tab tries all of them faster than
this sentence can be read.

**The characters are all still there.** Not one of them changed. An attacker who
suspects a transposition can confirm it in seconds by checking whether the letter
distribution already matches English, before trying a single key. A cipher that
announces its own family has already lost its first secret.

All in all, the general lesson is that **rearranging is not hiding.** A
transposition alone leaks everything about *what* was written while concealing
only the order, and the order turns out to be the easier half to reconstruct.
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
