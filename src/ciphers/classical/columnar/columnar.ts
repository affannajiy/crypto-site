/**
 * Columnar transposition.
 *
 * Rail Fence moves characters around on a fixed zigzag, and its only secret is
 * how many rails — a key space small enough that the Attack tab there tries every
 * one of them. Columnar transposition is the same idea given a real key: write
 * the message into a grid row by row, then read the columns out in an order set
 * by a keyword.
 *
 * With a seven-letter keyword there are 5040 column orders instead of nine rail
 * counts, and the jump from "try them all instantly" to "try them all, but you
 * will feel it" is the point of putting both ciphers in the app.
 *
 * The last row is usually incomplete, and this implementation leaves it that way
 * rather than padding to a rectangle. That is the historical version — the ragged
 * bottom row is what makes the columns different lengths, and getting the lengths
 * right is most of the work of decrypting. Padding it away would make the code
 * shorter and the cipher a lie.
 *
 * Like Rail Fence, every character takes part, spaces included, so the cipher is
 * exactly length-preserving. See the note on `columnLengths`.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../types';

export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 12;

export type Direction = 'encrypt' | 'decrypt';

/**
 * Turns a keyword into the order its columns are read in.
 *
 * The rule is alphabetical rank: with LEMON, the E is read first, then the L,
 * then the M, then the N, then the O. Repeated letters break the tie by position,
 * left to right, which is the standard convention — otherwise BALLOON would be
 * ambiguous and two people with the same key would disagree.
 *
 * Returns grid column indices in reading order: `order[0]` is the column read
 * first.
 */
export function keyOrder(keyword: string): number[] {
  const letters = keyword.replace(/[^A-Za-z]/g, '').toUpperCase().split('');
  return letters
    .map((letter, index) => ({ letter, index }))
    .sort((a, b) => (a.letter === b.letter ? a.index - b.index : a.letter < b.letter ? -1 : 1))
    .map((entry) => entry.index);
}

/** The rank shown above each column: 1 for the column read first. */
export function keyRanks(keyword: string): number[] {
  const order = keyOrder(keyword);
  const ranks = new Array<number>(order.length).fill(0);
  order.forEach((column, position) => {
    ranks[column] = position + 1;
  });
  return ranks;
}

/**
 * How many characters each column holds.
 *
 * This is the whole difficulty of the cipher in one function. The message is
 * written across the grid row by row, so when the length is not a multiple of the
 * column count, the **leftmost** columns get one extra character and the rest end
 * a row early. An attacker who guesses the column order but not the lengths gets
 * nothing readable, and a decryption that assumes a neat rectangle is wrong for
 * every message except the ones that happen to divide exactly.
 */
export function columnLengths(length: number, columns: number): number[] {
  const rows = Math.ceil(length / columns);
  const remainder = length % columns;
  return Array.from({ length: columns }, (_, column) =>
    remainder === 0 || column < remainder ? rows : rows - 1,
  );
}

/**
 * The permutation, as `order[outputIndex] = inputIndex`.
 *
 * A transposition is nothing more than this, and expressing it as one array means
 * decryption needs no second algorithm — just the inverse.
 */
export function columnarOrder(length: number, keyword: string): number[] {
  const columns = Math.max(1, keyOrder(keyword).length);
  const reading = keyOrder(keyword);
  const lengths = columnLengths(length, columns);

  const order: number[] = [];
  for (const column of reading) {
    const height = lengths[column] ?? 0;
    for (let row = 0; row < height; row += 1) {
      order.push(row * columns + column);
    }
  }
  return order;
}

/** Where each character of the message ends up: `destination[inputIndex]`. */
export function invert(order: number[]): number[] {
  const out = new Array<number>(order.length).fill(0);
  order.forEach((from, to) => {
    out[from] = to;
  });
  return out;
}

