/**
 * Turning a cipher's `year` into something sortable.
 *
 * `CipherModule.year` is free text on purpose — "1553", "1500s", "~500 BC" and
 * "ancient" are all honest answers, and forcing a number would have made the
 * catalogue lie about how well any of these dates are known. A timeline still
 * has to put them in order, so the parsing lives here rather than in the page:
 * React-free, tested, and returning `null` rather than guessing when a label
 * carries no number at all.
 *
 * The value is a *sort key*, not a date. "1500s" sorts as 1500 because the
 * decade started there, and BC years are negated so the arithmetic works
 * without a special case at the comparison.
 */
export interface DatedEntry {
  /** The sort key. Negative for BC. `null` when the label names no year. */
  sortYear: number | null;
  /** True when the label hedges — a decade, a century, or a tilde. */
  approximate: boolean;
}

const YEAR = /(\d{1,4})/;

export function parseYear(label: string | undefined): DatedEntry {
  if (label === undefined) return { sortYear: null, approximate: false };

  const bc = /\bbc\b|\bbce\b/i.test(label);
  const approximate = bc || /~|\bc\.|\bcirca\b|s\b|century/i.test(label);
  const found = YEAR.exec(label);
  if (found === null) return { sortYear: null, approximate: true };

  const value = Number(found[1]);
  return { sortYear: bc ? -value : value, approximate };
}

/**
 * Chronological order, oldest first, with undated entries last.
 *
 * Ties keep the caller's order rather than falling back to a name, because the
 * caller's order is the catalogue's learning path and that is a better tiebreak
 * than the alphabet — three ciphers from 1918 read better in the order the
 * curriculum introduces them.
 */
export function byYear<T>(items: readonly T[], yearOf: (item: T) => string | undefined): T[] {
  return items
    .map((item, index) => ({ item, index, ...parseYear(yearOf(item)) }))
    .sort((a, b) => {
      if (a.sortYear === null && b.sortYear === null) return a.index - b.index;
      if (a.sortYear === null) return 1;
      if (b.sortYear === null) return -1;
      return a.sortYear - b.sortYear || a.index - b.index;
    })
    .map((entry) => entry.item);
}

/**
 * The label for a run of history, used to break a long list into headings.
 *
 * Deliberately uneven. Two thousand years of "one letter for another" is one
 * heading and the years since 1970 are three, because that is where the ideas
 * are, not because the arithmetic came out that way.
 */
export const ERAS: readonly { label: string; note: string; until: number }[] = [
  {
    label: 'Antiquity',
    note: 'Ciphers you can do in your head, invented before anyone had a way to say why they fail.',
    until: 1400,
  },
  {
    label: 'The Renaissance',
    note: 'The keyword arrives, and with it the first cipher that resisted counting letters for three centuries.',
    until: 1800,
  },
  {
    label: 'Telegraph and field cipher',
    note: 'Messages start moving faster than couriers, and the volume itself becomes the weakness.',
    until: 1914,
  },
  {
    label: 'The war years',
    note: 'Machines, and the first industrial-scale cryptanalysis to answer them.',
    until: 1945,
  },
  {
    label: 'The public era',
    note: 'Cryptography leaves the government and becomes mathematics anyone can publish.',
    until: 1990,
  },
  {
    label: 'The modern standard',
    note: 'Open competitions, published attacks, and algorithms that are still standing.',
    until: Number.POSITIVE_INFINITY,
  },
];

export function eraOf(sortYear: number | null): (typeof ERAS)[number] | undefined {
  if (sortYear === null) return undefined;
  return ERAS.find((era) => sortYear < era.until);
}
