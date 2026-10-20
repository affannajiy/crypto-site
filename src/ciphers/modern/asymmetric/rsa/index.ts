/**
 * RSA's entry in the registry.
 *
 * **No Attack tab**, and it is contract gap 6 again — the fourth cipher to hit it,
 * from a new direction. Hill and Enigma need a *crib*; ADFGVX needs *several
 * messages*; RSA needs the **public key**, which is a param and not a ciphertext.
 * `attack(ciphertext)` can express none of the three.
 *
 * So the break lives on the **Visualize** tab, which does receive params: it
 * factors n by trial division, times it, recovers d and decrypts. That is not a
 * workaround for a missing feature so much as the right home for it — RSA's break
 * is an attack on a *key*, not on a message, and putting it beside the key
 * generation is where it belongs.
 *
 * The gap is now worth fixing, and CLAUDE.md records that.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { MAX_PRIME, type MessageKind, buildKeys, gcd, isPrime, rsaTrace } from './rsa';
import { randomIntInclusive } from '../../../params';
import RsaKeys from './RsaKeys';

function readKind(p: Params): MessageKind {
  return String(p['message'] ?? 'numbers') === 'text' ? 'text' : 'numbers';
}

/** Params arrive as `string | number` because they come from form controls. */
function readKeys(p: Params) {
  return buildKeys(Number(p['p'] ?? 47), Number(p['q'] ?? 59), Number(p['e'] ?? 17), readKind(p));
}

const explainer = `
Two keys: a public key encrypts and a private key decrypts. The security rests on factoring n.

    n = p × q              φ(n) = (p−1)(q−1)
    e coprime with φ(n)    d = e⁻¹ mod φ(n)
    encrypt: c = mᵉ mod n  decrypt: m = c^d mod n

## How it works

- The lecture example: p = 47, q = 59, n = 2773, φ(n) = 2668, e = 17 and d = 157. M = 31 encrypts to 587, and 587 decrypts to 31.
- The Visualize tab finds d with the extended Euclidean algorithm.
- The message is numbers below n. Text mode makes each byte one number, so n must be more than 255.
- The Lab 07 signature: hash the document, sign the hash with the private key, then verify with the public key. It is on the Visualize tab.

## Lecture note

- For p = 3, q = 7, φ(n) = 12. The slide's list of valid e includes 8 and 10, but both share the factor 2 with 12. The valid values are 5, 7 and 11.
- For p = 2, q = 7, e = 5, the slide uses d = 11 and this page computes d = 5. Both are correct, because the inverse is defined only mod φ(n) = 6.
- Lab 05 uses e = 65537 with φ(n) = 160. That breaks the rule 1 < e < φ(n). With e = 7, d = 23.
- Lab 05 encrypts M = 345 with n = 187, but M must be less than n.
- "TrueCrypt" is disk-encryption software, not a public-key algorithm.

## How this breaks

- **Factor n.** The Visualize tab factors n instantly. Real keys use 2048 bits or more.
- **Shor's algorithm** factors n on a quantum computer.
- **This is textbook RSA, which is deterministic.** An attacker can encrypt a guess and compare it with the ciphertext. One byte per number means only 256 guesses.
- **The fix is OAEP padding.** In practice, RSA only carries an AES key.
`.trim();

