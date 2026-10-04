# CryptoLab

**[affannajiy.github.io/crypto-site](https://affannajiy.github.io/crypto-site/)**

> "Il faut qu'il n'exige pas le secret, et qu'il puisse sans inconvénient tomber entre les mains
> de l'ennemi." (It must not require secrecy, and it must be able to fall into the hands of the
> enemy without harm.) - Auguste Kerckhoffs, La Cryptographie Militaire, 1883

CryptoLab is an interactive cryptography learning lab. A student types a message, encrypts it,
and then reads every step that the algorithm took to get there. Where a cipher can be broken,
the page breaks it in the browser, whereby the search runs in front of the reader rather than
behind a button. Affan Najiy built it to go alongside the cryptography part of the course
(Lectures 03 to 05 and Labs 03 to 07), so the site shows exactly the sixteen ciphers that the
syllabus covers.

**This is a teaching tool, not a security product.** It runs entirely in the browser, it has not
been audited, and no code that a browser can read can keep a secret. Furthermore, every
hand-written algorithm in the repository uses table lookups that are not constant-time, which
is a real key-recovery weakness, and each file that has it says so.

## What is in it

The site shows sixteen ciphers, in the order the course teaches them. The classical ciphers
come in two halves. Substitution replaces each letter with another, which hides what the
letters are. This property is called confusion. Transposition keeps the letters and moves them,
which hides where they are. This property is called diffusion.

| Lecture | Group | Cipher | First example (from the slides or lab) |
| --- | --- | --- | --- |
| 03 | Substitution | Caesar | Shift 3: `meet me after the toga party` |
| | | Monoalphabetic | `DKVQFIBJWPESCXHTMYAUOLRGZN` → `WIRFRWAJUHYFTSDVFSFUUFYA` |
| | Polygraphic | Playfair | `MONARCHY`: `instruments` → `GATLMZCLRQTX` |
| | Polyalphabetic | Vigenère | `DECEPTIVE` → `ZICVTWQNGRZGVTWAVZHCQYGLMGJ` |
| | Transposition | Rail Fence | Depth 2 → `MEMATRHTGPRYETEFETEOAAT` |
| | | Row Transposition | `4312567` → `TTNAAPTMTSUOAODWCOIXKNLYPETZ` |
| 03 | Perfect secrecy | One-Time Pad | The Vernam pad from the stream-cipher notes, in letters (mod 26) or Vernam (XOR on bits) mode |
| | Stream ciphers | Salsa20, ChaCha20, RC4, A5/1 | Bernstein's spec, RFC 8439, `Key`/`Plaintext`, the GSM reference key |
| 04 | Block ciphers | Feistel | `10110110`, keys `0110 1100 1010` → `00010000` |
| | | DES | Key `133457799BBCDFF1` → `85E813540F0AB405`, plus Lab 04's weak keys |
| | | Triple DES | Lab 04's keys, K3 = K1 |
| | | AES | FIPS-197, with all five modes: ECB, CBC, CFB, OFB, CTR |
| 05 | Public key | RSA | p = 47, q = 59, e = 17: M = 31 → C = 587, d = 157 |

Every default key and first example is the one from the lecture or the lab sheet, so a student
can check the page against the notes. Each page has a **Lecture note** section where the slides
say something worth checking. Where a slide or lab sheet has a slip, the page shows the correct
answer and names the slip. For example, the lab's rail fence answer for `ILOVEIAS` should be
`IELVISOA`, and Lab 05 uses e = 65537 where φ(n) is only 160.

Each cipher page has up to four tabs, and it only has the ones that teach something:

| Tab | What it does |
| --- | --- |
| **Encrypt** | Runs the cipher and lists every intermediate step, with the active step highlighted in both panes. |
| **Visualize** | Draws the same run. To illustrate, Caesar gets the two-row substitution table, Vigenère the full Vigenère table, Playfair its 5x5 square, Feistel the lecture's ladder, AES its state matrix and mode chain, RC4 its 256-byte state, and RSA its key table, the Euclidean algorithm for d, and a digital signature. |
| **Attack** | A working break, where a working break fits in one function. Four of the classical ciphers have one. |
| **Benchmark** | Measures throughput. |

The other ciphers have no Attack tab, and each explainer says why. Monoalphabetic and Playfair
fall to a hill-climbing search program, not a button. RC4 and A5/1 fall to attacks that need
many ciphertexts or a two-terabyte table. AES, ChaCha20 and Salsa20 have no known practical
attack at all. Every explainer also carries a
**"How this breaks"** section, which the registry refuses to load without.

Four pages are not a single cipher:

- **Catalogue**, the home page, with search.
- **Compare**, which puts every shown cipher on one sortable table.
- **Playground**, which runs one message through all sixteen ciphers at once, one row each, in
  course order: Substitution, Transposition, the one-time pad, stream, block and public key. One
  switch decrypts every row, whereby a student can paste a ciphertext and see which row reads as
  English. "Decrypt this" on any row does that with the row's own output.
- **Analyse**, which measures an unknown ciphertext and reports observations rather than a
  verdict.

`Ctrl`/`Cmd`+`K` reaches any of them from anywhere.

## What is hidden

The repository holds thirty-nine entries across five families, from Morse Code to SHA-256 and
Diffie-Hellman. Only the sixteen course ciphers are shown. The rest are hidden, not deleted, which means
that they have no page, no search result and no Playground row, and their addresses give the
not-found page. However, the tests and the registry checks still run over every one of them,
so hidden code does not rot.

