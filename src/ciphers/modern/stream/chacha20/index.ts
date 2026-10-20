/**
 * ChaCha20's entry in the registry.
 *
 * **No Attack tab**, for AES's reason: there is no known practical attack. The
 * best public result reaches seven of the twenty rounds.
 *
 * **Poly1305 is not implemented here**, and the explainer says so rather than
 * leaving a reader to assume otherwise. What ships in TLS is
 * ChaCha20-Poly1305, an *authenticated* construction, and a bare stream cipher is
 * not a substitute for it. Implementing Poly1305 would roughly double this folder
 * and would teach a different lesson — message authentication — which belongs on
 * its own page rather than hidden inside this one.
 *
 * `decrypt` is `encrypt`, for the fifth time in this app and the first time in the
 * modern section: XOR is its own inverse. Atbash by mirroring, Beaufort by
 * subtraction, Porta by pairing, Enigma by reflection, and now by XOR.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { chacha20Trace, encryptText, readKey, readNonce } from './chacha20';
import ChachaState from './ChachaState';

/** Params arrive as `string | number` because they come from form controls. */
function readOptions(p: Params) {
  const counter = Number(p['counter']);
  return {
    key: readKey(String(p['key'] ?? '')),
    nonce: readNonce(String(p['nonce'] ?? '')),
    counter: Number.isFinite(counter) ? Math.max(0, Math.trunc(counter)) : 1,
  };
}

const explainer = `
A stream cipher: ciphertext = plaintext XOR keystream(key, nonce, counter). Bernstein published it in 2008 to improve Salsa20.

## How it works

- Build a 4×4 grid of 32-bit words: four constants on the top row, eight key words, one counter word and three nonce words.
- Run twenty rounds of quarter-rounds (add, XOR, rotate): columns, then diagonals.
- Add the starting state back. Without that step, the rounds could be run backwards to the key.
- Encryption and decryption are the same XOR. There is no padding, so the length leaks.
- There is no S-box, so it runs in constant time. That is why phones without AES hardware use it.

## Lecture note

- The lecture calls it "the modified version of Salsa20" and says TLS 1.3 supports it. Both are correct. TLS 1.3 uses ChaCha20-Poly1305.

## How this breaks

- **There is no practical break.** The best attack reaches 7 of the 20 rounds.
- **A reused nonce breaks it completely.** Two messages share one keystream. The Visualize tab shows this.
- **There is no integrity.** Flip a ciphertext bit and the same plaintext bit flips. ChaCha20-Poly1305 fixes this. Poly1305 is not implemented here.
- **The counter runs out.** The 32-bit counter covers about 256 GB for one key and nonce.
`.trim();

const chachaCipher: CipherModule = {
  slug: 'chacha20',
  name: 'ChaCha20',
  family: 'symmetric',
  year: '2008',
  origin: 'Daniel J. Bernstein',
  keyType: 'A 256-bit key and a 96-bit nonce, never reused',
  security: 'secure',
  difficulty: 'advanced',
  keywords: ['stream cipher', 'salsa20', 'nonce', 'keystream', 'arx', 'rfc 8439', 'modern'],
  blurb: 'A keystream, XORed. Fast without hardware help, and ruined by one repeated nonce.',
  explainer,
  // No 'attack'. The best public result reaches 7 of 20 rounds.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key (64 hex digits — always 256 bits)',
      default: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      placeholder: '64 hex digits',
      randomise: { alphabet: 'hex', length: 64 },
    },
    {
      kind: 'text',
      name: 'nonce',
      label: 'Nonce (24 hex digits — never reuse one with the same key)',
      default: '000000090000004a00000000',
      placeholder: '24 hex digits',
      randomise: { alphabet: 'hex', length: 24 },
    },
    { kind: 'number', name: 'counter', label: 'Block counter', min: 0, max: 65535, default: 1 },
  ],
  examples: [
    {
      label: 'The RFC 8439 sunscreen plaintext',
      input: 'Ladies and Gentlemen of the class of \'99: If I could offer you only one tip for the future, sunscreen would be it.',
      params: { key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', nonce: '000000000000004a00000000', counter: 1 },
    },
    {
      label: 'A sentence',
      input: 'Meet me at the old bridge at midnight.',
      params: { key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', nonce: '000000090000004a00000000', counter: 1 },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return chacha20Trace(input, readOptions(p), 'encrypt');
  },

  benchmark(input: string, p: Params): string {
    return encryptText(input, readOptions(p));
  },

  // Identical to `encrypt` in every respect but what it is handed. XOR is its own
  // inverse, so there is no second operation anywhere in this file.
  decrypt(input: string, p: Params): TraceResult {
    return chacha20Trace(input, readOptions(p), 'decrypt');
  },

  visualize: ChachaState,
};

export default chachaCipher;
