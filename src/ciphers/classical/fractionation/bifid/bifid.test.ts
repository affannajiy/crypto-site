import { describe, expect, it } from 'vitest';
import { bifid, bifidTrace, blocks, foldBlock, grid, prepare, squareFor, unfoldBlock, usableKeyword } from './bifid';
import { chiSquaredEnglish, letterCounts } from '../../../../lib/frequency';
import bifidCipher from './index';

describe('the square', () => {
  it('holds 25 cells with the keyword first', () => {
    const square = squareFor('BIFID');
    expect(square.cells).toHaveLength(25);
    // BIFID -> B, I, F, D (each letter kept only the first time it appears).
    expect(square.cells.slice(0, 4).join('')).toBe('BIFD');
  });

  it('contains every letter except J, exactly once', () => {
    const cells = squareFor('DELASTELLE').cells.slice().sort().join('');
    expect(cells).toBe('ABCDEFGHIKLMNOPQRSTUVWXYZ');
  });

  it('folds J onto I in the keyword too', () => {
    expect(usableKeyword('JULY')).toBe('IULY');
  });
});

describe('prepare', () => {
  it('keeps only letters and remembers where each came from', () => {
    const { letters, sources } = prepare('At dawn!');
    expect(letters).toBe('ATDAWN');
    expect(sources).toEqual([0, 1, 3, 4, 5, 6]);
  });

  it('writes J as I and says that it did', () => {
    expect(prepare('JAM').letters).toBe('IAM');
    expect(prepare('JAM').foldedJ).toBe(true);
    expect(prepare('HAM').foldedJ).toBe(false);
  });
});

describe('blocks', () => {
  it('cuts the message into fixed-size pieces', () => {
    expect(blocks(7, 3)).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 6 },
      { start: 6, end: 7 },
    ]);
  });

  it('treats period 0 as one block for the whole message', () => {
    expect(blocks(9, 0)).toEqual([{ start: 0, end: 9 }]);
  });

  it('has nothing to do with an empty message', () => {
    expect(blocks(0, 5)).toEqual([]);
  });
});

describe('the fold', () => {
  const square = squareFor('');

  it('reads the rows line and then the columns line', () => {
    // Plain 25-letter square, five to a row:
    //   A B C D E / F G H I K / L M N O P / Q R S T U / V W X Y Z
    // so F is (1,0), L is (2,0) and E is (0,4).
    const { rows, cols } = grid(square, 'FLE');
    expect(rows).toEqual([1, 2, 0]);
    expect(cols).toEqual([0, 0, 4]);
    // Stream is 1 2 0 0 0 4, so the pairs are (1,2) (0,0) (0,4) -> H A E.
    expect(foldBlock(square, 'FLE')).toBe('HAE');
  });

  it('is undone exactly by the unfold', () => {
    for (const word of ['FLEE', 'ATTACKATDAWN', 'A', 'ABCDEFGHIK']) {
      expect(unfoldBlock(square, foldBlock(square, word))).toBe(word);
    }
  });

  it('returns as many letters as it was given', () => {
    expect(foldBlock(square, 'ABCDE')).toHaveLength(5);
    expect(foldBlock(square, 'ABCDEF')).toHaveLength(6);
  });
});

