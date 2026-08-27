# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when it works in this repository.

This file uses Simplified Technical English. Sentences are short. The voice is active.
Each rule is one sentence. Keep it that way when you edit this file.

## What this is

CryptoLab is an interactive cryptography learning lab. The user encrypts text. The user then
reads every intermediate step. It is a teaching tool. It is not a security product. It never
handles a real secret. The app says so on every page, on purpose.

Non-goals, enforced:

- No accounts, no backend, no database.
- No file encryption, no password vault, no secure messaging.
- No claim, in copy or in a comment, that this is safe for real use.
- No cipher outside the scope of the current phase.

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

Run one file: `npx vitest run src/ciphers/classical/substitution/caesar/caesar.test.ts`

Run one test by name: `npx vitest run -t "recovers every shift"`

Tests run in the **node** environment, not jsdom. See `vite.config.ts`. There is no DOM. This
is deliberate. It follows from the hard rule below. To add component tests, add a jsdom
project to the Vitest config. Do not change the default.

## The hard rule

> Cipher logic lives in plain TypeScript modules that import nothing from React.

Every file under `src/ciphers/` must run in a unit test or a Node script with no DOM.

Two exceptions are permitted:

1. A cipher's own `visualize` component.
2. The `import type` of `ComponentType` in `types.ts`. The compiler erases it.

If a `useState` appears beside an algorithm, the design is wrong.

One consequence matters. A cipher's `index.ts` imports its visualizer. Therefore `index.ts`
is not React-free. The algorithm file is React-free. Put the testable logic there.

## Architecture

Read `src/ciphers/types.ts` first. It is the whole contract. The UI reads nothing else.

**No component may branch on the `slug` or the `name` of a cipher.** If the UI must know a
fact about a cipher, put that fact in `CipherModule`.

`family` is `'encoding' | 'classical' | 'symmetric' | 'hashing' | 'asymmetric'`.

**The `'encoding'` family exists for Morse and has one member.** This is deliberate. The
Classical family description says that every classical cipher is broken. Morse is not broken,
because Morse never tried to be secret. A family of one, clearly labelled, states this better
than a footnote. Encoding mistaken for encryption is the most common error in the subject.

### Discovery

`src/ciphers/registry.ts` collects every `./**/index.ts` with `import.meta.glob`.

To add a cipher, **create one folder**. Do nothing else. There is no central list. There is
no route to register. There is no UI to touch. If you are editing `registry.ts` to add a
cipher, stop.

**The folder tree is the curriculum.** A cipher lives at `<family>/<group>/<slug>/`. The
catalogue reads the sub-heading from the middle segment. Therefore
`classical/substitution/caesar` appears under Substitution and declares nothing.

`GROUPS` in `registry.ts` is an ordered list of groups with their headings. To add a cipher
to an existing group, edit nothing. To invent a new group, add one line. That line is a
decision about the whole catalogue, not a fact about one cipher. Therefore it lives centrally.

In development, and therefore in tests, the registry validates at module load. It throws with
*all* violations at once. It checks that:

- Slugs are unique, lowercase, and kebab-case.
- **The folder name equals the slug.** The catalogue reads the path, so a mismatch is a trap.
- **The group of the folder is in `GROUPS`.** Otherwise the entry sorts last with no heading.
- `tiers` is not empty and contains `'encrypt'`.
- Every declared tier has its implementation. `'attack'` needs `attack()`. `'visualize'` needs
  `visualize`.
- `ParamSpec.name` is unique in each cipher.
- Number defaults are in range. Select defaults are among the options.
- **Every `explainer` contains a "How this breaks" section.** Code enforces this, not
  convention.

### Shared code

| Module | Holds |
| --- | --- |
| `src/lib/chronology.ts` | Turns the free-text `year` into a sort key for the timeline. |
| `src/lib/letters.ts` | Alphabet plumbing: `letterIndex`, `letterFromIndex`, `normalise`, `lettersOnly`, `describeChar`. |
| `src/lib/polybius.ts` | The keyed 5×5 and 6×6 squares. |
| `src/lib/bytes.ts` | Byte and hex conversion: `utf8Bytes`, `bytesToHex`, `hexToBytes`, `xorBytes`. |
| `src/lib/analysis.ts` | `indexOfCoincidence`, `topNgrams`, `observe`. |
| `src/lib/bigrams.ts` | Adjacent-pair scoring for transposition attacks. |

