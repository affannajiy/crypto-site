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
Salsa20 is the stream cipher Daniel J. Bernstein published in 2005. The lecture
lists it first among its stream cipher examples, and names ChaCha20 as its
"modified version". In 2008 the European eSTREAM project chose Salsa20/12 for its
portfolio of software stream ciphers.

## How it works

Build a 4 × 4 grid of sixteen 32-bit words. The four constant words, which spell
"expand 32-byte k", go on the **diagonal**. The 256-bit key fills eight cells
around them. The 64-bit nonce and a 64-bit block counter fill the middle:

    const  key    key    key
    key    const  nonce  nonce
    count  count  const  key
    key    key    key    const

Then run twenty rounds. Each round is four **quarter-rounds**, and each
quarter-round mixes four words with nothing but addition, rotation and XOR:

    b ^= (a + d) <<< 7
    c ^= (b + a) <<< 9
    d ^= (c + b) <<< 13
    a ^= (d + c) <<< 18

Odd rounds mix the four **columns**. Even rounds mix the four **rows**. After all
twenty, add the starting grid back in, word by word. The 64 bytes that result are
keystream. XOR them into 64 bytes of the message, add 1 to the counter, and do the
next block. Decryption is the same XOR.

The Visualize tab shows the grid at every stage, and which cells each
quarter-round touches.

## Salsa20 and ChaCha20

ChaCha20 is the lecture's other example, and it is Salsa20 changed in four small
ways. Open the two pages side by side to compare.

| | Salsa20 | ChaCha20 |
| --- | --- | --- |
| Constants | On the diagonal | Along the top row |
| Rounds | Columns, then rows | Columns, then diagonals |
| Quarter-round | Each word updated once; rotations 7, 9, 13, 18 | Each word updated twice; rotations 16, 12, 8, 7 |
| Nonce and counter | 64-bit nonce, 64-bit counter | 96-bit nonce, 32-bit counter (RFC 8439) |

Each change spreads a flipped bit faster, round for round. That is why ChaCha20
replaced Salsa20 in TLS 1.3, SSH and WireGuard. The design idea is unchanged.

## Why "add, rotate, XOR"

The design has no S-box, so it has no table to look up. A table lookup takes a
different time depending on what is in the cache, and that timing difference has
leaked AES keys in real attacks. Addition, rotation and XOR take the same time
whatever the data. So the same code is fast and safe from cache-timing attacks
on any CPU, including CPUs with no AES instructions. This is the lecture's
"software and hardware implementations".

## Test vectors

The tests check the quarter-round and the full 64-byte function against the
examples in Bernstein's specification, for both a 256-bit and a 128-bit key. A
128-bit key fills the key cells twice, with the constant "expand 16-byte k".

## How this breaks

**It does not, as far as anyone knows.** The best published attack breaks 8 of
the 20 rounds. That is why there is no Attack tab, as on AES and ChaCha20.

**A repeated nonce breaks it completely.** Encrypt two messages with the same key,
nonce and counter, and they share a keystream. XOR the two ciphertexts and the
keystream cancels, which leaves the XOR of the two plaintexts. That is the
one-time pad used twice. A 64-bit nonce is too short to choose at random safely
for many messages, which is why XSalsa20 extends it to 192 bits.

**There is no integrity.** Flip a ciphertext bit and exactly that plaintext bit
flips, with nothing to detect it. Real systems pair Salsa20 with the Poly1305 MAC,
as in NaCl's secretbox, and ChaCha20 with Poly1305 in TLS.

**This file is for reading, not for use.** It has had none of the care a real
implementation needs.
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
