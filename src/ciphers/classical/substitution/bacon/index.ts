/**
 * Bacon's entry in the registry.
 *
 * **No Attack tab**, and the reason is new to this app. Every other missing tab so
 * far is about a search: too large (Playfair), impossible (One-Time Pad), empty
 * (Atbash, ROT13), or needing a crib the contract cannot carry (Hill, Enigma).
 * Bacon is none of those, because Bacon has no key. Its whole defence is that you
 * do not know a message is there. Once you do, decoding is a table lookup — so the
 * thing an Attack tab would model is not a computation at all. It is a suspicion.
 *
 * That is worth a page precisely because it is the one kind of protection this
 * app can otherwise never show: hiding rather than scrambling.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { type Variant, baconTrace, unbaconTrace } from './bacon';
import BaconTable from './BaconTable';

/** Params arrive as `string | number` because they come from form controls. */
function readVariant(p: Params): Variant {
  return String(p['variant'] ?? '24') === '26' ? '26' : '24';
}

const explainer = `
Francis Bacon published this in 1605, and it is the oldest binary encoding of the
alphabet anyone wrote down. Each letter becomes **five symbols** drawn from a set
of two:

    A = AAAAA    B = AAAAB    C = AAABA    D = AAABB    E = AABAA ...

Five symbols with two choices each is 2⁵ = 32 patterns, which is enough for the
alphabet with room to spare. That is a five-bit character code, and it predates
the machines that needed one by three and a half centuries.

Bacon's own table has **24 letters**, because his alphabet did not separate I from
J or U from V. The 26-letter table is a later tidy-up. Both are here; the
historical texts use the first.

## The half people forget

Everything above is just an encoding, and an encoding hides nothing. Bacon's
actual idea is the next sentence in his book: **the two symbols do not have to be
letters.**

They can be two typefaces. Two slants of handwriting. Two heights of a fence post.
Anything a carrier text can carry without appearing to carry anything. Put a
carrier sentence in the box on this page and the message is spelled out by the
**case** of its letters — a capital is B, lowercase is A — and the carrier still
reads as a perfectly ordinary sentence about the weather.

That is **steganography**, and it is a different discipline from cryptography.
Cryptography assumes the enemy sees the message and cannot read it. Steganography
assumes the enemy never realises there is a message. The two are usually used
together, because each fails in a way the other does not.

## What it costs

Five carrier letters per message letter. A twenty-letter message needs a hundred
letters of carrier, and if the carrier runs short the message is simply cut off.
Bandwidth is what hiding costs, and it is why steganography has never been a
general-purpose tool.

There is also **no end marker**. A carrier longer than the message leaves its
spare letters lowercase, lowercase means A, and AAAAA means the letter A — so
decoding a roomy carrier hands back the message followed by a run of A's, and
nothing in the cipher can tell that run from a message that genuinely ends in A.
Try it on this page and watch the tail appear. Baconian carriers were written to
fit for exactly this reason, and every modern format that hides data carries a
length field at the front because of it.

## How this breaks

**There is no key, so there is nothing to attack — and that is the weakness.**
Every other cipher on this site has something you choose and keep secret. Bacon
has a published table. If you know the message is Baconian you decode it with a
pencil, and that is the entire break. This page has no Attack tab because there is
no search to run: the work is noticing, not computing.

**Suspicion is fatal.** The carrier only works while nobody looks at it twice.
Odd capitalisation in the middle of words is exactly the kind of thing that draws
a second look, and a second look is the whole game. Real steganography hides in
channels with natural noise — the low bit of a photograph's pixels, the timing
between network packets — precisely because letter case is far too visible.

**Statistics give it away in bulk.** A carrier hiding a message has a capital
roughly half the time, and English does not. Any automated check that counts case
transitions per word flags it immediately. The same is true of the modern
descendants: an image with data in its low bits has measurably different bit
statistics from a photograph, and detecting that is a research field called
*steganalysis*.

**And encoding is not encryption.** This is the lesson worth carrying. Base64,
Morse, URL-escaping, hex — these look scrambled and are not secret, because the
rule is public and there is no key. If a system's protection is that an attacker
has not yet worked out the format, it has no protection. That is the same claim
Atbash makes from the other direction, and it is why Kerckhoffs's principle is the
first thing anyone designing a cipher is told.
`.trim();

const baconCipher: CipherModule = {
  slug: 'bacon',
  name: "Bacon's Cipher",
  family: 'classical',
  year: '1605',
  blurb: 'Five-bit binary in 1605, and a message hidden in the case of ordinary text.',
  explainer,
  // No 'attack'. Bacon has no key: breaking it is noticing it, not searching.
  // See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'select',
      name: 'variant',
      label: 'Table',
      options: [
        { value: '24', label: "24 letters (Bacon's own: I=J, U=V)" },
        { value: '26', label: '26 letters (modern)' },
      ],
      default: '24',
    },
    {
      kind: 'text',
      name: 'carrier',
      label: 'Carrier text (leave empty for plain A/B)',
      default: 'the quick brown fox jumps over the lazy dog and then trots quietly home again',
      placeholder: 'A sentence long enough to hide the message in',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return baconTrace(input, readVariant(p), String(p['carrier'] ?? ''));
  },

  decrypt(input: string, p: Params): TraceResult {
    return unbaconTrace(input, readVariant(p), String(p['carrier'] ?? ''));
  },

  visualize: BaconTable,
};

export default baconCipher;