`COURSE_SLUGS` in `src/ciphers/registry.ts` is the list of shown ciphers. To show a hidden
cipher again, add its slug to that list.

## Running it

```bash
npm install
```

```bash
npm run dev
```

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck, then a production build |

The tests run in the **node** environment, not jsdom, because the rule below means that they do
not need a DOM.

## The one rule

> Cipher logic lives in plain TypeScript modules that import nothing from React.

Everything under `src/ciphers/` must run in a unit test or a Node script with no DOM. There are
two exceptions: the visualizer component of a cipher, and one compile-time `import type`.
Therefore, if a `useState` appears next to an algorithm, the design is wrong.

## Adding a cipher

Create one folder and change nothing else. There is no route to register and no UI to touch,
since `src/ciphers/registry.ts` finds every module with `import.meta.glob`.

```
src/ciphers/<family>/<group>/<slug>/
  index.ts          # default-exports a CipherModule, which the registry finds by glob
  <slug>.ts         # the pure algorithm, plus the step trace
  <slug>.test.ts    # ships in the same commit, no exceptions
  attack.ts         # only if the module declares the 'attack' tier
  <Name>Vis.tsx     # only if the module declares the 'visualize' tier
```

The catalogue reads its sub-heading from the middle segment of the path, so
`classical/substitution/caesar` appears under Substitution without declaring anything. A new
folder is validated and tested at once, but it only appears on the site once its slug is in
`COURSE_SLUGS`.

`src/ciphers/types.ts` is the whole contract, and the UI reads nothing else. As a result, **no
component may branch on the slug or the name of a cipher.**

In development, the registry validates every module at load and throws with *all* violations at
once. It checks for unique kebab-case slugs, a folder name equal to the slug, a known group, an
implementation behind every declared tier, unique parameter names, in-range defaults, at least
one worked example, and a **"How this breaks"** section in every explainer. That last check is
enforced in code rather than by convention, because a tool that only shows the happy path
teaches people to be dangerous.

## Is the crypto correct

Every algorithm in the repository is hand-written, including AES, DES and ChaCha20. This is
because `crypto.subtle.encrypt` returns a ciphertext and nothing else. It cannot show a round, a
state matrix or a key schedule, and the middle of the algorithm is the whole reason these pages
exist.

The safeguard is cross-checking rather than trust:

- The course ciphers reproduce the lecture and lab examples. For instance, the Row
  Transposition test reproduces `TTNAAPTMTSUOAODWCOIXKNLYPETZ`, the Feistel test reproduces
  every intermediate value of the worked example, and the RSA test gets d = 157 and C = 587.
- AES is checked against `crypto.subtle` AES-CBC, block for block. All five modes are checked
  against the NIST SP 800-38A vectors, and CTR against `crypto.subtle` AES-CTR too.
- Triple DES and RC4 are checked against values computed by OpenSSL. Salsa20 is checked
  against every example in Bernstein's specification, and A5/1 against the 1999 reference code
  of Briceno, Goldberg and Wagner.
- AES, DES and ChaCha20 are checked against their published vectors (FIPS-197, the classic DES
  vector, and RFC 8439 §2.1.1 and §2.3.2).
- PBKDF2 is checked against the PBKDF2 of `crypto.subtle`. The widely-copied RFC 6070 vectors
  are HMAC-**SHA-1**, and they would have been quietly wrong here.
- MD5 has no `crypto.subtle` equivalent, since the platform will not hand out a broken hash.
  Therefore, it leans on published vectors plus the 2004 collision, which a wrong
  implementation could not reproduce.
- The eighty round constants of SHA-512 are **derived** from integer roots of the first eighty
  primes rather than pasted, and the test pins them against FIPS 180-4.

In total, there are 1,182 tests across 45 files, and `npm test` gates the deploy.

## Design

The design puts function over beauty, whereby the screen explains the algorithm rather than
decorating it.

Colours are semantic tokens in `src/index.css` and are never hardcoded in a component, so a
dark theme stays a change to one file. **Orange means "look here" and nothing else.** It is never
a button, a link, or decoration. It comes in five steps chosen by contrast ratio, not taste, and
a highlighted character always carries an underline too, so colour is never the only signal. In
addition, no security rating is colour-coded. A red-and-green badge would claim to be the most
urgent thing on the page, and the "How this breaks" section is.

## Deploying

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`, `npm test`,
`npm run build`, then publish. The tests gate the deploy on purpose.

`vite.config.ts` sets `base` to `/crypto-site/` for production, and the app uses
`createHashRouter`. As a result, GitHub Pages serves it with no rewrite rule, and a refresh on
a sub-path does not return a 404. **Change `REPO_BASE` in `vite.config.ts` if the repository is
renamed**, or the built site will request its assets from a path that does not exist.

One setting must be changed by hand: **Settings → Pages → Source = GitHub Actions**. The default
is "deploy from a branch", and the workflow does nothing until it is switched.

## Contributing

`CLAUDE.md` is the design record. It holds the contract, the known gaps in it, and the reason
behind each decision. It should be read before anyone extends `src/ciphers/types.ts`.

Every cipher on this site falls to an attacker who knows how it works. That is the whole
lesson, and Kerckhoffs wrote it down in 1883.
