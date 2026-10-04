/**
 * The one-time pad's entry in the registry.
 *
 * The second cipher here with **no Attack tab**, for the opposite reason to
 * Playfair. Playfair has none because breaking it honestly needs a search this
 * app does not run. This one has none because, used correctly, there is nothing
 * to run: the cipher is information-theoretically secure, and an attack tab would
 * be a machine that provably cannot work.
 *
 * What replaces it is the Visualize tab, which demonstrates the failure that
 * actually happens in the field — reusing the pad — and shows the key cancelling
 * out in front of you.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { oneTimePadTrace, type Direction } from './otp';
import { vernamTrace } from './vernam';
import OneTimePadVisual from './OneTimePadVisual';

/** Params arrive as `string | number` because they come from form controls. */
function readPad(p: Params): string {
  return String(p['pad'] ?? '');
}

function run(input: string, p: Params, direction: Direction): TraceResult {
  return String(p['mode'] ?? 'letters') === 'vernam'
    ? vernamTrace(input, String(p['hexPad'] ?? ''), direction)
    : oneTimePadTrace(input, readPad(p), direction);
}

/**
 * A default pad, long enough to cover the sample message and some editing.
 *
 * It was generated once and written down here, which means it is **published in
 * a public repository** and is therefore worth exactly nothing as a key. That is
 * fine for a teaching tool and is precisely the situation the explainer warns
 * about: a pad everyone can read is not a pad.
 */
const DEFAULT_PAD =
  'XMCKLQWRTZPBVNHGJDFSAYUIOEKRVTGBNZMQWLPXCDFHJSUAYIOETRBVNZQWMXKLPGJDCFHSUAYIOE';

/** The Vernam pad: 96 random bytes in hex, published here and so, again, worthless as a key. */
const DEFAULT_HEX_PAD =
  'f6341c801c31bf5ef42e4131f44beead6e4b664b99c7b5ad9ff90dc5671cba64' +
  '92b47f71bed2d0f2584e41685c6906889a3b283ec533d884e2332ab05d215a6d' +
  'e362d0cfa2bb11ae244b2ce4a51ae4feb82850b79240107fe9395ae40aeb8531';

