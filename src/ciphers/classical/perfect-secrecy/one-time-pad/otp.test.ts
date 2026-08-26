import { describe, expect, it } from 'vitest';
import {
  ALPHABET_SIZE,
  assertPadLongEnough,
  describeChar,
  difference,
  letterCount,
  normalisePad,
  oneTimePad,
  oneTimePadTrace,
} from './otp';
import { vigenere } from '../../polyalphabetic/vigenere/vigenere';
import oneTimePadCipher from './index';

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

function randomPad(random: () => number, length: number): string {
  let pad = '';
  for (let i = 0; i < length; i += 1) {
    pad += String.fromCharCode(65 + Math.floor(random() * ALPHABET_SIZE));
  }
  return pad;
}

describe('normalisePad', () => {
  it('keeps only letters, uppercased', () => {
    expect(normalisePad('xm ck-l')).toBe('XMCKL');
  });

  it('is empty rather than throwing for a pad with no letters', () => {
    expect(normalisePad('123 !!')).toBe('');
  });
});

describe('letterCount', () => {
  it('counts only the characters that will spend pad', () => {
    expect(letterCount('Hello, world!')).toBe(10);
    expect(letterCount('123 !!')).toBe(0);
  });
});

describe('assertPadLongEnough', () => {
  it('accepts a pad exactly as long as the message', () => {
    expect(() => assertPadLongEnough('HELLO', 'XMCKL')).not.toThrow();
  });

  it('accepts a longer pad', () => {
    expect(() => assertPadLongEnough('HELLO', 'XMCKLZZZZ')).not.toThrow();
  });

  it('refuses a short pad, and says exactly how short', () => {
    expect(() => assertPadLongEnough('HELLO', 'XMC')).toThrow('The pad is 2 letters too short');
  });

  it('gets the grammar right for a single missing letter', () => {
    expect(() => assertPadLongEnough('HELLO', 'XMCK')).toThrow('is 1 letter too short');
  });

  it('explains that repeating the pad would be a different, weaker cipher', () => {
    // The refusal is the lesson, so the message has to carry it.
    expect(() => assertPadLongEnough('HELLO', 'XM')).toThrow(/Vigenère/);
  });

  it('does not count punctuation against the pad', () => {
    expect(() => assertPadLongEnough('H, E! L. L? O', 'XMCKL')).not.toThrow();
  });
});

describe('oneTimePad', () => {
  it('matches the textbook vector', () => {
    expect(oneTimePad('HELLO', 'XMCKL')).toBe('EQNVZ');
  });

  it('decrypts the textbook vector back', () => {
    expect(oneTimePad('EQNVZ', 'XMCKL', 'decrypt')).toBe('HELLO');
  });

  it('preserves case and passes non-letters through', () => {
    // The comma and space spend no pad, so "world" continues from the sixth pad
    // letter rather than restarting.
    expect(oneTimePad('Hello, world!', 'XMCKLXMCKLXMCKL')).toBe('Eqnvz, tatvo!');
  });

  it('agrees with Vigenère when the pad happens to be short and repeated', () => {
    // The point the explainer makes: the arithmetic is identical, and the only
    // thing separating the two ciphers is whether the key repeats. Here the pad
    // is written out to full length by hand, so no refusal is triggered.
    const text = 'ATTACKATDAWN';
    expect(oneTimePad(text, 'LEMONLEMONLE')).toBe(vigenere(text, 'LEMON'));
  });

  it('refuses rather than repeating a short pad', () => {
    expect(() => oneTimePad('ATTACKATDAWN', 'LEMON')).toThrow(/too short/);
  });

  it('round-trips any text under any long-enough pad', () => {
    const random = mulberry32(20260825);
    const source = " abcXYZ.,!\n'0123zqM";
    for (let run = 0; run < 400; run += 1) {
      let text = '';
      for (let i = 0; i < Math.floor(random() * 60); i += 1) {
        text += source.charAt(Math.floor(random() * source.length));
      }
      const pad = randomPad(random, letterCount(text));
      expect(oneTimePad(oneTimePad(text, pad), pad, 'decrypt')).toBe(text);
    }
  });

  it('handles text with no letters at all', () => {
    expect(oneTimePad('123 !!', '')).toBe('123 !!');
  });

  it('can produce any plaintext from a given ciphertext, given the right pad', () => {
    // Shannon's argument, as a test. EQNVZ decrypts to HELLO, WORLD or PIZZA
    // depending only on which pad you hold, and nothing in the ciphertext
    // prefers one over another.
    const cipher = 'EQNVZ';
    for (const target of ['HELLO', 'WORLD', 'PIZZA', 'ABCDE']) {
      const pad = difference(cipher, target);
      expect(oneTimePad(cipher, pad, 'decrypt')).toBe(target);
    }
  });
});

