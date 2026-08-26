import { describe, expect, it } from 'vitest';
import { beaufort, beaufortLetter, beaufortTrace, keyValues, normalisedKey, tableauRow } from './beaufort';
import { breakBeaufort, solveColumn, solveKey } from './attack';
import { vigenere } from '../vigenere/vigenere';
import { candidateKeyLengths, lettersOnly } from '../vigenere/attack';
import { chiSquaredEnglish } from '../../../../lib/frequency';
import beaufortCipher from './index';

describe('beaufortLetter', () => {
  it('subtracts the plaintext from the key', () => {
    // K = 10, E = 4, so 10 - 4 = 6 -> G.
    expect(beaufortLetter(4, 10)).toBe(6);
  });

  it('wraps below zero rather than returning a negative index', () => {
    // A = 0, Z = 25: 0 - 25 = -25, which is 1 mod 26 -> B.
    expect(beaufortLetter(25, 0)).toBe(1);
  });

  it('is its own inverse for every pair, which is the whole cipher', () => {
    for (let key = 0; key < 26; key += 1) {
      for (let plain = 0; plain < 26; plain += 1) {
        expect(beaufortLetter(beaufortLetter(plain, key), key)).toBe(plain);
      }
    }
  });
});

describe('the key', () => {
  it('keeps letters and discards everything else', () => {
    expect(normalisedKey('be au!fort')).toBe('BEAUFORT');
  });

  it('falls back to A for a key with no letters, rather than dividing by zero', () => {
    expect(keyValues('!!!')).toEqual([0]);
    expect(beaufort('ABC', '!!!')).toBe('AZY');
  });
});

describe('beaufort', () => {
  it('encrypts a known pair by hand', () => {
    // Key A: 0 - p, so A->A, B->Z, C->Y.
    expect(beaufort('ABC', 'A')).toBe('AZY');
  });

  it('is its own inverse on real text', () => {
    const text = 'Meet me at the old bridge at midnight.';
    expect(beaufort(beaufort(text, 'BEAUFORT'), 'BEAUFORT')).toBe(text);
  });

  it('preserves case and passes non-letters through', () => {
    expect(beaufort('a b!', 'A')).toBe('a z!');
  });

  it('does not advance the key on a non-letter', () => {
    // Both messages have the same letters, so both must encrypt to the same
    // letters — the spaces must not consume key.
    const spaced = beaufort('AT DAWN', 'KEY').replace(/ /g, '');
    expect(spaced).toBe(beaufort('ATDAWN', 'KEY'));
  });

  it('is not the same cipher as Vigenère, despite the family resemblance', () => {
    expect(beaufort('ATTACK', 'KEY')).not.toBe(vigenere('ATTACK', 'KEY', 'encrypt'));
  });

  it('relates to Vigenère exactly as K − P relates to P + K', () => {
    // Beaufort(P) = K - P = Vigenère-encrypt of (-P). Checked the direct way:
    // decrypting a Beaufort ciphertext with Vigenère gives the negated plaintext.
    const text = 'ATTACKATDAWN';
    const beau = beaufort(text, 'KEY');
    const back = vigenere(beau, 'KEY', 'decrypt');
    const negated = text
      .split('')
      .map((c) => String.fromCharCode(65 + ((26 - (c.charCodeAt(0) - 65)) % 26)))
      .join('');
    expect(back).toBe(negated);
  });

  it('handles the empty string', () => {
    expect(beaufort('', 'KEY')).toBe('');
  });
});

