import { describe, expect, it } from 'vitest';
import {
  type Matrix,
  ALPHABET_SIZE,
  apply,
  determinant,
  gcd,
  hill,
  hillTrace,
  inverseMatrix,
  isInvertible,
  lettersOnly,
  modInverse,
  normalise,
  prepare,
} from './hill';
import hillCipher from './index';

const KEY: Matrix = [3, 3, 2, 5];

describe('normalise and gcd', () => {
  it('wraps negatives into the alphabet', () => {
    expect(normalise(-1)).toBe(25);
    expect(normalise(26)).toBe(0);
    expect(normalise(-27)).toBe(25);
  });

  it('computes the greatest common divisor', () => {
    expect(gcd(26, 13)).toBe(13);
    expect(gcd(26, 9)).toBe(1);
  });
});

describe('modInverse', () => {
  it('finds the inverse when one exists', () => {
    // 5 x 21 = 105 = 4 x 26 + 1.
    expect(modInverse(5)).toBe(21);
    expect(modInverse(9)).toBe(3);
  });

  it('returns 0 for every value sharing a factor with 26', () => {
    for (const n of [0, 2, 4, 13, 24]) {
      expect(modInverse(n)).toBe(0);
    }
  });

  it('agrees with the twelve multipliers the Affine cipher offers', () => {
    // The same coprimality condition, one dimension down. If these two ever
    // disagree, one of them is wrong.
    const invertible = [];
    for (let n = 0; n < ALPHABET_SIZE; n += 1) {
      if (modInverse(n) !== 0) invertible.push(n);
    }
    expect(invertible).toEqual([1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25]);
  });
});

describe('determinant and isInvertible', () => {
  it('computes ad - bc modulo 26', () => {
    // 3x5 - 3x2 = 9.
    expect(determinant(KEY)).toBe(9);
  });

  it('wraps a negative determinant', () => {
    expect(determinant([1, 5, 5, 1])).toBe(normalise(1 - 25));
  });

  it('rejects a matrix whose determinant shares a factor with 26', () => {
    expect(isInvertible(KEY)).toBe(true);
    expect(isInvertible([2, 4, 6, 8])).toBe(false);
    // Determinant 13 is the odd one that still fails, because 13 divides 26.
    expect(determinant([1, 0, 0, 13])).toBe(13);
    expect(isInvertible([1, 0, 0, 13])).toBe(false);
  });
});

describe('inverseMatrix', () => {
  it('produces a matrix that undoes the key', () => {
    const inverse = inverseMatrix(KEY);
    // Multiplying the two matrices should give the identity, mod 26.
    const [x1, y1] = apply(inverse, ...apply(KEY, 1, 0));
    const [x2, y2] = apply(inverse, ...apply(KEY, 0, 1));
    expect([x1, y1]).toEqual([1, 0]);
    expect([x2, y2]).toEqual([0, 1]);
  });

  it('refuses a singular matrix, saying why', () => {
    expect(() => inverseMatrix([2, 4, 6, 8])).toThrow(/shares a factor with 26/);
  });
});

describe('prepare', () => {
  it('keeps letters only, uppercased', () => {
    expect(lettersOnly('Hi, there!')).toBe('HITHERE');
  });

  it('pads an odd number of letters out to a whole block', () => {
    const { letters, padded } = prepare('Hi, there!');
    expect(letters).toBe('HITHEREX');
    expect(padded).toBe(true);
  });

  it('leaves an even number alone', () => {
    // 'Hit!' is three letters once the punctuation goes, so it is padded.
    expect(prepare('Hit!').letters).toBe('HITX');
    expect(prepare('Hit!').padded).toBe(true);
    expect(prepare('Hits').letters).toBe('HITS');
    expect(prepare('Hits').padded).toBe(false);
  });

  it('records where each letter came from in the text as typed', () => {
    // "at dawn" — the D is at index 3 of the original, not index 2. Six letters,
    // so there is no padding entry on the end.
    expect(prepare('at dawn').sources).toEqual([0, 1, 3, 4, 5, 6]);
  });

  it('marks a padding letter with source -1, because it was never sent', () => {
    expect(prepare('abc').sources).toEqual([0, 1, 2, -1]);
  });
});

