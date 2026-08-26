import { describe, expect, it } from 'vitest';
import {
  ALPHABET_28,
  TOP_ROW,
  buildBoard,
  checkerboard,
  checkerboardTrace,
  codeFor,
  compressionOf,
  digitsOnly,
  inFives,
  parseEscapes,
  splitCodes,
  symbolFor,
} from './checkerboard';
import checkerboardCipher from './index';

const board = buildBoard('ATONESIR', '26');

describe('the board', () => {
  it('fills exactly: eight on top and ten on each of two rows', () => {
    expect(ALPHABET_28).toHaveLength(28);
    expect(TOP_ROW + 10 + 10).toBe(28);
    expect(board.symbols).toHaveLength(28);
  });

  it('holds every letter once, plus two spare cells', () => {
    expect(board.symbols.slice().sort().join('')).toBe(
      ALPHABET_28.split('').sort().join(''),
    );
  });

  it('puts the arrangement keyword on the top row', () => {
    expect(board.symbols.slice(0, 8).join('')).toBe('ATONESIR');
  });

  it('leaves the escape digits empty on the top row', () => {
    expect(board.escapes).toEqual([2, 6]);
    expect(board.topDigits).toEqual([0, 1, 3, 4, 5, 7, 8, 9]);
    expect(board.topDigits).not.toContain(2);
    expect(board.topDigits).not.toContain(6);
  });

  it('reads two escape digits, in order, and falls back to 2 and 6', () => {
    expect(parseEscapes('71')).toEqual([1, 7]);
    expect(parseEscapes('x3y8z')).toEqual([3, 8]);
    expect(parseEscapes('4')).toEqual([2, 6]);
    expect(parseEscapes('')).toEqual([2, 6]);
    expect(parseEscapes('55')).toEqual([2, 6]);
  });
});

describe('the codes', () => {
  it('gives the top row one digit each', () => {
    expect(codeFor(board, 'A')).toBe('0');
    expect(codeFor(board, 'T')).toBe('1');
    expect(codeFor(board, 'O')).toBe('3');
    expect(codeFor(board, 'R')).toBe('9');
  });

  it('gives everything else two digits, prefixed by an escape', () => {
    expect(codeFor(board, 'B')).toBe('20');
    expect(codeFor(board, 'P')).toMatch(/^6\d$/);
    for (const char of ALPHABET_28) {
      expect(codeFor(board, char).length).toBeGreaterThanOrEqual(1);
      expect(codeFor(board, char).length).toBeLessThanOrEqual(2);
    }
  });

  it('is prefix-free: no one-digit code starts a two-digit code', () => {
    // The property the whole design rests on. Asserted for every symbol rather
    // than for a sample, because "no ambiguity is possible" is a claim about all.
    const singles = new Set(
      ALPHABET_28.split('')
        .map((c) => codeFor(board, c))
        .filter((code) => code.length === 1),
    );
    for (const char of ALPHABET_28) {
      const code = codeFor(board, char);
      if (code.length === 2) expect(singles.has(code.charAt(0))).toBe(false);
    }
  });

  it('reads every code back to its symbol', () => {
    for (const char of ALPHABET_28) {
      expect(symbolFor(board, codeFor(board, char))).toBe(char);
    }
  });

  it('reports nothing for a code that runs off the board', () => {
    expect(symbolFor(board, '2')).toBe('');
    expect(symbolFor(board, '123')).toBe('');
  });
});

describe('splitCodes', () => {
  it('splits a stream with no separators and no ambiguity', () => {
    expect(splitCodes(board, '012039')).toEqual(['0', '1', '20', '3', '9']);
  });

  it('takes the next digit whenever it meets an escape', () => {
    expect(splitCodes(board, '2665')).toEqual(['26', '65']);
  });

  it('has nothing to split in an empty stream', () => {
    expect(splitCodes(board, '')).toEqual([]);
  });
});

