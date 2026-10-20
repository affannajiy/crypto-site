/**
 * SHA-512.
 *
 * **Do not use this implementation for anything real** — the usual reason, plus
 * one specific to this file: the state is `bigint`, which is legible and slow.
 * The Benchmark tab will report SHA-512 as slower than SHA-256 here, and on a
 * real 64-bit CPU the opposite is true. The explainer says so rather than letting
 * the page imply a fact about the algorithm that is really a fact about
 * JavaScript.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { sha512, sha512Trace } from './sha512';
import Widths from './Widths';

const explainer = `
SHA-256 with everything widened.

## How it works

- It uses 64-bit words, 128-byte blocks, 80 rounds and a 512-bit digest.
- Its rotation amounts are new values, not SHA-256's values doubled.
- This page derives the 80 constants from the cube roots of the first 80 primes. It does not paste them in.
- It is faster than SHA-256 on a 64-bit CPU, but not here. JavaScript BigInt makes it slow.

## Lecture note

- Lecture 06 names SHA-512 but gives no detail. Its differences are 64-bit words and 80 steps.
- A longer digest does not make it meaningfully safer. SHA-256 is already out of reach.

## How this breaks

- **There is no practical attack.** The best collision attacks reach about 28 of the 80 rounds.
- **It has the same misuses as SHA-256.** It is not encryption, it is not a password hash, and it allows length extension. SHA-384 and SHA-512/256 do not allow length extension.
`;

const sha512Cipher: CipherModule = {
  slug: 'sha-512',
  name: 'SHA-512',
  family: 'hashing',
  year: '2001',
  origin: 'The NSA, published by NIST alongside SHA-256 as part of SHA-2',
  keyType: 'No key. A 512-bit digest of any input.',
  security: 'secure',
  difficulty: 'advanced',
  keywords: ['hash', 'digest', 'sha-2', 'one way', '64-bit', 'sha-384', 'modern', 'fingerprint'],
  blurb:
    'SHA-256 with every width doubled. Not more secure in any way you can use — faster, on a 64-bit CPU.',
  explainer,
  oneWay: true,
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [],
  examples: [
    { label: 'The FIPS test vector', input: 'abc' },
    { label: 'The classic pangram', input: 'The quick brown fox jumps over the lazy dog' },
    { label: 'Nothing at all', input: '' },
  ],

  encrypt(input: string, _p: Params): TraceResult {
    return sha512Trace(input);
  },

  benchmark(input: string, _p: Params): string {
    return sha512(input);
  },

  visualize: Widths,
};

export default sha512Cipher;
