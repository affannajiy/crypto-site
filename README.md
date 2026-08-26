# CryptoLab

An interactive cryptography learning lab. You encrypt something, and then you read every
step the algorithm took to get there. Where a cipher can be broken, you break it.

**This is a teaching tool, not a security product.** It runs entirely in the browser, it
has not been audited, and no code a browser can read can keep a secret. The app says so on
every page, on purpose.

## Running it

```bash
npm install
```

```bash
npm run dev
```

| Script              | Does                                    |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Dev server on http://localhost:5173     |
| `npm test`          | Vitest, once                            |
| `npm run test:watch`| Vitest, watching                        |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm run build`     | Typecheck, then a production build      |

## The one rule

> Cipher logic lives in plain TypeScript modules that import nothing from React.

Everything under `src/ciphers/` — except a cipher's own visualizer component — must run in
a unit test or a Node script with no DOM. If a `useState` appears next to an algorithm,
something has gone wrong.

## Adding a cipher

Create one folder. Change nothing else. There is no central list, no route to register, and
no UI to touch.

```
src/ciphers/<family>/<slug>/
  index.ts         # default-exports a CipherModule — the registry finds it by glob
  <slug>.ts        # the pure algorithm, plus the step trace
  <slug>.test.ts   # ships in the same commit, no exceptions
  attack.ts        # only if the module declares the 'attack' tier
  <Name>Vis.tsx    # only if the module declares the 'visualize' tier
```

`src/ciphers/classical/caesar/` is the worked example. Read `src/ciphers/types.ts` first —
the UI reads that contract and nothing else, and no component may branch on a cipher's name.

At startup in development the registry checks every module and throws with all violations at
once: unique kebab-case slugs, unique parameter names, in-range defaults, an implementation
behind every declared tier, and a **"How this breaks"** section in every explainer. That last
one is a real requirement, not a nicety — a tool that only shows the happy path teaches
people to be dangerous.

## Design

Functionality over beauty. The screen should explain the algorithm, not decorate it.

Colours are semantic tokens in `src/index.css`, never hardcoded in a component, so a dark
theme is a change to one file. Orange means **"look here"** and nothing else — never a
button, a link, or decoration. It appears in two shades for contrast reasons, documented
where they are defined.

## Deploying

`vite.config.ts` sets `base` to `/crypto-site/` for production, and the app uses a hash
router, so GitHub Pages serves it without a rewrite rule. Change `REPO_BASE` there if the
repository is renamed. Nothing is deployed yet.

## Status

Phase 0 (skeleton) and Phase 1 (Caesar, all four tiers) are built. Later phases add the rest
of the classical ciphers, hashing, symmetric, and asymmetric families.
