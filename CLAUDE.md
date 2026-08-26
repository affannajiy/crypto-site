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

`family` is `'encoding' | 'classical' | 'symmetric' | 'hashing' | 'asymmetric'`. **`'encoding'`
exists for Morse and currently has one member**, which is deliberate: the Classical family's
catalogue description says every one of them is broken, and Morse is not broken because it never
tried to be secret. A family of one, clearly labelled, says that better than a footnote would —
and encoding-mistaken-for-encryption is the most common misunderstanding in the subject.

### Discovery

`src/ciphers/registry.ts` collects every `./**/index.ts` with `import.meta.glob`. Adding a cipher
means **creating one folder and nothing else** — no central list, no route to register, no UI to
touch. If you are editing `registry.ts` to add a cipher, stop.

**The folder tree is the curriculum.** A cipher lives at `<family>/<group>/<slug>/`, and the
catalogue reads its sub-heading from that middle segment — so `classical/substitution/caesar`
appears under Substitution without declaring anything. `GROUPS` in `registry.ts` is an ordered
list of those groups with their headings; adding a cipher to an existing group still needs no
edit, and inventing a new group costs one line. That one line is a decision about the whole
catalogue rather than a fact about one cipher, which is why it lives centrally.

In dev (and therefore in tests) the registry validates at module load and throws with *all*
violations at once:

- slugs unique and lowercase kebab-case
- **the folder name equals the slug** (the catalogue reads the path, so a mismatch is a trap)
- **the folder's group is in `GROUPS`**, or it would sort last with no heading text
- `tiers` non-empty and containing `'encrypt'`
- every declared tier has its implementation (`'attack'` ⇒ `attack()`, `'visualize'` ⇒ `visualize`)
- `ParamSpec.name` unique per cipher; number defaults in range; select defaults among the options
- **every `explainer` contains a "How this breaks" section** — enforced in code, not convention

### Shared code

`src/lib/letters.ts` holds the alphabet plumbing (`letterIndex`, `letterFromIndex`, `normalise`,
`lettersOnly`, `describeChar`) and `src/lib/polybius.ts` the keyed 5×5 and 6×6 squares. The first
eleven ciphers each carry their own copies, which was fine at two and silly at eleven; they keep
them, because rewriting a working tested algorithm to save nine lines is churn. **New ciphers
import from `lib/`.**

Cross-cipher imports are allowed and are sometimes the point. Beaufort and Porta import
`candidateKeyLengths` from `polyalphabetic/vigenere/attack`, and ADFGVX imports `columnarOrder`
from `transposition/columnar/columnar`. In both cases the import *is* the argument — if a cipher
falls to literally the same code, the change bought no security.

### Tiers drive the UI

`CipherWorkbench` renders one tab per entry in `cipher.tiers`. A cipher that omits `'attack'`
has **no** attack tab, not a disabled one. This is how breadth of ciphers stays compatible with
depth only where it teaches something.

**Most ciphers omit `'attack'`, and the reason is always in the explainer**, so a missing tab is
documented rather than merely absent. The reasons group into five kinds. (An earlier version of
this file claimed no two reasons were alike; that stopped being true once there were twenty
ciphers, and pretending otherwise would have meant inventing differences.)

**1. The search is real but out of scope** — a hill-climbing program, not a button.

| Cipher | |
| --- | --- |
| Playfair | 25! key squares. The interesting part is the search, not the cipher. |
| Four-square | Two keyed squares. Same wall, twice. |
| Bifid, Trifid | The square *and* the period, and they hide each other: with the wrong period a correct square scores like a random one. Solved in practice period-first, which is a program you run. |

**2. No search can exist, or there is nothing to search.**