const rsaCipher: CipherModule = {
  slug: 'rsa',
  name: 'RSA',
  family: 'asymmetric',
  year: '1977',
  origin: 'Rivest, Shamir and Adleman',
  keyType: 'A public exponent and modulus; a private exponent kept back',
  security: 'secure',
  difficulty: 'advanced',
  keywords: ['public key', 'asymmetric', 'factoring', 'modular exponentiation', 'primes', 'totient', 'digital signature', 'euclidean algorithm', 'lab 05', 'lab 07'],
  blurb: 'Two keys, one published. The first cipher here that needs no shared secret.',
  explainer,
  // No 'attack'. RSA is broken through the public key, which is a param rather
  // than a ciphertext. The break lives on the Visualize tab; see the file header.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    { kind: 'number', name: 'p', label: 'p (a prime)', min: 2, max: MAX_PRIME, default: 47 },
    { kind: 'number', name: 'q', label: 'q (a different prime)', min: 2, max: MAX_PRIME, default: 59 },
    { kind: 'number', name: 'e', label: 'e (public exponent, coprime with φ(n))', min: 2, max: 65537, default: 17 },
    {
      kind: 'select',
      name: 'message',
      label: 'Message',
      options: [
        { value: 'numbers', label: 'Numbers — each M less than n, as in the lecture' },
        { value: 'text', label: 'Text — one number per byte (needs n > 255)' },
      ],
      default: 'numbers',
      randomise: false,
    },
  ],
  textParams: { message: 'text' },
  quizzes: [
    {
      question: 'Quiz 3: write the formula for encryption using the public key, and for decryption using the private key.',
      answer: 'Encrypt: C = Mᵉ mod n. Decrypt: M = Cᵈ mod n.',
    },
    {
      question: 'Encrypt M = 31 with p = 47, q = 59 and e = 17.',
      run: { input: '31', params: { p: 47, q: 59, e: 17 } },
    },
    {
      question: 'With p = 3 and q = 7, which values of e are acceptable?',
      answer: '5, 7 and 11. Each must be coprime with (p − 1)(q − 1) = 12.',
      note: 'The slide also lists 8 and 10. Both share the factor 2 with 12, so neither has an inverse d.',
    },
  ],
  examples: [
    {
      label: 'Lecture example: M = 31 encrypts to 587',
      input: '31',
      params: { p: 47, q: 59, e: 17, message: 'numbers' },
    },
    {
      label: 'Lecture diagram: n = 14, e = 5, M = 2',
      input: '2',
      params: { p: 2, q: 7, e: 5, message: 'numbers' },
    },
    {
      label: 'Lecture: e = 8 is not allowed with p = 3, q = 7',
      input: '5',
      params: { p: 3, q: 7, e: 8, message: 'numbers' },
      demonstratesError: true,
    },
    {
      label: 'Lab 05: p = 17, q = 11, e = 7, M = 42',
      input: '42',
      params: { p: 17, q: 11, e: 7, message: 'numbers' },
    },
    {
      label: 'Lab 05 as printed: e = 65537 is larger than φ(n) = 160',
      input: '42',
      params: { p: 17, q: 11, e: 65537, message: 'numbers' },
      demonstratesError: true,
    },
    {
      label: 'Lab 05: M = 345 is not less than n = 187',
      input: '345',
      params: { p: 17, q: 11, e: 7, message: 'numbers' },
      demonstratesError: true,
    },
    {
      label: 'Several numbers at once',
      input: '31 100 2000 2772',
      params: { p: 47, q: 59, e: 17, message: 'numbers' },
    },
    {
      label: 'Text, one byte at a time',
      input: 'Meet me at dawn.',
      params: { p: 47, q: 59, e: 17, message: 'text' },
    },
  ],

  /**
   * Two different primes and an exponent coprime with phi(n).
   *
   * p and q are drawn from the primes this page can actually handle, and the
   * lower bound is what keeps n above 255 — the page encrypts one byte at a
   * time, so a smaller n produces a key that is valid arithmetic and useless
   * here. e is tried against phi(n) rather than assumed: 65537 is the real-world
   * answer and is larger than phi for toy primes, so the honest generator walks
   * the small odd candidates instead.
   */
  randomKey(): Params {
    const prime = () => {
      for (let tries = 0; tries < 500; tries += 1) {
        const candidate = randomIntInclusive(17, MAX_PRIME);
        if (isPrime(candidate)) return candidate;
      }
      return 61;
    };
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const p = prime();
      const q = prime();
      if (p === q || p * q <= 255) continue;
      const phi = BigInt(p - 1) * BigInt(q - 1);
      const e = [3, 5, 7, 11, 13, 17, 257, 65537].find(
        (candidate) => BigInt(candidate) < phi && gcd(BigInt(candidate), phi) === 1n,
      );
      if (e !== undefined) return { p, q, e };
    }
    return { p: 47, q: 59, e: 17 };
  },

  encrypt(input: string, p: Params): TraceResult {
    return rsaTrace(input, readKeys(p), 'encrypt', readKind(p));
  },

  decrypt(input: string, p: Params): TraceResult {
    return rsaTrace(input, readKeys(p), 'decrypt', readKind(p));
  },

  visualize: RsaKeys,
};

export default rsaCipher;