describe('difference', () => {
  it('subtracts letter by letter, modulo 26', () => {
    // E - H is 4 - 7 = -3, which wraps to 23 = X.
    expect(difference('E', 'H')).toBe('X');
    expect(difference('HELLO', 'HELLO')).toBe('AAAAA');
  });

  it('ignores spacing and case', () => {
    expect(difference('he llo', 'HELLO')).toBe('AAAAA');
  });

  it('stops at the shorter of the two', () => {
    expect(difference('HELLO', 'HE')).toBe('AA');
  });

  it('cancels the pad when it is used twice — the whole Venona lesson', () => {
    const random = mulberry32(99);
    for (let run = 0; run < 200; run += 1) {
      const first = 'ATTACKATDAWNXY';
      const second = 'RETREATATNOONZ';
      const pad = randomPad(random, first.length);

      const c1 = oneTimePad(first, pad);
      const c2 = oneTimePad(second, pad);

      // Whatever the pad was, subtracting the ciphertexts gives the difference of
      // the plaintexts. The key does not appear on the right-hand side at all.
      expect(difference(c1, c2)).toBe(difference(first, second));
    }
  });
});

describe('describeChar', () => {
  it('names invisible characters instead of quoting them', () => {
    expect(describeChar(' ')).toBe('the space');
    expect(describeChar('Q')).toBe("'Q'");
  });
});

describe('oneTimePadTrace', () => {
  it('agrees with the untraced cipher', () => {
    const text = 'Meet me at dawn.';
    const pad = 'XMCKLQWRTZPBVNHG';
    expect(oneTimePadTrace(text, pad).output).toBe(oneTimePad(text, pad));
    expect(oneTimePadTrace(text, pad, 'decrypt').output).toBe(oneTimePad(text, pad, 'decrypt'));
  });

  it('emits one step per character, in order, each highlighting its own position', () => {
    const text = 'Hi there!';
    const { steps } = oneTimePadTrace(text, 'XMCKLQWRTZ');
    expect(steps).toHaveLength(text.length);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      expect(step.highlight).toEqual({ start: i, end: i + 1 });
      expect(step.input).toBe(text.charAt(i));
    });
  });

  it('spends pad only on letters', () => {
    const { steps } = oneTimePadTrace('A A', 'XMCKL');
    expect(steps[0]?.data?.['padChar']).toBe('X');
    expect(steps[1]?.data?.['isLetter']).toBe(false);
    // The second letter gets the second pad letter, not the third.
    expect(steps[2]?.data?.['padChar']).toBe('M');
  });

  it('says the pad letter is used up', () => {
    const detail = oneTimePadTrace('H', 'XMCKL').steps[0]?.detail ?? '';
    expect(detail).toContain('must never be used again');
  });

  it('carries the shape the visualizer reads', () => {
    expect(oneTimePadTrace('H', 'XMCKL').steps[0]?.data).toMatchObject({
      isLetter: true,
      upper: true,
      fromIndex: 7,
      toIndex: 4,
      from: 'H',
      to: 'E',
      padChar: 'X',
      shift: 23,
      padPosition: 0,
      direction: 'encrypt',
    });
  });

  it('refuses a short pad before producing any steps', () => {
    expect(() => oneTimePadTrace('ATTACKATDAWN', 'LEMON')).toThrow(/too short/);
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = oneTimePadCipher.encrypt('HELLO', { pad: 'XMCKL' });
    expect('output' in result && result.output).toBe('EQNVZ');
  });

  it('round-trips through the module', () => {
    const encrypted = oneTimePadCipher.encrypt('Attack at dawn!', { pad: 'XMCKLQWRTZPBVNH' });
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = oneTimePadCipher.decrypt(output, { pad: 'XMCKLQWRTZPBVNH' });
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('ships a default pad long enough for the workbench default message', () => {
    // The workbench opens on a sample message, and a cipher whose first render is
    // an error is a broken first impression.
    const spec = oneTimePadCipher.params.find((p) => p.name === 'pad');
    const pad = spec?.kind === 'text' ? spec.default : '';
    expect(normalisePad(pad).length).toBeGreaterThanOrEqual(
      letterCount('Meet me at the old bridge at midnight.'),
    );
  });

  it('refuses a short pad through the module too', () => {
    expect(() => oneTimePadCipher.encrypt('ATTACKATDAWN', { pad: 'LEMON' })).toThrow(
      /too short/,
    );
  });

  it('has no Attack tab, because no attack can exist', () => {
    expect(oneTimePadCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(oneTimePadCipher.attack).toBeUndefined();
  });

  it('implements every tier it does claim', () => {
    expect(oneTimePadCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks, and is honest that its own pad is public', () => {
    expect(oneTimePadCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(oneTimePadCipher.explainer).toContain('public source file');
  });
});
