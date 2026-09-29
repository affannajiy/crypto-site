/**
 * Row transposition, also called columnar transposition.
 *
 * The file keeps the name "columnar" because that is what the algorithm does:
 * the message goes in by rows and comes out by columns. The textbook names it by
 * the first half and most histories by the second.
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
 * The last row is usually incomplete. The textbook fills it with x, y, z so the
 * grid is a rectangle, and `pad` does the same. Without `pad` the last row stays
 * ragged, which is the harder version: the ragged bottom row makes the columns
 * different lengths, and getting the lengths right is most of the work of
 * decrypting. Both are here because each teaches something.
 *
 * Like Rail Fence, every character takes part, spaces included, so the cipher is
 * exactly length-preserving. See the note on `columnLengths`.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 12;

export type Direction = 'encrypt' | 'decrypt';

/**
 * True for a key written as numbers, the way the textbook writes it: `4312567`,
 * or `4 3 1 2 5 6 7`. Anything with a letter in it is a keyword.
 */
export function isNumericKey(key: string): boolean {
  return /\d/.test(key) && /^[\d\s,-]+$/.test(key.trim());
}

/**
 * The rank of each column in a numeric key, as written.
 *
 * With no separator, each digit is one column, so `4312567` is seven columns.
 * With spaces or commas, each number is one column, so `3 1 10 2 ...` can reach
 * past nine. The numbers must be 1 to n, each once, or two columns would claim the
 * same turn.
 */
function numericRanks(key: string): number[] {
  const trimmed = key.trim();
  const tokens = /[\s,-]/.test(trimmed) ? trimmed.split(/[\s,-]+/).filter(Boolean) : trimmed.split('');
  const ranks = tokens.map(Number);
  const sorted = [...ranks].sort((a, b) => a - b);
  if (!sorted.every((n, i) => n === i + 1)) {
    throw new Error(
      `A numeric key must use each number from 1 to ${ranks.length} exactly once. '${trimmed}' does not.`,
    );
  }
  return ranks;
}

/**
 * Turns a key into the order its columns are read in.
 *
 * A numeric key says it outright: the column headed 1 is read first. A keyword
 * says it by alphabetical rank: with LEMON, the E is read first, then the L, then
 * the M, then the N, then the O. Repeated letters break the tie by position, left
 * to right, which is the standard convention — otherwise BALLOON would be
 * ambiguous and two people with the same key would disagree.
 *
 * Returns grid column indices in reading order: `order[0]` is the column read
 * first.
 */
export function keyOrder(key: string): number[] {
  if (isNumericKey(key)) {
    return numericRanks(key)
      .map((rank, index) => ({ rank, index }))
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.index);
  }
  const letters = key.replace(/[^A-Za-z]/g, '').toUpperCase().split('');
  return letters
    .map((letter, index) => ({ letter, index }))
    .sort((a, b) => (a.letter === b.letter ? a.index - b.index : a.letter < b.letter ? -1 : 1))
    .map((entry) => entry.index);
}

/** The rank shown above each column: 1 for the column read first. */
export function keyRanks(key: string): number[] {
  const order = keyOrder(key);
  const ranks = new Array<number>(order.length).fill(0);
  order.forEach((column, position) => {
    ranks[column] = position + 1;
  });
  return ranks;
}

/** What heads each column: the keyword's letter, or the number itself. */
export function keyLabels(key: string): string[] {
  if (isNumericKey(key)) return keyRanks(key).map(String);
  return key.replace(/[^A-Za-z]/g, '').toUpperCase().split('');
}

/**
 * The filler written into the empty cells of the last row: x, y, z, then round
 * the alphabet. The textbook example pads with exactly these.
 */
const FILLER = 'xyzabcdefghijklmnopqrstuvw';

/**
 * The message with the last row filled out, so the grid is a full rectangle.
 *
 * The filler is lowercase unless every letter of the message is uppercase, so it
 * matches what it sits next to. Decrypting cannot tell filler from message, so it
 * comes back at the end of the plaintext. The reader is expected to see it and
 * drop it, as a clerk would.
 */
export function padToRectangle(text: string, columns: number): string {
  const short = (columns - (text.length % columns)) % columns;
  if (short === 0) return text;
  const letters = text.replace(/[^A-Za-z]/g, '');
  const upper = letters.length > 0 && letters === letters.toUpperCase();
  const filler = FILLER.slice(0, short);
  return text + (upper ? filler.toUpperCase() : filler);
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

/**
 * The cipher, untraced. Used by the benchmark and the attack.
 *
 * `pad` fills the last row before encrypting. It changes nothing when
 * decrypting: a padded ciphertext is a full rectangle, and the inverse of a full
 * rectangle is the same with or without it.
 */
export function columnar(
  text: string,
  keyword: string,
  direction: Direction = 'encrypt',
  pad = false,
): string {
  const width = keyOrder(keyword).length;
  if (width < MIN_COLUMNS) {
    throw new Error(
      `The key needs at least ${MIN_COLUMNS} letters or numbers — one column is not a transposition, it is a copy.`,
    );
  }
  if (width > MAX_COLUMNS) {
    throw new Error(
      `The key has ${width} columns, and this page stops at ${MAX_COLUMNS}. The cipher works with more; the grid stops being readable.`,
    );
  }

  if (direction === 'encrypt' && pad) text = padToRectangle(text, width);
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
  original: string,
  keyword: string,
  direction: Direction = 'encrypt',
  pad = false,
): TraceResult {
  const output = columnar(original, keyword, direction, pad);
  const columns = keyOrder(keyword).length;
  const ranks = keyRanks(keyword);
  const labels = keyLabels(keyword);

  // From here on the grid is a full rectangle when padding is on. Cells past the
  // end of `original` hold filler, which has no place in the input pane.
  const text = direction === 'encrypt' && pad ? padToRectangle(original, columns) : original;

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
    const keyLetter = labels[column] ?? '';
    const height = lengths[column] ?? 0;
    const filler = direction === 'encrypt' && cell >= original.length;
    const why = isNumericKey(keyword)
      ? `Column ${column + 1} is headed ${keyLetter}, so it is ${
          direction === 'encrypt' ? 'read out' : 'filled back in'
        } ${ordinal(rank)}.`
      : `Column ${column + 1} is headed ${keyLetter}, which is ${ordinal(rank)} in alphabetical order, so it is ${
          direction === 'encrypt' ? 'read out' : 'filled back in'
        } ${ordinal(rank)}.`;

    steps.push({
      index: position,
      title:
        direction === 'encrypt'
          ? `Read column ${column + 1} (${keyLetter}), row ${row + 1}`
          : `Refill column ${column + 1} (${keyLetter}), row ${row + 1}`,
      detail: `${why} This column holds ${height} character${height === 1 ? '' : 's'}. ${describeChar(
        char,
      )} sits at row ${row + 1}, position ${cell + 1} of the ${filler ? 'padded grid' : 'message'}, and lands at position ${
        outputIndex + 1
      } of the ${direction === 'encrypt' ? 'ciphertext' : 'message'}. ${
        filler
          ? 'It is filler, added only to square off the last row.'
          : 'The letter itself is unchanged — a transposition never substitutes.'
      }`,
      input: char,
      output: char,
      // Filler was never in the message box, so there is nothing there to light.
      ...(filler ? {} : { highlight: { start: inputIndex, end: inputIndex + 1 } }),
      outputHighlight: { start: outputIndex, end: outputIndex + 1 },
      data: {
        filler,
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
