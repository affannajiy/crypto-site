import { describe, expect, it } from 'vitest';
import {
  columnLengths,
  columnar,
  columnarOrder,
  columnarTrace,
  invert,
  keyOrder,
  keyRanks,
} from './columnar';
import { MAX_ATTACK_WIDTH, breakColumnar, keywordForOrder, permutations } from './attack';
import { chiSquaredEnglish } from '../../../lib/frequency';
import columnarCipher from './index';

describe('keyOrder', () => {
  it('reads the columns in alphabetical order of the keyword', () => {
    // KEYWORD: D is first (index 6), E second (1), K third (0), O fourth (4),
    // R fifth (5), W sixth (3), Y seventh (2).
    expect(keyOrder('KEYWORD')).toEqual([6, 1, 0, 4, 5, 3, 2]);
  });

  it('breaks ties between repeated letters by position, left to right', () => {
    // BALLOON: the two Ls and the two Os would otherwise be ambiguous, and two
    // people with the same key would encrypt differently.
    expect(keyOrder('BALLOON')).toEqual([1, 0, 2, 3, 6, 4, 5]);
  });

  it('ignores anything that is not a letter', () => {
    expect(keyOrder('k-e y!')).toEqual([1, 0, 2]);
  });
});

describe('keyRanks', () => {
  it('numbers each column with its place in the reading order', () => {
    expect(keyRanks('CAB')).toEqual([3, 1, 2]);
  });
});

describe('columnLengths', () => {
  it('gives every column the same height when the message divides exactly', () => {
    expect(columnLengths(12, 3)).toEqual([4, 4, 4]);
  });

  it('gives the leftmost columns the extra characters', () => {
    // 14 characters over 4 columns: rows of 4,4,3,3. The message is written
    // across, so the last row stops after the second column.
    expect(columnLengths(14, 4)).toEqual([4, 4, 3, 3]);
  });

  it('handles a message shorter than one row', () => {
    expect(columnLengths(2, 5)).toEqual([1, 1, 0, 0, 0]);
  });
});

describe('columnar', () => {
  it('reads the columns out in keyword order', () => {
    // ABC keeps the columns in place, so this is a plain column-wise readout.
    expect(columnar('ABCDEF', 'ABC')).toBe('ADBECF');
  });

  it('reorders the columns when the keyword is not sorted', () => {
    // CAB reads column 2 first, then column 3, then column 1.
    expect(columnar('ABCDEF', 'CAB')).toBe('BECFAD');
  });

  it('round-trips any text, including a ragged last row', () => {
    const text = "Meet me at the old bridge, 11:45 p.m. Don't be late!";
    for (const keyword of ['AB', 'CAB', 'KEYWORD', 'BALLOON', 'ZEBRA']) {
      expect(columnar(columnar(text, keyword), keyword, 'decrypt')).toBe(text);
    }
  });

  it('never changes which letters are present — it is a transposition', () => {
    const text = 'attack at dawn';
    expect(columnar(text, 'KEYWORD').split('').sort().join('')).toBe(
      text.split('').sort().join(''),
    );
  });

  it('refuses a one-letter keyword, which would be a copy rather than a cipher', () => {
    expect(() => columnar('HELLO', 'A')).toThrow(/at least 2 letters/);
  });

  it('refuses a keyword wider than the grid stays readable', () => {
    expect(() => columnar('HELLO', 'ABCDEFGHIJKLM')).toThrow(/stops at 12/);
  });

  it('handles the empty string', () => {
    expect(columnar('', 'KEY')).toBe('');
  });
});

describe('columnarOrder and invert', () => {
  it('is a permutation of every position, with nothing lost or repeated', () => {
    const order = columnarOrder(14, 'KEYWORD');
    expect(order).toHaveLength(14);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 14 }, (_, i) => i));
  });

  it('inverts to the destination of each input character', () => {
    const order = columnarOrder(6, 'CAB');
    // columnar('ABCDEF', 'CAB') is 'BECFAD', so input 0 ('A') lands at output 4.
    expect(invert(order)[0]).toBe(4);
  });
});

