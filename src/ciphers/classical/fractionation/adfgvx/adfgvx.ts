/**
 * ADFGVX, the German field cipher of 1918.
 *
 * The most sophisticated cipher of the First World War, and the one that shows
 * most clearly what a *real* cipher is made of: not one clever idea, but two
 * ordinary ideas composed so that each covers the other's weakness.
 *
 *   1. **Fractionate.** A keyed 6x6 square holds the 26 letters *and* the ten
 *      digits — which is why the German army could send map references, and why
 *      Playfair could not. Rows and columns are labelled A, D, F, G, V, X, so each
 *      character becomes two of those six letters. The message doubles in length.
 *
 *   2. **Transpose.** The doubled string is then written under a keyword and read
 *      off by columns — the Columnar Transposition already on this site, imported
 *      rather than re-implemented, because that is exactly what it is.
 *
 * Either half alone is weak. A fractionating substitution is a substitution:
 * counting pairs breaks it. A columnar transposition preserves every letter:
 * counting letters and anagramming breaks it. Composed, the transposition scatters
 * the two halves of each character to distant parts of the message, so the
 * substitution has no pairs left to count, and the transposition has no ordinary
 * language left to anagram.
 *
 * The six letters are not arbitrary. In Morse code A, D, F, G, V and X are as far
 * apart as any six characters get, which minimised the chance of an operator
 * mishearing one as another over a noisy wireless link. That is engineering, not
 * cryptography, and it is the kind of detail that decides whether a cipher is used.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { type Square, buildSquare, locate } from '../../../../lib/polybius';
import { columnarOrder, invert } from '../../transposition/columnar/columnar';

export type Direction = 'encrypt' | 'decrypt';

export const SIZE = 6;
/** The six labels, chosen because they are unmistakable in Morse. */
export const LABELS = 'ADFGVX';

/** The 6x6 square: 26 letters and ten digits, keyword first. */
export function buildGrid(keyword: string): Square {
  return buildSquare(keyword, SIZE);
}

/** Uppercases and keeps only what the square holds: letters and digits. */
export function cleanMessage(text: string): { chars: string; sources: number[] } {
  let chars = '';
  const sources: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i).toUpperCase();
    if (/[A-Z0-9]/.test(char)) {
      chars += char;
      sources.push(i);
    }
  }
  return { chars, sources };
}

/** The fractionated string: two label letters per message character. */
export function fractionate(square: Square, chars: string): string {
  let out = '';
  for (const char of chars) {
    const where = locate(square, char);
    out += LABELS.charAt(where?.row ?? 0) + LABELS.charAt(where?.col ?? 0);
  }
  return out;
}

/** Reads a fractionated string back into message characters. */
export function defractionate(square: Square, pairs: string): string {
  let out = '';
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const row = LABELS.indexOf(pairs.charAt(i));
    const col = LABELS.indexOf(pairs.charAt(i + 1));
    if (row === -1 || col === -1) continue;
    out += square.cells[row * SIZE + col] ?? '';
  }
  return out;
}

/** Only the six label letters, uppercased. Everything else in the input is noise. */
export function labelsOnly(text: string): string {
  let out = '';
  for (const char of text.toUpperCase()) {
    if (LABELS.includes(char)) out += char;
  }
  return out;
}

/** Applies the columnar transposition. `order[outputIndex] = inputIndex`. */
export function transpose(text: string, keyword: string): string {
  const order = columnarOrder(text.length, keyword);
  let out = '';
  for (const from of order) out += text.charAt(from);
  return out;
}

/** Undoes the columnar transposition. */
export function untranspose(text: string, keyword: string): string {
  const order = invert(columnarOrder(text.length, keyword));
  let out = '';
  for (const from of order) out += text.charAt(from);
  return out;
}

/** Groups a string into fives, which is how it went out over the wire. */
export function inFives(text: string): string {
  return (text.match(/.{1,5}/g) ?? []).join(' ');
}

