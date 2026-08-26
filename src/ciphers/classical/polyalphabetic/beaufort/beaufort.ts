/**
 * The Beaufort cipher.
 *
 * Vigenere adds the key to the plaintext. Beaufort **subtracts the plaintext from
 * the key**, and that one sign change is the whole difference:
 *
 *     Vigenere:  C = P + K  (mod 26)
 *     Beaufort:  C = K - P  (mod 26)
 *
 * The consequence is out of all proportion to the change. Subtracting is its own
 * inverse in this arrangement — K - (K - P) = P — so encrypting a ciphertext with
 * the same key returns the plaintext. One operation, no direction flag, which is
 * why the Royal Navy could issue a slide rule for it: an operator with a Beaufort
 * rule cannot get the direction wrong, because there is no direction to get wrong.
 *
 * Named for Sir Francis Beaufort, of the wind scale. The German Kriegsmarine used
 * the same idea in a machine, and this file's `variant` is deliberately absent:
 * the *variant Beaufort* (C = P - K) is a different cipher that is exactly
 * Vigenere decryption, is not self-reciprocal, and would blur the one point this
 * page exists to make. The explainer describes it instead.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import {
  A_TO_Z,
  ALPHABET_SIZE,
  describeChar,
  isUpperCase,
  keyIndices,
  letterFromIndex,
  letterIndex,
  normalise,
} from '../../../../lib/letters';

/** The key letters as 0-25, or [0] for a key with no letters — see `beaufort`. */
export function keyValues(key: string): number[] {
  const values = keyIndices(key);
  return values.length === 0 ? [0] : values;
}

/** The key as the user's letters, uppercased and stripped. What the trace shows. */
export function normalisedKey(key: string): string {
  return keyValues(key)
    .map((n) => A_TO_Z.charAt(n))
    .join('');
}

/** The cipher's one operation: C = K - P, and P = K - C. */
export function beaufortLetter(plain: number, key: number): number {
  return normalise(key - plain);
}

/**
 * The cipher, untraced. Used by the benchmark.
 *
 * There is no `direction`. That is not a missing feature — applying this function
 * to its own output with the same key gives back the input, and a test asserts it.
 */
export function beaufort(text: string, key: string): string {
  const values = keyValues(key);
  const period = values.length;
  let out = '';
  let position = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    if (index === -1) {
      // The key advances on letters only, matching Vigenere on this page.
      out += char;
      continue;
    }
    const key_ = values[position % period] ?? 0;
    out += letterFromIndex(beaufortLetter(index, key_), isUpperCase(char));
    position += 1;
  }

  return out;
}

/** The cipher again, emitting one `Step` per character, non-letters included. */
export function beaufortTrace(text: string, key: string): TraceResult {
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
        detail: `${describeChar(char)} is not a letter A-Z, so it is left alone and the key does not advance. The next letter still gets key letter ${normalised.charAt(position % period)}.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false, key: normalised },
      });
      continue;
    }

    const keyPosition = position % period;
    const keyChar = normalised.charAt(keyPosition);
    const keyValue = values[keyPosition] ?? 0;
    const raw = keyValue - fromIndex;
    const toIndex = normalise(raw);
    const upper = isUpperCase(char);
    const toChar = letterFromIndex(toIndex, upper);
    output += toChar;

    steps.push({
      index: i,
      title: `${keyChar} − ${char.toUpperCase()} → ${toChar.toUpperCase()}`,
      detail: `Key letter ${keyChar} is ${keyValue} and ${char.toUpperCase()} is ${fromIndex}, counting from A = 0. ${keyValue} − ${fromIndex} = ${raw}${raw < 0 ? `, and adding 26 to bring it back into range gives ${toIndex}` : ` = ${toIndex}`} → ${toChar.toUpperCase()}. Subtracting is what makes this cipher its own inverse: ${keyValue} − ${toIndex} = ${fromIndex} brings ${char.toUpperCase()} straight back.`,
      input: char,
      output: toChar,
      highlight: { start: i, end: i + 1 },
      data: {
        isLetter: true,
        upper,
        fromIndex,
        toIndex,
        keyValue,
        keyChar,
        keyPosition,
        key: normalised,
        wrapped: raw < 0,
      },
    });

    position += 1;
  }

  return { output, steps };
}

/**
 * One row of the Beaufort tableau, for the visualizer: where each plaintext
 * letter lands under a given key letter. Row `k` is the alphabet reversed and
 * then rotated, which is what the printed tables actually show.
 */
export function tableauRow(keyValue: number): string {
  let row = '';
  for (let p = 0; p < ALPHABET_SIZE; p += 1) {
    row += A_TO_Z.charAt(beaufortLetter(p, keyValue));
  }
  return row;
}
