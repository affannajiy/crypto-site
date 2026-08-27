import { describe, expect, it } from 'vitest';
import {
  ALPHABET_27,
  CELLS,
  EXTRA,
  blocks,
  buildCube,
  foldBlock,
  grid,
  locate,
  prepare,
  symbolAt,
  trifid,
  trifidTrace,
  unfoldBlock,
} from './trifid';
import { bifid } from '../bifid/bifid';
import trifidCipher from './index';

describe('the cube', () => {
  it('holds 27 cells, which is 26 letters and one spare', () => {
    expect(CELLS).toBe(27);
    expect(ALPHABET_27).toHaveLength(27);
    expect(buildCube('')).toHaveLength(27);
  });

  it('keeps J, unlike Bifid, because there is room for it', () => {
    // The whole reason for the 27th symbol. Bifid loses a letter; Trifid does not.
    expect(ALPHABET_27).toContain('J');
    expect(new Set(buildCube('KEY')).size).toBe(27);
  });

  it('puts the keyword first, each letter once', () => {
    expect(buildCube('DELASTELLE').slice(0, 6).join('')).toBe('DELAST');
  });

  it('contains every symbol exactly once whatever the keyword', () => {
    for (const keyword of ['', 'KEY', 'DELASTELLE', 'ZZZ.']) {
      expect(buildCube(keyword).slice().sort().join('')).toBe(
        ALPHABET_27.split('').sort().join(''),
      );
    }
  });

  it('addresses each cell by layer, row and column', () => {
    const cube = buildCube('');
    expect(locate(cube, 'A')).toEqual({ layer: 0, row: 0, col: 0 });
    expect(locate(cube, 'J')).toEqual({ layer: 1, row: 0, col: 0 });
    expect(locate(cube, EXTRA)).toEqual({ layer: 2, row: 2, col: 2 });
    expect(symbolAt(cube, 1, 0, 0)).toBe('J');
  });

  it('reports nothing for a symbol it does not hold', () => {
    expect(locate(buildCube(''), '!')).toBeNull();
  });
});

describe('prepare', () => {
  it('keeps letters and the spare symbol, and remembers where each came from', () => {
    const { symbols, sources } = prepare('At dawn.');
    expect(symbols).toBe('ATDAWN.');
    expect(sources).toEqual([0, 1, 3, 4, 5, 6, 7]);
  });

  it('drops everything the cube cannot hold', () => {
    expect(prepare('a-b!c').symbols).toBe('ABC');
  });
});

describe('the fold', () => {
  const cube = buildCube('');

  it('reads all three lines as one stream, cut into triples', () => {
    // Plain cube: A=(0,0,0), B=(0,0,1), C=(0,0,2).
    const { layers, rows, cols } = grid(cube, 'ABC');
    expect(layers).toEqual([0, 0, 0]);
    expect(rows).toEqual([0, 0, 0]);
    expect(cols).toEqual([0, 1, 2]);
    // Stream 0 0 0 0 0 0 0 1 2 -> (0,0,0) (0,0,0) (0,1,2) -> A A F
    expect(foldBlock(cube, 'ABC')).toBe('AAF');
  });

  it('is undone exactly by the unfold', () => {
    for (const word of ['FLEE', 'ATTACKATDAWN', 'A', 'ABC.XYZ']) {
      expect(unfoldBlock(cube, foldBlock(cube, word))).toBe(word);
    }
  });

  it('returns as many symbols as it was given', () => {
    expect(foldBlock(cube, 'ABCDE')).toHaveLength(5);
  });
});

describe('blocks', () => {
  it('cuts the message into fixed-size pieces, with period 0 meaning one block', () => {
    expect(blocks(7, 3)).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 6 },
      { start: 6, end: 7 },
    ]);
    expect(blocks(9, 0)).toEqual([{ start: 0, end: 9 }]);
    expect(blocks(0, 5)).toEqual([]);
  });
});

