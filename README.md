# CryptoLab

**[affannajiy.github.io/crypto-site](https://affannajiy.github.io/crypto-site/)**

An interactive cryptography learning lab. You encrypt something, and then you read every
step the algorithm took to get there. Where a cipher can be broken, you break it in the
browser and watch the search run.

**This is a teaching tool, not a security product.** It runs entirely in your browser, it
has not been audited, and no code a browser can read can keep a secret. Every hand-written
algorithm in here uses table lookups that are not constant-time, which is a real key-recovery
weakness and is documented in each file that has it.

## What is in it

Thirty-two entries across five families. The folder tree is the curriculum.

| Family | Group | Entries |
| --- | --- | --- |
| Encoding | — | Morse Code |
| Classical | Substitution | Caesar, Atbash, ROT13, Affine, Bacon |
| | Polyalphabetic | Vigenère, Porta, Beaufort, Autokey |
| | Transposition | Rail Fence, Columnar |
| | Polygraphic | Playfair, Hill, Four-square |
| | Fractionation | Bifid, Trifid, Nihilist, ADFGVX, Straddling Checkerboard |
| | Mechanical | Enigma |
| | Perfect secrecy | One-Time Pad |
| Symmetric | Block and stream | DES, AES, ChaCha20 |
| Hashing | Digests | MD5, SHA-1, SHA-256, SHA-512, PBKDF2 |
| Asymmetric | Public key | RSA |
| | Key exchange | Diffie-Hellman |

Each entry has up to four tabs, and only the ones that teach something:

- **Encrypt** — run it, with every intermediate step listed and the active one highlighted
  in both panes.
- **Visualize** — the same run, drawn. Caesar gets rotating rings, Enigma gets its rotors,
  MD5 gets Wang and Yu's 2004 collision computed live from the bytes on screen.
- **Attack** — a working break, where a working break fits in one function. Eight ciphers have one. The rest say in their explainer why they do not, and the reason is never
  "we ran out of time".
- **Benchmark** — throughput. On PBKDF2 this measures the thing the algorithm exists to do,
  which is be slow.

Five pages are not a cipher: the **catalogue**, a **timeline** by date, a **compare** table
of all thirty-two on one screen, a **playground** that runs one message through two ciphers
at once, and **analyse**, which measures an unknown ciphertext and reports observations
rather than a verdict. `Ctrl`/`Cmd`+`K` reaches any of them.

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

Tests run in the **node** environment, not jsdom, because the rule below means they do not
need a DOM.

## The one rule

> Cipher logic lives in plain TypeScript modules that import nothing from React.

Everything under `src/ciphers/` must run in a unit test or a Node script with no DOM. The
two exceptions are a cipher's own visualizer component and one compile-time `import type`.
If a `useState` appears next to an algorithm, the design is wrong.

## Adding a cipher

Create one folder. Change nothing else. There is no central list, no route to register, and
no UI to touch — `src/ciphers/registry.ts` finds modules with `import.meta.glob`.

```
src/ciphers/<family>/<group>/<slug>/
  index.ts          # default-exports a CipherModule — the registry finds it by glob
  <slug>.ts         # the pure algorithm, plus the step trace
  <slug>.test.ts    # ships in the same commit, no exceptions
  attack.ts         # only if the module declares the 'attack' tier
  <Name>Vis.tsx     # only if the module declares the 'visualize' tier
```

The catalogue reads its sub-heading from the middle path segment, so
`classical/substitution/caesar` appears under Substitution without declaring anything.

Read `src/ciphers/types.ts` first. It is the whole contract, the UI reads nothing else, and
**no component may branch on a cipher's slug or name.**

In development the registry validates every module at load and throws with *all* violations
at once: unique kebab-case slugs, folder name equal to slug, a known group, an implementation
behind every declared tier, unique parameter names, in-range defaults, at least one worked
example, and a **"How this breaks"** section in every explainer. That last one is enforced in
code, not by convention — a tool that only shows the happy path teaches people to be
dangerous.

## Is the crypto correct

Every algorithm here is hand-written, including AES, DES and ChaCha20, because
`crypto.subtle.encrypt` returns a ciphertext and nothing else — it cannot show a round, a
state matrix or a key schedule, and the middle of the algorithm is the whole reason these
pages exist.

The safeguard is cross-checking rather than trust:

- AES is checked against `crypto.subtle` AES-CBC, block for block.
- AES, DES and ChaCha20 are checked against their published vectors (FIPS-197, the classic
  DES vector, RFC 8439 §2.1.1 and §2.3.2).
- PBKDF2 is checked against `crypto.subtle`'s own PBKDF2. The widely-copied RFC 6070 vectors
  are HMAC-**SHA-1** and would have been quietly wrong here.
- MD5 has no `crypto.subtle` equivalent — the platform will not hand you a broken hash — so
  it leans on published vectors plus the 2004 collision, which a wrong implementation could
  not reproduce.
- SHA-512's eighty round constants are **derived** from integer roots of the first eighty
  primes rather than pasted, and the test pins them against FIPS 180-4.

1,012 tests. `npm test` gates the deploy.

## Design

Functionality over beauty. The screen should explain the algorithm, not decorate it.

Colours are semantic tokens in `src/index.css`, never hardcoded in a component, so a dark
theme stays a change to one file. **Orange means "look here" and nothing else** — never a
button, a link, or decoration. It comes in five steps chosen by contrast ratio, not taste,
and a highlighted character always carries an underline too, so colour is never the only
signal. No security rating is colour-coded: a red-and-green badge would claim it is the most
urgent thing on the page, and the "How this breaks" section is.

## Deploying

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`, `npm test`,
`npm run build`, then publish. Tests gate the deploy on purpose.

`vite.config.ts` sets `base` to `/crypto-site/` for production and the app uses
`createHashRouter`, so GitHub Pages serves it with no rewrite rule and a refresh on a
sub-path does not 404. **Change `REPO_BASE` in `vite.config.ts` if the repository is
renamed**, or the built site will request its assets from a path that does not exist.

One setting must be changed by hand: **Settings → Pages → Source = GitHub Actions**. The
default is "deploy from a branch", and the workflow does nothing until it is switched.

## Contributing

`CLAUDE.md` is the design record: the contract, the known gaps in it, and why each decision
went the way it did. Read it before extending `src/ciphers/types.ts`.
