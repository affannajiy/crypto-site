/**
 * A5/1's entry in the registry.
 *
 * **No Attack tab.** The real attacks are time-memory trade-offs: precomputed
 * tables of about two terabytes, matched against keystream recovered from known
 * plaintext in the GSM control channel. That is a table and a known plaintext,
 * not a function of one ciphertext. Gap 6 again.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { a51, a51Trace, readFrame, readKey } from './a51';
import A51Registers from './A51Registers';

function readOptions(p: Params) {
  return {
    key: readKey(String(p['key'] ?? '')),
    frame: readFrame(Number(p['frame'] ?? 0)),
  };
}

const explainer = `
A5/1 is the cipher that protected **GSM** mobile phone calls in Europe and much
of the world from about 1987. The lecture lists it as the stream cipher "for GSM
cellular networks". Its design was secret, and in 1999 it was reverse-engineered
from a real phone and published.

## How it works

A5/1 is three **linear feedback shift registers** (LFSRs), 64 bits of state in
all:

| Register | Length | Feedback taps | Clocking bit |
| --- | --- | --- | --- |
| R1 | 19 bits | 18, 17, 16, 13 | 8 |
| R2 | 22 bits | 21, 20 | 10 |
| R3 | 23 bits | 22, 21, 20, 7 | 10 |

To **clock** a register, XOR its tap bits, shift everything one place left, and put
the XOR in bit 0. On its own, an LFSR is linear and easy to predict.

What makes A5/1 more than three LFSRs is the **majority rule**. Each register has
a clocking bit near its middle. On every step the three clocking bits vote, and
only the registers whose bit agrees with the majority move. So each step moves
two or three registers, never one, and which ones depends on the state. The
output bit is the XOR of the three top bits.

## Setting up a frame

A call is cut into **frames**, numbered with 22 bits. Each frame gets a fresh
start from the 64-bit session key Kc and the frame number:

- Zero the registers. Clock in the 64 key bits, all three registers every time.
- Clock in the 22 frame bits the same way.
- Clock 100 times with the majority rule, and discard the output.
- Clock 228 times: 114 keystream bits for each direction of the call.

This page uses the phone-to-network burst, 114 bits, of which 112 are whole
bytes. A longer message moves on to the next frame number, as a call does. The
Visualize tab shows the three registers clock by clock.

The tests reproduce the published output of the 1999 reference code by
Briceno, Goldberg and Wagner: key 12 23 45 67 89 AB CD EF and frame 0x134 give
534EAA582FE8151AB6E1855A728C00.

## How this breaks

**64 bits of state are too few.** The whole cipher is determined by 64 bits of
register state at the start of a frame. Biryukov, Shamir and Wagner showed in
2000 that a precomputed table lets an attacker find that state from a couple of
seconds of keystream. In 2009 Karsten Nohl's project published **2 terabytes of
rainbow tables**, and with them a laptop could recover a call's key in seconds.

**The keystream is easy to get.** The attacker needs known plaintext, and GSM
supplies it. Control messages have fixed formats, and GSM adds its error
correction **before** encrypting, so the encrypted bits are redundant and
predictable. Knowing the plaintext and seeing the ciphertext gives the keystream.

**The key was weakened on purpose.** In many deployments, 10 of the 64 key bits
were set to zero. The export version, A5/2, was weaker still and could be broken
almost instantly. Worse, a phone could be tricked into using A5/2 with the same
key, which then gave away the A5/1 key too.

Note that the cipher was secret, and that did not save it. It was reverse
engineered in 1999 and broken within a year. That is **Kerckhoffs's principle**:
a cipher must stay secure when the enemy knows everything except the key.

There is no Attack tab, because the attack is a two-terabyte table and a known
plaintext, not a function of one ciphertext. 3G and 4G replaced A5/1 with KASUMI
and then with SNOW 3G and AES.
`.trim();

const a51Cipher: CipherModule = {
  slug: 'a5-1',
  name: 'A5/1',
  family: 'symmetric',
  year: '1987',
  origin: 'The GSM Association; reverse-engineered by Briceno, Goldberg and Wagner, 1999',
  keyType: 'A 64-bit session key Kc and a 22-bit frame number',
  security: 'broken',
  difficulty: 'advanced',
  keywords: ['gsm', 'mobile', 'cellular', 'lfsr', 'shift register', 'majority', 'stream cipher', 'a5'],
  blurb: 'Three shift registers and a majority vote. Encrypted GSM phone calls, and fell to a two-terabyte table.',
  explainer,
  visualizeNote:
    'This draws the current key and frame: the three registers after setup, clock by clock, with the vote that decides which ones move.',
  // No 'attack'. See the file header.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Session key Kc (16 hex digits — 64 bits)',
      default: '1223456789abcdef',
      placeholder: '16 hex digits',
      randomise: { alphabet: 'hex', length: 16 },
    },
    { kind: 'number', name: 'frame', label: 'Frame number (22 bits)', min: 0, max: 4_194_303, default: 0x134 },
  ],
  examples: [
    {
      label: 'The 1999 reference key and frame 0x134',
      input: 'Hello from GSM',
      params: { key: '1223456789abcdef', frame: 0x134 },
    },
    {
      label: 'A longer message spans several frames',
      input: 'Each frame gives 114 bits, so this message needs a few frames.',
      params: { key: '1223456789abcdef', frame: 0x134 },
    },
    {
      label: 'Same key, next frame: a different keystream',
      input: 'Hello from GSM',
      params: { key: '1223456789abcdef', frame: 0x135 },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return a51Trace(input, readOptions(p), 'encrypt');
  },

  benchmark(input: string, p: Params): string {
    return a51(input, readOptions(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return a51Trace(input, readOptions(p), 'decrypt');
  },

  visualize: A51Registers,
};

export default a51Cipher;
