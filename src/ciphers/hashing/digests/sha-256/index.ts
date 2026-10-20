/**
 * SHA-256.
 *
 * **Do not use this implementation for anything real.** See the header of
 * `sha256.ts`: it is written round by round for legibility, its table lookups
 * are not constant-time, and the honest source of a digest you depend on is
 * `crypto.subtle.digest`.
 *
 * This is the first module in the app that is not a cipher. It declares
 * `oneWay: true`, has no `decrypt`, and the workbench renders no direction
 * control for it — which is gap 8 in the project notes, settled before this
 * folder existed rather than during it.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { sha256, sha256Trace } from './sha256';
import Avalanche from './Avalanche';

const explainer = `
A one-way function: any message goes in and 256 bits come out. There is no key and no way back.

## How it works

- Pad the message (a 1 bit, zeros, then the length) and split it into 64-byte blocks.
- Expand each block to 64 words. Run 64 rounds over eight 32-bit words.
- Add the result to the block's starting values. That addition is the one-way step.
- The constants come from the cube roots of primes, and the starting values from square roots. Therefore nothing is hidden in them.
- **Avalanche:** change one letter and about half the bits flip. The Visualize tab shows this.

## Lecture note

- Lecture 06 names SHA-256 as deterministic, one-way and collision-resistant, but gives no detail.
- The lecture's toy "sum of the letters" hash is on the Visualize tab of the RSA page.

## How this breaks

- **There is no known practical attack.** The best collision attacks reach about 31 of the 64 rounds.
- **A hash is not encryption.** An attacker can hash every guess of an input such as a password. Passwords need a slow, salted function.
- **Length extension:** sha256(secret + message) can be extended without the secret. Use HMAC instead.
`;

const sha256Cipher: CipherModule = {
  slug: 'sha-256',
  name: 'SHA-256',
  family: 'hashing',
  year: '2001',
  origin: 'The NSA, published by NIST as part of SHA-2',
  keyType: 'No key at all. That is the point, and the limitation.',
  security: 'secure',
  difficulty: 'advanced',
  keywords: ['hash', 'digest', 'sha-2', 'one way', 'avalanche', 'collision', 'fingerprint', 'modern'],
  blurb: 'A one-way function. No key, no decryption, and half the output bits flip if you change one letter.',
  explainer,
  oneWay: true,
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [],
  examples: [
    { label: 'The FIPS test vector', input: 'abc' },
    { label: 'The classic pangram', input: 'The quick brown fox jumps over the lazy dog' },
    {
      label: 'One letter different',
      input: 'The quick brown fox jumps over the lazy cog',
    },
    { label: 'Nothing at all', input: '' },
  ],

  encrypt(input: string, _p: Params): TraceResult {
    return sha256Trace(input);
  },

  benchmark(input: string, _p: Params): string {
    return sha256(input);
  },

  visualize: Avalanche,
};

export default sha256Cipher;
