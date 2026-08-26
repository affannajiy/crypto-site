/**
 * The Trifid cipher, Felix Delastelle, 1902.
 *
 * Bifid splits a letter into two coordinates. Trifid splits it into **three**, and
 * the extra dimension is not decoration: it is the difference between a piece of a
 * letter travelling to one other letter and travelling to two.
 *
 * Twenty-six letters do not fit a cube, so Trifid uses **27 symbols**: the alphabet
 * plus one extra, written here as a full stop. That is a nicer accident than
 * Bifid's, which had to throw a letter away — 27 = 3³ exactly, so nothing is
 * merged and J survives. Choosing an alphabet size that fits the arithmetic instead
 * of forcing the arithmetic to fit the alphabet is a habit modern cryptography
 * never breaks.
 *
 * Each symbol gets a layer, a row and a column, all 1-3. Write those as three
 * lines, read the whole grid as one stream, and cut it into **triples**:
 *
 *     letters   F  L  E  E
 *     layers    1  2  1  1
 *     rows      2  1  2  2
 *     columns   3  3  2  2
 *
 *     stream:  1 2 1 1 | 2 1 2 2 | 3 3 2 2  ->  (1,2,1) (1,2,1) (2,2,3) (3,2,2)
 *
 * A triple can now draw its three digits from three different plaintext letters.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { letterIndex } from '../../../../lib/letters';

export type Direction = 'encrypt' | 'decrypt';

/** 3 x 3 x 3. The extra symbol is what lets all 26 letters keep their identity. */
export const SIDE = 3;
export const CELLS = 27;
/** The 27th symbol. A full stop reads as punctuation rather than as a letter. */
export const EXTRA = '.';
export const ALPHABET_27 = `ABCDEFGHIJKLMNOPQRSTUVWXYZ${EXTRA}`;

export const MAX_PERIOD = 20;

/** Uppercases and keeps only symbols the cube holds. */
export function cleanFor(text: string): string {
  let out = '';
  for (const raw of text) {
    const char = raw.toUpperCase();
    if (ALPHABET_27.includes(char)) out += char;
  }
  return out;
}

/** The cube's 27 cells in order, keyword first then the rest of the alphabet. */
export function buildCube(keyword: string): string[] {
  const seen = new Set<string>();
  let cells = '';
  for (const char of cleanFor(keyword)) {
    if (!seen.has(char)) {
      seen.add(char);
      cells += char;
    }
  }
  for (const char of ALPHABET_27) {
    if (!seen.has(char)) cells += char;
  }
  return cells.split('');
}

/** Layer, row and column of a symbol, all zero-based. Null when it is not in the cube. */
export function locate(cube: string[], char: string): { layer: number; row: number; col: number } | null {
  const at = cube.indexOf(char);
  if (at === -1) return null;
  return {
    layer: Math.floor(at / (SIDE * SIDE)),
    row: Math.floor(at / SIDE) % SIDE,
    col: at % SIDE,
  };
}

/** The symbol at a coordinate. */
export function symbolAt(cube: string[], layer: number, row: number, col: number): string {
  return cube[layer * SIDE * SIDE + row * SIDE + col] ?? '';
}

export interface Prepared {
  symbols: string;
  /** `sources[i]` is where symbol `i` came from in the text as typed. */
  sources: number[];
}

/** Strips the message to symbols the cube holds, remembering where each came from. */
export function prepare(text: string): Prepared {
  let symbols = '';
  const sources: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const raw = text.charAt(i);
    const char = raw.toUpperCase();
    if (letterIndex(raw) === -1 && char !== EXTRA) continue;
    symbols += char;
    sources.push(i);
  }
  return { symbols, sources };
}

/** Block boundaries. Period 0 is one block for the whole message. */
export function blocks(length: number, period: number): { start: number; end: number }[] {
  if (length === 0) return [];
  const size = period <= 0 ? length : period;
  const out: { start: number; end: number }[] = [];
  for (let start = 0; start < length; start += size) {
    out.push({ start, end: Math.min(start + size, length) });
  }
  return out;
}

/** The three coordinate lines for one block. */
export function grid(cube: string[], symbols: string): { layers: number[]; rows: number[]; cols: number[] } {
  const layers: number[] = [];
  const rows: number[] = [];
  const cols: number[] = [];
  for (const char of symbols) {
    const where = locate(cube, char);
    layers.push(where?.layer ?? 0);
    rows.push(where?.row ?? 0);
    cols.push(where?.col ?? 0);
  }
  return { layers, rows, cols };
}

