/**
 * Columnar transposition's entry in the registry.
 *
 * The second transposition here, and the pair is the point: Rail Fence has a
 * key space you can exhaust by hand, this one has a factorial. Both are attacked
 * with `bigramScore` rather than chi-squared, because neither one replaces a
 * letter and chi-squared cannot tell their candidates apart.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { columnarTrace } from './columnar';
import { MAX_ATTACK_WIDTH, breakColumnar } from './attack';
import ColumnarGrid from './ColumnarGrid';

/** Params arrive as `string | number` because they come from form controls. */
function readKeyword(p: Params): string {
  return String(p['keyword'] ?? '');
}

const explainer = `
Write the message across a grid, row by row. Then read it back out **down the
columns** — but not left to right. A keyword sets the order.

    K  E  Y  W  O  R  D
    3  2  7  6  4  5  1
    ------------------
    m  e  e  t  m  e  a
    t  t  h  e  o  l  d
    b  r  i  d  g  e

The number under each letter is where that letter falls in alphabetical order: D
is first, E is second, K is third, and so on. So the D column is read first, then
E, then K — giving \`ad\`, \`etr\`, \`mtb\`, and so on down the ranking.

This is the same family as Rail Fence: no letter is ever replaced, only moved.
What changed is the key. Rail Fence hides one number between 2 and 10. This hides
an *arrangement*, and arrangements multiply fast.

| Columns | Possible orders |
| --- | --- |
| 3 | 6 |
| 5 | 120 |
| 7 | 5,040 |
| 9 | 362,880 |
| 12 | 479,001,600 |

## The ragged bottom row

Look at the grid again: the message ran out partway through the last row, so the
K, E and Y columns hold three characters and the rest hold two. **This is not a
detail.** An attacker who guesses the column order correctly but the column
lengths wrongly gets nonsense, because every character after the first short
column is offset. Historically, senders sometimes padded the grid out to a full
rectangle with nulls — which made it easier to write and considerably easier to
break, since the lengths stopped being a secret at all.

This page leaves the last row ragged, and the Visualize tab draws the empty cells
with a dashed border so you can see the columns are different heights.

## How this breaks

**A short key can be searched exhaustively, and the Attack tab does it.** Every
order for every width up to ${MAX_ATTACK_WIDTH} columns, ranked by how English the
result looks. Note what is being counted: not letter frequencies — a transposition
leaves those untouched, so every candidate scores identically — but **adjacent
pairs**. What this cipher destroys is which letters sit next to which, so that is
what the attack measures. Widen the key past ${MAX_ATTACK_WIDTH} and the search
stops being practical here, which is the honest limit of a brute force.

**But the real break never needed a search.** Two messages of the *same length*
in the *same key* are laid out on identical grids, so the same column order shuffles
both the same way. Write one under the other and the columns can be slid around
until both read as English at once — a technique called **multiple anagramming**,
and it works no matter how long the key is. It is the same shape of failure as
reusing a one-time pad: the algorithm is fine, and using the key twice is what
gives it away.

**Transposition alone leaves the letters lying there.** Count the letters of any
ciphertext from this page and you get the letter counts of ordinary English —
about 12% E, about 9% T. That immediately tells an attacker they are looking at a
transposition rather than a substitution, which halves their problem before they
start. It also means a crib works: if you believe the word GENERAL is in there,
all seven of its letters are, and they are in the ciphertext somewhere.

**Anagramming beats it by hand.** With a plausible guess at the number of columns,
a person with squared paper can cut the ciphertext into columns and physically
shuffle them until words appear. This was routine field work, not a feat.

The lesson is the one that keeps recurring: **moving letters is not enough, and
replacing letters is not enough.** Each destroys one kind of structure and leaves
the other intact. Serious ciphers do both, repeatedly — and that is exactly what
the round of a modern block cipher like AES is, a substitution step and a
permutation step, applied over and over.
`.trim();

const columnarCipher: CipherModule = {
  slug: 'columnar',
  name: 'Columnar Transposition',
  family: 'classical',
  year: '1500s',
  blurb: 'Write it in a grid, read the columns out in keyword order.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'keyword',
      label: 'Keyword',
      default: 'KEYWORD',
      placeholder: 'A word — its letters set the column order',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return columnarTrace(input, readKeyword(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return columnarTrace(input, readKeyword(p), 'decrypt');
  },

  attack: breakColumnar,
  // Not chi-squared. A transposition leaves letter counts untouched, so the
  // statistic has to measure adjacency instead. See `attack.ts`.
  attackScoreLabel: 'bigram fit',

  visualize: ColumnarGrid,
};

export default columnarCipher;
