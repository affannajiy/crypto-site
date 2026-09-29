import { describe, expect, it } from 'vitest';
import {
  TEXTBOOK_KEY,
  invertKey,
  monoalphabetic,
  monoalphabeticTrace,
  parseKey,
  randomAlphabet,
} from './monoalphabetic';
import monoalphabeticCipher from './index';

describe('parseKey', () => {
  it('turns a key alphabet into a plain-to-cipher table', () => {
    const forward = parseKey(TEXTBOOK_KEY);
    expect(forward[0]).toBe(3); // a -> D
    expect(forward[25]).toBe(13); // z -> N
  });

  it('ignores spaces and case, so a key in groups of five is accepted', () => {
    expect(parseKey('dkvqf ibjwp escxh tmyau olrgz n')).toEqual(parseKey(TEXTBOOK_KEY));
  });

  it('names the repeated and the missing letters', () => {
    expect(() => parseKey('DKVQFIBJWPESCXHTMYAUOLRGZQ')).toThrow(/Repeated: Q\. Missing: N\./);
  });

  it('refuses a key that is too short', () => {
    expect(() => parseKey('ABC')).toThrow(/has 3 letters and needs all 26/);
  });
});

describe('invertKey', () => {
  it('undoes the forward table', () => {
    const forward = parseKey(TEXTBOOK_KEY);
    const inverse = invertKey(forward);
    forward.forEach((to, from) => expect(inverse[to]).toBe(from));
  });
});

describe('monoalphabetic', () => {
  it('reproduces the textbook example', () => {
    expect(monoalphabetic('ifwewishtoreplaceletters', TEXTBOOK_KEY)).toBe(
      'wirfrwajuhyftsdvfsfuufya',
    );
    expect(monoalphabetic('IFWEWISHTOREPLACELETTERS', TEXTBOOK_KEY)).toBe(
      'WIRFRWAJUHYFTSDVFSFUUFYA',
    );
  });

  it('keeps case and passes everything that is not a letter through', () => {
    expect(monoalphabetic('If we, 42!', TEXTBOOK_KEY)).toBe('Wi rf, 42!');
  });

  it('round-trips', () => {
    const text = 'Meet me at the old bridge at midnight.';
    const key = randomAlphabet();
    expect(monoalphabetic(monoalphabetic(text, key), key, 'decrypt')).toBe(text);
  });

  it('is Caesar when the key is the alphabet shifted by three', () => {
    expect(monoalphabetic('attack at dawn', 'DEFGHIJKLMNOPQRSTUVWXYZABC')).toBe('dwwdfn dw gdzq');
  });
});

describe('randomAlphabet', () => {
  it('always produces a valid key', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(() => parseKey(randomAlphabet())).not.toThrow();
    }
  });
});

describe('monoalphabeticTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me at dawn.';
    expect(monoalphabeticTrace(text, TEXTBOOK_KEY).output).toBe(monoalphabetic(text, TEXTBOOK_KEY));
    expect(monoalphabeticTrace(text, TEXTBOOK_KEY, 'decrypt').output).toBe(
      monoalphabetic(text, TEXTBOOK_KEY, 'decrypt'),
    );
  });

  it('emits one step per character', () => {
    expect(monoalphabeticTrace('a b', TEXTBOOK_KEY).steps).toHaveLength(3);
  });

  it('lights the same table column in both directions', () => {
    const encrypt = monoalphabeticTrace('a', TEXTBOOK_KEY).steps[0];
    const decrypt = monoalphabeticTrace('D', TEXTBOOK_KEY, 'decrypt').steps[0];
    expect(encrypt?.data?.['plainIndex']).toBe(0);
    expect(decrypt?.data?.['plainIndex']).toBe(0);
  });
});

describe('the module', () => {
  it('generates keys it accepts', () => {
    const key = monoalphabeticCipher.randomKey?.() ?? {};
    expect(() => monoalphabeticCipher.encrypt('hello', key)).not.toThrow();
  });

  it('tells the reader how it breaks', () => {
    expect(monoalphabeticCipher.explainer).toContain('How this breaks');
    expect(monoalphabeticCipher.explainer).toContain('frequency analysis');
  });
});
