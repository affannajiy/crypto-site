/**
 * The Cipher contract.
 *
 * Read this file first. Every algorithm in the app implements `CipherModule`, and
 * the user interface reads nothing else. No component anywhere may branch on a
 * cipher's `slug` or `name` — if the UI needs to know something, it belongs here.
 *
 * The `import type` below is erased at compile time, so this module has no runtime
 * dependency on React. Neither does any algorithm file. That is deliberate: a
 * cipher must be runnable from a plain Node script or a unit test with no DOM.
 */
import type { ComponentType } from 'react';

/**
 * The panels a cipher can offer. `tiers` decides which tabs the workbench renders,
 * so a cipher that teaches nothing by being attacked simply omits `'attack'` and
 * the tab does not exist. There are no disabled tabs in this app.
 */
export type Tier = 'encrypt' | 'attack' | 'visualize' | 'benchmark';

/**
 * A parameter the user can set — a shift, a key, a mode. The workbench builds a
 * labelled form control from each of these, so a new cipher needs no UI code.
 */
export type ParamSpec =
  | { kind: 'number'; name: string; label: string; min: number; max: number; default: number }
  | {
      kind: 'text';
      name: string;
      label: string;
      default: string;
      placeholder?: string;
      /**
       * How to invent a value for this param, if it can be invented at all.
       *
       * A number param can always be randomised from its own range and a select
       * from its own options, so neither needs to declare anything. Text cannot:
       * a Vigenere keyword and an AES key are both strings, and generating one
       * where the other was wanted produces an error rather than a demo. So the
       * cipher says what shape its key is, and the workbench needs no special
       * case for any of them.
       */
      randomise?: { alphabet: 'letters' | 'hex'; length: number };
    }
  | {
      kind: 'select';
      name: string;
      label: string;
      options: { value: string; label: string }[];
      default: string;
    }
  | { kind: 'bytes'; name: string; label: string; lengthBytes: number };

/** Current values for a cipher's parameters, keyed by `ParamSpec.name`. */
export type Params = Record<string, string | number>;

/** A half-open span of a text, as [start, end). */
export interface Range {
  start: number;
  end: number;
}

/** One human-readable step in the algorithm. The whole point of the app. */
export interface Step {
  index: number;
  /** Short and scannable: "Shift 'H' by 3". */
  title: string;
  /** The arithmetic, spelled out: "H (index 7) + 3 = 10 -> K". */
  detail: string;
  input?: string;
  output?: string;
  /** Range in the **input** text to emphasise. */
  highlight?: Range;
  /**
   * Range in the **output** text, for ciphers that move characters around.
   *
   * Substitution ciphers leave this unset: a character that is replaced in place
   * sits at the same index in both texts, so one range describes both. A
   * transposition cipher does not have that luxury — Rail Fence takes the
   * character at input index 3 and writes it at output index 9 — and without
   * this the output pane would confidently highlight the wrong character.
   *
   * The UI falls back to `highlight` when this is absent.
   */
  outputHighlight?: Range;
  /** Free-form, for the visualizer. Only that cipher's own visualizer reads it. */
  data?: Record<string, unknown>;
}

/** What every `encrypt` and `decrypt` returns: the answer, and how it got there. */
export interface TraceResult {
  output: string;
  steps: Step[];
}

/** One guess produced by an attack, ready to be ranked and shown to the user. */
export interface AttackCandidate {
  key: Params;
  plaintext: string;
  /** Lower is a better fit to English. The scale is the attack's own business. */
  score: number;
  label: string;
}

/**
 * How much this algorithm is worth trusting, in one word.
 *
 * This is a fact about the algorithm, not about the page that shows it, so it
 * lives on the module and the UI branches on it rather than on a slug. The five
 * values are deliberately not a scale: `not-encryption` and `perfect` sit at
 * opposite ends of a different axis from `broken` -> `deprecated` -> `secure`,
 * and collapsing them into stars would have made Morse look like a weak cipher
 * and the one-time pad look like a strong one. Neither is true.
 */
export type Security =
  /** Never tried to be secret. Morse. */
  | 'not-encryption'
  /** Falls to an attack a person can run. Every classical cipher here. */
  | 'broken'
  /** The design held; something around it did not. DES and its 56-bit key. */
  | 'deprecated'
  /** No known practical attack. AES, ChaCha20, RSA, Diffie-Hellman. */
  | 'secure'
  /** Proved unbreakable, and almost unusable. The one-time pad, alone. */
  | 'perfect';

/**
 * Where a cipher sits on the learning path. Orthogonal to `Security`: ROT13 is
 * `beginner` and `broken`, AES is `advanced` and `secure`, Enigma is `advanced`
 * and `broken`.
 */
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * A worked starting point: a message, and the key that goes with it.
 *
 * Presets exist because the hardest part of a cipher page is the blank form.
 * `params` is partial on purpose — an example that only wants to change the
 * shift says so, and everything else stays at its default.
 */
export interface CipherExample {
  /** Short, and says what is interesting about it: 'The classic shift of three'. */
  label: string;
  input: string;
  params?: Params;
  /**
   * True when the point of this example is the error it raises.
   *
   * A key that cannot work is worth one click — Hill's singular matrix explains
   * why the determinant has to be coprime to 26 better than the explainer does.
   * Declaring it keeps that honest: the workbench labels the preset as failing
   * on purpose, and the test that runs every example knows not to call it a bug.
   */
  demonstratesError?: boolean;
}

