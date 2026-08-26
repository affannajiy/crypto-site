/**
 * Scoring text by its letter *pairs* rather than its letters.
 *
 * `chiSquaredEnglish` in `frequency.ts` breaks substitution ciphers, and it is
 * completely powerless against a transposition. Rail Fence does not replace a
 * single letter — it only moves them around — so the ciphertext has exactly the
 * same letter counts as the plaintext, and every candidate decryption scores
 * identically. Frequency analysis has nothing to say.
 *
 * What a transposition does destroy is *adjacency*. English is full of TH, HE,
 * IN, ER; it has almost no QZ or JX. Scrambling the order manufactures pairs
 * that English would never write, so counting pairs distinguishes the right
 * arrangement from the wrong ones where counting letters cannot.
 *
 * Plain TypeScript. No React, no DOM.
 *
 * **On the table below.** These are approximate relative weights for the most
 * common English bigrams, in the standard published ordering. They are not an
 * extract from a named corpus, and they are not precise enough to cite. They are
 * good enough for what this file is for: ranking a handful of candidate
 * decryptions against each other. Where an attack depends on them, the panel says
 * the ranking is a heuristic.
 */

/** Approximate occurrences per 1000 bigrams of English text. */
const COMMON_BIGRAMS: Record<string, number> = {
  TH: 27, HE: 23, IN: 20, ER: 17, AN: 16, RE: 14, ON: 13, AT: 12, EN: 12, ND: 12,
  TI: 11, ES: 11, OR: 11, TE: 11, OF: 10, ED: 10, IS: 10, IT: 10, AL: 10, AR: 10,
  ST: 10, TO: 9, NT: 9, NG: 9, SE: 9, HA: 9, AS: 9, OU: 9, IO: 8, LE: 8,
  VE: 8, CO: 8, ME: 8, DE: 8, HI: 8, RI: 7, RO: 7, IC: 7, NE: 7, EA: 7,
  RA: 7, CE: 7, LI: 7, CH: 6, LL: 6, BE: 6, MA: 6, SI: 6, OM: 6, UR: 6,
  CA: 6, EL: 6, TA: 6, LA: 6, NS: 6, DI: 5, FO: 5, HO: 5, PE: 5, EC: 5,
  PR: 5, NO: 5, CT: 5, US: 5, AC: 5, IL: 5, OT: 5, NA: 5, UT: 5, WI: 5,
  OW: 4, WA: 4, WH: 4, EE: 4, SO: 4, MO: 4, PA: 4, AI: 4, SH: 4, UN: 4,
  IR: 4, TR: 4, SS: 4, OO: 4, GH: 3, AB: 3, PO: 3, IE: 3, EV: 3, LO: 3,
  OS: 3, UL: 3, AD: 3, MI: 3, GE: 3, EM: 3, PL: 3, SU: 3, EP: 3, AM: 3,
};

/**
 * Weight given to a pair that is not in the table. Not zero: an unlisted pair is
 * rare, not impossible, and a zero would let a single odd pair veto an otherwise
 * excellent answer. Real English text is full of legitimate rare pairs.
 */
const FLOOR = 0.15;

/** Total weight, so the table can be read as probabilities. */
const TOTAL = Object.values(COMMON_BIGRAMS).reduce((sum, n) => sum + n, 0);

/** A-Z only, uppercased. Spacing carries no adjacency evidence an attacker trusts. */
export function lettersOnly(text: string): string {
  return text.replace(/[^A-Za-z]/g, '').toUpperCase();
}

/**
 * How English-looking the letter pairs in `text` are. **Higher is better**, which
 * is the opposite of `chiSquaredEnglish` — worth knowing before comparing them.
 *
 * The score is the mean log-probability of each adjacent pair. Logs rather than a
 * product because a few hundred probabilities multiplied together underflow to
 * zero; a mean rather than a sum so that texts of different lengths can be
 * compared, which matters because the attack ranks whole candidate plaintexts.
 *
 * Returns `-Infinity` for text with under two letters: no evidence is not a good
 * score, and ranking it highly would be a lie.
 */
export function bigramScore(text: string): number {
  const letters = lettersOnly(text);
  if (letters.length < 2) return -Infinity;

  let total = 0;
  for (let i = 0; i + 1 < letters.length; i += 1) {
    const pair = letters.slice(i, i + 2);
    const weight = COMMON_BIGRAMS[pair] ?? FLOOR;
    total += Math.log(weight / TOTAL);
  }
  return total / (letters.length - 1);
}
