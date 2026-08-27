import { describe, expect, it } from 'vitest';
import caesar from '../ciphers/classical/substitution/caesar';
import railFence from '../ciphers/classical/transposition/rail-fence';
import vigenere from '../ciphers/classical/polyalphabetic/vigenere';
import { ENGLISH_IOC, indexOfCoincidence, observe, topNgrams } from './analysis';

/** These three ciphers are synchronous; this narrows the contract's union. */
function sync(result: ReturnType<typeof caesar.encrypt>): string {
  if (result instanceof Promise) throw new Error('This test needs a synchronous cipher.');
  return result.output;
}

const SAMPLE =
  'It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood this truth is so well fixed in the minds of the surrounding families that he is considered the rightful property of some one or other of their daughters.';

describe('indexOfCoincidence', () => {
  it('lands near the English figure for English', () => {
    expect(indexOfCoincidence(SAMPLE)).toBeCloseTo(ENGLISH_IOC, 2);
  });

  it('survives a monoalphabetic substitution', () => {
    // The whole reason the statistic is useful: renaming letters cannot change
    // how often letters repeat.
    const enciphered = sync(caesar.encrypt(SAMPLE, { shift: 7 }));
    expect(indexOfCoincidence(enciphered)).toBeCloseTo(indexOfCoincidence(SAMPLE), 6);
  });

  it('survives a transposition too, for the same reason', () => {
    const enciphered = sync(railFence.encrypt(SAMPLE, { rails: 4 }));
    expect(indexOfCoincidence(enciphered)).toBeCloseTo(indexOfCoincidence(SAMPLE), 6);
  });

  it('falls towards random under a polyalphabetic key', () => {
    const enciphered = sync(vigenere.encrypt(SAMPLE, { key: 'CRYPTOLAB' }));
    expect(indexOfCoincidence(enciphered)).toBeLessThan(0.05);
  });

  it('reports nothing rather than guessing when there is no evidence', () => {
    expect(indexOfCoincidence('')).toBe(0);
    expect(indexOfCoincidence('A')).toBe(0);
  });
});

describe('topNgrams', () => {
  it('finds repeated runs and ignores the ones that appear once', () => {
    const grams = topNgrams('THE CAT AND THE HAT', 3);
    expect(grams[0]).toEqual({ gram: 'THE', count: 2 });
    expect(grams.every((g) => g.count > 1)).toBe(true);
  });
});

describe('observe', () => {
  it('calls a Caesar one alphabet', () => {
    const notes = observe(sync(caesar.encrypt(SAMPLE, { shift: 5 })));
    expect(notes[0]?.claim).toMatch(/One alphabet/);
  });

  it('calls a Vigenere several alphabets', () => {
    const notes = observe(sync(vigenere.encrypt(SAMPLE, { key: 'CRYPTOLAB' })));
    expect(notes[0]?.claim).toMatch(/Several alphabets/);
  });

  it('notices that a transposition kept English letter counts', () => {
    const notes = observe(sync(railFence.encrypt(SAMPLE, { rails: 5 })));
    expect(notes.some((n) => /Only the order changed/.test(n.claim))).toBe(true);
  });

  it('refuses to draw a conclusion from a short sample', () => {
    expect(observe('HELLO THERE')[0]?.claim).toMatch(/Too short/);
  });

  it('recognises Morse as not encryption at all', () => {
    expect(observe('... --- ...')[0]?.claim).toMatch(/not encryption/);
  });

  it('says nothing at all about empty input', () => {
    expect(observe('')).toEqual([]);
  });
});
