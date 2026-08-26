/**
 * The Playfair cipher.
 *
 * The first cipher here that does not work one letter at a time. Playfair
 * encrypts **pairs** of letters, and that single change is what makes it
 * genuinely harder than everything before it: the letter E does not have an
 * encryption, only EA, EB, EC and so on do, and a table of single-letter
 * frequencies has nothing to bite on.
 *
 * Invented by Charles Wheatstone in 1854 and named after Lord Playfair, who
 * promoted it. Britain used it in the Boer War and both world wars, for traffic
 * that needed to stay secret for hours rather than years.
 *
 * The cost of working on pairs is that the cipher stops preserving your text.
 * Spaces and punctuation are dropped, J is folded into I, doubled letters get an
 * X wedged between them, and an odd length gets padded. The output is a different
 * length from the input, which is why every step carries `outputHighlight`.
 *
 * Plain TypeScript. This file imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export type Direction = 'encrypt' | 'decrypt';

export const SIZE = 5;

/**
 * J is missing on purpose. A 5x5 square holds 25 letters and the alphabet has 26,
 * so one has to go; folding J into I is the traditional choice and the one that
 * costs a reader the least, because J is rare and "IAM" still reads as "JAM".
 */
export const SQUARE_ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';

/** Wedged between a doubled pair, and used to pad an odd length. */
export const PADDING = 'X';
/** Used instead when the letter needing padding is itself an X. */
export const ALTERNATE_PADDING = 'Q';

/**
 * Builds the 5x5 square: the keyword's letters first, in order, each used once,
 * then the rest of the alphabet.
 *
 * This is the entire key. Note how little of it the keyword really controls —
 * once the keyword runs out, the remaining letters follow in plain alphabetical
 * order, so the bottom rows of most squares look very similar to each other.
 */
export function buildSquare(keyword: string): string {
  const seen = new Set<string>();
  let square = '';
  for (const char of `${keyword}${SQUARE_ALPHABET}`.toUpperCase()) {
    const letter = char === 'J' ? 'I' : char;
    if (!SQUARE_ALPHABET.includes(letter) || seen.has(letter)) continue;
    seen.add(letter);
    square += letter;
  }
  return square;
}

/** Where a letter sits in the square, as row and column. */
export function findPosition(square: string, letter: string): { row: number; column: number } {
  const index = square.indexOf(letter === 'J' ? 'I' : letter);
  // Every square holds all 25 letters, so this only fires on a non-letter, which
  // `prepare` has already removed before any of this runs.
  if (index === -1) return { row: 0, column: 0 };
  return { row: Math.floor(index / SIZE), column: index % SIZE };
}

/** One letter of the prepared text, and where it came from in what the user typed. */
export interface PreparedLetter {
  letter: string;
  /** Index in the original text, or -1 for a letter the cipher inserted itself. */
  source: number;
}

/**
 * Turns typed text into the letter pairs Playfair actually encrypts.
 *
 * Four things happen here, and all four are lossy:
 *
 *   1. Anything that is not A-Z is dropped. Spaces and punctuation cannot survive
 *      a cipher whose unit is a pair.
 *   2. J becomes I, because the square has no J.
 *   3. A pair of identical letters gets a padding letter wedged between them.
 *      Playfair cannot encrypt a doubled pair — the rules below have nothing to
 *      say about a letter and itself.
 *   4. An odd number of letters gets one padding letter on the end.
 *
 * Each prepared letter remembers which character of the original it came from, so
 * the Encrypt tab can still point at the right part of the message the user typed.
 */
export function prepare(text: string): PreparedLetter[] {
  const letters: PreparedLetter[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const upper = text.charAt(i).toUpperCase();
    if (upper < 'A' || upper > 'Z') continue;
    letters.push({ letter: upper === 'J' ? 'I' : upper, source: i });
  }

  const prepared: PreparedLetter[] = [];
  for (let i = 0; i < letters.length; i += 1) {
    const current = letters[i];
    if (current === undefined) continue;
    prepared.push(current);

    const next = letters[i + 1];
    // A doubled pair only matters when the two letters would land in the same
    // pair, which is when the first of them is at an even position.
    if (next !== undefined && next.letter === current.letter && prepared.length % 2 === 1) {
      prepared.push({
        letter: current.letter === PADDING ? ALTERNATE_PADDING : PADDING,
        source: -1,
      });
    }
  }

  if (prepared.length % 2 === 1) {
    const last = prepared[prepared.length - 1];
    prepared.push({
      letter: last?.letter === PADDING ? ALTERNATE_PADDING : PADDING,
      source: -1,
    });
  }

  return prepared;
}

/** Which of Playfair's three rules a pair falls under. */
export type Rule = 'row' | 'column' | 'rectangle';

export function classify(
  a: { row: number; column: number },
  b: { row: number; column: number },
): Rule {
  if (a.row === b.row) return 'row';
  if (a.column === b.column) return 'column';
  return 'rectangle';
}

function at(square: string, row: number, column: number): string {
  return square.charAt(row * SIZE + column);
}

