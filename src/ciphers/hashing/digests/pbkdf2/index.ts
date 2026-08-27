/**
 * PBKDF2-HMAC-SHA-256.
 *
 * **Do not use this implementation for anything real**, and use a real PBKDF2
 * only if Argon2id, scrypt and bcrypt are all unavailable to you.
 *
 * It is the first module in the app whose point is that it is *slow*, which makes
 * it the first one where the Benchmark tab measures the thing the algorithm is
 * for. That is gap 2 in the project notes, and it was fixed before this folder
 * existed rather than during it: `benchmark()` runs the untraced path, so the
 * milliseconds are the key derivation rather than the step objects around it.
 *
 * The iteration cap here is far below what production uses, because every
 * iteration runs on the main thread while someone is typing. The explainer says
 * so and gives the real numbers.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { pbkdf2, pbkdf2Trace, type Options } from './pbkdf2';
import Cost from './Cost';

export const MAX_ITERATIONS = 20_000;

function readOptions(p: Params): Options {
  const salt = String(p['salt'] ?? '');
  const iterations = Number(p['iterations'] ?? 1000);
  const keyBytes = Number(p['keyBytes'] ?? 32);

  if (salt === '') {
    throw new Error(
      'A salt is required. An unsalted password hash lets one precomputed table cover every user at once.',
    );
  }
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    throw new Error(`The iteration count must be a whole number between 1 and ${MAX_ITERATIONS}.`);
  }
  if (!Number.isInteger(keyBytes) || keyBytes < 1 || keyBytes > 64) {
    throw new Error('The key length must be a whole number of bytes between 1 and 64.');
  }
  return { salt, iterations, keyBytes };
}

const explainer = `
Every other hash in this app is built to be fast. This one is built to be slow, and
everything about it follows from that one inversion.

A password is not a key. "hunter2" has maybe twenty bits of real entropy where an
AES key has 128, so an attacker who steals a database of password hashes does not
need to break the hash — they guess. A graphics card computes billions of SHA-256
digests a second, and a list of the ten million most common passwords is a
download. Against plain \`sha256(password)\`, a stolen database is read in minutes.

PBKDF2's answer is to make one guess expensive:

    DK = T1 || T2 || ...
    Ti = U1 XOR U2 XOR ... XOR Uc
    U1 = HMAC(password, salt || i)
    Un = HMAC(password, Un-1)

Run HMAC-SHA-256 on the password, then on its own output, *c* times, XORing every
result into a running total. The XOR matters: there is no way to jump to iteration
600,000 without computing the 599,999 before it, so an attacker pays the same cost
per guess that you pay per login.

## The salt

The salt goes into the very first HMAC. Two people who choose the same password
get different derived keys, and that is what kills the precomputed table — a
rainbow table has to be built per salt, which means built per user, which means
not built.

A salt is **not a secret**. Store it in plain text next to the hash. It has one
job, and that job is to be different every time. The Visualize tab shows the same
password under two salts.

## What to store

The salt, the iteration count, and the derived key. Not the password. To check a
login later you run the same computation on what was typed and compare — and
compare in constant time, or the comparison itself leaks.

The iteration count is stored *with* the hash so it can be raised later without
locking anyone out: an old hash is verified with the old count and re-derived with
the new one at the next successful login.

## Real numbers, and this page's numbers

OWASP's 2023 guidance for PBKDF2-HMAC-SHA-256 is **600,000 iterations**. The rule
behind the number is simple: pick the largest count your server can afford, then
re-check it every couple of years, because hardware only goes one way.

This page caps at ${MAX_ITERATIONS.toLocaleString('en-GB')}, and even that is
noticeable — the whole thing runs in the browser tab you are reading, on a
SHA-256 written for legibility rather than speed. The Benchmark tab is worth a
visit here more than anywhere else in the app: move the iteration slider and watch
the milliseconds move with it. That is not an implementation artefact. That is the
algorithm doing its job.

## How this breaks

PBKDF2 is not broken, and it is also not the right answer any more.

- **It is cheap to build hardware for.** PBKDF2 needs almost no memory, so a GPU
  runs tens of thousands of guesses in parallel and an ASIC does better. The
  defender pays for one derivation on a general-purpose CPU; the attacker pays for
  one on hardware built for exactly this. That asymmetry is why **Argon2id,
  scrypt and bcrypt** exist: they demand *memory* as well as time, and memory is
  expensive to parallelise.
- **A weak password is still a weak password.** Iterations multiply the cost of
  each guess; they do not reduce the number of guesses needed. Against a password
  in the top thousand, 600,000 iterations buys seconds.
- **Too few iterations is the usual failure.** A count chosen in 2010 and never
  raised is the common case, and it is worse than it looks, because the hardware
  it was calibrated against is two decades old.
- **It is not encryption.** There is no way back from the derived key to the
  password, which is the point — but it also means PBKDF2 cannot store anything
  you need to read again.
- **Comparison leaks.** Comparing the derived key with \`===\` returns early on the
  first differing byte. Use a constant-time comparison.

Use it when a platform gives you nothing better, or when a standard requires it
(WPA2 uses PBKDF2, which is why a long Wi-Fi passphrase matters). Otherwise reach
for Argon2id.
`;

const pbkdf2Cipher: CipherModule = {
  slug: 'pbkdf2',
  name: 'PBKDF2',
  family: 'hashing',
  year: '2000',
  origin: 'RSA Laboratories, PKCS #5; RFC 8018',
  keyType: 'A password, a public salt, and an iteration count. The count is the cost.',
  security: 'deprecated',
  difficulty: 'advanced',
  keywords: [
    'password',
    'key derivation',
    'kdf',
    'salt',
    'iterations',
    'hmac',
    'bcrypt',
    'argon2',
    'scrypt',
    'rainbow table',
    'slow',
  ],
  blurb:
    'A hash built to be slow. The only one here where cost is the feature, and the Benchmark tab measures the point.',
  explainer,
  oneWay: true,
  tiers: ['encrypt', 'visualize', 'benchmark'],
  visualizeNote:
    'Not a picture of one run. What a salt buys, and what the iteration count costs — timed on this machine, in this tab.',
  params: [
    {
      kind: 'text',
      name: 'salt',
      label: 'Salt (public, and different for every user)',
      default: 'a-different-salt-per-user',
      placeholder: 'Not a secret. Just never the same twice.',
      randomise: { alphabet: 'hex', length: 32 },
    },
    { kind: 'number', name: 'iterations', label: 'Iterations', min: 1, max: MAX_ITERATIONS, default: 1000 },
    { kind: 'number', name: 'keyBytes', label: 'Derived key length (bytes)', min: 1, max: 64, default: 32 },
  ],
  examples: [
    {
      label: 'A password, salted',
      input: 'correct horse battery staple',
      params: { salt: 'user-4417', iterations: 1000 },
    },
    {
      label: 'The same password, a different salt',
      input: 'correct horse battery staple',
      params: { salt: 'user-9082', iterations: 1000 },
    },
    {
      label: 'One iteration — what nobody should ship',
      input: 'hunter2',
      params: { salt: 'user-4417', iterations: 1 },
    },
    {
      label: 'Slow enough to feel',
      input: 'correct horse battery staple',
      params: { salt: 'user-4417', iterations: MAX_ITERATIONS },
    },
    {
      label: 'No salt at all — fails on purpose',
      input: 'hunter2',
      params: { salt: '' },
      demonstratesError: true,
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return pbkdf2Trace(input, readOptions(p));
  },

  benchmark(input: string, p: Params): string {
    return pbkdf2(input, readOptions(p));
  },

  visualize: Cost,
};

export default pbkdf2Cipher;