| Cipher | |
| --- | --- |
| One-Time Pad | Information-theoretically secure. The tab would be a machine that provably cannot work. |
| Atbash | The key space has exactly one member. "Attacking" it is pressing Encrypt. |
| ROT13 | Applying the cipher to the ciphertext *is* the decryption. Same tab twice. |
| Bacon | No key at all. The protection is concealment, so breaking it is *noticing*, not computing. |
| Morse | Nothing is hidden. It is not encryption. |

**3. `attack(ciphertext)` cannot express the real attack — contract gap 6, now hit four times.**

| Cipher | What the attack needs and cannot be given |
| --- | --- |
| Hill | A **crib**. Four matching letters give four equations. A ciphertext-only brute force would fit the signature and lie: it teaches exhaustion where the cause is linearity. |
| Enigma | A **crib**, slid along the ciphertext against "no letter is ever itself". |
| ADFGVX | **Several messages in depth.** Painvin needed a stack of same-length intercepts from one day; the signature is given exactly one. |
| RSA, Diffie-Hellman | The **public key**, which is a param and not a ciphertext. Both put their break on the Visualize tab instead, which does receive params. |

**4. Breaking it is frequency analysis the Caesar page already shows.**

| Cipher | |
| --- | --- |
| Nihilist | The real attack is inference from the unreduced sums over a decent volume — a chain of reasoning, not a loop. The leak itself is on Visualize. |
| Straddling Checkerboard | On its own it is a code. Count the digits and it falls; it was only ever the first stage of something larger. |

**5. It works.** New with the modern section, and the most important row in the table.

| Cipher | |
| --- | --- |
| AES, ChaCha20 | No known practical attack. A button suggesting otherwise would be the most misleading thing in this app. |
| DES | Broken by brute force over 2⁵⁶ — a real, successful, historically important attack that is hardware and money rather than a button. The design held; the key was too short. |

Do not add a token attack to "complete" a cipher.

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
when in fact the search gave up. Autokey's search is capped the same way, at `MAX_KEYWORD` = 3
(26³ = 17,576 trials, instant; four letters is 457k and freezes the page).

**Chi-squared also overfits, which is a second reason to reach for bigrams.** Found while building
Beaufort's attack: the true four-letter key NAVY scored 47.5 on the test paragraph and a *wrong*
sixteen-letter key scored 28.7, because more key letters means more freedom to bend the letter
counts towards English while producing text that is not English. Counting adjacent pairs does not
overfit that way. So the three new polyalphabetic attacks solve each **column** by chi-squared
(a column has no word structure, so pairs are meaningless there) and rank whole **candidates** by
bigram fit. Two statistics, two different questions.

**Vigenère's own attack still ranks by chi-squared and has the same latent problem.** It passes its
tests and has not been touched; noted here rather than silently changed. Worth fixing if its
ranking is ever seen to misbehave.

Autokey scores only the first `SCORE_PREFIX` (160) characters of each trial decryption. Not a
corner cut: a wrong autokey guess poisons the keystream at the first letter and never recovers, so
the opening decides every candidate, and the search stays bounded by the key space rather than by
message length.

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
- **`wrap-anywhere`, not `break-words`, on a pane.** `overflow-wrap: break-word` breaks a long
  word only when it has nowhere else to go and does *not* count towards min-content width — so a
  96-character hex ciphertext with no spaces in it (AES, DES, ChaCha20, Diffie-Hellman) widened
  its grid track past the viewport and gave the whole page a horizontal scrollbar at 320 px.
  `overflow-wrap: anywhere` breaks the same runs *and* shrinks min-content, which is what actually
  fixes it, and unlike `break-all` it leaves ordinary prose unhyphenated.
- **Explainers may use four-space-indented blocks and `*italic*`**, and `Markdown.tsx` renders
  both. It did not until late, so Hill's and Enigma's diagrams had been folding into one long
  paragraph and their italics printing as literal asterisks. Alignment is the whole point of a
  diagram; check a new explainer's diagrams on the page rather than trusting the source.

## The safety notice

