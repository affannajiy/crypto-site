/**
 * Porta's cipher, 1563.
 *
 * Giovan Battista della Porta's table has **thirteen** rows, not twenty-six, and
 * each row is a reciprocal pairing of the alphabet's two halves. Row *t* pairs
 * A-M against N-Z, with the second half rotated *t* places:
 *
 *     t = 0:  A B C D E F G H I J K L M
 *             N O P Q R S T U V W X Y Z
 *
 *     t = 1:  A B C D E F G H I J K L M
 *             O P Q R S T U V W X Y Z N
 *
 * A key letter chooses the row, and **two key letters choose each row**: A and B
 * both select row 0, C and D row 1, and so on. That halving is the cipher's most
 * interesting property and its worst one, and both are consequences of the same
 * decision.
 *
 * Because each row pairs letters rather than mapping them one way, the cipher is
 * **self-reciprocal**: encrypting a ciphertext with the same key returns the
 * plaintext, exactly as in Beaufort but for a different structural reason. Porta
 * gets it from the pairing; Beaufort gets it from the subtraction.
 *
 * Porta also wrote the first book in Europe on cryptanalysis, and this cipher is
 * older than Vigenere's. Both facts are usually left out.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import {
  A_TO_Z,
  describeChar,
  isUpperCase,
  keyIndices,
  letterFromIndex,
  letterIndex,
} from '../../../../lib/letters';

export const HALF = 13;
/** Two key letters share every row, so there are thirteen, not twenty-six. */
export const ROWS = 13;

/** The row a key letter selects. A and B both give 0, C and D give 1, and so on. */
export function rowFor(keyValue: number): number {
  return Math.floor(keyValue / 2) % ROWS;
}

/** The key letters as 0-25, or [0] for a key with no letters. */
export function keyValues(key: string): number[] {
  const values = keyIndices(key);
  return values.length === 0 ? [0] : values;
}

/** The key as the trace shows it: uppercase, letters only. */
export function normalisedKey(key: string): string {
  return keyValues(key)
    .map((n) => A_TO_Z.charAt(n))
    .join('');
}

/**
 * The cipher's one operation, on a single letter index.
 *
 * The two halves swap: a letter from the first half comes out of the second and
 * vice versa. Applying it twice returns the input, and a test checks that for all
 * 13 x 26 combinations rather than for a sample.
 */
export function portaLetter(index: number, row: number): number {
  if (index < HALF) return HALF + ((index + row) % HALF);
  return (((index - HALF - row) % HALF) + HALF) % HALF;
}

/** One row of the printed table, as the 26 letters a plaintext letter maps to. */
export function tableRow(row: number): string {
  let out = '';
  for (let i = 0; i < 26; i += 1) out += A_TO_Z.charAt(portaLetter(i, row));
  return out;
}

/** Which key letters select a given row. Always exactly two of them. */
export function keyLettersForRow(row: number): string {
  return `${A_TO_Z.charAt(row * 2)}${A_TO_Z.charAt(row * 2 + 1)}`;
}

/**
 * The cipher, untraced. Used by the benchmark.
 *
 * There is no `direction`. Applying this to its own output with the same key
 * returns the input, which a test asserts.
 */
export function porta(text: string, key: string): string {
  const values = keyValues(key);
  const period = values.length;
  let out = '';
  let position = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    if (index === -1) {
      // The key advances on letters only, matching every other cipher here.
      out += char;
      continue;
    }
    out += letterFromIndex(portaLetter(index, rowFor(values[position % period] ?? 0)), isUpperCase(char));
    position += 1;
  }

  return out;
}

/** The cipher again, one `Step` per character, non-letters included. */
export function portaTrace(text: string, key: string): TraceResult {
  const values = keyValues(key);
  const normalised = normalisedKey(key);
  const period = values.length;
  const steps: Step[] = [];
  let output = '';
  let position = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const fromIndex = letterIndex(char);

    if (fromIndex === -1) {
      output += char;
      steps.push({
        index: i,
        title: `Pass ${describeChar(char)} through`,
        detail: `${describeChar(char)} is not a letter A-Z, so it is left alone and the key does not advance.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false, key: normalised },
      });
      continue;
    }

    const keyPosition = position % period;
    const keyValue = values[keyPosition] ?? 0;
    const keyChar = normalised.charAt(keyPosition);
    const row = rowFor(keyValue);
    const toIndex = portaLetter(fromIndex, row);
    const upper = isUpperCase(char);
    const toChar = letterFromIndex(toIndex, upper);
    output += toChar;

    const half = fromIndex < HALF ? 'first' : 'second';

    steps.push({
      index: i,
      title: `${char.toUpperCase()} → ${toChar.toUpperCase()} on row ${row}`,
      detail: `Key letter ${keyChar} selects row ${row}, which is also selected by ${keyLettersForRow(row).split('').join(' and ')} — every row has two key letters, so the key space is halved. ${char.toUpperCase()} is in the ${half} half of the alphabet, so it comes out of the other half as ${toChar.toUpperCase()}. The pairing runs both ways: on this row ${toChar.toUpperCase()} maps back to ${char.toUpperCase()}.`,
      input: char,
      output: toChar,
      highlight: { start: i, end: i + 1 },
      data: {
        isLetter: true,
        upper,
        fromIndex,
        toIndex,
        row,
        keyValue,
        keyChar,
        keyPosition,
        key: normalised,
      },
    });

    position += 1;
  }

  return { output, steps };
}
