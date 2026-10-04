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
Every cipher before this one on the site shares an assumption so complete that it
is easy to miss: **the two people already share a secret**. Caesar, Vigenère,
Enigma, AES, ChaCha20 — every one needs the key to have already travelled from one
party to the other, and not one of them can help with that. For three thousand
years that was simply the shape of the problem.

RSA is where it breaks. There are **two keys**. One encrypts and one decrypts, and
knowing the first tells you nothing usable about the second. So the encrypting key
can be published — put on a business card, served over plain HTTP, printed in a
newspaper — and anyone at all can send you a message that only you can read.

## How

    n = p × q                  two primes, multiplied
    φ(n) = (p−1)(q−1)          Euler's totient
    e                          public, coprime with φ(n)
    d = e⁻¹ mod φ(n)           private

    encrypt:  c = mᵉ mod n
    decrypt:  m = c^d mod n

It works because raising to *e* and then to *d* is raising to *ed*, and *ed* is 1
more than a multiple of φ(n), and Euler's theorem says that brings you back where
you started.

The whole security sits in one sentence: **computing d needs φ(n), computing φ(n)
needs p and q, and all anyone is given is n.** Factoring n is the attack, and
there is no other route in.

Note what *e* has to satisfy: it must be coprime with φ(n), or it has no inverse
and no private key exists. That is the **Affine cipher's condition**, from the
classical section, in a much larger modulus — and it fails for exactly the same
reason.

## The lecture example

Lecture 05 sets up RSA with p = 47 and q = 59. Those are this page's defaults, and
the first example is the lecture's message:

    Step 1:  n = p × q = 47 × 59 = 2773
    Step 2:  choose e = 17
    Step 3:  publish (n, e) = (2773, 17)
    Step 4:  φ(n) = (p−1)(q−1) = 46 × 58 = 2668
             17 × d ≡ 1 (mod 2668)  gives  d = 157
             check: 17 × 157 = 2669 = 2668 + 1

    Encrypt M = 31:  C = 31¹⁷ mod 2773 = 587
    Decrypt C = 587: M = 587¹⁵⁷ mod 2773 = 31

The Visualize tab builds the same key table, works out d with the extended
Euclidean algorithm row by row, and writes the first number out the same way.

The message is **numbers** by default, because that is what RSA encrypts. Each
number must be less than n. Switch the message to **text** to encrypt words: each
byte then becomes one number, so n must be more than 255.

## Choosing e

The lecture tries every e for p = 3 and q = 7, where (p−1)(q−1) = 12. Any e that
shares a factor with 12 fails, so 2, 3, 4, 6, 8, 9 and 10 are out. The lecture's
list of survivors includes 8 and 10 by mistake, because both share the factor 2
with 12. The values that work are **5, 7 and 11**. Try p = 3, q = 7, e = 8 here and
the page refuses with the reason.

## Lecture and lab notes

- The lecture's diagram example uses p = 2, q = 7, n = 14, e = 5 and d = 11, and
  encrypts 2 to 4. This page computes d = 5 for that key, and both are right:
  5 × 5 = 25 and 5 × 11 = 55 are each 1 more than a multiple of 6. The inverse
  is only defined mod φ(n) = 6, and 11 = 5 + 6. Load the example to check.
- Lab 05 uses p = 17, q = 11 and e = 65537, but φ(n) is only 160, so e is larger
  than φ(n). That breaks the lab's own rule 1 < e < φ(n). The example with that key
  shows the error. With e = 7 instead, d = 23.
- Lab 05 then asks you to encrypt M = 345 with n = 187. RSA works mod n, so M must
  be less than n. 345 would come back as 345 mod 187 = 158. The page refuses it and
  says why.
- The lecture names four public-key algorithms: RSA, El Gamal, McEliece and
  "TrueCrypt". TrueCrypt is disk-encryption software, not a public-key algorithm.

## Digital signatures

Lab 07 signs a document by hashing it and then encrypting the hash with the
**private** key. Anyone verifies by decrypting with the **public** key and
comparing hashes. The Visualize tab has a working signature on this page's key:
sign, then change one letter of the document and watch the check fail.

## This page uses toy primes on purpose

Small enough that the Visualize tab factors n while you watch, and shows you the
private key falling out. Real RSA uses 2048-bit or 4096-bit moduli, which are
between 600 and 1200 decimal digits.

**And this is textbook RSA, which is not an encryption scheme you may use.** The
next section is not a list of caveats. It is the difference between the arithmetic
above and something that works.

## How this breaks

**Factor n and it is over.** The Visualize tab does it by trial division and it
takes a millisecond here. Nothing about the method changes for a 2048-bit modulus
except the running time — and the running time *is* the security. RSA is not safe
because factoring is impossible; it is safe because nobody has published a fast way
to do it. That is a claim about the present state of knowledge, not a proof.

**Small keys are dead.** RSA-768 was factored in 2009. RSA-829 in 2020. 1024-bit
keys are considered broken by well-resourced attackers and have been deprecated for
years. 2048 is the current floor.

**Shor's algorithm factors in polynomial time on a quantum computer.** Not
"faster"; a different complexity class. RSA does not have a longer-key answer to
this the way symmetric ciphers do, which is why post-quantum cryptography is an
active field with standards already published.

**Textbook RSA is deterministic, and that alone is fatal.** The same message always
gives the same ciphertext, so an attacker who suspects the plaintext can encrypt
their guess with the *public* key and compare. Encrypting a yes/no answer, a credit
card number, or a vote with textbook RSA leaks it immediately, because there are
few enough possibilities to try them all.

**Small messages do not even need factoring.** With e = 3 and a message m where
m³ < n, the modulus never applies and the "encryption" is a cube. Take the ordinary
cube root and you have the plaintext. This page encrypts one byte at a time, so it
is wide open to precisely this — anyone can build a table of all 256 possible
ciphertexts from the public key alone.

**RSA is malleable.** Multiply a ciphertext by 2ᵉ and the plaintext is multiplied
by 2, without anyone decrypting anything. That is a real attack on real protocols,
and it is why encryption without authentication keeps failing.

The answer to all of this is **padding** — OAEP, which adds randomness and
structure so that the same message encrypts differently every time and malformed
ciphertexts are rejected. The older PKCS#1 v1.5 padding was itself broken by
Bleichenbacher's attack in 1998 and *keeps* being rediscovered in real software
(ROBOT, 2017), which says something about how hard this is to get right.

**And nobody encrypts data with RSA anyway.** It is thousands of times slower than
AES and can only encrypt a message shorter than the modulus. In practice RSA moves
an **AES key**, and AES moves the data. That hybrid is what your browser does on
every HTTPS connection: public-key cryptography to agree on a symmetric key,
symmetric cryptography for everything after. RSA solved the key distribution
problem, and then handed the actual work back to the ciphers that were already good
at it.
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
