import { describe, expect, it } from 'vitest';
import { ERAS, byYear, eraOf, parseYear } from './chronology';
import { ciphers } from '../ciphers/registry';

describe('parseYear', () => {
  it('reads a plain year', () => {
    expect(parseYear('1553')).toEqual({ sortYear: 1553, approximate: false });
  });

  it('negates BC so the sort needs no special case', () => {
    expect(parseYear('~500 BC').sortYear).toBe(-500);
    expect(parseYear('~50 BC').sortYear).toBeGreaterThan(parseYear('~500 BC').sortYear ?? 0);
  });

  it('sorts a decade from its start, and marks it approximate', () => {
    expect(parseYear('1500s')).toEqual({ sortYear: 1500, approximate: true });
    expect(parseYear('1930s')).toEqual({ sortYear: 1930, approximate: true });
  });

  it('returns null rather than guessing when there is no number', () => {
    expect(parseYear('ancient').sortYear).toBeNull();
    expect(parseYear(undefined).sortYear).toBeNull();
  });
});

describe('byYear', () => {
  it('puts the undated last and keeps the caller order for ties', () => {
    const items = [
      { n: 'c', y: undefined },
      { n: 'a', y: '1918' },
      { n: 'b', y: '1918' },
      { n: 'z', y: '~50 BC' },
    ];
    expect(byYear(items, (i) => i.y).map((i) => i.n)).toEqual(['z', 'a', 'b', 'c']);
  });

  it('orders every registered cipher without throwing', () => {
    // The real point of this suite: a new cipher with a year format nobody
    // anticipated should fail here rather than silently sort to the front.
    const ordered = byYear(ciphers, (c) => c.year);
    expect(ordered).toHaveLength(ciphers.length);
    const years = ordered.map((c) => parseYear(c.year).sortYear).filter((y) => y !== null);
    expect([...years]).toEqual([...years].sort((a, b) => a - b));
  });

  it('finds an era for every dated cipher', () => {
    for (const cipher of ciphers) {
      const { sortYear } = parseYear(cipher.year);
      if (sortYear === null) continue;
      expect([cipher.slug, eraOf(sortYear)?.label]).not.toEqual([cipher.slug, undefined]);
    }
  });

  it('has eras in ascending order, ending open', () => {
    const bounds = ERAS.map((e) => e.until);
    expect([...bounds]).toEqual([...bounds].sort((a, b) => a - b));
    expect(bounds.at(-1)).toBe(Number.POSITIVE_INFINITY);
  });
});
