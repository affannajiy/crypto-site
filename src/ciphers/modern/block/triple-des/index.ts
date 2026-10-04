/**
 * Triple DES's entry in the registry.
 *
 * **No Attack tab.** The best attack is meet-in-the-middle over 2^112 work, and
 * the practical break is Sweet32, which needs about 32 GB of traffic under one
 * key. Neither is a button. See the explainer.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { type Keying, tripleDes, tripleDesTrace } from './tripledes';
import { readIv, readKey } from '../des/des';
import { MODE_OPTIONS, readMode } from '../../../../lib/modes';
import { FORMAT_OPTIONS, readFormat } from '../../../../lib/blockMessage';
import TripleDesPasses from './TripleDesPasses';

/** The Lab 04 keys, given there as 64-bit binary strings. */
const LAB_K1 = '133457799bbcdff1';
const LAB_K2 = '0123456789abcdef';

function readKeying(value: unknown): Keying {
  const text = String(value ?? '');
  return text === '3-key' || text === '1-key' ? text : '2-key';
}

function readOptions(p: Params) {
  const keying = readKeying(p['keying']);
  return {
    k1: readKey(String(p['k1'] ?? ''), 'K1'),
    k2: keying === '1-key' ? new Uint8Array(8) : readKey(String(p['k2'] ?? ''), 'K2'),
    k3: keying === '3-key' ? readKey(String(p['k3'] ?? ''), 'K3') : new Uint8Array(8),
    keying,
    mode: readMode(p['mode']),
    iv: readIv(String(p['iv'] ?? '')),
    format: readFormat(p['format']),
  };
}

const explainer = `
Triple DES, or TDEA, runs **DES three times** on every block. By the late 1990s a
56-bit key could be searched in days, but banks and governments had DES in
hardware everywhere. 3DES kept that hardware and that algorithm and multiplied
the key.

## How it works

Lab 04 gives the scheme exactly:

    ciphertext = E(K3, D(K2, E(K1, plaintext)))
    plaintext  = D(K1, E(K2, D(K3, ciphertext)))

Encrypt with K1, **decrypt** with K2, encrypt with K3. To decrypt, do the
reverse: decrypt with K3, encrypt with K2, decrypt with K1. Each pass is the
ordinary DES on the DES page, all sixteen rounds of it. The Visualize tab shows
the value between every pass, and opens the DES ladder for any one of them.

## Why the middle step decrypts

If K1 = K2, the first two passes cancel, and what is left is single DES under K3.
So a 3DES device could still talk to an old DES device. Choose the **one-key**
option and encrypt the classic DES vector 0123456789ABCDEF with key 133457799BBCDFF1:
the answer is 85E813540F0AB405, exactly the DES answer.

## The keying options

| Option | Keys | Key bits | Lab 04 says |
| --- | --- | --- | --- |
| 1 | K1, K2, K3 all different | 168 (56 × 3) | Strongest, but meet-in-the-middle still applies |
| 2 | K3 = K1 | 112 | NIST has deprecated this option |
| 3 | K1 = K2 = K3 | 56 | Only for backward compatibility with DES |

The numbering above is the lab's. The lab's own keys are K1 = 133457799BBCDFF1,
K2 = 0123456789ABCDEF and K3 = K1, so they are **option 2**. That is the first
example. Each key is given in the lab as 64 binary digits, and the same keys are
written here in hex: 0001 0011 0011 0100 … is 1 3 3 4 …

## Lecture note

The lab says option 1 resists a meet-in-the-middle attack that "requires 2² × 56
steps". The exponent is garbled. It means **2^(2×56) = 2¹¹²** steps. That is why
three 56-bit keys give about 112 bits of security, not 168. In the same way,
double DES needs only about 2⁵⁷ work, not 2¹¹², which is why nobody uses two
passes.

## How this breaks

**Meet in the middle.** Encrypt a known plaintext forward under every K1 and store
the results. Decrypt the ciphertext backward under every K3 and look for a match
in the middle. Splitting the work this way means three keys cost about 2¹¹²
instead of 2¹⁶⁸. That is still far beyond reach, so this is not how 3DES fell.

**The block is too small.** 3DES has the 64-bit block of DES. After about 2³²
blocks, around 32 GB, two ciphertext blocks are likely to collide in CBC mode, and
a collision leaks the XOR of two plaintext blocks. The **Sweet32** attack used this
against real HTTPS and OpenVPN connections in 2016. A key length does not help
here at all: the problem is the block.

**And it is slow.** Three DES passes per block made 3DES about three times slower
than DES, which was already slow in software. AES replaced it, and NIST withdrew
3DES entirely in 2023. There is no Attack tab, because neither attack is a button.
`.trim();