The first eleven ciphers each carry their own copies of the letter helpers. This was
acceptable at two ciphers and silly at eleven. They keep their copies. Rewriting a working,
tested algorithm to save nine lines is churn. **New ciphers import from `lib/`.**

Cross-cipher imports are allowed. Sometimes they are the point. Beaufort and Porta import
`candidateKeyLengths` from `polyalphabetic/vigenere/attack`. ADFGVX imports `columnarOrder`
from `transposition/columnar/columnar`. In both cases the import *is* the argument. If a
cipher falls to the same code, the change bought no security.

### Metadata, presets and randomisation

Three fields on `CipherModule` are required, and the registry enforces them. A UI that must
cope with a missing field ends up branching on a slug.

**`security`** is one of `not-encryption | broken | deprecated | secure | perfect`. It is
deliberately not a scale. Morse and the one-time pad sit at opposite ends of a *different*
axis from broken → deprecated → secure. A star rating would make Morse look like a weak
cipher. A test holds the promise of the Classical family: every member is broken, and the pad
is the stated exception.

**`difficulty`** is `beginner | intermediate | advanced`. It is orthogonal to `security`.

**`examples`** is at least one worked starting point. Each example holds a message and a
partial key, which is merged over the defaults. Validation checks that an example names only
params that the cipher has. `registry.test.ts` *runs* every example. An example that exists
to fail sets `demonstratesError: true`. The singular matrix of Hill teaches the determinant
condition better than the explainer does.

**No rating is colour-coded.** Orange means "look here". A red-and-green scale would claim
that the badge is the most urgent thing on the page. It is not. The "How this breaks" section
is.

`CipherFacts` renders all of this metadata. `searchCiphers` matches names, family and group
labels, key types, and `keywords`. Therefore "rotor" finds Enigma, and Enigma declares no such
word. Every term must match. A typo returns nothing, rather than returning the wrong cipher
with confidence.

**Randomisation lives in `src/ciphers/params.ts`, which is React-free.** Tests and the
registry can therefore use it.

- A number param randomises from its own range.
- A select param randomises from its own options.
- **A text param cannot randomise by default.** A Vigenère keyword and an AES key are both
  strings. A text param opts in with `randomise: { alphabet, length }`.
- Where params are valid only *together*, the cipher owns the whole job through `randomKey()`.
  Examples: the determinant of Hill, the two distinct primes of RSA, the four bounds of
  Diffie-Hellman, the three different rotors of Enigma.

`params.test.ts` randomises every cipher five times and runs it. That test caught all four of
those cases.

### Pages that are not a cipher

`/analyse` is cryptanalysis before you know what you hold. `src/lib/analysis.ts` is React-free
and tested. **`observe` returns observations, never a verdict.** Each observation is a claim
paired with the measurement that produced it. A page that printed "this is Vigenère" would
teach that identification is a button. It would also be wrong often enough to matter.

Three more pages read the registry and add no field to the contract. That was the test they
had to pass. A page that needed a cipher to declare something for it would be the wrong page.

**`/timeline`** is the catalogue by date. `src/lib/chronology.ts` is React-free and tested. It
parses the free-text `year` into a sort key. `parseYear` negates BC. It sorts `'1500s'` from
1500. It returns **`null` rather than a guess** for `'ancient'`. Therefore Affine sits in a
"no date at all" section, and no century is invented for it. `ERAS` is deliberately uneven.
Two thousand years of substitution is one heading. The years since 1970 are three headings.
That is where the ideas are.

**`/compare`** puts all thirty-two rows of metadata on one sortable, filterable table. It
exists for the questions that live only *between* ciphers. It is the reason that `security`,
`difficulty` and `keyType` became required fields. **No column is colour-coded**, for the same
reason that no badge is. The "Breakable here" column states whether *this app* ships an
attack. The note under the table states plainly that several "No" rows are thoroughly broken
in the literature, and that gap 6 alone blocks them.

