/**
 * Diffie-Hellman key exchange, 1976.
 *
 * **This is not a cipher, and this page is honest about that.**
 *
 * Every other entry on this site takes a message and a key and produces a
 * ciphertext. Diffie-Hellman produces no ciphertext at all. What it does is
 * stranger and, in 1976, unthinkable: it lets two people who have never met, over
 * a channel that is being recorded in full, **agree on a number that only they
 * know**.
 *
 *     public:   a large prime p, and a generator g
 *
 *     Alice picks a secret `a`,  sends  A = g^a mod p
 *     Bob   picks a secret `b`,  sends  B = g^b mod p
 *
 *     Alice computes  B^a = g^(ba) mod p
 *     Bob   computes  A^b = g^(ab) mod p
 *
 * Both land on the same number, because multiplication commutes. Eve, who saw p,
 * g, A and B and nothing else, would need to recover `a` from `g^a mod p` — the
 * **discrete logarithm problem**, which nobody knows how to do quickly.
 *
 * ## Why there is an encryption on this page at all
 *
 * The app's contract is `encrypt(input, params) -> TraceResult`, and a key
 * exchange has no input to encrypt. Rather than bend the contract or leave the
 * Encrypt tab empty, this page does the honest thing an exchange is *for*: it
 * derives the shared secret and then uses it to encipher the message, so that the
 * agreed key has a visible purpose.
 *
 * **The cipher bolted on here is deliberately trivial** — a keystream from a small
 * xorshift generator, XORed with the bytes. It is not a key derivation function
 * and it is not a secure cipher. A real system runs the shared secret through
 * **HKDF** and hands the result to AES-GCM or ChaCha20-Poly1305. That is stated on
 * the page as well as here, because a reader who mistook this for the real thing
 * would have learned something false.
 *
 * The Visualize tab carries the actual content: the exchange itself, what Eve
 * sees, and Eve solving the discrete logarithm by brute force.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { fromHex, toHex } from '../../../../lib/format';

export type Direction = 'encrypt' | 'decrypt';

/** Large enough that Eve's search is visible, small enough that it finishes. */
export const MAX_PRIME = 999983;

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let f = 3; f * f <= n; f += 2) {
    if (n % f === 0) return false;
  }
  return true;
}

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

export interface Exchange {
  p: number;
  g: number;
  a: number;
  b: number;
  /** g^a mod p — sent in the clear. */
  publicA: number;
  /** g^b mod p — sent in the clear. */
  publicB: number;
  /** The number both sides arrive at and Eve does not. */
  shared: number;
}

/**
 * Runs the exchange, refusing anything that would not work.
 *
 * As with RSA, the refusals are part of the teaching: each one is a real condition
 * and a page that quietly produced a broken exchange would suggest they are
 * optional.
 */
export function exchange(p: number, g: number, a: number, b: number): Exchange {
  if (!isPrime(p)) throw new Error(`p must be prime, and ${p} is not.`);
  if (p < 5) throw new Error('p must be at least 5 for the exchange to have any room in it.');
  if (g < 2 || g >= p) throw new Error(`g must be between 2 and p − 1, which here is ${p - 1}.`);
  if (a < 1 || a >= p - 1) throw new Error(`Alice's secret must be between 1 and p − 2, which here is ${p - 2}.`);
  if (b < 1 || b >= p - 1) throw new Error(`Bob's secret must be between 1 and p − 2, which here is ${p - 2}.`);

  const P = BigInt(p);
  const publicA = Number(modPow(BigInt(g), BigInt(a), P));
  const publicB = Number(modPow(BigInt(g), BigInt(b), P));
  const shared = Number(modPow(BigInt(publicB), BigInt(a), P));
  const alsoShared = Number(modPow(BigInt(publicA), BigInt(b), P));

  if (shared !== alsoShared) {
    throw new Error('The two sides did not agree, which cannot happen and means this code is wrong.');
  }

  return { p, g, a, b, publicA, publicB, shared };
}

/**
 * A keystream from the shared secret.
 *
 * A small xorshift generator, and **deliberately not a key derivation function**.
 * The job here is to make the agreed number visibly do something; a real system
 * uses HKDF and then a real cipher, and the explainer says so plainly.
 */
