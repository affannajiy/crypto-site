/**
 * ROT13.
 *
 * Caesar with the shift nailed to 13, which sounds like a footnote and is not.
 * Twenty-six is even, so half of it lands every letter exactly opposite its
 * partner on the circle:
 *
 *     E(x) = (x + 13) mod 26      and      E(E(x)) = x
 *
 * That makes ROT13 an **involution**, like Atbash — one operation that both
 * encrypts and decrypts. Thirteen is the only shift with that property, because
 * it is the only one where going round twice is going round exactly once.
 *
 * It is here for a different reason from the rest of this app. Nobody has ever
 * used ROT13 to keep a secret. It is used to make text *not accidentally
 * readable* — a spoiler, a punchline, a puzzle answer — where the reader is
 * cooperating rather than attacking. That is a real and legitimate job, and
 * confusing it with security is the mistake the page exists to prevent.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export const ALPHABET_SIZE = 26;

/** The only shift that is its own inverse. Deliberately not a parameter. */
export const ROTATION = 13;

const UPPER_A = 'A'.charCodeAt(0);
const LOWER_A = 'a'.charCodeAt(0);

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

/** Half a turn. `rotate(rotate(x)) === x`, which is the whole point. */
export function rotate(index: number): number {
  return (index + ROTATION) % ALPHABET_SIZE;
}

/**
 * The thirteen diametrically opposite pairs: A-N, B-O, ... M-Z. The visualizer
 * draws one line per pair, straight through the centre of the circle.
 */
export function pairs(): { left: string; right: string }[] {
  const out: { left: string; right: string }[] = [];
  for (let i = 0; i < ROTATION; i += 1) {
    out.push({ left: letterFromIndex(i, true), right: letterFromIndex(rotate(i), true) });
  }
  return out;
}

/** The cipher, untraced. Used by the benchmark. There is no direction to pass. */
export function rot13(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    out += index === -1 ? char : letterFromIndex(rotate(index), isUpperCase(char));
  }
  return out;
}

/**
 * Names a character for a sentence a person reads. A literal space inside
 * quotation marks is invisible, and invisible is not an explanation.
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
 * The cipher again, emitting one `Step` per character — including the characters
 * it leaves alone, so a step's index is also its position in the text.
 */
export function rot13Trace(text: string): TraceResult {
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
        detail: `${describeChar(char)} is not a letter A-Z, so it is left exactly as it is. Digits, spacing and punctuation are untouched — which is why a ROT13'd paragraph still looks like a paragraph.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false },
      });
      continue;
    }

    const upper = isUpperCase(char);
    const toIndex = rotate(fromIndex);
    const toChar = letterFromIndex(toIndex, upper);
    const wrapped = fromIndex + ROTATION >= ALPHABET_SIZE;
    output += toChar;

    steps.push({
      index: i,
      title: `Rotate ${describeChar(char)} half a turn`,
      detail: `${char} is index ${fromIndex}. ${fromIndex} + 13 = ${fromIndex + ROTATION}${
        wrapped ? `, which wraps round to ${toIndex}` : ''
      } → ${toChar}. Half a turn more would be a full turn, so rotating ${toChar} by 13 gives back ${char}.`,
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
        wrapped,
      },
    });
  }

  return { output, steps };
}