describe('columnarTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me at dawn.';
    expect(columnarTrace(text, 'KEYWORD').output).toBe(columnar(text, 'KEYWORD'));
    expect(columnarTrace(text, 'KEYWORD', 'decrypt').output).toBe(
      columnar(text, 'KEYWORD', 'decrypt'),
    );
  });

  it('emits one step per character, in the order the ciphertext is read off', () => {
    const { steps } = columnarTrace('ABCDEF', 'CAB');
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.input).join('')).toBe('BECFAD');
  });

  it('sets both highlights, because the character moves', () => {
    // The very reason `Step.outputHighlight` was added to the contract.
    const step = columnarTrace('ABCDEF', 'CAB').steps[0];
    expect(step?.highlight).toEqual({ start: 1, end: 2 });
    expect(step?.outputHighlight).toEqual({ start: 0, end: 1 });
  });

  it('carries the shape the visualizer reads', () => {
    expect(columnarTrace('ABCDEF', 'CAB').steps[0]?.data).toMatchObject({
      char: 'B',
      row: 0,
      column: 1,
      columns: 3,
      rank: 1,
      keyLetter: 'A',
      outputIndex: 0,
    });
  });
});

describe('permutations', () => {
  it('produces every arrangement exactly once', () => {
    expect(permutations(3)).toHaveLength(6);
    expect(new Set(permutations(4).map((p) => p.join(''))).size).toBe(24);
  });

  it('is deterministic, so the attack ranking is reproducible', () => {
    expect(permutations(3)).toEqual(permutations(3));
  });
});

describe('keywordForOrder', () => {
  it('builds a keyword whose ranking is the given order', () => {
    // Read column 2 first, then column 0, then column 1.
    expect(keywordForOrder([2, 0, 1])).toBe('BCA');
    expect(keyOrder(keywordForOrder([2, 0, 1]))).toEqual([2, 0, 1]);
  });
});

describe('breakColumnar', () => {
  it('recovers a short message from a 5-column key', () => {
    const plain = 'the general will attack the northern bridge at dawn tomorrow';
    const candidates = breakColumnar(columnar(plain, 'ZEBRA'));
    expect(candidates[0]?.plaintext).toBe(plain);
  });

  it('hands back a key the cipher accepts, even though it is not the original', () => {
    // The attack searches column orders, not keywords, so the key it returns
    // reproduces the permutation rather than the sender's word.
    const plain = 'the general will attack the northern bridge at dawn tomorrow';
    const best = breakColumnar(columnar(plain, 'ZEBRA'))[0];
    const keyword = String(best?.key['keyword'] ?? '');
    expect(keyword).not.toBe('ZEBRA');
    expect(columnar(columnar(plain, 'ZEBRA'), keyword, 'decrypt')).toBe(plain);
  });

  it('scores lower-is-better, matching the rest of the app', () => {
    const candidates = breakColumnar(columnar('the quick brown fox jumps over it', 'CAB'));
    for (let i = 1; i < candidates.length; i += 1) {
      expect(candidates[i]?.score).toBeGreaterThanOrEqual(candidates[i - 1]?.score ?? 0);
    }
  });

  it('cannot be ranked by chi-squared, which is why it is not', () => {
    // Every candidate is a rearrangement of the same letters, so the letter
    // counts — and therefore chi-squared — are identical to the last decimal.
    const candidates = breakColumnar(columnar('the quick brown fox jumps over it', 'CAB'));
    const scores = candidates.map((c) => chiSquaredEnglish(c.plaintext).toFixed(10));
    expect(new Set(scores).size).toBe(1);
  });

  it('stops at the documented width rather than hanging', () => {
    const labels = breakColumnar(columnar('a somewhat longer message for the search', 'ZEBRA'))
      .map((c) => c.label);
    for (const label of labels) {
      const width = Number(label.split(' ')[0]);
      expect(width).toBeLessThanOrEqual(MAX_ATTACK_WIDTH);
    }
  });

  it('returns nothing for the empty string rather than throwing', () => {
    expect(breakColumnar('')).toEqual([]);
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = columnarCipher.encrypt('ABCDEF', { keyword: 'CAB' });
    expect('output' in result && result.output).toBe('BECFAD');
  });

  it('round-trips through the module', () => {
    const encrypted = columnarCipher.encrypt('Attack at dawn!', { keyword: 'KEYWORD' });
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = columnarCipher.decrypt(output, { keyword: 'KEYWORD' });
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('names the statistic its attack actually uses', () => {
    expect(columnarCipher.attackScoreLabel).toBe('bigram fit');
  });

  it('implements every tier it claims', () => {
    expect(columnarCipher.tiers).toContain('attack');
    expect(columnarCipher.attack).toBeDefined();
    expect(columnarCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks, including the attack this page cannot run', () => {
    expect(columnarCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(columnarCipher.explainer).toContain('multiple anagramming');
  });
});
