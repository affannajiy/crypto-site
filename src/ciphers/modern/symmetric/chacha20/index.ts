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
AES is a **block cipher**: it transforms your data, sixteen bytes at a time.
ChaCha20 is a **stream cipher** and it never touches your data at all.

It generates a pseudorandom **keystream** from the key, a nonce and a counter, and
the ciphertext is simply the plaintext XORed with it:

    ciphertext = plaintext XOR keystream(key, nonce, counter)

That is the **One-Time Pad's construction**, with a keystream that is computed
rather than shared. The entire gap between "provably unbreakable" and "unbreakable
as far as anyone can tell" is that a pad's key is genuinely random and a stream
cipher's key only *looks* random. The One-Time Pad page on this site is the same
XOR with a different source of keystream.

Two consequences fall straight out. **Encryption and decryption are the same
operation**, because XOR undoes itself. And there is **no padding**, so the
ciphertext is exactly as long as the plaintext — which is convenient, and which
also means the length leaks.

## Inside it

Sixteen 32-bit words in a 4×4 grid: four fixed constants that spell
*expand 32-byte k*, eight words of key, one counter word, three words of nonce.
Twenty rounds of one operation, the **quarter-round**, applied first down the four
columns and then along the four diagonals. Then the original state is added back in.

The quarter-round is **add, XOR, rotate**. That is the whole vocabulary — no
S-box, no lookup table, no branch that depends on the data. Which is the point:

**ChaCha20 is constant-time by construction.** A table-based AES is not. Its S-box
lookups touch different cache lines depending on the data, and an attacker who can
measure cache timing can recover the key — a published, practical attack, which is
why the AES page on this site warns you not to use its own code. AES on modern
desktop chips is safe because the *hardware* implements it. ChaCha20 needs no such
help, which is why it is preferred on phones, embedded devices and anything without
AES instructions, and why TLS 1.3 offers both.

**The final addition is not decoration.** Twenty rounds of add-XOR-rotate are
reversible. Without adding the starting state back in, anyone could run the rounds
backwards from the keystream and read the key out of the state.

## How this breaks

**Not by cryptanalysis.** The best public attack reaches seven of the twenty
rounds. There is no practical break, and there is no Attack tab for the same reason
there is none on the AES page.

**By reusing a nonce, and this is not a small mistake.** It is total. Two messages
encrypted under the same key and nonce share a keystream, so XORing the two
ciphertexts cancels it exactly and leaves the XOR of the two plaintexts — with the
key never involved. The Visualize tab does this live: type two messages and watch
the two lines come out identical.

This is the **same failure** that broke reused One-Time Pads, that let the Venona
project read Soviet traffic for decades, that broke ADFGVX, and that breaks
AES-GCM today. A nonce is not a password. It does not need to be secret, it does
not need to be unpredictable, and it absolutely must be **used once**. Random
96-bit nonces are safe for a very long time; a counter is safe if it is genuinely
never repeated, which is harder than it sounds across restarts, backups and
virtual-machine snapshots.

**A stream cipher has no integrity whatsoever, and it is worse than a block
cipher here.** Flip a bit in the ciphertext and *exactly that bit* flips in the
plaintext — nothing else changes, and nothing detects it. An attacker who knows
where the amount field is in your message can change 100 to 900 without ever
decrypting anything. This is not a subtle risk; it is arithmetic.

The answer is **ChaCha20-Poly1305**, which adds a message authentication code, and
that is what actually ships in TLS. **It is not implemented here.** This page is
the stream cipher alone, so that the XOR and the nonce are visible; authentication
is a different subject and deserves its own page rather than being smuggled in
under this one. Do not read a bare stream cipher as a usable construction.

**And the counter runs out.** ChaCha20's block counter is 32 bits, so one
key-and-nonce pair covers 2³² × 64 bytes — about 256 GB. Past that the counter
wraps and the keystream repeats, which is nonce reuse arriving on its own.
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
