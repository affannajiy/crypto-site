import { describe, expect, it } from 'vitest';
import { ALPHABET_SIZE, atbash, atbashTrace, describeChar, letterIndex, mirror, pairs } from './atbash';
import atbashCipher from './index';

describe('mirror', () => {
  it('sends A to Z and Z to A', () => {
    expect(mirror(0)).toBe(25);
    expect(mirror(25)).toBe(0);
  });

  it('is its own inverse for every letter', () => {
    for (let i = 0; i < ALPHABET_SIZE; i += 1) {
      expect(mirror(mirror(i))).toBe(i);
    }
  });

  it('has no fixed point', () => {
    // 25 - x = x would need x = 12.5, so no letter maps to itself. Worth
    // asserting: the Enigma reflector is this same trick, and that property is
    // exactly what made Enigma breakable.
    for (let i = 0; i < ALPHABET_SIZE; i += 1) {
      expect(mirror(i)).not.toBe(i);
    }
  });
});

describe('pairs', () => {
  it('folds the alphabet into thirteen pairs', () => {
    expect(pairs()).toHaveLength(13);
  });

  it('uses every letter exactly once', () => {
    const seen = pairs().flatMap((p) => [p.left, p.right]).sort().join('');
    expect(seen).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

  it('starts at A-Z and ends at M-N', () => {
    expect(pairs()[0]).toEqual({ left: 'A', right: 'Z' });
    expect(pairs()[12]).toEqual({ left: 'M', right: 'N' });
  });
});

describe('atbash', () => {
  it('reverses the alphabet', () => {
    expect(atbash('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('ZYXWVUTSRQPONMLKJIHGFEDCBA');
  });

  it('produces the signature every solver looks for', () => {
    // "the" becomes "gsv" in every Atbash message ever written. The explainer
    // makes this claim, so a test holds it to it.
    expect(atbash('the')).toBe('gsv');
  });

  it('preserves case and passes non-letters through', () => {
    expect(atbash('Hello, world!')).toBe('Svool, dliow!');
  });

  it('is its own inverse for any text', () => {
    const text = "Meet me at the old bridge, 11:45 p.m.\nDon't be late!";
    expect(atbash(atbash(text))).toBe(text);
  });

  it('handles text with no letters at all', () => {
    expect(atbash('123 !!')).toBe('123 !!');
  });

  it('handles the empty string', () => {
    expect(atbash('')).toBe('');
  });
});

describe('letterIndex', () => {
  it('numbers letters from zero and rejects everything else', () => {
    expect(letterIndex('A')).toBe(0);
    expect(letterIndex('z')).toBe(25);
    expect(letterIndex(' ')).toBe(-1);
    expect(letterIndex('4')).toBe(-1);
  });
});

describe('describeChar', () => {
  it('names invisible characters instead of quoting them', () => {
    expect(describeChar(' ')).toBe('the space');
    expect(describeChar('Q')).toBe("'Q'");
  });
});

describe('atbashTrace', () => {
  it('agrees with the untraced cipher', () => {
    const text = 'Meet me at dawn.';
    expect(atbashTrace(text).output).toBe(atbash(text));
  });

  it('emits one step per character, in order, each highlighting its own position', () => {
    const text = 'Hi there!';
    const { steps } = atbashTrace(text);
    expect(steps).toHaveLength(text.length);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      expect(step.highlight).toEqual({ start: i, end: i + 1 });
      expect(step.input).toBe(text.charAt(i));
    });
  });

  it('sets no outputHighlight, because nothing moves', () => {
    // A substitution replaces in place, so one range describes both panes and
    // `EncryptPanel` falls back to `highlight`.
    for (const step of atbashTrace('Hi there!').steps) {
      expect(step.outputHighlight).toBeUndefined();
    }
  });

  it('marks non-letters as such', () => {
    const { steps } = atbashTrace('A A');
    expect(steps[0]?.data?.['isLetter']).toBe(true);
    expect(steps[1]?.data?.['isLetter']).toBe(false);
  });

  it('carries the shape the visualizer reads', () => {
    expect(atbashTrace('H').steps[0]?.data).toMatchObject({
      isLetter: true,
      upper: true,
      fromIndex: 7,
      toIndex: 18,
      from: 'H',
      to: 'S',
    });
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = atbashCipher.encrypt('HELLO', {});
    expect('output' in result && result.output).toBe('SVOOL');
  });

  it('decrypts with the identical operation', () => {
    const encrypted = atbashCipher.encrypt('Attack at dawn!', {});
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = atbashCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, {});
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('has no params, because it has no key', () => {
    expect(atbashCipher.params).toEqual([]);
  });

  it('has no Attack tab, because there is nothing to search', () => {
    expect(atbashCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(atbashCipher.attack).toBeUndefined();
  });

  it('implements every tier it does claim', () => {
    expect(atbashCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks', () => {
    expect(atbashCipher.explainer.toLowerCase()).toContain('how this breaks');
  });

  it('names Kerckhoffs, because that is the actual lesson', () => {
    expect(atbashCipher.explainer).toContain('Kerckhoffs');
  });
});
