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
A 128-bit hash by Ronald Rivest, from 1992. It is broken: a collision takes seconds.

## How it works

- Pad the message and split it into 64-byte blocks.
- Run 64 steps, as 4 rounds of 16, over four 32-bit words. Then add the result back.
- Each round has its own function: F, G, H or I.
- The constants are floor(2³² × |sin(i+1)|). MD5 is little-endian, unlike SHA.

## Lecture note

- The lecture table lists 64 iterations and 16 rounds. MD5 has 4 rounds of 16 steps, which is 64 steps in total.
- The table says MD5 is "vulnerable to cryptanalytic attacks". That is correct, but it understates the problem.

## How this breaks

- **Collisions are easy.** In 2004, Wang and Yu published two 128-byte messages that differ in six bytes and have the same digest. They are on the Visualize tab.
- **The same suffix keeps a collision.** Add the same text to both messages and they still collide. Therefore two whole documents can collide.
- **The Flame malware used a collision.** In 2012 it forged a Microsoft code-signing certificate.
- **Use something else.** Use SHA-256 for a fingerprint, HMAC or a signature for authenticity, and Argon2 or bcrypt for a password.
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
