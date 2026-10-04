/**
 * RSA — Rivest, Shamir and Adleman, 1977.
 *
 * Every cipher before this one on the site shares one assumption so completely
 * that it is easy not to notice: **the two people already share a secret.** Caesar,
 * Vigenere, Enigma, AES, ChaCha20 — all of them need the key to have got from one
 * party to the other somehow, and none of them can help with that.
 *
 * RSA is where that assumption breaks. There are two keys. One encrypts, one
 * decrypts, and knowing the first does not give you the second. So the encrypting
 * key can be published — printed in a newspaper, served over HTTP, put on a
 * business card — and anyone at all can send you a message only you can read.
 *
 * ## The arithmetic
 *
 *     n = p x q                    (two primes, multiplied)
 *     phi = (p-1)(q-1)             (Euler's totient of n)
 *     e                            (public, coprime with phi)
 *     d = e^-1 mod phi             (private)
 *
 *     encrypt:  c = m^e mod n
 *     decrypt:  m = c^d mod n
 *
 * It works because of Euler's theorem: m^(ed) = m^(1 + k*phi) = m mod n. Computing
 * `phi` needs p and q, which means computing d from the public key needs the
 * **factors of n** — and factoring a large number is hard.
 *
 * ## What this page is and is not
 *
 * The primes here are small enough to factor instantly, on purpose, so the
 * Visualize tab can break its own key in front of you. Real RSA uses 2048-bit or
 * 4096-bit n.
 *
 * This is also **textbook RSA**, which is not a usable encryption scheme: it is
 * deterministic, it is malleable, and it is trivially broken for small messages.
 * Real RSA never encrypts a message directly — it wraps a padding scheme (OAEP)
 * around it, and even then it is used to move an AES key rather than to move data.
 * The explainer says all of this at length, because textbook RSA taught as if it
 * were RSA is a genuine source of broken software.
 *
 * Plain TypeScript, using BigInt. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export type Direction = 'encrypt' | 'decrypt';

/**
 * What the message box holds.
 *
 * The lecture and the labs work RSA on **numbers**: M = 31 encrypts to C = 587.
 * That is what RSA actually does, so it is the default. Text is the convenience
 * mode: each UTF-8 byte becomes one number, which needs n above 255.
 */
export type MessageKind = 'numbers' | 'text';

/** Small enough that the Visualize tab can factor n while you watch. */
export const MAX_PRIME = 3000;

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let f = 3; f * f <= n; f += 2) {
    if (n % f === 0) return false;
  }
  return true;
}

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** The extended Euclidean algorithm, which is how d is actually computed. */
export function modInverse(a: bigint, m: bigint): bigint | null {
  let [old_r, r] = [((a % m) + m) % m, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) return null;
  return ((old_s % m) + m) % m;
}

/** One line of the extended Euclidean table: r = s × e (mod φ). */
export interface EuclidRow {
  remainder: bigint;
  /** The quotient that produced this remainder from the two above. Null for the first two rows. */
  quotient: bigint | null;
  /** The coefficient s, with remainder ≡ s × e (mod φ). */
  s: bigint;
}

/**
 * The extended Euclidean algorithm as a table, the way the lecture says to
 * compute d. Start with φ and e. Divide, keep the remainder, and carry a
 * coefficient alongside. When the remainder reaches 1, its coefficient is d.
 *
 * For φ = 2668 and e = 17: 2668 = 156 × 17 + 16, then 17 = 1 × 16 + 1, and the
 * coefficient on that 1 is 157. So d = 157, as on the slide.
 */
export function euclidTable(e: bigint, phi: bigint): EuclidRow[] {
  const rows: EuclidRow[] = [
    { remainder: phi, quotient: null, s: 0n },
    { remainder: e, quotient: null, s: 1n },
  ];
  for (let guard = 0; guard < 200; guard += 1) {
    const a = rows[rows.length - 2];
    const b = rows[rows.length - 1];
    if (a === undefined || b === undefined || b.remainder === 0n || b.remainder === 1n) break;
    const quotient = a.remainder / b.remainder;
    rows.push({ remainder: a.remainder - quotient * b.remainder, quotient, s: a.s - quotient * b.s });
  }
  return rows;
}

