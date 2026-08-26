/**
 * Autokey's entry in the registry.
 *
 * The Attack tab exists and is **capped**, which is the second cipher here to do
 * that after Columnar Transposition. The cap is at three keyword letters, and it
 * is stated on the page rather than only in the code: an attack that silently
 * gives up teaches that the cipher resisted, when what actually happened is that
 * the search stopped.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { autokeyTrace } from './autokey';
import { MAX_KEYWORD, breakAutokey, searchSize } from './attack';
import AutokeyTape from './AutokeyTape';

const explainer = `
Blaise de Vigenère published two ciphers in 1586. History attached his name to the
weaker one. **This** is the cipher he actually recommended.

The problem with a repeating key is the repeating. A key of length 8 means every
8th letter met the same key letter, and both classical attacks on Vigenère —
Kasiski's repeated fragments and Friedman's index of coincidence — exist purely to
find that 8. Autokey removes the target: after the keyword runs out, the **message
itself** becomes the key.

    message     A T T A C K A T D A W N
    keystream   K E Y A T T A C K A T D
                └keyword┘ └── the message, shifted right by 3 ──┘

The keystream is now exactly as long as the message and repeats nowhere. Kasiski
has nothing to count. The index of coincidence has no columns to average.

## What it costs

**Decryption must run left to right.** Key letter 12 is plaintext letter 9, which
you only know once you have decrypted it. So the cipher cannot be applied in
parallel, cannot be started in the middle, and — the real cost — **one error
destroys the rest of the message**. Garble letter 4 and it becomes the key for
letter 7, which becomes the key for letter 10. Vigenère loses only the letter you
got wrong. That difference is why the weaker *ciphertext autokey* variant, which
appends the ciphertext instead of the plaintext, was more common in the field: it
recovers by itself after a few letters, at the price of handing the attacker a key
they can already see.

## How this breaks

**The keyword is short, and everything follows from it.** Guess the keyword and
the rest is not a search at all — key letter *m+i* is plaintext letter *i*, which
your guess has already produced. So the whole key space is 26^m for a keyword of
*m* letters, no matter how long the message is. A three-letter keyword is 17,576
possibilities, which is fewer than Caesar-and-a-half and is what the Attack tab on
this page tries.

**Wrong guesses fail loudly, which makes the right one easy to spot.** In
Vigenère, a key that is right in three of five columns gives you text that is
partly readable. In autokey, one wrong letter poisons the keystream and the output
is garbage from that point on. Ambiguity is the attacker's real enemy, and autokey
removes it for them.

**The search here stops at ${MAX_KEYWORD} letters.** That is ${searchSize(MAX_KEYWORD).toLocaleString('en-GB')} trial decryptions
and runs instantly; four letters would be over 450,000 and would freeze this page
for seconds. So a longer keyword will not be found by this tab — and that is a
limit of the tool, not a property of the cipher. Real cryptanalysis of autokey does
not brute-force the keyword at all: it guesses a **probable word** in the
plaintext, subtracts it from the ciphertext at every offset, and looks for
positions where readable text falls out — because a word in the message is also,
*m* letters later, a word in the key. That attack needs a crib, and this app's
attack contract has nowhere to put one.

**The key is English, and English is not random.** This is the deep weakness. A
One-Time Pad's key is uniformly random, so ciphertext tells you nothing. Autokey's
key is ordinary prose, so the ciphertext is a sum of two English texts — and sums
of English are lumpy in ways sums of random numbers are not. Certain ciphertext
letters become far more likely than others, and with enough material that structure
is exploitable on its own.

That is the line worth carrying forward. Autokey removes the *repetition* and
keeps a *predictable* key. The One-Time Pad removes both, which is why it is the
only cipher on this site that cannot be broken — and why it is almost unusable.
`.trim();

const autokeyCipher: CipherModule = {
  slug: 'autokey',
  name: 'Autokey',
  family: 'classical',
  year: '1586',
  blurb: 'The message becomes its own key, so nothing repeats and Kasiski has nothing to find.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  attackScoreLabel: 'bigram fit',
  params: [
    {
      kind: 'text',
      name: 'keyword',
      label: 'Keyword (the part that is not the message)',
      default: 'KEY',
      placeholder: 'A short word. Letters only.',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return autokeyTrace(input, String(p['keyword'] ?? ''), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return autokeyTrace(input, String(p['keyword'] ?? ''), 'decrypt');
  },

  attack: (ciphertext: string) => breakAutokey(ciphertext),
  visualize: AutokeyTape,
};

export default autokeyCipher;
