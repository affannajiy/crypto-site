/**
 * ROT13's entry in the registry.
 *
 * No params, like Atbash, and for the same reason: the shift is fixed at 13 and
 * making it adjustable would just be the Caesar page again. Two ciphers with an
 * empty `params` array is a good check on the contract — nothing in the workbench
 * needed changing to support either.
 *
 * **No Attack tab.** ROT13 is not a lock, so there is nothing to pick: applying
 * the cipher to the ciphertext is the decryption, and that is the Encrypt tab.
 * The interesting content here is not how it breaks but what it is honestly for,
 * which the explainer takes seriously rather than sneering at.
 */
import type { CipherModule, TraceResult } from '../../types';
import { rot13Trace } from './rot13';
import Rot13Circle from './Rot13Circle';

const explainer = `
ROT13 is Caesar with the shift fixed at 13. That single choice changes what the
thing *is*.

Twenty-six letters, thirteen places — half a turn. Do it twice and you have gone
all the way round, back to where you started. So encrypting and decrypting are the
same operation, and thirteen is the **only** shift with that property. Every other
Caesar key needs its own opposite to undo it; this one is its own opposite.

**E(x) = (x + 13) mod 26, and E(E(x)) = x**

The Visualize tab makes the argument geometrically. Put the alphabet round a
circle and each letter is joined to the one directly opposite. A diameter has two
ends and no preferred direction, which is the whole cipher in one picture.

## Nobody is pretending

Here is what makes ROT13 different from everything else in this app: **it was
never meant to hide anything from anyone who wants to read it.**

Its home is Usenet, and its job was the spoiler. Post the ending of a film in
ROT13 and a reader has to *choose* to decode it. The point is not that the text is
unreadable — it is that the text is not readable **by accident**, by someone
scrolling past who did not want to know yet. The reader is a collaborator, not an
adversary.

That is a real job, and it is done well. A puzzle answer at the back of a book is
printed upside down for exactly the same reason, and nobody calls that a security
failure.

## How this breaks

Instantly, completely, and by design. This section is short because the honest
answer is that there is nothing to break.

**Applying it again is the decryption.** There are no keys to try. If you suspect
ROT13, you run ROT13 and you are done — a fraction of a second, no statistics, no
guessing.

**It is trivially recognisable.** Text mangled by ROT13 keeps every space, every
comma, every apostrophe and every word length. "Gur" appears everywhere the
original said "the". Word shape alone gives it away at a glance, and long-time
Usenet readers famously learned to read some of it unaided.

**The genuine danger is category error.** ROT13 is harmless until someone reaches
for it to protect something that matters — an API key in a config file, a password
in a database, a filename someone should not open. It has happened, repeatedly, in
shipped software. The failure is not in the algorithm, which does exactly what it
says; it is in mistaking *not-accidentally-readable* for *not-readable*. Those are
different requirements, and only one of them is security.

Keep the distinction and ROT13 is a decent tool. Lose it and you have shipped a
vulnerability that looks like a feature. If you want the same "reader must opt in"
effect for something that genuinely matters, you do not need a stronger obscuring
trick — you need a real cipher and a real key, which is what the rest of this app
is about.
`.trim();

const rot13Cipher: CipherModule = {
  slug: 'rot13',
  name: 'ROT13',
  family: 'classical',
  year: '1980s',
  blurb: 'Caesar, half a turn. Its own inverse, and never meant to be secret.',
  explainer,
  // No 'attack': running the cipher on the ciphertext is the decryption.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [],

  encrypt(input: string): TraceResult {
    return rot13Trace(input);
  },

  // Identical to `encrypt`. Not a stub — thirteen is half of twenty-six, so the
  // operation genuinely undoes itself.
  decrypt(input: string): TraceResult {
    return rot13Trace(input);
  },

  visualize: Rot13Circle,
};

export default rot13Cipher;
