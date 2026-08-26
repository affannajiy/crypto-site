/**
 * Breaking Porta.
 *
 * The Vigenere attack applies again, and this time it is *cheaper* than against
 * Vigenere. The period-finding is imported unchanged. Solving each column is a
 * search over **thirteen** possibilities instead of twenty-six, because two key
 * letters select the same row and the two are indistinguishable from ciphertext.
 *
 * That is worth stating plainly: Porta's neatest design decision — halving the
 * table so it fits on one printed page — also halves the work of breaking it. A
 * key of eight letters gives 13^8 rather than 26^8, which is a factor of 256
 * given away for the sake of typesetting.
 *
 * Since A and B are equivalent, the recovered key is reported in a canonical
 * form using the even letter of each pair (A, C, E, ...). The panel would
 * otherwise print one of two equally correct keys at random, and a key the reader
 * cannot reproduce is not an answer.
 *
 * Ranked by bigram fit for the same reason as Beaufort: chi-squared rewards a long
 * key for having more freedom, which is overfitting rather than evidence.
 *
 * Plain TypeScript, no React.
 */
import type { AttackCandidate } from '../../../types';
import { bigramScore } from '../../../../lib/bigrams';
import { chiSquaredEnglish } from '../../../../lib/frequency';
import { A_TO_Z } from '../../../../lib/letters';
import { candidateKeyLengths, column, lettersOnly, shortestPeriod } from '../vigenere/attack';
import { ROWS, porta, portaLetter } from './porta';

/** How many candidate keys the panel is offered. */
export const MAX_CANDIDATES = 6;

/** The canonical key letter for a row: the even one of the pair. */
export function canonicalKeyLetter(row: number): string {
  return A_TO_Z.charAt(row * 2);
}

/**
 * The row that makes this column look most like English.
 *
 * Thirteen trials, not twenty-six. Porta is self-reciprocal, so "decrypting" a
 * column is applying the same row to it.
 */
export function solveColumn(letters: string): number {
  let best = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let row = 0; row < ROWS; row += 1) {
    let decrypted = '';
    for (const char of letters) {
      decrypted += A_TO_Z.charAt(portaLetter(char.charCodeAt(0) - 65, row));
    }
    const score = chiSquaredEnglish(decrypted);
    if (score < bestScore) {
      bestScore = score;
      best = row;
    }
  }

  return best;
}

/** The whole key for an assumed length, in canonical letters. */
export function solveKey(letters: string, length: number): string {
  let key = '';
  for (let offset = 0; offset < length; offset += 1) {
    key += canonicalKeyLetter(solveColumn(column(letters, offset, length)));
  }
  return key;
}

/**
 * Candidate keys, best fit first. `score` is the negated bigram fit, because
 * `AttackCandidate.score` is lower-is-better across the app.
 */
export function breakPorta(ciphertext: string): AttackCandidate[] {
  const letters = lettersOnly(ciphertext);
  if (letters.length === 0) return [];

  const seen = new Set<string>();
  const candidates: AttackCandidate[] = [];

  for (const length of candidateKeyLengths(letters)) {
    const key = shortestPeriod(solveKey(letters, length));
    if (seen.has(key)) continue;
    seen.add(key);

    const plaintext = porta(ciphertext, key);
    candidates.push({
      key: { key },
      plaintext,
      score: -bigramScore(plaintext),
      label: `Key "${key}" (length ${key.length})`,
    });
  }

  return candidates.sort((a, b) => a.score - b.score).slice(0, MAX_CANDIDATES);
}