/**
 * Encrypts or decrypts one pair.
 *
 * Three rules, and the third is the one doing the real work:
 *
 *   - **Same row**: each letter moves one place right, wrapping round the edge.
 *   - **Same column**: each letter moves one place down, wrapping round.
 *   - **Otherwise**: the two letters are opposite corners of a rectangle, and each
 *     is replaced by the corner in its own row. The rows stay; the columns swap.
 *
 * Decrypting moves left and up instead. The rectangle rule needs no reversing at
 * all — swapping the columns twice puts them back — which is worth noticing, and
 * is also why a Playfair square is its own decryption table.
 */
export function transformPair(
  square: string,
  first: string,
  second: string,
  direction: Direction = 'encrypt',
): { output: string; rule: Rule } {
  const a = findPosition(square, first);
  const b = findPosition(square, second);
  const rule = classify(a, b);
  const step = direction === 'encrypt' ? 1 : SIZE - 1;

  if (rule === 'row') {
    return {
      output: at(square, a.row, (a.column + step) % SIZE) + at(square, b.row, (b.column + step) % SIZE),
      rule,
    };
  }
  if (rule === 'column') {
    return {
      output:
        at(square, (a.row + step) % SIZE, a.column) + at(square, (b.row + step) % SIZE, b.column),
      rule,
    };
  }
  return { output: at(square, a.row, b.column) + at(square, b.row, a.column), rule };
}

/**
 * The whole cipher, with no trace. Used by the benchmark. `playfairTrace` below
 * is the same algorithm, narrated.
 */
export function playfair(text: string, keyword: string, direction: Direction = 'encrypt'): string {
  const square = buildSquare(keyword);
  const prepared = prepare(text);

  let out = '';
  for (let i = 0; i + 1 < prepared.length; i += 2) {
    const first = prepared[i]?.letter ?? '';
    const second = prepared[i + 1]?.letter ?? '';
    out += transformPair(square, first, second, direction).output;
  }
  return out;
}

/** Names the rule in the words the explainer uses. */
function describeRule(rule: Rule, direction: Direction): string {
  const sideways = direction === 'encrypt' ? 'right' : 'left';
  const vertical = direction === 'encrypt' ? 'below' : 'above';
  switch (rule) {
    case 'row':
      return `Both letters are in the same row, so each is replaced by the letter to its ${sideways}, wrapping round the edge of the square.`;
    case 'column':
      return `Both letters are in the same column, so each is replaced by the letter ${vertical} it, wrapping round the edge of the square.`;
    default:
      return 'The two letters are opposite corners of a rectangle, so each is replaced by the corner in its own row. The rows stay put and the columns swap.';
  }
}

/**
 * The cipher again, this time emitting one `Step` per **pair** rather than per
 * character — because the pair is what this cipher actually operates on, and a
 * step that showed one letter would be describing something Playfair never does.
 *
 * The highlight ranges are the reason `Step.outputHighlight` exists. The input
 * range points back at the two characters of the message the pair came from,
 * which may be separated by a space; the output range is simply two characters
 * wide at twice the pair number. Input and output are not the same length here,
 * so nothing else would work.
 */
export function playfairTrace(
  text: string,
  keyword: string,
  direction: Direction = 'encrypt',
): TraceResult {
  const square = buildSquare(keyword);
  const prepared = prepare(text);

  const steps: Step[] = [];
  let output = '';

  for (let i = 0; i + 1 < prepared.length; i += 2) {
    const firstLetter = prepared[i];
    const secondLetter = prepared[i + 1];
    if (firstLetter === undefined || secondLetter === undefined) break;

    const first = firstLetter.letter;
    const second = secondLetter.letter;
    const a = findPosition(square, first);
    const b = findPosition(square, second);
    const { output: pair, rule } = transformPair(square, first, second, direction);
    output += pair;

    const pairIndex = i / 2;
    const sources = [firstLetter.source, secondLetter.source].filter((s) => s >= 0);
    const inserted = firstLetter.source < 0 || secondLetter.source < 0;

    const detail = `${first}${second} sits at row ${a.row + 1} column ${a.column + 1} and row ${b.row + 1} column ${b.column + 1}. ${describeRule(rule, direction)} ${first}${second} becomes ${pair}.${
      inserted
        ? ' One of these letters was inserted by the cipher, not typed by you — see the padding rule.'
        : ''
    }`;

    steps.push({
      index: pairIndex,
      title: `${first}${second} → ${pair} (${rule})`,
      detail,
      input: `${first}${second}`,
      output: pair,
      // Points back at the characters the user actually typed. A pair whose two
      // letters straddle a space covers the space too, which is honest: that is
      // where in the message this pair came from.
      ...(sources.length > 0
        ? {
            highlight: {
              start: Math.min(...sources),
              end: Math.max(...sources) + 1,
            },
          }
        : {}),
      outputHighlight: { start: pairIndex * 2, end: pairIndex * 2 + 2 },
      data: {
        pairIndex,
        first,
        second,
        result: pair,
        rule,
        firstPosition: a,
        secondPosition: b,
        inserted,
        square,
        direction,
      },
    });
  }

  return { output, steps };
}
