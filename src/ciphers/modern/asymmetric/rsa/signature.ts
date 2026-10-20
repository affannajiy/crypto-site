/**
 * RSA digital signatures, the way Lab 07 describes them.
 *
 *   Sign:    hash the document, then "encrypt" the hash with the PRIVATE key.
 *            s = H(m)^d mod n
 *   Verify:  "decrypt" the signature with the PUBLIC key, hash the document
 *            again, and compare.  s^e mod n == H(m)  ?
 *
 * The keys swap roles compared with encryption. Encryption uses the public key
 * so that only the owner can read. A signature uses the private key so that
 * anyone can check, and only the owner could have made it. That gives the three
 * properties the lab lists: authentication, integrity and non-repudiation.
 *
 * **The toy part.** SHA-256 gives a 256-bit number, and the moduli on this page
 * are about 12 bits. So the digest is reduced mod n before signing. That throws
 * almost all of the hash away, and two documents with the same H mod n share a
 * signature. Real RSA signs the whole digest, with a 2048-bit n and a padding
 * scheme (PKCS#1 v1.5 or PSS). The arithmetic is the same.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import { type KeyPair, modPow } from './rsa';
import { sha256 } from '../../../hashing/digests/sha-256/sha256';

export interface Signed {
  /** SHA-256 of the document, in hex. */
  digest: string;
  /** The digest as a number, reduced mod n so the toy key can sign it. */
  h: bigint;
  /** The signature: h^d mod n. */
  signature: bigint;
}

export interface Verified {
  digest: string;
  h: bigint;
  /** s^e mod n: what the signature says the hash was. */
  recovered: bigint;
  valid: boolean;
}

/** SHA-256 of the text, as a number reduced mod n. */
export function hashToNumber(message: string, n: bigint): { digest: string; h: bigint } {
  const digest = sha256(message);
  return { digest, h: BigInt(`0x${digest}`) % n };
}

/** Sign with the private exponent d. */
export function sign(message: string, keys: KeyPair): Signed {
  const { digest, h } = hashToNumber(message, keys.n);
  return { digest, h, signature: modPow(h, keys.d, keys.n) };
}

/** Verify with the public exponent e. Needs no secret at all. */
export function verify(message: string, signature: bigint, keys: Pick<KeyPair, 'n' | 'e'>): Verified {
  const { digest, h } = hashToNumber(message, keys.n);
  const recovered = modPow(signature, keys.e, keys.n);
  return { digest, h, recovered, valid: recovered === h };
}

/**
 * The toy hash-then-sign example from Lecture 06 (Digital Signature and Hash
 * Function), slide 17.
 *
 *   Alice's keys:  PU = (e, n) = (5, 14),  PR = (d, n) = (11, 14)
 *   Hash:          H(M) = (sum of the ASCII codes of M) mod 77
 *   Sign:          S = H(M)^d mod n
 *   Verify:        S^e mod n == H(M) ?
 *
 * Two slips on the slide, which this code does not copy:
 *
 * 1. "Cloud" is C 67 + l 108 + o 111 + u 117 + d 100 = 503, not 471. So H is
 *    503 mod 77 = 41, not 9. The slide's later arithmetic is right for its 9.
 * 2. H runs up to 76, but n is 14. RSA works on numbers below n, so a hash of
 *    14 or more is reduced mod 14 inside the exponentiation and cannot come back
 *    out as itself. Verifying "Cloud" honestly fails. The fix is the one real RSA
 *    uses: the hash must be smaller than the modulus.
 *
 * n = 14 = 2 x 7 is a valid modulus for the arithmetic: φ(14) = 6, and
 * 5 x 11 = 55 = 1 mod 6. It is only far too small.
 */
export const TOY_KEYS = { n: 14n, e: 5n, d: 11n } as const;
export const TOY_HASH_MODULUS = 77;

export interface ToyHash {
  codes: { char: string; code: number }[];
  sum: number;
  h: number;
}

export function toyHash(message: string): ToyHash {
  const codes = Array.from(message).map((char) => ({ char, code: char.codePointAt(0) ?? 0 }));
  const sum = codes.reduce((acc, c) => acc + c.code, 0);
  return { codes, sum, h: sum % TOY_HASH_MODULUS };
}

export interface ToySignature {
  hash: ToyHash;
  signature: bigint;
  /** S^e mod n: what Bob recovers from the signature. */
  recovered: bigint;
  /** True when H(M) is not below n, so it cannot survive the round trip. */
  hashTooBig: boolean;
  valid: boolean;
}

export function toySign(message: string): ToySignature {
  const hash = toyHash(message);
  const h = BigInt(hash.h);
  const signature = modPow(h, TOY_KEYS.d, TOY_KEYS.n);
  const recovered = modPow(signature, TOY_KEYS.e, TOY_KEYS.n);
  return { hash, signature, recovered, hashTooBig: h >= TOY_KEYS.n, valid: recovered === h };
}

/** The slide's collision hash: A = 1, B = 2, ... Z = 26, added up. "ABC" and "F" both give 6. */
export function letterSum(message: string): number {
  return Array.from(message.toUpperCase())
    .filter((c) => c >= 'A' && c <= 'Z')
    .reduce((acc, c) => acc + c.charCodeAt(0) - 64, 0);
}
