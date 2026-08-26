/**
 * Atbash.
 *
 * The oldest cipher in this app, and the only one with **no key at all**. Fold the
 * alphabet in half and swap each letter for its mirror: A becomes Z, B becomes Y,
 * M becomes N. That is the entire algorithm.
 *
 *     E(x) = 25 - x
 *
 * It appears in the Hebrew scriptures — the name is aleph-tav-beth-shin, the
 * first, last, second and second-to-last letters, which is the rule written as a
 * word. Jeremiah writes "Sheshach" where the reading is Babel.
 *
 * Two properties make it worth a page here. It is an **involution**: applying it
 * twice returns the original, so encrypting and decrypting are the same operation
 * and this file has no `direction` parameter. And it has a key space of exactly
 * **one**, which means it offers no secrecy whatsoever — knowing the method is
 * knowing the key. It is included as the floor: the smallest thing that still
 * counts as a cipher, and the clearest possible case of security-by-obscurity.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export const ALPHABET_SIZE = 26;

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

/** The mirror. `mirror(mirror(x)) === x`, which is the whole cipher. */
export function mirror(index: number): number {
  return ALPHABET_SIZE - 1 - index;
}

/**
 * The thirteen pairs the alphabet folds into, in fold order: A-Z, B-Y, ... M-N.
 * The visualizer draws exactly this, and a test asserts there are thirteen of
 * them and that every letter appears once.
 */
export function pairs(): { left: string; right: string }[] {
  const out: { left: string; right: string }[] = [];
  for (let i = 0; i < ALPHABET_SIZE / 2; i += 1) {
    out.push({
      left: letterFromIndex(i, true),
      right: letterFromIndex(mirror(i), true),
    });
  }
  return out;
}

/** The cipher, untraced. Used by the benchmark. There is no direction to pass. */
export function atbash(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    out += index === -1 ? char : letterFromIndex(mirror(index), isUpperCase(char));
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
export function atbashTrace(text: string): TraceResult {
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
        detail: `${describeChar(char)} is not a letter A-Z, so it is left exactly as it is. Spacing and punctuation survive untouched, which is one of the reasons this cipher hides so little.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false },
      });
      continue;
    }

    const upper = isUpperCase(char);
    const toIndex = mirror(fromIndex);
    const toChar = letterFromIndex(toIndex, upper);
    output += toChar;

    steps.push({
      index: i,
      title: `Mirror ${describeChar(char)}`,
      detail: `${char} is index ${fromIndex}, counting from A = 0. Its mirror is 25 ${'−'} ${fromIndex} = ${toIndex} → ${toChar}. Doing this again to ${toChar} gives back ${char}, which is why encrypting and decrypting are the same operation here.`,
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
        pair: Math.min(fromIndex, toIndex),
      },
    });
  }

  return { output, steps };
}
