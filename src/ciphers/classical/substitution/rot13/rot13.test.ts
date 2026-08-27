import { describe, expect, it } from 'vitest';
import { ALPHABET_SIZE, ROTATION, describeChar, pairs, rot13, rot13Trace, rotate } from './rot13';
import { caesar } from '../caesar/caesar';
import rot13Cipher from './index';

describe('rotate', () => {
  it('moves a letter thirteen places', () => {
    expect(rotate(0)).toBe(13);
    expect(rotate(13)).toBe(0);
  });

  it('is its own inverse for every letter', () => {
    for (let i = 0; i < ALPHABET_SIZE; i += 1) {
      expect(rotate(rotate(i))).toBe(i);
    }
  });

  it('is the only shift that is its own inverse', () => {
    // The explainer claims thirteen is unique in this. Hold it to that: for any
    // other shift there is some letter that does not come home.
    for (let shift = 1; shift < ALPHABET_SIZE; shift += 1) {
      const involution = Array.from({ length: ALPHABET_SIZE }, (_, i) => i).every(
        (i) => (i + shift * 2) % ALPHABET_SIZE === i,
      );
      expect(involution).toBe(shift === ROTATION);
    }
  });
});

describe('pairs', () => {
  it('gives thirteen opposite pairs covering the alphabet once', () => {
    const list = pairs();
    expect(list).toHaveLength(13);
    expect(list[0]).toEqual({ left: 'A', right: 'N' });
    expect(list[12]).toEqual({ left: 'M', right: 'Z' });
    expect(list.flatMap((p) => [p.left, p.right]).sort().join('')).toBe(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    );
  });
});

describe('rot13', () => {
  it('matches the canonical example', () => {
    expect(rot13('Hello, World!')).toBe('Uryyb, Jbeyq!');
  });

  it('turns "the" into "gur" every time — the giveaway the explainer names', () => {
    expect(rot13('the')).toBe('gur');
  });

  it('agrees with Caesar at shift 13', () => {
    // ROT13 is not a separate algorithm, and the explainer says so. This is the
    // claim, tested against the cipher it is a special case of.
    const text = 'Attack at dawn, and not a moment later.';
    expect(rot13(text)).toBe(caesar(text, 13));
  });

  it('is its own inverse for any text', () => {
    const text = "Meet me at the old bridge, 11:45 p.m.\nDon't be late!";
    expect(rot13(rot13(text))).toBe(text);
  });

  it('leaves digits and punctuation alone', () => {
    expect(rot13('123 !!')).toBe('123 !!');
  });

  it('handles the empty string', () => {
    expect(rot13('')).toBe('');
  });
});

describe('describeChar', () => {
  it('names invisible characters instead of quoting them', () => {
    expect(describeChar(' ')).toBe('the space');
    expect(describeChar('Q')).toBe("'Q'");
  });
});

describe('rot13Trace', () => {
  it('agrees with the untraced cipher', () => {
    const text = 'Meet me at dawn.';
    expect(rot13Trace(text).output).toBe(rot13(text));
  });

  it('emits one step per character, in order, each highlighting its own position', () => {
    const text = 'Hi there!';
    const { steps } = rot13Trace(text);
    expect(steps).toHaveLength(text.length);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      expect(step.highlight).toEqual({ start: i, end: i + 1 });
      expect(step.input).toBe(text.charAt(i));
    });
  });

  it('sets no outputHighlight, because nothing moves', () => {
    for (const step of rot13Trace('Hi there!').steps) {
      expect(step.outputHighlight).toBeUndefined();
    }
  });

  it('says when the rotation wrapped past Z', () => {
    expect(rot13Trace('A').steps[0]?.data?.['wrapped']).toBe(false);
    expect(rot13Trace('N').steps[0]?.data?.['wrapped']).toBe(true);
  });

  it('carries the shape the visualizer reads', () => {
    expect(rot13Trace('H').steps[0]?.data).toMatchObject({
      isLetter: true,
      upper: true,
      fromIndex: 7,
      toIndex: 20,
      from: 'H',
      to: 'U',
    });
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = rot13Cipher.encrypt('HELLO', {});
    expect('output' in result && result.output).toBe('URYYB');
  });

  it('decrypts with the identical operation', () => {
    const encrypted = rot13Cipher.encrypt('Attack at dawn!', {});
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = rot13Cipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, {});
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('has no params, because the shift is not a choice', () => {
    expect(rot13Cipher.params).toEqual([]);
  });

  it('has no Attack tab, because applying it again is the decryption', () => {
    expect(rot13Cipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(rot13Cipher.attack).toBeUndefined();
  });

  it('implements every tier it does claim', () => {
    expect(rot13Cipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks, and what it is honestly for', () => {
    expect(rot13Cipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(rot13Cipher.explainer).toContain('spoiler');
  });
});