/** Modular exponentiation by squaring. Never computes m^e itself, which would not fit. */
export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus === 1n) return 0n;
  let result = 1n;
  let b = ((base % modulus) + modulus) % modulus;
  let e = exponent;
  while (e > 0n) {
    if ((e & 1n) === 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

export interface KeyPair {
  p: number;
  q: number;
  n: bigint;
  phi: bigint;
  e: bigint;
  d: bigint;
}

/**
 * Builds the key pair, refusing anything that would not work and saying why.
 *
 * The errors matter as much as the arithmetic here: every one of them corresponds
 * to a real condition RSA has, and a page that silently produced a broken key
 * would be teaching that the conditions are optional.
 */
export function buildKeys(p: number, q: number, e: number, kind: MessageKind = 'text'): KeyPair {
  if (!isPrime(p)) throw new Error(`p must be prime, and ${p} is not.`);
  if (!isPrime(q)) throw new Error(`q must be prime, and ${q} is not.`);
  if (p === q) {
    throw new Error(
      `p and q must be different primes. If they are equal then n is a perfect square, and taking its square root recovers them instantly.`,
    );
  }

  const n = BigInt(p) * BigInt(q);
  const phi = BigInt(p - 1) * BigInt(q - 1);
  const eBig = BigInt(e);

  if (eBig <= 1n || eBig >= phi) {
    throw new Error(
      `e must satisfy 1 < e < φ(n) = (p−1)(q−1) = ${phi}, and ${e} does not. With primes this small, the usual e = 65537 is too large. Try a small prime such as 3, 5, 7 or 17.`,
    );
  }
  if (gcd(eBig, phi) !== 1n) {
    throw new Error(
      `e must be coprime with φ(n) = ${phi}. ${e} shares the factor ${gcd(eBig, phi)} with it, so it has no inverse and no private key exists. This is the Affine cipher's condition again, and it fails for the same reason.`,
    );
  }

  const d = modInverse(eBig, phi);
  if (d === null) throw new Error('No modular inverse for e, so no private key exists.');

  if (kind === 'text' && n <= 255n) {
    throw new Error(
      `n = ${n} is too small for text: text is encrypted one byte at a time, so n must be larger than 255. Try larger primes, or switch the message to numbers.`,
    );
  }

  return { p, q, n, phi, e: eBig, d };
}

/** The numbers in a ciphertext. Anything that is not a run of digits is ignored. */
export function parseNumbers(text: string): bigint[] {
  return (text.match(/\d+/g) ?? []).map((n) => BigInt(n));
}

/**
 * Reads the message as integers, each of which must be less than n.
 *
 * RSA works modulo n, so an M of n or more does not survive: it comes back as
 * M mod n. Lab 05 asks for M = 345 with n = 187, which is exactly this mistake.
 */
export function readMessageNumbers(text: string, n: bigint, what: 'M' | 'C'): bigint[] {
  if (/[^\d\s,]/.test(text)) {
    throw new Error(
      `In number mode the message is whole numbers separated by spaces, such as 31 or 42 7 99. To encrypt words, set the message to text.`,
    );
  }
  const numbers = parseNumbers(text);
  for (const value of numbers) {
    if (value >= n) {
      throw new Error(
        `${what} = ${value} is not less than n = ${n}. RSA works modulo n, so it would come back as ${value % n}, not ${value}. Use a smaller number, split it into blocks, or choose larger primes.`,
      );
    }
  }
  return numbers;
}

/** The cipher, untraced. Used by the benchmark. One number, or one byte, at a time. */
export function rsa(text: string, keys: KeyPair, direction: Direction, kind: MessageKind = 'text'): string {
  if (kind === 'numbers') {
    const exponent = direction === 'encrypt' ? keys.e : keys.d;
    return readMessageNumbers(text, keys.n, direction === 'encrypt' ? 'M' : 'C')
      .map((m) => modPow(m, exponent, keys.n).toString())
      .join(' ');
  }
  if (direction === 'encrypt') {
    return [...new TextEncoder().encode(text)]
      .map((byte) => modPow(BigInt(byte), keys.e, keys.n).toString())
      .join(' ');
  }

  const numbers = parseNumbers(text);
  const bytes = new Uint8Array(numbers.length);
  numbers.forEach((value, i) => {
    bytes[i] = Number(modPow(value, keys.d, keys.n) & 0xffn);
  });
  return new TextDecoder().decode(bytes);
}

/**
 * Factors n by trial division.
 *
 * This is the whole attack on RSA, and on this page it finishes instantly. That is
 * the point: nothing about it changes for a 2048-bit modulus except the running
 * time, and the running time is the entire security of the system.
 */
export function factor(n: bigint): { p: bigint; q: bigint; tried: number } | null {
  if (n % 2n === 0n) return { p: 2n, q: n / 2n, tried: 1 };
  let tried = 1;
  for (let f = 3n; f * f <= n; f += 2n) {
    tried += 1;
    if (n % f === 0n) return { p: f, q: n / f, tried };
  }
  return null;
}

/** Recovers the private key from the public one, given the factors. */
export function recoverPrivate(n: bigint, e: bigint): { p: bigint; q: bigint; phi: bigint; d: bigint; tried: number } | null {
  const factors = factor(n);
  if (factors === null) return null;
  const phi = (factors.p - 1n) * (factors.q - 1n);
  const d = modInverse(e, phi);
  if (d === null) return null;
  return { p: factors.p, q: factors.q, phi, d, tried: factors.tried };
}

/** Number mode, one `Step` per number, written the way the slides write it. */
function numbersTrace(text: string, keys: KeyPair, direction: Direction): TraceResult {
  const encrypting = direction === 'encrypt';
  const exponent = encrypting ? keys.e : keys.d;
  const values = readMessageNumbers(text, keys.n, encrypting ? 'M' : 'C');
  const steps: Step[] = [];
  const parts: string[] = [];
  let inAt = 0;

  values.forEach((value, i) => {
    const result = modPow(value, exponent, keys.n);
    const found = text.indexOf(value.toString(), inAt);
    const start = found === -1 ? 0 : found;
    inAt = start + value.toString().length;
    const at = parts.join(' ').length + (parts.length === 0 ? 0 : 1);
    parts.push(result.toString());

    steps.push({
      index: i,
      title: encrypting
        ? `C = ${value}^${keys.e} mod ${keys.n} = ${result}`
        : `M = ${value}^${keys.d} mod ${keys.n} = ${result}`,
      detail: encrypting
        ? `Encrypt with the public key (n, e) = (${keys.n}, ${keys.e}): raise M = ${value} to the power e and keep the remainder after dividing by n. Anyone can do this. Only the private key d = ${keys.d} undoes it.`
        : `Decrypt with the private key (n, d) = (${keys.n}, ${keys.d}): raise C = ${value} to the power d and keep the remainder after dividing by n. This works because e × d = ${keys.e} × ${keys.d} = ${keys.e * keys.d}, which is 1 more than a multiple of φ(n) = ${keys.phi}.`,
      input: value.toString(),
      output: result.toString(),
      highlight: { start, end: inAt },
      outputHighlight: { start: at, end: at + result.toString().length },
      data: {
        isNumber: true,
        isByte: true,
        direction,
        value: value.toString(),
        result: result.toString(),
        cipher: (encrypting ? result : value).toString(),
        e: keys.e.toString(),
        d: keys.d.toString(),
        n: keys.n.toString(),
      },
    });
  });

  return { output: parts.join(' '), steps };
}

/** The cipher again, one `Step` per number or per byte. */
export function rsaTrace(text: string, keys: KeyPair, direction: Direction, kind: MessageKind = 'text'): TraceResult {
  if (kind === 'numbers') return numbersTrace(text, keys, direction);
  const steps: Step[] = [];

  if (direction === 'encrypt') {
    const bytes = new TextEncoder().encode(text);
    const parts: string[] = [];
    // Byte i of the encoding does not always correspond to character i, so the
    // input highlight is computed from the encoder rather than assumed.
    const encoder = new TextEncoder();
    let charAt = 0;
    let byteAt = 0;
    const charFor: number[] = [];
    while (charAt < text.length) {
      const width = encoder.encode(text.charAt(charAt)).length;
      for (let k = 0; k < width; k += 1) charFor[byteAt + k] = charAt;
      byteAt += width;
      charAt += 1;
    }

    bytes.forEach((byte, i) => {
      const cipher = modPow(BigInt(byte), keys.e, keys.n);
      const at = parts.join(' ').length + (parts.length === 0 ? 0 : 1);
      parts.push(cipher.toString());
      const source = charFor[i] ?? 0;

      steps.push({
        index: i,
        title: `${byte}^${keys.e} mod ${keys.n} = ${cipher}`,
        detail: `Byte ${byte}${byte >= 32 && byte < 127 ? ` (the character '${String.fromCharCode(byte)}')` : ''} is raised to the public exponent ${keys.e} and reduced modulo n = ${keys.n}, giving ${cipher}. Nothing secret was used: e and n are the public key, and anyone can do this. Only d can undo it.`,
        input: String(byte),
        output: cipher.toString(),
        highlight: { start: source, end: source + 1 },
        outputHighlight: { start: at, end: at + cipher.toString().length },
        data: { isByte: true, byte, cipher: cipher.toString(), e: keys.e.toString(), n: keys.n.toString() },
      });
    });

    return { output: parts.join(' '), steps };
  }

  const numbers = parseNumbers(text);
  const bytes = new Uint8Array(numbers.length);
  numbers.forEach((value, i) => {
    const plain = modPow(value, keys.d, keys.n);
    bytes[i] = Number(plain & 0xffn);
    steps.push({
      index: i,
      title: `${value}^d mod ${keys.n} = ${plain}`,
      detail: `Raising ${value} to the private exponent d = ${keys.d} and reducing modulo n gives ${plain}. This works because e and d are inverses modulo φ(n) = ${keys.phi}, so raising to e and then to d returns the original — Euler's theorem. Computing d needs φ(n), and computing φ(n) needs the factors of n.`,
      input: value.toString(),
      output: String(plain),
      outputHighlight: { start: i, end: i + 1 },
      data: { isByte: true, cipher: value.toString(), byte: Number(plain), d: keys.d.toString() },
    });
  });

  return { output: new TextDecoder().decode(bytes), steps };
}