describe('checkerboard', () => {
  it('round-trips a message', () => {
    const text = 'ATTACKATDAWN';
    expect(checkerboard(checkerboard(text, 'ATONESIR', '26', 'encrypt'), 'ATONESIR', '26', 'decrypt')).toBe(
      text,
    );
  });

  it('round-trips through a different board', () => {
    const text = 'MEETMEATMIDNIGHT';
    const key = 'ESTONIAR';
    expect(checkerboard(checkerboard(text, key, '48', 'encrypt'), key, '48', 'decrypt')).toBe(text);
  });

  it('is case-insensitive and drops what the board cannot hold', () => {
    expect(checkerboard('at dawn!', 'ATONESIR', '26', 'encrypt')).toBe(
      checkerboard('ATDAWN', 'ATONESIR', '26', 'encrypt'),
    );
  });

  it('groups the digits in fives, as a numeric message was sent', () => {
    expect(inFives('0123456789')).toBe('01234 56789');
    expect(digitsOnly('01234 56789')).toBe('0123456789');
  });

  it('costs less than two digits per letter on English', () => {
    // The compression, measured. A Polybius square charges a flat 2.00.
    const text = 'THEQUICKBROWNFOXIUMPSOVERTHELAZYDOG';
    const cost = compressionOf(board, text);
    expect(cost.digits / cost.symbols).toBeLessThan(2);
  });

  it('loses the saving on a badly arranged board, but can never do worse than 2.00', () => {
    // Two facts, and the second one corrects an obvious guess. A board with the
    // rare letters on top gives up almost all of the compression — but it cannot
    // be *worse* than a Polybius square, because no code here is longer than two
    // digits. 2.00 is a hard ceiling, not just a baseline.
    const text = 'THEQUICKBROWNFOXIUMPSOVERTHELAZYDOG';
    const good = compressionOf(board, text);
    const bad = compressionOf(buildBoard('ZQXJKVBWY', '26'), text);
    expect(bad.digits / bad.symbols).toBeGreaterThan(good.digits / good.symbols);
    expect(bad.digits / bad.symbols).toBeLessThanOrEqual(2);
  });

  it('never charges more than two digits for anything, which is what caps it at 2.00', () => {
    for (const char of ALPHABET_28) {
      expect(codeFor(buildBoard('ZQXJKVBWY', '26'), char).length).toBeLessThanOrEqual(2);
    }
  });

  it('handles the empty string', () => {
    expect(checkerboard('', 'ATONESIR', '26', 'encrypt')).toBe('');
    expect(checkerboard('', 'ATONESIR', '26', 'decrypt')).toBe('');
  });
});

describe('checkerboardTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me at dawn';
    expect(checkerboardTrace(text, 'ATONESIR', '26', 'encrypt').output).toBe(
      checkerboard(text, 'ATONESIR', '26', 'encrypt'),
    );
    const encrypted = checkerboard(text, 'ATONESIR', '26', 'encrypt');
    expect(checkerboardTrace(encrypted, 'ATONESIR', '26', 'decrypt').output).toBe(
      checkerboard(encrypted, 'ATONESIR', '26', 'decrypt'),
    );
  });

  it('emits one step per character, dropped ones included, plus a summary', () => {
    const { steps } = checkerboardTrace('A B', 'ATONESIR', '26', 'encrypt');
    expect(steps.filter((s) => s.data?.['isSymbol'] === true)).toHaveLength(2);
    expect(steps.some((s) => s.data?.['summary'] === true)).toBe(true);
  });

  it('points each step at the digits it produced, allowing for the grouping', () => {
    // 'ATB' -> '0' '1' '20' -> '0120' with no space yet.
    const { steps } = checkerboardTrace('ATB', 'ATONESIR', '26', 'encrypt');
    expect(steps[0]?.outputHighlight).toEqual({ start: 0, end: 1 });
    expect(steps[1]?.outputHighlight).toEqual({ start: 1, end: 2 });
    expect(steps[2]?.outputHighlight).toEqual({ start: 2, end: 4 });
  });

  it('reports the digits-per-symbol cost as a step', () => {
    const summary = checkerboardTrace('ATTACK', 'ATONESIR', '26', 'encrypt').steps.find(
      (s) => s.data?.['summary'] === true,
    );
    expect(Number(summary?.data?.['symbols'])).toBe(6);
    expect(Number(summary?.data?.['digits'])).toBeGreaterThan(6);
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const key = { keyword: 'ATONESIR', escapes: '26' };
    const encrypted = checkerboardCipher.encrypt('Attack at dawn', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = checkerboardCipher.decrypt(output, key);
    expect('output' in decrypted && decrypted.output).toBe('ATTACKATDAWN');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of checkerboardCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => checkerboardCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('tells the reader how it breaks, and that compressing before encrypting leaks', () => {
    expect(checkerboardCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(checkerboardCipher.explainer).toContain('CRIME');
  });
});
