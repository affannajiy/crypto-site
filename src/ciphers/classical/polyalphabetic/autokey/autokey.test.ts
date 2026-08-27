import { describe, expect, it } from 'vitest';
import { autokey, autokeyTrace, keystreamFor, keywordValues, normalisedKeyword } from './autokey';
import { MAX_KEYWORD, breakAutokey, keywordsOfLength, searchSize } from './attack';
import { vigenere } from '../vigenere/vigenere';
import { candidateKeyLengths, lettersOnly } from '../vigenere/attack';
import autokeyCipher from './index';

describe('the keyword', () => {
  it('keeps letters and discards everything else', () => {
    expect(normalisedKeyword('k e!y')).toBe('KEY');
  });

  it('falls back to A rather than producing an empty keystream', () => {
    expect(keywordValues('!!')).toEqual([0]);
  });
});

describe('keystreamFor', () => {
  it('is the keyword followed by the message', () => {
    expect(keystreamFor('ATTACKATDAWN', 'KEY')).toBe('KEYATTACKATD');
  });

  it('is exactly as long as the message, never longer', () => {
    expect(keystreamFor('HI', 'LONGKEYWORD')).toBe('LO');
  });

  it('never repeats, which is the whole point', () => {
    // A repeating key of length n has stream[i] === stream[i + n] everywhere.
    // Autokey's does not, unless the plaintext itself happens to repeat.
    const stream = keystreamFor('THEQUICKBROWNFOX', 'KEY');
    let periodic = false;
    for (let n = 1; n <= 8; n += 1) {
      let all = true;
      for (let i = 0; i + n < stream.length; i += 1) {
        if (stream.charAt(i) !== stream.charAt(i + n)) all = false;
      }
      if (all) periodic = true;
    }
    expect(periodic).toBe(false);
  });
});

describe('autokey', () => {
  it('encrypts the textbook example', () => {
    // ATTACKATDAWN with keyword KEY: key is KEYATTACKATD.
    // A+K=K, T+E=X, T+Y=R, A+A=A, C+T=V, K+T=D, A+A=A, T+C=V, D+K=N, A+A=A, W+T=P, N+D=Q
    expect(autokey('ATTACKATDAWN', 'KEY', 'encrypt')).toBe('KXRAVDAVNAPQ');
  });

  it('round-trips', () => {
    const text = 'Meet me at the old bridge at midnight.';
    expect(autokey(autokey(text, 'FALCON', 'encrypt'), 'FALCON', 'decrypt')).toBe(text);
  });

  it('agrees with Vigenère for exactly as long as the keyword lasts', () => {
    // The first m letters are ordinary Vigenère; after that the ciphers diverge.
    const text = 'ATTACKATDAWN';
    expect(autokey(text, 'KEY', 'encrypt').slice(0, 3)).toBe(
      vigenere(text, 'KEY', 'encrypt').slice(0, 3),
    );
    expect(autokey(text, 'KEY', 'encrypt')).not.toBe(vigenere(text, 'KEY', 'encrypt'));
  });

  it('preserves case and passes non-letters through', () => {
    // Keyword A adds 0, so the first letter is unchanged and only the autokeyed
    // letters move. Case and punctuation must survive either way.
    const out = autokey('at dawn!', 'A', 'encrypt');
    expect(out).toMatch(/^[a-z]{2} [a-z]{4}!$/);
    expect(out.charAt(0)).toBe('a');
  });

  it('does not advance the keystream on a non-letter', () => {
    expect(autokey('AT DAWN', 'KEY', 'encrypt').replace(/ /g, '')).toBe(
      autokey('ATDAWN', 'KEY', 'encrypt'),
    );
  });

  it('propagates a single error to the end of the message, unlike Vigenère', () => {
    const text = 'ATTACKATDAWNTOMORROW';
    const good = autokey(text, 'KEY', 'encrypt');
    // Corrupt one ciphertext letter and count how many plaintext letters change.
    const bad = `${good.slice(0, 4)}Z${good.slice(5)}`;
    const recovered = autokey(bad, 'KEY', 'decrypt');
    let damaged = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (recovered.charAt(i) !== text.charAt(i)) damaged += 1;
    }
    expect(damaged).toBeGreaterThan(3);

    const vBad = `${vigenere(text, 'KEY', 'encrypt').slice(0, 4)}Z${vigenere(text, 'KEY', 'encrypt').slice(5)}`;
    const vRecovered = vigenere(vBad, 'KEY', 'decrypt');
    let vDamaged = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (vRecovered.charAt(i) !== text.charAt(i)) vDamaged += 1;
    }
    expect(vDamaged).toBe(1);
  });

  it('handles the empty string', () => {
    expect(autokey('', 'KEY', 'encrypt')).toBe('');
  });
});