**`/playground`** runs one message through two ciphers at once. Each side is an ordinary
`useCipherRun`. Therefore async ciphers and thrown param errors behave exactly as they do on a
cipher page. **Both sides encrypt.** A decrypt on one side and an encrypt on the other is two
unrelated runs that share a text box, and the comparison it invites is false. Switching cipher
resets the params of that side. An AES key in a Caesar shift is a confusing error, not an
interesting one.

`CommandPalette` (Ctrl/Cmd+K, mounted in `Layout`) reaches any page from anywhere. It matches
through `searchCiphers`. It therefore inherits the rules of the catalogue, instead of becoming
a second search engine to keep honest. The five non-cipher pages are a literal list inside it,
because there is no registry to read. Past a handful, that list wants the treatment the
ciphers got.

### Scrolling on navigation

`ScrollToTop` in `Layout` is **required**. `<ScrollRestoration />` is not a substitute. That
component is for data routers with a browser history. A hash change never moves the scroll
position on its own. Without `ScrollToTop`, opening a cipher from halfway down the catalogue
lands the reader halfway down the cipher page. That reads as a broken page, not as a preserved
position.

The split is on navigation type, not on route:

- **push** means a link was clicked. Go to the top. Following a link asks for a new page.
- **pop** means Back or Forward. Restore where that entry was left. Losing your place in the
  catalogue is the same bug in the other direction.

Positions are keyed by `location.key` in `sessionStorage`. Every read and every write is
wrapped in `try`/`catch`. Blocked storage is not worth an exception over a scroll offset.

### Tiers drive the UI

`CipherWorkbench` renders one tab for each entry in `cipher.tiers`. A cipher that omits
`'attack'` has **no** attack tab. It does not have a disabled one. This is how breadth of
ciphers stays compatible with depth where depth teaches something.

**Most ciphers omit `'attack'`. The reason is always in the explainer.** A missing tab is
documented, not merely absent. The reasons group into six kinds.

An earlier version of this file claimed that no two reasons were alike. That stopped being
true at twenty ciphers. Pretending otherwise would mean inventing differences.

**1. The search is real, but out of scope.** It is a hill-climbing program, not a button.

| Cipher | Reason |
| --- | --- |
| Playfair | 25! key squares. The interesting part is the search, not the cipher. |
| Four-square | Two keyed squares. The same wall, twice. |
| Bifid, Trifid | The square *and* the period, and each hides the other. With the wrong period, a correct square scores like a random one. In practice you solve period first, with a program. |

**2. No search can exist, or there is nothing to search.**

| Cipher | Reason |
| --- | --- |
| One-Time Pad | Information-theoretically secure. The tab would be a machine that provably cannot work. |
| Atbash | The key space has exactly one member. To attack it, press Encrypt. |
| ROT13 | Applying the cipher to the ciphertext *is* the decryption. The same tab twice. |
| Bacon | No key at all. The protection is concealment. To break it you *notice*; you do not compute. |
| Morse | Nothing is hidden. It is not encryption. |

**3. `attack(ciphertext)` cannot express the real attack.** This is contract gap 6, hit four
times.

| Cipher | What the attack needs and cannot be given |
| --- | --- |
| Hill | A **crib**. Four matching letters give four equations. A ciphertext-only brute force would fit the signature and lie, because it teaches exhaustion where the cause is linearity. |
| Enigma | A **crib**, slid along the ciphertext against the rule that no letter is ever itself. |
| ADFGVX | **Several messages in depth.** Painvin needed a stack of same-length intercepts from one day. The signature gives exactly one. |
| RSA, Diffie-Hellman | The **public key**, which is a param and not a ciphertext. Both put their break on the Visualize tab, which does receive params. |

**4. Breaking it is the frequency analysis that the Caesar page already shows.**

| Cipher | Reason |
| --- | --- |
| Nihilist | The real attack infers from the unreduced sums over a decent volume. That is a chain of reasoning, not a loop. The leak itself is on Visualize. |
| Straddling Checkerboard | On its own it is a code. Count the digits and it falls. It was only ever the first stage of something larger. |

**5. It works.** This kind arrived with the modern section. It is the most important row in
the table.

