/**
 * Breaking Beaufort.
 *
 * There is almost nothing new here, and that is the finding. Beaufort changes
 * Vigenere's arithmetic from addition to subtraction, which changes what a key
 * letter *does* and changes nothing at all about the shape of the problem: the
 * key still repeats, so every `n`th letter is still enciphered the same way, so
 * the ciphertext still falls apart into `n` independent one-letter puzzles.
 *
 * This file therefore imports the period-finding straight out of the Vigenere
 * attack rather than copying it. That import is the argument: if a cipher can be
 * attacked by literally the same code, the change did not buy security. What
 * differs is one line — where Vigenere solves each column by trying every shift
 * `k` and testing `c - k`, Beaufort tries every `k` and tests `k - c` — and that
 * line is `solveColumn` below.
 *
 * Beaufort's self-reciprocity is genuinely useful in the field and worth nothing
 * to an attacker. Convenience and secrecy are different axes.
 *
 * **Two statistics, doing two different jobs.** A single column carries no word
 * structure at all, so chi-squared — which counts letters — is the right tool for
 * solving a column. Ranking whole candidate keys against each other is a
 * different question, and chi-squared is actively bad at it: a key of length 16
 * has four times the freedom of the true key of length 4, so it can bend the
 * letter counts closer to English while producing text that is not English.
 * Measured on this cipher's own test paragraph, the true key NAVY scored 47.5 and
 * a wrong sixteen-letter key scored 28.7, and chi-squared preferred the wrong one.
 *
 * Counting *pairs* does not overfit that way, because a key that is wrong in the
 * middle manufactures adjacencies English never writes. So the columns are solved
 * by chi-squared and the candidates are ranked by bigram fit. Same rule the
 * transpositions follow: the statistic depends on what is being distinguished.
 *
 * Plain TypeScript, no React.
 */
import type { AttackCandidate } from '../../../types';
import { bigramScore } from '../../../../lib/bigrams';
import { chiSquaredEnglish } from '../../../../lib/frequency';
import { A_TO_Z, ALPHABET_SIZE, normalise } from '../../../../lib/letters';
import { candidateKeyLengths, column, lettersOnly, shortestPeriod } from '../vigenere/attack';
import { beaufort } from './beaufort';

/** How many candidate keys the panel is offered. */
export const MAX_CANDIDATES = 6;

/**
 * The single key letter that makes this column look most like English.
 *
 * A column is every `length`th letter, all of which met the same key letter. Try
 * all 26, decrypt with `k - c`, and keep the best chi-squared. This is the one
 * function that differs from the Vigenere attack.
 */
export function solveColumn(letters: string): number {
  let best = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let k = 0; k < ALPHABET_SIZE; k += 1) {
    let decrypted = '';
    for (const char of letters) {
      decrypted += A_TO_Z.charAt(normalise(k - (char.charCodeAt(0) - 65)));
    }
    const score = chiSquaredEnglish(decrypted);
    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  }

  return best;
}

/** The whole key for an assumed length, one column at a time. */
export function solveKey(letters: string, length: number): string {
  let key = '';
  for (let offset = 0; offset < length; offset += 1) {
    key += A_TO_Z.charAt(solveColumn(column(letters, offset, length)));
  }
  return key;
}

/**
 * Candidate keys, best fit first.
 *
 * `score` is the negated bigram fit, because `AttackCandidate.score` is
 * lower-is-better across the whole app and bigram fit is higher-is-better. The
 * negation happens here, at the boundary, so `AttackPanel` needs to know nothing.
 */
export function breakBeaufort(ciphertext: string): AttackCandidate[] {
  const letters = lettersOnly(ciphertext);
  if (letters.length === 0) return [];

  const seen = new Set<string>();
  const candidates: AttackCandidate[] = [];

  for (const length of candidateKeyLengths(letters)) {
    // NAVYNAVY and NAVY produce the same plaintext, so the long one is an
    // artefact of the search rather than a second answer.
    const key = shortestPeriod(solveKey(letters, length));
    if (seen.has(key)) continue;
    seen.add(key);

    const plaintext = beaufort(ciphertext, key);
    candidates.push({
      key: { key },
      plaintext,
      score: -bigramScore(plaintext),
      label: `Key "${key}" (length ${key.length})`,
    });
  }

  return candidates.sort((a, b) => a.score - b.score).slice(0, MAX_CANDIDATES);
}
