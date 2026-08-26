/**
 * The Caesar cipher.
 *
 * Every letter moves a fixed number of places along the alphabet, wrapping round
 * from Z back to A. Case survives. Anything that is not an A-Z letter — a space,
 * a comma, a digit, an accented character — passes through untouched, which is
 * itself a weakness: word lengths and punctuation leak straight through the
 * ciphertext.
 *
 * Plain TypeScript. This file imports nothing from React and touches no DOM, so
 * it runs in a test, in Node, or in a browser without change.
 */
import type { Step, TraceResult } from '../../../types';

export const ALPHABET_SIZE = 26;

const UPPER_A = 'A'.charCodeAt(0);
const LOWER_A = 'a'.charCodeAt(0);

export type Direction = 'encrypt' | 'decrypt';

/** U+2212. A hyphen is not a minus sign, and people read this arithmetic. */
const MINUS = '−';

function signed(n: number): string {
  return n < 0 ? `${MINUS}${Math.abs(n)}` : String(n);
}

/**
 * Folds any integer into 0..25.
 *
 * JavaScript's `%` keeps the sign of the left operand, so -3 % 26 is -3, not 23.
 * Adding 26 before the second modulo fixes that. It also removes the negative
 * zero that -26 % 26 produces, which is arithmetically harmless and would still
 * have printed as "-0" in a step a person reads.
 */
export function normaliseShift(shift: number): number {
  return ((Math.trunc(shift) % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE;
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
 * The whole cipher, with no trace. Used by the attack (which runs it 25 times)
 * and by the benchmark. `caesarTrace` below is the same algorithm, narrated.
 *
 * Decrypting by `n` is encrypting by `26 - n`, which is the first thing that
 * should feel suspicious about this cipher: the key barely matters.
 */
export function caesar(text: string, shift: number, direction: Direction = 'encrypt'): string {
  const effective =
    direction === 'encrypt'
      ? normaliseShift(shift)
      : normaliseShift(ALPHABET_SIZE - normaliseShift(shift));

  // Indexed rather than iterated, because the benchmark and the attack call this
  // in a hot loop and `split('')` would allocate an array per run.
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    out +=
      index === -1 ? char : letterFromIndex((index + effective) % ALPHABET_SIZE, isUpperCase(char));
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
export function caesarTrace(
  text: string,
  shift: number,
  direction: Direction = 'encrypt',
): TraceResult {
  const key = normaliseShift(shift);
  const effective = direction === 'encrypt' ? key : normaliseShift(ALPHABET_SIZE - key);
  const sign = direction === 'encrypt' ? '+' : MINUS;

  const chars = splitChars(text);
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
        data: { isLetter: false, shift: key, direction },
      });
      continue;
    }

    const upper = isUpperCase(char);
    // `raw` is the arithmetic before wrapping \u2014 the number the reader is shown.
    const raw = direction === 'encrypt' ? fromIndex + key : fromIndex - key;
    const toIndex = (fromIndex + effective) % ALPHABET_SIZE;
    const toChar = letterFromIndex(toIndex, upper);
    output += toChar;

    const wrapped = raw !== toIndex;
    const opening = `${char} is index ${fromIndex}. ${fromIndex} ${sign} ${key} =`;

    // The wrap is spelled out as one addition or subtraction rather than as
    // "mod 26". They agree mathematically, but a reader who tries -19 % 26 in a
    // JavaScript console gets -19 back, and a lesson should not set that trap.
    let detail: string;
    if (!wrapped) {
      detail = `${opening} ${toIndex} \u2192 ${toChar}`;
    } else if (raw < 0) {
      detail = `${opening} ${signed(raw)}, which falls off the front of the alphabet, so wrap round: ${signed(raw)} + 26 = ${toIndex} \u2192 ${toChar}`;
    } else {
      detail = `${opening} ${raw}, which runs past the end of the alphabet, so wrap round: ${raw} ${MINUS} 26 = ${toIndex} \u2192 ${toChar}`;
    }

    steps.push({
      index: i,
      title: `${direction === 'encrypt' ? 'Shift' : 'Unshift'} ${describeChar(char)} by ${key}`,
      detail,
      input: char,
      output: toChar,
      highlight: { start: i, end: i + 1 },
      data: { isLetter: true, upper, fromIndex, toIndex, from: char, to: toChar, shift: key, wrapped, direction },
    });
  }

  return { output, steps };
}

/**
 * Splits into UTF-16 code units rather than code points.
 *
 * That looks like a bug and is a deliberate choice: a step index must line up
 * with a string index so the highlight ranges are correct, and `String.prototype`
 * indexes by code unit. No A-Z letter is ever a surrogate pair, so the cipher
 * output is identical either way — an emoji is simply passed through as its two
 * halves, in two steps.
 */
function splitChars(text: string): string[] {
  return text.split('');
}
