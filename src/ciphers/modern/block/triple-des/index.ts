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
Triple DES runs DES three times on every block, to stretch DES's 56-bit key.

    ciphertext = E(K3, D(K2, E(K1, plaintext)))
    plaintext  = D(K1, E(K2, D(K3, ciphertext)))

## How it works

- Encrypt with K1, decrypt with K2, then encrypt with K3. Each pass is full DES.
- If K1 = K2, the first two passes cancel and the result is single DES. This lets 3DES talk to old DES hardware.
- **Option 1:** three different keys, 168 bits.
- **Option 2:** K3 = K1, 112 bits. The lab's keys use this option.
- **Option 3:** one key, 56 bits, for DES compatibility.

## Lecture note

- The lab says meet-in-the-middle "requires 2² × 56 steps". It means **2^(2×56) = 2¹¹²**. Therefore three keys give about 112 bits of security, not 168.

## How this breaks

- **Meet in the middle** costs 2¹¹². That is still out of reach.
- **The 64-bit block is too small.** After about 32 GB, blocks collide. The Sweet32 attack of 2016 used this.
- **It is slow.** NIST withdrew 3DES in 2023. There is no Attack tab, because neither attack is a button.
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
