# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CryptoLab: an interactive cryptography **learning lab**. The user encrypts text and sees every
intermediate step. It is a teaching tool, not a security product — it will never handle a real
secret, and the app says so on every page on purpose.

**Non-goals, enforced:** no accounts, backend, or database. No file encryption, password vault,
or "secure messaging". No claim anywhere in copy or comments that this is safe for real use.
No cipher outside the current phase's scope.

## Commands

```bash
npm run dev
```

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server on http://localhost:5173 |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck, then production build |

Run one file: `npx vitest run src/ciphers/classical/caesar/caesar.test.ts`
Run one test by name: `npx vitest run -t "recovers every shift"`

Tests run in the **node** environment (`vite.config.ts`), not jsdom — there is no DOM. That is
deliberate and follows from the rule below. Adding component tests means adding a jsdom project
to the Vitest config, not switching the default.

## The hard rule

> Cipher logic lives in plain TypeScript modules that import nothing from React.

Everything under `src/ciphers/` must run in a unit test or a Node script with no DOM. The two
permitted exceptions are a cipher's own `visualize` component and the `import type` of
`ComponentType` in `types.ts`, which is erased at compile time. If a `useState` appears beside
an algorithm, the design is wrong.

Consequence worth knowing: a cipher's `index.ts` imports its visualizer, so `index.ts` is not
itself React-free. The algorithm file is, and that is where the testable logic belongs.

## Architecture

Read `src/ciphers/types.ts` first. It is the whole contract, and the UI reads nothing else.

**No component may branch on a cipher's `slug` or `name`.** If the UI needs to know something
about a cipher, that fact belongs in `CipherModule`.

### Discovery

`src/ciphers/registry.ts` collects every `./**/index.ts` with `import.meta.glob`. Adding cipher
number sixteen means **creating one folder and nothing else** — no central list, no route to
register, no UI to touch. If you are editing `registry.ts` to add a cipher, stop.

In dev (and therefore in tests) the registry validates at module load and throws with *all*
violations at once:

- slugs unique and lowercase kebab-case
- `tiers` non-empty and containing `'encrypt'`
- every declared tier has its implementation (`'attack'` ⇒ `attack()`, `'visualize'` ⇒ `visualize`)
- `ParamSpec.name` unique per cipher; number defaults in range; select defaults among the options
- **every `explainer` contains a "How this breaks" section** — enforced in code, not convention

### Tiers drive the UI

`CipherWorkbench` renders one tab per entry in `cipher.tiers`. A cipher that omits `'attack'`
has **no** attack tab, not a disabled one. This is how breadth of ciphers stays compatible with
depth only where it teaches something.

**Six ciphers omit `'attack'`, and no two share a reason.** The reason is the content — each
explainer carries it, so a missing tab is documented rather than merely absent.

| Cipher | Why there is no Attack tab |
| --- | --- |
| Playfair | Breaking it means hill-climbing over 25-letter key squares. The interesting part is the search, not the cipher, and a brute-force button would misrepresent the difficulty. |
| One-Time Pad | No attack can exist. It is information-theoretically secure, so the tab would be a machine that provably cannot work. |
| Atbash | The key space has exactly one member. "Attacking" it is pressing Encrypt. |
| ROT13 | Applying the cipher to the ciphertext *is* the decryption. Same tab twice. |
| Hill | The honest attack is **known-plaintext** — four matching letters give four equations — and `attack(ciphertext)` cannot express a crib. A ciphertext-only brute force would fit the signature and lie: it does not generalise past 2×2, and it teaches exhaustion where the real cause is linearity. |
| Enigma | Also needs a crib, slid along the ciphertext and tested against "no letter is ever itself". 158 million million million settings is not a button; Turing's bombe used the crib's structure to make almost all of them irrelevant. |

Do not add a token attack to "complete" a cipher. Two of these are limits of `CipherModule`
rather than of the cipher — see gap 6.

### State flow

`CipherWorkbench` owns `input`, `params`, `direction`, and `activeIndex`, and calls
`useCipherRun` once. That single `RunState` feeds `EncryptPanel`, `VisualizePanel`, and
`BenchmarkPanel`. `AttackPanel` is deliberately independent — it holds its own ciphertext,
seeded from the last encrypt output, and only writes back through `onUseKey`.

`useCipherRun` handles sync and async ciphers on one path, shows a running state **only** for
promises (a same-tick cipher must not flash a spinner), and guards against stale responses with
a `cancelled` flag.

`ParamControls` lives in the workbench above the tab strip, not inside `EncryptPanel`, because
Visualize and Benchmark need the same values and the attack loop depends on the shift being
visible from the Attack tab.

`CipherPage` passes `key={cipher.slug}` to the workbench so no state survives a cipher change.

`activeIndex` travels as a `Dispatch<SetStateAction<number | null>>`, not a plain callback.
`StepTrace`'s Previous and Next step *relative* to the current value, and a plain callback reads
a stale prop the moment two clicks land in one tick — which is what holding Enter on the button
does.