| Cipher | Reason |
| --- | --- |
| AES, ChaCha20 | No known practical attack. A button that suggested otherwise would be the most misleading thing in this app. |
| DES | Broken by brute force over 2⁵⁶. That is a real, successful, historically important attack, and it is hardware and money rather than a button. The design held. The key was too short. |

**6. The attack is real, published, and takes no ciphertext.** This kind arrived with the
hashing family. It is the sharpest illustration of gap 6. These are not ciphers that resisted.
These are ciphers whose break the *signature* cannot express.

| Cipher | What the attack needs and cannot be given |
| --- | --- |
| MD5 | Two inputs that agree. A collision search takes no ciphertext and returns no plaintext. Its break is on **Visualize**: two published messages, six differing bytes, one digest. |
| SHA-1 | The same, and worse to embed. The published collision is two 400-kilobyte PDFs. Visualize teaches what a reader can check instead: SHA-0 against SHA-1, one rotation apart. |
| SHA-256, SHA-512 | Nothing to attack. No known practical break. A button that suggested otherwise would be the most misleading thing in the app. |
| PBKDF2 | Not broken. Outclassed. The attack is a GPU farm and a password list, which is money and a wordlist rather than a function. |

Do not add a token attack to "complete" a cipher.

### State flow

`CipherWorkbench` owns `input`, `params`, `direction` and `activeIndex`. It calls
`useCipherRun` once. That single `RunState` feeds `EncryptPanel`, `VisualizePanel` and
`BenchmarkPanel`.

`AttackPanel` is deliberately independent. It holds its own ciphertext. That ciphertext is
seeded from the last encrypt output. The panel writes back only through `onUseKey`.

`useCipherRun` handles sync and async ciphers on one path. It shows a running state **only**
for promises, because a same-tick cipher must not flash a spinner. It guards against stale
responses with a `cancelled` flag.

`ParamControls` lives in the workbench, above the tab strip. It does not live inside
`EncryptPanel`. Visualize and Benchmark need the same values, and the attack loop needs the
shift to be visible from the Attack tab.

`CipherPage` passes `key={cipher.slug}` to the workbench. Therefore no state survives a change
of cipher.

`activeIndex` travels as a `Dispatch<SetStateAction<number | null>>`, not as a plain callback.
The Previous and Next controls of `StepTrace` step *relative* to the current value. A plain
callback reads a stale prop as soon as two clicks land in one tick, which is what holding
Enter on the button does.

### Step.data

`Step.data` is a free-form `Record<string, unknown>`. It is the **only** channel from an
algorithm to its visualizer. Read it defensively with `typeof` guards. See `readMapping` in
`CaesarRings.tsx`. Nothing else in the app may read it.

### Attacks own their statistic

`chiSquaredEnglish` counts letters and breaks substitutions. It is **worthless against a
transposition**. Rail Fence never replaces a letter, so every candidate decryption has
identical letter counts and scores identically. `src/lib/bigrams.ts` counts adjacent *pairs*
instead, because a transposition destroys adjacency.

The rule that follows: **the right statistic depends on what the cipher destroys.** A new
attack picks its own statistic. It names that statistic in `CipherModule.attackScoreLabel`,
for example `'chi-squared'` or `'bigram fit'`. `AttackPanel` used to print "chi-squared"
beside every score, which was true until it was not. `AttackCandidate.score` stays
lower-is-better across the app. A higher-is-better statistic is negated at the boundary, and
the panel then needs to know nothing.

Both transpositions use bigrams. Rail Fence tries nine rail counts. Columnar tries every
column order up to `MAX_ATTACK_WIDTH`, which is seven, or 5040 orders. The search of Columnar
is capped and **says so in the explainer**. A tool that returns nothing without explaining why
teaches that the cipher resisted, when in fact the search gave up. Autokey is capped the same
way, at `MAX_KEYWORD` = 3. That is 26³ = 17,576 trials, which is instant. Four letters is
457,000 trials, which freezes the page.