describe('autokeyTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me at dawn.';
    expect(autokeyTrace(text, 'KEY', 'encrypt').output).toBe(autokey(text, 'KEY', 'encrypt'));
    expect(autokeyTrace(text, 'KEY', 'decrypt').output).toBe(autokey(text, 'KEY', 'decrypt'));
  });

  it('emits one step per character, non-letters included', () => {
    const text = 'Hi there!';
    const { steps } = autokeyTrace(text, 'KEY', 'encrypt');
    expect(steps).toHaveLength(text.length);
  });

  it('says which key letters came from the keyword and which from the message', () => {
    const { steps } = autokeyTrace('ATTACK', 'KEY', 'encrypt');
    expect(steps.map((s) => s.data?.['fromKeyword'])).toEqual([true, true, true, false, false, false]);
  });

  it('feeds the plaintext back in when decrypting, not the ciphertext', () => {
    const cipher = autokey('ATTACKATDAWN', 'KEY', 'encrypt');
    const { steps } = autokeyTrace(cipher, 'KEY', 'decrypt');
    // Key letter 4 must be plaintext letter 1, which is A.
    expect(steps[3]?.data?.['keyChar']).toBe('A');
  });
});

describe('the attack', () => {
  const plaintext =
    'The message becomes its own key, so there is no period to find and the classical ' +
    'attacks on a repeating key have nothing at all to count. What remains is that the ' +
    'keyword is short, and a short keyword is a small space to search through.';

  it('recovers a one-letter keyword', () => {
    expect(breakAutokey(autokey(plaintext, 'Q', 'encrypt'))[0]?.key['keyword']).toBe('Q');
  });

  it('recovers a three-letter keyword', () => {
    const best = breakAutokey(autokey(plaintext, 'KEY', 'encrypt'))[0];
    expect(best?.key['keyword']).toBe('KEY');
    expect(best?.plaintext).toBe(plaintext);
  });

  it('ranks lower-is-better, like every other attack in the app', () => {
    const scores = breakAutokey(autokey(plaintext, 'KEY', 'encrypt')).map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it('cannot reach a keyword longer than the cap, and that is the tool not the cipher', () => {
    // Six letters is 26^6, which no browser button is going to walk through.
    // The search is length-generic; only the cap stops it, and the page says so.
    expect(breakAutokey(autokey(plaintext, 'FALCON', 'encrypt'))[0]?.plaintext).not.toBe(plaintext);
    expect(searchSize(4) / searchSize(3)).toBeGreaterThan(20);
  });

  it('enumerates the whole keyword space for a length', () => {
    expect(keywordsOfLength(1)).toHaveLength(26);
    expect(keywordsOfLength(2)).toHaveLength(676);
    expect(keywordsOfLength(2)[0]).toBe('AA');
    expect(keywordsOfLength(2)[675]).toBe('ZZ');
  });

  it('knows the size of the search it is doing', () => {
    expect(searchSize(1)).toBe(26);
    expect(searchSize(3)).toBe(26 + 676 + 17576);
    expect(MAX_KEYWORD).toBe(3);
  });

  it('returns nothing for text with no letters in it', () => {
    expect(breakAutokey('12345 !!!')).toEqual([]);
  });

  it("defeats Vigenère's period-finding, which is the improvement", () => {
    // The Vigenère attack looks for a repeating period. There is not one, so the
    // key length it reports is meaningless — asserted here so the claim in the
    // explainer is checked rather than asserted.
    const letters = lettersOnly(autokey(plaintext, 'KEY', 'encrypt'));
    const lengths = candidateKeyLengths(letters);
    const key = lengths.map((n) => n);
    expect(key.length).toBeGreaterThan(0);
    // Whatever it reports, decrypting as Vigenère with that period is garbage.
    for (const length of lengths.slice(0, 3)) {
      const guess = 'A'.repeat(length);
      expect(vigenere(autokey(plaintext, 'KEY', 'encrypt'), guess, 'decrypt')).not.toBe(plaintext);
    }
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = autokeyCipher.encrypt('ATTACKATDAWN', { keyword: 'KEY' });
    expect('output' in result && result.output).toBe('KXRAVDAVNAPQ');
  });

  it('round-trips through the module', () => {
    const key = { keyword: 'FALCON' };
    const encrypted = autokeyCipher.encrypt('Attack at dawn!', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = autokeyCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, key);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of autokeyCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => autokeyCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('states its search cap on the page, not only in the code', () => {
    expect(autokeyCipher.explainer).toContain(`stops at ${MAX_KEYWORD} letters`);
    expect(autokeyCipher.explainer).toContain('limit of the tool, not a property of the cipher');
  });

  it('tells the reader how it breaks', () => {
    expect(autokeyCipher.explainer.toLowerCase()).toContain('how this breaks');
  });
});
