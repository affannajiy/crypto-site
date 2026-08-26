/**
 * Breaking Affine.
 *
 * Twelve valid multipliers times 26 shifts is 312 keys. That is a bigger key
 * space than Caesar's 25 and it is still nothing — the Attack tab tries every
 * one of them and ranks the results, in about the time it takes to release the
 * mouse button.
 *
 * The cipher is a monoalphabetic substitution, so the same statistic that breaks
 * Caesar works unchanged: every A becomes the same letter throughout, and the
 * letter frequencies simply get shuffled rather than flattened.
 *
 * Plain TypeScript, no React.
 */
import type { AttackCandidate } from '../../../types';
import { chiSquaredEnglish } from '../../../../lib/frequency';
import { ALPHABET_SIZE, VALID_MULTIPLIERS, affine } from './affine';

/**
 * Decrypts with every valid key and ranks the results by how closely their letter
 * distribution matches English. Lowest chi-squared first.
 *
 * The identity key (a = 1, b = 0) is included rather than skipped. Unlike
 * Caesar's shift 0, it is a reachable setting of a two-part key rather than a
 * degenerate non-key, and leaving it out would hide a real answer if someone
 * genuinely enciphered with it.
 *
 * The ranking is only as good as the sample. On a full sentence the real key is
 * almost always first; on a handful of letters it often is not, and watching that
 * happen teaches more about frequency analysis than a paragraph of prose could.
 */
export function breakAffine(ciphertext: string): AttackCandidate[] {
  const candidates: AttackCandidate[] = [];

  for (const a of VALID_MULTIPLIERS) {
    for (let b = 0; b < ALPHABET_SIZE; b += 1) {
      const plaintext = affine(ciphertext, a, b, 'decrypt');
      candidates.push({
        key: { a, b },
        plaintext,
        score: chiSquaredEnglish(plaintext),
        label: `a = ${a}, b = ${b}`,
      });
    }
  }

  // Array.prototype.sort is stable, so equal scores keep the order the loops
  // produced and the ranking is the same on every run.
  return candidates.sort((x, y) => x.score - y.score);
}
