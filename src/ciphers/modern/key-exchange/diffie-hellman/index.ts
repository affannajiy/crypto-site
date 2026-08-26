/**
 * Diffie-Hellman's entry in the registry.
 *
 * **This is not a cipher, and the page says so in its first line.** The contract
 * is `encrypt(input, params) -> TraceResult`, and a key exchange has no input to
 * encrypt. Three options were available:
 *
 *   1. Bend the contract with a new tier for exchanges.
 *   2. Leave the Encrypt tab empty and put everything in Visualize.
 *   3. Derive the shared secret and then use it, which is what an exchange is for.
 *
 * This takes the third, and labels the bolted-on encryption clearly as a stand-in:
 * a small xorshift keystream, which is neither a key derivation function nor a
 * secure cipher. A real system runs the shared secret through HKDF and hands the
 * result to AES-GCM. Both the file and the explainer say so, because a reader who
 * mistook this for the real construction would have learned something false.
 *
 * The alternative worth considering later is option 1: `CipherModule` has no way
 * to describe a primitive that produces a *key* rather than a *ciphertext*, and
 * hashing — the next phase — will hit the same wall from another direction, since
 * a hash has no decrypt at all. Recorded in CLAUDE.md.
 *
 * **No Attack tab.** Breaking it is the discrete logarithm, which needs the public
 * values rather than a ciphertext — the same reason RSA has none — so the attack
 * lives on the Visualize tab, alongside the man-in-the-middle attack that is the
 * one that actually matters.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { MAX_PRIME, dhTrace, exchange } from './dh';
import DhChannel from './DhChannel';

/** Params arrive as `string | number` because they come from form controls. */
function readExchange(p: Params) {
  return exchange(
    Number(p['p'] ?? 104729),
    Number(p['g'] ?? 3),
    Number(p['a'] ?? 12345),
    Number(p['b'] ?? 54321),
  );
}

const explainer = `
**This is not a cipher.** It is on this site because it solved the problem every
cipher on this site had and none of them could touch.

Caesar, Vigenère, Enigma, AES, ChaCha20 — every one of them assumes the two parties
already share a key. For three thousand years that was simply the shape of the
problem: you met in person, or you trusted a courier, or you accepted the risk.
Militaries moved codebooks by armed convoy. The whole discipline rested on a
logistics operation.

In 1976 Whitfield Diffie and Martin Hellman published a way for two people who have
never met, on a channel that is being recorded in full, to agree on a number that
only they know.

## How

    Public:  a large prime p, and a generator g

    Alice picks a secret a, and sends  A = gᵃ mod p
    Bob   picks a secret b, and sends  B = gᵇ mod p

    Alice computes  Bᵃ = g^(ba) mod p
    Bob   computes  Aᵇ = g^(ab) mod p

Both land on the same number, because *ab* and *ba* are the same thing.

**Nothing secret is ever transmitted.** Eve has p, g, A and B — everything that
crossed the wire — and to get the shared number she would have to recover *a* from
*gᵃ mod p*. That is the **discrete logarithm problem**, and nobody knows a fast way
to do it. The Visualize tab lays out exactly what each party holds, and then lets
Eve try.

The usual analogy is mixing paint: Alice and Bob each start from a common colour,
add a private colour, and swap the mixtures. Each adds their private colour again
and both end with the same final mix, while an observer holding both mixtures
cannot separate out the ingredients.

## Why this page has an Encrypt tab

Because a key exchange with nothing on the other end is half a story, this page
derives the shared secret and then uses it to encipher the message.

**The cipher used for that is deliberately trivial** — a keystream from a small
xorshift generator, XORed with the bytes — and it is a stand-in, not part of
Diffie-Hellman. A real system runs the shared secret through a key derivation
function (**HKDF**) and hands the result to AES-GCM or ChaCha20-Poly1305. Please do
not read the Encrypt tab here as a construction to copy; the exchange is the
subject, and the Visualize tab is where it lives.

## How this breaks

**The discrete logarithm, in principle.** Try every exponent. The Visualize tab
does exactly that and finishes in milliseconds on this page's small prime. Real
Diffie-Hellman uses 2048 bits or more, where the same loop would run about 10⁶¹⁶
times — and the best known algorithm is far faster than that and still nowhere
near enough. As with RSA, that is a statement about what algorithms are known, not
a proof, and **Shor's algorithm** solves it in polynomial time on a quantum
computer.

**Small or reused parameters, in practice.** The **Logjam** attack (2015) exploited
the fact that many servers used the same handful of 1024-bit primes: precompute
once against a common prime, and every connection using it falls cheaply.
Standardised groups are fine — the primes are public by design — but *small* ones
are not, and export-grade 512-bit groups were still being accepted by real servers
in 2015.

**Man in the middle, which is the attack that actually works.** Nothing in the
exchange says *who* the other party is. If Eve can replace messages rather than
merely read them, she runs one exchange with Alice and a different one with Bob,
and sits between them decrypting and re-encrypting. Neither notices.

Plain Diffie-Hellman gives you a secret shared with **somebody**. Which somebody is
a completely separate problem, solved by **authentication** — signatures,
certificates, a trusted third party. That is what the certificate in your browser's
address bar is doing, and it is why an unauthenticated key exchange is not a secure
channel. **Confidentiality without authentication is not security**, and this is
the fourth time that sentence has been the answer on this site.

**A bad random number generator ruins it instantly.** Alice's secret must be
unpredictable. If it is drawn from a weak generator, or a seeded one, or one whose
entropy source failed on a freshly booted embedded device, Eve reproduces it
directly and the mathematics never gets a chance. Real failures of this kind are
common, and they are failures of engineering rather than of cryptography.

## What it made possible

Every HTTPS connection you make performs a key exchange, then uses the agreed key
with a symmetric cipher. Modern TLS uses the **elliptic-curve** variant, ECDHE,
which is the same idea over a different group and much faster for the same
security. The **E** on the end is *ephemeral*: a fresh secret for every connection,
so that recording traffic today and stealing the server's long-term key tomorrow
does not decrypt it. That property is called **forward secrecy**, and it exists
because the exchange can be run again cheaply.

Diffie-Hellman solved key distribution and then handed the actual work back to the
symmetric ciphers that were always good at it. That division — public key to agree,
symmetric key to work — is the architecture of essentially all secure
communication today.
`.trim();

const dhCipher: CipherModule = {
  slug: 'diffie-hellman',
  name: 'Diffie-Hellman',
  family: 'asymmetric',
  year: '1976',
  blurb: 'Not a cipher: two strangers agreeing on a secret in public, with Eve recording it all.',
  explainer,
  // No 'attack'. The break needs the public values rather than a ciphertext, and
  // the real attack is a man in the middle. Both live on the Visualize tab.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    { kind: 'number', name: 'p', label: 'p (a public prime)', min: 5, max: MAX_PRIME, default: 104729 },
    { kind: 'number', name: 'g', label: 'g (a public generator)', min: 2, max: 1000, default: 3 },
    { kind: 'number', name: 'a', label: "Alice's secret", min: 1, max: MAX_PRIME, default: 12345 },
    { kind: 'number', name: 'b', label: "Bob's secret", min: 1, max: MAX_PRIME, default: 54321 },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return dhTrace(input, readExchange(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return dhTrace(input, readExchange(p), 'decrypt');
  },

  visualize: DhChannel,
};

export default dhCipher;