**Chi-squared also overfits. That is a second reason to reach for bigrams.** This was found
while building the Beaufort attack. The true four-letter key NAVY scored 47.5 on the test
paragraph. A *wrong* sixteen-letter key scored 28.7. More key letters means more freedom to
bend the letter counts towards English while producing text that is not English. Counting
adjacent pairs does not overfit in that way.

Therefore the three new polyalphabetic attacks use two statistics for two different questions:

1. Solve each **column** by chi-squared. A column has no word structure, so pairs are
   meaningless there.
2. Rank whole **candidates** by bigram fit.

**The Vigenère attack still ranks by chi-squared and has the same latent problem.** It passes
its tests and has not been touched. This is recorded here rather than changed in silence. Fix
it if its ranking is ever seen to misbehave.

Autokey scores only the first `SCORE_PREFIX` characters of each trial decryption, which is
160. This is not a cut corner. A wrong autokey guess poisons the keystream at the first letter
and never recovers. Therefore the opening decides every candidate, and the search stays bounded
by the key space rather than by message length.

The bigram weights are approximate. The file labels them as such. Use them to rank a handful
of candidates against each other. Do not cite them.

## Design constraints

Functionality over beauty. The screen should explain the algorithm, not decorate it.

- Colours are semantic tokens in `src/index.css`: `--color-ink`, `--color-canvas`,
  `--color-line`, and others. **Never hardcode a hex value or a Tailwind palette class in a
  component.** A dark theme must stay a change to one file. The palette is the warm
  cream-and-orange system shared with the other site of the owner.
- **Orange means "look here" and nothing else.** It is never a button, a link, or decoration.
  It comes in five steps. The split is contrast, not taste. To pick the wrong one is an
  accessibility bug, not a style preference.

  | Token | Hex | On canvas | Use for |
  | --- | --- | --- | --- |
  | `--color-marker` | `#f97316` | 2.6:1 | Fills and `accent-color` only. Never a lone signal. |
  | `--color-marker-line` | `#c2500f` | 4.5:1 | Strokes, borders, underlines (WCAG 1.4.11). |
  | `--color-marker-ink` | `#96410a` | 6.5:1 | Orange **text** (WCAG 1.4.3). |
  | `--color-marker-mid` | `#fed7aa` | — | A soft border on a tinted surface. |
  | `--color-marker-wash` | `#fff0e6` | — | The tinted surface itself. |

  A highlighted character is near-black on `marker-wash` with a `marker-line` underline.
  Therefore colour is never the only signal.
- **Body prose uses `.cl-prose`**: full width, `text-align: justify`, `hyphens: auto`.
  Justifying is a deliberate house choice against the usual advice. `hyphens: auto` is what
  stops it from opening rivers of whitespace. Drop one and you must drop both. Do not cap
  prose with `max-w-prose`. Sections use the full column.
- Use monospace for ciphertext, keys, hex and step details. Use sans for prose.
- Use native elements with real `<label>`s. Do not build a div button. Every control must be
  keyboard-operable. Nothing may be smaller than 24×24 CSS px. The page must not scroll
  horizontally at 320 px.
- **A fixed-width SVG scrolls. It does not shrink.** `max-w-full` on a diagram with a fixed
  column count scales the whole diagram down. At 320 px, the letters of the Affine mapping
  rendered at 5 px, and the Rail Fence characters did the same. Give the SVG its real `width`
  and `block shrink-0`. Let the `overflow-x-auto` card around it scroll. The page still must
  not scroll horizontally.
- A native checkbox renders at about 13 px. Anything interactive needs an explicit `h-6 w-6`,
  or a `min-h-6` wrapper, to clear the 24 px floor.
- `src/components/textPane.ts` holds the metrics that the input and output panes share. The
  two panes must stay the same size. `HighlightedTextarea` draws its text twice: a `<mark>`
  backdrop under a textarea with transparent glyphs. Both layers must wrap identically, or the
  highlight lands on the wrong character. **Never style one layer alone, and never style one
  pane alone.**
- **Use `wrap-anywhere` on a pane, not `break-words`.** `overflow-wrap: break-word` breaks a
  long word only when it has nowhere else to go, and it does *not* count towards min-content
  width. Therefore a 96-character hex ciphertext with no spaces (AES, DES, ChaCha20,
  Diffie-Hellman) widened its grid track past the viewport and gave the whole page a
  horizontal scrollbar at 320 px. `overflow-wrap: anywhere` breaks the same runs *and* shrinks
  min-content, which is the actual fix. Unlike `break-all`, it leaves ordinary prose
  unhyphenated.
