/**
 * Salsa20's entry in the registry.
 *
 * **No Attack tab, because it works.** The best published attack reaches 8 of
 * the 20 rounds. That is the same honest omission as AES and ChaCha20.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { readKey, readNonce, salsa20, salsa20Trace } from './salsa20';
import SalsaGrid from './SalsaGrid';

function readOptions(p: Params) {
  const counter = Number(p['counter'] ?? 0);
  return {
    key: readKey(String(p['key'] ?? '')),
    nonce: readNonce(String(p['nonce'] ?? '')),
    counter: BigInt(Number.isFinite(counter) ? Math.max(0, Math.trunc(counter)) : 0),
  };
}

const explainer = `
A stream cipher from add, rotate and XOR. Daniel J. Bernstein published it in 2005.

## How it works

- Build a 4×4 grid of 32-bit words: four constants on the diagonal (they spell "expand 32-byte k"), a 256-bit key, a 64-bit nonce and a 64-bit counter.
- Run twenty rounds of quarter-rounds. Odd rounds mix the columns. Even rounds mix the rows. Then add the starting grid back.
- The 64-byte result is keystream. XOR it with the message. Add 1 to the counter for each block. Decryption is the same XOR.
- **ChaCha20 differs in four ways.** Its constants are on the top row. It mixes columns, then diagonals. Its rotations are 16, 12, 8, 7, not 7, 9, 13, 18. Its nonce is 96 bits.

## How this breaks

- **There is no practical break.** The best attack reaches 8 of the 20 rounds. That is why this page has no Attack tab.
- **A repeated nonce repeats the keystream.** XOR the two ciphertexts and you get the XOR of the two plaintexts.
- **There is no integrity.** Pair it with the Poly1305 MAC.
`.trim();

const salsa20Cipher: CipherModule = {
  slug: 'salsa20',
  name: 'Salsa20',
  family: 'symmetric',
  year: '2005',
  origin: 'Daniel J. Bernstein; eSTREAM portfolio, 2008',
  keyType: 'A 256-bit key and a 64-bit nonce',
  security: 'secure',
  difficulty: 'advanced',
  keywords: ['stream cipher', 'arx', 'add rotate xor', 'estream', 'bernstein', 'quarter round', 'keystream', 'chacha'],
  blurb: 'Twenty rounds of add, rotate and XOR on a 4×4 grid. The cipher ChaCha20 was made from.',
  explainer,
  // No 'attack': no known practical attack. See the file header.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key (64 hex digits for 256 bits, or 32 for 128)',
      default: '0102030405060708090a0b0c0d0e0f10c9cacbcccdcecfd0d1d2d3d4d5d6d7d8',
      placeholder: '64 hex digits',
      randomise: { alphabet: 'hex', length: 64 },
    },
    {
      kind: 'text',
      name: 'nonce',
      label: 'Nonce (16 hex digits; never reuse with one key)',
      default: '65666768696a6b6c',
      placeholder: '16 hex digits',
      randomise: { alphabet: 'hex', length: 16 },
    },
    { kind: 'number', name: 'counter', label: 'First block counter', min: 0, max: 1_000_000, default: 0 },
  ],
  examples: [
    {
      label: 'Bernstein’s example key and nonce',
      input: 'Meet me at the old bridge at midnight.',
      params: {
        key: '0102030405060708090a0b0c0d0e0f10c9cacbcccdcecfd0d1d2d3d4d5d6d7d8',
        nonce: '65666768696a6b6c',
        counter: 0,
      },
    },
    {
      label: 'A 128-bit key: the key cells hold it twice',
      input: 'Short key, same rounds.',
      params: { key: '0102030405060708090a0b0c0d0e0f10', nonce: '65666768696a6b6c', counter: 0 },
    },
    {
      label: 'More than 64 bytes: the counter moves to block 2',
      input: 'Salsa20 makes 64 bytes of keystream per block. This message is longer than that, so a second block is needed.',
      params: {
        key: '0102030405060708090a0b0c0d0e0f10c9cacbcccdcecfd0d1d2d3d4d5d6d7d8',
        nonce: '65666768696a6b6c',
        counter: 0,
      },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return salsa20Trace(input, readOptions(p), 'encrypt');
  },

  benchmark(input: string, p: Params): string {
    return salsa20(input, readOptions(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return salsa20Trace(input, readOptions(p), 'decrypt');
  },

  visualize: SalsaGrid,
};

export default salsa20Cipher;
