/**
 * Four-square's entry in the registry.
 *
 * **No Attack tab**, and the reason is Playfair's: a search over keyed 5x5 squares
 * is a hill-climbing program rather than a button, and there are two squares here
 * instead of one.
 *
 * The explainer does the more interesting job, which is to say plainly that a
 * *larger* key does not make this cipher *harder to break* than Playfair. It is
 * easier, because removing Playfair's three awkward special cases also removed
 * three sources of irregularity, and digraph frequency analysis is cleaner as a
 * result. Bigger key, weaker cipher — a combination people do not expect.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { fourSquareTrace } from './foursquare';
import FourSquareGrid from './FourSquareGrid';

const explainer = `
Playfair encrypts letters in pairs using **one** 5×5 square, and pays for it with
three special cases: letters in the same row, letters in the same column, and a
doubled letter that has to be broken up with a filler. Every one of those is a
patch for the rectangle rule failing.

Four-square uses **four** squares and needs no patches.

    ┌──────────┬──────────┐
    │  plain   │  key 1   │     Look up the first letter in the top-left square
    │          │  (keyed) │     and the second in the bottom-right. They are two
    ├──────────┼──────────┤     corners of a rectangle. Read the other two
    │  key 2   │  plain   │     corners out of the keyed squares: top-right
    │  (keyed) │          │     first, bottom-left second.
    └──────────┴──────────┘

The two plain squares sit on one diagonal and the two keyed squares on the other,
so **the rectangle always has four distinct corners**. Two letters in the same row
are fine. Two letters in the same column are fine. EE is fine. The rule never
degenerates, so it never needs an exception.

Félix Delastelle again — the same man as Bifid and Trifid, who was an accountant
and did this in his spare time.

## The key is much larger

Playfair has one 25-letter square: 25! ≈ 1.5 × 10²⁵ arrangements. Four-square has
two, which is 25!² ≈ 2.4 × 10⁵⁰ if the squares are chosen freely. On paper that is
an enormous improvement.

## How this breaks

**By digraph frequency analysis — and more easily than Playfair.** This is the part
worth sitting with, because it runs directly against the arithmetic above.

A pair of letters always encrypts to the same pair of letters, exactly as in
Playfair, so counting *pairs* works: TH and HE and IN are as common in English
digraphs as E and T are in English letters, and a long enough ciphertext hands them
over. That much the two ciphers share.

What they do not share is regularity. Playfair's three special cases are ugly, and
ugliness is *noise*: a pair in the same row behaves differently from a pair in a
rectangle, so the analyst's model has to account for several rules at once, and the
reciprocal structure that Playfair does have is partly obscured. Four-square is one
clean rule with no exceptions, which means every observed pair is evidence of the
same kind, and evidence of one kind is much easier to accumulate.

**A bigger key space did not make it harder to break.** It made the arithmetic
bigger and the *structure* simpler, and cryptanalysis attacks structure. This is
one of the most durable lessons on this site and it keeps arriving from different
directions: Hill's 3×3 key is astronomically larger than its 2×2 and falls to the
same four equations; Enigma's plugboard multiplies the key space by a factor no
bombe ever had to search; Porta's neat thirteen-row table halves its own key space
by accident. **Key size is not strength.**

**Known plaintext still finishes it.** A crib pins down cells in both keyed squares
directly, and the squares unravel from there. As with Hill and Enigma, this app's
attack contract only receives ciphertext, so that attack cannot be offered here.

**And it inherits Playfair's other problem.** Twenty-five cells, twenty-six letters,
so **J is written as I** and the difference is destroyed. Bifid has the same wound.
Trifid, using 27 symbols, is the one Delastelle cipher that does not.
`.trim();

const fourSquareCipher: CipherModule = {
  slug: 'four-square',
  name: 'Four-square',
  family: 'classical',
  year: '1902',
  blurb: 'Playfair with four squares and no special cases. Bigger key, easier to break.',
  explainer,
  // No 'attack'. Two keyed squares is a hill-climbing program, not a button.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'keyOne',
      label: 'Key one (top-right square)',
      default: 'EXAMPLE',
      placeholder: 'A word. Fills the square, then the rest of the alphabet.',
    },
    {
      kind: 'text',
      name: 'keyTwo',
      label: 'Key two (bottom-left square)',
      default: 'KEYWORD',
      placeholder: 'A different word.',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return fourSquareTrace(input, String(p['keyOne'] ?? ''), String(p['keyTwo'] ?? ''), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return fourSquareTrace(input, String(p['keyOne'] ?? ''), String(p['keyTwo'] ?? ''), 'decrypt');
  },

  visualize: FourSquareGrid,
};

export default fourSquareCipher;
