/**
 * The Bifid cipher, Felix Delastelle, 1901.
 *
 * Every cipher before this one in the app does one of two things: it replaces
 * letters (substitution) or it moves them (transposition). Bifid does something
 * else, and the something else is why it is much harder than either.
 *
 * **Split each letter into two pieces, then move the pieces separately.**
 *
 * Put the alphabet in a keyed 5x5 square so each letter has a row and a column.
 * Write the rows along one line and the columns along the line below:
 *
 *     F L E E A T O N C E
 *     rows  2 3 1 1 1 4 3 3 1 1
 *     cols  1 2 5 5 1 5 4 4 3 5
 *
 * Now read that whole grid **left to right, top row then bottom row**, in pairs,
 * and turn each pair back into a letter. The row of one plaintext letter has been
 * paired with the column of a completely different one. A single output letter no
 * longer corresponds to a single input letter at all, which is what makes
 * frequency analysis useless and what Delastelle was after.
 *
 * The **period** controls how far the pieces travel. With period 5 the message is
 * folded five letters at a time; with period 0 the entire message is folded as one
 * block, which spreads the pieces furthest and is the strongest setting. Real
 * Bifid used a period, because a clerk working one short block at a time makes
 * fewer errors than one holding a whole message in a grid.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { type Square, at, buildSquare, cleanFor, locate, ALPHABET_25 } from '../../../../lib/polybius';
import { letterIndex } from '../../../../lib/letters';

export type Direction = 'encrypt' | 'decrypt';

export const SIZE = 5;
/** A period of 0 means "the whole message is one block". */
export const MAX_PERIOD = 20;

export interface Prepared {
  /** The message reduced to letters the square can hold, J folded onto I. */
  letters: string;
  /** `sources[i]` is where letter `i` came from in the text as typed. */
  sources: number[];
  /** True when a J was folded onto an I, so the page can say so. */
  foldedJ: boolean;
}

/** Strips the message to the 25 letters the square holds, remembering where each came from. */
export function prepare(text: string): Prepared {
  let letters = '';
  const sources: number[] = [];
  let foldedJ = false;

  for (let i = 0; i < text.length; i += 1) {
    const raw = text.charAt(i);
    if (letterIndex(raw) === -1) continue;
    let char = raw.toUpperCase();
    if (char === 'J') {
      char = 'I';
      foldedJ = true;
    }
    letters += char;
    sources.push(i);
  }

  return { letters, sources, foldedJ };
}

/** Block boundaries for a message of `length` letters. Period 0 is one block. */
export function blocks(length: number, period: number): { start: number; end: number }[] {
  if (length === 0) return [];
  const size = period <= 0 ? length : period;
  const out: { start: number; end: number }[] = [];
  for (let start = 0; start < length; start += size) {
    out.push({ start, end: Math.min(start + size, length) });
  }
  return out;
}

/**
 * The coordinate grid for one block: the rows on top, the columns below.
 *
 * Returned as the two rows separately because that is how it is written by hand
 * and how the visualizer draws it.
 */
export function grid(square: Square, letters: string): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (const char of letters) {
    const where = locate(square, char);
    rows.push(where?.row ?? 0);
    cols.push(where?.col ?? 0);
  }
  return { rows, cols };
}

/** One block, encrypted. Reads the grid left to right, top row then bottom row. */
export function foldBlock(square: Square, letters: string): string {
  const { rows, cols } = grid(square, letters);
  const stream = [...rows, ...cols];
  let out = '';
  for (let i = 0; i + 1 < stream.length; i += 2) {
    out += at(square, stream[i] ?? 0, stream[i + 1] ?? 0);
  }
  return out;
}

/** One block, decrypted. The stream comes back out in reading order and is halved. */
export function unfoldBlock(square: Square, letters: string): string {
  const stream: number[] = [];
  for (const char of letters) {
    const where = locate(square, char);
    stream.push(where?.row ?? 0, where?.col ?? 0);
  }
  const half = letters.length;
  let out = '';
  for (let i = 0; i < half; i += 1) {
    out += at(square, stream[i] ?? 0, stream[half + i] ?? 0);
  }
  return out;
}

/** The cipher, untraced. Used by the benchmark. */
export function bifid(text: string, keyword: string, period: number, direction: Direction): string {
  const square = buildSquare(keyword, SIZE);
  const { letters } = prepare(text);
  let out = '';
  for (const block of blocks(letters.length, period)) {
    const slice = letters.slice(block.start, block.end);
    out += direction === 'encrypt' ? foldBlock(square, slice) : unfoldBlock(square, slice);
  }
  return out;
}

