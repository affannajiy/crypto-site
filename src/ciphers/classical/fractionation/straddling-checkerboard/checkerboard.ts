/**
 * The straddling checkerboard.
 *
 * Every other cipher on this site gives each symbol a code of the same length.
 * This one does not, and that single difference makes it the most modern-looking
 * thing in the classical section.
 *
 * Ten columns, numbered 0-9. The eight most useful symbols sit on the top row and
 * get a **one-digit** code. Two of the ten columns are left empty on that row;
 * those two digits become **escape prefixes**, and everything else gets a
 * **two-digit** code beginning with one of them.
 *
 *          0  1  2  3  4  5  6  7  8  9
 *          A  T  .  O  N  E  .  S  I  R      (2 and 6 are the escapes)
 *      2   B  C  D  F  G  H  J  K  L  M
 *      6   P  Q  U  V  W  X  Y  Z  .  /
 *
 * So E is `5`, one digit. K is `27`, two digits. Because the escape digits never
 * appear as one-digit codes, the stream can be read from left to right with no
 * separators and no ambiguity — the code is **prefix-free**, which is the property
 * Huffman coding formalised in 1952 and which every compression format since has
 * depended on.
 *
 * It also compresses. English is mostly the letters on the top row, so a message
 * comes out shorter than the two-digits-per-letter a Polybius square would give.
 * The Soviet **VIC cipher**, the most complex hand cipher known to have been used
 * in the field, is a straddling checkerboard followed by two transpositions.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export type Direction = 'encrypt' | 'decrypt';

/** 26 letters and two spare cells. 8 + 10 + 10 = 28, so the board fills exactly. */
export const ALPHABET_28 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ./';
export const TOP_ROW = 8;

export interface Board {
  /** The 28 symbols in board order: top row first, then the two escape rows. */
  symbols: string[];
  /** The two digits that are empty on the top row and prefix the lower rows. */
  escapes: [number, number];
  /** The eight digits the top row actually occupies, in order. */
  topDigits: number[];
}

/** Reads the two escape digits from a param, falling back to 2 and 6. */
export function parseEscapes(text: string): [number, number] {
  const digits = (text.match(/\d/g) ?? []).map(Number);
  const unique = [...new Set(digits)];
  if (unique.length < 2) return [2, 6];
  const first = unique[0] ?? 2;
  const second = unique[1] ?? 6;
  return first < second ? [first, second] : [second, first];
}

/** The board: keyword first over the 28 symbols, then the rest in order. */
export function buildBoard(keyword: string, escapesText: string): Board {
  const escapes = parseEscapes(escapesText);
  const seen = new Set<string>();
  let symbols = '';

  for (const raw of keyword.toUpperCase()) {
    if (ALPHABET_28.includes(raw) && !seen.has(raw)) {
      seen.add(raw);
      symbols += raw;
    }
  }
  for (const char of ALPHABET_28) {
    if (!seen.has(char)) symbols += char;
  }

  const topDigits: number[] = [];
  for (let d = 0; d < 10; d += 1) {
    if (d !== escapes[0] && d !== escapes[1]) topDigits.push(d);
  }

  return { symbols: symbols.split(''), escapes, topDigits };
}

/** The digit string for a symbol: one digit for the top row, two for the rest. */
export function codeFor(board: Board, char: string): string {
  const at = board.symbols.indexOf(char);
  if (at === -1) return '';
  if (at < TOP_ROW) return String(board.topDigits[at] ?? 0);
  if (at < TOP_ROW + 10) return `${board.escapes[0]}${at - TOP_ROW}`;
  return `${board.escapes[1]}${at - TOP_ROW - 10}`;
}

/** Where a symbol sits, for the visualizer: which row and which column. */
export function placeOf(board: Board, char: string): { row: 0 | 1 | 2; col: number } | null {
  const at = board.symbols.indexOf(char);
  if (at === -1) return null;
  if (at < TOP_ROW) return { row: 0, col: board.topDigits[at] ?? 0 };
  if (at < TOP_ROW + 10) return { row: 1, col: at - TOP_ROW };
  return { row: 2, col: at - TOP_ROW - 10 };
}

/**
 * Splits a digit stream into codes, left to right.
 *
 * This never has to guess, and that is the property worth noticing. A digit that
 * is not an escape stands alone; an escape digit always takes the next digit with
 * it. No separators, no lookahead, no ambiguity — the definition of a prefix-free
 * code.
 */
export function splitCodes(board: Board, digits: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < digits.length) {
    const digit = Number(digits.charAt(i));
    if (digit === board.escapes[0] || digit === board.escapes[1]) {
      out.push(digits.slice(i, i + 2));
      i += 2;
    } else {
      out.push(digits.charAt(i));
      i += 1;
    }
  }
  return out;
}

