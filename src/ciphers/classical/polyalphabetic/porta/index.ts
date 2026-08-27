/**
 * Porta's entry in the registry.
 *
 * `decrypt` is `encrypt`, for the third time in this folder's family and for a
 * third distinct reason: Atbash by mirroring, Beaufort by subtraction, Porta by
 * pairing. Three different mechanisms, one property. Worth noticing that the
 * property never once made a cipher harder to break.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { portaTrace } from './porta';
import { breakPorta } from './attack';
import PortaTable from './PortaTable';

const explainer = `
Giovan Battista della Porta published this in 1563, which makes it **older than
the Vigenère cipher it is usually compared to**. Porta also wrote the first
European book on breaking ciphers, so he had a better idea than most of what he
was building.

His table has thirteen rows. Each row pairs the first half of the alphabet with
the second half, rotated:

    A B  →  A B C D E F G H I J K L M
             N O P Q R S T U V W X Y Z

    C D  →  A B C D E F G H I J K L M
             O P Q R S T U V W X Y Z N

A key letter picks the row. A letter in the top half comes out of the bottom half
and vice versa, so **the pairing runs both ways**: encrypting a ciphertext with
the same key gives back the plaintext, and this page has one button for both jobs.

## Why thirteen rows and not twenty-six

Because two key letters share every row. A and B both select row 0; C and D select
row 1. Porta built it that way so the whole table fits legibly on one printed page,
and in 1563 that was a serious operational advantage — a cipher clerk with a
one-page table makes fewer mistakes than one with a two-page table.

It also means **half the key does nothing**. Change any key letter to its partner
and the ciphertext is identical. The Visualize tab lets you check that.

## How this breaks

**By the Vigenère attack, and faster than against Vigenère.** The key still
repeats, so the ciphertext still splits into independent columns, so the same
period-finding applies — this page's Attack tab imports that code straight from
the Vigenère page rather than copying it, exactly as Beaufort does.

**Each column is a search over thirteen, not twenty-six.** That is the halving
coming back around. A key of eight letters gives 13⁸ ≈ 815 million instead of
26⁸ ≈ 209 billion: a factor of **256** handed over for the sake of typesetting.
The design decision that made the cipher easier to *use* made it easier to *break*
by precisely the same factor, and the trade was never stated as one.

**The reciprocity is free and worth nothing.** Porta, Beaufort and Atbash all
achieve it by different mechanisms — pairing, subtraction, mirroring — and not one
of the three is harder to break for having it. Self-inverse is an ergonomic
property. It belongs in the same category as a table that fits on one page.

**And a repeating key is still the flaw underneath.** Porta, Vigenère and Beaufort
are three arrangements of one idea, and one attack takes all three. What separates
the One-Time Pad from this family is not cleverness in the table; it is that the
key is as long as the message and never comes round again.
`.trim();

const portaCipher: CipherModule = {
  slug: 'porta',
  name: 'Porta',
  family: 'classical',
  year: '1563',
  origin: 'Giovan Battista della Porta',
  keyType: 'A keyword selecting one of thirteen reciprocal rows',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['polyalphabetic', 'reciprocal', 'tableau', 'porta'],
  blurb: 'Thirteen reciprocal rows instead of twenty-six, which halves the work both ways.',
  explainer,
  tiers: ['encrypt', 'attack', 'visualize', 'benchmark'],
  attackScoreLabel: 'bigram fit',
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key',
      default: 'PORTA',
      placeholder: 'A word. Letters only; everything else is ignored.',
      randomise: { alphabet: 'letters', length: 6 },
    },
  ],
  examples: [
    {
      label: 'Thirteen reciprocal rows',
      input: 'Meet me at the old bridge at midnight.',
      params: { key: 'PORTA' },
    },
    {
      label: 'Encrypting twice returns the message',
      input: 'Porta is its own inverse, like Beaufort.',
      params: { key: 'KEY' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return portaTrace(input, String(p['key'] ?? ''));
  },

  // Identical to `encrypt`. Each row pairs letters, so applying it twice returns
  // the input — the same property Beaufort has for a completely different reason.
  decrypt(input: string, p: Params): TraceResult {
    return portaTrace(input, String(p['key'] ?? ''));
  },

  attack: breakPorta,
  visualize: PortaTable,
};

export default portaCipher;
