/**
 * ADFGVX's entry in the registry.
 *
 * **No Attack tab**, and this is the sixth distinct reason in the app. Not "the
 * search is too large" (Playfair), not "no search exists" (One-Time Pad), not
 * "there is nothing to search" (Atbash), not "the contract cannot hold a crib"
 * (Hill, Enigma), not "two unknowns hide each other" (Bifid).
 *
 * ADFGVX was broken, comprehensively, in June 1918 — and the method needed
 * **several messages of the same length sent on the same day**. Painvin lined up
 * messages that shared a transposition and used the fact that the same column
 * structure applied to all of them. `attack(ciphertext)` receives exactly one
 * ciphertext, so the historical break cannot be expressed at all, in the same way
 * a crib cannot. That is the same contract gap wearing a different hat, and it is
 * worth recording that the gap has now been hit by four ciphers.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { adfgvxTrace } from './adfgvx';
import AdfgvxStages from './AdfgvxStages';

const explainer = `
The German army introduced ADFGX in March 1918 and extended it to **ADFGVX** in
June, three months before the war ended. It is the most sophisticated field cipher
of the First World War, and it is the first cipher on this site built the way a
modern one is: **two ordinary operations composed so that each covers the other's
weakness.**

## Stage one: fractionate

A keyed **6×6** square holds the twenty-six letters *and the ten digits*. Rows and
columns are labelled A, D, F, G, V, X, so every character becomes two of those six
letters and the message doubles in length.

Two details are worth pausing on. The digits are why the German army could send map
references and grid coordinates — Playfair's 5×5 square has twenty-five cells and
no room for numbers, which is a real operational limit and not a footnote. And the
six labels were chosen because **in Morse code they are the six characters least
likely to be mistaken for one another** over a noisy wireless link. That is radio
engineering, not cryptography, and it is the sort of decision that determines
whether a cipher is used at all.

## Stage two: transpose

The doubled string is written in rows under a second keyword and read off one
column at a time, in the keyword's alphabetical order. That is exactly the
**Columnar Transposition** elsewhere on this site — this page imports that code
rather than reimplementing it, because it is not a variation on it, it *is* it.

## Why the composition is the point

Take either half on its own and it collapses.

**Fractionation alone is a substitution.** Each character always becomes the same
pair, so counting pairs breaks it in an afternoon — it is Playfair's weakness with
extra steps.

**Transposition alone preserves every letter.** Every candidate rearrangement has
identical letter counts, so you attack it by anagramming towards readable English,
which is what the Columnar page's Attack tab does.

Composed, each attack loses its target. The transposition tears the two halves of
every character to opposite ends of the message — the Visualize tab measures the
distance for whichever character you are looking at — so there are no pairs left to
count. And because the underlying text is ADFGVX gibberish rather than English,
there is nothing to anagram *towards*.

**This is what "confusion and diffusion" means**, thirty years before Shannon named
them. AES is the same shape: a substitution step and a mixing step, alternating,
each useless alone.

## How this breaks

**It was broken in about eight weeks, by Georges Painvin.** He recovered the key
to a message on 2 June 1918 that revealed where a German offensive would fall,
and reportedly lost fifteen kilograms doing it.

**The method needed messages in depth.** Painvin's technique required **several
intercepts of the same length, sent on the same day**, sharing a transposition key.
With more than one message the column structure can be lined up across them, the
transposition falls out, and once the transposition is gone the fractionation is
just a substitution over pairs — which is where frequency analysis walks back in.

That is why there is no Attack tab here. The historical break does not take one
ciphertext; it takes a stack of them, and this app's attack contract is given
exactly one. A single-message brute force would be a different, worse thing wearing
the same label.

**The keys were changed daily and it did not save them.** Volume did the damage:
enough traffic in one day is enough traffic to work with, and a cipher that is safe
for one message and unsafe for twenty is unsafe.

**Key reuse, again.** This is the fourth cipher on this site killed by it — after
the One-Time Pad, and it is what would finish Bifid and Trifid too. Reusing a key
is the single most reliable way to destroy an otherwise sound cipher, and it is
still the most common real-world failure: a repeated nonce does exactly this to
AES-GCM and ChaCha20-Poly1305 today.

**And the wire made it worse.** Messages had to be sent in five-letter groups by
Morse, so lengths were known precisely, and knowing lengths is what let Painvin
match messages up in the first place. Metadata was the way in, long before anyone
used that word.
`.trim();

const adfgvxCipher: CipherModule = {
  slug: 'adfgvx',
  name: 'ADFGVX',
  family: 'classical',
  year: '1918',
  blurb: 'Fractionate, then transpose. Two weak ideas composed into the best cipher of the war.',
  explainer,
  // No 'attack'. Painvin's break needed several messages in depth, and
  // `attack(ciphertext)` receives one. See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'keyword',
      label: 'Square keyword (letters and digits)',
      default: 'PAINVIN1918',
      placeholder: 'Fills the 6x6 square, then the rest of the alphabet and digits.',
    },
    {
      kind: 'text',
      name: 'transposition',
      label: 'Transposition keyword',
      default: 'ARGUS',
      placeholder: 'Its alphabetical order decides the column order.',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return adfgvxTrace(input, String(p['keyword'] ?? ''), String(p['transposition'] ?? ''), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return adfgvxTrace(input, String(p['keyword'] ?? ''), String(p['transposition'] ?? ''), 'decrypt');
  },

  visualize: AdfgvxStages,
};

export default adfgvxCipher;
