import { describe, expect, it } from 'vitest';
import { ALPHABET_SIZE, caesar, caesarTrace, letterIndex, normaliseShift } from './caesar';
import { bruteForceCaesar } from './attack';
import caesarCipher from './index';

/**
 * Seeded so a failure is reproducible. A fuzz test built on Math.random is a
 * flaky test with extra steps.
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

const PRINTABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?'\n\t-éΩ中🙂";

function randomText(rand: () => number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PRINTABLE[Math.floor(rand() * PRINTABLE.length)];
  }
  return out;
}

describe('normaliseShift', () => {
  it('folds any integer into 0..25', () => {
    expect(normaliseShift(0)).toBe(0);
    expect(normaliseShift(3)).toBe(3);
    expect(normaliseShift(26)).toBe(0);
    expect(normaliseShift(29)).toBe(3);
    // JavaScript's % keeps the sign of the left operand, so this is the case
    // that a naive implementation gets wrong.
    expect(normaliseShift(-3)).toBe(23);
    expect(normaliseShift(-26)).toBe(0);
    expect(normaliseShift(-29)).toBe(23);
  });
});

describe('letterIndex', () => {
  it('maps A-Z and a-z to 0-25 and everything else to -1', () => {
    expect(letterIndex('A')).toBe(0);
    expect(letterIndex('a')).toBe(0);
    expect(letterIndex('Z')).toBe(25);
    expect(letterIndex('z')).toBe(25);
    expect(letterIndex('H')).toBe(7);
    expect(letterIndex(' ')).toBe(-1);
    expect(letterIndex('4')).toBe(-1);
    expect(letterIndex('é')).toBe(-1);
  });
});

describe('caesar — known answers', () => {
  it('matches the textbook vectors', () => {
    expect(caesar('ATTACKATDAWN', 3)).toBe('DWWDFNDWGDZQ');
    expect(caesar('HELLO', 3)).toBe('KHOOR');
    expect(caesar('KHOOR', 3, 'decrypt')).toBe('HELLO');
    expect(caesar('THE QUICK BROWN FOX', 13)).toBe('GUR DHVPX OEBJA SBK');
  });

  it('is its own inverse at shift 13 (ROT13)', () => {
    const text = 'Why did the chicken cross the road?';
    expect(caesar(caesar(text, 13), 13)).toBe(text);
  });

  it('wraps round the end of the alphabet', () => {
    expect(caesar('XYZ', 3)).toBe('ABC');
    expect(caesar('xyz', 3)).toBe('abc');
    expect(caesar('ABC', 3, 'decrypt')).toBe('XYZ');
    expect(caesar('Z', 1)).toBe('A');
    expect(caesar('A', 1, 'decrypt')).toBe('Z');
  });

  it('preserves case', () => {
    expect(caesar('Hello World', 5)).toBe('Mjqqt Btwqi');
    expect(caesar('aBcXyZ', 1)).toBe('bCdYzA');
  });

  it('passes non-alphabetic characters through untouched', () => {
    expect(caesar('Hello, World! 42 — é中🙂', 3)).toBe('Khoor, Zruog! 42 — é中🙂');
  });

  it('treats a shift of 26 as no shift at all', () => {
    expect(caesar('Attack at dawn', ALPHABET_SIZE)).toBe('Attack at dawn');
  });
});

describe('caesar — round trip', () => {
  it('returns the original for arbitrary text and shift', () => {
    const rand = mulberry32(20260823);
    for (let run = 0; run < 400; run += 1) {
      const text = randomText(rand, Math.floor(rand() * 60));
      const shift = 1 + Math.floor(rand() * 25);
      expect(caesar(caesar(text, shift, 'encrypt'), shift, 'decrypt')).toBe(text);
    }
  });

  it('round trips through the traced implementation too', () => {
    const rand = mulberry32(7);
    for (let run = 0; run < 100; run += 1) {
      const text = randomText(rand, Math.floor(rand() * 40));
      const shift = 1 + Math.floor(rand() * 25);
      const encrypted = caesarTrace(text, shift, 'encrypt');
      const decrypted = caesarTrace(encrypted.output, shift, 'decrypt');
      expect(decrypted.output).toBe(text);
    }
  });

  it('agrees with the traced implementation on the output', () => {
    const rand = mulberry32(99);
    for (let run = 0; run < 100; run += 1) {
      const text = randomText(rand, Math.floor(rand() * 40));
      const shift = 1 + Math.floor(rand() * 25);
      expect(caesarTrace(text, shift, 'encrypt').output).toBe(caesar(text, shift, 'encrypt'));
      expect(caesarTrace(text, shift, 'decrypt').output).toBe(caesar(text, shift, 'decrypt'));
    }
  });
});

describe('caesarTrace — the steps', () => {
  it('emits exactly one step per character', () => {
    const rand = mulberry32(1234);
    for (let run = 0; run < 50; run += 1) {
      const text = randomText(rand, Math.floor(rand() * 50));
      expect(caesarTrace(text, 7).steps).toHaveLength(text.length);
    }
  });

  it('numbers steps in order, and each highlight covers its own character', () => {
    const text = 'Hi, Bob!';
    const { steps } = caesarTrace(text, 3);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      expect(step.highlight).toEqual({ start: i, end: i + 1 });
      expect(step.input).toBe(text[i]);
    });
  });

  it('spells out the arithmetic for a letter', () => {
    const step = caesarTrace('H', 3).steps[0];
    expect(step?.title).toBe("Shift 'H' by 3");
    expect(step?.detail).toContain('index 7');
    expect(step?.detail).toContain('K');
    expect(step?.output).toBe('K');
  });

  it('spells out the wrap past the end of the alphabet', () => {
    const step = caesarTrace('Y', 3).steps[0];
    expect(step?.detail).toContain('24 + 3 = 27');
    expect(step?.detail).toContain('27 − 26 = 1');
    expect(step?.output).toBe('B');
  });

  it('spells out the wrap off the front of the alphabet when decrypting', () => {
    const step = caesarTrace('B', 3, 'decrypt').steps[0];
    expect(step?.detail).toContain('1 − 3 = −2');
    expect(step?.detail).toContain('−2 + 26 = 24');
    expect(step?.output).toBe('Y');
  });

  it('says nothing about wrapping when a letter does not wrap', () => {
    expect(caesarTrace('A', 3).steps[0]?.detail).not.toContain('wrap');
    expect(caesarTrace('A', 3).steps[0]?.data?.['wrapped']).toBe(false);
  });

  it('names non-letters instead of quoting an invisible character', () => {
    const steps = caesarTrace('a b', 1).steps;
    expect(steps[1]?.title).toBe('Pass the space through');
    expect(steps[1]?.output).toBe(' ');
    expect(steps[1]?.data?.['isLetter']).toBe(false);
  });

  it('carries the mapping the visualizer needs', () => {
    const step = caesarTrace('h', 3).steps[0];
    expect(step?.data).toMatchObject({
      isLetter: true,
      upper: false,
      fromIndex: 7,
      toIndex: 10,
      from: 'h',
      to: 'k',
      shift: 3,
      direction: 'encrypt',
    });
  });

  it('produces no steps for empty input', () => {
    expect(caesarTrace('', 3)).toEqual({ output: '', steps: [] });
  });
});

describe('bruteForceCaesar', () => {
  const paragraph =
    'The quick brown fox jumps over the lazy dog, and it does so with a certain ' +
    'weary regularity. Frequency analysis does not care what the message says, only ' +
    'how often each letter turns up in it. Give the attacker a paragraph and the ' +
    'answer arrives before the coffee does.';

  it('returns all 25 candidates, best first', () => {
    const candidates = bruteForceCaesar(caesar(paragraph, 11));
    expect(candidates).toHaveLength(25);
    for (let i = 1; i < candidates.length; i += 1) {
      expect(candidates[i]!.score).toBeGreaterThanOrEqual(candidates[i - 1]!.score);
    }
  });

  it('recovers every shift from a paragraph of English', () => {
    for (let shift = 1; shift < ALPHABET_SIZE; shift += 1) {
      const best = bruteForceCaesar(caesar(paragraph, shift))[0];
      expect(best?.key['shift'], `shift ${shift} was not recovered`).toBe(shift);
      expect(best?.plaintext).toBe(paragraph);
    }
  });

  it('labels each candidate with its shift', () => {
    const candidates = bruteForceCaesar(caesar('Attack at dawn', 4));
    expect(candidates[0]?.label).toBe('Shift 4');
  });

  it('scores text with no letters as no fit at all, rather than a perfect one', () => {
    for (const candidate of bruteForceCaesar('12345 !!! ...')) {
      expect(candidate.score).toBe(Infinity);
    }
  });

  it('is deterministic', () => {
    const cipher = caesar(paragraph, 19);
    expect(bruteForceCaesar(cipher)).toEqual(bruteForceCaesar(cipher));
  });
});

describe('the CipherModule wiring', () => {
  it('encrypts and decrypts through the registry contract', () => {
    const params = { shift: 3 };
    const encrypted = caesarCipher.encrypt('Hello, World!', params) as { output: string };
    expect(encrypted.output).toBe('Khoor, Zruog!');

    const decrypted = caesarCipher.decrypt(encrypted.output, params) as { output: string };
    expect(decrypted.output).toBe('Hello, World!');
  });

  it('accepts a shift that arrived from a form control as a string', () => {
    const encrypted = caesarCipher.encrypt('abc', { shift: '3' }) as { output: string };
    expect(encrypted.output).toBe('def');
  });

  it('refuses a shift that is not a number, in words a person can act on', () => {
    expect(() => caesarCipher.encrypt('abc', { shift: 'three' })).toThrow(/whole number/i);
  });

  it('declares only the tiers it actually implements', () => {
    expect(caesarCipher.tiers).toEqual(['encrypt', 'attack', 'visualize', 'benchmark']);
    expect(caesarCipher.attack).toBeDefined();
    expect(caesarCipher.visualize).toBeDefined();
  });

  it('ships an explainer that says how the cipher breaks', () => {
    expect(caesarCipher.explainer.toLowerCase()).toContain('how this breaks');
  });
});
