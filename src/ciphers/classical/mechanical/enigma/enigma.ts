/**
 * The Enigma machine.
 *
 * Every other cipher in this app is a rule. This one is a *machine*, and the
 * difference matters: the key is not a number or a word but the physical state of
 * a device — which rotors are fitted, in which order, turned to which letters,
 * with which ring settings, and which pairs of plugs are patched on the front.
 *
 * The signal path, for one key press:
 *
 *     keyboard → plugboard → right rotor → middle → left → reflector
 *                          ← right ← middle ← left ←
 *              → plugboard → lamp
 *
 * Two properties fall out of that wiring, and the whole story of Bletchley Park
 * is contained in them.
 *
 * **It is its own inverse.** The reflector sends the current back through the
 * rotors by a different path, and the arrangement is symmetric: if A lights up Q
 * at some machine state, then at that same state Q lights up A. So there is one
 * procedure for encrypting and decrypting, and an operator needed no second mode.
 *
 * **No letter can ever encrypt to itself.** The reflector pairs the 26 contacts
 * with each other and none with itself, so the return path is always different
 * from the outward one. This sounds like a strength. It is the single most
 * valuable weakness in the history of cryptanalysis, and `neverItself` below
 * exists so a test can hold the implementation to it.
 *
 * The rotors turn on every key press, so the substitution changes every letter.
 * That is what makes it a poly-alphabetic cipher with a period of 16,900 rather
 * than the five or six letters of a Vigenère keyword.
 *
 * Historical accuracy, and one deliberate departure: the rotor wirings, notches
 * and reflectors below are the real Wehrmacht ones, and the stepping includes the
 * double-step anomaly. But a real Enigma had no space bar — operators sent X for a
 * space — whereas this passes spacing and punctuation through untouched and does
 * not advance the rotors for them, matching every other cipher in this app so the
 * output stays readable. That is a teaching choice, and it is noted in the
 * explainer rather than hidden.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export const ALPHABET_SIZE = 26;

const A = 'A'.charCodeAt(0);

export interface RotorSpec {
  name: string;
  wiring: string;
  /** The window letter at which this rotor's notch turns the one to its left. */
  notch: string;
}

