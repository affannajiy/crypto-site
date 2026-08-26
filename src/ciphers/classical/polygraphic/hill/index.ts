/**
 * The Hill cipher's entry in the registry.
 *
 * Four `number` params, one per matrix entry, which is honest but not elegant —
 * `ParamSpec` has no way to say "these four belong together as a 2x2 grid", so
 * the workbench renders them as four unrelated boxes. Noted as a contract gap
 * rather than worked around with a component that branches on the slug, which the
 * project forbids for good reason.
 *
 * **No Attack tab**, and the reason is a genuine limitation of `CipherModule`
 * rather than a judgement about the cipher. Hill's classic break is a
 * *known-plaintext* attack: four matching letters give you four equations, and
 * the key falls out by linear algebra in a fraction of a second. But
 * `attack(ciphertext)` only receives ciphertext, so that attack cannot be
 * expressed here at all. A ciphertext-only brute force over the 157,248
 * invertible 2x2 matrices would fit the signature and would misrepresent the
 * cipher badly: it does not generalise — a 3x3 Hill key has over a billion times
 * as many possibilities — and it would teach that Hill falls to exhaustion, when
 * what actually kills it is linearity. The explainer carries the real attack, and
 * the gap is recorded in CLAUDE.md.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { type Matrix, determinant, hillTrace, isInvertible } from './hill';
import HillMatrix from './HillMatrix';

/** Params arrive as `string | number` because they come from form controls. */
function readMatrix(p: Params): Matrix {
  const values = ['a', 'b', 'c', 'd'].map((name) => Number(p[name]));
  if (values.some((n) => !Number.isFinite(n))) {
    throw new Error('The key needs four whole numbers, one for each entry of the matrix.');
  }
  const matrix = values.map(Math.trunc) as unknown as Matrix;
  if (!isInvertible(matrix)) {
    throw new Error(
      `This matrix has determinant ${determinant(
        matrix,
      )}, which shares a factor with 26, so it has no inverse and the message could never be decrypted. Try changing one entry until the determinant is odd and not 13.`,
    );
  }
  return matrix;
}

const entry = (name: string, label: string, value: number) =>
  ({ kind: 'number', name, label, min: 0, max: 25, default: value }) as const;

const explainer = `
Lester Hill published this in 1929, and it is the first cipher in this app that is
really *mathematics* rather than clever bookkeeping. Take two letters at a time and
treat them as a vector. Take the key to be a matrix. Encrypting is multiplication.

    | c₁ |   | a  b | | p₁ |
    |    | = |      | |    |   (mod 26)
    | c₂ |   | c  d | | p₂ |

With the key [[3, 3], [2, 5]], the pair **HI** is (7, 8):

- 3×7 + 3×8 = 45, and 45 mod 26 = 19 → **T**
- 2×7 + 5×8 = 54, and 54 mod 26 = 2 → **C**

So HI becomes TC.

## Why this one matters

Look at what happened to that pair. **Both** output letters were computed from
**both** input letters. Change the H and the C changes too, even though the C
"belongs" to the I.

Every cipher before this one in the app lacks that. Caesar, Atbash, Affine and
Vigenère each map one letter to one letter, so changing a plaintext letter
disturbs exactly one ciphertext letter. Playfair links letters in pairs and gets
part of the way. Hill is the first here where a change genuinely spreads.

Cryptographers call this **diffusion**, and it is one of the two properties Claude
Shannon named as necessary for a strong cipher. The Visualize tab demonstrates it
directly: it holds the second letter fixed, tries all 26 first letters, and shows
both output letters moving.

**And it is not quite perfect, which is more interesting than if it were.** With
the default key, changing the first letter by exactly thirteen places leaves the
*second* ciphertext letter unchanged — because that letter's coefficient is 2, and
2 × 13 = 26 = 0. An even coefficient cannot reach every letter, which is the
Affine cipher's coprimality problem again, now hiding inside a matrix.

You cannot tune the hole away, only move it. The determinant has to be odd to be
usable, and if all four entries were odd the determinant would be even — so
**every** valid 2×2 key over 26 letters contains at least one even entry, and
wherever it sits, that output letter has a blind spot. Twenty-six is a bad number
to do algebra over. Modern ciphers work over sizes chosen so this cannot happen,
which is one of the quieter reasons they work in bytes and fields rather than in
letters.

## Why the key cannot be any four numbers

To decrypt you multiply by the inverse matrix, and not every matrix has one modulo
26. The condition is that the **determinant** *ad − bc* must be coprime with 26 —
odd, and not 13. This is the Affine cipher's condition again, one dimension up,
and it fails for exactly the same reason: if the determinant shares a factor with
26, different messages collide onto the same ciphertext and no decryption exists.

This page refuses such a key rather than producing a ciphertext that can never be
read back.

## How this breaks

**Four known letters and it is over.** This is the real attack, and it is
devastating. If you know that a message begins ATTACK, you know two plaintext
pairs and their two ciphertext pairs. That is four equations in the four unknowns
a, b, c, d — schoolroom linear algebra, modulo 26 — and the key drops out in
milliseconds. No search, no statistics, no guessing. Hill is described in
textbooks as *broken by a known-plaintext attack*, and this is why.

Note what does **not** save it: making the matrix bigger. A 3×3 key needs nine
known letters, a 5×5 needs twenty-five. The work grows linearly while the key
space grows astronomically, so the extra size buys nothing against the attack that
actually matters. That is the lesson, and it is worth more than the cipher.

**The cause is linearity.** Every output is a fixed weighted sum of the inputs,
and linear systems can be solved. The reason there is no Attack tab on this page
is that this app's attack contract only receives ciphertext, and the honest attack
on Hill needs a crib — so rather than fake it with a brute force that would
misrepresent the difficulty, the tab is absent.

**Even ciphertext alone leaks.** Hill maps pairs to pairs, so a repeated pair in
the message becomes a repeated pair in the ciphertext, exactly as it does in
Playfair. Digraph frequency analysis works, and with enough text a 2×2 key can be
recovered from ciphertext alone.

**No integrity, and linearity makes tampering easy.** An attacker who knows the
key relationship can make predictable changes to the plaintext by changing the
ciphertext. Confidentiality is not authenticity — a theme that will keep returning.

The idea did not die with the cipher. The *MixColumns* step inside AES is a matrix
multiplication over a finite field, doing precisely the diffusion job Hill invented
it for. What AES adds is a **non-linear** step alongside it, because a cipher built
from linear operations alone is a system of equations waiting to be solved.
`.trim();

const hillCipher: CipherModule = {
  slug: 'hill',
  name: 'Hill',
  family: 'classical',
  year: '1929',
  blurb: 'Letters as vectors, the key as a matrix. The first cipher here with real diffusion.',
  explainer,
  // No 'attack'. The honest attack on Hill needs known plaintext, which
  // `attack(ciphertext)` cannot express. See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [entry('a', 'Matrix a (top left)', 3), entry('b', 'Matrix b (top right)', 3), entry('c', 'Matrix c (bottom left)', 2), entry('d', 'Matrix d (bottom right)', 5)],

  encrypt(input: string, p: Params): TraceResult {
    return hillTrace(input, readMatrix(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return hillTrace(input, readMatrix(p), 'decrypt');
  },

  visualize: HillMatrix,
};

export default hillCipher;
