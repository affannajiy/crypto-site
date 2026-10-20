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
The stream cipher of GSM phone calls, from about 1987. Its design was secret until it was reverse-engineered in 1999.

## How it works

- Three LFSRs of 19, 22 and 23 bits hold 64 bits of state.
- **Majority clocking:** each register has one clocking bit. Only the registers that agree with the majority move, so two or three move at each step.
- The output bit is the XOR of the three top bits.
- Each frame loads the 64-bit key and the 22-bit frame number. It clocks 100 times and discards the output. Then it clocks 228 times for keystream: 114 bits for each direction.
- This page uses 114 bits per frame.

## How this breaks

- **64 bits of state is too few.** In 2009, 2 TB of rainbow tables could recover a key in seconds.
- **Known plaintext is easy to get.** GSM control messages are predictable.
- **The keys were weakened on purpose.** Often 10 key bits were zero, and A5/2 was weaker still.
- **There is no Attack tab.** The attack needs a table and a known plaintext, not one ciphertext.
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