/** The five Wehrmacht rotors, with their real wirings and turnover notches. */
export const ROTORS: readonly RotorSpec[] = [
  { name: 'I', wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  { name: 'II', wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  { name: 'III', wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
  { name: 'IV', wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
  { name: 'V', wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' },
];

/** The two reflectors in general service. Each is a perfect pairing of 26 contacts. */
export const REFLECTORS: readonly { name: string; wiring: string }[] = [
  { name: 'B', wiring: 'YRUHQSLDPXNGOKMIEBFZCWVJAT' },
  { name: 'C', wiring: 'FVPJIAOYEDRZXWGCTKUQSBNMHL' },
];

export function findRotor(name: string): RotorSpec {
  const rotor = ROTORS.find((r) => r.name === name);
  if (rotor === undefined) {
    throw new Error(`There is no rotor ${name}. This machine takes ${ROTORS.map((r) => r.name).join(', ')}.`);
  }
  return rotor;
}

export function findReflector(name: string): string {
  const reflector = REFLECTORS.find((r) => r.name === name);
  if (reflector === undefined) {
    throw new Error(`There is no reflector ${name}. This machine takes B or C.`);
  }
  return reflector.wiring;
}

/** 0-25 for A-Z or a-z, and -1 for everything else. */
export function letterIndex(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= A && code <= A + 25) return code - A;
  if (code >= A + 32 && code <= A + 57) return code - A - 32;
  return -1;
}

function isUpperCase(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= A && code <= A + 25;
}

function letter(index: number, upper = true): string {
  return String.fromCharCode((upper ? A : A + 32) + index);
}

function normalise(n: number): number {
  return ((n % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE;
}

/**
 * The plugboard, as a 26-entry permutation.
 *
 * Written as pairs — "AB CD" swaps A with B and C with D. Anything not named is
 * wired straight through. A letter may appear only once: the real board had
 * physical sockets, and a cable in two places at once is not a configuration, it
 * is a mistake, so this refuses rather than silently keeping the last one.
 */
export function parsePlugboard(text: string): number[] {
  const map = Array.from({ length: ALPHABET_SIZE }, (_, i) => i);
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '');
  if (letters.length % 2 !== 0) {
    throw new Error(
      `The plugboard has ${letters.length} letters, which cannot be paired up. Cables connect two sockets each, so write them in pairs: "AB CD EF".`,
    );
  }

  const used = new Set<string>();
  for (let i = 0; i < letters.length; i += 2) {
    const first = letters.charAt(i);
    const second = letters.charAt(i + 1);
    if (first === second) {
      throw new Error(`A cable cannot join ${first} to itself — both ends would be in one socket.`);
    }
    for (const char of [first, second]) {
      if (used.has(char)) {
        throw new Error(
          `${char} appears in more than one plugboard pair. Each letter has one socket, so it can take at most one cable.`,
        );
      }
      used.add(char);
    }
    map[letterIndex(first)] = letterIndex(second);
    map[letterIndex(second)] = letterIndex(first);
  }
  return map;
}

/** Three window letters, as in "AAA". Refuses anything else rather than guessing. */
export function parsePositions(text: string, label: string): [number, number, number] {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '');
  if (letters.length !== 3) {
    throw new Error(
      `${label} needs exactly three letters, one per rotor — for example AAA. This has ${letters.length}.`,
    );
  }
  return [letterIndex(letters.charAt(0)), letterIndex(letters.charAt(1)), letterIndex(letters.charAt(2))];
}

export interface Settings {
  /** Left, middle, right — the order they sit in the machine. */
  rotors: [string, string, string];
  reflector: string;
  /** Window letters, left to right. */
  positions: [number, number, number];
  /** Ring settings (Ringstellung), left to right. */
  rings: [number, number, number];
  plugboard: number[];
}

/** One pass through a rotor, right to left (towards the reflector). */
export function throughForward(wiring: string, position: number, ring: number, input: number): number {
  const shifted = normalise(input + position - ring);
  const wired = letterIndex(wiring.charAt(shifted));
  return normalise(wired - position + ring);
}

/** One pass through a rotor, left to right (coming back from the reflector). */
export function throughBackward(wiring: string, position: number, ring: number, input: number): number {
  const shifted = normalise(input + position - ring);
  const wired = wiring.indexOf(letter(shifted));
  return normalise(wired - position + ring);
}

/**
 * Advances the rotors for one key press, and returns the new window positions.
 *
 * This includes the **double-stepping anomaly**, which is not a bug in this code
 * but a quirk of the real machine's pawl-and-ratchet mechanism: when the middle
 * rotor is sitting on its own notch, it steps again on the next press *and* pushes
 * the left rotor round with it. The consequence is that the middle rotor
 * occasionally advances twice in two presses, and the machine's period is 26 × 25
 * × 26 = 16,900 rather than 26³. Reproducing it matters — a message encrypted on a
 * real Enigma will not decrypt on a simulator that gets this wrong.
 */
export function step(settings: Settings): [number, number, number] {
  const [left, middle, right] = settings.positions;
  const middleAtNotch = letter(middle) === findRotor(settings.rotors[1]).notch;
  const rightAtNotch = letter(right) === findRotor(settings.rotors[2]).notch;

  if (middleAtNotch) {
    // The double step: the middle rotor drives the left one and itself.
    return [normalise(left + 1), normalise(middle + 1), normalise(right + 1)];
  }
  if (rightAtNotch) {
    return [left, normalise(middle + 1), normalise(right + 1)];
  }
  return [left, middle, normalise(right + 1)];
}

/** Every stage the current passes through, in order. Recorded for the visualizer. */
export interface Path {
  /** The letter pressed. */
  pressed: number;
  plugIn: number;
  rightIn: number;
  middleIn: number;
  leftIn: number;
  reflected: number;
  leftBack: number;
  middleBack: number;
  rightBack: number;
  plugOut: number;
}

/**
 * Sends one letter through the machine at its current state. Does **not** step
 * the rotors — `enigmaTrace` does that first, because on a real Enigma the rotors
 * move as the key goes down, before the circuit closes.
 */
export function encipher(settings: Settings, input: number): Path {
  const left = findRotor(settings.rotors[0]);
  const middle = findRotor(settings.rotors[1]);
  const right = findRotor(settings.rotors[2]);
  const reflector = findReflector(settings.reflector);
  const [lp, mp, rp] = settings.positions;
  const [lr, mr, rr] = settings.rings;

  const plugIn = settings.plugboard[input] ?? input;
  const rightIn = throughForward(right.wiring, rp, rr, plugIn);
  const middleIn = throughForward(middle.wiring, mp, mr, rightIn);
  const leftIn = throughForward(left.wiring, lp, lr, middleIn);
  const reflected = letterIndex(reflector.charAt(leftIn));
  const leftBack = throughBackward(left.wiring, lp, lr, reflected);
  const middleBack = throughBackward(middle.wiring, mp, mr, leftBack);
  const rightBack = throughBackward(right.wiring, rp, rr, middleBack);
  const plugOut = settings.plugboard[rightBack] ?? rightBack;

  return {
    pressed: input,
    plugIn,
    rightIn,
    middleIn,
    leftIn,
    reflected,
    leftBack,
    middleBack,
    rightBack,
    plugOut,
  };
}

/**
 * The whole machine, untraced. Used by the benchmark.
 *
 * There is no `direction` argument, and that is not an omission. Enigma is its
 * own inverse: run the ciphertext through with the same settings and the
 * plaintext comes back.
 */
export function enigma(text: string, settings: Settings): string {
  let positions = settings.positions;
  let out = '';

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    if (index === -1) {
      out += char;
      continue;
    }
    positions = step({ ...settings, positions });
    out += letter(encipher({ ...settings, positions }, index).plugOut, isUpperCase(char));
  }
  return out;
}

/**
 * True when no letter enciphers to itself at the machine's current state.
 *
 * Exported so a test can assert it across many settings rather than trusting the
 * comment. This is the property the cribs at Bletchley Park depended on: a guessed
 * word could be slid along the ciphertext, and every position where a letter
 * matched itself was eliminated instantly.
 */
export function neverItself(settings: Settings): boolean {
  for (let i = 0; i < ALPHABET_SIZE; i += 1) {
    if (encipher(settings, i).plugOut === i) return false;
  }
  return true;
}

/** Names a character for a sentence a person reads. */
export function describeChar(char: string): string {
  switch (char) {
    case ' ':
      return 'the space';
    case '\n':
      return 'the line break';
    case '\t':
      return 'the tab';
    default:
      return `'${char}'`;
  }
}

/**
 * The machine again, emitting one `Step` per character — including the ones it
 * passes through, so a step's index is also its position in the text.
 */
export function enigmaTrace(text: string, settings: Settings): TraceResult {
  let positions = settings.positions;
  const steps: Step[] = [];
  let output = '';

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);

    if (index === -1) {
      output += char;
      steps.push({
        index: i,
        title: `Pass ${describeChar(char)} through`,
        detail: `${describeChar(char)} is not a letter, so it is left alone and the rotors do not turn. A real Enigma had no space bar at all — operators sent X for a space — so this is a convenience of the simulator, not of the machine.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false },
      });
      continue;
    }

    const before = positions;
    positions = step({ ...settings, positions });
    const stepped = { ...settings, positions };
    const path = encipher(stepped, index);
    const outChar = letter(path.plugOut, isUpperCase(char));
    output += outChar;

    const windows = positions.map((p) => letter(p)).join('');
    const turned =
      positions[0] !== before[0]
        ? 'all three rotors moved'
        : positions[1] !== before[1]
          ? 'the right and middle rotors moved'
          : 'the right rotor moved';

    const plugged = path.plugIn !== index;

    steps.push({
      index: i,
      title: `${letter(index)} → ${letter(path.plugOut)} at ${windows}`,
      detail: `Before the circuit closes, ${turned}, leaving the windows at ${windows}. ${letter(
        index,
      )} enters the plugboard and comes out as ${letter(path.plugIn)}${
        plugged ? ' — a cable is fitted' : ', unchanged, since no cable is fitted'
      }. It crosses the right rotor to ${letter(path.rightIn)}, the middle to ${letter(
        path.middleIn,
      )}, the left to ${letter(path.leftIn)}. The reflector sends it back as ${letter(
        path.reflected,
      )}, and it recrosses the left rotor to ${letter(path.leftBack)}, the middle to ${letter(
        path.middleBack,
      )}, the right to ${letter(path.rightBack)}. The plugboard turns that into ${letter(
        path.plugOut,
      )}. Note that the answer is never ${letter(index)} itself — the reflector makes that impossible.`,
      input: char,
      output: outChar,
      highlight: { start: i, end: i + 1 },
      data: {
        isLetter: true,
        windows,
        positions: [...positions],
        rotors: [...settings.rotors],
        reflector: settings.reflector,
        plugged,
        path: { ...path },
      },
    });
  }

  return { output, steps };
}