### Step.data

`Step.data` is a free-form `Record<string, unknown>` and is the **only** channel from an
algorithm to its visualizer. Read it defensively with `typeof` guards — see `readMapping` in
`CaesarRings.tsx`. Nothing else in the app may read it.

### Attacks own their statistic

`chiSquaredEnglish` counts letters and breaks substitutions. It is **worthless against a
transposition** — Rail Fence never replaces a letter, so every candidate decryption has identical
letter counts and scores identically. `src/lib/bigrams.ts` counts adjacent *pairs* instead, because
what a transposition destroys is adjacency.

The rule that follows: **the right statistic depends on what the cipher destroys.** A new attack
picks its own, and names it in `CipherModule.attackScoreLabel` (`'chi-squared'`, `'bigram fit'`).
`AttackPanel` used to print "chi-squared" beside every score, which was true until it wasn't.
`AttackCandidate.score` stays lower-is-better across the app, so a higher-is-better statistic is
negated at the boundary and the panel needs to know nothing.

Both transpositions use it: Rail Fence tries nine rail counts, Columnar tries every column order up
to `MAX_ATTACK_WIDTH` (seven, which is 5040). Columnar's search is capped and **says so in the
explainer** — a tool that returns nothing without explaining why teaches that the cipher resisted,
when in fact the search gave up.

The bigram weights are approximate and labelled as such in the file. They are for ranking a handful
of candidates against each other, not for citing.

## Design constraints

Functionality over beauty. The screen should explain the algorithm, not decorate it.

- Colours are semantic tokens in `src/index.css` (`--color-ink`, `--color-canvas`, `--color-line`…).
  Never hardcode a hex value or a Tailwind palette class in a component — a dark theme must stay
  a change to one file. The palette is the warm cream-and-orange system shared with the owner's
  other site.
- **Orange means "look here" and nothing else.** Never a button, link, or decoration. It comes in
  five steps, and the split is contrast, not taste — picking the wrong one is an accessibility
  bug, not a style preference:

  | Token | Hex | On canvas | Use for |
  | --- | --- | --- | --- |
  | `--color-marker` | `#f97316` | 2.6:1 | fills and `accent-color` only — never a lone signal |
  | `--color-marker-line` | `#c2500f` | 4.5:1 | strokes, borders, underlines (WCAG 1.4.11) |
  | `--color-marker-ink` | `#96410a` | 6.5:1 | orange **text** (WCAG 1.4.3) |
  | `--color-marker-mid` | `#fed7aa` | — | a soft border on a tinted surface |
  | `--color-marker-wash` | `#fff0e6` | — | the tinted surface itself |

  A highlighted character is near-black on `marker-wash` with a `marker-line` underline, so
  colour is never the only signal.
- **Body prose uses `.cl-prose`**: full width, `text-align: justify`, `hyphens: auto`. Justifying
  is a deliberate house choice against the usual advice; `hyphens: auto` is what stops it opening
  rivers of whitespace, so drop one and you drop both. Do not cap prose with `max-w-prose` —
  sections use the full column.
- Monospace for ciphertext, keys, hex, and step details. Sans for prose.
- Native elements with real `<label>`s. No div buttons. Every control keyboard-operable, nothing
  under 24×24 CSS px, no horizontal scroll at 320 px.
- **A fixed-width SVG scrolls; it does not shrink.** `max-w-full` on a diagram whose column count
  is fixed scales the whole thing down — at 320 px the Affine mapping's letters rendered at 5 px
  and the Rail Fence characters likewise. Give the SVG its real `width` and `block shrink-0`, and
  let the `overflow-x-auto` card around it scroll. The page still must not scroll horizontally.
- A native checkbox renders around 13 px. Anything interactive needs an explicit `h-6 w-6`
  (or a `min-h-6` wrapper) to clear the 24 px floor.
- `src/components/textPane.ts` holds the metrics the input and output panes share. The two panes
  must stay the same size, and `HighlightedTextarea` draws its text twice — a `<mark>` backdrop
  under a transparent-glyph textarea — so both layers must wrap identically or the highlight
  lands on the wrong character. **Never style one layer, or one pane, alone.**

## The safety notice

`SafetyNotice` renders once, small, in the site footer. It used to repeat on every cipher page
and under every panel; that read as alarm rather than information, and a warning that shouts on
every screen is one people stop seeing. Do not scatter it again. The honesty work is carried by
the **"How this breaks"** section the registry requires of every explainer.

## Routing and deployment

`createHashRouter` is **mandatory**. GitHub Pages has no server rewrite, so a browser router
404s on refresh at any sub-path. `vite.config.ts` sets `base` to `REPO_BASE` (`/crypto-site/`)
for production only — change that constant if the repo is renamed. Nothing is deployed yet.

