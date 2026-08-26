/**
 * AES's entry in the registry.
 *
 * **No Attack tab, and for the first time on this site that is because the cipher
 * works.** Every previous omission was about the tool: the search is too big, no
 * search exists, the contract cannot hold a crib, the break needs several
 * messages. Here there is simply no known practical attack on full AES, and a
 * button pretending otherwise would be the single most misleading thing this app
 * could contain.
 *
 * The "How this breaks" section is still required and still earns its place, which
 * is the point worth taking away: **everything that has ever broken AES in the
 * field is a property of how it was used**, not of the algorithm. ECB mode, a
 * predictable IV, a repeated GCM nonce, a padding oracle, a key in a repository.
 * That is what the section is about.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { type Mode, aesTrace, readIv, readKey } from './aes';
import AesRounds from './AesRounds';

/** Params arrive as `string | number` because they come from form controls. */
function readOptions(p: Params) {
  return {
    key: readKey(String(p['key'] ?? '')),
    mode: (String(p['mode'] ?? 'CBC') === 'ECB' ? 'ECB' : 'CBC') as Mode,
    iv: readIv(String(p['iv'] ?? '')),
  };
}

const explainer = `
The Advanced Encryption Standard. Designed by Joan Daemen and Vincent Rijmen as
*Rijndael*, chosen by NIST in 2001 after a five-year public competition, and now
running inside essentially every encrypted connection, disk and message you touch.
It is the first thing on this site with **no known practical attack**.

## What one round does

The state is sixteen bytes in a 4×4 grid, filled **down the columns**. Each round
does four things, and the Visualize tab shows all four:

**SubBytes** — every byte replaced through one fixed 256-entry table. This is the
only **non-linear** step in the entire cipher, and it is the reason AES is not a
system of equations. The Hill cipher on this site is pure linear algebra and falls
to four known letters precisely because it has no step like this.

**ShiftRows** — row 0 stays put, row 1 rotates one place left, row 2 two, row 3
three. It moves bytes *between* columns so that MixColumns has something new to mix.

**MixColumns** — each column multiplied by a fixed matrix over GF(2⁸), so every
output byte of a column depends on all four inputs. That is **the Hill cipher's
idea**, moved into a field where every non-zero element has an inverse and there is
no awkward 13 to trip over. Choosing the algebra to fit the cipher, rather than
inheriting 26 letters from the alphabet, is exactly what Trifid's 27 symbols were
reaching for.

**AddRoundKey** — XOR sixteen bytes of key schedule.

Ten rounds for a 128-bit key, twelve for 192, fourteen for 256. **The final round
has no MixColumns**, which is not an oversight: it is what makes decryption the
same shape as encryption rather than a special case.

Confusion and diffusion, alternating, and neither useful alone — which is the same
structure ADFGVX has, thirty years before Shannon named the two properties.

## About this implementation

Everything else modern on this site should use the browser's own crypto, and this
page does not, for one reason: **crypto.subtle.encrypt** returns a ciphertext and
nothing else. It cannot show you a round. So AES is written out in full here — and
the test suite **checks it against WebCrypto block for block**, so what you see is
provably the same function your browser computes.

**Do not use this code for anything real.** It is written for clarity, which means
its table lookups are not constant-time, which means a real attacker measuring
cache timing could recover the key. That is not hypothetical; it is why production
AES uses hardware instructions or bitsliced code.

## How this breaks

**Not by cryptanalysis.** After twenty-five years of concentrated public attack the
best known result against full AES-128 is about four times faster than trying every
key, which leaves it far beyond reach. Nothing in this section is about the
algorithm. **Everything that has broken AES in the real world is about how it was
used**, and that is the lesson this page exists for.

**ECB mode leaks the shape of your data.** Encrypting each block independently
means identical plaintext blocks give identical ciphertext blocks. Encrypt a
picture in ECB and you can still see the picture — the famous penguin. Switch this
page to ECB, type sixteen of the same character twice, and watch two ciphertext
blocks come out identical. AES did nothing wrong; the mode did.

**A predictable IV breaks CBC.** The IV must be unpredictable, not merely
different. Using a counter or a timestamp allows a chosen-plaintext attack that
confirms guesses about the plaintext — this is the **BEAST** attack on TLS 1.0, and
it was a real, exploited vulnerability.

**A repeated nonce destroys GCM completely.** AES-GCM is the mode you should
actually use, and it fails catastrophically if a nonce is ever reused with the same
key: two messages under one nonce leak their XOR, exactly as with a reused
One-Time Pad, *and* the authentication key can be recovered so an attacker can
forge messages. This is the same failure that killed ADFGVX and the Soviet pads.
**Key and nonce reuse is the most reliable way to destroy a sound cipher**, and it
is still the most common real-world failure.

**Telling an attacker that padding was wrong is a decryption oracle.** If a system
distinguishes "bad padding" from "bad message", an attacker can decrypt arbitrary
ciphertext one byte at a time without ever learning the key — a **padding oracle**
attack. This page does report bad padding, because it is a teaching tool and you
need to know why decryption failed; a real system must never do that, which is why
its error message says so.

**Encryption is not authentication.** CBC and ECB provide confidentiality and
nothing else. An attacker who cannot read your message can still change it in
controlled ways — flipping a bit in a CBC ciphertext block flips the same bit in the
next plaintext block. If integrity matters, and it almost always does, you need an
**authenticated** mode: AES-GCM, or ChaCha20-Poly1305.

**And the key has to come from somewhere.** A key typed into a box, committed to a
repository, derived from a password without a slow KDF, or shipped inside an app is
the vulnerability — not AES. The strongest cipher in the world sits underneath a
key management problem, and that is where systems actually fail.
`.trim();

const aesCipher: CipherModule = {
  slug: 'aes',
  name: 'AES',
  family: 'symmetric',
  year: '2001',
  blurb: 'The modern standard. Ten rounds of confusion and diffusion, shown one at a time.',
  explainer,
  // No 'attack'. There is no known practical attack on full AES, and a button
  // suggesting otherwise would be the most misleading thing in this app.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key (32, 48 or 64 hex digits — 128, 192 or 256 bits)',
      default: '000102030405060708090a0b0c0d0e0f',
      placeholder: '32 hex digits for AES-128',
    },
    {
      kind: 'select',
      name: 'mode',
      label: 'Mode',
      options: [
        { value: 'CBC', label: 'CBC — each block chained to the last' },
        { value: 'ECB', label: 'ECB — each block alone (see the penguin)' },
      ],
      default: 'CBC',
    },
    {
      kind: 'text',
      name: 'iv',
      label: 'IV (32 hex digits; CBC only)',
      default: '0f0e0d0c0b0a09080706050403020100',
      placeholder: '32 hex digits',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return aesTrace(input, readOptions(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return aesTrace(input, readOptions(p), 'decrypt');
  },

  visualize: AesRounds,
};

export default aesCipher;
