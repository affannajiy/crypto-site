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
  | { kind: 'text'; name: string; label: string; default: string; placeholder?: string }
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

export interface CipherModule {
  /** URL-safe and unique across the registry: 'caesar'. */
  slug: string;
  name: string;
  family: 'encoding' | 'classical' | 'symmetric' | 'hashing' | 'asymmetric';
  /** Shown in the catalogue: '~50 BC', '1977'. */
  year?: string;
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
  /** True for WebCrypto-backed ciphers, so the UI knows to expect a promise. */
  isAsync?: boolean;

  encrypt(input: string, p: Params): TraceResult | Promise<TraceResult>;
  decrypt(input: string, p: Params): TraceResult | Promise<TraceResult>;

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
  /** Required when `tiers` includes 'visualize'. The registry enforces this. */
  visualize?: ComponentType<{ steps: Step[]; params: Params }>;
}
