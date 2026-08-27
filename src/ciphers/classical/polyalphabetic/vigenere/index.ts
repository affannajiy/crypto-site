/**
 * Vigenere's entry in the registry.
 *
 * Metadata, the tiers it earns, its parameters, and thin wiring to the pure
 * functions next door. There is no algorithm in here — that lives in
 * `vigenere.ts` and `attack.ts`, where a test can reach it.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { vigenereTrace } from './vigenere';
import { breakVigenere } from './attack';
import VigenereDisk from './VigenereDisk';

/**
 * Params arrive as `string | number` because they come from form controls.
 * `normaliseKey` inside the algorithm throws the readable message when the key
 * has no letters at all, so there is nothing to check here beyond the type.
 */
function readKey(p: Params): string {
  return String(p['key'] ?? '');
}

const explainer = `
Vigenere is the answer to Caesar's most obvious problem. Caesar shifts every
letter by the same amount, so the ciphertext keeps the shape of the plaintext.
Vigenere shifts every letter by a different amount, taken from a repeating
keyword.

It was published by Giovan Battista Bellaso in 1553 and misattributed to Blaise
de Vigenere for the next few centuries. For about three hundred years it was
considered unbreakable — **le chiffre indechiffrable** — which is worth sitting
with, because it was being broken privately the whole time.

## How it works

Write the key under the message, repeating it as often as you need:

- Message: **A T T A C K A T D A W N**
- Key: **L E M O N L E M O N L E**

Each key letter is a shift: A is 0, B is 1, L is 11. Now every column is a plain
Caesar cipher with its own shift. A shifted by L (11) is L; T shifted by E (4) is
X; T shifted by M (12) is F. The message becomes **LXFOPVEFRNHR**.

Two things follow from this, and both matter:

**The same plaintext letter becomes different ciphertext letters.** The two Ts in
ATTACK come out as X and F, because they met different key letters. That is what
kills the simple frequency count that breaks Caesar — the peaks get smeared out.

**The same ciphertext letter comes from different plaintext letters.** Which means
you cannot build a single substitution table for the message. There are as many
tables as there are letters in the key.

The key advances on letters only. A space does not consume a key letter, so the
key stays lined up with the letters of the message rather than with its spacing.

## Where you still meet it

Nowhere serious, but the idea is everywhere. A repeating key stream XORed against
data is exactly Vigenere in base 2, and that construction turns up in homemade
"encryption" in shipped software with depressing regularity. The failure below is
its failure too.

## How this breaks

The key space is not the problem this time. A key of eight letters gives 26^8
possibilities, about 209 billion, and trying all of them is not the attack. The
attack does not care how long your key is in the way you would hope.

**The key repeats, so the cipher is really several Caesars.** If the key has 8
letters, then letters 1, 9, 17, 25 of the message were all shifted by the same
amount. Those letters, pulled out on their own, are a plain Caesar cipher — and
frequency analysis breaks a Caesar cipher instantly. Find the key length and the
message collapses into a handful of easy problems. This is the whole attack, and
everything else is just finding that number.

**Repeated words give the key length away.** Friedrich Kasiski published this in
1863. If a common word lands on the same part of the key twice, it encrypts to the
same ciphertext twice. Measure the distance between those two repeats: it must be
a multiple of the key length. Collect several such distances, take their common
divisors, and the key length is usually staring at you.

**The letters are too clumpy to be random.** Pick two letters at random from
English text and the chance they match is about 6.7%. From random letters it is
3.8%. This number — the **index of coincidence** — survives being enciphered.
Slice the ciphertext into columns for a guessed key length, and when the guess is
right each column is English-shaped and the index jumps back towards 6.7%. William
Friedman published this in 1922 and it needs no repeated words at all. The Attack
tab runs both methods and tries the lengths either one suggests.

**A short key on a long message is the worst case.** The attack's only real
requirement is enough letters per column. A five-letter key on a paragraph gives
each column forty-odd samples, which is plenty. Try the Attack tab on one short
sentence and watch it fail — and then notice what that implies: the cipher is
strongest when the key is nearly as long as the message. Push that all the way,
to a random key exactly as long as the message and never reused, and you have the
one-time pad, which genuinely cannot be broken. Everything between here and there
is a compromise.

The general lesson: **a pattern in the key becomes a pattern in the ciphertext.**
Vigenere is not weak because its arithmetic is bad — the arithmetic is fine. It is
weak because the key has structure, and structure is what an attacker eats.
`.trim();

const vigenereCipher: CipherModule = {
  slug: 'vigenere',
  name: 'Vigenere Cipher',
  family: 'classical',
  year: '1553',
  origin: 'Giovan Battista Bellaso, misattributed to Blaise de Vigenere',
  keyType: 'A repeating keyword',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['polyalphabetic', 'kasiski', 'index of coincidence', 'tableau', 'le chiffre indechiffrable'],
  blurb: 'A repeating keyword gives every letter its own Caesar shift.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Keyword',
      default: 'LEMON',
      placeholder: 'Letters only — spaces and punctuation are ignored',
      randomise: { alphabet: 'letters', length: 6 },
    },
  ],
  examples: [
    {
      label: 'The textbook keyword',
      input: 'Meet me at the old bridge at midnight.',
      params: { key: 'LEMON' },
    },
    {
      label: 'A one-letter key is a Caesar',
      input: 'A key of length one is only a shift.',
      params: { key: 'D' },
    },
    {
      label: 'Long enough to need Kasiski',
      input: 'We attack the eastern gate at dawn and hold the bridge until the second company arrives with the guns.',
      params: { key: 'NAVY' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return vigenereTrace(input, readKey(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return vigenereTrace(input, readKey(p), 'decrypt');
  },

  attack: breakVigenere,
  attackScoreLabel: 'chi-squared',

  visualize: VigenereDisk,
};

export default vigenereCipher;
