/**
 * Breaking Caesar.
 *
 * There are only 25 possible keys, so there is no cleverness here — try all of
 * them and let a statistic pick the winner. The cipher is not broken by a flaw
 * in the algorithm; it is broken by the size of its key space, which is the
 * point worth taking away.
 *
 * Plain TypeScript, no React.
 */
import type { AttackCandidate } from '../../../types';
import { chiSquaredEnglish } from '../../../../lib/frequency';
import { ALPHABET_SIZE, caesar } from './caesar';

/**
 * Decrypts with every shift from 1 to 25 and ranks the results by how closely
 * their letter distribution matches English. Lowest chi-squared first.
 *
 * Shift 0 is left out on purpose: it is the identity, so it is not a key.
 *
 * The ranking is only as good as the sample. On a full sentence the real key is
 * almost always first; on five letters it often is not, and watching that happen
 * teaches more about frequency analysis than a paragraph of prose could.
 */
export function bruteForceCaesar(ciphertext: string): AttackCandidate[] {
  const candidates: AttackCandidate[] = [];

  for (let shift = 1; shift < ALPHABET_SIZE; shift += 1) {
    const plaintext = caesar(ciphertext, shift, 'decrypt');
    candidates.push({
      key: { shift },
      plaintext,
      score: chiSquaredEnglish(plaintext),
      label: `Shift ${shift}`,
    });
  }

  // Array.prototype.sort is stable, so equal scores keep ascending shift order
  // and the ranking is the same on every run.
  return candidates.sort((a, b) => a.score - b.score);
}