- **Explainers may use four-space-indented blocks and `*italic*`.** `Markdown.tsx` renders
  both. It did not do so until late. Therefore the diagrams of Hill and Enigma had been folding
  into one long paragraph, and their italics had been printing as literal asterisks. Alignment
  is the whole point of a diagram. Check the diagrams of a new explainer on the page. Do not
  trust the source.

## The safety notice

`SafetyNotice` renders once, small, in the site footer. It used to repeat on every cipher page
and under every panel. That read as alarm rather than as information, and people stop seeing a
warning that shouts on every screen. Do not scatter it again.

The **"How this breaks"** section carries the honesty work. The registry requires it of every
explainer.

## Routing and deployment

`createHashRouter` is **mandatory**. GitHub Pages has no server rewrite, so a browser router
404s on refresh at any sub-path.

`vite.config.ts` sets `base` to `REPO_BASE`, which is `/crypto-site/`, for production only.
**Change that constant if the repository is renamed.** Otherwise the built site requests its
assets from a path that does not exist.

`.github/workflows/deploy.yml` builds on every push to `main`: `npm ci` → `npm test` →
`npm run build` → upload `dist` → deploy. Tests gate the deploy on purpose.

One setting must be changed by hand: **Settings → Pages → Source = GitHub Actions**. The
default is "deploy from a branch", and the workflow does nothing until it is switched.

## Dependencies

The dependency list is deliberately minimal: React, react-router-dom, Tailwind, Vite, Vitest,
TypeScript.

**Ask before you add** a state-management, component, animation, math or markdown library.
`Markdown.tsx` is a renderer of about 70 lines. It covers exactly what the explainers use. It
builds React elements. It does not touch `dangerouslySetInnerHTML`.

**Every cipher here is hand-written, including the modern ones.** An earlier version of this
file said that modern ciphers would use browser-native WebCrypto. That turned out to be
incompatible with the point of the app. `crypto.subtle.encrypt` returns a ciphertext and
nothing else. It cannot show a round, a state matrix or a key schedule, and the middle of the
algorithm is the entire reason these pages exist. Therefore AES, DES and ChaCha20 are written
out in full.

The safeguard is **cross-checking, not trust**:

- `aes.test.ts` checks AES against `crypto.subtle` AES-CBC, block for block.
- AES, DES and ChaCha20 are checked against their published test vectors: FIPS-197, the
  classic DES vector, and RFC 8439 §2.1.1 and §2.3.2.

Every one of those files carries a **"do not use this for anything real"** warning in its
header and in its explainer, and states why. The table lookups are not constant-time.
Therefore a real attacker who measures cache timing could recover the key. That is not
hypothetical. It is the honest cost of writing crypto for legibility.

RSA and Diffie-Hellman use BigInt directly. There is no math library.

## Known gaps in the contract

Read this section before you extend `types.ts`. Gaps 2, 4 and 8 are fixed. The rest are open.
Gaps 3 and 6 became more pressing when the modern ciphers landed.

**1. `visualize` gets no active-step index.** Its props are `{ steps, params }`. Therefore each
visualizer builds its own scrubber. This is harmless only because Visualize and Encrypt are
different tabs. Fix: add `activeIndex` and `onActiveIndexChange`.

**2. ~~Benchmark can only measure the traced path.~~ Fixed.**
`CipherModule.benchmark?(input, p)` returns the output and allocates no `Step`.
`BenchmarkPanel` runs it when it exists and falls back to `encrypt` when it does not.
Therefore this landed without touching twenty-eight modules. The panel *names which path it
timed*, either "untraced" or a step count, because a number that could secretly be either kind
is worse than no number. `registry.test.ts` runs both paths for every cipher that declares one
and asserts that they agree. Otherwise a fast path that ignored a param would time something
the app never shows anyone. Wired up so far: Caesar, AES, DES, ChaCha20, and all five hashes.
The rest still measure their trace, and say so on the page.

