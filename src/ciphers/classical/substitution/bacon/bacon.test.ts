import { describe, expect, it } from 'vitest';
import {
  ALPHABET_24,
  CODE_LENGTH,
  type Variant,
  alphabetFor,
  bacon,
  baconTrace,
  codeFor,
  hideIn,
  inFives,
  letterForCode,
  revealFrom,
  symbolsFor,
  symbolsFrom,
  table,
  trailingARun,
  unbacon,
  unbaconTrace,
  valueOf,
} from './bacon';
import baconCipher from './index';

const VARIANTS: Variant[] = ['24', '26'];

describe('the table', () => {
  it("uses Bacon's 24 letters, with I and J sharing and U and V sharing", () => {
    expect(ALPHABET_24).toHaveLength(24);
    expect(ALPHABET_24).not.toContain('J');
    expect(ALPHABET_24).not.toContain('V');
    expect(codeFor('J', '24')).toBe(codeFor('I', '24'));
    expect(codeFor('V', '24')).toBe(codeFor('U', '24'));
  });

  it('gives J and V codes of their own in the 26-letter table', () => {
    expect(codeFor('J', '26')).not.toBe(codeFor('I', '26'));
    expect(codeFor('V', '26')).not.toBe(codeFor('U', '26'));
  });

  it('gives every letter exactly five symbols, all A or B', () => {
    for (const variant of VARIANTS) {
      for (const letter of alphabetFor(variant)) {
        expect(codeFor(letter, variant)).toMatch(/^[AB]{5}$/);
      }
    }
  });

  it('is a bijection: no two letters share a code', () => {
    for (const variant of VARIANTS) {
      const codes = alphabetFor(variant)
        .split('')
        .map((l) => codeFor(l, variant));
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('counts up in binary from A', () => {
    expect(codeFor('A', '26')).toBe('AAAAA');
    expect(codeFor('B', '26')).toBe('AAAAB');
    expect(codeFor('C', '26')).toBe('AAABA');
    expect(codeFor('Z', '26')).toBe('BBAAB');
    expect(valueOf('BBAAB')).toBe(25);
  });

  it('round-trips every letter through its own code', () => {
    for (const variant of VARIANTS) {
      for (const letter of alphabetFor(variant)) {
        expect(letterForCode(codeFor(letter, variant), variant)).toBe(letter);
      }
    }
  });

  it('rejects a code that is the wrong length or has a stray symbol', () => {
    expect(letterForCode('AABB', '26')).toBe('');
    expect(letterForCode('AABBC', '26')).toBe('');
  });

  it('labels the two shared rows so the page can show the alias', () => {
    const rows = table('24');
    expect(rows.find((r) => r.letter === 'I')?.alias).toBe('J');
    expect(rows.find((r) => r.letter === 'U')?.alias).toBe('V');
    expect(table('26').every((r) => r.alias === undefined)).toBe(true);
  });
});

describe('encoding', () => {
  it('turns a word into five symbols per letter', () => {
    // Five symbols each, so the length is exactly five times the letter count.
    expect(symbolsFor('HELLO', '26')).toHaveLength(5 * CODE_LENGTH);
    expect(bacon('AB', '26', '')).toBe('AAAAA AAAAB');
  });

  it('drops spacing and punctuation entirely', () => {
    expect(bacon('A B!', '26', '')).toBe('AAAAA AAAAB');
  });

  it('is case-insensitive on the way in', () => {
    expect(bacon('hello', '26', '')).toBe(bacon('HELLO', '26', ''));
  });

  it('groups the stream in fives for reading', () => {
    expect(inFives('AABBAABAAB')).toBe('AABBA ABAAB');
    expect(inFives('')).toBe('');
  });

  it('round-trips through the plain A/B form', () => {
    for (const variant of VARIANTS) {
      const text = 'MEETMEATDAWN';
      expect(unbacon(bacon(text, variant, ''), variant, '')).toBe(text);
    }
  });

  it('loses J and V in the 24-letter table, which is the price of 24 rows', () => {
    // Not a bug and not silently ignored: it is exactly what the table says.
    expect(unbacon(bacon('JAVA', '24', ''), '24', '')).toBe('IAUA');
    expect(unbacon(bacon('JAVA', '26', ''), '26', '')).toBe('JAVA');
  });

  it('handles the empty string', () => {
    expect(bacon('', '26', '')).toBe('');
    expect(unbacon('', '26', '')).toBe('');
  });
});

describe('hiding in a carrier', () => {
  const carrier = 'the quick brown fox jumps over the lazy dog';

  it('changes only the case of the carrier, never a character', () => {
    const hidden = hideIn(carrier, symbolsFor('HI', '26'));
    expect(hidden.text.toLowerCase()).toBe(carrier.toLowerCase());
    expect(hidden.text).not.toBe(carrier);
  });

  it('spells a capital for B and lowercase for A', () => {
    const hidden = hideIn('abcde', 'ABBAB');
    expect(hidden.text).toBe('aBCdE');
  });

  it('passes non-letters through without spending a symbol on them', () => {
    const hidden = hideIn('a b-c', 'BBB');
    expect(hidden.text).toBe('A B-C');
    expect(hidden.positions).toEqual([0, 2, 4]);
  });

  it('reads the symbols straight back out of the case', () => {
    const symbols = symbolsFor('MEET', '26');
    // The prefix, not the whole thing: the carrier's spare letters keep reading
    // as A after the message ends, which is the ambiguity tested below.
    expect(revealFrom(hideIn(carrier, symbols).text).startsWith(symbols)).toBe(true);
  });

  it('round-trips a message through a carrier, plus the carrier tail', () => {
    // Not `toBe`. A carrier longer than the message leaves its spare letters
    // lowercase, lowercase means A, and a run of A's is a run of A's. Bacon has
    // no end marker, so the extra letters are the cipher being honest rather
    // than the implementation being wrong — `trailingARun` names the ambiguity.
    const text = 'FLEE';
    const decoded = unbacon(bacon(text, '26', carrier), '26', carrier);
    expect(decoded.startsWith(text)).toBe(true);
    expect(decoded.slice(text.length)).toMatch(/^A*$/);
  });

  it('round-trips exactly when the carrier is written to fit', () => {
    // Twenty letters for four, which is what a real Baconian carrier does.
    const exact = 'a very quiet little town';
    expect(exact.replace(/[^a-z]/g, '')).toHaveLength(5 * 'FLEE'.length);
    expect(unbacon(bacon('FLEE', '26', exact), '26', exact)).toBe('FLEE');
  });

  it('cannot tell a carrier tail from a message that ends in A', () => {
    expect(trailingARun('FLEEAAA')).toBe(3);
    expect(trailingARun('BANANA')).toBe(1);
    expect(trailingARun('')).toBe(0);
  });

  it('says when the carrier was too short rather than silently truncating', () => {
    // Four letters need twenty carrier letters; this carrier has three.
    const hidden = hideIn('abc', symbolsFor('WXYZ', '26'));
    expect(hidden.truncated).toBe(true);
    expect(hideIn(carrier, symbolsFor('HI', '26')).truncated).toBe(false);
  });

  it('leaves the tail of a long carrier untouched, which is what makes it readable', () => {
    const hidden = hideIn(carrier, 'AAAAA');
    expect(hidden.text.slice(6)).toBe(carrier.slice(6));
  });

  it('ignores stray A and B letters when a carrier is in use', () => {
    // 'ABBA' in a carrier is four ordinary letters, not four symbols. Which
    // reading applies is decided by the carrier param, never guessed from text.
    expect(symbolsFrom('ABBA')).toBe('ABBA');
    expect(revealFrom('ABBA')).toBe('BBBB');
  });
});

describe('baconTrace', () => {
  it('agrees with the untraced encoder', () => {
    for (const carrier of ['', 'the quick brown fox jumps over the lazy dog']) {
      expect(baconTrace('Hi there', '24', carrier).output).toBe(bacon('Hi there', '24', carrier));
    }
  });

  it('emits one step per character, dropped ones included', () => {
    const { steps } = baconTrace('A B', '26', '');
    expect(steps).toHaveLength(3);
    expect(steps[1]?.data?.['isLetter']).toBe(false);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it('points each step at the five output symbols it produced', () => {
    const { steps } = baconTrace('AB', '26', '');
    expect(steps[0]?.outputHighlight).toEqual({ start: 0, end: 5 });
    // Groups are printed with a space between them, so the second starts at 6.
    expect(steps[1]?.outputHighlight).toEqual({ start: 6, end: 11 });
  });

  it('points at the carrying letters when a carrier is in use', () => {
    const { steps } = baconTrace('A', '26', 'a b c d e f');
    // Five symbols land on five letters spread across ten characters.
    expect(steps[0]?.data?.['carried']).toEqual([0, 2, 4, 6, 8]);
    expect(steps[0]?.outputHighlight).toEqual({ start: 0, end: 9 });
  });

  it('records that the carrier ran out rather than pretending it fitted', () => {
    const { steps } = baconTrace('AB', '26', 'abcdef');
    expect(steps[1]?.data?.['truncated']).toBe(true);
  });
});

describe('unbaconTrace', () => {
  it('agrees with the untraced decoder', () => {
    const encoded = bacon('SIGNAL', '24', '');
    expect(unbaconTrace(encoded, '24', '').output).toBe(unbacon(encoded, '24', ''));
  });

  it('emits one step per five-symbol group', () => {
    const { steps } = unbaconTrace('AAAAA AAAAB', '26', '');
    expect(steps).toHaveLength(2);
    expect(steps[0]?.output).toBe('A');
    expect(steps[1]?.output).toBe('B');
  });

  it('reports leftover symbols instead of dropping them in silence', () => {
    const { steps } = unbaconTrace('AAAAA AAB', '26', '');
    expect(steps).toHaveLength(2);
    expect(steps[1]?.title).toContain('3 spare symbols');
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = baconCipher.encrypt('AB', { variant: '26', carrier: '' });
    expect('output' in result && result.output).toBe('AAAAA AAAAB');
  });

  it('round-trips through the module in plain A/B form', () => {
    const key = { variant: '24', carrier: '' };
    const encrypted = baconCipher.encrypt('FLEE', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = baconCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, key);
    expect('output' in decrypted && decrypted.output).toBe('FLEE');
  });

  it('warns in the trace when a decoded carrier ends in a run of A', () => {
    const key = { variant: '26', carrier: 'the quick brown fox jumps over the lazy dog again now' };
    const encrypted = baconCipher.encrypt('FLEE', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = baconCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, key);
    const steps = 'steps' in decrypted ? decrypted.steps : [];
    expect(steps.some((s) => s.data?.['trailingA'] !== undefined)).toBe(true);
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of baconCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => baconCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('ships a default carrier long enough to hide something in', () => {
    const carrier = baconCipher.params.find((s) => s.name === 'carrier');
    const length = carrier?.kind === 'text' ? carrier.default.replace(/[^a-z]/gi, '').length : 0;
    expect(length).toBeGreaterThanOrEqual(5 * 'HELLO'.length);
  });

  it('has no Attack tab, because there is no key to search for', () => {
    expect(baconCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(baconCipher.attack).toBeUndefined();
  });

  it('tells the reader how it breaks, and separates hiding from encrypting', () => {
    expect(baconCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(baconCipher.explainer).toContain('teganograph');
    expect(baconCipher.explainer).toContain('encoding is not encryption');
  });
});
