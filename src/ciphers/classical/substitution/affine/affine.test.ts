import { describe, expect, it } from 'vitest';
import {
  ALPHABET_SIZE,
  VALID_MULTIPLIERS,
  affine,
  affineMapping,
  affineTrace,
  describeChar,
  gcd,
  isValidMultiplier,
  letterIndex,
  modInverse,
  normalise,
} from './affine';
import { breakAffine } from './attack';
import { caesar } from '../caesar/caesar';
import affineCipher from './index';

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
An affine cipher multiplies before it adds, which sounds like it ought to help and
does almost nothing. The mapping is still fixed for the whole message, so every
letter of the plaintext always becomes the same letter of the ciphertext, and the
frequency of each letter survives the journey in perfect condition. That is the
only property the attack needs, and no amount of arithmetic in a single step will
take it away.
`.trim();

describe('gcd', () => {
  it('finds the greatest common divisor', () => {
    expect(gcd(26, 5)).toBe(1);
    expect(gcd(26, 2)).toBe(2);
    expect(gcd(26, 13)).toBe(13);
    expect(gcd(0, 7)).toBe(7);
  });
});

describe('isValidMultiplier', () => {
  it('accepts exactly the twelve values coprime with 26', () => {
    const valid: number[] = [];
    for (let a = 1; a < ALPHABET_SIZE; a += 1) {
      if (isValidMultiplier(a)) valid.push(a);
    }
    expect(valid).toEqual([...VALID_MULTIPLIERS]);
    expect(valid).toHaveLength(12);
  });

  it('rejects every even number and every multiple of 13', () => {
    expect(isValidMultiplier(2)).toBe(false);
    expect(isValidMultiplier(4)).toBe(false);
    expect(isValidMultiplier(13)).toBe(false);
    expect(isValidMultiplier(26)).toBe(false);
  });
});

describe('modInverse', () => {
  it('finds the number that undoes the multiplication', () => {
    expect(modInverse(5)).toBe(21);
    expect((5 * 21) % ALPHABET_SIZE).toBe(1);
    expect(modInverse(1)).toBe(1);
    expect(modInverse(25)).toBe(25);
  });

  it('has one for every valid multiplier, and none for an invalid one', () => {
    for (const a of VALID_MULTIPLIERS) {
      const inverse = modInverse(a);
      expect((a * inverse) % ALPHABET_SIZE).toBe(1);
    }
    expect(modInverse(2)).toBe(0);
    expect(modInverse(13)).toBe(0);
  });
});

describe('normalise', () => {
  it('folds any integer into 0-25 without producing a negative zero', () => {
    expect(normalise(30)).toBe(4);
    expect(normalise(-3)).toBe(23);
    expect(Object.is(normalise(-26), 0)).toBe(true);
  });
});

describe('letterIndex', () => {
  it('maps both cases to 0-25 and everything else to -1', () => {
    expect(letterIndex('A')).toBe(0);
    expect(letterIndex('z')).toBe(25);
    expect(letterIndex(' ')).toBe(-1);
  });
});

describe('affineMapping', () => {
  it('is one-to-one for every valid multiplier', () => {
    // The definition of a usable key: 26 inputs reach 26 distinct outputs.
    for (const a of VALID_MULTIPLIERS) {
      for (let b = 0; b < ALPHABET_SIZE; b += 1) {
        expect(new Set(affineMapping(a, b)).size).toBe(ALPHABET_SIZE);
      }
    }
  });

  it('collapses the alphabet for an invalid multiplier', () => {
    // The lesson the Visualize toggle draws: A and N both land on the same letter.
    const broken = affineMapping(2, 0);
    expect(new Set(broken).size).toBe(13);
    expect(broken[0]).toBe(broken[13]);
  });
});

describe('affine', () => {
  it('matches the textbook vector', () => {
    expect(affine('AFFINECIPHER', 5, 8)).toBe('IHHWVCSWFRCP');
  });

  it('decrypts the textbook vector back', () => {
    expect(affine('IHHWVCSWFRCP', 5, 8, 'decrypt')).toBe('AFFINECIPHER');
  });

  it('is exactly Caesar when the multiplier is 1', () => {
    // The claim the explainer makes, checked rather than asserted.
    for (let b = 1; b < ALPHABET_SIZE; b += 1) {
      expect(affine(PARAGRAPH, 1, b)).toBe(caesar(PARAGRAPH, b));
    }
  });

  it('changes nothing at all with a = 1 and b = 0', () => {
    expect(affine('Attack at dawn!', 1, 0)).toBe('Attack at dawn!');
  });

  it('preserves case', () => {
    expect(affine('Affine', 5, 8)).toBe('Ihhwvc');
  });

  it('passes non-letters through untouched', () => {
    // a(0) -> 8 = i, b(1) -> 13 = n, c(2) -> 18 = s. The space, comma and
    // exclamation mark come through in their original places.
    expect(affine('a b, c!', 5, 8)).toBe('i n, s!');
  });

  it('round-trips any text under any valid key', () => {
    const random = mulberry32(20260825);
    const source = " abcXYZ.,!\n'0123zqM";
    for (let run = 0; run < 400; run += 1) {
      const a = VALID_MULTIPLIERS[Math.floor(random() * VALID_MULTIPLIERS.length)] ?? 1;
      const b = Math.floor(random() * ALPHABET_SIZE);
      let text = '';
      for (let i = 0; i < Math.floor(random() * 60); i += 1) {
        text += source.charAt(Math.floor(random() * source.length));
      }
      expect(affine(affine(text, a, b), a, b, 'decrypt')).toBe(text);
    }
  });
});

describe('describeChar', () => {
  it('names invisible characters instead of quoting them', () => {
    expect(describeChar(' ')).toBe('the space');
    expect(describeChar('Q')).toBe("'Q'");
  });
});

describe('affineTrace', () => {
  it('agrees with the untraced cipher', () => {
    expect(affineTrace(PARAGRAPH, 5, 8).output).toBe(affine(PARAGRAPH, 5, 8));
    expect(affineTrace(PARAGRAPH, 5, 8, 'decrypt').output).toBe(
      affine(PARAGRAPH, 5, 8, 'decrypt'),
    );
  });

  it('emits one step per character, in order, each highlighting its own position', () => {
    const text = 'Hi there!';
    const { steps } = affineTrace(text, 5, 8);
    expect(steps).toHaveLength(text.length);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      expect(step.highlight).toEqual({ start: i, end: i + 1 });
      expect(step.input).toBe(text.charAt(i));
    });
  });

  it('shows the multiplication and the wrap', () => {
    // F is 5, and 5 x 5 + 8 = 33, which wraps to 7.
    const detail = affineTrace('F', 5, 8).steps[0]?.detail ?? '';
    expect(detail).toContain('5 × 5 + 8 = 33');
    expect(detail).toContain('33 mod 26 = 7');
  });

  it('names the inverse when decrypting', () => {
    const detail = affineTrace('I', 5, 8, 'decrypt').steps[0]?.detail ?? '';
    expect(detail).toContain('the inverse of 5, which is 21');
  });

  it('carries the shape the visualizer reads', () => {
    expect(affineTrace('A', 5, 8).steps[0]?.data).toMatchObject({
      isLetter: true,
      upper: true,
      fromIndex: 0,
      toIndex: 8,
      from: 'A',
      to: 'I',
      a: 5,
      b: 8,
      inverse: 21,
      direction: 'encrypt',
    });

    expect(affineTrace(' ', 5, 8).steps[0]?.data).toMatchObject({ isLetter: false });
  });
});

describe('breakAffine', () => {
  it('recovers the key from ciphertext alone', () => {
    for (const a of [3, 5, 11, 25]) {
      for (const b of [0, 8, 19]) {
        const best = breakAffine(affine(PARAGRAPH, a, b))[0];
        expect(best?.key).toEqual({ a, b });
        expect(best?.plaintext).toBe(PARAGRAPH);
      }
    }
  });

  it('tries all 312 keys', () => {
    expect(breakAffine(PARAGRAPH)).toHaveLength(VALID_MULTIPLIERS.length * ALPHABET_SIZE);
  });

  it('ranks lowest score first', () => {
    const scores = breakAffine(affine(PARAGRAPH, 5, 8)).map((c) => c.score);
    expect(scores).toEqual([...scores].sort((x, y) => x - y));
  });

  it('labels a candidate with both halves of the key', () => {
    expect(breakAffine(affine(PARAGRAPH, 5, 8))[0]?.label).toBe('a = 5, b = 8');
  });

  it('is deterministic', () => {
    const cipher = affine(PARAGRAPH, 11, 3);
    expect(breakAffine(cipher)).toEqual(breakAffine(cipher));
  });

  it('scores text with no letters as no fit rather than a good one', () => {
    expect(breakAffine('1234 !!').every((c) => c.score === Infinity)).toBe(true);
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = affineCipher.encrypt('AFFINECIPHER', { a: 5, b: 8 });
    expect('output' in result && result.output).toBe('IHHWVCSWFRCP');
  });

  it('accepts the string a select control actually hands back', () => {
    // A `select` param always yields a string. This is the reason `readKey` calls
    // Number rather than trusting the type.
    const result = affineCipher.encrypt('AFFINECIPHER', { a: '5', b: '8' });
    expect('output' in result && result.output).toBe('IHHWVCSWFRCP');
  });

  it('round-trips through the module', () => {
    const encrypted = affineCipher.encrypt('Attack at dawn!', { a: '11', b: 3 });
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = affineCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, { a: '11', b: 3 });
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('refuses a multiplier that would make the cipher unreadable', () => {
    expect(() => affineCipher.encrypt('hello', { a: 2, b: 8 })).toThrow(
      '2 shares a factor with 26',
    );
    expect(() => affineCipher.encrypt('hello', { a: 13, b: 8 })).toThrow(/shares a factor/);
  });

  it('explains itself rather than throwing a type error on a junk key', () => {
    expect(() => affineCipher.encrypt('hello', { a: 'five', b: 8 })).toThrow(
      'The key needs two whole numbers: a multiplier and a shift.',
    );
  });

  it('offers only the twelve valid multipliers in its select', () => {
    const spec = affineCipher.params.find((p) => p.name === 'a');
    expect(spec?.kind).toBe('select');
    const options = spec?.kind === 'select' ? spec.options.map((o) => Number(o.value)) : [];
    expect(options).toEqual([...VALID_MULTIPLIERS]);
    expect(options.every(isValidMultiplier)).toBe(true);
  });

  it('defaults to a key that works', () => {
    const spec = affineCipher.params.find((p) => p.name === 'a');
    const fallback = spec?.kind === 'select' ? spec.default : '';
    expect(isValidMultiplier(Number(fallback))).toBe(true);
  });

  it('earns all four tiers and implements each of them', () => {
    expect(affineCipher.tiers).toEqual(['encrypt', 'attack', 'visualize', 'benchmark']);
    expect(typeof affineCipher.attack).toBe('function');
    expect(affineCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks', () => {
    expect(affineCipher.explainer.toLowerCase()).toContain('how this breaks');
  });

  it('offers a key the attack can hand straight back', () => {
    const candidate = breakAffine(affine(PARAGRAPH, 5, 8))[0];
    const names = affineCipher.params.map((spec) => spec.name);
    expect(Object.keys(candidate?.key ?? {}).sort()).toEqual([...names].sort());
  });
});
