/**
 * MD5.
 *
 * **Do not use this for anything.** Not "not for real secrets, but fine for
 * learning" — MD5 is here *because* it is broken, and the Visualize tab is two
 * different messages with the same digest.
 *
 * It ships no Attack tab, and the reason is the fifth kind in the project notes'
 * table turned inside out: the attack is real, published, and runs in seconds,
 * but `attack(ciphertext)` cannot express it. A collision search takes no
 * ciphertext and returns no plaintext. So the break lives on Visualize, where
 * RSA's and Diffie-Hellman's also do.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { md5, md5Trace } from './md5';
import Collision from './Collision';

const explainer = `
MD5 turns any message into 128 bits, and for about a decade it was the default
answer to "how do I fingerprint this". It is still, right now, in more software
than anyone would like.

It works the way [SHA-256](#/cipher/sha-256) works: pad the message, chop it into
64-byte blocks, run sixty-four rounds over a small state, add the result back into
what the block started from. Four rounds of sixteen, each with its own non-linear
function:

    rounds  1-16   F(b,c,d) = (b AND c) OR (NOT b AND d)
    rounds 17-32   G(b,c,d) = (d AND b) OR (NOT d AND c)
    rounds 33-48   H(b,c,d) = b XOR c XOR d
    rounds 49-64   I(b,c,d) = c XOR (b OR NOT d)

The constants are \`floor(2^32 * |sin(i+1)|)\`, which is a nothing-up-my-sleeve
choice — arbitrary on purpose, and checkable from four lines of code rather than
sixty-four pasted numbers.

One detail catches everyone: MD5 is **little-endian** where SHA-2 is big-endian,
in the message words and in the digest. Get it backwards and you produce a
perfectly convincing hash that matches nothing in the world.

## How this breaks

It is broken, in the strongest sense available: **collisions are easy**.

Two different messages with the same MD5 digest are on the Visualize tab. They
were published by Wang and Yu in 2004, they are 128 bytes each, and they differ
in six of those bytes. A modern laptop finds a fresh pair in seconds.

Why it matters more than it sounds:

- **Append anything.** Once two messages collide, appending the *same* tail to
  both keeps them colliding — the internal states had already converged. So a
  collision is not two blobs of noise, it is two entire documents, two installers,
  two certificates. Try it on the Visualize tab.
- **A signature signs a digest, not a document.** Every real signature scheme
  hashes first. If two documents share a digest, a signature on one is a valid
  signature on the other, and the person who signed never saw the second.
- **Flame.** In 2012 a chosen-prefix MD5 collision was used to forge a Microsoft
  code-signing certificate, and the malware that carried it was signed as though
  Windows Update had written it. This is not a paper attack.
- **The design did not fail; the margins did.** 128 bits is small — a birthday
  attack needs only about 2⁶⁴ tries even against a perfect 128-bit hash — and the
  round function spreads a difference too slowly to stop one being steered.

What MD5 is still, arguably, fine for: spotting an accidentally corrupted download
where nobody is trying to trick you. The moment an adversary exists, it is over.
SHA-256 for a fingerprint, HMAC or a signature for authenticity, and Argon2 or
bcrypt for a password — never this.
`;

const md5Cipher: CipherModule = {
  slug: 'md5',
  name: 'MD5',
  family: 'hashing',
  year: '1992',
  origin: 'Ronald Rivest, MIT, as a repair to MD4',
  keyType: 'No key. A 128-bit digest of any input.',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['hash', 'digest', 'collision', 'one way', 'checksum', 'wang', 'broken hash', 'fingerprint'],
  blurb: 'A 128-bit digest that lost. Two different messages with the same hash are on the Visualize tab.',
  explainer,
  oneWay: true,
  tiers: ['encrypt', 'visualize', 'benchmark'],
  visualizeNote:
    'This tab is not a picture of your message. It is MD5’s break: two published messages, different from each other, that this app hashes to the same 128 bits.',
  params: [],
  examples: [
    { label: 'The RFC 1321 vector', input: 'abc' },
    { label: 'The classic pangram', input: 'The quick brown fox jumps over the lazy dog' },
    { label: 'Nothing at all', input: '' },
  ],

  encrypt(input: string, _p: Params): TraceResult {
    return md5Trace(input);
  },

  benchmark(input: string, _p: Params): string {
    return md5(input);
  },

  visualize: Collision,
};

export default md5Cipher;
