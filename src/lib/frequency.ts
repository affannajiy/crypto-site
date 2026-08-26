/**
 * English letter statistics, and the score that turns them into an attack.
 *
 * Plain TypeScript. No React, no DOM — an attack has to be runnable from a test.
 */

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const A_CODE = 65;

/**
 * Relative frequency of each letter in English text, as a percentage. The classic
 * table; sums to 100. Source: standard corpus counts as tabulated by Lewand,
 * *Cryptological Mathematics* (2000).
 */
export const ENGLISH_LETTER_FREQUENCY: readonly number[] = [
  8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153, 0.772, 4.025, 2.406,
  6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056, 2.758, 0.978, 2.36, 0.15, 1.974, 0.074,
];

/**
 * Counts A-Z in `text`, case-insensitively. Everything else is ignored, which is
 * exactly what an attacker does: punctuation and spacing carry no letter evidence.
 */
export function letterCounts(text: string): number[] {
  const counts = new Array<number>(26).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    // Fold to uppercase by clearing bit 5, then check the range once.
    const upper = code & ~32;
    if (upper >= A_CODE && upper <= A_CODE + 25) {
      const slot = upper - A_CODE;
      counts[slot] = (counts[slot] ?? 0) + 1;
    }
  }
  return counts;
}

/** Total number of A-Z letters in `text`. */
export function letterTotal(text: string): number {
  return letterCounts(text).reduce((sum, n) => sum + n, 0);
}

/**
 * Pearson's chi-squared statistic for how badly `text` fits English letter
 * frequencies. **Lower is a better fit**, and zero would be a perfect one.
 *
 *     chi2 = sum over letters of (observed - expected)^2 / expected
 *
 * where `expected` is the letter's English share of however many letters the text
 * actually has. That normalisation is what lets a 40-letter sample and a
 * 400-letter sample be compared against their own alternatives — but not against
 * each other, since the statistic grows with sample size.
 *
 * Returns `Infinity` for text with no letters at all: no evidence is not a good
 * fit, and ranking it first would be a lie.
 */
export function chiSquaredEnglish(text: string): number {
  const counts = letterCounts(text);
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total === 0) return Infinity;

  let chi2 = 0;
  for (let i = 0; i < 26; i += 1) {
    const expected = (ENGLISH_LETTER_FREQUENCY[i] ?? 0) * 0.01 * total;
    const observed = counts[i] ?? 0;
    const delta = observed - expected;
    chi2 += (delta * delta) / expected;
  }
  return chi2;
}
