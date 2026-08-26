/**
 * Bacon's cipher, 1605.
 *
 * Francis Bacon's *biliteral* cipher is the oldest binary encoding of the Latin
 * alphabet: every letter becomes five symbols drawn from a two-symbol set, which
 * is a five-bit code three and a half centuries before anyone called it that.
 *
 *     A = AAAAA   B = AAAAB   C = AAABA   ...   Z = BBAAB
 *
 * The five symbols are the message. What makes the cipher *steganographic* rather
 * than merely substitutive is Bacon's second half: the two symbols need not be
 * letters. They can be two typefaces, two slants, two hands — any binary
 * distinction a carrier text can carry without looking like it is carrying one.
 * This module implements exactly that with letter case, which is the modern
 * equivalent of Bacon's two founts of type.
 *
 * Bacon's own table has 24 letters, because his alphabet did not distinguish I
 * from J or U from V. The 26-letter table is the later tidy-up. Both are here,
 * because the 24-letter one is what the historical texts use and the 26-letter one
 * is what a reader expects, and silently picking either would be a small lie.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { A_TO_Z, describeChar, letterIndex } from '../../../../lib/letters';

export const CODE_LENGTH = 5;

/** Bacon's own alphabet: I and J share a code, U and V share a code. */
export const ALPHABET_24 = 'ABCDEFGHIKLMNOPQRSTUWXYZ';

export type Variant = '24' | '26';

/** Folds J onto I and V onto U for the 24-letter table. Identity for 26. */
export function fold(char: string, variant: Variant): string {
  if (variant === '26') return char;
  if (char === 'J') return 'I';
  if (char === 'V') return 'U';
  return char;
}

export function alphabetFor(variant: Variant): string {
  return variant === '24' ? ALPHABET_24 : A_TO_Z;
}

/** The five-symbol code for a letter, as 'AABBA'. Empty for a letter not in the table. */
export function codeFor(char: string, variant: Variant): string {
  const at = alphabetFor(variant).indexOf(fold(char, variant));
  if (at === -1) return '';
  let out = '';
  for (let bit = CODE_LENGTH - 1; bit >= 0; bit -= 1) {
    out += ((at >> bit) & 1) === 1 ? 'B' : 'A';
  }
  return out;
}

/** The numeric value of a code, so a step can say which table entry it is. */
export function valueOf(code: string): number {
  let value = 0;
  for (const symbol of code) value = value * 2 + (symbol === 'B' ? 1 : 0);
  return value;
}

/** The letter a five-symbol code stands for, or '' when it runs past the table. */
export function letterForCode(code: string, variant: Variant): string {
  if (code.length !== CODE_LENGTH) return '';
  for (const symbol of code) {
    if (symbol !== 'A' && symbol !== 'B') return '';
  }
  return alphabetFor(variant).charAt(valueOf(code));
}

/** The whole table, for the visualizer and for a test that checks it is a bijection. */
export function table(variant: Variant): { letter: string; code: string; alias?: string }[] {
  return alphabetFor(variant)
    .split('')
    .map((letter) => {
      const row = { letter, code: codeFor(letter, variant) };
      if (variant === '26') return row;
      if (letter === 'I') return { ...row, alias: 'J' };
      if (letter === 'U') return { ...row, alias: 'V' };
      return row;
    });
}

/**
 * Where each symbol of the stream landed in a carrier text.
 *
 * `positions[n]` is the index in the carrier of the letter carrying symbol `n`.
 * Non-letters in the carrier are decoration: they are copied through and carry
 * nothing, which is what lets the result read as ordinary prose.
 */
export interface Hidden {
  text: string;
  positions: number[];
  /** True when the carrier ran out of letters before the message ran out of symbols. */
  truncated: boolean;
}

/** Recases the carrier so its letters spell out `symbols`. B is a capital. */
export function hideIn(carrier: string, symbols: string): Hidden {
  const positions: number[] = [];
  let out = '';
  let next = 0;

  for (let i = 0; i < carrier.length; i += 1) {
    const char = carrier.charAt(i);
    if (letterIndex(char) === -1 || next >= symbols.length) {
      out += char;
      continue;
    }
    out += symbols.charAt(next) === 'B' ? char.toUpperCase() : char.toLowerCase();
    positions.push(i);
    next += 1;
  }

  return { text: out, positions, truncated: next < symbols.length };
}

/** Reads the symbols back out of a carrier: a capital is B, lowercase is A. */
export function revealFrom(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (letterIndex(char) === -1) continue;
    out += char === char.toUpperCase() ? 'B' : 'A';
  }
  return out;
}

/** The symbols out of a plain 'AABBA ABAAB' stream. Anything else is ignored. */
export function symbolsFrom(text: string): string {
  let out = '';
  for (const char of text.toUpperCase()) {
    if (char === 'A' || char === 'B') out += char;
  }
  return out;
}

/** Groups a symbol stream into readable fives: 'AABBAABAAB' -> 'AABBA ABAAB'. */
export function inFives(symbols: string): string {
  return (symbols.match(/.{1,5}/g) ?? []).join(' ');
}

/** The message as one unbroken symbol stream, before it is grouped or hidden. */
export function symbolsFor(text: string, variant: Variant): string {
  let symbols = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i).toUpperCase();
    if (letterIndex(char) === -1) continue;
    symbols += codeFor(char, variant);
  }
  return symbols;
}

/** The cipher, untraced. Used by the benchmark. */
export function bacon(text: string, variant: Variant, carrier: string): string {
  const symbols = symbolsFor(text, variant);
  return carrier.trim() === '' ? inFives(symbols) : hideIn(carrier, symbols).text;
}