`SafetyNotice` renders once, small, in the site footer. It used to repeat on every cipher page
and under every panel; that read as alarm rather than information, and a warning that shouts on
every screen is one people stop seeing. Do not scatter it again. The honesty work is carried by
the **"How this breaks"** section the registry requires of every explainer.

## Routing and deployment

`createHashRouter` is **mandatory**. GitHub Pages has no server rewrite, so a browser router
404s on refresh at any sub-path. `vite.config.ts` sets `base` to `REPO_BASE` (`/crypto-site/`)
for production only — **change that constant if the repo is renamed**, or the built site will
request its assets from a path that does not exist.

`.github/workflows/deploy.yml` builds on every push to `main`: `npm ci` → `npm test` →
`npm run build` → upload `dist` → deploy. Tests gate the deploy on purpose. The one setting that
must be changed by hand is **Settings → Pages → Source = GitHub Actions**; the default is "deploy
from a branch" and the workflow does nothing until it is switched.

## Dependencies

Deliberately minimal: React, react-router-dom, Tailwind, Vite, Vitest, TypeScript. **Ask before
adding** a state-management, component, animation, math, or markdown library. `Markdown.tsx` is
a ~70-line renderer covering exactly what explainers use, and builds React elements rather than
touching `dangerouslySetInnerHTML`.

**Every cipher here is hand-written, including the modern ones.** An earlier version of this file
said modern ciphers would use browser-native WebCrypto. That turned out to be incompatible with
the point of the app: `crypto.subtle.encrypt` returns a ciphertext and nothing else — it cannot
show a round, a state matrix or a key schedule, and the middle of the algorithm is the entire
reason these pages exist. So AES, DES and ChaCha20 are written out in full.

The safeguard is **cross-checking rather than trust**:

- AES is checked against `crypto.subtle` AES-CBC block for block, in `aes.test.ts`.
- AES, DES and ChaCha20 are all checked against their published test vectors (FIPS-197,
  the classic DES vector, RFC 8439 §2.1.1 and §2.3.2).

Every one of those files carries a **"do not use this for anything real"** warning in its header
and its explainer, and says why: the table lookups are not constant-time, so a real attacker
measuring cache timing could recover the key. That is not hypothetical, and it is the honest cost
of writing crypto for legibility.

BigInt is used directly for RSA and Diffie-Hellman. No math library.

## Known gaps in the contract

Worth reading before extending `types.ts`. Gap 4 is fixed; the rest are open, and 2, 3 and 6 have
all become more pressing since the modern ciphers landed.

1. **`visualize` gets no active-step index.** Its props are `{ steps, params }`, so each
   visualizer must build its own scrubber. Harmless only because Visualize and Encrypt are
   different tabs. Fix: add `activeIndex` + `onActiveIndexChange`.
2. **Benchmark can only measure the traced path.** `encrypt()` always allocates one `Step` per
   character, and that allocation dominates the measurement. Fix: optional `benchmark?(input, p)`
   falling back to `encrypt`. `caesar.ts` already exports the untraced `caesar()` for this, and so
   does every module added since — `aes()`, `des()`, `chacha20()`, `rsa()`, `dh()` are all there
   and unused. **This is now the most worth fixing.** DES represents its state as an array of 64
   individual bit values, which is written for legibility and is enormously slower than the packed
   arithmetic a real implementation uses — so the Benchmark tab currently reports something closer
   to "how readable is this file" than "how fast is this cipher".
3. **`Params` cannot hold bytes.** A `bytes` spec declares `lengthBytes` but the value travels as
   `string | number`. Hex-in-a-string is the current convention with nothing enforcing it. **Now
   exercised, and it holds up worse than hoped.** AES, DES and ChaCha20 all take their key, IV and
   nonce as hex strings in `text` params and validate them by hand, so every one of those modules
   carries its own `readKey` throwing its own error message. The `bytes` kind is still unused by
   anything. Fix: make `bytes` real, with the workbench rendering a hex field that validates
   length centrally and a "randomise" button.
