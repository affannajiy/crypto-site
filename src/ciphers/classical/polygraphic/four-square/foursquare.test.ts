import { describe, expect, it } from 'vitest';
import {
  PADDING,
  buildSquares,
  decipherPair,
  encipherPair,
  fourSquare,
  fourSquareTrace,
  prepare,
} from './foursquare';
import fourSquareCipher from './index';

describe('the squares', () => {
  it('builds two plain squares and two keyed ones', () => {
    const squares = buildSquares('EXAMPLE', 'KEYWORD');
    expect(squares.plain.cells.join('')).toBe('ABCDEFGHIKLMNOPQRSTUVWXYZ');
    expect(squares.topRight.cells.slice(0, 6).join('')).toBe('EXAMPL');
    expect(squares.bottomLeft.cells.slice(0, 7).join('')).toBe('KEYWORD');
  });

  it('gives every square all 25 letters exactly once', () => {
    const squares = buildSquares('EXAMPLE', 'KEYWORD');
    for (const square of [squares.plain, squares.topRight, squares.bottomLeft]) {
      expect(square.cells.slice().sort().join('')).toBe('ABCDEFGHIKLMNOPQRSTUVWXYZ');
    }
  });
});

describe('prepare', () => {
  it('strips punctuation and folds J onto I', () => {
    expect(prepare('Jam!').letters).toBe('IAMX');
  });

  it('pads an odd number of letters and says so', () => {
    expect(prepare('ABC').letters).toBe(`ABC${PADDING}`);
    expect(prepare('ABC').padded).toBe(true);
    expect(prepare('ABCD').padded).toBe(false);
  });

  it('marks the padding letter as coming from nowhere', () => {
    expect(prepare('ABC').sources).toEqual([0, 1, 2, -1]);
  });
});

describe('the rectangle rule', () => {
  const squares = buildSquares('EXAMPLE', 'KEYWORD');

  it('has no special case for two letters in the same row', () => {
    // A and B are both in row 0 of the plain square. Playfair needs a rule for
    // this; Four-square does not, because the corners are in different squares.
    const [a, b] = encipherPair(squares, 'A', 'B');
    expect(a).toMatch(/[A-Z]/);
    expect(b).toMatch(/[A-Z]/);
    expect(decipherPair(squares, a, b)).toEqual(['A', 'B']);
  });

  it('has no special case for two letters in the same column', () => {
    // A and F are both in column 0.
    const [a, b] = encipherPair(squares, 'A', 'F');
    expect(decipherPair(squares, a, b)).toEqual(['A', 'F']);
  });

  it('has no special case for a doubled letter', () => {
    // Playfair cannot encrypt EE at all without inserting a filler letter.
    const [a, b] = encipherPair(squares, 'E', 'E');
    expect(decipherPair(squares, a, b)).toEqual(['E', 'E']);
  });

  it('round-trips every one of the 625 possible pairs', () => {
    const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
    for (const first of alphabet) {
      for (const second of alphabet) {
        const [a, b] = encipherPair(squares, first, second);
        expect(decipherPair(squares, a, b)).toEqual([first, second]);
      }
    }
  });
});

describe('fourSquare', () => {
  it('round-trips a message', () => {
    const text = 'Meet me at the old bridge at midnight';
    const encrypted = fourSquare(text, 'EXAMPLE', 'KEYWORD', 'encrypt');
    expect(fourSquare(encrypted, 'EXAMPLE', 'KEYWORD', 'decrypt')).toBe(prepare(text).letters);
  });

  it('maps a repeated pair to the same ciphertext pair, which is how it breaks', () => {
    const out = fourSquare('THTHTH', 'EXAMPLE', 'KEYWORD', 'encrypt');
    expect(out.slice(0, 2)).toBe(out.slice(2, 4));
    expect(out.slice(2, 4)).toBe(out.slice(4, 6));
  });

  it('changes when either key changes', () => {
    // Distinct keys, not 'A' and 'B': those two produce squares that differ in
    // only two adjacent cells, and a short message can easily miss both. A test
    // that passes by luck is worse than no test.
    const text = 'ATTACKATDAWN';
    expect(fourSquare(text, 'ZEBRA', 'KEYWORD', 'encrypt')).not.toBe(
      fourSquare(text, 'QUARTZ', 'KEYWORD', 'encrypt'),
    );
    expect(fourSquare(text, 'EXAMPLE', 'ZEBRA', 'encrypt')).not.toBe(
      fourSquare(text, 'EXAMPLE', 'QUARTZ', 'encrypt'),
    );
  });

  it('only changes where a changed cell is actually read', () => {
    // The flip side, and it is the reason the test above uses distinct keys:
    // two nearly identical squares give nearly identical ciphertext, because a
    // cell that is never a rectangle corner never affects anything.
    const text = 'ATTACKATDAWN';
    const a = fourSquare(text, 'EXAMPLE', 'A', 'encrypt');
    const b = fourSquare(text, 'EXAMPLE', 'B', 'encrypt');
    let differences = 0;
    for (let i = 0; i < a.length; i += 1) {
      if (a.charAt(i) !== b.charAt(i)) differences += 1;
    }
    expect(differences).toBeLessThan(3);
  });

  it('drops spacing and punctuation', () => {
    expect(fourSquare('at dawn!', 'A', 'B', 'encrypt')).toHaveLength(6);
  });

  it('handles the empty string', () => {
    expect(fourSquare('', 'A', 'B', 'encrypt')).toBe('');
  });
});

describe('fourSquareTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me at dawn';
    for (const direction of ['encrypt', 'decrypt'] as const) {
      expect(fourSquareTrace(text, 'EXAMPLE', 'KEYWORD', direction).output).toBe(
        fourSquare(text, 'EXAMPLE', 'KEYWORD', direction),
      );
    }
  });

  it('emits one step per pair', () => {
    const { steps } = fourSquareTrace('ATTACK', 'A', 'B', 'encrypt');
    expect(steps).toHaveLength(3);
  });

  it('highlights the two input letters and the two output letters', () => {
    const { steps } = fourSquareTrace('ATTACK', 'A', 'B', 'encrypt');
    expect(steps[0]?.highlight).toEqual({ start: 0, end: 2 });
    expect(steps[0]?.outputHighlight).toEqual({ start: 0, end: 2 });
  });

  it('indexes the input as typed, not as stripped', () => {
    // 'at dawn' -> ATDAWNX, so pair 2 is D and A at original indices 3 and 4.
    const { steps } = fourSquareTrace('at dawn', 'A', 'B', 'encrypt');
    expect(steps[1]?.highlight).toEqual({ start: 3, end: 5 });
  });

  it('says when the last letter is padding', () => {
    const { steps } = fourSquareTrace('ABC', 'A', 'B', 'encrypt');
    expect(steps[1]?.data?.['padded']).toBe(true);
    expect(steps[0]?.data?.['padded']).toBe(false);
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const key = { keyOne: 'EXAMPLE', keyTwo: 'KEYWORD' };
    const encrypted = fourSquareCipher.encrypt('Attack at dawn', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = fourSquareCipher.decrypt(output, key);
    expect('output' in decrypted && decrypted.output).toBe('ATTACKATDAWN');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of fourSquareCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => fourSquareCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('has no Attack tab', () => {
    expect(fourSquareCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(fourSquareCipher.attack).toBeUndefined();
  });

  it('says plainly that the bigger key did not make it stronger', () => {
    expect(fourSquareCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(fourSquareCipher.explainer).toContain('Key size is not strength');
  });
});