const tripleDesCipher: CipherModule = {
  slug: 'triple-des',
  name: 'Triple DES (3DES)',
  family: 'symmetric',
  year: '1998',
  origin: 'ANSI X9.52 and NIST SP 800-67, from IBM’s DES',
  keyType: 'Two or three 64-bit DES keys',
  security: 'deprecated',
  difficulty: 'advanced',
  keywords: ['3des', 'tdea', 'tdes', 'des-ede', 'triple', 'block cipher', 'lab 04', 'meet in the middle', 'sweet32'],
  blurb: 'DES three times, encrypt-decrypt-encrypt. Lab 04’s answer to a 56-bit key.',
  explainer,
  // No 'attack'. See the file header.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'select',
      name: 'keying',
      label: 'Keying option',
      options: [
        { value: '2-key', label: 'Two keys — K3 = K1 (the lab’s keys)' },
        { value: '3-key', label: 'Three keys — K1, K2, K3 all independent' },
        { value: '1-key', label: 'One key — K1 = K2 = K3, which is plain DES' },
      ],
      default: '2-key',
    },
    {
      kind: 'text',
      name: 'k1',
      label: 'K1 (16 hex digits)',
      default: LAB_K1,
      placeholder: '16 hex digits',
      randomise: { alphabet: 'hex', length: 16 },
    },
    {
      kind: 'text',
      name: 'k2',
      label: 'K2 (16 hex digits; unused with one key)',
      default: LAB_K2,
      placeholder: '16 hex digits',
      randomise: { alphabet: 'hex', length: 16 },
    },
    {
      kind: 'text',
      name: 'k3',
      label: 'K3 (16 hex digits; three-key option only)',
      default: 'fedcba9876543210',
      placeholder: '16 hex digits',
      randomise: { alphabet: 'hex', length: 16 },
    },
    { kind: 'select', name: 'mode', label: 'Mode', options: MODE_OPTIONS, default: 'CBC' },
    {
      kind: 'text',
      name: 'iv',
      label: 'IV (16 hex digits; unused in ECB, the first counter in CTR)',
      default: '0f0e0d0c0b0a0908',
      placeholder: '16 hex digits',
      randomise: { alphabet: 'hex', length: 16 },
    },
    {
      kind: 'select',
      name: 'format',
      label: 'Message format (when encrypting)',
      options: FORMAT_OPTIONS,
      default: 'text',
      randomise: false,
    },
  ],
  textParams: { format: 'text' },
  examples: [
    {
      label: 'Lab 04 keys (K3 = K1), one block',
      input: '0123456789ABCDEF',
      params: { keying: '2-key', k1: LAB_K1, k2: LAB_K2, mode: 'ECB', format: 'hex' },
    },
    {
      label: 'One key is plain DES: 85E813540F0AB405 again',
      input: '0123456789ABCDEF',
      params: { keying: '1-key', k1: LAB_K1, mode: 'ECB', format: 'hex' },
    },
    {
      label: 'Three independent keys, one block',
      input: '0123456789ABCDEF',
      params: { keying: '3-key', k1: LAB_K1, k2: LAB_K2, k3: 'fedcba9876543210', mode: 'ECB', format: 'hex' },
    },
    {
      label: 'A sentence, three keys, CBC',
      input: 'Meet me at the old bridge at midnight.',
      params: { keying: '3-key', k1: LAB_K1, k2: LAB_K2, k3: 'fedcba9876543210', mode: 'CBC', iv: '0f0e0d0c0b0a0908', format: 'text' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return tripleDesTrace(input, readOptions(p), 'encrypt');
  },

  benchmark(input: string, p: Params): string {
    return tripleDes(input, readOptions(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return tripleDesTrace(input, readOptions(p), 'decrypt');
  },

  visualize: TripleDesPasses,
};

export default tripleDesCipher;