describe('tableauRow', () => {
  it('is a permutation of the alphabet for every key letter', () => {
    for (let k = 0; k < 26; k += 1) {
      expect(tableauRow(k).split('').sort().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }
  });

  it('is symmetric: the row read as a map is its own inverse', () => {
    const row = tableauRow(7);
    for (let p = 0; p < 26; p += 1) {
      const c = row.charCodeAt(p) - 65;
      expect(row.charCodeAt(c) - 65).toBe(p);
    }
  });
});

describe('beaufortTrace', () => {
  it('agrees with the untraced cipher', () => {
    const text = 'Meet me at dawn.';
    expect(beaufortTrace(text, 'BEAUFORT').output).toBe(beaufort(text, 'BEAUFORT'));
  });

  it('emits one step per character, non-letters included', () => {
    const text = 'Hi there!';
    const { steps } = beaufortTrace(text, 'KEY');
    expect(steps).toHaveLength(text.length);
    steps.forEach((step, i) => expect(step.highlight).toEqual({ start: i, end: i + 1 }));
  });

  it('records the key position so the visualizer can set the rule', () => {
    const { steps } = beaufortTrace('ABCD', 'KEY');
    expect(steps.map((s) => s.data?.['keyPosition'])).toEqual([0, 1, 2, 0]);
  });

  it('flags the letters where the subtraction went below zero', () => {
    const { steps } = beaufortTrace('AZ', 'A');
    expect(steps[0]?.data?.['wrapped']).toBe(false);
    expect(steps[1]?.data?.['wrapped']).toBe(true);
  });
});

describe('the attack', () => {
  const plaintext =
    'The index of coincidence tells you how long the key is, and once you know how long ' +
    'the key is the message falls apart into that many separate puzzles, each of which ' +
    'is small enough to solve by counting letters and comparing them against English.';

  it('recovers the key from a decent amount of text', () => {
    const ciphertext = beaufort(plaintext, 'NAVY');
    const best = breakBeaufort(ciphertext)[0];
    expect(best?.key['key']).toBe('NAVY');
  });

  it('recovers the plaintext exactly, not just approximately', () => {
    const ciphertext = beaufort(plaintext, 'BEAUFORT');
    expect(breakBeaufort(ciphertext)[0]?.plaintext).toBe(plaintext);
  });

  it('solves one column by trying all 26 key letters', () => {
    const letters = lettersOnly(beaufort(plaintext, 'Q'));
    expect(solveColumn(letters)).toBe('Q'.charCodeAt(0) - 65);
  });

  it('assembles the key one column at a time', () => {
    const letters = lettersOnly(beaufort(plaintext, 'NAVY'));
    expect(solveKey(letters, 4)).toBe('NAVY');
  });

  it('prefers the true short key over an overfitted long one', () => {
    // Chi-squared does not, and that is why it is not the ranking statistic: a
    // 16-letter key has four times the freedom and bends the letter counts closer
    // to English while producing text that is not English.
    const ciphertext = beaufort(plaintext, 'NAVY');
    const chiOfTruth = chiSquaredEnglish(beaufort(ciphertext, 'NAVY'));
    const overfit = solveKey(lettersOnly(ciphertext), 16);
    expect(chiSquaredEnglish(beaufort(ciphertext, overfit))).toBeLessThan(chiOfTruth);
    expect(breakBeaufort(ciphertext)[0]?.key['key']).toBe('NAVY');
  });

  it('ranks lower-is-better, like every other attack in the app', () => {
    const candidates = breakBeaufort(beaufort(plaintext, 'NAVY'));
    const scores = candidates.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it('returns nothing for text with no letters in it', () => {
    expect(breakBeaufort('12345 !!!')).toEqual([]);
  });

  it("finds the period with Vigenère's own function, unmodified", () => {
    // The point of the attack file, asserted rather than claimed: the function
    // written to find a Vigenère key length finds a Beaufort one, because the
    // repeating key is the flaw and the arithmetic on top of it is not.
    const letters = lettersOnly(beaufort(plaintext, 'NAVY'));
    expect(candidateKeyLengths(letters)).toContain(4);
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = beaufortCipher.encrypt('ABC', { key: 'A' });
    expect('output' in result && result.output).toBe('AZY');
  });

  it('round-trips through the module with the identical operation', () => {
    const key = { key: 'BEAUFORT' };
    const encrypted = beaufortCipher.encrypt('Attack at dawn!', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = beaufortCipher.decrypt(output, key);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of beaufortCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => beaufortCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('names the statistic its attack ranks by', () => {
    expect(beaufortCipher.attackScoreLabel).toBe('bigram fit');
  });

  it('implements every tier it claims', () => {
    expect(beaufortCipher.tiers).toContain('attack');
    expect(beaufortCipher.attack).toBeDefined();
    expect(beaufortCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks, and that it breaks the same way as Vigenère', () => {
    expect(beaufortCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(beaufortCipher.explainer).toContain('Vigenère attack, unchanged');
  });
});
