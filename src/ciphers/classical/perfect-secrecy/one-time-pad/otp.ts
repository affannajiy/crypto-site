/**
 * The one-time pad.
 *
 * Take Vigenere. Make the key as long as the message, make it genuinely random,
 * and never use it twice. Those three conditions turn the weakest interesting
 * cipher in this app into the only one that **cannot be broken** — not "has not
 * been broken yet", not "would take too long", but cannot, ever, by anyone, with
 * any amount of computing power. Shannon proved it in 1949.
 *
 * The arithmetic is Vigenere's, unchanged:
 *
 *     C = (P + K) mod 26
 *
 * Everything that matters is in the conditions, not the algorithm. So this file
 * is mostly about **refusing** to run when they are not met, and that refusal is
 * the lesson rather than an inconvenience around it.
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

/** Reduces a typed pad to the letters it can actually use: A-Z, uppercase. */
export function normalisePad(pad: string): string {
  return pad.replace(/[^A-Za-z]/g, '').toUpperCase();
}

/** How many letters of pad a message needs — one per letter, punctuation excluded. */
export function letterCount(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (letterIndex(text.charAt(i)) !== -1) count += 1;
  }
  return count;
}

/**
 * Refuses to encrypt with a pad that is too short — and this is the whole point
 * of the file, not a guard clause.
 *
 * Every other cipher here shortens the key and carries on. Vigenere repeats a
 * five-letter keyword across a whole paragraph and that repetition is exactly
 * what breaks it. A one-time pad that repeats **is** Vigenere: same arithmetic,
 * same weakness, none of the proof. There is no partial credit, so rather than
 * silently degrading into a weaker cipher, this stops and says so.
 */
export function assertPadLongEnough(text: string, pad: string): void {
  const needed = letterCount(text);
  const available = normalisePad(pad).length;
  if (available >= needed) return;

  const short = needed - available;
  throw new Error(
    `The pad is ${short} letter${short === 1 ? '' : 's'} too short. A one-time pad has to be at least as long as the message — ${needed} letters here, and the pad has ${available}. Repeating it to make up the difference would turn this back into a Vigenère cipher, which is breakable, so the cipher stops instead.`,
  );
}

/**
 * The whole cipher, with no trace. Used by the benchmark. `oneTimePadTrace`
 * below is the same algorithm, narrated.
 *
 * The pad advances on letters only, so punctuation and spacing do not consume
 * pad — which is a small mercy for a scarce resource, and also means the shape of
 * the message leaks exactly as it does in Caesar. See the explainer.
 */
export function oneTimePad(text: string, pad: string, direction: Direction = 'encrypt'): string {
  assertPadLongEnough(text, pad);
  const key = normalisePad(pad);

  let out = '';
  let position = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    if (index === -1) {
      out += char;
      continue;
    }
    const shift = letterIndex(key.charAt(position));
    const effective = direction === 'encrypt' ? shift : ALPHABET_SIZE - shift;
    out += letterFromIndex((index + effective) % ALPHABET_SIZE, isUpperCase(char));
    position += 1;
  }
  return out;
}

/**
 * Subtracts one ciphertext from another, letter by letter.
 *
 * This function is the reason the Visualize tab exists. If two messages are
 * encrypted with the **same** pad:
 *
 *     C1 = P1 + K       C2 = P2 + K
 *     C1 − C2 = (P1 + K) − (P2 + K) = P1 − P2
 *
 * The key cancels. Completely. An attacker who never learns a single letter of
 * the pad still ends up holding the difference of the two plaintexts, and English
 * is structured enough that two overlapping messages can be pulled apart from
 * their difference alone. One reuse destroys the entire proof.
 */
export function difference(first: string, second: string): string {
  const a = normalisePad(first);
  const b = normalisePad(second);
  const length = Math.min(a.length, b.length);

  let out = '';
  for (let i = 0; i < length; i += 1) {
    const x = letterIndex(a.charAt(i));
    const y = letterIndex(b.charAt(i));
    out += letterFromIndex(((x - y) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE, true);
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
export function oneTimePadTrace(
  text: string,
  pad: string,
  direction: Direction = 'encrypt',
): TraceResult {
  assertPadLongEnough(text, pad);
  const key = normalisePad(pad);
  const sign = direction === 'encrypt' ? '+' : MINUS;

  const chars = text.split('');
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
        detail: `${describeChar(char)} is not a letter A-Z, so it is left exactly as it is and no pad letter is spent on it. Spacing and punctuation survive untouched — the one thing a one-time pad does not hide.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false, direction },
      });
      continue;
    }

    const upper = isUpperCase(char);
    const padChar = key.charAt(position);
    const shift = letterIndex(padChar);
    const effective = direction === 'encrypt' ? shift : ALPHABET_SIZE - shift;
    const raw = direction === 'encrypt' ? fromIndex + shift : fromIndex - shift;
    const toIndex = (fromIndex + effective) % ALPHABET_SIZE;
    const toChar = letterFromIndex(toIndex, upper);
    output += toChar;
    position += 1;

    const wrapped = raw !== toIndex;
    const detail = `${char} is index ${fromIndex}. Pad letter ${position} is ${padChar}, index ${shift}. ${fromIndex} ${sign} ${shift} = ${raw}${
      wrapped ? `, wrapped into the alphabet as ${toIndex}` : ''
    } → ${toChar}. This pad letter is now used up and must never be used again.`;

    steps.push({
      index: i,
      title: `${direction === 'encrypt' ? 'Add' : 'Subtract'} pad letter ${padChar} (${shift})`,
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
        padChar,
        shift,
        padPosition: position - 1,
        wrapped,
        direction,
      },
    });
  }

  return { output, steps };
}