describe('trifid', () => {
  it('round-trips at every period', () => {
    const text = 'Meet me at the old bridge at midnight.';
    for (const period of [0, 1, 2, 5, 7, 20]) {
      const encrypted = trifid(text, 'DELASTELLE', period, 'encrypt');
      expect(trifid(encrypted, 'DELASTELLE', period, 'decrypt')).toBe(prepare(text).symbols);
    }
  });

  it('round-trips a message containing J, which Bifid cannot', () => {
    // Bifid folds J onto I and the J is gone for good. Trifid has a spare cell.
    expect(trifid(trifid('JAM', 'KEY', 0, 'encrypt'), 'KEY', 0, 'decrypt')).toBe('JAM');
    expect(bifid(bifid('JAM', 'KEY', 0, 'encrypt'), 'KEY', 0, 'decrypt')).toBe('IAM');
  });

  it('changes completely when the period changes', () => {
    const text = 'ATTACKATDAWNTOMORROW';
    expect(trifid(text, 'KEY', 5, 'encrypt')).not.toBe(trifid(text, 'KEY', 6, 'encrypt'));
  });

  it('changes when one letter of the keyword changes', () => {
    const text = 'ATTACKATDAWNTOMORROW';
    expect(trifid(text, 'KEYA', 5, 'encrypt')).not.toBe(trifid(text, 'KEYB', 5, 'encrypt'));
  });

  it('spreads one plaintext symbol across up to three ciphertext symbols', () => {
    // Bifid's ceiling is two, because a letter contributes two digits. Here it
    // is three. Measured rather than asserted, and it is a ceiling not a floor.
    const base = 'ATTACKATDAWNTOMORROW';
    let most = 0;
    for (const swap of 'BCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const a = trifid(base, 'KEY', 0, 'encrypt');
      const b = trifid(swap + base.slice(1), 'KEY', 0, 'encrypt');
      let differences = 0;
      for (let i = 0; i < a.length; i += 1) {
        if (a.charAt(i) !== b.charAt(i)) differences += 1;
      }
      most = Math.max(most, differences);
    }
    expect(most).toBe(3);
  });

  it('handles the empty string and a short final block', () => {
    expect(trifid('', 'KEY', 5, 'encrypt')).toBe('');
    expect(trifid('ABCDEFG', 'KEY', 5, 'encrypt')).toHaveLength(7);
  });
});

describe('trifidTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me at dawn.';
    for (const direction of ['encrypt', 'decrypt'] as const) {
      expect(trifidTrace(text, 'KEY', 5, direction).output).toBe(trifid(text, 'KEY', 5, direction));
    }
  });

  it('emits one step per output symbol', () => {
    const { steps } = trifidTrace('ABCDEFG', 'KEY', 5, 'encrypt');
    expect(steps.filter((s) => s.data?.['isSymbol'] === true)).toHaveLength(7);
  });

  it('highlights the whole block in the input, not one symbol', () => {
    const { steps } = trifidTrace('ABCDE', 'KEY', 5, 'encrypt');
    expect(steps[0]?.highlight).toEqual({ start: 0, end: 5 });
  });

  it('points each step at exactly the output symbol it produced', () => {
    const { steps } = trifidTrace('ABCDE', 'KEY', 5, 'encrypt');
    steps.forEach((step, i) => expect(step.outputHighlight).toEqual({ start: i, end: i + 1 }));
  });

  it('counts how many plaintext symbols each triple was assembled from', () => {
    const { steps } = trifidTrace('ATTACKATD', 'KEY', 0, 'encrypt');
    const counts = steps.map((s) => Number(s.data?.['sourceCount']));
    expect(Math.max(...counts)).toBe(3);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
  });

  it('carries all three coordinate lines for the visualizer', () => {
    const { steps } = trifidTrace('ABCDE', 'KEY', 5, 'encrypt');
    expect(steps[0]?.data?.['layers']).toHaveLength(5);
    expect(steps[0]?.data?.['rows']).toHaveLength(5);
    expect(steps[0]?.data?.['cols']).toHaveLength(5);
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const key = { keyword: 'DELASTELLE', period: 5 };
    const encrypted = trifidCipher.encrypt('Attack at dawn', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = trifidCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, key);
    expect('output' in decrypted && decrypted.output).toBe('ATTACKATDAWN');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string | number> = {};
    for (const spec of trifidCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
      if (spec.kind === 'number') defaults[spec.name] = spec.default;
    }
    expect(() => trifidCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('has no Attack tab, and admits the reason is the same as Bifid', () => {
    expect(trifidCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(trifidCipher.attack).toBeUndefined();
    expect(trifidCipher.explainer).toContain('Nothing new is being claimed');
  });

  it('tells the reader how it breaks', () => {
    expect(trifidCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(trifidCipher.explainer).toContain('depth');
  });
});