const explainer = `
This is the only cipher in this app that cannot be broken. Not "has not been
broken", not "would take a billion years" — **cannot**, by anyone, ever, with any
amount of computing power. Claude Shannon proved it in 1949, and the proof still
stands.

It is also almost never the right tool, and understanding why is worth more than
understanding the algorithm.

## How it works

Exactly like Vigenère: add the key letter to the message letter, modulo 26. The
arithmetic is identical. What changes are three conditions, and **all three are
required**:

1. The key is **as long as the message**. No repeating, ever.
2. The key is **truly random**. Not a word, not a phrase, not the output of an
   ordinary random number generator seeded with the time.
3. The key is **used once** and then destroyed.

Meet all three and the cipher is unbreakable. Miss any one and it is usually
worthless. There is no partial credit here, which is why this page **refuses** to
encrypt when the pad is too short rather than repeating it — repeating a pad turns
it straight back into a Vigenère cipher, and you have already seen what happens to
those.

## Letters or bits

The page has two modes, and they are the same cipher.

- **Letters** adds each pad letter to a message letter, modulo 26, as above. This
  is the pencil-and-paper form, and it shows that a one-time pad is a Vigenère
  cipher whose key never repeats.
- **Vernam** is the form Gilbert Vernam built for the teleprinter in 1917, and the
  one the stream-cipher notes describe. The message becomes bytes, the pad is
  random bytes, and each bit is XORed with a pad bit: 1 where the two differ, 0
  where they match. XOR is its own inverse, so the same pad XORed again gives the
  message back. The ciphertext is written in hex.

Addition modulo 26 and XOR are both ways to combine a message with a key so that
a random key gives a random result. XOR is addition modulo 2, one bit at a time.
The Visualize tab draws whichever mode is selected.

## Why it cannot be broken

Take the ciphertext **EQNVZ**. With the right pad it decrypts to HELLO. But there
is also a pad that decrypts it to WORLD, and one that gives PIZZA, and one for
every other five-letter string. All of them are equally consistent with what the
attacker holds.

That is the whole proof. The ciphertext does not contain enough information to
distinguish the real message from any other message of the same length — not
because the attacker is not clever enough, but because the information **is not
there**. Every other cipher in this app leaks something: a frequency, a
repetition, an adjacency. This one leaks nothing, because a truly random key of
full length destroys all of it.

## Lecture note

The lecture mentions this cipher in its notes on stream ciphers, as the
**Vernam cipher** in its one-time-pad form: the keystream is as long as the
plaintext, and if it is truly random the cipher is unbreakable. The notes then give
the catch. Both users need the whole keystream in advance, over a secure channel,
which is impractical for a lot of traffic.

That catch is why stream ciphers exist. Salsa20, ChaCha20, RC4 and A5/1 each share
a short key and **compute** a long keystream from it. The XOR is the same as in
this page's Vernam mode.
The difference is that a computed keystream is only as good as its generator, and
RC4's and A5/1's were not good enough.

## How this breaks

The algorithm does not break. Every one of these is a way of failing to meet the
conditions, and every one has happened to a real intelligence service.

**Reusing the pad.** This is the big one, and the Visualize tab demonstrates it
rather than describing it. If two messages use the same pad, an attacker subtracts
one ciphertext from the other:

C1 − C2 = (P1 + K) − (P2 + K) = P1 − P2

The key cancels completely. The attacker never learns a letter of the pad and does
not need to — they are left holding the difference between two English messages,
and English is structured enough that overlapping messages can be teased apart from
that difference alone. The Soviet Union reused pads under wartime production
pressure, and the US **Venona** project spent decades reading the results.

**The key distribution problem, which is fatal in practice.** To send someone a
100-page message secretly, you must first send them 100 pages of random key
secretly. If you have a way to do that safely, use it for the message. The
one-time pad does not solve the problem of communicating securely; it converts it
into the problem of *delivering a key in advance*, which is why it is used for
embassy traffic and diplomatic links, where a courier with a briefcase is genuinely
practical, and essentially nowhere else.

**Keys that only look random.** "Random" here is a strong technical claim.
A pad from a passphrase, a book, a language model, or \`Math.random()\` is not
random; it is compressible, and anything compressible gives an attacker leverage.
The pad on this page is written into a public source file, so it is not secret
either — this is a teaching tool, and it is not protecting anything.

**Everything outside the letters still leaks.** The pad hides your letters. It
does not hide the *length* of your message, when you sent it, how often you send,
or who you sent it to. In real intelligence work that traffic analysis is often
worth more than the content, and a perfect cipher does not touch it.

**No integrity whatsoever.** An attacker who cannot read your message can still
change it. Flip a letter of the ciphertext and the corresponding letter of the
plaintext changes predictably — and since the arithmetic is a simple addition, an
attacker who guesses part of your message can rewrite that part into anything they
like, undetectably. Confidentiality is not authenticity, and modern ciphers such
as AES-GCM carry a separate tag precisely because this cipher's descendants kept
making this mistake.

The general lesson runs the other way from every cipher before it: **a perfect
algorithm is not a secure system.** The one-time pad is mathematically flawless and
still fails constantly, because keys have to be generated, delivered, stored, and
destroyed by people. Every practical cipher after this one is a deliberate trade —
give up perfect secrecy, get a key you can actually manage.
`.trim();

const oneTimePadCipher: CipherModule = {
  slug: 'one-time-pad',
  name: 'One-Time Pad',
  family: 'classical',
  year: '1882',
  origin: 'Frank Miller, then Vernam and Mauborgne',
  keyType: 'A random key exactly as long as the message, used once',
  security: 'perfect',
  difficulty: 'intermediate',
  keywords: ['vernam', 'perfect secrecy', 'xor', 'unbreakable', 'shannon'],
  blurb: 'A random key as long as the message. Unbreakable, and almost unusable.',
  explainer,
  // No 'attack'. Playfair omits it because the search is out of scope; this omits
  // it because no such search can exist. See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'pad',
      label: 'Pad',
      default: DEFAULT_PAD,
      placeholder: 'Random letters, at least as many as the message has',
      randomise: { alphabet: 'letters', length: 96 },
    },
    {
      kind: 'select',
      name: 'mode',
      label: 'Mode',
      options: [
        { value: 'letters', label: 'Letters — add mod 26, like Vigenère' },
        { value: 'vernam', label: 'Vernam — XOR on bits, ciphertext in hex' },
      ],
      default: 'letters',
      randomise: false,
    },
    {
      kind: 'text',
      name: 'hexPad',
      label: 'Pad for Vernam mode (hex bytes)',
      default: DEFAULT_HEX_PAD,
      placeholder: 'Random bytes in hex, at least one per message byte',
      randomise: { alphabet: 'hex', length: 192 },
    },
  ],
  examples: [
    {
      label: 'A message the pad is long enough for',
      input: 'Meet me at dawn.',
    },
    {
      label: 'Vernam: the same message, XORed bit by bit',
      input: 'Meet me at dawn.',
      params: { mode: 'vernam' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return run(input, p, 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return run(input, p, 'decrypt');
  },

  visualize: OneTimePadVisual,
};

export default oneTimePadCipher;
