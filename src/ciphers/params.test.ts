import { describe, expect, it } from 'vitest';
import { canRandomise, defaultParams, randomKeyFor, randomValue } from './params';
import type { ParamSpec } from './types';
import { ciphers } from './registry';

describe('randomValue', () => {
  it('stays inside a number param’s own range', () => {
    const spec = { kind: 'number', name: 'shift', label: 'Shift', min: 1, max: 25, default: 3 } as const;
    for (let i = 0; i < 200; i += 1) {
      const value = randomValue(spec) as number;
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(25);
    }
  });

  it('picks one of a select param’s own options', () => {
    const spec = {
      kind: 'select',
      name: 'mode',
      label: 'Mode',
      options: [
        { value: 'CBC', label: 'CBC' },
        { value: 'ECB', label: 'ECB' },
      ],
      default: 'CBC',
    } satisfies ParamSpec;
    const seen = new Set(Array.from({ length: 100 }, () => randomValue(spec)));
    expect([...seen].sort()).toEqual(['CBC', 'ECB']);
  });

  it('invents nothing for a text param that did not ask', () => {
    // The important half of the rule: a keyword and an AES key are both strings,
    // so a text param that has not said which it is gets left alone.
    const spec = { kind: 'text', name: 'plugboard', label: 'Plugboard', default: '' } as const;
    expect(canRandomise(spec)).toBe(false);
    expect(randomValue(spec)).toBeUndefined();
  });

  it('produces hex of exactly the declared length', () => {
    const spec = {
      kind: 'text',
      name: 'key',
      label: 'Key',
      default: '00',
      randomise: { alphabet: 'hex', length: 32 },
    } as const;
    const value = randomValue(spec) as string;
    expect(value).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('randomKeyFor against the live registry', () => {
  it('produces a key every cipher can actually run', () => {
    // A "randomise" button that hands the cipher something it throws on would be
    // worse than no button, and the shape of a valid key is declared per param —
    // so this is the test that catches a length that disagrees with the cipher.
    for (const cipher of ciphers) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const params = randomKeyFor(cipher, defaultParams(cipher.params));
        expect(() => cipher.encrypt('Meet me at dawn.', params)).not.toThrow();
      }
    }
  });
});