export interface CipherModule {
  /** URL-safe and unique across the registry: 'caesar'. */
  slug: string;
  name: string;
  family: 'encoding' | 'classical' | 'symmetric' | 'hashing' | 'asymmetric';
  /** Shown in the catalogue: '~50 BC', '1977'. */
  year?: string;
  /**
   * Who or what it came from: 'Julius Caesar', 'Blaise de Vigenere, 1553'.
   * Prose, not an identifier — nothing parses this.
   */
  origin?: string;
  /** What the key *is*, in a few words: 'An integer shift, 0-25'. */
  keyType?: string;
  /** How far this can be trusted. Required, and the registry enforces it. */
  security: Security;
  /** Where it sits on the learning path. Required. */
  difficulty: Difficulty;
  /**
   * Extra words the catalogue search should match, beyond name, blurb, family
   * and group — aliases and concepts a learner might type instead of the name:
   * 'rotor' should find Enigma, 'public key' should find RSA.
   */
  keywords?: string[];
  /** One sentence, plain language. */
  blurb: string;
  /**
   * Markdown. Must include a "How this breaks" section — see the project README.
   * A tool that only shows the happy path teaches people to be dangerous.
   */
  explainer: string;
  /** Which panels the workbench should render. No dead tabs. */
  tiers: Tier[];
  params: ParamSpec[];
  /**
   * Starting points offered above the message box. Optional in the type and
   * required in practice — the registry insists on at least one, because a
   * cipher with no worked example is a form the reader has to guess at.
   */
  examples?: CipherExample[];
  /** True for WebCrypto-backed ciphers, so the UI knows to expect a promise. */
  isAsync?: boolean;

  /**
   * A fresh key that this cipher will actually accept.
   *
   * Most ciphers need no such thing: a shift randomises from its own range, a
   * mode from its own options, and a keyword from the length its `ParamSpec`
   * declares. Some cannot, because their params are only valid *together* — the
   * four entries of Hill's matrix have to give a determinant coprime with 26,
   * and RSA's p and q have to be two different primes. There is no way to say
   * that one param at a time (see gap 7 in the project notes), so the cipher
   * that has the constraint is the thing that generates the key.
   *
   * Declared here, the workbench needs no special case: it calls this when it
   * exists and falls back to the per-param path when it does not.
   */
  randomKey?(): Params;

  /**
   * True for an algorithm that cannot be undone — a hash.
   *
   * This is gap 8 in the project notes, and it is settled here rather than by a
   * second module type. A hash is not a cipher: it has no key to recover, no
   * plaintext to return, and `decrypt` has nothing to compute. Modelling that as
   * a `decrypt` that throws would have put a Decrypt button on the page and made
   * the app say, once per click, that a digest can be reversed if you have the
   * right settings.
   *
   * So a one-way module omits `decrypt`, the registry insists that it does, and
   * the workbench renders no direction control. The direction control is the
   * only thing in the UI that ever assumed reversibility.
   */
  oneWay?: boolean;

  /**
   * The same algorithm with no trace allocated, for the Benchmark tab.
   *
   * This is gap 2 in the project notes, and it was the most worth fixing. Every
   * `encrypt` here builds a `Step` per character or per round, with a sentence of
   * English inside it, and that allocation dominates any measurement — so the
   * Benchmark tab was reporting how readable a file is rather than how fast an
   * algorithm is. DES was the clearest victim: it holds its state as 64 separate
   * bit values because that is legible, and it measured accordingly.
   *
   * Optional, and the panel falls back to `encrypt`, because a fallback is the
   * only thing that keeps this from being a flag day across twenty-eight modules.
   * The panel says which path it measured, so a number is never quietly the other
   * kind of number.
   */
  benchmark?(input: string, p: Params): string | Promise<string>;

  encrypt(input: string, p: Params): TraceResult | Promise<TraceResult>;
  /** Required unless `oneWay`. The registry enforces both halves of that. */
  decrypt?(input: string, p: Params): TraceResult | Promise<TraceResult>;

  /** Required when `tiers` includes 'attack'. The registry enforces this. */
  attack?(ciphertext: string): AttackCandidate[] | Promise<AttackCandidate[]>;
  /**
   * Names the statistic `attack` ranks by: 'chi-squared', 'bigram fit'.
   *
   * The panel used to print "chi-squared" beside every score, which was true
   * while every attack in the app counted letters and became a lie the moment one
   * did not. Which statistic a cipher's attack uses is a fact about that cipher,
   * so it lives here rather than in a component. Defaults to a plain "score".
   */
  attackScoreLabel?: string;
  /**
   * What the Visualize tab is showing, when it is not showing this run.
   *
   * The panel's default line — "the same run as the Encrypt tab, drawn rather
   * than listed" — is true of every visualizer that draws a trace, and false of
   * the ones that carry a cipher's break instead. MD5's tab shows a published
   * collision that has nothing to do with the message in the box, and RSA's and
   * Diffie-Hellman's attack a key rather than a run.
   *
   * A component cannot work this out, and branching on the slug to fix it is the
   * rule this contract exists to prevent, so the cipher says it.
   */
  visualizeNote?: string;
  /** Required when `tiers` includes 'visualize'. The registry enforces this. */
  visualize?: ComponentType<{ steps: Step[]; params: Params }>;
}
