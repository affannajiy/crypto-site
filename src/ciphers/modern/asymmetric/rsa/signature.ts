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
