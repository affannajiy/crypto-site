import { describe, expect, it } from 'vitest';
import {
  ALPHABET_SIZE,
  describeChar,
  keyShifts,
  letterIndex,
  normaliseKey,
  vigenere,
  vigenereTrace,
} from './vigenere';
import {
  averageColumnIC,
  breakVigenere,
  candidateKeyLengths,
  column,
  indexOfCoincidence,
  kasiskiVotes,
  lettersOnly,
  shortestPeriod,
  solveKey,
} from './attack';
import vigenereCipher from './index';

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
The index of coincidence measures how likely it is that two letters drawn at
random from a text are the same letter. In ordinary English prose that value sits
near six and a half percent, because the language leans so heavily on a handful of
letters. In a string of random letters it falls to under four percent. That gap is
small enough to sound unimportant and large enough to break a cipher that stood
for three hundred years, which is a lesson about how little structure an attacker
needs before the whole thing comes apart in their hands.
`.trim();

describe('normaliseKey', () => {
  it('uppercases and keeps only letters', () => {
    expect(normaliseKey('Lemon')).toBe('LEMON');
    expect(normaliseKey('my dog, rex!')).toBe('MYDOGREX');
  });

  it('rejects a key with no letters at all', () => {
    expect(() => normaliseKey('   ')).toThrow('The key needs at least one letter A-Z.');
    expect(() => normaliseKey('123!')).toThrow(/at least one letter/);
  });
});

describe('keyShifts', () => {
  it('turns LEMON into its shifts', () => {
    expect(keyShifts('LEMON')).toEqual([11, 4, 12, 14, 13]);
  });

  it('treats A as no shift at all', () => {
    expect(keyShifts('AAA')).toEqual([0, 0, 0]);
  });
});

describe('letterIndex', () => {
  it('maps both cases to 0-25 and everything else to -1', () => {
    expect(letterIndex('A')).toBe(0);
    expect(letterIndex('z')).toBe(25);
    expect(letterIndex(' ')).toBe(-1);
    expect(letterIndex('4')).toBe(-1);
  });
});

describe('vigenere', () => {
  it('matches the textbook vector', () => {
    // The example in every account of this cipher, Bellaso onwards.
    expect(vigenere('ATTACKATDAWN', 'LEMON')).toBe('LXFOPVEFRNHR');
  });

  it('decrypts the textbook vector back', () => {
    expect(vigenere('LXFOPVEFRNHR', 'LEMON', 'decrypt')).toBe('ATTACKATDAWN');
  });

  it('preserves case', () => {
    expect(vigenere('Attack', 'lemon')).toBe('Lxfopv');
  });

  it('passes non-letters through and does not advance the key on them', () => {
    // Same letters, same key letters, regardless of the spacing between them.
    const spaced = vigenere('ATT ACK', 'LEMON');
    const tight = vigenere('ATTACK', 'LEMON');
    expect(spaced.replace(/[^A-Z]/g, '')).toBe(tight);
    expect(spaced).toBe('LXF OPV');
  });

  it('with a one-letter key is exactly Caesar', () => {
    // D is index 3, so a key of D is a shift of 3.
    expect(vigenere('The quick brown fox.', 'D')).toBe('Wkh txlfn eurzq ira.');
  });

  it('with a key of A changes nothing', () => {
    expect(vigenere('Attack at dawn!', 'A')).toBe('Attack at dawn!');
  });

  it('ignores punctuation inside the key', () => {
    expect(vigenere('ATTACKATDAWN', 'l-e-m-o-n')).toBe('LXFOPVEFRNHR');
  });

  it('round-trips any text under any key', () => {
    const random = mulberry32(20260825);
    const source = " abcXYZ.,!\n'0123zqM";
    for (let run = 0; run < 400; run += 1) {
      const keyLength = 1 + Math.floor(random() * 12);
      let key = '';
      for (let i = 0; i < keyLength; i += 1) {
        key += String.fromCharCode(65 + Math.floor(random() * ALPHABET_SIZE));
      }

      let text = '';
      const textLength = Math.floor(random() * 60);
      for (let i = 0; i < textLength; i += 1) {
        text += source.charAt(Math.floor(random() * source.length));
      }

      expect(vigenere(vigenere(text, key), key, 'decrypt')).toBe(text);
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

describe('vigenereTrace', () => {
  it('agrees with the untraced cipher', () => {
    expect(vigenereTrace(PARAGRAPH, 'LEMON').output).toBe(vigenere(PARAGRAPH, 'LEMON'));
    expect(vigenereTrace(PARAGRAPH, 'LEMON', 'decrypt').output).toBe(
      vigenere(PARAGRAPH, 'LEMON', 'decrypt'),
    );
  });

  it('emits one step per character, in order, each highlighting its own position', () => {
    const text = 'Hi there!';
    const { steps } = vigenereTrace(text, 'LEMON');
    expect(steps).toHaveLength(text.length);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      expect(step.highlight).toEqual({ start: i, end: i + 1 });
      expect(step.input).toBe(text.charAt(i));
    });
  });

  it('names the key letter in the title and the arithmetic in the detail', () => {
    const { steps } = vigenereTrace('AT', 'LEMON');
    expect(steps[0]?.title).toBe("Shift 'A' by 11 (key L)");
    expect(steps[0]?.detail).toContain('A is index 0. Key letter L is index 11. 0 + 11 = 11');
    expect(steps[1]?.title).toBe("Shift 'T' by 4 (key E)");
  });

  it('spells the wrap out as an addition or subtraction, never as "mod 26"', () => {
    // T is 19, M is 12, 19 + 12 = 31 which runs off the end.
    const forward = vigenereTrace('T', 'M').steps[0]?.detail ?? '';
    expect(forward).toContain('31, which runs past the end of the alphabet');
    expect(forward).toContain('31 − 26 = 5');
    expect(forward).not.toContain('mod');

    // A is 0, M is 12, 0 - 12 = -12 which falls off the front.
    const backward = vigenereTrace('A', 'M', 'decrypt').steps[0]?.detail ?? '';
    expect(backward).toContain('−12, which falls off the front of the alphabet');
    expect(backward).toContain('−12 + 26 = 14');
    expect(backward).not.toContain('mod');
  });

  it('says the key does not advance on a non-letter', () => {
    const { steps } = vigenereTrace('A A', 'LEMON');
    expect(steps[1]?.title).toBe('Pass the space through');
    expect(steps[1]?.detail).toContain('the key does not advance');
    // The letter after the space still gets the second key letter.
    expect(steps[2]?.title).toBe("Shift 'A' by 4 (key E)");
  });

  it('carries the shape the visualizer reads', () => {
    const letter = vigenereTrace('A', 'LEMON').steps[0];
    expect(letter?.data).toMatchObject({
      isLetter: true,
      upper: true,
      fromIndex: 0,
      toIndex: 11,
      from: 'A',
      to: 'L',
      shift: 11,
      keyChar: 'L',
      keyPosition: 0,
      key: 'LEMON',
      wrapped: false,
      direction: 'encrypt',
    });

    expect(vigenereTrace(' ', 'LEMON').steps[0]?.data).toMatchObject({ isLetter: false });
  });

  it('cycles the key position and comes back round', () => {
    const { steps } = vigenereTrace('ABCDEFGHIJ', 'LEMON');
    const positions = steps.map((step) => step.data?.['keyPosition']);
    expect(positions).toEqual([0, 1, 2, 3, 4, 0, 1, 2, 3, 4]);
  });
});

describe('indexOfCoincidence', () => {
  it('is near 0.067 for English and near 0.038 for a Vigenere of it', () => {
    const english = indexOfCoincidence(PARAGRAPH);
    const enciphered = indexOfCoincidence(vigenere(PARAGRAPH, 'LEMONADE'));
    expect(english).toBeGreaterThan(0.06);
    expect(enciphered).toBeLessThan(english);
    expect(enciphered).toBeLessThan(0.05);
  });

  it('is undefined-safe on text with under two letters', () => {
    expect(indexOfCoincidence('')).toBe(0);
    expect(indexOfCoincidence('A')).toBe(0);
    expect(indexOfCoincidence('!!!')).toBe(0);
  });

  it('is 1 when every letter is the same', () => {
    expect(indexOfCoincidence('AAAA')).toBe(1);
  });
});

describe('column', () => {
  it('takes every nth letter from an offset', () => {
    expect(column('ABCDEFGH', 0, 3)).toBe('ADG');
    expect(column('ABCDEFGH', 1, 3)).toBe('BEH');
    expect(column('ABCDEFGH', 2, 3)).toBe('CF');
  });
});

describe('averageColumnIC', () => {
  it('peaks at the true key length', () => {
    const cipher = lettersOnly(vigenere(PARAGRAPH, 'LEMON'));
    const atTrue = averageColumnIC(cipher, 5);
    for (const wrong of [2, 3, 4, 6, 7]) {
      expect(atTrue).toBeGreaterThan(averageColumnIC(cipher, wrong));
    }
  });
});

describe('kasiskiVotes', () => {
  it('votes for divisors of the distance between repeats', () => {
    // THE at position 0 and position 12: distance 12, so 2, 3, 4, 6 and 12 all
    // divide it, and 5 does not. The filler is nine distinct letters on purpose —
    // a run of XXXXXXXXX would be full of repeated trigrams of its own.
    const votes = kasiskiVotes('THEABCDFGIJKTHE', 12);
    expect(votes[12]).toBeGreaterThan(0);
    expect(votes[6]).toBeGreaterThan(0);
    expect(votes[5]).toBe(0);
  });

  it('finds the real key length in a real ciphertext', () => {
    const cipher = lettersOnly(vigenere(PARAGRAPH, 'LEMON'));
    const votes = kasiskiVotes(cipher);
    const best = votes.reduce(
      (winner, count, length) => (length >= 2 && count > (votes[winner] ?? 0) ? length : winner),
      0,
    );
    expect(best % 5).toBe(0);
  });
});

describe('shortestPeriod', () => {
  it('reduces a repeated key to its unit', () => {
    expect(shortestPeriod('LEMONLEMON')).toBe('LEMON');
    expect(shortestPeriod('AAAA')).toBe('A');
    expect(shortestPeriod('LEMON')).toBe('LEMON');
    expect(shortestPeriod('ABCAB')).toBe('ABCAB');
  });
});

describe('solveKey', () => {
  it('recovers the key when told the right length', () => {
    const cipher = lettersOnly(vigenere(PARAGRAPH, 'LEMON'));
    expect(solveKey(cipher, 5)).toBe('LEMON');
  });
});

describe('candidateKeyLengths', () => {
  it('includes the true length among its guesses', () => {
    const cipher = lettersOnly(vigenere(PARAGRAPH, 'LEMON'));
    expect(candidateKeyLengths(cipher)).toContain(5);
  });

  it('offers nothing for empty text', () => {
    expect(candidateKeyLengths('')).toEqual([]);
  });
});

describe('breakVigenere', () => {
  it('recovers the key from ciphertext alone', () => {
    for (const key of ['LEMON', 'CRYPT', 'ZEBRAS', 'KEYWORD']) {
      const cipher = vigenere(PARAGRAPH, key);
      const best = breakVigenere(cipher)[0];
      expect(best?.key['key']).toBe(key);
      expect(best?.plaintext).toBe(PARAGRAPH);
    }
  });

  it('keeps the original spacing and case in what it recovers', () => {
    const best = breakVigenere(vigenere(PARAGRAPH, 'LEMON'))[0];
    expect(best?.plaintext).toContain('The index of coincidence');
  });

  it('labels a candidate with the key and its length', () => {
    const best = breakVigenere(vigenere(PARAGRAPH, 'LEMON'))[0];
    expect(best?.label).toBe('Key "LEMON" (length 5)');
  });

  it('ranks by chi-squared, lowest first', () => {
    const scores = breakVigenere(vigenere(PARAGRAPH, 'LEMON')).map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it('never offers the same key twice', () => {
    const keys = breakVigenere(vigenere(PARAGRAPH, 'LEMON')).map((c) => c.key['key']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is deterministic', () => {
    const cipher = vigenere(PARAGRAPH, 'ZEBRAS');
    expect(breakVigenere(cipher)).toEqual(breakVigenere(cipher));
  });

  it('returns nothing rather than a guess when there are no letters', () => {
    expect(breakVigenere('1234 !!')).toEqual([]);
  });

  it('handles text far too short to attack without throwing', () => {
    // The point is that it fails gracefully, not that it succeeds. A five-letter
    // sample cannot be attacked and the attack must not pretend otherwise.
    expect(() => breakVigenere('LXFOP')).not.toThrow();
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = vigenereCipher.encrypt('ATTACKATDAWN', { key: 'LEMON' });
    expect('output' in result && result.output).toBe('LXFOPVEFRNHR');
  });

  it('round-trips through the module', () => {
    const encrypted = vigenereCipher.encrypt('Attack at dawn!', { key: 'LEMON' });
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = vigenereCipher.decrypt(output, { key: 'LEMON' });
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('explains itself rather than throwing a type error on an empty key', () => {
    expect(() => vigenereCipher.encrypt('hello', { key: '' })).toThrow(
      'The key needs at least one letter A-Z.',
    );
  });

  it('earns all four tiers and implements each of them', () => {
    expect(vigenereCipher.tiers).toEqual(['encrypt', 'attack', 'visualize', 'benchmark']);
    expect(typeof vigenereCipher.attack).toBe('function');
    expect(vigenereCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks', () => {
    expect(vigenereCipher.explainer.toLowerCase()).toContain('how this breaks');
  });

  it('offers a key the attack can hand straight back', () => {
    // The Attack tab writes a candidate's `key` into the params, so the shape it
    // produces has to be the shape the params expect.
    const candidate = breakVigenere(vigenere(PARAGRAPH, 'LEMON'))[0];
    const names = vigenereCipher.params.map((spec) => spec.name);
    expect(Object.keys(candidate?.key ?? {})).toEqual(names);
  });
});
