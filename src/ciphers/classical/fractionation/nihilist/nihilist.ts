/**
 * The Nihilist cipher.
 *
 * Used by Russian revolutionaries against the Tsarist secret police in the 1880s,
 * and it is the first cipher in this app whose output is **numbers**. That is not
 * cosmetic: it is the whole design.
 *
 *   1. A keyed 5x5 square turns each letter into a two-digit coordinate, 11 to 55.
 *   2. A keyword, turned into numbers the same way and repeated, is **added** to
 *      the message numbers — as ordinary arithmetic, with no carrying between the
 *      two digits and no reduction modulo anything.
 *
 *     letter   A    T    T    A    C    K
 *     plain    11   44   44   11   13   25
 *     key      31   24   15   31   24   15
 *     sum      42   68   59   42   37   40
 *
 * The sums range from 22 to 110, which means the ciphertext leaks its own
 * structure: a value above 55 tells you something, a value in the 100s tells you
 * more, and the range of each digit is not uniform. Vigenere reduces mod 26 and
 * throws that away. Nihilist does not, and it is the reason this cipher is weaker
 * than the Vigenere it otherwise resembles.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { type Square, buildSquare, locate } from '../../../../lib/polybius';
import { describeChar, letterIndex } from '../../../../lib/letters';

export type Direction = 'encrypt' | 'decrypt';

export const SIZE = 5;

/** The two-digit coordinate of a letter: row and column, both counted from 1. */
export function numberFor(square: Square, char: string): number {
  const where = locate(square, char);
  if (where === null) return 0;
  return (where.row + 1) * 10 + (where.col + 1);
}

/** The letter a coordinate stands for, or '' when the number is not a valid cell. */
export function letterFor(square: Square, value: number): string {
  const row = Math.floor(value / 10) - 1;
  const col = (value % 10) - 1;
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return '';
  return square.cells[row * SIZE + col] ?? '';
}

/** The keyword as its coordinate numbers, or [11] when it has no usable letters. */
export function keyNumbers(square: Square, keyword: string): number[] {
  const out: number[] = [];
  for (const raw of keyword) {
    if (letterIndex(raw) === -1) continue;
    const char = raw.toUpperCase() === 'J' ? 'I' : raw.toUpperCase();
    out.push(numberFor(square, char));
  }
  return out.length === 0 ? [11] : out;
}

/** The numbers in a ciphertext. Anything that is not a run of digits is ignored. */
export function parseNumbers(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map((n) => Number(n));
}

/** The cipher, untraced. Used by the benchmark. */
export function nihilist(
  text: string,
  squareKeyword: string,
  additive: string,
  direction: Direction,
): string {
  const square = buildSquare(squareKeyword, SIZE);
  const key = keyNumbers(square, additive);

  if (direction === 'decrypt') {
    const values = parseNumbers(text);
    let out = '';
    values.forEach((value, i) => {
      out += letterFor(square, value - (key[i % key.length] ?? 0));
    });
    return out;
  }

  const out: number[] = [];
  let position = 0;
  for (const raw of text) {
    if (letterIndex(raw) === -1) continue;
    const char = raw.toUpperCase() === 'J' ? 'I' : raw.toUpperCase();
    out.push(numberFor(square, char) + (key[position % key.length] ?? 0));
    position += 1;
  }
  return out.join(' ');
}

/** The cipher again, one `Step` per letter or per number. */
export function nihilistTrace(
  text: string,
  squareKeyword: string,
  additive: string,
  direction: Direction,
): TraceResult {
  const square = buildSquare(squareKeyword, SIZE);
  const key = keyNumbers(square, additive);
  const keyText = additive.replace(/[^A-Za-z]/g, '').toUpperCase() || 'A';
  const steps: Step[] = [];

  if (direction === 'decrypt') {
    const values = parseNumbers(text);
    let output = '';
    values.forEach((value, i) => {
      const keyValue = key[i % key.length] ?? 0;
      const plainValue = value - keyValue;
      const letter = letterFor(square, plainValue);
      const outputAt = output.length;
      output += letter;
      steps.push({
        index: i,
        title: `${value} − ${keyValue} = ${plainValue} → ${letter === '' ? '?' : letter}`,
        detail:
          letter === ''
            ? `${value} − ${keyValue} = ${plainValue}, which is not a cell of the square: both digits have to be between 1 and 5. Either the key is wrong here or the number was mistyped. Notice that you can tell — a wrong key produces an impossible number rather than a plausible wrong letter, which is exactly the leak that breaks this cipher.`
            : `${value} − ${keyValue} = ${plainValue}, which is row ${Math.floor(plainValue / 10)}, column ${plainValue % 10} of the square: ${letter}. Key letter ${keyText.charAt(i % keyText.length)} supplied the ${keyValue}.`,
        input: String(value),
        output: letter,
        outputHighlight: { start: outputAt, end: outputAt + 1 },
        data: { isLetter: letter !== '', value, keyValue, plainValue, letter, keyText },
      });
    });
    return { output, steps };
  }

  const parts: string[] = [];
  let position = 0;
  for (let i = 0; i < text.length; i += 1) {
    const raw = text.charAt(i);
    if (letterIndex(raw) === -1) {
      steps.push({
        index: i,
        title: `Drop ${describeChar(raw)}`,
        detail: `The output is a list of numbers, so ${describeChar(raw)} has nowhere to go and is discarded along with all other spacing and punctuation.`,
        input: raw,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false },
      });
      continue;
    }

    const char = raw.toUpperCase() === 'J' ? 'I' : raw.toUpperCase();
    const plainValue = numberFor(square, char);
    const keyValue = key[position % key.length] ?? 0;
    const sum = plainValue + keyValue;
    const outputAt = parts.join(' ').length + (parts.length === 0 ? 0 : 1);
    parts.push(String(sum));

    steps.push({
      index: i,
      title: `${char} = ${plainValue}, + ${keyValue} = ${sum}`,
      detail: `${char} sits at row ${Math.floor(plainValue / 10)}, column ${plainValue % 10}, so it is written ${plainValue}. Key letter ${keyText.charAt(position % keyText.length)} is ${keyValue}, and ${plainValue} + ${keyValue} = ${sum}. The addition is plain arithmetic: no carrying between the digits and no reduction, so the answer can be anything from 22 to 110.${sum > 55 ? ` This one is above 55, which already tells an eavesdropper that the key digit was large.` : ''}`,
      input: raw,
      output: String(sum),
      highlight: { start: i, end: i + 1 },
      outputHighlight: { start: outputAt, end: outputAt + String(sum).length },
      data: { isLetter: true, char, plainValue, keyValue, sum, position, keyText },
    });

    position += 1;
  }

  return { output: parts.join(' '), steps };
}
