import { describe, expect, it } from 'vitest';
import { TABLE, charFor, codeFor, lettersByCodeLength, morse, morseTrace, unmorse, unmorseTrace } from './morse';
import { ENGLISH_LETTER_FREQUENCY } from '../../../lib/frequency';
import morseCipher from './index';

describe('the table', () => {
  it('covers the alphabet, the digits and some punctuation', () => {
    for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      expect(codeFor(char)).not.toBe('');
    }
    expect(codeFor('?')).toBe('..--..');
  });

  it('uses only dots and dashes', () => {
    for (const code of Object.values(TABLE)) {
      expect(code).toMatch(/^[.-]+$/);
    }
  });

  it('gives no two characters the same code', () => {
    const codes = Object.values(TABLE);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('reads every code back to its character', () => {
    for (const [char, code] of Object.entries(TABLE)) {
      expect(charFor(code)).toBe(char);
    }
  });

  it('gives the commonest English letters the shortest codes', () => {
    // The claim the explainer makes, checked against the frequency table this
    // app already uses for its attacks rather than taken on trust.
    const byLength = lettersByCodeLength();
    const shortest = byLength.slice(0, 6).map((r) => r.letter);
    expect(shortest).toContain('E');
    expect(shortest).toContain('T');

    // Average frequency of the six shortest codes should beat the six longest.
    const freq = (letter: string) => ENGLISH_LETTER_FREQUENCY[letter.charCodeAt(0) - 65] ?? 0;
    const mean = (letters: string[]) =>
      letters.reduce((sum, l) => sum + freq(l), 0) / letters.length;
    const longest = byLength.slice(-6).map((r) => r.letter);
    expect(mean(shortest)).toBeGreaterThan(mean(longest) * 3);
  });

  it('gives E and T one symbol each, which is the whole design', () => {
    expect(codeFor('E')).toBe('.');
    expect(codeFor('T')).toBe('-');
    expect(codeFor('Q')).toHaveLength(4);
  });
});

describe('morse', () => {
  it('encodes a word', () => {
    expect(morse('SOS')).toBe('... --- ...');
  });

  it('separates words with a slash', () => {
    expect(morse('AT DAWN')).toBe('.- - / -.. .- .-- -.');
  });

  it('is case-insensitive', () => {
    expect(morse('sos')).toBe(morse('SOS'));
  });

  it('round-trips a message, losing only the case', () => {
    const text = 'MEET ME AT DAWN';
    expect(unmorse(morse(text))).toBe(text);
  });

  it('round-trips digits and punctuation', () => {
    expect(unmorse(morse('HILL 42, 0600.'))).toBe('HILL 42, 0600.');
  });

  it('drops what the table has no code for', () => {
    expect(morse('A~B')).toBe('.- -...');
  });

  it('handles the empty string', () => {
    expect(morse('')).toBe('');
    expect(unmorse('')).toBe('');
  });

  it('is shorter than a fixed-length code would be, on English', () => {
    // Five bits per character for a 26-letter alphabet; Morse beats that on
    // English because the short codes are the common letters.
    const text = 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG';
    const symbols = morse(text).replace(/[^.-]/g, '').length;
    expect(symbols / text.length).toBeLessThan(5);
  });
});

describe('morseTrace', () => {
  it('agrees with the untraced encoder', () => {
    expect(morseTrace('MEET ME AT DAWN').output).toBe(morse('MEET ME AT DAWN'));
  });

  it('agrees with the untraced decoder', () => {
    const encoded = morse('MEET ME AT DAWN');
    expect(unmorseTrace(encoded).output).toBe(unmorse(encoded));
  });

  it('emits one step per character, gaps and drops included', () => {
    const { steps } = morseTrace('A B~');
    expect(steps.filter((s) => s.data?.['isChar'] === true)).toHaveLength(2);
    expect(steps.filter((s) => s.data?.['gap'] === true)).toHaveLength(1);
  });

  it('points each step at the symbols it produced', () => {
    const { steps } = morseTrace('SOS');
    expect(steps[0]?.outputHighlight).toEqual({ start: 0, end: 3 });
    // '... ' is four characters, so the next code starts at 4.
    expect(steps[1]?.outputHighlight).toEqual({ start: 4, end: 7 });
  });

  it('reports the symbols-per-character cost as a step', () => {
    const summary = morseTrace('SOS').steps.find((s) => s.data?.['summary'] === true);
    expect(Number(summary?.data?.['characters'])).toBe(3);
    expect(Number(summary?.data?.['symbols'])).toBe(9);
  });

  it('says when a decoded group is not in the table', () => {
    const { steps } = unmorseTrace('..--..--..');
    expect(steps[0]?.data?.['isChar']).toBe(false);
    expect(steps[0]?.detail).toContain('not in the International Morse table');
  });
});

describe('the module', () => {
  it('is in the encoding family, not the classical one', () => {
    // Deliberate. The classical family's catalogue description says every one of
    // them is broken, and Morse is not broken — it never tried to be secret.
    expect(morseCipher.family).toBe('encoding');
  });

  it('has no key at all', () => {
    expect(morseCipher.params).toEqual([]);
  });

  it('has no Attack tab, because nothing is hidden', () => {
    expect(morseCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(morseCipher.attack).toBeUndefined();
  });

  it('round-trips through the module', () => {
    const encrypted = morseCipher.encrypt('MEET ME AT DAWN', {});
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = morseCipher.decrypt(output, {});
    expect('output' in decrypted && decrypted.output).toBe('MEET ME AT DAWN');
  });

  it('says plainly that encoding is not encryption', () => {
    expect(morseCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(morseCipher.explainer).toContain('There is nothing to break');
    expect(morseCipher.explainer).toContain('Base64');
  });
});