/** One block, encrypted: read the three lines as one stream, cut into triples. */
export function foldBlock(cube: string[], symbols: string): string {
  const { layers, rows, cols } = grid(cube, symbols);
  const stream = [...layers, ...rows, ...cols];
  let out = '';
  for (let i = 0; i + 2 < stream.length; i += 3) {
    out += symbolAt(cube, stream[i] ?? 0, stream[i + 1] ?? 0, stream[i + 2] ?? 0);
  }
  return out;
}

/** One block, decrypted: the stream comes back in reading order and is cut in thirds. */
export function unfoldBlock(cube: string[], symbols: string): string {
  const stream: number[] = [];
  for (const char of symbols) {
    const where = locate(cube, char);
    stream.push(where?.layer ?? 0, where?.row ?? 0, where?.col ?? 0);
  }
  const n = symbols.length;
  let out = '';
  for (let i = 0; i < n; i += 1) {
    out += symbolAt(cube, stream[i] ?? 0, stream[n + i] ?? 0, stream[2 * n + i] ?? 0);
  }
  return out;
}

/** The cipher, untraced. Used by the benchmark. */
export function trifid(text: string, keyword: string, period: number, direction: Direction): string {
  const cube = buildCube(keyword);
  const { symbols } = prepare(text);
  let out = '';
  for (const block of blocks(symbols.length, period)) {
    const slice = symbols.slice(block.start, block.end);
    out += direction === 'encrypt' ? foldBlock(cube, slice) : unfoldBlock(cube, slice);
  }
  return out;
}

/**
 * The cipher again, one `Step` per output symbol.
 *
 * As in Bifid, the input highlight covers the whole block: an output symbol is
 * built from digits belonging to up to three different input symbols, and pointing
 * at one character would be a more precise lie.
 */
export function trifidTrace(
  text: string,
  keyword: string,
  period: number,
  direction: Direction,
): TraceResult {
  const cube = buildCube(keyword);
  const { symbols, sources } = prepare(text);
  const steps: Step[] = [];
  let output = '';

  for (const block of blocks(symbols.length, period)) {
    const slice = symbols.slice(block.start, block.end);
    const n = slice.length;
    const start = sources[block.start] ?? 0;
    const end = (sources[block.end - 1] ?? start) + 1;
    const blockRange = { start, end };

    const encrypting = direction === 'encrypt';
    let stream: number[];
    let lines: { layers: number[]; rows: number[]; cols: number[] };

    if (encrypting) {
      lines = grid(cube, slice);
      stream = [...lines.layers, ...lines.rows, ...lines.cols];
    } else {
      stream = [];
      for (const char of slice) {
        const where = locate(cube, char);
        stream.push(where?.layer ?? 0, where?.row ?? 0, where?.col ?? 0);
      }
      lines = {
        layers: stream.slice(0, n),
        rows: stream.slice(n, 2 * n),
        cols: stream.slice(2 * n),
      };
    }

    for (let j = 0; j < n; j += 1) {
      const pick = encrypting ? [j * 3, j * 3 + 1, j * 3 + 2] : [j, n + j, 2 * n + j];
      const values = pick.map((k) => stream[k] ?? 0);
      const symbol = symbolAt(cube, values[0] ?? 0, values[1] ?? 0, values[2] ?? 0);
      const outputAt = output.length;
      output += symbol;

      const nameOf = (k: number) => {
        const which = Math.floor(k / n);
        const within = k % n;
        const label = which === 0 ? 'layer' : which === 1 ? 'row' : 'column';
        return `the ${label} of ${slice.charAt(within)}`;
      };
      const sourceCount = new Set(pick.map((k) => k % n)).size;

      steps.push({
        index: steps.length,
        title: `(${values.map((v) => v + 1).join(', ')}) → ${symbol}`,
        detail: encrypting
          ? `Reading the block's three lines as one stream: ${pick.map(nameOf).join(', ')} — layer ${(values[0] ?? 0) + 1}, row ${(values[1] ?? 0) + 1}, column ${(values[2] ?? 0) + 1} → ${symbol}. Those three digits came from ${sourceCount} different plaintext ${sourceCount === 1 ? 'symbol' : 'symbols'}.`
          : `Every ciphertext symbol splits into three digits, and the run is cut in thirds: the first ${n} are layers, the next ${n} rows, the last ${n} columns. Taking digit ${j + 1} of each third gives layer ${(values[0] ?? 0) + 1}, row ${(values[1] ?? 0) + 1}, column ${(values[2] ?? 0) + 1} → ${symbol}.`,
        output: symbol,
        highlight: blockRange,
        outputHighlight: { start: outputAt, end: outputAt + 1 },
        data: {
          isSymbol: true,
          symbols: slice,
          layers: lines.layers,
          rows: lines.rows,
          cols: lines.cols,
          pick,
          values,
          symbol,
          sourceCount,
          period,
        },
      });
    }
  }

  return { output, steps };
}