**3. `Params` cannot hold bytes.** A `bytes` spec declares `lengthBytes`, but the value travels
as `string | number`. Hex-in-a-string is the current convention, and nothing enforces it. This
is now exercised, and it holds up worse than hoped. AES, DES and ChaCha20 all take their key,
IV and nonce as hex strings in `text` params and validate them by hand. Therefore every one of
those modules carries its own `readKey` that throws its own error message. Nothing uses the
`bytes` kind. Fix: make `bytes` real. The workbench should render a hex field, validate length
centrally, and offer a "randomise" button.

**4. ~~`Step.highlight` is one range and does not say which text it indexes.~~ Fixed.**
`Step.outputHighlight` was added when Rail Fence landed. A transposition moves a character to a
different index, so one range cannot describe both panes. Substitution ciphers still set only
`highlight`, and `EncryptPanel` falls back to it. Therefore Caesar and Vigenère needed no
change.

**5. `tiers: ['benchmark']` is unverifiable**, because every cipher has `encrypt`. The fix for
gap 2 did *not* resolve this, contrary to what this line used to predict. `benchmark` is
optional and falls back. Therefore declaring the tier still promises nothing the registry can
check.

**6. `attack(ciphertext)` is too narrow.** Four ciphers have now hit this gap from three
directions. Hill and Enigma need a **crib**. ADFGVX needs **several messages in depth**. RSA
and Diffie-Hellman need the **public key**, which is a param. Every one of those ships without
an Attack tab because of the signature, not because of the cipher.

RSA and Diffie-Hellman found a workaround worth noting. Their break lives on the **Visualize**
tab, which *does* receive `params`. That is arguably the better home anyway, because both are
attacks on a *key* rather than on a message.

Fix, now clearly worth one:
`attack(input: { ciphertext: string; params: Params; crib?: string })`, with `CipherModule`
declaring what it needs so that the panel can ask. This is the most-hit gap in the contract.

**7. `ParamSpec` cannot group related params.** *Partly worked around.* A cipher whose params
are valid only **together** now declares `randomKey(): Params` and generates them itself:
the determinant of Hill, the two distinct primes of RSA, the four bounds of Diffie-Hellman,
the three different rotors of Enigma. That fixes generation, not rendering. The boxes still
read badly. The key of Hill is a 2×2 matrix and arrives as four unrelated `number` boxes,
because there is no way to say "these four belong together". The workbench renders them
correctly and reads badly. A component that special-cased Hill would break the
no-branching-on-slug rule. Therefore the boxes stay until the contract can express a group.
The seven params of Enigma and the four of Diffie-Hellman have the same problem, less acutely.

**8. ~~`CipherModule` cannot describe a primitive that is not a cipher.~~ Fixed, for hashing.**
`oneWay: true` means the module has no `decrypt`. The registry refuses both errors: a `oneWay`
module that has a `decrypt`, and a cipher that lacks one. `EncryptPanel` renders no direction
control, no swap and no round trip. SHA-256 was written against this field. The half of this
gap that belongs to Diffie-Hellman is still open, and gap 9 records it.

**9. Diffie-Hellman produces a key, not a ciphertext.** The contract signature
`encrypt(input, params) -> TraceResult` has nowhere to put a key. The page copes: it derives
the shared secret, then uses that secret to encipher the message with a deliberately trivial
keystream. Both the code and the explainer label that keystream as a stand-in. The alternative
was an empty Encrypt tab. `oneWay` does not help here. The problem is not that the output
cannot be reversed. The problem is that the output is not a message at all.

## Roadmap and scope discipline

**Thirty-two entries ship, in five families.** The folder tree is the curriculum. This table is
what is in it.

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

**The hashing family is complete as planned.** Gap 8 was settled first, as this file said it
should be. SHA-256 was then written against the result: `oneWay: true`, no `decrypt`, no
direction control, and an avalanche visualizer that counts the bits rather than asserting the
number. The other four followed.