/** Decoding, untraced. The carrier decides which of the two readings applies. */
export function unbacon(text: string, variant: Variant, carrier: string): string {
  const symbols = carrier.trim() === '' ? symbolsFrom(text) : revealFrom(text);
  let out = '';
  for (let i = 0; i + CODE_LENGTH <= symbols.length; i += CODE_LENGTH) {
    out += letterForCode(symbols.slice(i, i + CODE_LENGTH), variant);
  }
  return out;
}

function foldNote(char: string, variant: Variant): string {
  const folded = fold(char, variant);
  return folded === char
    ? ''
    : ` ${char} has no code of its own in Bacon's 24-letter table, so it is written as ${folded}.`;
}

/** Encoding, one `Step` per letter. Non-letters are dropped, and each says so. */
export function baconTrace(text: string, variant: Variant, carrier: string): TraceResult {
  const steps: Step[] = [];
  const hiding = carrier.trim() !== '';
  const groups: { at: number; char: string; code: string }[] = [];
  let symbols = '';

  for (let i = 0; i < text.length; i += 1) {
    const raw = text.charAt(i);
    const char = raw.toUpperCase();
    if (letterIndex(char) === -1) {
      steps.push({
        index: i,
        title: `Drop ${describeChar(raw)}`,
        detail: `The output is a stream of two symbols and nothing else, so ${describeChar(raw)} has nowhere to go. Bacon's cipher loses all spacing and punctuation, which is why a decoded message comes back as one unbroken run of letters.`,
        input: raw,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false },
      });
      continue;
    }

    const code = codeFor(char, variant);
    groups.push({ at: i, char, code });
    symbols += code;
  }

  const hidden = hiding ? hideIn(carrier, symbols) : null;
  const output = hidden !== null ? hidden.text : inFives(symbols);

  // A second pass, now that the carrier is known: a step can only point at the
  // output once the whole stream has been laid into it.
  groups.forEach((group, ordinal) => {
    const start = ordinal * CODE_LENGTH;
    const carried = hidden?.positions.slice(start, start + CODE_LENGTH) ?? [];
    const first = carried[0];
    const last = carried[carried.length - 1];

    let outputHighlight;
    if (hidden === null) {
      // Groups are printed five symbols and a space, so group n starts at 6n.
      outputHighlight = { start: ordinal * 6, end: ordinal * 6 + CODE_LENGTH };
    } else if (first !== undefined && last !== undefined) {
      outputHighlight = { start: first, end: last + 1 };
    }

    const where =
      hidden === null
        ? `written straight out as ${group.code}.`
        : carried.length === CODE_LENGTH
          ? `spelled by the case of the next five carrier letters — a capital is B, lowercase is A — so the carrier still reads as ordinary text.`
          : 'lost, because the carrier ran out of letters before the message ran out of symbols.';

    steps.push({
      index: group.at,
      title: `${group.char} → ${group.code}`,
      detail: `${group.char} is entry ${valueOf(group.code)} of the ${variant}-letter table, which in five bits is ${group.code}.${foldNote(group.char, variant)} It is ${where}`,
      input: group.char,
      output: group.code,
      highlight: { start: group.at, end: group.at + 1 },
      ...(outputHighlight === undefined ? {} : { outputHighlight }),
      data: {
        isLetter: true,
        letter: group.char,
        code: group.code,
        hiding,
        carried,
        truncated: hidden?.truncated === true,
      },
    });
  });

  steps.sort((a, b) => a.index - b.index);
  return { output, steps };
}

/** Decoding, one `Step` per five-symbol group. */
export function unbaconTrace(text: string, variant: Variant, carrier: string): TraceResult {
  const hiding = carrier.trim() !== '';
  const symbols = hiding ? revealFrom(text) : symbolsFrom(text);
  const steps: Step[] = [];
  let output = '';

  for (let i = 0; i + CODE_LENGTH <= symbols.length; i += CODE_LENGTH) {
    const code = symbols.slice(i, i + CODE_LENGTH);
    const letter = letterForCode(code, variant);
    const at = steps.length;
    output += letter;
    steps.push({
      index: at,
      title: `${code} → ${letter}`,
      detail: hiding
        ? `The case of the next five letters spells ${code}, which is entry ${valueOf(code)} of the ${variant}-letter table: ${letter}.`
        : `${code} is entry ${valueOf(code)} of the ${variant}-letter table: ${letter}.`,
      input: code,
      output: letter,
      outputHighlight: { start: at, end: at + 1 },
      data: { isLetter: true, code, letter, hiding },
    });
  }

  const leftover = symbols.length % CODE_LENGTH;
  if (leftover !== 0) {
    steps.push({
      index: steps.length,
      title: `${leftover} spare symbol${leftover === 1 ? '' : 's'}`,
      detail: `The stream is ${symbols.length} symbols long, which is not a multiple of five, so the last ${leftover} cannot form a letter. Either the message was cut short, or something here was mistaken for a carrier.`,
      data: { isLetter: false },
    });
  }

  const tail = trailingARun(output);
  if (hiding && tail > 0) {
    steps.push({
      index: steps.length,
      title: `${tail} trailing A${tail === 1 ? '' : "'s"} — carrier, or message?`,
      detail: `A carrier longer than the message leaves its spare letters lowercase, and lowercase means A. So an unused tail decodes to a run of A's that is indistinguishable from a message genuinely ending in A. Bacon's cipher has no end marker and no length field: the recipient has to know where to stop, or the carrier has to be written to fit exactly.`,
      data: { isLetter: false, trailingA: tail },
    });
  }

  return { output, steps };
}

/** How many A's the decoded text ends with. A carrier tail looks exactly like this. */
export function trailingARun(text: string): number {
  let n = 0;
  while (n < text.length && text.charAt(text.length - 1 - n) === 'A') n += 1;
  return n;
}