## Dependencies

Deliberately minimal: React, react-router-dom, Tailwind, Vite, Vitest, TypeScript. Classical
ciphers are hand-written from scratch; modern ones use browser-native WebCrypto. **Ask before
adding** a state-management, component, animation, math, or markdown library. `Markdown.tsx` is
a ~70-line renderer covering exactly what explainers use, and builds React elements rather than
touching `dangerouslySetInnerHTML`.

## Known gaps in the contract

Flagged during Phase 1, not yet fixed. Worth reading before extending `types.ts`:

1. **`visualize` gets no active-step index.** Its props are `{ steps, params }`, so each
   visualizer must build its own scrubber. Harmless only because Visualize and Encrypt are
   different tabs. Fix: add `activeIndex` + `onActiveIndexChange`.
2. **Benchmark can only measure the traced path.** `encrypt()` always allocates one `Step` per
   character, and that allocation dominates the measurement. Fair between ciphers here, and the
   panel says so — but it will be badly misleading for AES, where WebCrypto works natively and
   the trace is pure overhead. Fix: optional `benchmark?(input, p)` falling back to `encrypt`.
   `caesar.ts` already exports the untraced `caesar()` for this.
3. **`Params` cannot hold bytes.** A `bytes` spec declares `lengthBytes` but the value travels as
   `string | number`. Hex-in-a-string is the current convention with nothing enforcing it. The
   One-Time Pad was the obvious first victim and sidesteps it entirely by working letter-wise
   mod 26, which is also how real letter pads worked — so this is still unfixed and still
   unexercised. AES will not have that escape route.
4. ~~**`Step.highlight` is one range and does not say which text it indexes.**~~ **Fixed.**
   `Step.outputHighlight` was added when Rail Fence landed: a transposition moves a character to
   a different index, so one range cannot describe both panes. Substitution ciphers still set
   only `highlight`, and `EncryptPanel` falls back to it, so Caesar and Vigenère needed no change.
5. **`tiers: ['benchmark']` is unverifiable**, since every cipher has `encrypt`. Resolves if 2 lands.
6. **`attack(ciphertext)` cannot express a known-plaintext attack.** Flagged when Hill and Enigma
   landed, and it is the reason both ship without an Attack tab. The real break of each needs a
   *crib* — a guess at some plaintext — and the signature has nowhere to put one. Every attack in
   the app so far is ciphertext-only, so this never came up before. Fix, if it is worth one:
   `attack(ciphertext, crib?: string)`, with `CipherModule` declaring whether a crib is required
   so the panel can ask for one. Not done, because it changes the panel as well as the contract
   and neither cipher is worse off for having the reasoning in its explainer instead.
7. **`ParamSpec` cannot group related params.** Hill's key is a 2×2 matrix and arrives as four
   unrelated `number` boxes, because there is no way to say "these four belong together". The
   workbench renders them correctly and reads badly. A component that special-cased Hill would
   break the no-branching-on-slug rule, so the boxes stay until the contract can express a group.

## Roadmap and scope discipline

Phase 0 (skeleton) and Phase 1 (Caesar, all four tiers) are built. Since then: **Vigenère**
(Kasiski + index of coincidence), **Rail Fence** (transposition, bigram attack), **Playfair**
(digraphs, three tiers — no attack), **Affine** (modular inverse, first `select` param), the
**One-Time Pad** (key-reuse demo, three tiers), **Atbash** and **ROT13** (the first ciphers with
`params: []`, both involutions), **Columnar Transposition** (factorial key space, permutation
search), **Hill** (matrices mod 26, first real diffusion) and **Enigma** (real rotor wirings,
double-stepping, the never-itself flaw). Later phases stay locked until earlier ones ship,
in this order: hashing (SHA-256 avalanche, MD5 with a published collision, PBKDF2 cost slider, salt
demo) → symmetric (AES-GCM/CBC, ECB penguin, Feistel animation, XOR key reuse) → asymmetric
(toy-prime RSA, Diffie-Hellman colour mixing, ECDSA, an Alice/Bob/Eve channel).

**Phase 2 (remaining classical) is complete.** Eleven ciphers ship: Caesar, Vigenère, Rail Fence,
Playfair, Affine, One-Time Pad, **Atbash**, **ROT13**, **Columnar Transposition**, **Hill** and
**Enigma**. Later phases stay locked, in the order given above.

**Working agreement:** stop and summarise after each phase; do not chain phases unprompted. Every
cipher module ships with its tests in the same commit. If a spec decision turns out wrong in the
code, say so and propose the alternative rather than silently working around it.

## Rulebooks

`rulebooks/` holds three portable principle references (UI-UX, Security, Engineering) plus a
`README.md` with a routing table saying which to read for a given kind of change. They are
**token-expensive** (~5–7k each) and read in full when loaded — consult the routing table and
load only the one the change needs. Do not paste their contents into this file.