/** The cipher, untraced. Used by the benchmark. */
export function adfgvx(
  text: string,
  squareKeyword: string,
  transKeyword: string,
  direction: Direction,
): string {
  const square = buildGrid(squareKeyword);

  if (direction === 'decrypt') {
    return defractionate(square, untranspose(labelsOnly(text), transKeyword));
  }

  const { chars } = cleanMessage(text);
  return inFives(transpose(fractionate(square, chars), transKeyword));
}

/**
 * The cipher again, in stages rather than per character.
 *
 * One `Step` per message character for the fractionation, then one step for the
 * transposition as a whole. That asymmetry is honest: the fractionation genuinely
 * happens character by character, and the transposition genuinely does not — it
 * cannot be described until the entire string exists.
 */
export function adfgvxTrace(
  text: string,
  squareKeyword: string,
  transKeyword: string,
  direction: Direction,
): TraceResult {
  const square = buildGrid(squareKeyword);
  const steps: Step[] = [];

  if (direction === 'decrypt') {
    const wire = labelsOnly(text);
    const pairs = untranspose(wire, transKeyword);
    const output = defractionate(square, pairs);

    steps.push({
      index: 0,
      title: `Undo the transposition (${wire.length} letters)`,
      detail: `The columns are read back in the order the keyword "${transKeyword.toUpperCase()}" gives, which puts the two halves of each character back next to each other. Until this is done the pairs are meaningless, which is exactly why the two stages together are so much stronger than either alone.`,
      input: wire,
      output: pairs,
      data: { stage: 'transpose', wire, pairs },
    });

    for (let i = 0; i + 1 < pairs.length; i += 2) {
      const row = LABELS.indexOf(pairs.charAt(i));
      const col = LABELS.indexOf(pairs.charAt(i + 1));
      const char = square.cells[row * SIZE + col] ?? '?';
      const outputAt = i / 2;
      steps.push({
        index: steps.length,
        title: `${pairs.charAt(i)}${pairs.charAt(i + 1)} → ${char}`,
        detail: `Row ${pairs.charAt(i)}, column ${pairs.charAt(i + 1)} of the square is ${char}.`,
        input: pairs.slice(i, i + 2),
        output: char,
        outputHighlight: { start: outputAt, end: outputAt + 1 },
        data: { stage: 'lookup', row, col, char },
      });
    }

    return { output, steps };
  }

  const { chars, sources } = cleanMessage(text);
  const pairs = fractionate(square, chars);

  chars.split('').forEach((char, i) => {
    const where = locate(square, char) ?? { row: 0, col: 0 };
    const at = sources[i] ?? 0;
    steps.push({
      index: steps.length,
      title: `${char} → ${LABELS.charAt(where.row)}${LABELS.charAt(where.col)}`,
      detail: `${char} sits at row ${LABELS.charAt(where.row)}, column ${LABELS.charAt(where.col)} of the 6×6 square, so it is written as those two letters. The square holds digits as well as letters, which is why this cipher could send map references and grid coordinates — Playfair's 5×5 square could not.`,
      input: char,
      output: `${LABELS.charAt(where.row)}${LABELS.charAt(where.col)}`,
      highlight: { start: at, end: at + 1 },
      data: { stage: 'fractionate', char, row: where.row, col: where.col },
    });
  });

  const scrambled = transpose(pairs, transKeyword);
  const output = inFives(scrambled);

  steps.push({
    index: steps.length,
    title: `Transpose all ${pairs.length} letters under "${transKeyword.toUpperCase()}"`,
    detail: `The whole fractionated string is written in rows under the keyword and read off one column at a time, in the keyword's alphabetical order. This is the Columnar Transposition from elsewhere on this site — the code is imported, not copied. The effect is that the two halves of each character end up far apart: the row letter of the first character and its column letter are now separated by most of the message, so counting pairs in the ciphertext tells an analyst nothing about the square.`,
    input: pairs,
    output: scrambled,
    data: { stage: 'transpose', pairs, scrambled, keyword: transKeyword.toUpperCase() },
  });

  return { output, steps };
}
