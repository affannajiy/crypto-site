/**
 * Row transposition's entry in the registry.
 *
 * The second transposition here, and the pair is the point: Rail Fence has a
 * key space you can exhaust by hand, this one has a factorial. Both are attacked
 * with `bigramScore` rather than chi-squared, because neither one replaces a
 * letter and chi-squared cannot tell their candidates apart.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { columnar, columnarTrace } from './columnar';
import { MAX_ATTACK_WIDTH, breakColumnar } from './attack';
import ColumnarGrid from './ColumnarGrid';

/** Params arrive as `string | number` because they come from form controls. */
function readKey(p: Params): string {
  return String(p['key'] ?? '');
}

function readPad(p: Params): boolean {
  return p['pad'] !== 'ragged';
}

const explainer = `
Firstly, write the message across a grid, row by row. Then read it back out **down
the columns**, but not from left to right. The key sets the order, whereby the
column numbered 1 is read first, then 2, and so on.

    Key:        4 3 1 2 5 6 7
                -------------
                a t t a c k p
                o s t p o n e
                d u n t i l t
                w o a m x y z

    Ciphertext: TTNAAPTMTSUOAODWCOIXKNLYPETZ

Column 3 is headed 1, so \`ttna\` comes out first. Column 4 is headed 2, so
\`aptm\` comes next, and so on across the key. The message ran out after \`am\`,
so the last row is filled with \`x y z\` to make a full rectangle.

The key can also be a **keyword**. The place of each letter in the alphabet sets
the number of its column, so \`KEYWORD\` gives \`3 2 7 6 4 5 1\`, whereby D is
first, E is second and K is third. In short, a keyword is only a way to remember
the numbers.

This is the same family as Rail Fence, as no letter is ever replaced, only moved.
What changed is the key. Rail Fence hides one number between 2 and 10, whereas
this cipher hides an *arrangement*, and arrangements multiply fast. The table
below shows how fast.

| Columns | Possible orders |
| --- | --- |
| 3 | 6 |
| 5 | 120 |
| 7 | 5,040 |
| 9 | 362,880 |
| 12 | 479,001,600 |

## Padding, or a ragged last row

The filler letters are not part of the message, and decrypting cannot tell them
apart from it. They come back at the end of the plaintext, and the reader drops
them.

Setting the last row to **ragged** leaves the grid unfilled, which is how many
senders actually did it. In this case, the columns are different heights, and the
Visualize tab draws the empty cells with a dashed border. An attacker who guesses
the column order correctly but the column lengths wrongly gets nonsense. Padding,
on the other hand, makes the lengths stop being a secret at all, which is easier
to write and easier to break.

## How this breaks

**A short key can be searched exhaustively, and the Attack tab does it.** It tries
every order for every width up to ${MAX_ATTACK_WIDTH} columns and ranks them by
how English the result looks. What is being counted matters here. It is not letter
frequencies, since a transposition leaves those untouched and every candidate
would score identically. Instead, it counts **adjacent pairs**. What this cipher
destroys is which letters sit next to which, so that is what the attack measures.
Past ${MAX_ATTACK_WIDTH} columns, the search stops being practical here, which is
the honest limit of a brute force.

**However, the real break never needed a search.** Two messages of the *same
length* in the *same key* are laid out on identical grids, so the same column
order shuffles both the same way. When one is written under the other, the columns
can be slid around until both read as English at once. This technique is called
**multiple anagramming**, and it works no matter how long the key is. It is the
same shape of failure as reusing a one-time pad, whereby the algorithm is fine,
and using the key twice is what gives it away.

**Transposition alone leaves the letters lying there.** The letter counts of any
ciphertext from this page are the letter counts of ordinary English, at about 12%
E and about 9% T. That immediately tells an attacker that the message is a
transposition rather than a substitution, which halves the problem before it
starts. It also means that a crib works. A crib is a word the attacker believes is
in the message, so if GENERAL is in there, all seven of its letters are somewhere
in the ciphertext.

**Anagramming beats it by hand.** With a plausible guess at the number of columns,
a person with squared paper can cut the ciphertext into columns and physically
shuffle them until words appear. This was routine field work, not a feat.

**Doing it twice helps, but not enough.** Transposing the ciphertext a second time
with the same key scrambles it much more thoroughly. Nevertheless, it is still a
single fixed permutation that the same methods eventually undo.

To wrap up, the lesson is the one that keeps recurring: **moving letters is not
enough, and replacing letters is not enough.** Each destroys one kind of structure
and leaves the other intact. Serious ciphers do both, repeatedly, and that is
exactly what a round of a modern block cipher like AES is: a substitution step and
a permutation step, applied over and over.
`.trim();

const rowTranspositionCipher: CipherModule = {
  slug: 'row-transposition',
  name: 'Row Transposition',
  family: 'classical',
  year: '1500s',
  origin: 'European chancelleries',
  keyType: 'A column order, as numbers (4312567) or a keyword',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['transposition', 'columnar', 'grid', 'anagram', 'permutation', 'diffusion'],
  blurb: 'Write it in rows, read the columns out in the order the key gives.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key (numbers or a keyword)',
      default: '4312567',
      placeholder: '4312567, or a word whose letters set the order',
      randomise: { alphabet: 'letters', length: 6 },
    },
    {
      kind: 'select',
      name: 'pad',
      label: 'Last row',
      options: [
        { value: 'pad', label: 'Fill with x, y, z…' },
        { value: 'ragged', label: 'Leave it short' },
      ],
      default: 'pad',
    },
  ],
  examples: [
    {
      label: 'The textbook example',
      input: 'attackpostponeduntiltwoam',
      params: { key: '4312567', pad: 'pad' },
    },
    {
      label: 'A keyword instead of numbers',
      input: 'Meet me at the old bridge at midnight.',
      params: { key: 'KEYWORD', pad: 'pad' },
    },
    {
      label: 'Short enough for the attack to find',
      input: 'Hold the bridge until dawn.',
      params: { key: 'ZEBRA', pad: 'ragged' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return columnarTrace(input, readKey(p), 'encrypt', readPad(p));
  },

  benchmark(input: string, p: Params): string {
    return columnar(input, readKey(p), 'encrypt', readPad(p));
  },

  decrypt(input: string, p: Params): TraceResult {
    return columnarTrace(input, readKey(p), 'decrypt', readPad(p));
  },

  attack: breakColumnar,
  // Not chi-squared. A transposition leaves letter counts untouched, so the
  // statistic has to measure adjacency instead. See `attack.ts`.
  attackScoreLabel: 'bigram fit',

  visualize: ColumnarGrid,
};

export default rowTranspositionCipher;