4. ~~**`Step.highlight` is one range and does not say which text it indexes.**~~ **Fixed.**
   `Step.outputHighlight` was added when Rail Fence landed: a transposition moves a character to
   a different index, so one range cannot describe both panes. Substitution ciphers still set
   only `highlight`, and `EncryptPanel` falls back to it, so Caesar and Vigenère needed no change.
5. **`tiers: ['benchmark']` is unverifiable**, since every cipher has `encrypt`. Resolves if 2 lands.
6. **`attack(ciphertext)` is too narrow, and four ciphers have now hit it from three directions.**
   Hill and Enigma need a **crib**. ADFGVX needs **several messages in depth**. RSA and
   Diffie-Hellman need the **public key**, which is a param. Every one of those ships without an
   Attack tab because of the signature rather than because of the cipher.
   RSA and Diffie-Hellman found a workaround worth noting: their break lives on the **Visualize**
   tab, which *does* receive `params`, and it is arguably the better home anyway — both are
   attacks on a *key* rather than on a message. Fix, now clearly worth one:
   `attack(input: { ciphertext: string; params: Params; crib?: string })`, with `CipherModule`
   declaring what it needs so the panel can ask. This is the single most-hit gap in the contract.
7. **`ParamSpec` cannot group related params.** Hill's key is a 2×2 matrix and arrives as four
   unrelated `number` boxes, because there is no way to say "these four belong together". The
   workbench renders them correctly and reads badly. A component that special-cased Hill would
   break the no-branching-on-slug rule, so the boxes stay until the contract can express a group.
   Enigma's seven and Diffie-Hellman's four have the same problem, less acutely.
8. **`CipherModule` cannot describe a primitive that is not a cipher.** Diffie-Hellman produces a
   *key*, not a ciphertext, and the contract's `encrypt(input, params) -> TraceResult` has nowhere
   to put that. The page copes by deriving the shared secret and then using it to encipher the
   message with a deliberately trivial keystream, labelled as a stand-in in both the code and the
   explainer — the alternative was an empty Encrypt tab. **Hashing will hit the same wall harder**,
   from the other side: a hash has no `decrypt` at all, and `tiers` has no way to say so. Worth
   settling before the hashing phase starts, not during it.

## Roadmap and scope discipline

**Twenty-seven entries ship, in four families** (eleven of them from before this round). The folder tree is the curriculum; this is what is
in it.

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
| Asymmetric | Public key | RSA |
| | Key exchange | Diffie-Hellman |

**Hashing is the one phase still locked**, and it is next: SHA-256 avalanche, MD5 with a published
collision, PBKDF2 cost slider, salt demo. Read gap 8 before starting it — a hash has no `decrypt`
and `CipherModule` has no way to say so, and that is better settled first than during.

Beyond hashing, if it is ever wanted: MACs and HMAC, digital signatures (ECDSA), elliptic curves
proper, and post-quantum. None of these are ciphers either, and all of them run into gap 8.

**Do not add more classical ciphers.** The family has enough breadth to make every point it makes,
and another would be a cryptographic graveyard rather than a curriculum.

**Working agreement:** stop and summarise after each phase; do not chain phases unprompted. Every
cipher module ships with its tests in the same commit. If a spec decision turns out wrong in the
code, say so and propose the alternative rather than silently working around it — this file records
three such corrections (the WebCrypto plan under Dependencies, the "no two reasons alike" claim
under Tiers, and chi-squared's overfitting under Attacks), and recording them is the point.

## Rulebooks

`rulebooks/` holds three portable principle references (UI-UX, Security, Engineering) plus a
`README.md` with a routing table saying which to read for a given kind of change. They are
**token-expensive** (~5–7k each) and read in full when loaded — consult the routing table and
load only the one the change needs. Do not paste their contents into this file.
