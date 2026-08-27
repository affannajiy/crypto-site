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
SHA-1 turns any message into 160 bits. It signed most of the web's certificates
for a decade, it is still what \`git\` names a commit with, and it has been broken
since 2017.

It stands between [MD5](#/cipher/md5) and [SHA-256](#/cipher/sha-256), and reading
the three in order is the clearest way to see what "strengthening a hash" actually
means:

    MD5       128 bits    4 words    64 rounds   no message expansion
    SHA-1     160 bits    5 words    80 rounds   16 words expanded to 80
    SHA-256   256 bits    8 words    64 rounds   16 to 64, with two rotations

The eighty rounds come in four stages of twenty, each with its own non-linear
function and its own constant — the Visualize tab lists them.

## The rotation that made it SHA-1

The NSA published this algorithm in 1993, then withdrew it two years later and
reissued it with **one change**: a \`rotate left 1\` added to the message schedule.
No explanation was given at the time. In 1998 Chabaud and Joux published an attack
on the original that the rotation defeats, which answered the question.

The Visualize tab computes both versions of your message, because a one-line
difference producing two unrelated digests is worth seeing rather than being told.

## How this breaks

**Collisions.** In February 2017 Google and CWI published *SHAttered*: two
different PDF files with the same SHA-1 digest. It cost roughly 2^63 SHA-1
computations — about 6,500 CPU-years, run in parallel. Expensive, and entirely
affordable for anyone who wanted it.

Then it got worse:

- **2019, chosen-prefix.** Leurent and Peyrin produced a collision where *both*
  prefixes are chosen by the attacker. That is the difference between "here are
  two odd files that happen to collide" and "here is a forged version of the
  specific document you were about to sign".
- **Cheaper every year.** The cost of that attack has only fallen since. It never
  goes the other way.

What follows, in practice:

- **Certificates.** Browsers stopped accepting SHA-1 certificates in 2017. That
  was late, not early.
- **Signatures.** A signature covers a digest. If two documents share one, a
  signature on either is a signature on both, and the signer only ever saw one.
- **git.** Object names are SHA-1, so a repository is a place where two different
  blobs could claim the same name. git added a collision-detection variant that
  refuses the known attack pattern, and is migrating to SHA-256 — a migration
  that is still not finished.

SHA-1 is fine only where nobody is trying to fool you and there is no better
option to hand. There is almost always a better option to hand.
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