/** The cipher, untraced. Used by the benchmark. */
export function columnar(text: string, keyword: string, direction: Direction = 'encrypt'): string {
  const width = keyOrder(keyword).length;
  if (width < MIN_COLUMNS) {
    throw new Error(
      `The keyword needs at least ${MIN_COLUMNS} letters — one column is not a transposition, it is a copy.`,
    );
  }
  if (width > MAX_COLUMNS) {
    throw new Error(
      `The keyword has ${width} letters, and this page stops at ${MAX_COLUMNS}. The cipher works with more; the grid stops being readable.`,
    );
  }

  const order = columnarOrder(text.length, keyword);
  const chars = text.split('');

  if (direction === 'encrypt') {
    return order.map((from) => chars[from] ?? '').join('');
  }
  // Decrypting: the input is the readout, so each character goes back where it
  // came from. Same permutation, applied the other way round.
  const out = new Array<string>(text.length).fill('');
  order.forEach((destination, source) => {
    out[destination] = chars[source] ?? '';
  });
  return out.join('');
}

/** A space drawn as a space reads as a missing character, not as a space. */
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
 * The cipher again, one `Step` per character, in **output** order — because that
 * is the order a person reads the ciphertext off the grid, and a trace that
 * jumped around the output would be impossible to follow.
 *
 * Every step sets both `highlight` and `outputHighlight`: the character is in one
 * place in the message and a different place in the ciphertext, and one range
 * cannot describe both.
 */
export function columnarTrace(
  text: string,
  keyword: string,
  direction: Direction = 'encrypt',
): TraceResult {
  const output = columnar(text, keyword, direction);
  const columns = keyOrder(keyword).length;
  const ranks = keyRanks(keyword);
  const letters = keyword.replace(/[^A-Za-z]/g, '').toUpperCase();

  // Encrypting, the grid holds the message and the output is the readout.
  // Decrypting, the grid holds the *answer*, so the trace is written from the
  // grid's point of view either way and the two texts swap roles.
  const grid = direction === 'encrypt' ? text : output;
  const order = columnarOrder(text.length, keyword);
  const lengths = columnLengths(text.length, columns);

  const steps: Step[] = [];
  for (let position = 0; position < order.length; position += 1) {
    const cell = order[position] ?? 0;
    const row = Math.floor(cell / columns);
    const column = cell % columns;
    const char = grid.charAt(cell);

    const inputIndex = direction === 'encrypt' ? cell : position;
    const outputIndex = direction === 'encrypt' ? position : cell;

    const rank = ranks[column] ?? 0;
    const keyLetter = letters.charAt(column);
    const height = lengths[column] ?? 0;

    steps.push({
      index: position,
      title:
        direction === 'encrypt'
          ? `Read column ${column + 1} (${keyLetter}), row ${row + 1}`
          : `Refill column ${column + 1} (${keyLetter}), row ${row + 1}`,
      detail: `Column ${column + 1} is headed ${keyLetter}, which is ${ordinal(rank)} in alphabetical order, so it is ${
        direction === 'encrypt' ? 'read out' : 'filled back in'
      } ${ordinal(rank)}. This column holds ${height} character${height === 1 ? '' : 's'}. ${describeChar(
        char,
      )} sits at row ${row + 1}, position ${cell + 1} of the message, and lands at position ${
        outputIndex + 1
      } of the ${direction === 'encrypt' ? 'ciphertext' : 'message'}. The letter itself is unchanged — a transposition never substitutes.`,
      input: char,
      output: char,
      highlight: { start: inputIndex, end: inputIndex + 1 },
      outputHighlight: { start: outputIndex, end: outputIndex + 1 },
      data: {
        char,
        row,
        column,
        columns,
        rank,
        keyLetter,
        columnHeight: height,
        cell,
        inputIndex,
        outputIndex,
        direction,
      },
    });
  }

  return { output, steps };
}

function ordinal(n: number): string {
  if (n === 1) return 'first';
  if (n === 2) return 'second';
  if (n === 3) return 'third';
  return `${n}th`;
}
