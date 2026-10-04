/**
 * Playfair's entry in the registry.
 *
 * The first cipher here with **no Attack tab**, and that is a deliberate use of
 * the tier system rather than an omission. Breaking Playfair properly means
 * hill-climbing over 25-letter key squares with a quadgram statistic — a real
 * technique, but one where the interesting part is the search and not the cipher.
 * A brute-force button would be a lie about the difficulty, and a disabled tab
 * would be clutter. So the tab simply does not exist, and the explainer says how
 * the cipher falls instead.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { playfairTrace } from './playfair';
import PlayfairSquare from './PlayfairSquare';

/** Params arrive as `string | number` because they come from form controls. */
function readKeyword(p: Params): string {
  return String(p['keyword'] ?? '');
}

const explainer = `
Every cipher before this one encrypts a single letter at a time. Playfair encrypts
**pairs**, and that one change makes it the first cipher here that a person cannot
break over a cup of coffee.

Charles Wheatstone invented it in 1854. Lord Playfair then promoted it to the
British government, which is how the name Playfair stuck. Britain used it in the
Boer War and in both world wars. This was not because it was strong, but because
it was strong *enough* for a message that only had to stay secret for a few hours,
and because it needs nothing but a pencil and a memorable word.

## How it works

Firstly, write a keyword into a 5x5 grid, skipping letters already used, then fill
the rest of the grid with the remaining alphabet. There are 26 letters and only 25
squares, so **I and J share one**. This is a small piece of damage that turns out
not to matter much, since "IAM" still reads as "JAM".

That grid is the whole key. Next, take the message two letters at a time, find
both in the grid, and apply whichever of the three rules fits:

- **Same row:** replace each letter with the one to its right, wrapping round.
- **Same column:** replace each letter with the one below it, wrapping round.
- **Neither:** the two letters are opposite corners of a rectangle. Replace each
  with the corner in its own row, whereby the rows stay put and the columns swap.

Decrypting uses the same three rules going the other way: left instead of right,
and up instead of down. The rectangle rule needs no reversing at all, because
swapping the columns twice puts them back. Therefore, one square both encrypts and
decrypts.

The Visualize tab draws the rule rather than describing it, with a rectangle for
the rectangle rule and a bar across the row or down the column for the other two.
The shape on the grid *is* the rule.

## What it costs

Working on pairs means that the cipher stops preserving the message:

- **Spaces and punctuation are dropped.** A cipher whose unit is a pair has
  nowhere to put them.
- **Doubled letters get a letter wedged between them.** The rules above have
  nothing to say about a letter paired with itself, so BALLOON becomes BA LX LO ON.
- **An odd message gets a Z on the end.** INSTRUMENTS has eleven letters, so it
  splits as IN ST RU ME NT SZ. Whoever reads the decryption has to notice the stray
  Z and ignore it. If the last letter is already Z, the filler is X instead.

## Lecture note

The course slides use MONARCHY and INSTRUMENTS, and that is the first example
above. The slides fill in ST → TL, ME → CL and NT → RQ and leave the rest as a quiz.
The answers are IN → GA, RU → MZ and SZ → TX. The two quiz words give BY → DB and
OF → HP. Try each one on the Encrypt tab, and watch the rule on Visualize.

The slides call Playfair "a monoalphabetic method", and the summary then puts it
under polyalphabetic ciphers. Neither name fits well. One square serves the whole
message, as in a monoalphabetic cipher, but the unit is a *pair* of letters. The
usual name is **polygraphic** (or digraphic), which is the heading it sits under
here.

This is the first real trade in the app. Caesar handed the message back
character-perfect and could be broken in seconds. Playfair, on the other hand,
mangles the text and is much harder to break. That exchange, fidelity and
convenience for strength, appears again in every serious cipher afterwards.

## Why it is genuinely harder

Single-letter frequency analysis simply has no target. In Caesar, E has an
encryption. In Playfair, E does not, and only EA, EB, EC and so on do. There are
600 possible pairs instead of 26 letters, so the same amount of ciphertext gives
an attacker far less evidence per possibility. The key space is real too: 25
letters can be arranged 25! ways, about 1.5 x 10^25, and unlike the 25 keys of
Caesar, that cannot be searched by trying them all.

## How this breaks

It breaks. It took cryptanalysts decades rather than minutes, but every one of
these steps is now routine.

**Pair frequencies survive, and pairs are still not random.** The trick that
breaks a substitution cipher works here too, one level up. TH and HE are the
commonest English pairs by a wide margin, and the commonest pairs in a long
Playfair message are their encryptions. This needs more ciphertext than breaking
Caesar does, at a few hundred letters rather than a few dozen, but the idea is
identical. In short, a bigger alphabet raised the price, but it did not change
what was for sale.

**The square is not random, and attackers know it.** A keyword is a word, and once
it runs out, the rest of the grid is **plain alphabetical order**. The bottom rows
of almost any Playfair square hold runs like UVWXZ, sitting exactly where an
attacker would guess. Therefore, a real search does not explore 25! arrangements.
It explores the far smaller space of squares that a human would actually build
from a memorable word.

**Hill-climbing finishes the job.** The modern attack starts from a random square
and scores the decryption on how English its four-letter groups look. It then
makes small changes, such as swapping two letters or two rows, and keeps whatever
improves the score. On a few hundred letters of ciphertext, this recovers the
square on an ordinary computer in seconds. **This is why there is no Attack tab on
this page.** The technique is real and worth knowing, but the interesting part is
the search, not the cipher, and a button here would misrepresent how the break
actually happens.

**A pair never encrypts to itself, and that leaks.** The rules make it impossible
for AB to become AB. That sounds like a strength, but it is a weakness, since
every pair an attacker can rule out is information. The same "never itself"
property is exactly what let Bletchley Park attack Enigma with cribs, which are
guessed pieces of the plaintext.

**The padding announces itself.** Stray Xs in odd positions and a Z on the end are visible in any
recovered plaintext, and they tell an attacker that a guess is on the right track
long before the whole message reads cleanly.

All in all, the general lesson is that **a bigger unit buys time, not safety.**
Playfair is the problem of Caesar moved from letters to pairs. The attack became
more expensive by a factor of some hundreds, and every idea behind it survived the
move intact. Real strength had to come from somewhere else entirely.
`.trim();

