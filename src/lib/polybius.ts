/**
 * Keyed Polybius squares, shared by every cipher that fractionates a letter into
 * coordinates: Bifid, Four-square, ADFGVX and Nihilist.
 *
 * A square is built by writing a keyword first — each letter used once, in the
 * order it first appears — and then the rest of the alphabet. That is the same
 * construction Playfair uses, and Playfair keeps its own copy: it was written
 * first, it is tested, and rewriting it to share this file would be churn.
 *
 * Two sizes matter. **5x5** holds 25 cells and so must drop a letter — this file
 * merges J into I, the usual choice. **6x6** holds 36 and takes the digits too,
 * which is why ADFGVX could send map references and Playfair could not.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */

export const ALPHABET_25 = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
export const ALPHABET_36 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export interface Square {
  /** Row-major cells, `size * size` of them. */
  cells: string[];
  size: number;
  /** True when J was folded into I, so the UI can say so rather than guess. */
  mergesIJ: boolean;
}

/**
 * Uppercases, drops anything not in `alphabet`, and folds J to I when the
 * alphabet has no J. Exported because the callers need to show the user what
 * their keyword actually became.
 */
export function cleanFor(alphabet: string, text: string): string {
  const mergesIJ = !alphabet.includes('J');
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    let char = text.charAt(i).toUpperCase();
    if (mergesIJ && char === 'J') char = 'I';
    if (alphabet.includes(char)) out += char;
  }
  return out;
}

/** The keyword's letters, each kept only the first time it appears. */
export function keyLetters(alphabet: string, keyword: string): string {
  const seen = new Set<string>();
  let out = '';
  for (const char of cleanFor(alphabet, keyword)) {
    if (!seen.has(char)) {
      seen.add(char);
      out += char;
    }
  }
  return out;
}

/** Builds the square: keyword first, then the alphabet's remaining letters. */
export function buildSquare(keyword: string, size: 5 | 6 = 5): Square {
  const alphabet = size === 5 ? ALPHABET_25 : ALPHABET_36;
  const head = keyLetters(alphabet, keyword);
  const seen = new Set(head.split(''));
  let cells = head;
  for (const char of alphabet) {
    if (!seen.has(char)) cells += char;
  }
  return { cells: cells.split(''), size, mergesIJ: size === 5 };
}

/** Zero-based row and column of a letter, or null when it is not in the square. */
export function locate(square: Square, char: string): { row: number; col: number } | null {
  const at = square.cells.indexOf(char);
  if (at === -1) return null;
  return { row: Math.floor(at / square.size), col: at % square.size };
}

/** The letter at a coordinate. Wraps nothing: out of range is a programming error. */
export function at(square: Square, row: number, col: number): string {
  return square.cells[row * square.size + col] ?? '';
}
