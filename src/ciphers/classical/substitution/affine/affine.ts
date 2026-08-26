/**
 * The Affine cipher.
 *
 * Caesar adds. Affine multiplies **and** adds:
 *
 *     E(x) = (a*x + b) mod 26
 *
 * Setting a = 1 gives back Caesar exactly, which makes this the first cipher here
 * that contains an earlier one as a special case. The multiplication is the new
 * idea, and it comes with a condition that is the whole lesson of the file: `a`
 * must share no factor with 26, or the cipher stops being reversible.
 *
 * Plain TypeScript. This file imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export const ALPHABET_SIZE = 26;

const UPPER_A = 'A'.charCodeAt(0);
const LOWER_A = 'a'.charCodeAt(0);

export type Direction = 'encrypt' | 'decrypt';

/** U+2212. A hyphen is not a minus sign, and people read this arithmetic. */
const MINUS = '−';

/**
 * The values of `a` that actually work: those with no common factor with 26.
 *
 * 26 factors as 2 x 13, so any even `a` or a multiple of 13 is disqualified. That
 * leaves twelve. Multiplying by a disqualified value collapses the alphabet —
 * with a = 2 both A and N map to the same letter, and a cipher that sends two
 * letters to one cannot be undone by anybody, including the person holding the
 * key.
 */
export const VALID_MULTIPLIERS: readonly number[] = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];

/** Euclid's algorithm. Two numbers are coprime when this returns 1. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** Whether `a` can be used as a multiplier, i.e. whether the cipher is reversible. */
export function isValidMultiplier(a: number): boolean {
  return gcd(a, ALPHABET_SIZE) === 1;
}

/**
 * The modular multiplicative inverse of `a` mod 26: the number that undoes
 * multiplying by `a`.
 *
 * Found by trying all 26 candidates, which is not the clever way and is the right
 * way here — the alphabet has 26 letters, the loop runs 26 times at most, and the
 * extended Euclidean algorithm would trade that for code a learner has to decode
 * before they can read the cipher.
 *
 * Returns 0 when no inverse exists, which happens exactly when `a` shares a
 * factor with 26. Callers should have rejected that already.
 */
export function modInverse(a: number): number {
  const normalised = ((a % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE;
  for (let candidate = 1; candidate < ALPHABET_SIZE; candidate += 1) {
    if ((normalised * candidate) % ALPHABET_SIZE === 1) return candidate;
  }
  return 0;
}

/** Folds any integer into 0..25, without the negative zero that -26 % 26 produces. */
export function normalise(n: number): number {
  return ((Math.trunc(n) % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE;
}

/** 0-25 for A-Z or a-z, and -1 for everything else. */
export function letterIndex(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= UPPER_A && code <= UPPER_A + 25) return code - UPPER_A;
  if (code >= LOWER_A && code <= LOWER_A + 25) return code - LOWER_A;
  return -1;
}

function isUpperCase(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= UPPER_A && code <= UPPER_A + 25;
}

function letterFromIndex(index: number, upper: boolean): string {
  return String.fromCharCode((upper ? UPPER_A : LOWER_A) + index);
}

/**
 * The mapping the key produces, as 26 output indices — `mapping[x]` is what the
 * letter at index `x` becomes.
 *
 * Worth having as its own function because it is exactly what the visualizer
 * draws, and because a glance at it answers the question the explainer asks: a
 * valid key produces 26 distinct values, an invalid one does not.
 */
export function affineMapping(a: number, b: number, direction: Direction = 'encrypt'): number[] {
  const mapping: number[] = [];
  const inverse = modInverse(a);
  for (let x = 0; x < ALPHABET_SIZE; x += 1) {
    mapping.push(
      direction === 'encrypt'
        ? normalise(a * x + b)
        : normalise(inverse * (x - b)),
    );
  }
  return mapping;
}

/**
 * The whole cipher, with no trace. Used by the attack (which runs it 312 times)
 * and by the benchmark. `affineTrace` below is the same algorithm, narrated.
 */
export function affine(text: string, a: number, b: number, direction: Direction = 'encrypt'): string {
  const mapping = affineMapping(a, b, direction);

  // Indexed rather than iterated, because the benchmark and the attack call this
  // in a hot loop and `split('')` would allocate an array per run.
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    out += index === -1 ? char : letterFromIndex(mapping[index] ?? 0, isUpperCase(char));
  }
  return out;
}

/**
 * Names a character for a sentence a person reads. A literal space or newline
 * inside quotation marks is invisible, and invisible is not an explanation.
 */
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
 * The cipher again, this time emitting one `Step` per character — including the
 * characters it does not change, so a step's index is also its position in the
 * text and highlighting needs no lookup table.
 */
export function affineTrace(
  text: string,
  a: number,
  b: number,
  direction: Direction = 'encrypt',
): TraceResult {
  const mapping = affineMapping(a, b, direction);
  const inverse = modInverse(a);

  const chars = text.split('');
  const steps: Step[] = [];
  let output = '';

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i] ?? '';
    const fromIndex = letterIndex(char);

    if (fromIndex === -1) {
      output += char;
      steps.push({
        index: i,
        title: `Pass ${describeChar(char)} through`,
        detail: `${describeChar(char)} is not a letter A-Z, so the cipher leaves it exactly as it is. Punctuation and word breaks survive, and that is how the shape of the message leaks.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false, a, b, direction },
      });
      continue;
    }

    const upper = isUpperCase(char);
    const toIndex = mapping[fromIndex] ?? 0;
    const toChar = letterFromIndex(toIndex, upper);
    output += toChar;

    // The arithmetic is spelled out before the wrap, because the raw number is
    // the part a reader can check and the modulo is the part they are learning.
    const detail =
      direction === 'encrypt'
        ? `${char} is index ${fromIndex}. Multiply by a and add b: ${a} × ${fromIndex} + ${b} = ${a * fromIndex + b}. Wrap that into the alphabet: ${a * fromIndex + b} mod 26 = ${toIndex} → ${toChar}`
        : `${char} is index ${fromIndex}. Undo the shift first: ${fromIndex} ${MINUS} ${b} = ${fromIndex - b}. Then undo the multiplication using the inverse of ${a}, which is ${inverse}: ${inverse} × ${fromIndex - b} = ${inverse * (fromIndex - b)}. Wrap into the alphabet: ${toIndex} → ${toChar}`;

    steps.push({
      index: i,
      title: `${direction === 'encrypt' ? 'Map' : 'Unmap'} ${describeChar(char)} to '${toChar}'`,
      detail,
      input: char,
      output: toChar,
      highlight: { start: i, end: i + 1 },
      data: {
        isLetter: true,
        upper,
        fromIndex,
        toIndex,
        from: char,
        to: toChar,
        a,
        b,
        inverse,
        direction,
      },
    });
  }

  return { output, steps };
}
