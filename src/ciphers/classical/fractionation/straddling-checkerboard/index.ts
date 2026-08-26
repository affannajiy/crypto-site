/**
 * The straddling checkerboard's entry in the registry.
 *
 * **No Attack tab**, and the reason is the same shape as Bacon's: on its own this
 * is a *code*, not an encryption. The board is a public construction and the only
 * secret is which arrangement was used — and the arrangement falls to frequency
 * analysis immediately, because the one-digit codes are, by design, the common
 * letters. Attacking it is counting, and counting is what the Caesar page already
 * demonstrates. Its real use was as the **first stage** of something larger.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { checkerboardTrace } from './checkerboard';
import CheckerboardTable from './CheckerboardTable';

const explainer = `
Every other cipher here gives each letter a code of the same length. This one does
not, and that difference is why it is the most modern-looking thing in the
classical section.

Ten columns, numbered 0–9. The eight most useful symbols go on the top row and get
a **one-digit** code. Two columns are left **empty** on that row, and those two
digits become prefixes for the rows below, where everything else gets a
**two-digit** code:

          0  1  2  3  4  5  6  7  8  9
          A  T     O  N  E     S  I  R
      2   B  C  D  F  G  H  J  K  L  M
      6   P  Q  U  V  W  X  Y  Z  .  /

E is **5**. K is **27**. And because 2 and 6 never stand alone, a reader going
left to right always knows which is which — **no separators are needed and no
ambiguity is possible**.

## Two ideas, both of which outlived the cipher

**It is a prefix-free code.** No code is the start of any other code, which is
exactly the property that lets a stream be decoded from front to back with no
lengths and no delimiters. Huffman formalised this in 1952 and every compression
format since has depended on it. A hand cipher got there first, by needing to.

**It compresses.** English is mostly the letters on the top row, so a message costs
well under two digits per letter — the Visualize tab measures it as you type,
against the flat 2.00 a Polybius square charges. Shorter ciphertext is not a
cosmetic win: less material is less to analyse, and a cipher clerk sending by hand
counts every character.

The Soviet **VIC cipher** — the most complicated hand cipher known to have been
used in the field, carried by the agent Reino Häyhänen and discovered in 1953 when
a hollowed-out nickel turned up in a New York newspaper boy's change — begins with
a straddling checkerboard and then applies two transpositions on top.

## How this breaks

**On its own it is a code, not an encryption, and it falls to counting.** The board
is a published construction; the only secret is which arrangement was used. And the
arrangement is not well hidden, because the design deliberately puts the *common*
letters in the one-digit slots. So:

- Count how often each digit begins a code. The eight one-digit codes will be far
  more frequent than the two escapes, which identifies the escapes immediately.
- The most common single digits are the most common English letters, in order —
  E, T, A, O, N, I, S, R, roughly.
- The rest follows from digraphs and short words.

That is straightforward frequency analysis, and it is the same work the Caesar page
already shows. There is no Attack tab here because it would be that page again with
a different alphabet.

**Its security was never meant to come from this stage.** The checkerboard was the
*first* of several operations, and the ones that followed carried the weight. VIC's
strength is in its transpositions and its key derivation, not in its board. Judging
this cipher alone is judging a component out of context — which is a real analytical
mistake and not just a courtesy: AES's S-box is trivially invertible on its own too.

**And a variable-length code leaks length.** A ciphertext that is 1.6 digits per
letter is telling you the plaintext is ordinary English; one at 1.95 is telling you
it is not — a code, a foreign language, or already encrypted. That is a small leak
and it is the kind that turns out to matter: TLS has had real attacks built on
compressed message lengths, most famously **CRIME** in 2012. **Compressing before
encrypting leaks information about the plaintext through the ciphertext's size**,
and this eighty-year-old board is the smallest example of it.
`.trim();

const checkerboardCipher: CipherModule = {
  slug: 'straddling-checkerboard',
  name: 'Straddling Checkerboard',
  family: 'classical',
  year: '1930s',
  blurb: 'Common letters cost one digit, rare ones two. A prefix-free code, decades early.',
  explainer,
  // No 'attack'. On its own this is a code, and breaking it is the frequency
  // analysis the Caesar page already demonstrates. See the file header.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'keyword',
      label: 'Board arrangement (the top row comes first)',
      default: 'ATONESIR',
      placeholder: 'Put the eight commonest letters first',
    },
    {
      kind: 'text',
      name: 'escapes',
      label: 'Escape digits (two of 0-9)',
      default: '26',
      placeholder: 'Two digits, e.g. 26',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return checkerboardTrace(input, String(p['keyword'] ?? ''), String(p['escapes'] ?? ''), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return checkerboardTrace(input, String(p['keyword'] ?? ''), String(p['escapes'] ?? ''), 'decrypt');
  },

  visualize: CheckerboardTable,
};

export default checkerboardCipher;
