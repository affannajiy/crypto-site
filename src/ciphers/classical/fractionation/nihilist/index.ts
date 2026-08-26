/**
 * Nihilist's entry in the registry.
 *
 * **No Attack tab.** Two unknowns again — the square and the additive keyword —
 * and, unlike Bifid, the honest reason to leave the tab out is not that the search
 * is hard. It is that the interesting attack is *statistical inference from the
 * unreduced sums*, and it needs a substantial ciphertext and a chain of reasoning
 * rather than a loop. A button that ran a 25! search would be a worse answer than
 * the explainer's account of why an analyst does not need one.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { nihilistTrace } from './nihilist';
import NihilistSums from './NihilistSums';

const explainer = `
Russian revolutionaries used this against the Tsarist secret police in the 1880s.
It is the first cipher on this site whose ciphertext is **numbers**, and the
numbers are the point.

**Step one.** A keyed 5×5 square gives every letter a two-digit coordinate: row
then column, both counted from 1, so every letter is somewhere between 11 and 55.

**Step two.** A keyword is turned into numbers the same way, repeated to the
length of the message, and **added**:

    letter   A    T    T    A    C    K
    plain    11   44   44   11   13   25
    key      31   24   15   31   24   15
    sum      42   68   59   42   37   40

That is Vigenère with a different alphabet — a repeating key added to the message.
Two things are different, and both of them are worse.

## The addition is never reduced

Vigenère adds and then takes the result modulo 26, which throws away everything
except the remainder. Nihilist adds and **keeps the whole number**. A sum can be
anything from 22 to 110.

That means the ciphertext number itself is evidence. A sum above 55 cannot have
come from a small key digit. A sum of 100 or more forces *both* tens digits to be
4 or 5. Every single character arrives with a constraint attached, free of charge,
before any frequency analysis begins. The Visualize tab counts them for you.

## How this breaks

**The key repeats, so it is Kasiski all over again.** The additive is a short word
used over and over, so every *n*th number met the same key number. Find *n* — the
same way you find it in Vigenère, from repeats and from the statistics of each
column — and the message splits into *n* separate small problems.

**And the unreduced sums make each of those problems trivial.** In Vigenère a
column is a Caesar shift and you have to count letters to solve it. Here, a column
is a single unknown key number added to a set of plaintext coordinates that are all
between 11 and 55, so the smallest ciphertext number in the column bounds the key
from above, the largest bounds it from below, and a couple of dozen characters
usually pin it exactly. The arithmetic gives the answer away before the statistics
are needed.

**Digits are not uniform either.** Both digits of a plaintext coordinate are 1–5,
so the units digit of a sum is between 2 and 10 and the tens digit between 2 and
10 as well. Nothing in the ciphertext is evenly distributed, and non-uniformity is
exactly what an analyst counts.

**The square is a second key and barely helps.** It is a 25! permutation, which
sounds enormous, but the additive falls first and once it does the whole message is
a simple substitution over coordinates — solved by counting, like every
substitution on this site.

**The lesson is about the missing modulo.** One reduction, thrown in for the sake
of arithmetic tidiness, is the difference between a cipher whose output is
featureless and one whose output describes its own key. Modern ciphers work in
fixed-width fields — bytes, words, elements of GF(2⁸) — and *always* reduce, and
this is one of the reasons why. Anything that can overflow can leak.

There is no Attack tab here, because the real attack is a chain of inferences over
a decent volume of ciphertext rather than a loop that finishes in a second. What
the page can honestly show is the leak itself, which is on the Visualize tab.
`.trim();

const nihilistCipher: CipherModule = {
  slug: 'nihilist',
  name: 'Nihilist',
  family: 'classical',
  year: '1880s',
  blurb: 'Coordinates plus a repeating key, added without reducing — so the sums leak the key.',
  explainer,
  // No 'attack'. See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'keyword',
      label: 'Square keyword',
      default: 'ZEBRAS',
      placeholder: 'A word. Fills the square, then the rest of the alphabet.',
    },
    {
      kind: 'text',
      name: 'additive',
      label: 'Additive key',
      default: 'RUSSIA',
      placeholder: 'A word. Its coordinates are added to the message.',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return nihilistTrace(input, String(p['keyword'] ?? ''), String(p['additive'] ?? ''), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return nihilistTrace(input, String(p['keyword'] ?? ''), String(p['additive'] ?? ''), 'decrypt');
  },

  visualize: NihilistSums,
};

export default nihilistCipher;
