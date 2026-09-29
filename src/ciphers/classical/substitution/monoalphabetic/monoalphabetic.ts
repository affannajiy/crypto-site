/**
 * The monoalphabetic substitution cipher.
 *
 * Caesar slides the alphabet. Affine stretches it. This one shuffles it: the key
 * is a whole second alphabet, any arrangement of the 26 letters, and each
 * plaintext letter is replaced by the letter written under it. Caesar, Atbash and
 * Affine are all special cases, each using only a handful of the 26! possible
 * arrangements.
 *
 * Case survives. Anything that is not an A-Z letter passes through untouched,
 * like every other substitution here.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import {
  A_TO_Z,
  ALPHABET_SIZE,
  describeChar,
  isUpperCase,
  letterFromIndex,
  letterIndex,
} from '../../../../lib/letters';

export type Direction = 'encrypt' | 'decrypt';

/**
 * The key from the textbook example this course follows: plain `a` becomes `D`,
 * `b` becomes `K`, and so on.
 */
export const TEXTBOOK_KEY = 'DKVQFIBJWPESCXHTMYAUOLRGZN';

/**
 * Checks that `key` is a permutation of the alphabet and returns it as indices:
 * `forward[plainIndex] = cipherIndex`.
 *
 * Anything that is not a letter is ignored, so `DKVQF IBJWP ...` in groups of
 * five is accepted. A key that is not a permutation throws with the letters that
 * are wrong, because "invalid key" leaves a reader hunting through 26 characters.
 */
export function parseKey(key: string): number[] {
  const forward: number[] = [];
  for (let i = 0; i < key.length; i += 1) {
    const index = letterIndex(key.charAt(i));
    if (index !== -1) forward.push(index);
  }

  const counts = new Array<number>(ALPHABET_SIZE).fill(0);
  for (const index of forward) counts[index] = (counts[index] ?? 0) + 1;
  const repeated = counts.flatMap((n, i) => (n > 1 ? [A_TO_Z.charAt(i)] : []));
  const missing = counts.flatMap((n, i) => (n === 0 ? [A_TO_Z.charAt(i)] : []));

  if (forward.length !== ALPHABET_SIZE || repeated.length > 0) {
    const parts = [`The key has ${forward.length} letters and needs all 26, each exactly once.`];
    if (repeated.length > 0) parts.push(`Repeated: ${repeated.join(', ')}.`);
    if (missing.length > 0) parts.push(`Missing: ${missing.join(', ')}.`);
    throw new Error(parts.join(' '));
  }
  return forward;
}

/** The mapping the other way round: `inverse[cipherIndex] = plainIndex`. */
export function invertKey(forward: number[]): number[] {
  const inverse = new Array<number>(ALPHABET_SIZE).fill(0);
  forward.forEach((to, from) => {
    inverse[to] = from;
  });
  return inverse;
}

/** A fresh key: the alphabet shuffled by Fisher-Yates, from the platform's CSPRNG. */
export function randomAlphabet(): string {
  const letters = A_TO_Z.split('');
  const scratch = new Uint32Array(letters.length);
  crypto.getRandomValues(scratch);
  for (let i = letters.length - 1; i > 0; i -= 1) {
    const j = (scratch[i] ?? 0) % (i + 1);
    const swap = letters[i] ?? '';
    letters[i] = letters[j] ?? '';
    letters[j] = swap;
  }
  return letters.join('');
}

/** The cipher, untraced. Used by the benchmark. */
export function monoalphabetic(text: string, key: string, direction: Direction = 'encrypt'): string {
  const forward = parseKey(key);
  const table = direction === 'encrypt' ? forward : invertKey(forward);
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    out += index === -1 ? char : letterFromIndex(table[index] ?? index, isUpperCase(char));
  }
  return out;
}

/**
 * The cipher again, one `Step` per character, including the ones it passes
 * through, so a step's index is also its position in the text.
 */
export function monoalphabeticTrace(
  text: string,
  key: string,
  direction: Direction = 'encrypt',
): TraceResult {
  const forward = parseKey(key);
  const table = direction === 'encrypt' ? forward : invertKey(forward);
  const steps: Step[] = [];
  let output = '';

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const fromIndex = letterIndex(char);

    if (fromIndex === -1) {
      output += char;
      steps.push({
        index: i,
        title: `Pass ${describeChar(char)} through`,
        detail: `${describeChar(char)} is not a letter A-Z, so it is left as it is. Word breaks survive, and so does the shape of the message.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false, direction },
      });
      continue;
    }

    const toIndex = table[fromIndex] ?? fromIndex;
    const toChar = letterFromIndex(toIndex, isUpperCase(char));
    output += toChar;

    const detail =
      direction === 'encrypt'
        ? `Find ${A_TO_Z.charAt(fromIndex)} in the plain alphabet. The key letter written under it is ${A_TO_Z.charAt(toIndex)}, so ${describeChar(char)} becomes '${toChar}'.`
        : `Find ${A_TO_Z.charAt(fromIndex)} in the key alphabet. The plain letter written above it is ${A_TO_Z.charAt(toIndex)}, so ${describeChar(char)} becomes '${toChar}'.`;

    steps.push({
      index: i,
      title: `Replace ${describeChar(char)} with '${toChar}'`,
      detail,
      input: char,
      output: toChar,
      highlight: { start: i, end: i + 1 },
      // `plainIndex` is always the column in the plain-over-key table, whichever
      // way the run goes, so the visualizer lights the same column both ways.
      data: {
        isLetter: true,
        plainIndex: direction === 'encrypt' ? fromIndex : toIndex,
        direction,
      },
    });
  }

  return { output, steps };
}
