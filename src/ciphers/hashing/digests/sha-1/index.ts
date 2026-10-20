/**
 * SHA-1.
 *
 * **Do not use this for anything real.** Broken by collision in 2017, and by
 * chosen-prefix collision in 2019 — which is the dangerous kind, because it lets
 * an attacker pick both documents rather than accept two blobs.
 *
 * No Attack tab: a collision search takes no ciphertext, so `attack(ciphertext)`
 * cannot express it (gap 6). The published collision is two 400-kilobyte PDFs,
 * too large to embed, so Visualize teaches the two things a reader can check
 * here instead — SHA-0 versus SHA-1, and the four stages.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { sha1, sha1Trace } from './sha1';
import Stages from './Stages';

const explainer = `
A 160-bit hash from 1995. Web certificates used it for a decade, and git still uses it. It has been broken since 2017.

## How it works

- It works like MD5, but wider: five 32-bit words and 80 steps. The 16 message words are expanded to 80.
- The steps are four stages of 20, each with its own function and constant.
- SHA-0 (1993) did not have one \`rotate left 1\` in the message schedule. The Visualize tab hashes your message with both.

## Lecture note

- The lecture table says 80 iterations and 20 rounds. SHA-1 has 4 rounds of 20 steps, which is 80 steps in total.
- The table says SHA-1 "appears not to be vulnerable". That is out of date. There has been a practical collision since 2017, and a chosen-prefix collision since 2019.

## How this breaks

- **SHAttered (2017)** made two PDFs with the same digest. It took about 2⁶³ work.
- **The chosen-prefix collision (2019)** lets an attacker forge a version of a document that the attacker chooses.
- **It is being replaced.** Browsers stopped accepting SHA-1 certificates in 2017, and git is moving to SHA-256.
`;

const sha1Cipher: CipherModule = {
  slug: 'sha-1',
  name: 'SHA-1',
  family: 'hashing',
  year: '1995',
  origin: 'The NSA, as a repair to the withdrawn SHA-0 of 1993',
  keyType: 'No key. A 160-bit digest of any input.',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['hash', 'digest', 'collision', 'shattered', 'one way', 'git', 'certificate', 'sha-0'],
  blurb:
    'A 160-bit digest, broken by collision in 2017. Its whole difference from SHA-0 is one rotation.',
  explainer,
  oneWay: true,
  tiers: ['encrypt', 'visualize', 'benchmark'],
  visualizeNote:
    'Your message from the Encrypt tab, hashed twice — once by SHA-1 and once by the withdrawn SHA-0, which differs from it by a single rotation.',
  params: [],
  examples: [
    { label: 'The FIPS test vector', input: 'abc' },
    { label: 'The classic pangram', input: 'The quick brown fox jumps over the lazy dog' },
    { label: 'One letter different', input: 'The quick brown fox jumps over the lazy cog' },
    { label: 'Nothing at all', input: '' },
  ],

  encrypt(input: string, _p: Params): TraceResult {
    return sha1Trace(input);
  },

  benchmark(input: string, _p: Params): string {
    return sha1(input);
  },

  visualize: Stages,
};

export default sha1Cipher;
