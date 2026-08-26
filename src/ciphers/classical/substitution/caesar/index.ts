/**
 * Caesar's entry in the registry.
 *
 * This file is the template every other cipher follows: metadata, the tiers it
 * earns, its parameters, and thin wiring to the pure functions next door. There
 * is no algorithm in here — that lives in `caesar.ts`, where a test can reach it.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { caesarTrace } from './caesar';
import { bruteForceCaesar } from './attack';
import CaesarRings from './CaesarRings';

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
Caesar is the cipher everyone meets first, and it is roughly two thousand years
old. Suetonius records Julius Caesar using it for military correspondence, moving
each letter three places along the alphabet.

## How it works

Pick a number from 1 to 25 — the **shift**. Move every letter that many places
forward, wrapping round from Z back to A. To read the message, move the same
number of places back.

That is the whole algorithm. Encrypting with a shift of 3 and decrypting with a
shift of 23 are the same operation, which is a hint about how little the key is
really doing.

The wrapping has a name: **modular arithmetic**, the alphabet counted modulo 26.
The step trace shows it as a plain addition or subtraction of 26, because that is
easier to check by eye — but "27 becomes 1" and "27 mod 26 = 1" are the same fact,
and every cipher after this one is built on the second phrasing.

Anything that is not an A–Z letter is left exactly as it was. Spaces stay spaces,
commas stay commas, and the digit 4 stays the digit 4. That makes the output
readable, and it is also the first thing that leaks.

## Where you still meet it

**ROT13** is Caesar with a shift of 13, still used to hide a spoiler or a punchline
in plain sight. It protects nothing. That is the point of it — it is a politeness
convention, not a cipher.

## How this breaks

Three ways, in rising order of how little effort they take.

**The key space is 25.** Not 25 million, not 2 to the power of anything. Twenty-five.
A person can try all of them by hand in a few minutes, and the Attack tab does it
instantly. A cipher whose every key can be tried is not a cipher, it is an
inconvenience. Modern ciphers answer this with key spaces around 2^128, which is
not a bigger version of the same idea — it is a different category of number.

**Letter frequencies survive.** Shifting the alphabet moves the frequency
distribution but does not flatten it. E is the most common letter in English, so
whatever letter is most common in the ciphertext is probably E, and the gap between
them is the key. The Attack tab scores each of the 25 candidates with a chi-squared
test against English letter frequencies, and on any full sentence the real key
ranks first. Try it on five letters instead and watch it fail — frequency analysis
needs volume, and seeing it break is worth more than seeing it work.

**The shape of the message leaks.** Word lengths, punctuation, capital letters at
the start of sentences, apostrophes before a final S: all of it passes straight
through. Even without touching a letter you can often guess "I'm" or "the" from the
pattern alone. This is why real ciphers work on bytes rather than letters, and why
a modern one hides the length of what you sent as well as its content.

The general lesson is the one that matters: **secrecy of the method is not
security.** Caesar is not weak because you know how it works. It is weak because
knowing the method costs an attacker a few seconds of computation. Kerckhoffs wrote
that down in 1883, and every cipher since has been designed to be safe while
published.
`.trim();

const caesarCipher: CipherModule = {
  slug: 'caesar',
  name: 'Caesar Cipher',
  family: 'classical',
  year: '~50 BC',
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

  encrypt(input: string, p: Params): TraceResult {
    return caesarTrace(input, readShift(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return caesarTrace(input, readShift(p), 'decrypt');
  },

  attack: bruteForceCaesar,
  attackScoreLabel: 'chi-squared',

  visualize: CaesarRings,
};

export default caesarCipher;
