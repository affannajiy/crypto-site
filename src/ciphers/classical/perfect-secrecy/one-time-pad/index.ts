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
This is the only cipher here that cannot be broken. Claude Shannon proved it in 1949.

## How it works

- Add each pad letter to a message letter, modulo 26, like Vigenère.
- Three rules, all required: the pad is **as long as the message**, **truly random**, and **used once**.
- This page refuses a short pad. It does not repeat the pad.
- **Vernam** mode XORs bytes with a random hex pad. Gilbert Vernam built it in 1917. XOR undoes itself.
- **Why it cannot be broken:** for the ciphertext EQNVZ, one pad gives HELLO and another gives WORLD. Every message of that length is equally possible.

## Lecture note

- The lecture's notes call this the **Vernam cipher**. It is unbreakable if the keystream is random and as long as the message.
- The catch is that both users need the whole keystream first, over a secure channel. Stream ciphers compute a long keystream from a short key instead.

## How this breaks

- **Reuse the pad.** C1 − C2 = P1 − P2, so the key cancels. The Venona project read Soviet messages that reused pads.
- **Deliver the key.** Sending the pad securely is as hard as sending the message.
- **Use a fake random pad.** The pad on this page is in a public source file, so it is not secret.
- **Change the message.** There is no integrity. Change one ciphertext letter and the plaintext letter changes in a way the attacker can predict.
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
