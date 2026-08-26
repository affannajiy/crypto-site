/**
 * Breaking Rail Fence.
 *
 * The key space is a joke — the rail count is a small whole number, and this
 * tries every one of them. That part is Caesar all over again.
 *
 * What is genuinely different is the scoring, and it is the reason this cipher is
 * in the app. The attack on Caesar and the attack on Vigenere both end in
 * `chiSquaredEnglish`, counting letters. **That statistic is exactly zero use
 * here.** Rail Fence never replaces a letter, so every candidate decryption has
 * identical letter counts, and chi-squared returns the same number for all of
 * them. A tool that reached for it would rank the answers in an arbitrary order
 * and look confident doing it.
 *
 * So this attack counts adjacent *pairs* instead. Transposition scrambles which
 * letters sit next to which, and English is very particular about that.
 *
 * Plain TypeScript, no React.
 */
import type { AttackCandidate } from '../../../types';
import { bigramScore } from '../../../../lib/bigrams';
import { MAX_RAILS, MIN_RAILS, railFence } from './railfence';

/**
 * Tries every rail count and ranks the results by how English their letter pairs
 * look.
 *
 * `AttackCandidate.score` is defined as lower-is-better across the app, and
 * `bigramScore` is higher-is-better, so it is negated here. That is the whole
 * adaptation; the panel's ranking needs no knowledge of which statistic ran.
 *
 * One rail is left out for the same reason shift 0 is left out of Caesar: it is
 * the identity, so it is not a key. Rail counts at or above the message length
 * are also skipped — the zigzag never reaches the bottom rail, so they duplicate
 * shorter counts and would offer the same plaintext twice.
 */
export function breakRailFence(ciphertext: string): AttackCandidate[] {
  const candidates: AttackCandidate[] = [];
  const seen = new Set<string>();

  for (let rails = MIN_RAILS; rails <= MAX_RAILS; rails += 1) {
    const plaintext = railFence(ciphertext, rails, 'decrypt');
    if (seen.has(plaintext)) continue;
    seen.add(plaintext);

    candidates.push({
      key: { rails },
      plaintext,
      score: -bigramScore(plaintext),
      label: `${rails} rails`,
    });
  }

  // Array.prototype.sort is stable, so equal scores keep ascending rail order and
  // the ranking is the same on every run.
  return candidates.sort((a, b) => a.score - b.score);
}
