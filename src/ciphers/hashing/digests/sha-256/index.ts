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
Everything else in this app can be undone. Give a cipher the key and the ciphertext
and the message comes back. A hash has no key, no ciphertext and no way back: it
takes a message of any length and returns exactly 256 bits, and those bits are all
you get.

That is not a limitation to work around. It is what makes it useful. If a digest
could be reversed it would be a compression algorithm, and 256 bits cannot hold a
novel.

## What it actually does

The message is padded — a 1 bit, some zeros, and the original length written into
the last eight bytes — and then chopped into 64-byte blocks. Each block is expanded
into sixty-four 32-bit words, and those words are stirred into eight running values
over sixty-four rounds:

    a b c d e f g h
     \\ \\ \\ \\ \\ \\ \\
      shift along, and
      e += d + T1
      a  = T1 + T2

where **T1** folds in the round's message word and its constant, and **T2** folds
the top half back into itself. Watch the Visualize tab: every round moves every
word, so a bit that enters at round three has touched all eight by round ten.

The constants are the fractional parts of cube roots of primes, and the initial
values the square roots. They are chosen to be *arbitrary* — "nothing up my sleeve"
numbers, so that nobody can be accused of picking them to hide a weakness.

## Where the information goes

Here is the part worth pausing on. The sixty-four rounds are **reversible**: given
the state after round sixty-four and the message schedule, you could run them
backwards. The one-way step is the last line of each block, where the result is
*added* to the values the block started with. Addition throws away the carry, two
different inputs can add to the same output, and that is the whole trick.

## The avalanche

Change one character of the message and roughly half of the 256 output bits flip.
Not a few near the change — half, everywhere, with no pattern. The Visualize tab
shows both digests bit by bit. A hash where a small change made a small difference
would let an attacker steer, and steering is what breaking a hash means.

## How this breaks

It does not, currently, and that is the honest answer. There is no known practical
way to find two messages with the same SHA-256 digest, or to find a message with a
chosen digest. The best published collision attacks reach about 31 of the 64 rounds.

What breaks in practice is everything around it:

- **A hash is not encryption.** It hides nothing you can guess. If the input is a
  postcode, a date of birth or a password, an attacker hashes every candidate and
  compares — billions per second on a graphics card. This is why passwords need a
  *slow*, salted function (bcrypt, scrypt, Argon2, PBKDF2), not SHA-256.
- **A hash is not a signature.** Anyone can compute one. Proving a message came
  from you needs a key: that is HMAC or a real signature.
- **Length extension.** Because the digest *is* the internal state, someone who
  knows \`sha256(secret + message)\` and the length of \`secret\` can compute
  \`sha256(secret + message + extra)\` without knowing the secret at all. SHA-256
  has this property; SHA-3 and HMAC do not. It is the reason \`sha256(secret + data)\`
  is a broken way to authenticate anything.
- **Its ancestors fell.** MD5 and SHA-1 were also "no known practical attack",
  until they were not. SHA-256 looks solid, and so did they.
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
