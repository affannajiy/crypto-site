/**
 * Atbash's entry in the registry.
 *
 * The first cipher here with **no params at all**, which the workbench handles
 * without being told: `ParamControls` renders an empty list and the page simply
 * has no key controls. That fell out of the contract rather than being coded for,
 * and it is a good sign the contract is the right shape.
 *
 * **No Attack tab**, and this is the third distinct reason for that in the app.
 * Playfair omits one because the search is out of scope; the One-Time Pad omits
 * one because no such search can exist. Atbash omits one because there is nothing
 * to search: the key space has exactly one member, so "attacking" it means
 * pressing Encrypt. A tab that duplicated the Encrypt tab would teach nothing,
 * and the explainer says so directly.
 */
import type { CipherModule, TraceResult } from '../../../types';
import { atbashTrace } from './atbash';
import AtbashMirror from './AtbashMirror';

const explainer = `
Atbash is the oldest cipher in this app and the simplest thing that still counts
as one. Fold the alphabet in half and swap every letter for its mirror.

**A ↔ Z, B ↔ Y, C ↔ X, … M ↔ N**

Written as arithmetic, with A = 0 through Z = 25:

**E(x) = 25 − x**

The name is the rule. In Hebrew it is *aleph-tav-beth-shin* — the first letter,
the last letter, the second letter, the second-to-last — which is the substitution
spelled out as a word. It appears in the book of Jeremiah, where *Sheshach* is
written for what reads as *Babel*.

## Two things make it worth a page

**It is its own inverse.** Mirror a letter twice and you are back where you
started, so encrypting and decrypting are the same operation. There is one button
here doing both jobs, and that is not a shortcut in the code — it is a property of
the cipher. Mathematicians call a function like this an *involution*, and you will
meet the idea again in the Enigma machine, whose reflector is exactly this trick
and whose most famous weakness follows directly from it.

**It has no key.** Not a short key, not a weak key — none. Every other cipher in
this app has something you choose and keep secret. Atbash has a rule, and once you
know the rule you know everything.

## How this breaks

It does not need breaking, because it was never locked.

**There is nothing to search for.** Caesar has 25 keys, and the Attack tab on that
page tries all of them in a few milliseconds. Atbash has *one*, so there is no
tab here: the attack is pressing Encrypt on the ciphertext. That is the entire
break, and it takes as long as the encryption did.

**Recognising it is trivial.** Atbash leaves an unmistakable signature. The letter
frequencies of English are simply reversed, so common English letters land on rare
ones — E becomes V, T becomes G — and a ciphertext full of V, G and Z with almost
no E is Atbash almost every time. The word "the" becomes "gsv" in every message
ever written with it, which is a fingerprint you can spot by eye.

**Its real lesson is about secrecy of method.** Atbash is the purest example of
what cryptographers call *security through obscurity*: the only thing protecting
the message is that the reader has not heard of the trick. That protection
evaporates permanently the first time anyone writes the method down, and someone
always does. Kerckhoffs's principle, stated in 1883, is the response: assume the
enemy knows the system, and put all the secrecy in the key. Atbash has no key, so
by that standard it offers no secrecy at all.

It is still useful for what it is — a way to keep an answer from being read
*accidentally*, like an upside-down solution at the back of a puzzle book. That is
a real job. It is just not security.
`.trim();

const atbashCipher: CipherModule = {
  slug: 'atbash',
  name: 'Atbash',
  family: 'classical',
  year: '~600 BC',
  origin: 'Hebrew scribes',
  keyType: 'No key at all',
  security: 'broken',
  difficulty: 'beginner',
  keywords: ['hebrew', 'reverse', 'reciprocal', 'keyless', 'monoalphabetic'],
  blurb: 'The alphabet reversed. No key, and its own inverse.',
  explainer,
  // No 'attack': the key space has one member, so the attack is the Encrypt tab.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [],
  examples: [
    {
      label: 'A short message',
      input: 'Meet me at the old bridge at midnight.',
    },
    {
      label: 'Its own inverse',
      input: 'Encrypt this twice and you get it back.',
    },
  ],

  encrypt(input: string): TraceResult {
    return atbashTrace(input);
  },

  // Identical to `encrypt`, because the cipher is an involution. This is not a
  // stub — mirroring twice returns the original, so there is no second algorithm.
  decrypt(input: string): TraceResult {
    return atbashTrace(input);
  },

  visualize: AtbashMirror,
};

export default atbashCipher;
