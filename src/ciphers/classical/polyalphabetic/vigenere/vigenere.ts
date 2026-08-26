/**
 * The Vigenere cipher.
 *
 * Caesar shifts every letter by the same amount. Vigenere shifts every letter by
 * a different amount, taken from a repeating keyword: with the key LEMON, the
 * first letter moves 11 places (L), the second 4 (E), the third 12 (M), and after
 * five letters the key starts again.
 *
 * That one change breaks the attack that breaks Caesar. A single letter of
 * ciphertext no longer maps back to a single letter of plaintext, so counting
 * letters in the whole message tells an attacker almost nothing. What it does not
 * change is that the key repeats — and that is where the whole thing comes apart.
 * See `attack.ts`.
 *
 * Plain TypeScript. This file imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export const ALPHABET_SIZE = 26;

const UPPER_A = 'A'.charCodeAt(0);
const LOWER_A = 'a'.charCodeAt(0);

export type Direction = 'encrypt' | 'decrypt';

/** U+2212. A hyphen is not a minus sign, and people read this arithmetic. */
const MINUS = '−';

function signed(n: number): string {
  return n < 0 ? `${MINUS}${Math.abs(n)}` : String(n);
}

/** 0-25 for A-Z or a-z, and -1 for everything else. */
export function letterIndex(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= UPPER_A && code <= UPPER_A + 25) return code - UPPER_A;
  if (code >= LOWER_A && code <= LOWER_A + 25) return code - LOWER_A;
  return -1;
}

function isUpperCase(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= UPPER_A && code <= UPPER_A + 25;
}

function letterFromIndex(index: number, upper: boolean): string {
  return String.fromCharCode((upper ? UPPER_A : LOWER_A) + index);
}

/**
 * Reduces a typed key to the letters the cipher can actually use: A-Z, uppercase.
 *
 * "Lemon", "lemon", and "Lemon!" are the same key, and a person who types their
 * dog's name with a space in it should get a working cipher rather than an error.
 * Throws only when nothing at all is left, because a key of no letters is not a
 * weak key — it is an undefined operation.
 */
export function normaliseKey(key: string): string {
  const letters = key.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (letters.length === 0) {
    throw new Error('The key needs at least one letter A-Z.');
  }
  return letters;
}

/** The shift each key letter applies, in order. LEMON becomes [11, 4, 12, 14, 13]. */
export function keyShifts(key: string): number[] {
  return normaliseKey(key)
    .split('')
    .map((char) => letterIndex(char));
}

/**
 * The whole cipher, with no trace. Used by the attack (which runs it many times
 * over) and by the benchmark. `vigenereTrace` below is the same algorithm,
 * narrated.
 *
 * Note where the key advances: on letters only. A space does not consume a key
 * letter, so the key stays aligned to the letters of the message rather than to
 * its punctuation. Both conventions exist historically; this is the common one,
 * and it is the one the attack assumes.
 */
export function vigenere(text: string, key: string, direction: Direction = 'encrypt'): string {
  const shifts = keyShifts(key);
  const period = shifts.length;

  let out = '';
  let position = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    if (index === -1) {
      out += char;
      continue;
    }
    const shift = shifts[position % period] ?? 0;
    const effective = direction === 'encrypt' ? shift : ALPHABET_SIZE - shift;
    out += letterFromIndex((index + effective) % ALPHABET_SIZE, isUpperCase(char));
    position += 1;
  }
  return out;
}

/**
 * Names a character for a sentence a person reads. A literal space or newline
 * inside quotation marks is invisible, and invisible is not an explanation.
 */
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
 * The cipher again, this time emitting one `Step` per character — including the
 * characters it does not change, so a step's index is also its position in the
 * text and highlighting needs no lookup table.
 */
export function vigenereTrace(
  text: string,
  key: string,
  direction: Direction = 'encrypt',
): TraceResult {
  const normalised = normaliseKey(key);
  const shifts = keyShifts(normalised);
  const period = shifts.length;
  const sign = direction === 'encrypt' ? '+' : MINUS;

  const chars = splitChars(text);
  const steps: Step[] = [];
  let output = '';
  let position = 0;

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i] ?? '';
    const fromIndex = letterIndex(char);

    if (fromIndex === -1) {
      output += char;
      steps.push({
        index: i,
        title: `Pass ${describeChar(char)} through`,
        detail: `${describeChar(char)} is not a letter A-Z, so the cipher leaves it exactly as it is and the key does not advance. The next letter still gets key letter ${normalised.charAt(position % period)}. Punctuation and word breaks survive, and that is how the shape of the message leaks.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false, key: normalised, direction },
      });
      continue;
    }

    const upper = isUpperCase(char);
    const keyPosition = position % period;
    const keyChar = normalised.charAt(keyPosition);
    const shift = shifts[keyPosition] ?? 0;
    const effective = direction === 'encrypt' ? shift : ALPHABET_SIZE - shift;

    // `raw` is the arithmetic before wrapping — the number the reader is shown.
    const raw = direction === 'encrypt' ? fromIndex + shift : fromIndex - shift;
    const toIndex = (fromIndex + effective) % ALPHABET_SIZE;
    const toChar = letterFromIndex(toIndex, upper);
    output += toChar;
    position += 1;

    const wrapped = raw !== toIndex;
    const opening = `${char} is index ${fromIndex}. Key letter ${keyChar} is index ${shift}. ${fromIndex} ${sign} ${shift} =`;

    // The wrap is spelled out as one addition or subtraction rather than as
    // "mod 26". They agree mathematically, but a reader who tries -19 % 26 in a
    // JavaScript console gets -19 back, and a lesson should not set that trap.
    let detail: string;
    if (!wrapped) {
      detail = `${opening} ${toIndex} → ${toChar}`;
    } else if (raw < 0) {
      detail = `${opening} ${signed(raw)}, which falls off the front of the alphabet, so wrap round: ${signed(raw)} + 26 = ${toIndex} → ${toChar}`;
    } else {
      detail = `${opening} ${raw}, which runs past the end of the alphabet, so wrap round: ${raw} ${MINUS} 26 = ${toIndex} → ${toChar}`;
    }

    steps.push({
      index: i,
      title: `${direction === 'encrypt' ? 'Shift' : 'Unshift'} ${describeChar(char)} by ${shift} (key ${keyChar})`,
      detail,
      input: char,
      output: toChar,
      highlight: { start: i, end: i + 1 },
      data: {
        isLetter: true,
        upper,
        fromIndex,
        toIndex,
        from: char,
        to: toChar,
        shift,
        keyChar,
        keyPosition,
        key: normalised,
        wrapped,
        direction,
      },
    });
  }

  return { output, steps };
}

/**
 * Splits into UTF-16 code units rather than code points.
 *
 * That looks like a bug and is a deliberate choice: a step index must line up
 * with a string index so the highlight ranges are correct, and `String.prototype`
 * indexes by code unit. No A-Z letter is ever a surrogate pair, so the cipher
 * output is identical either way — an emoji is simply passed through as its two
 * halves, in two steps.
 */
function splitChars(text: string): string[] {
  return text.split('');
}
