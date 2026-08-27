import { describe, expect, it } from 'vitest';
import {
  MAX_RAILS,
  MIN_RAILS,
  describeChar,
  railFence,
  railFenceTrace,
  railOrder,
  railPattern,
} from './railfence';
import { breakRailFence } from './attack';
import { bigramScore } from '../../../../lib/bigrams';
import { chiSquaredEnglish } from '../../../../lib/frequency';
import railFenceCipher from './index';

/**
 * A seeded generator, so a property test that fails fails again on the next run.
 * An unreproducible test failure is worse than no test.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARAGRAPH = `
A transposition cipher keeps every letter of the message and changes only the
order they appear in. That sounds like a small difference and it is not one. The
statistic that breaks a substitution cipher counts how often each letter turns up,
and against a transposition that count is unchanged, so it says nothing at all.
What the rearrangement destroys is which letters sit next to which, and so that is
what an attacker learns to measure instead.
`.trim();

describe('railPattern', () => {
  it('zigzags down and back up', () => {
    expect(railPattern(9, 3)).toEqual([0, 1, 2, 1, 0, 1, 2, 1, 0]);
  });

  it('alternates for two rails', () => {
    expect(railPattern(6, 2)).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('never turns round when the message is shorter than the fence', () => {
    expect(railPattern(3, 8)).toEqual([0, 1, 2]);
  });

  it('lays a single rail flat rather than dividing by a period of zero', () => {
    expect(railPattern(4, 1)).toEqual([0, 0, 0, 0]);
  });

  it('is empty for empty text', () => {
    expect(railPattern(0, 3)).toEqual([]);
  });
});

describe('railOrder', () => {
  it('reads rail by rail', () => {
    // Positions 0,4,8 are rail 0; 1,3,5,7 are rail 1; 2,6 are rail 2.
    expect(railOrder(9, 3)).toEqual([0, 4, 8, 1, 3, 5, 7, 2, 6]);
  });

  it('is a permutation of every position, with nothing lost or doubled', () => {
    const random = mulberry32(7);
    for (let run = 0; run < 200; run += 1) {
      const length = Math.floor(random() * 80);
      const rails = MIN_RAILS + Math.floor(random() * (MAX_RAILS - MIN_RAILS + 1));
      const order = railOrder(length, rails);
      expect(order).toHaveLength(length);
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length }, (_, i) => i),
      );
    }
  });
});

describe('railFence', () => {
  it('matches the textbook vector', () => {
    expect(railFence('WEAREDISCOVERED', 3)).toBe('WECRERDSOEEAIVD');
  });

  it('decrypts the textbook vector back', () => {
    expect(railFence('WECRERDSOEEAIVD', 3, 'decrypt')).toBe('WEAREDISCOVERED');
  });

  it('changes not one character, only the order', () => {
    const plain = 'Meet me at the old bridge!';
    const cipher = railFence(plain, 4);
    expect(cipher).not.toBe(plain);
    expect(cipher.split('').sort().join('')).toBe(plain.split('').sort().join(''));
    expect(cipher).toHaveLength(plain.length);
  });

  it('with one rail changes nothing at all', () => {
    expect(railFence('Attack at dawn!', 1)).toBe('Attack at dawn!');
  });

  it('leaves text no longer than the fence alone', () => {
    // The zigzag never turns round, so each character gets its own rail in order.
    expect(railFence('ABC', 8)).toBe('ABC');
  });

  it('handles empty text', () => {
    expect(railFence('', 3)).toBe('');
    expect(railFence('', 3, 'decrypt')).toBe('');
  });

  it('round-trips any text at any rail count', () => {
    const random = mulberry32(20260825);
    const source = " abcXYZ.,!\n'0123zqM";
    for (let run = 0; run < 400; run += 1) {
      const rails = MIN_RAILS + Math.floor(random() * (MAX_RAILS - MIN_RAILS + 1));
      let text = '';
      const length = Math.floor(random() * 60);
      for (let i = 0; i < length; i += 1) {
        text += source.charAt(Math.floor(random() * source.length));
      }
      expect(railFence(railFence(text, rails), rails, 'decrypt')).toBe(text);
    }
  });
});

describe('describeChar', () => {
  it('names invisible characters instead of quoting them', () => {
    expect(describeChar(' ')).toBe('the space');
    expect(describeChar('\n')).toBe('the line break');
    expect(describeChar('Q')).toBe("'Q'");
  });
});

describe('railFenceTrace', () => {
  it('agrees with the untraced cipher', () => {
    expect(railFenceTrace(PARAGRAPH, 4).output).toBe(railFence(PARAGRAPH, 4));
    expect(railFenceTrace(PARAGRAPH, 4, 'decrypt').output).toBe(
      railFence(PARAGRAPH, 4, 'decrypt'),
    );
  });

  it('emits one step per character, in input order', () => {
    const text = 'Hi there!';
    const { steps } = railFenceTrace(text, 3);
    expect(steps).toHaveLength(text.length);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      expect(step.highlight).toEqual({ start: i, end: i + 1 });
      expect(step.input).toBe(text.charAt(i));
    });
  });

  it('gives the output pane its own range, and points it at the right character', () => {
    // The whole reason `outputHighlight` exists. Marking the output with the
    // input's range would highlight a different character entirely.
    const text = 'WEAREDISCOVERED';
    const { steps, output } = railFenceTrace(text, 3);
    steps.forEach((step, i) => {
      const range = step.outputHighlight;
      expect(range).toBeDefined();
      expect(output.charAt(range?.start ?? -1)).toBe(text.charAt(i));
    });
  });

  it('moves a character rather than changing it', () => {
    const { steps } = railFenceTrace('WEAREDISCOVERED', 3);
    steps.forEach((step) => {
      expect(step.output).toBe(step.input);
    });
  });

  it('sends position 5 back to position 1 on a three-rail fence', () => {
    // Position 4 (0-based) is the second character on rail 0, so it is read out
    // second, at output index 1.
    const step = railFenceTrace('WEAREDISCOVERED', 3).steps[4];
    expect(step?.outputHighlight).toEqual({ start: 1, end: 2 });
    expect(step?.title).toBe("Move 'E' to position 2 (rail 1)");
  });

  it('points the output range at the message when decrypting', () => {
    const cipher = 'WECRERDSOEEAIVD';
    const { steps, output } = railFenceTrace(cipher, 3, 'decrypt');
    expect(output).toBe('WEAREDISCOVERED');
    steps.forEach((step, i) => {
      const range = step.outputHighlight;
      expect(output.charAt(range?.start ?? -1)).toBe(cipher.charAt(i));
    });
  });

  it('carries the shape the visualizer reads', () => {
    const step = railFenceTrace('WEAREDISCOVERED', 3).steps[2];
    expect(step?.data).toMatchObject({
      rail: 2,
      rails: 3,
      fencePosition: 2,
      inputIndex: 2,
      // Rail 0 holds 4 characters and rail 1 holds 7, so the first character of
      // rail 2 is the 12th one read off.
      outputIndex: 11,
      char: 'A',
      direction: 'encrypt',
    });
  });

  it('reaches every output position exactly once', () => {
    const { steps } = railFenceTrace(PARAGRAPH, 5);
    const landed = steps.map((s) => s.outputHighlight?.start ?? -1).sort((a, b) => a - b);
    expect(landed).toEqual(Array.from({ length: PARAGRAPH.length }, (_, i) => i));
  });
});

describe('why this cipher needs a different statistic', () => {
  it('leaves chi-squared completely unable to tell candidates apart', () => {
    // The point of the whole exercise. Letter counts survive a transposition, so
    // every wrong answer scores exactly as well as the right one.
    const cipher = railFence(PARAGRAPH, 4);
    const scores = [2, 3, 4, 5, 6].map((rails) =>
      chiSquaredEnglish(railFence(cipher, rails, 'decrypt')),
    );
    const first = scores[0] ?? 0;
    for (const score of scores) expect(score).toBeCloseTo(first, 10);
  });

  it('but lets bigrams tell them apart easily', () => {
    const cipher = railFence(PARAGRAPH, 4);
    const right = bigramScore(railFence(cipher, 4, 'decrypt'));
    for (const wrong of [2, 3, 5, 6, 7]) {
      expect(right).toBeGreaterThan(bigramScore(railFence(cipher, wrong, 'decrypt')));
    }
  });
});

describe('bigramScore', () => {
  it('prefers English to the same letters shuffled', () => {
    expect(bigramScore('THE QUICK BROWN FOX')).toBeGreaterThan(bigramScore('XFNWRBKCQHTEUIO'));
  });

  it('has no opinion about text with under two letters', () => {
    expect(bigramScore('')).toBe(-Infinity);
    expect(bigramScore('A')).toBe(-Infinity);
    expect(bigramScore('!!!')).toBe(-Infinity);
  });

  it('ignores spacing and case', () => {
    expect(bigramScore('the there')).toBeCloseTo(bigramScore('THETHERE'), 10);
  });
});

describe('breakRailFence', () => {
  it('recovers the rail count from ciphertext alone', () => {
    for (const rails of [2, 3, 4, 5, 7]) {
      const best = breakRailFence(railFence(PARAGRAPH, rails))[0];
      expect(best?.key['rails']).toBe(rails);
      expect(best?.plaintext).toBe(PARAGRAPH);
    }
  });

  it('ranks lowest score first', () => {
    const scores = breakRailFence(railFence(PARAGRAPH, 4)).map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it('labels a candidate by its rail count', () => {
    expect(breakRailFence(railFence(PARAGRAPH, 4))[0]?.label).toBe('4 rails');
  });

  it('never offers the same plaintext twice', () => {
    const texts = breakRailFence(railFence('SHORT', 3)).map((c) => c.plaintext);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('is deterministic', () => {
    const cipher = railFence(PARAGRAPH, 6);
    expect(breakRailFence(cipher)).toEqual(breakRailFence(cipher));
  });

  it('does not throw on text too short to attack', () => {
    // Failing gracefully is the requirement; being right is not possible here.
    expect(() => breakRailFence('AB')).not.toThrow();
    expect(() => breakRailFence('')).not.toThrow();
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = railFenceCipher.encrypt('WEAREDISCOVERED', { rails: 3 });
    expect('output' in result && result.output).toBe('WECRERDSOEEAIVD');
  });

  it('round-trips through the module', () => {
    const encrypted = railFenceCipher.encrypt('Meet me at dawn!', { rails: 4 });
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = railFenceCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, { rails: 4 });
    expect('output' in decrypted && decrypted.output).toBe('Meet me at dawn!');
  });

  it('accepts a rail count that arrived from a form control as a string', () => {
    const result = railFenceCipher.encrypt('WEAREDISCOVERED', { rails: '3' });
    expect('output' in result && result.output).toBe('WECRERDSOEEAIVD');
  });

  it('explains itself rather than throwing a type error on a junk rail count', () => {
    expect(() => railFenceCipher.encrypt('hello', { rails: 'lots' })).toThrow(
      'Rails needs to be a whole number between 2 and 10.',
    );
  });

  it('earns all four tiers and implements each of them', () => {
    expect(railFenceCipher.tiers).toEqual(['encrypt', 'attack', 'visualize', 'benchmark']);
    expect(typeof railFenceCipher.attack).toBe('function');
    expect(railFenceCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks', () => {
    expect(railFenceCipher.explainer.toLowerCase()).toContain('how this breaks');
  });

  it('offers a key the attack can hand straight back', () => {
    const candidate = breakRailFence(railFence(PARAGRAPH, 4))[0];
    const names = railFenceCipher.params.map((spec) => spec.name);
    expect(Object.keys(candidate?.key ?? {})).toEqual(names);
  });
});