| Cipher | What is worth knowing |
| --- | --- |
| MD5 | Its Visualize tab is the 2004 collision of Wang and Yu: two 128-byte messages, six differing bytes, the same 128 bits. Nothing is asserted. This app's own MD5 computes both digests from the bytes on screen, and the test checks that the collision reproduces. Therefore a transcription error fails the build instead of shipping a page that demonstrates nothing. A suffix box shows that appending the *same* text to both keeps them colliding, which is how a collision becomes two documents rather than two blobs. |
| SHA-1 | `expandRotate` is a parameter rather than a constant. Therefore the module computes **SHA-0 and SHA-1 from the same code**. The whole difference between the 1993 publication and its withdrawn replacement is one `rotate left 1` in the message schedule. That is the Visualize tab. |
| SHA-512 | Its eighty constants are **derived, not pasted**: exact BigInt integer roots of the first eighty primes. Therefore the nothing-up-my-sleeve claim is ten lines a reader can check, rather than eighty hex literals a reader must trust. The test pins the first and the last against FIPS 180-4, in case the derivation is the thing that is wrong. Its Visualize tab is also the honest answer to "is bigger better": it puts all four hashes on one table and says the difference between SHA-256 and SHA-512 is CPU width, not security. |
| PBKDF2 | The first module whose point is to be *slow*. Therefore it is the first where Benchmark measures what the algorithm is **for**, which is why gap 2 was fixed before this folder existed. It is built on `sha-256/sha256.ts` rather than on a second copy, because PBKDF2 *is* HMAC repeated and HMAC *is* SHA-256 twice. Its trace collapses the identical middle iterations into one step that **counts** them, rather than hiding them. |

Two things about testing this family are worth recording:

1. `crypto.subtle` has **no MD5 at all**. The platform will not hand you a broken hash.
   Therefore MD5 leans on published vectors chosen to span every padding case, plus the
   collision. The collision is the strongest cross-check available, because a wrong
   implementation would not reproduce it.
2. The widely-copied RFC 6070 PBKDF2 vectors are for HMAC-**SHA-1**. This module is
   HMAC-SHA-256, so using them would have been quietly wrong. It is checked against the
   PBKDF2 of `crypto.subtle` instead, at several iteration counts and several output lengths,
   including one long enough to need a second block.

`visualizeNote` was added while building this family. `VisualizePanel` opened with "this is the
same run as the Encrypt tab, drawn rather than listed". That is true of every visualizer that
draws a trace, and false of the ones that carry a break. The collision of MD5 has nothing to do
with the message in the box. A component cannot work that out, and branching on the slug to fix
it is the rule the contract exists to prevent. Therefore the cipher says it.

Not built, and not planned: **Argon2, scrypt and bcrypt**, which the PBKDF2 explainer names as
the things to use instead. To add them would be the right cryptographic advice and the wrong
page. Their whole mechanism is memory-hardness, which has nothing to show in a step trace.

Beyond hashing, if it is ever wanted: MACs and HMAC, digital signatures (ECDSA), elliptic
curves proper, and post-quantum. None of these are ciphers either, and all of them run into
gap 8.

**Do not add more classical ciphers.** The family has enough breadth to make every point it
makes. Another would be a cryptographic graveyard rather than a curriculum.

Held back, and available if wanted: a family tree, CTF challenges, an "identify this cipher"
quiz, share-by-URL state, import and export, favourites and progress, and an encoding lab with
a byte inspector. The challenges are the largest of these, and the only one that needs new
infrastructure rather than new pages.

**Working agreement:**

- Stop and summarise after each phase. Do not chain phases unprompted.
- Ship every cipher module with its tests in the same commit.
- If a spec decision turns out wrong in the code, say so and propose the alternative. Do not
  work around it in silence. This file records three such corrections: the WebCrypto plan under
  Dependencies, the "no two reasons alike" claim under Tiers, and the overfitting of chi-squared
  under Attacks. Recording them is the point.

## Rulebooks

`rulebooks/` holds three portable principle references — UI-UX, Security, Engineering — plus a
`README.md` with a routing table. The table says which rulebook to read for a given kind of
change.

The rulebooks are **token-expensive**, at about 5,000 to 7,000 tokens each, and they are read
in full when loaded. Consult the routing table. Load only the rulebook that the change needs.
Do not paste their contents into this file.
