/**
 * Bifid's entry in the registry.
 *
 * **No Attack tab.** Playfair omits one because hill-climbing over 25-letter key
 * squares is the interesting part and is out of scope. Bifid inherits that whole
 * obstacle and stacks a second one on top: the **period is unknown as well**, and
 * the two unknowns hide each other. A wrong period makes a correct square score
 * like a wrong one, so a search cannot make progress on either until it has
 * guessed the other. Bifid *is* solved in practice — assume a period, then
 * hill-climb the square, then try the next period — and that is a program with a
 * cost, not a button.
 *
 * Care taken here: an earlier draft of the explainer claimed a nearly-right square
 * produces uniformly wrong output, so there is "no gradient to climb". That is
 * false. One wrong cell corrupts only the letters that use it, which is exactly
 * the partial credit hill-climbing needs, and is why period-first solvers work.
 * The honest obstacle is the pair of coupled unknowns, not the absence of a
 * gradient.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { MAX_PERIOD, bifidTrace } from './bifid';
import BifidGrid from './BifidGrid';

/** Params arrive as `string | number` because they come from form controls. */
function readPeriod(p: Params): number {
  const value = Number(p['period']);
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_PERIOD, Math.max(0, Math.trunc(value)));
}

const explainer = `
Every cipher before this one does one of two things. A substitution **replaces**
letters; a transposition **moves** them. Félix Delastelle's Bifid, published in
1901, does a third thing, and the third thing is much stronger than either.

**It breaks each letter into two pieces and moves the pieces separately.**

Put the alphabet into a keyed 5×5 square, so every letter has a row and a column.
With the default keyword **DELASTELLE** the square is:

          1  2  3  4  5
      1   D  E  L  A  S
      2   T  B  C  F  G
      3   H  I  K  M  N
      4   O  P  Q  R  U
      5   V  W  X  Y  Z

Write a block of the message out, then its row numbers on one line and its column
numbers on the line below:

    letters   F  L  E  E  A
    rows      2  1  1  1  1
    columns   4  3  2  2  4

Now read those two lines as **one continuous stream** — all the rows, then all the
columns — and cut it into pairs:

    2 1 1 1 1 | 4 3 2 2 4   →   (2,1) (1,1) (1,4) (3,2) (2,4)
                             →    T     D     A     I     F

So FLEEA becomes TDAIF, and you can check that on this page. Now look at the third
pair, (1,4). Its first digit is the last row digit — the row of **A**. Its second
digit is the first column digit — the column of **F**. That output letter is half
of one input letter and half of a different one, taken from opposite ends of the
block.

## Why that is such a large step

Frequency analysis works because a ciphertext letter stands for a plaintext letter.
In Bifid it does not stand for anything — there is no plaintext letter it
corresponds to. Counting E's in the ciphertext tells you nothing about E's in the
message, because no single ciphertext character was ever produced by a single
plaintext character.

Delastelle also built **Trifid**, which does the same with three coordinates over
27 symbols, and **Four-square**, which is on this site too. Bifid is his most
copied idea: splitting a symbol into parts and mixing the parts is exactly what
AES does when it treats a byte as an element of a finite field, and what every
modern block cipher means by *diffusion*.

## The period

The **period** is how many letters are folded at a time. Period 5 folds five, then
starts again; period 0 folds the whole message as one block, which scatters the
pieces furthest and is the strongest setting available here.

Real Bifid always used a period, and not for security: a clerk holding a five-letter
grid in their head makes fewer mistakes than one managing a grid the length of a
telegram. It is the same trade Porta made with his one-page table. Convenience buys
errors down and buys strength away.

## How this breaks

**Not by counting letters, and that is the point of it.** A ciphertext letter does
not stand for a plaintext letter, so the tool that breaks every substitution on
this site has nothing to work with. But Bifid is not unbroken, and this page does
not have an Attack tab for a more specific reason.

**The square is a 25-letter permutation.** That is 25! ≈ 1.5 × 10²⁵ arrangements —
the same wall Playfair puts up, and brute force is finished before it starts.

**And there are two unknowns that hide each other.** The square *and* the period.
A search works by making a small change and asking whether the answer got better,
which needs a nearly-right key to score better than a wrong one. In Bifid that
works only once the period is right: with the wrong period the fold is misaligned
everywhere, so a perfectly correct square scores like a random one and the search
has nothing to follow. Neither unknown can be solved while the other is wrong.

The practical solution is therefore **period first**: assume a period, hill-climb
the square against a bigram score, keep the best, then try the next period. That
works — Bifid is solved routinely by people who do this for fun — and it is a
program you run for a while, not a button that returns an answer. Putting a button
here would misrepresent the cost, which is the same judgement Playfair's page makes.

**What does break it:** several messages **in depth** — the same square and period
used repeatedly — which lets an analyst line up the coordinate streams and solve
them together. The same weakness that killed the One-Time Pad when its key was
reused, and killed ADFGVX. Key reuse is the recurring assassin of this whole site.

**And known plaintext still finishes it.** A crib of a dozen letters pins down
enough cells of the square to unravel the rest. As with Hill and Enigma, this app's
attack contract only receives ciphertext, so that attack cannot be offered here —
which is a limit of the tool, and is recorded as such.

**Do not read "hard to break in 1901" as "safe".** A 5×5 square holds about 84 bits
of key in theory and far less in practice, since real keywords are words. Bifid is
here because fractionation is the idea that survives into modern cryptography, not
because the cipher does.
`.trim();

const bifidCipher: CipherModule = {
  slug: 'bifid',
  name: 'Bifid',
  family: 'classical',
  year: '1901',
  origin: 'Felix Delastelle',
  keyType: 'A keyed 5x5 square and a period',
  security: 'broken',
  difficulty: 'advanced',
  keywords: ['delastelle', 'fractionation', 'polybius', 'period'],
  blurb: 'Splits each letter into two coordinates and mixes the halves. No letter survives whole.',
  explainer,
  // No 'attack'. 25! squares, an unknown period, and no partial credit to climb.
  // See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'keyword',
      label: 'Square keyword',
      default: 'DELASTELLE',
      placeholder: 'A word. Fills the square, then the rest of the alphabet.',
      randomise: { alphabet: 'letters', length: 8 },
    },
    {
      kind: 'number',
      name: 'period',
      label: 'Period (0 folds the whole message at once)',
      min: 0,
      max: MAX_PERIOD,
      default: 5,
    },
  ],
  examples: [
    {
      label: 'Delastelle\'s own key',
      input: 'Meet me at the old bridge at midnight.',
      params: { keyword: 'DELASTELLE', period: 5 },
    },
    {
      label: 'A long period mixes further',
      input: 'Send the second company to the eastern gate before dawn.',
      params: { keyword: 'ZEBRAS', period: 11 },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return bifidTrace(input, String(p['keyword'] ?? ''), readPeriod(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return bifidTrace(input, String(p['keyword'] ?? ''), readPeriod(p), 'decrypt');
  },

  visualize: BifidGrid,
};

export default bifidCipher;
