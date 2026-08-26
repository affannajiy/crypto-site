/**
 * Beaufort's entry in the registry.
 *
 * `decrypt` is `encrypt`. Not a stub and not laziness: subtraction in this
 * arrangement is an involution, which is the single fact the page is about. The
 * same is true of Atbash, ROT13 and Enigma, and it is worth noticing that three
 * of those four are considered secure by nobody — self-inverse is a property
 * about convenience, not about strength.
 *
 * It *does* have an Attack tab, unlike those three, and the attack imports its
 * period-finding directly from Vigenere. That import is the lesson.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { beaufortTrace } from './beaufort';
import { breakBeaufort } from './attack';
import BeaufortRule from './BeaufortRule';

const explainer = `
Vigenère adds the key to the plaintext. Beaufort subtracts the plaintext from the
key. That is the entire difference, and it is one character of arithmetic:

    Vigenère:  C = P + K   (mod 26)
    Beaufort:  C = K − P   (mod 26)

With key letter **K** and plaintext **E**: K is 10, E is 4, so 10 − 4 = 6 → **G**.

## Why the Navy liked it

Feed the ciphertext back in with the same key: K − (K − P) = P. **Encrypting and
decrypting are the same operation.** There is one button on this page doing both
jobs, and that is a property of the cipher rather than a shortcut in the code.

That mattered enormously in the field. A Vigenère operator has two procedures and
can perform the wrong one; a Beaufort operator has one. Sir Francis Beaufort — the
same Beaufort as the wind scale — has his name on it, and the cipher was issued as
a **slide rule**: a strip of alphabet with a reversed strip sliding beneath it,
set the key letter, read off the answer, and the rule cannot be used backwards
because there is no backwards. The Visualize tab draws that rule.

The German Kriegsmarine's *M-138* strip system and several rotor designs used the
same reciprocal trick, for the same reason. Enigma's reflector is this idea in
wire.

## The variant that is not this

There is a **variant Beaufort**, C = P − K, which looks similar and is not. It is
exactly Vigenère decryption used as an encryption, it is *not* self-reciprocal,
and it needs two procedures again. This page implements the real one, because the
reciprocity is the only thing that makes Beaufort worth a page of its own.

## How this breaks

**By the Vigenère attack, unchanged.** This is the finding, and it is worth more
than the cipher. The key still repeats with period *n*, so every *n*th letter of
the ciphertext met the same key letter, so the message still splits into *n*
independent single-letter puzzles. Find *n* by the index of coincidence, then
solve each column by trying all 26 possibilities and keeping the one that looks
most like English.

The Attack tab here **imports its period-finding from the Vigenère page's attack
file** rather than containing a copy. That is deliberate. If a change to a cipher
can be attacked by literally the same code, the change bought no security — and
the import in the source is a more honest way of saying that than a paragraph is.

**Only one line of the attack differs.** Vigenère's column solver tries each shift
*k* and tests *c − k*. Beaufort's tries each *k* and tests *k − c*. That is the
whole adaptation, and it took longer to write this sentence than to write the code.

**Ranking the candidates needs a different statistic from solving them.** Each
column is solved by chi-squared, which counts letters. But chi-squared is a poor
judge of *whole keys*: a key of length 16 has four times the freedom of the real
key of length 4, so it can bend the letter counts closer to English while
producing text that is not English. On the paragraph this page's tests use, the
true key **NAVY** scores 47.5 and a wrong sixteen-letter key scores 28.7 — and
chi-squared prefers the wrong one. Counting adjacent *pairs* does not overfit that
way, so candidates here are ranked by **bigram fit**. Overfitting is not a quirk
of this cipher; it is what happens whenever a model is handed more parameters than
the evidence supports.

**Self-inverse is not a security property.** It is genuinely valuable — fewer
operator errors, simpler equipment — and it costs nothing and buys nothing against
an analyst. Do not confuse a cipher being *convenient* with a cipher being
*strong*. Enigma is the extreme case: its reflector gives the same reciprocity,
and the same reflector is precisely why no letter can ever encipher to itself,
which is the flaw Bletchley Park lived on for six years.

**And a repeating key is the flaw underneath all of it.** Beaufort, Vigenère,
Porta and Autokey are four arrangements of one idea, and three of them fall to one
attack. The one that does not is the One-Time Pad, whose only difference is that
the key never repeats.
`.trim();

const beaufortCipher: CipherModule = {
  slug: 'beaufort',
  name: 'Beaufort',
  family: 'classical',
  year: '1857',
  blurb: 'Vigenère with the subtraction the other way round, which makes it its own inverse.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  attackScoreLabel: 'bigram fit',
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key',
      default: 'BEAUFORT',
      placeholder: 'A word. Letters only; everything else is ignored.',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return beaufortTrace(input, String(p['key'] ?? ''));
  },

  // Identical to `encrypt`. K − (K − P) = P, so there is no second operation.
  decrypt(input: string, p: Params): TraceResult {
    return beaufortTrace(input, String(p['key'] ?? ''));
  },

  attack: breakBeaufort,
  visualize: BeaufortRule,
};

export default beaufortCipher;
