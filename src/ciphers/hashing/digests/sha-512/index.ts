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
SHA-512 is [SHA-256](#/cipher/sha-256) with everything widened. Same padding, same
message schedule, same eight working words shifted along and rewritten two at a
time, same irreversible addition at the end of each block. What changes is size:

    word         32 bits  ->  64 bits
    block        64 bytes ->  128 bytes
    rounds       64       ->  80
    constants    64       ->  80
    length field 64 bits  ->  128 bits
    digest       256 bits ->  512 bits

The rotation amounts change too, and they are *not* scaled versions of SHA-256's:
28/34/39 and 14/18/41 where SHA-256 uses 2/13/22 and 6/11/25. A 64-bit word needs
its own answer to "how far apart should these be", not the 32-bit answer doubled.

## The constants are computed here, not pasted

SHA-512's eighty constants are the first 64 bits of the fractional parts of the
cube roots of the first eighty primes. Most implementations paste in eighty
sixteen-digit hex literals that nobody ever checks. This one derives them with
exact integer arithmetic, so the "nothing up my sleeve" claim is ten lines you can
read rather than eighty numbers you have to trust. The test pins the first and the
last against the published values, in case the derivation is the thing that is
wrong.

## Why it is not simply "better than SHA-256"

Both are far beyond the size where the digest length is what matters. A collision
against SHA-256 needs about 2^128 operations by the birthday bound alone, which is
not a number anyone is getting to. Choosing SHA-512 over SHA-256 does not buy
security you can use.

What it buys is **speed on a 64-bit CPU**, where each round moves twice as much
data for the same instruction. SHA-512 is typically around 1.5× faster than
SHA-256 on a modern processor, which is the opposite of what people expect from
the bigger number.

It does not buy that here. This implementation holds 64-bit words as \`bigint\`
because JavaScript has no 64-bit integer type, and every operation allocates.
Run the Benchmark tab and SHA-512 loses to SHA-256 badly. That measurement is
about this file, not about the algorithm.

SHA-512 is also the base of SHA-384 and SHA-512/256, which are the same function
with different starting values and the output cut short — and truncating is what
makes them immune to the length-extension attack that SHA-256 has.

## How this breaks

It does not, currently. The best published collision attacks reach around 28 of
the 80 rounds. There is no practical attack on SHA-512, and none expected.

Everything that goes wrong with it goes wrong around it, and it is the same list
as SHA-256's:

- **It is not encryption.** Nothing is hidden that can be guessed. Hash a postcode
  and an attacker hashes every postcode.
- **It is not a password function.** Being fast is a virtue here and a fatal flaw
  there. Passwords need Argon2, bcrypt, scrypt or [PBKDF2](#/cipher/pbkdf2) —
  something deliberately slow, and salted.
- **It is not a signature.** Anyone can compute a digest. Authenticity needs a key:
  HMAC, or a real signature scheme.
- **Length extension.** Like SHA-256, the digest *is* the internal state, so
  someone who knows \`sha512(secret + message)\` and the length of the secret can
  extend it without knowing the secret. SHA-384 and SHA-512/256 cannot be extended
  this way, because they throw half the state away. Use HMAC and the question
  never arises.
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
