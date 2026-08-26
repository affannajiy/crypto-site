/**
 * The Four-square cipher, Felix Delastelle.
 *
 * Playfair encrypts letter pairs with **one** square, and pays for it with three
 * special cases: same row, same column, and the rule that a doubled letter has to
 * be split with a filler. Four-square encrypts letter pairs with **four** squares
 * and has no special cases at all.
 *
 *     +-----------+-----------+
 *     |  plain    |  key one  |     Find the first letter in the top-left
 *     |  A B C D E|  (keyed)  |     square and the second in the bottom-right.
 *     |  F G H I K|           |     They mark the corners of a rectangle.
 *     +-----------+-----------+
 *     |  key two  |  plain    |     Read the other two corners: the first
 *     |  (keyed)  |  A B C D E|     ciphertext letter from the top-right
 *     |           |  F G H I K|     square, the second from the bottom-left.
 *     +-----------+-----------+
 *
 * Two keyed squares instead of one is a much bigger key — (25!)² if the squares are
 * arbitrary — and the rectangle rule always works, because the two plain squares
 * are on a diagonal and the two keyed squares are on the other. A pair never
 * degenerates.
 *
 * It is also, in one specific way, **weaker** than Playfair, and that is the
 * interesting part. See the explainer.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { type Square, at, buildSquare, locate } from '../../../../lib/polybius';
import { letterIndex } from '../../../../lib/letters';

export type Direction = 'encrypt' | 'decrypt';

export const SIZE = 5;
/** Added to make the letter count even. X is the traditional choice. */
export const PADDING = 'X';

export interface Squares {
  plain: Square;
  topRight: Square;
  bottomLeft: Square;
}

/** The four squares. Two are the plain alphabet, so only two are built from keys. */
export function buildSquares(keyOne: string, keyTwo: string): Squares {
  return {
    plain: buildSquare('', SIZE),
    topRight: buildSquare(keyOne, SIZE),
    bottomLeft: buildSquare(keyTwo, SIZE),
  };
}

export interface Prepared {
  letters: string;
  /** `sources[i]` is where letter `i` came from, or -1 for the padding letter. */
  sources: number[];
  padded: boolean;
}

/** Strips to the 25 letters the squares hold and pads to an even count. */
export function prepare(text: string): Prepared {
  let letters = '';
  const sources: number[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const raw = text.charAt(i);
    if (letterIndex(raw) === -1) continue;
    const char = raw.toUpperCase() === 'J' ? 'I' : raw.toUpperCase();
    letters += char;
    sources.push(i);
  }

  const padded = letters.length % 2 === 1;
  if (padded) {
    letters += PADDING;
    sources.push(-1);
  }

  return { letters, sources, padded };
}

/** One pair, encrypted. No special cases: the rectangle rule always applies. */
export function encipherPair(squares: Squares, first: string, second: string): [string, string] {
  const a = locate(squares.plain, first) ?? { row: 0, col: 0 };
  const b = locate(squares.plain, second) ?? { row: 0, col: 0 };
  return [at(squares.topRight, a.row, b.col), at(squares.bottomLeft, b.row, a.col)];
}

/** One pair, decrypted. The keyed squares are read and the plain ones are written. */
export function decipherPair(squares: Squares, first: string, second: string): [string, string] {
  const a = locate(squares.topRight, first) ?? { row: 0, col: 0 };
  const b = locate(squares.bottomLeft, second) ?? { row: 0, col: 0 };
  return [at(squares.plain, a.row, b.col), at(squares.plain, b.row, a.col)];
}

/** The cipher, untraced. Used by the benchmark. */
export function fourSquare(text: string, keyOne: string, keyTwo: string, direction: Direction): string {
  const squares = buildSquares(keyOne, keyTwo);
  const { letters } = prepare(text);
  let out = '';
  for (let i = 0; i + 1 < letters.length; i += 2) {
    const pair =
      direction === 'encrypt'
        ? encipherPair(squares, letters.charAt(i), letters.charAt(i + 1))
        : decipherPair(squares, letters.charAt(i), letters.charAt(i + 1));
    out += pair[0] + pair[1];
  }
  return out;
}

/** The span of the original text a pair at stripped index `i` came from. */
function inputRange(sources: number[], i: number): { start: number; end: number } {
  const first = sources[i] ?? 0;
  const second = sources[i + 1] ?? -1;
  const last = second === -1 ? first : second;
  return { start: first, end: last + 1 };
}

/** The cipher again, one `Step` per pair. */
export function fourSquareTrace(
  text: string,
  keyOne: string,
  keyTwo: string,
  direction: Direction,
): TraceResult {
  const squares = buildSquares(keyOne, keyTwo);
  const { letters, sources, padded } = prepare(text);
  const steps: Step[] = [];
  let output = '';

  for (let i = 0; i + 1 < letters.length; i += 2) {
    const first = letters.charAt(i);
    const second = letters.charAt(i + 1);
    const encrypting = direction === 'encrypt';
    const pair = encrypting
      ? encipherPair(squares, first, second)
      : decipherPair(squares, first, second);

    const a = locate(encrypting ? squares.plain : squares.topRight, first) ?? { row: 0, col: 0 };
    const b = locate(encrypting ? squares.plain : squares.bottomLeft, second) ?? { row: 0, col: 0 };
    const outputAt = output.length;
    output += pair[0] + pair[1];

    const isPad = padded && i + 1 === letters.length - 1;

    steps.push({
      index: steps.length,
      title: `${first}${second} → ${pair[0]}${pair[1]}`,
      detail: `${first} sits at row ${a.row + 1}, column ${a.col + 1} of the ${encrypting ? 'top-left plain' : 'top-right keyed'} square and ${second} at row ${b.row + 1}, column ${b.col + 1} of the ${encrypting ? 'bottom-right plain' : 'bottom-left keyed'} square. Those two positions are opposite corners of a rectangle; the answer is the other two corners, taken from the ${encrypting ? 'keyed' : 'plain'} squares — row ${a.row + 1} column ${b.col + 1} gives ${pair[0]}, and row ${b.row + 1} column ${a.col + 1} gives ${pair[1]}. There are no special cases: a repeated letter, a shared row and a shared column all work by the same rule, which is what Playfair could not manage with one square.${isPad ? ` The final ${PADDING} is padding — the message had an odd number of letters and pairs need two.` : ''}`,
      input: `${first}${second}`,
      output: `${pair[0]}${pair[1]}`,
      highlight: inputRange(sources, i),
      outputHighlight: { start: outputAt, end: outputAt + 2 },
      data: {
        isPair: true,
        first,
        second,
        cipherFirst: pair[0],
        cipherSecond: pair[1],
        firstAt: a,
        secondAt: b,
        direction,
        padded: isPad,
      },
    });
  }

  return { output, steps };
}
