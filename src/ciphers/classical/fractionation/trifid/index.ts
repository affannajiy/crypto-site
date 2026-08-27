/**
 * Trifid's entry in the registry.
 *
 * **No Attack tab**, for Bifid's reasons with the numbers made worse: the key is a
 * 27-symbol permutation instead of 25, and the period is still unknown. Nothing
 * new is being said by omitting the tab twice, and that is itself worth recording
 * — the six original ciphers without an Attack tab each had a distinct reason, and
 * that stopped being true here. Better to say so than to invent a difference.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { MAX_PERIOD, trifidTrace } from './trifid';
import TrifidCube from './TrifidCube';

/** Params arrive as `string | number` because they come from form controls. */
function readPeriod(p: Params): number {
  const value = Number(p['period']);
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_PERIOD, Math.max(0, Math.trunc(value)));
}

const explainer = `
Félix Delastelle published Bifid in 1901 and this a year later. Bifid splits each
letter into **two** coordinates. Trifid splits it into **three**, and the third
coordinate is not decoration.

## The alphabet fits, for once

Twenty-six letters do not fill a cube. 3³ is 27, so Trifid uses **27 symbols**: the
alphabet plus one spare, written here as a full stop.

That is a better accident than it looks. Bifid needed 25 cells for 26 letters and
had to throw one away — J is written as I, and the information is simply gone.
Trifid has a cell left over, so **every letter keeps its own identity** and J
survives. Choosing the alphabet to fit the arithmetic, rather than forcing the
arithmetic to fit the alphabet, is a habit modern cryptography never breaks: AES
works on bytes and not on letters for exactly this reason.

## The fold

Every symbol has a layer, a row and a column, each 1–3. Write those as three lines
under the message, read the whole grid as one stream, and cut it into **triples**:

    symbols   F  L  E  E
    layers    1  2  1  1
    rows      2  1  2  2
    columns   3  3  2  2

    stream    1 2 1 1 | 2 1 2 2 | 3 3 2 2

    triples   (1,2,1) (1,2,1) (2,2,3) (3,2,2)

A Bifid pair can reach into at most **two** plaintext letters. A Trifid triple can
reach into **three**. The Visualize tab counts it for the letter you are looking
at, so it is a number on the screen rather than a claim in a paragraph.

## How this breaks

**The same way Bifid does, and the numbers are worse for the attacker.**

**The key is a 27-symbol permutation** — 27! ≈ 1.1 × 10²⁸, about ten thousand times
Bifid's 25!. Brute force was never the route and is even less so here.

**And the period is still unknown**, so the same two coupled unknowns apply: with
the wrong period the fold is misaligned everywhere, and a perfectly correct cube
scores like a random one. Neither can be solved while the other is wrong, so the
practical route is period first, then hill-climb the cube — a program you run, not
a button that answers. There is no Attack tab for that reason, which is exactly
Bifid's reason. Nothing new is being claimed by leaving it out twice.

**What does break it is depth.** Several messages under the same cube and period
let an analyst line up the coordinate streams and solve them together. That is the
same weakness that finished ADFGVX and the same one that finished a reused
One-Time Pad. Key reuse is the recurring assassin of this entire site, and it has
now taken four different ciphers by four different mechanisms.

**Trifid is stronger than Bifid and both are classical ciphers.** Stronger here
means "resisted pencil-and-paper analysts for longer", which is a claim about 1902.
A modern laptop hill-climbs either of them, and neither has any of the properties —
key length, avalanche, authentication — that make a cipher usable today. The
fractionation idea is what survives; the ciphers are museum pieces.
`.trim();

const trifidCipher: CipherModule = {
  slug: 'trifid',
  name: 'Trifid',
  family: 'classical',
  year: '1902',
  origin: 'Felix Delastelle',
  keyType: 'A keyed 27-symbol cube and a period',
  security: 'broken',
  difficulty: 'advanced',
  keywords: ['delastelle', 'fractionation', 'cube', 'period'],
  blurb: 'Three coordinates instead of two, on 27 symbols that fit a cube exactly.',
  explainer,
  // No 'attack'. Bifid's obstacles with a larger key space. See the file header.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'keyword',
      label: 'Cube keyword',
      default: 'DELASTELLE',
      placeholder: 'A word. Fills the cube, then the rest of the alphabet.',
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
      label: 'A 27-symbol cube',
      input: 'Meet me at the old bridge at midnight.',
      params: { keyword: 'DELASTELLE', period: 5 },
    },
    {
      label: 'Period of one is no fractionation at all',
      input: 'With a period of one nothing is mixed between letters.',
      params: { keyword: 'ZEBRAS', period: 1 },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return trifidTrace(input, String(p['keyword'] ?? ''), readPeriod(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return trifidTrace(input, String(p['keyword'] ?? ''), readPeriod(p), 'decrypt');
  },

  visualize: TrifidCube,
};

export default trifidCipher;