const playfairCipher: CipherModule = {
  slug: 'playfair',
  name: 'Playfair Cipher',
  family: 'classical',
  year: '1854',
  origin: 'Charles Wheatstone, promoted by Lord Playfair',
  keyType: 'A keyword building a 5x5 square',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['digraph', 'polygraphic', 'wheatstone', 'square'],
  blurb: 'Letters are encrypted in pairs, using three rules on a 5x5 key square.',
  explainer,
  // No 'attack'. See the note at the top of this file — the tab does not exist
  // rather than existing and doing something dishonest.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'keyword',
      label: 'Keyword',
      default: 'MONARCHY',
      placeholder: 'A memorable word. It fills the square, then the alphabet follows',
      randomise: { alphabet: 'letters', length: 8 },
    },
  ],
  examples: [
    {
      label: 'Lecture example: INSTRUMENTS',
      input: 'instruments',
      params: { keyword: 'MONARCHY' },
    },
    {
      label: 'Lecture quiz: BY and OF',
      input: 'by of',
      params: { keyword: 'MONARCHY' },
    },
    {
      label: 'Lab sheet: HIDEMONEY, padded with Z',
      input: 'HIDEMONEY',
      params: { keyword: 'MONARCHY' },
    },
    {
      label: 'A doubled letter, split by X',
      input: 'balloon',
      params: { keyword: 'MONARCHY' },
    },
    {
      label: 'A longer message',
      input: 'Meet me at the old bridge at midnight.',
      params: { keyword: 'MONARCHY' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return playfairTrace(input, readKeyword(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return playfairTrace(input, readKeyword(p), 'decrypt');
  },

  visualize: PlayfairSquare,
};

export default playfairCipher;
