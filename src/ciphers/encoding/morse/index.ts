/**
 * Morse's entry in the registry.
 *
 * The first member of the `encoding` family, which was added to the contract for
 * this page and currently has one member. That is deliberate. Putting Morse under
 * "Classical" — whose catalogue description says every one of them is broken —
 * would have been wrong in a way that matters: Morse is not broken, because it
 * never attempted to be secret. A family of one, clearly labelled, says that
 * better than a footnote would.
 *
 * `params: []`, and no key exists to put there. `attack` is absent for the
 * simplest reason in the app: there is nothing to attack, because nothing is
 * hidden. That is the page's whole argument.
 */
import type { CipherModule, TraceResult } from '../../types';
import { morseTrace, unmorseTrace } from './morse';
import MorseTree from './MorseTree';

const explainer = `
This is **not a cipher**, and it is on this site precisely because of that.

The most common mistake in this subject is confusing **encoding** with
**encryption**. Both change what a message looks like. Only one of them hides it.

Morse code has no key. The table has been published since 1844. Anyone who
recognises dots and dashes can read anything sent in Morse, and always could —
that was the point. It was designed so that a message could get from one end of a
wire to the other, not so that it could get past anyone in between.

The same is true of everything in that category: **Base64, hexadecimal, URL
escaping, ASCII, ROT13**. They look scrambled. They are public transformations
with no secret, and a system whose protection is that an attacker has not yet
worked out the format has no protection at all.

## What it is actually good at

**It is a variable-length code weighted by frequency.** E is a single dot. T is a
single dash. Q is dash-dash-dot-dash. Alfred Vail worked out which letters were
commonest by counting the type in a printer's tray, and gave the short codes to the
letters that came up most — so an average English message takes far fewer symbols
than a fixed-length code would need.

That is **compression**, and it is the same idea as the Straddling Checkerboard on
this site and the same idea David Huffman proved optimal in 1952. A hand-built code
from 1844 gets remarkably close to the optimum.

**The gaps carry information.** A dot is one unit, a dash three, the gap between
symbols one, between letters three, between words seven. Timing is part of the
code, which is why a stream written down without its spacing is genuinely harder to
read than one with it.

## How this breaks

**There is nothing to break. That is the entry.**

You cannot attack Morse, because Morse is not defending anything. There is no key
to search for, no statistic to compute, no weakness to exploit. Decoding it is
looking at a table. This page has no Attack tab and no key controls, which are the
two clearest signals the interface can give.

**But it is worth being precise about what that means**, because "it can be read by
anyone" is not the same as "it is useless". Morse was used throughout two world
wars — carrying messages that had *already* been encrypted. ADFGVX exists in the
form it does because it had to travel by Morse: its six letters were chosen to be
the hardest to mishear over a noisy wireless link. The encoding and the encryption
are different jobs, done by different layers, and both are necessary.

**The mistake to avoid is the reverse one.** If you find data that looks scrambled
— Base64 in a config file, hex in a log, dots and dashes in a puzzle — decoding it
proves nothing about whether it was protected. And if you are *building* something
and you reach for an encoding where you needed encryption, you have shipped a
system that is readable by everyone and looks to you like it is not. That failure
is common, and it is much worse than a weak cipher, because a weak cipher at least
announces what it was trying to do.
`.trim();

const morseCipher: CipherModule = {
  slug: 'morse',
  name: 'Morse Code',
  family: 'encoding',
  year: '1844',
  blurb: 'Not encryption. A public, keyless code — here to make the difference concrete.',
  explainer,
  // No 'attack', and no params. Nothing is hidden, so there is nothing to search
  // for and nothing to choose. See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [],

  encrypt(input: string): TraceResult {
    return morseTrace(input);
  },

  decrypt(input: string): TraceResult {
    return unmorseTrace(input);
  },

  visualize: MorseTree,
};

export default morseCipher;
