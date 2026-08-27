import { describe, expect, it } from 'vitest';
import { keyNumbers, letterFor, nihilist, nihilistTrace, numberFor, parseNumbers } from './nihilist';
import { buildSquareFor } from './support';
import nihilistCipher from './index';

const plain = buildSquareFor('');

describe('coordinates', () => {
  it('numbers every letter between 11 and 55', () => {
    for (const char of 'ABCDEFGHIKLMNOPQRSTUVWXYZ') {
      const value = numberFor(plain, char);
      expect(value).toBeGreaterThanOrEqual(11);
      expect(value).toBeLessThanOrEqual(55);
      expect(value % 10).toBeGreaterThanOrEqual(1);
      expect(value % 10).toBeLessThanOrEqual(5);
    }
  });

  it('reads a coordinate back to its letter', () => {
    expect(numberFor(plain, 'A')).toBe(11);
    expect(letterFor(plain, 11)).toBe('A');
    expect(numberFor(plain, 'Z')).toBe(55);
    expect(letterFor(plain, 55)).toBe('Z');
  });

  it('reports nothing for a number that is not a cell', () => {
    // Both digits must be 1-5. A wrong key produces exactly this, which is a
    // detectable failure rather than a plausible wrong letter.
    expect(letterFor(plain, 6)).toBe('');
    expect(letterFor(plain, 66)).toBe('');
    expect(letterFor(plain, 10)).toBe('');
  });

  it('places the keyword first in the square', () => {
    expect(numberFor(buildSquareFor('ZEBRAS'), 'Z')).toBe(11);
  });
});

describe('the additive key', () => {
  it('turns the keyword into coordinates', () => {
    expect(keyNumbers(plain, 'AB')).toEqual([11, 12]);
  });

  it('falls back to 11 for a keyword with no letters', () => {
    expect(keyNumbers(plain, '!!')).toEqual([11]);
  });

  it('folds J onto I, because the square has no J', () => {
    expect(keyNumbers(plain, 'J')).toEqual(keyNumbers(plain, 'I'));
  });
});

describe('nihilist', () => {
  it('adds without carrying or reducing', () => {
    // A = 11 and the key letter A = 11, so the sum is 22 and not 0 or 4.
    expect(nihilist('A', '', 'A', 'encrypt')).toBe('22');
    // Z = 55 twice is 110, comfortably outside the coordinate range.
    expect(nihilist('Z', '', 'Z', 'encrypt')).toBe('110');
  });

  it('round-trips a message', () => {
    const text = 'Meet me at dawn';
    const encrypted = nihilist(text, 'ZEBRAS', 'RUSSIA', 'encrypt');
    expect(nihilist(encrypted, 'ZEBRAS', 'RUSSIA', 'decrypt')).toBe('MEETMEATDAWN');
  });

  it('produces one number per letter', () => {
    expect(nihilist('ATTACK', 'ZEBRAS', 'RUSSIA', 'encrypt').split(' ')).toHaveLength(6);
  });

  it('drops spacing and punctuation', () => {
    expect(nihilist('at dawn!', 'ZEBRAS', 'RUSSIA', 'encrypt')).toBe(
      nihilist('atdawn', 'ZEBRAS', 'RUSSIA', 'encrypt'),
    );
  });

  it('repeats the additive key, which is the flaw', () => {
    // Same letter, six apart, with a six-letter key: identical ciphertext number.
    const numbers = nihilist('AXXXXXA', 'ZEBRAS', 'RUSSIA', 'encrypt').split(' ');
    expect(numbers[0]).toBe(numbers[6]);
  });

  it('leaks: some sums cannot come from a small key number', () => {
    // A sum above 55 forces the key coordinate to be large, before any
    // frequency analysis at all. Vigenere's modulo destroys this information.
    const numbers = parseNumbers(nihilist('ZZZZ', '', 'ZZZZ', 'encrypt'));
    expect(numbers.every((n) => n > 55)).toBe(true);
  });

  it('handles the empty string', () => {
    expect(nihilist('', 'ZEBRAS', 'RUSSIA', 'encrypt')).toBe('');
    expect(nihilist('', 'ZEBRAS', 'RUSSIA', 'decrypt')).toBe('');
  });
});

describe('parseNumbers', () => {
  it('reads the numbers out of a spaced list', () => {
    expect(parseNumbers('42 68 59')).toEqual([42, 68, 59]);
  });

  it('ignores anything that is not a number', () => {
    expect(parseNumbers('42, 68; 59.')).toEqual([42, 68, 59]);
  });
});

describe('nihilistTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me at dawn';
    expect(nihilistTrace(text, 'ZEBRAS', 'RUSSIA', 'encrypt').output).toBe(
      nihilist(text, 'ZEBRAS', 'RUSSIA', 'encrypt'),
    );
    const encrypted = nihilist(text, 'ZEBRAS', 'RUSSIA', 'encrypt');
    expect(nihilistTrace(encrypted, 'ZEBRAS', 'RUSSIA', 'decrypt').output).toBe(
      nihilist(encrypted, 'ZEBRAS', 'RUSSIA', 'decrypt'),
    );
  });

  it('emits one step per character, dropped ones included', () => {
    const { steps } = nihilistTrace('A B', 'ZEBRAS', 'RUSSIA', 'encrypt');
    expect(steps).toHaveLength(3);
    expect(steps[1]?.data?.['isLetter']).toBe(false);
  });

  it('points each step at the digits it produced in the output', () => {
    const { steps } = nihilistTrace('AB', '', 'AA', 'encrypt');
    // '22 23': the first number is at 0-2, the second at 3-5.
    expect(steps[0]?.outputHighlight).toEqual({ start: 0, end: 2 });
    expect(steps[1]?.outputHighlight).toEqual({ start: 3, end: 5 });
  });

  it('flags a sum that is already above the coordinate range', () => {
    expect(nihilistTrace('Z', '', 'Z', 'encrypt').steps[0]?.detail).toContain('above 55');
  });

  it('says when a decryption produces an impossible coordinate', () => {
    // 99 - 11 = 88, whose digits are outside 1-5. The cipher fails loudly.
    const { steps } = nihilistTrace('99', '', 'A', 'decrypt');
    expect(steps[0]?.data?.['isLetter']).toBe(false);
    expect(steps[0]?.detail).toContain('not a cell of the square');
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const key = { keyword: 'ZEBRAS', additive: 'RUSSIA' };
    const encrypted = nihilistCipher.encrypt('Attack at dawn', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = nihilistCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, key);
    expect('output' in decrypted && decrypted.output).toBe('ATTACKATDAWN');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of nihilistCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => nihilistCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('tells the reader how it breaks, and blames the missing modulo', () => {
    expect(nihilistCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(nihilistCipher.explainer).toContain('missing modulo');
  });
});