/** The symbol a code stands for, or '' when the code runs off the board. */
export function symbolFor(board: Board, code: string): string {
  if (code.length === 1) {
    const at = board.topDigits.indexOf(Number(code));
    return at === -1 ? '' : (board.symbols[at] ?? '');
  }
  if (code.length !== 2) return '';
  const prefix = Number(code.charAt(0));
  const offset = Number(code.charAt(1));
  if (prefix === board.escapes[0]) return board.symbols[TOP_ROW + offset] ?? '';
  if (prefix === board.escapes[1]) return board.symbols[TOP_ROW + 10 + offset] ?? '';
  return '';
}

/** Only the digits. Spacing in a ciphertext is decoration. */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

/** Groups digits in fives, which is how a numeric message was actually sent. */
export function inFives(digits: string): string {
  return (digits.match(/.{1,5}/g) ?? []).join(' ');
}

/** The cipher, untraced. Used by the benchmark. */
export function checkerboard(
  text: string,
  keyword: string,
  escapes: string,
  direction: Direction,
): string {
  const board = buildBoard(keyword, escapes);

  if (direction === 'decrypt') {
    return splitCodes(board, digitsOnly(text))
      .map((code) => symbolFor(board, code))
      .join('');
  }

  let digits = '';
  for (const raw of text.toUpperCase()) {
    digits += codeFor(board, raw);
  }
  return inFives(digits);
}

/** How many digits per symbol the message actually cost. */
export function compressionOf(board: Board, text: string): { symbols: number; digits: number } {
  let symbols = 0;
  let digits = 0;
  for (const raw of text.toUpperCase()) {
    const code = codeFor(board, raw);
    if (code === '') continue;
    symbols += 1;
    digits += code.length;
  }
  return { symbols, digits };
}

/** The cipher again, one `Step` per symbol or per code. */
export function checkerboardTrace(
  text: string,
  keyword: string,
  escapes: string,
  direction: Direction,
): TraceResult {
  const board = buildBoard(keyword, escapes);
  const steps: Step[] = [];

  if (direction === 'decrypt') {
    const codes = splitCodes(board, digitsOnly(text));
    let output = '';
    codes.forEach((code, i) => {
      const symbol = symbolFor(board, code);
      const outputAt = output.length;
      output += symbol;
      steps.push({
        index: i,
        title: `${code} → ${symbol === '' ? '?' : symbol}`,
        detail:
          code.length === 1
            ? `${code} is not one of the escape digits ${board.escapes.join(' or ')}, so it stands alone: ${symbol}. No separator was needed to know that, which is what "prefix-free" buys.`
            : `${code.charAt(0)} is an escape digit, so it takes the next digit with it. ${code} is ${symbol}.`,
        input: code,
        output: symbol,
        outputHighlight: { start: outputAt, end: outputAt + 1 },
        data: { isSymbol: symbol !== '', code, symbol, escapes: board.escapes },
      });
    });
    return { output, steps };
  }

  let digits = '';
  for (let i = 0; i < text.length; i += 1) {
    const raw = text.charAt(i);
    const char = raw.toUpperCase();
    const code = codeFor(board, char);

    if (code === '') {
      steps.push({
        index: i,
        title: `Drop '${raw}'`,
        detail: `The board holds the 26 letters plus a full stop and a slash, and nothing else — so this character has no code and is discarded.`,
        input: raw,
        highlight: { start: i, end: i + 1 },
        data: { isSymbol: false },
      });
      continue;
    }

    const start = digits.length;
    digits += code;
    const place = placeOf(board, char);

    steps.push({
      index: i,
      title: `${char} → ${code}`,
      detail:
        code.length === 1
          ? `${char} is on the top row, at column ${code}, so it costs a single digit. The eight top-row symbols are the ones worth spending one digit on, which is why a checkerboard is arranged around letter frequency rather than around the alphabet.`
          : `${char} is on the row prefixed by ${code.charAt(0)}, at column ${code.charAt(1)}, so it costs two digits. ${code.charAt(0)} is never a one-digit code, so a reader always knows to take the next digit as well.`,
      input: raw,
      output: code,
      highlight: { start: i, end: i + 1 },
      // The output is grouped in fives, so an index in the raw digit stream is
      // offset by one space for every complete group before it.
      outputHighlight: {
        start: start + Math.floor(start / 5),
        end: start + code.length + Math.floor((start + code.length - 1) / 5),
      },
      data: {
        isSymbol: true,
        char,
        code,
        row: place?.row ?? 0,
        col: place?.col ?? 0,
        escapes: board.escapes,
      },
    });
  }

  const cost = compressionOf(board, text);
  if (cost.symbols > 0) {
    steps.push({
      index: text.length,
      title: `${cost.digits} digits for ${cost.symbols} symbols`,
      detail: `That is ${(cost.digits / cost.symbols).toFixed(2)} digits per symbol, against the flat 2.00 a Polybius square charges. The saving is real and it comes from English being mostly the letters on the top row — which is compression, arrived at by a hand cipher thirty years before Huffman wrote the algorithm down.`,
      data: { isSymbol: false, summary: true, ...cost },
    });
  }

  return { output: inFives(digits), steps };
}