describe('bifid', () => {
  it('round-trips at every period', () => {
    const text = 'Meet me at the old bridge at midnight';
    for (const period of [0, 1, 2, 5, 7, 20]) {
      const encrypted = bifid(text, 'DELASTELLE', period, 'encrypt');
      expect(bifid(encrypted, 'DELASTELLE', period, 'decrypt')).toBe(prepare(text).letters);
    }
  });

  it('matches the worked example printed in the explainer', () => {
    // DELASTELLE square, no period: FLEEA -> TDAIF. If this ever changes, the
    // explainer is telling readers something they cannot reproduce on the page.
    expect(bifid('FLEEA', 'DELASTELLE', 0, 'encrypt')).toBe('TDAIF');
    expect(bifidCipher.explainer).toContain('So FLEEA becomes TDAIF');
  });

  it('drops spacing and punctuation, because the fold has nowhere to put them', () => {
    expect(bifid('at dawn!', 'KEY', 0, 'encrypt')).toHaveLength(6);
  });

  it('changes completely when the period changes', () => {
    const text = 'ATTACKATDAWNTOMORROW';
    expect(bifid(text, 'KEY', 5, 'encrypt')).not.toBe(bifid(text, 'KEY', 6, 'encrypt'));
  });

  it('changes completely when one letter of the keyword changes', () => {
    const text = 'ATTACKATDAWNTOMORROW';
    expect(bifid(text, 'KEYA', 5, 'encrypt')).not.toBe(bifid(text, 'KEYB', 5, 'encrypt'));
  });

  it('destroys letter frequencies, which a substitution cipher cannot', () => {
    // A substitution permutes the counts, so the sorted counts are unchanged. A
    // fractionating cipher does not even preserve those, because no ciphertext
    // letter corresponds to a plaintext letter at all.
    const text = 'THEQUICKBROWNFOXIUMPSOVERTHELAZYDOGANDTHENTROTSQUIETLYHOMEAGAIN';
    const before = letterCounts(text).sort((a, b) => b - a);
    const after = letterCounts(bifid(text, 'KEY', 0, 'encrypt')).sort((a, b) => b - a);
    expect(after).not.toEqual(before);
  });

  it('produces text that does not look like English', () => {
    const text =
      'The index of coincidence tells you how long the key is and once you know that ' +
      'the message falls apart into that many separate and much smaller puzzles.';
    expect(chiSquaredEnglish(bifid(text, 'KEY', 0, 'encrypt'))).toBeGreaterThan(
      chiSquaredEnglish(text),
    );
  });

  it('spreads one plaintext letter across two ciphertext letters — but only two', () => {
    // Worth measuring rather than assuming. Each plaintext letter contributes
    // exactly two digits to the stream, and each digit lands in exactly one
    // output pair, so changing one input letter changes AT MOST two outputs —
    // and only one when both of its digits happen to fall in the same pair.
    // That beats a substitution, which always changes exactly one. It is a long
    // way short of the avalanche a modern block cipher gives.
    const base = 'ATTACKATDAWN';
    const counts = new Set<number>();
    for (const swap of 'BCDEFGHIKLMNOPQRSTUVWXYZ') {
      const a = bifid(base, 'KEY', 0, 'encrypt');
      const b = bifid(swap + base.slice(1), 'KEY', 0, 'encrypt');
      let differences = 0;
      for (let i = 0; i < a.length; i += 1) {
        if (a.charAt(i) !== b.charAt(i)) differences += 1;
      }
      counts.add(differences);
    }
    expect(Math.max(...counts)).toBe(2);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
  });

  it('handles the empty string', () => {
    expect(bifid('', 'KEY', 5, 'encrypt')).toBe('');
  });

  it('handles an odd block at the end', () => {
    // Seven letters at period 5 leaves a block of two, which must still fold.
    expect(bifid('ABCDEFG', 'KEY', 5, 'encrypt')).toHaveLength(7);
  });
});

describe('bifidTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me at dawn';
    for (const direction of ['encrypt', 'decrypt'] as const) {
      expect(bifidTrace(text, 'KEY', 5, direction).output).toBe(bifid(text, 'KEY', 5, direction));
    }
  });

  it('emits one step per output letter, plus one summary per block', () => {
    const { steps } = bifidTrace('ABCDEFG', 'KEY', 5, 'encrypt');
    const letters = steps.filter((s) => s.data?.['isLetter'] === true);
    const summaries = steps.filter((s) => s.data?.['isLetter'] === false);
    expect(letters).toHaveLength(7);
    expect(summaries).toHaveLength(2);
  });

  it('highlights the whole block in the input, not one letter', () => {
    // Deliberate. An output letter is built from pieces of two different input
    // letters, so pointing at one character would be a more precise lie.
    const { steps } = bifidTrace('ABCDE', 'KEY', 5, 'encrypt');
    expect(steps[0]?.highlight).toEqual({ start: 0, end: 5 });
  });

  it('points each step at exactly the output letter it produced', () => {
    const { steps } = bifidTrace('ABCDE', 'KEY', 5, 'encrypt');
    const letters = steps.filter((s) => s.data?.['isLetter'] === true);
    letters.forEach((step, i) => expect(step.outputHighlight).toEqual({ start: i, end: i + 1 }));
  });

  it('carries the grid the visualizer draws', () => {
    const { steps } = bifidTrace('ABCDE', 'KEY', 5, 'encrypt');
    expect(steps[0]?.data?.['rows']).toHaveLength(5);
    expect(steps[0]?.data?.['cols']).toHaveLength(5);
    expect(steps[0]?.data?.['pick']).toEqual([0, 1]);
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const key = { keyword: 'DELASTELLE', period: 5 };
    const encrypted = bifidCipher.encrypt('Attack at dawn', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = bifidCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, key);
    expect('output' in decrypted && decrypted.output).toBe('ATTACKATDAWN');
  });

  it('accepts period 0 and treats it as one block', () => {
    const key = { keyword: 'KEY', period: 0 };
    const encrypted = bifidCipher.encrypt('ATTACKATDAWN', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    expect(output).toBe(bifid('ATTACKATDAWN', 'KEY', 0, 'encrypt'));
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string | number> = {};
    for (const spec of bifidCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
      if (spec.kind === 'number') defaults[spec.name] = spec.default;
    }
    expect(() => bifidCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('has no Attack tab, and says why in the explainer', () => {
    expect(bifidCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(bifidCipher.attack).toBeUndefined();
    expect(bifidCipher.explainer).toContain('two unknowns that hide each other');
  });

  it('tells the reader how it breaks', () => {
    expect(bifidCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(bifidCipher.explainer).toContain('in depth');
  });
});
