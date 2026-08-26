import { describe, expect, it } from 'vitest';
import {
  HALF,
  ROWS,
  keyLettersForRow,
  normalisedKey,
  porta,
  portaLetter,
  portaTrace,
  rowFor,
  tableRow,
} from './porta';
import { breakPorta, canonicalKeyLetter, solveColumn, solveKey } from './attack';
import { candidateKeyLengths, lettersOnly } from '../vigenere/attack';
import portaCipher from './index';

describe('the table', () => {
  it('has thirteen rows for twenty-six key letters', () => {
    expect(ROWS).toBe(13);
    const rows = new Set(Array.from({ length: 26 }, (_, k) => rowFor(k)));
    expect(rows.size).toBe(13);
  });

  it('gives every row exactly two key letters', () => {
    for (let row = 0; row < ROWS; row += 1) {
      const letters = keyLettersForRow(row);
      expect(letters).toHaveLength(2);
      expect(rowFor(letters.charCodeAt(0) - 65)).toBe(row);
      expect(rowFor(letters.charCodeAt(1) - 65)).toBe(row);
    }
  });

  it('always swaps a letter into the other half of the alphabet', () => {
    for (let row = 0; row < ROWS; row += 1) {
      for (let i = 0; i < 26; i += 1) {
        const out = portaLetter(i, row);
        expect(i < HALF).toBe(out >= HALF);
      }
    }
  });

  it('is a permutation of the alphabet on every row', () => {
    for (let row = 0; row < ROWS; row += 1) {
      expect(tableRow(row).split('').sort().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }
  });

  it('is its own inverse on every row and every letter', () => {
    for (let row = 0; row < ROWS; row += 1) {
      for (let i = 0; i < 26; i += 1) {
        expect(portaLetter(portaLetter(i, row), row)).toBe(i);
      }
    }
  });

  it('never leaves a letter where it was', () => {
    // A consequence of always crossing halves — the same structural fact that
    // gives Enigma's reflector its famous flaw.
    for (let row = 0; row < ROWS; row += 1) {
      for (let i = 0; i < 26; i += 1) {
        expect(portaLetter(i, row)).not.toBe(i);
      }
    }
  });

  it('rotates the second half by the row number', () => {
    expect(tableRow(0).slice(0, 3)).toBe('NOP');
    expect(tableRow(1).slice(0, 3)).toBe('OPQ');
  });
});

describe('porta', () => {
  it('encrypts by hand', () => {
    // Key A is row 0: A -> N, B -> O, N -> A.
    expect(porta('ABN', 'A')).toBe('NOA');
  });

  it('gives an identical ciphertext for a key letter and its partner', () => {
    // The halving, asserted. This is the cipher's own worst feature.
    const text = 'Meet me at dawn.';
    expect(porta(text, 'ACEG')).toBe(porta(text, 'BDFH'));
  });

  it('is its own inverse on real text', () => {
    const text = 'Meet me at the old bridge at midnight.';
    expect(porta(porta(text, 'PORTA'), 'PORTA')).toBe(text);
  });

  it('preserves case and passes non-letters through', () => {
    expect(porta('a b!', 'A')).toBe('n o!');
  });

  it('does not advance the key on a non-letter', () => {
    expect(porta('AT DAWN', 'KEY').replace(/ /g, '')).toBe(porta('ATDAWN', 'KEY'));
  });

  it('falls back to A for a key with no letters', () => {
    expect(normalisedKey('!!')).toBe('A');
    expect(porta('AB', '!!')).toBe('NO');
  });

  it('handles the empty string', () => {
    expect(porta('', 'PORTA')).toBe('');
  });
});

describe('portaTrace', () => {
  it('agrees with the untraced cipher', () => {
    const text = 'Meet me at dawn.';
    expect(portaTrace(text, 'PORTA').output).toBe(porta(text, 'PORTA'));
  });

  it('emits one step per character, non-letters included', () => {
    const text = 'Hi there!';
    const { steps } = portaTrace(text, 'KEY');
    expect(steps).toHaveLength(text.length);
    steps.forEach((step, i) => expect(step.highlight).toEqual({ start: i, end: i + 1 }));
  });

  it('records the row so the visualizer can highlight it', () => {
    const { steps } = portaTrace('AAA', 'ACE');
    expect(steps.map((s) => s.data?.['row'])).toEqual([0, 1, 2]);
  });

  it('names both key letters that select the row', () => {
    expect(portaTrace('A', 'A').steps[0]?.detail).toContain('A and B');
  });
});

describe('the attack', () => {
  const plaintext =
    'Two key letters choose the same row, so half of the key does nothing at all and ' +
    'each column of the ciphertext hides only thirteen possibilities rather than twenty ' +
    'six, which is a factor an analyst is handed rather than one they have to work for.';

  it('recovers the key in canonical form', () => {
    // ACE and BDF are the same key; the attack reports the even letters so the
    // answer is reproducible rather than one of two coin flips.
    const best = breakPorta(porta(plaintext, 'ACE'))[0];
    expect(best?.key['key']).toBe('ACE');
    expect(best?.plaintext).toBe(plaintext);
  });

  it('reports the same key whichever partner was actually used', () => {
    expect(breakPorta(porta(plaintext, 'BDF'))[0]?.key['key']).toBe('ACE');
  });

  it('solves one column out of thirteen possibilities, not twenty-six', () => {
    const letters = lettersOnly(porta(plaintext, 'K'));
    expect(canonicalKeyLetter(solveColumn(letters))).toBe('K');
  });

  it('assembles the key one column at a time', () => {
    const letters = lettersOnly(porta(plaintext, 'ACE'));
    expect(solveKey(letters, 3)).toBe('ACE');
  });

  it('ranks lower-is-better, like every other attack in the app', () => {
    const scores = breakPorta(porta(plaintext, 'ACE')).map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it("finds the period with Vigenère's own function, unmodified", () => {
    const letters = lettersOnly(porta(plaintext, 'ACE'));
    expect(candidateKeyLengths(letters)).toContain(3);
  });

  it('returns nothing for text with no letters in it', () => {
    expect(breakPorta('12345 !!!')).toEqual([]);
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = portaCipher.encrypt('ABN', { key: 'A' });
    expect('output' in result && result.output).toBe('NOA');
  });

  it('round-trips through the module with the identical operation', () => {
    const key = { key: 'PORTA' };
    const encrypted = portaCipher.encrypt('Attack at dawn!', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = portaCipher.decrypt(output, key);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of portaCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => portaCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('predates Vigenère, and says so', () => {
    expect(portaCipher.year).toBe('1563');
    expect(portaCipher.explainer).toContain('older than');
  });

  it('tells the reader how it breaks, including what the halving costs', () => {
    expect(portaCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(portaCipher.explainer).toContain('thirteen, not twenty-six');
  });
});
