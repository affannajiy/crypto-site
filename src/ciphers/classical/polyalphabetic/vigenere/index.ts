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
import VigenereTable from './VigenereTable';

/**
 * Params arrive as `string | number` because they come from form controls.
 * `normaliseKey` inside the algorithm throws the readable message when the key
 * has no letters at all, so there is nothing to check here beyond the type.
 */
function readKey(p: Params): string {
  return String(p['key'] ?? '');
}

const explainer = `
Vigenere is the answer to the most obvious problem of Caesar. Caesar shifts every
letter by the same amount, so the ciphertext keeps the shape of the plaintext.
Vigenere, on the other hand, shifts every letter by a different amount, taken from
a repeating keyword.

Giovan Battista Bellaso published it in 1553, and it was misattributed to Blaise
de Vigenere for the next few centuries. For about three hundred years it was
considered unbreakable, and it was known as **le chiffre indechiffrable** (the
indecipherable cipher). This is worth sitting with, because it was being broken
privately the whole time.

## How it works

Write the key under the message, repeating it as often as needed:

- Message: **A T T A C K A T D A W N**
- Key: **L E M O N L E M O N L E**

Each key letter is a shift, whereby A is 0, B is 1 and L is 11. As a result, every
column is a plain Caesar cipher with its own shift. A shifted by L (11) is L, T
shifted by E (4) is X, and T shifted by M (12) is F. The message becomes
**LXFOPVEFRNHR**.

On paper, the lecture does this with the **Vigenère table**, also called the
tabula recta: 26 rows, each one a Caesar alphabet shifted one more place than the
row above. Find the plaintext letter in the top row and the key letter in the left
column. Where they cross is the ciphertext letter. To decrypt, go along the key
letter's row to the ciphertext letter and read the plaintext letter at the top of
that column. The Visualize tab draws this table and lights the row, the column and
the crossing for each letter.

Two things follow from this, and both matter.

**The same plaintext letter becomes different ciphertext letters.** The two Ts in
ATTACK come out as X and F, because they met different key letters. This is what
kills the simple frequency count that breaks Caesar, since the peaks get smeared
out.

**The same ciphertext letter comes from different plaintext letters.** This means
that no single substitution table can describe the message. There are as many
tables as there are letters in the key.

The key advances on letters only. A space does not consume a key letter, so the
key stays lined up with the letters of the message rather than with its spacing.

## Where it still appears

Nowhere serious, but the idea is everywhere. A repeating key stream XORed against
data, which means combined with it bit by bit using exclusive or, is exactly
Vigenere in base 2. That construction turns up in homemade "encryption" in shipped
software with depressing regularity, and the failure below is its failure too.

## How this breaks

The key space is not the problem this time. A key of eight letters gives 26^8
possibilities, about 209 billion, and trying all of them is not the attack. In
fact, the attack cares far less about the length of the key than a user would
hope.

**The key repeats, so the cipher is really several Caesars.** If the key has 8
letters, then letters 1, 9, 17 and 25 of the message were all shifted by the same
amount. Those letters, pulled out on their own, form a plain Caesar cipher, and
frequency analysis breaks a Caesar cipher instantly. Therefore, once the key
length is found, the message collapses into a handful of easy problems. This is
the whole attack, and everything else is just finding that number.

**Repeated words give the key length away.** Friedrich Kasiski published this in
1863. If a common word lands on the same part of the key twice, it encrypts to the
same ciphertext twice. The distance between those two repeats must be a multiple
of the key length. By collecting several such distances and taking their common
divisors, the key length usually becomes obvious.

**The letters are too clumpy to be random.** Pick two letters at random from
English text and the chance that they match is about 6.7%. From random letters, it
is 3.8%. This number is the **index of coincidence**, and it survives being
enciphered. When the ciphertext is sliced into columns for a guessed key length
and the guess is right, each column is English-shaped and the index jumps back
towards 6.7%. William Friedman published this in 1922, and it needs no repeated
words at all. The Attack tab runs both methods and tries the lengths that either
one suggests.

**A short key on a long message is the worst case.** The only real requirement of
the attack is enough letters per column. A five-letter key on a paragraph gives
each column forty-odd samples, which is plenty. On one short sentence, however,
the Attack tab fails, and that failure implies something: the cipher is strongest
when the key is nearly as long as the message. Taken all the way, to a random key
exactly as long as the message and never reused, this becomes the one-time pad,
which genuinely cannot be broken. Everything between here and there is a
compromise.

In the end, the general lesson is that **a pattern in the key becomes a pattern in
the ciphertext.** Vigenere is not weak because its arithmetic is bad, as the
arithmetic is fine. It is weak because the key has structure, and structure is
what an attacker eats.
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
      default: 'DECEPTIVE',
      placeholder: 'Letters only. Spaces and punctuation are ignored',
      randomise: { alphabet: 'letters', length: 6 },
    },
  ],
  examples: [
    {
      label: 'The textbook keyword',
      input: 'we are discovered save yourself',
      params: { key: 'DECEPTIVE' },
    },
    {
      label: 'Lecture slide: ATTACKATDAWN with LEMON',
      input: 'ATTACKATDAWN',
      params: { key: 'LEMON' },
    },
    {
      label: 'Lab sheet: ThisisIASlab with LEMON',
      input: 'ThisisIASlab',
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

  visualize: VigenereTable,
};

export default vigenereCipher;