function coordinateList(values: number[]): string {
  return values.map((n) => n + 1).join(' ');
}

/**
 * The cipher again, one `Step` per output letter.
 *
 * The input highlight covers the **whole block**, not a single letter, and that is
 * not vagueness. In a fractionating cipher an output letter genuinely does not
 * come from one input letter: it is built from the row of one and the column of
 * another. Pointing at a single character would be a more precise lie.
 */
export function bifidTrace(
  text: string,
  keyword: string,
  period: number,
  direction: Direction,
): TraceResult {
  const square = buildSquare(keyword, SIZE);
  const { letters, sources } = prepare(text);
  const steps: Step[] = [];
  let output = '';

  for (const block of blocks(letters.length, period)) {
    const slice = letters.slice(block.start, block.end);
    const n = slice.length;
    const start = sources[block.start] ?? 0;
    const end = (sources[block.end - 1] ?? start) + 1;
    const blockRange = { start, end };

    if (direction === 'encrypt') {
      const { rows, cols } = grid(square, slice);
      const stream = [...rows, ...cols];

      for (let j = 0; j * 2 + 1 < stream.length; j += 1) {
        const rowValue = stream[j * 2] ?? 0;
        const colValue = stream[j * 2 + 1] ?? 0;
        const letter = at(square, rowValue, colValue);
        const outputAt = output.length;
        output += letter;

        // Which plaintext letters those two digits were taken from.
        const first = j * 2;
        const second = j * 2 + 1;
        const nameOf = (k: number) =>
          k < n ? `the row of ${slice.charAt(k)}` : `the column of ${slice.charAt(k - n)}`;

        steps.push({
          index: steps.length,
          title: `(${rowValue + 1}, ${colValue + 1}) → ${letter}`,
          detail: `Reading the block's grid left to right: ${nameOf(first)} and ${nameOf(second)}, giving row ${rowValue + 1} column ${colValue + 1} → ${letter}. Those two digits came from ${first < n === (second < n) ? 'the same line of the grid' : 'different lines of the grid'}, and in general from different plaintext letters — which is why this output letter cannot be traced back to one input letter.`,
          output: letter,
          highlight: blockRange,
          outputHighlight: { start: outputAt, end: outputAt + 1 },
          data: {
            isLetter: true,
            block: { start: block.start, end: block.end },
            letters: slice,
            rows,
            cols,
            pick: [first, second],
            rowValue,
            colValue,
            letter,
            period,
          },
        });
      }

      steps.push({
        index: steps.length,
        title: `Block "${slice}" folded`,
        detail: `Rows: ${coordinateList(rows)}. Columns: ${coordinateList(cols)}. Written as two lines and read back in pairs, ${n} letters became ${n} letters — the same letters' worth of information, rearranged so that no piece of it sits where it started.`,
        data: { isLetter: false, letters: slice, rows, cols, period },
      });
      continue;
    }

    const recovered = unfoldBlock(square, slice);
    const stream: number[] = [];
    for (const char of slice) {
      const where = locate(square, char);
      stream.push(where?.row ?? 0, where?.col ?? 0);
    }

    for (let j = 0; j < n; j += 1) {
      const letter = recovered.charAt(j);
      const outputAt = output.length;
      output += letter;
      steps.push({
        index: steps.length,
        title: `(${(stream[j] ?? 0) + 1}, ${(stream[n + j] ?? 0) + 1}) → ${letter}`,
        detail: `Every ciphertext letter of the block is split into its two digits, and the whole run is cut in half: the first ${n} digits are the rows, the last ${n} are the columns. Digit ${j + 1} of the first half and digit ${j + 1} of the second half give row ${(stream[j] ?? 0) + 1} column ${(stream[n + j] ?? 0) + 1} → ${letter}.`,
        output: letter,
        highlight: blockRange,
        outputHighlight: { start: outputAt, end: outputAt + 1 },
        data: {
          isLetter: true,
          block: { start: block.start, end: block.end },
          letters: slice,
          rows: stream.slice(0, n),
          cols: stream.slice(n),
          pick: [j, n + j],
          rowValue: stream[j] ?? 0,
          colValue: stream[n + j] ?? 0,
          letter,
          period,
        },
      });
    }
  }

  return { output, steps };
}

/** The square's letters, for the visualizer and for a test that it is complete. */
export function squareFor(keyword: string): Square {
  return buildSquare(keyword, SIZE);
}

/** The keyword as it actually lands in the square, for the page to show. */
export function usableKeyword(keyword: string): string {
  return cleanFor(ALPHABET_25, keyword);
}