describe('hill', () => {
  it('matches the worked example in the explainer', () => {
    // HI is (7, 8). 3x7+3x8 = 45 -> 19 -> T. 2x7+5x8 = 54 -> 2 -> C.
    expect(hill('HI', KEY)).toBe('TC');
  });

  it('round-trips any text', () => {
    for (const text of ['HELLO', 'Meet me at the old bridge at midnight', 'ab', 'Odd length!']) {
      expect(hill(hill(text, KEY), KEY, 'decrypt')).toBe(prepare(text).letters);
    }
  });

  it('drops spacing and punctuation, like every block cipher', () => {
    expect(hill('Hi, there!', KEY)).toBe(hill('HITHERE', KEY));
  });

  it('refuses a singular key rather than producing undecryptable output', () => {
    expect(() => hill('HELLO', [2, 4, 6, 8])).toThrow(/impossible to decrypt/);
  });

  it('handles the empty string', () => {
    expect(hill('', KEY)).toBe('');
  });

  it('diffuses: changing one input letter reaches the other output letter', () => {
    // The property that separates Hill from every cipher before it. Under the
    // default key [3, 3, 2, 5], changing the first plaintext letter by d moves
    // the first output by 3d and the second by 2d, both mod 26.
    const base = hill('AB', KEY);
    let secondMoved = 0;
    for (let d = 1; d < ALPHABET_SIZE; d += 1) {
      const changed = hill(String.fromCharCode(65 + d) + 'B', KEY);
      // 3 is coprime with 26, so the first output always moves.
      expect(changed.charAt(0)).not.toBe(base.charAt(0));
      if (changed.charAt(1) !== base.charAt(1)) secondMoved += 1;
    }
    expect(secondMoved).toBe(24);
  });

  it('shows where diffusion leaks, which is linearity showing through', () => {
    // Not a rounding artefact: the second output is 2x + 5y, and 2 x 13 = 26 = 0
    // mod 26. So changing the first letter by exactly thirteen places leaves the
    // second ciphertext letter untouched. An even coefficient cannot reach every
    // residue — the same coprimality problem that limits the Affine cipher's
    // multiplier, turning up inside a matrix.
    expect(hill('AB', KEY).charAt(1)).toBe(hill('NB', KEY).charAt(1));
    expect(hill('AB', KEY).charAt(0)).not.toBe(hill('NB', KEY).charAt(0));
  });

  it('cannot avoid that hole entirely, in 2x2 over 26 letters', () => {
    // A stronger claim, and the reason the explainer does not promise perfect
    // diffusion: **every** usable 2x2 key has at least one even entry.
    //
    // The determinant ad - bc has to be odd to be coprime with 26. If all four
    // entries were odd, both ad and bc would be odd and their difference would be
    // even — so no all-odd matrix is ever invertible. Some coefficient is always
    // even, and wherever one is, that output letter has a blind spot.
    for (let a = 0; a < ALPHABET_SIZE; a += 1) {
      for (let b = 0; b < ALPHABET_SIZE; b += 1) {
        for (let c = 0; c < ALPHABET_SIZE; c += 1) {
          for (let d = 0; d < ALPHABET_SIZE; d += 1) {
            if (!isInvertible([a, b, c, d])) continue;
            expect([a, b, c, d].some((n) => n % 2 === 0)).toBe(true);
          }
        }
      }
    }
  });

  it('can still make one letter diffuse completely', () => {
    // [[3, 2], [5, 5]] has determinant 5, so it is a valid key, and the first
    // letter's two coefficients — 3 and 5 — are both coprime with 26. Changing
    // that letter moves both output letters, with no exception. The even entry
    // has been pushed into the other column, where it becomes the second
    // letter's blind spot instead. Moved, not removed.
    const shifted: Matrix = [3, 2, 5, 5];
    expect(isInvertible(shifted)).toBe(true);
    const base = hill('AB', shifted);
    for (let d = 1; d < ALPHABET_SIZE; d += 1) {
      const changed = hill(String.fromCharCode(65 + d) + 'B', shifted);
      expect(changed.charAt(0)).not.toBe(base.charAt(0));
      expect(changed.charAt(1)).not.toBe(base.charAt(1));
    }
  });
});

describe('hillTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me at dawn';
    expect(hillTrace(text, KEY).output).toBe(hill(text, KEY));
    expect(hillTrace(text, KEY, 'decrypt').output).toBe(hill(text, KEY, 'decrypt'));
  });

  it('emits one step per pair, not per letter', () => {
    // Neither output letter exists until both inputs have been read, so a
    // per-letter trace would have to lie about when each one is known.
    const { steps } = hillTrace('HITHERE', KEY);
    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.input)).toEqual(['HI', 'TH', 'ER', 'EX']);
  });

  it('highlights the source characters in the text as typed, not the stripped text', () => {
    // 'at dawn': the second pair is the T and the D, which are at original
    // indices 1 and 3 — a range the stripped indices would have got wrong.
    const step = hillTrace('at dawn', KEY).steps[0];
    expect(step?.highlight).toEqual({ start: 0, end: 2 });
    expect(hillTrace('at dawn', KEY).steps[1]?.highlight).toEqual({ start: 3, end: 5 });
  });

  it('says when the last letter was padding', () => {
    const { steps } = hillTrace('abc', KEY);
    expect(steps[0]?.data?.['isPad']).toBe(false);
    expect(steps[1]?.data?.['isPad']).toBe(true);
  });

  it('carries the shape the visualizer reads', () => {
    expect(hillTrace('HI', KEY).steps[0]?.data).toMatchObject({
      first: 7,
      second: 8,
      firstChar: 'H',
      secondChar: 'I',
      outFirst: 'T',
      outSecond: 'C',
      x: 19,
      y: 2,
      rawX: 45,
      rawY: 54,
      matrix: [3, 3, 2, 5],
    });
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = hillCipher.encrypt('HI', { a: 3, b: 3, c: 2, d: 5 });
    expect('output' in result && result.output).toBe('TC');
  });

  it('round-trips through the module', () => {
    const key = { a: 3, b: 3, c: 2, d: 5 };
    const encrypted = hillCipher.encrypt('ATTACKATDAWN', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = hillCipher.decrypt(output, key);
    expect('output' in decrypted && decrypted.output).toBe('ATTACKATDAWN');
  });

  it('refuses a singular key with an explanation, not a stack trace', () => {
    expect(() => hillCipher.encrypt('HELLO', { a: 2, b: 4, c: 6, d: 8 })).toThrow(
      /shares a factor with 26/,
    );
  });

  it('ships a default key that is actually invertible', () => {
    // A cipher whose first render is an error is a broken first impression.
    const values = ['a', 'b', 'c', 'd'].map((name) => {
      const spec = hillCipher.params.find((s) => s.name === name);
      return spec?.kind === 'number' ? spec.default : 0;
    }) as unknown as Matrix;
    expect(isInvertible(values)).toBe(true);
  });

  it('has no Attack tab, because the honest attack needs known plaintext', () => {
    expect(hillCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(hillCipher.attack).toBeUndefined();
  });

  it('implements every tier it does claim', () => {
    expect(hillCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks, and names the attack it cannot run here', () => {
    expect(hillCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(hillCipher.explainer).toContain('known-plaintext');
  });
});