export function keystream(shared: number, length: number): Uint8Array {
  let state = (shared ^ 0x9e3779b9) >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out[i] = state & 0xff;
  }
  return out;
}

/** The whole thing, untraced. Used by the benchmark. */
export function dh(text: string, meeting: Exchange, direction: Direction): string {
  if (direction === 'encrypt') {
    const bytes = new TextEncoder().encode(text);
    const stream = keystream(meeting.shared, bytes.length);
    return toHex(bytes.map((byte, i) => byte ^ (stream[i] ?? 0)));
  }

  const bytes = fromHex(text.replace(/\s+/g, ''));
  if (bytes === null) {
    throw new Error('The ciphertext is hexadecimal — two digits per byte.');
  }
  const stream = keystream(meeting.shared, bytes.length);
  return new TextDecoder().decode(bytes.map((byte, i) => byte ^ (stream[i] ?? 0)));
}

/**
 * Eve's attack: recover Alice's secret from what was sent in the open.
 *
 * The discrete logarithm, solved the only way this page can solve it — by trying
 * every exponent. That is the entire security of Diffie-Hellman: not that the
 * problem is unsolvable, but that this loop is too long to run.
 */
export function discreteLog(g: number, target: number, p: number): { exponent: number; tried: number } | null {
  const P = BigInt(p);
  const G = BigInt(g);
  let value = 1n;
  for (let exponent = 1; exponent < p; exponent += 1) {
    value = (value * G) % P;
    if (Number(value) === target) return { exponent, tried: exponent };
  }
  return null;
}

/** The exchange as steps, then one step per block of the message. */
export function dhTrace(text: string, meeting: Exchange, direction: Direction): TraceResult {
  const steps: Step[] = [
    {
      index: 0,
      title: `Public: p = ${meeting.p}, g = ${meeting.g}`,
      detail: `Both of these are published. They are not secret and never were — anyone recording the channel has them, and every browser using this in practice takes them from a fixed, standardised list.`,
      data: { stage: 'public', p: meeting.p, g: meeting.g },
    },
    {
      index: 1,
      title: `Alice sends A = ${meeting.g}^${meeting.a} mod ${meeting.p} = ${meeting.publicA}`,
      detail: `Alice's secret ${meeting.a} never leaves her machine. What travels is ${meeting.publicA}, and recovering ${meeting.a} from it means solving a discrete logarithm.`,
      output: String(meeting.publicA),
      data: { stage: 'alice', secret: meeting.a, sent: meeting.publicA },
    },
    {
      index: 2,
      title: `Bob sends B = ${meeting.g}^${meeting.b} mod ${meeting.p} = ${meeting.publicB}`,
      detail: `Bob's secret ${meeting.b} likewise stays put. Eve has now seen p, g, A and B — everything that was ever transmitted.`,
      output: String(meeting.publicB),
      data: { stage: 'bob', secret: meeting.b, sent: meeting.publicB },
    },
    {
      index: 3,
      title: `Both compute ${meeting.shared}`,
      detail: `Alice raises Bob's number to her secret: ${meeting.publicB}^${meeting.a} mod ${meeting.p} = ${meeting.shared}. Bob raises Alice's number to his: ${meeting.publicA}^${meeting.b} mod ${meeting.p} = ${meeting.shared}. Both are g^(ab) mod p, because exponents multiply and multiplication does not care about order. Eve saw every message and cannot compute it.`,
      output: String(meeting.shared),
      data: { stage: 'shared', shared: meeting.shared },
    },
  ];

  const output = dh(text, meeting, direction);

  steps.push({
    index: 4,
    title: `Use the agreed number as a key`,
    detail: `The exchange is finished, and everything above is what Diffie-Hellman actually does. What follows is not part of it: the shared number ${meeting.shared} seeds a small generator, and the message is XORed with its output, so that the agreed key visibly does something. That construction is NOT a key derivation function and NOT a secure cipher — a real system runs the shared secret through HKDF and hands the result to AES-GCM or ChaCha20-Poly1305.`,
    input: text,
    output,
    data: { stage: 'encrypt', shared: meeting.shared },
  });

  return { output, steps };
}
