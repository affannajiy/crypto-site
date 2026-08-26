import { describe, expect, it } from 'vitest';
import { ENGLISH_LETTER_FREQUENCY, chiSquaredEnglish, letterCounts, letterTotal } from './frequency';

describe('ENGLISH_LETTER_FREQUENCY', () => {
  it('covers 26 letters and sums to 100 percent', () => {
    expect(ENGLISH_LETTER_FREQUENCY).toHaveLength(26);
    const sum = ENGLISH_LETTER_FREQUENCY.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it('has no zero, so no expected count can divide by zero', () => {
    for (const frequency of ENGLISH_LETTER_FREQUENCY) {
      expect(frequency).toBeGreaterThan(0);
    }
  });
});

describe('letterCounts', () => {
  it('counts A-Z case-insensitively', () => {
    const counts = letterCounts('aAbB');
    expect(counts[0]).toBe(2);
    expect(counts[1]).toBe(2);
  });

  it('ignores everything that is not A-Z', () => {
    expect(letterTotal('!!! 123 ... é中🙂')).toBe(0);
    expect(letterTotal('a b, c!')).toBe(3);
  });

  it('does not miscount the characters either side of the letter ranges', () => {
    // '@' is 'A' - 1, '[' is 'Z' + 1, '`' is 'a' - 1, '{' is 'z' + 1.
    expect(letterTotal('@[`{')).toBe(0);
  });
});

describe('chiSquaredEnglish', () => {
  it('scores English text lower than the same text shifted by one', () => {
    const english = 'the quick brown fox jumps over the lazy dog and then does it again';
    const shifted = english.replace(/[a-z]/g, (c) =>
      String.fromCharCode(((c.charCodeAt(0) - 97 + 1) % 26) + 97),
    );
    expect(chiSquaredEnglish(english)).toBeLessThan(chiSquaredEnglish(shifted));
  });

  it('scores a run of one letter as a very poor fit', () => {
    expect(chiSquaredEnglish('zzzzzzzzzzzzzzzzzzzz')).toBeGreaterThan(1000);
  });

  it('returns Infinity when there are no letters, rather than a perfect zero', () => {
    expect(chiSquaredEnglish('')).toBe(Infinity);
    expect(chiSquaredEnglish('1234 !!!')).toBe(Infinity);
  });

  it('ignores case and punctuation', () => {
    expect(chiSquaredEnglish('Hello, World!')).toBeCloseTo(chiSquaredEnglish('helloworld'), 10);
  });
});
