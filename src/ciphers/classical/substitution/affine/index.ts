/**
 * Affine's entry in the registry.
 *
 * The first cipher here to use a `select` parameter, and it uses one for a reason
 * rather than for variety: `a` has exactly twelve legal values, and a number
 * input would invite people to type the other fourteen and get a cipher that
 * cannot be decrypted. A control that cannot express an invalid key is better
 * than a validation message explaining one.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { VALID_MULTIPLIERS, affineTrace, isValidMultiplier } from './affine';
import { breakAffine } from './attack';
import AffineMapping from './AffineMapping';

/**
 * Params arrive as `string | number` because they come from form controls — and a
 * `select` always hands back a string, which is why this cannot skip the `Number`.
 */
function readKey(p: Params): { a: number; b: number } {
  const a = Number(p['a']);
  const b = Number(p['b']);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('The key needs two whole numbers: a multiplier and a shift.');
  }
  if (!isValidMultiplier(a)) {
    throw new Error(
      `${a} shares a factor with 26, so the cipher could not be decrypted. Pick a multiplier from the list.`,
    );
  }
  return { a: Math.trunc(a), b: Math.trunc(b) };
}

const explainer = `
Affine is Caesar with one more operation. Caesar adds a number to every letter;
Affine multiplies first, then adds:

**E(x) = (a × x + b) mod 26**

Set **a = 1** and the multiplication does nothing, leaving exactly Caesar. That
makes this the first cipher here that contains an earlier one inside it, and it is
a useful habit of mind: new ciphers are usually old ciphers with a parameter added.

## How it works

Number the letters A = 0 through Z = 25. To encrypt a letter, multiply its number
by **a**, add **b**, and wrap the answer into 0–25.

With a = 5 and b = 8, the letter A is 0, so 5 × 0 + 8 = 8, and A becomes I. The
letter F is 5, so 5 × 5 + 8 = 33, which wraps to 33 − 26 = 7, and F becomes H.

Decrypting has to undo both operations, in reverse order: subtract **b**, then
divide by **a**. Except you cannot divide in modular arithmetic — you multiply by
the **modular inverse** instead, the number that turns multiplying by *a* back
into multiplying by 1. For a = 5 that number is 21, because 5 × 21 = 105, and 105
is 4 × 26 + 1.

## Why only twelve multipliers

This is the part worth slowing down for, and it is why the multiplier is a
dropdown rather than a box you type in.

**a must share no factor with 26.** Twenty-six factors as 2 × 13, so every even
number and every multiple of 13 is disqualified. That leaves twelve legal values:
1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23 and 25.

Try a = 2 and watch what happens: A (0) becomes 0, and N (13) becomes 26, which
wraps back to 0. Both become the same letter. So do B and O, C and P, and eleven
more pairs. The alphabet collapses from 26 letters to 13, and once two letters
have become one, **nobody** can separate them again — not an attacker, and not the
person holding the key. The Visualize tab has a toggle that draws this: the lines
converge two-to-one and half the alphabet greys out as unreachable.

A cipher must be a one-to-one mapping. That is not a rule someone imposed on
Affine; it is what the word "decrypt" means.

## How this breaks

**The key space is 312.** Twelve multipliers times 26 shifts. That is more than
Caesar's 25 and it is in the same category of number: small enough to write out.
The Attack tab tries every key and ranks them, and it finishes instantly.

**It is still a monoalphabetic substitution.** This is the important one. All the
multiplication buys you is a *different* fixed alphabet — every A in the message
still becomes the same letter, everywhere, every time. So the letter frequencies
are not flattened, only shuffled, and the chi-squared test that breaks Caesar
works here completely unchanged. The Attack tab is running the same statistic it
runs on Caesar.

**Two known letters give up the whole key.** If you can guess what two ciphertext
letters decrypt to — and the commonest letters in any English message are almost
always E and T — then you have two equations in two unknowns, and solving them for
a and b is school algebra. You do not have to search at all. This is a
**known-plaintext attack**, and Affine is the first cipher here that falls to one
outright.

**Structure in the key is visible in the output.** Because the mapping is a
straight line, letters that were adjacent in the alphabet stay a fixed distance
apart after encryption. An attacker who spots two ciphertext letters five apart
knows something about *a* immediately.

The general lesson: **more arithmetic is not more security.** Affine does strictly
more work than Caesar and is broken by exactly the same technique in exactly the
same amount of time. What makes a cipher strong is not the complexity of one step
but whether the same plaintext letter can come out differently in different
places — and that is the thing Affine, like Caesar, never does.
`.trim();

const affineCipher: CipherModule = {
  slug: 'affine',
  name: 'Affine Cipher',
  family: 'classical',
  year: 'ancient',
  blurb: 'Each letter is multiplied and shifted: a straight line in modular arithmetic.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'select',
      name: 'a',
      label: 'Multiplier (a)',
      // Only the twelve values coprime with 26. The other fourteen produce a
      // mapping that cannot be reversed, so the control does not offer them.
      options: VALID_MULTIPLIERS.map((value) => ({ value: String(value), label: String(value) })),
      default: '5',
    },
    {
      kind: 'number',
      name: 'b',
      label: 'Shift (b)',
      min: 0,
      max: 25,
      default: 8,
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    const { a, b } = readKey(p);
    return affineTrace(input, a, b, 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    const { a, b } = readKey(p);
    return affineTrace(input, a, b, 'decrypt');
  },

  attack: breakAffine,
  attackScoreLabel: 'chi-squared',

  visualize: AffineMapping,
};

export default affineCipher;
