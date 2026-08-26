/**
 * Breaking autokey.
 *
 * Everything the Vigenere attack relies on is gone. The keystream never repeats,
 * so there are no columns, no index of coincidence to compute per column, and no
 * Kasiski distances to take common divisors of. The attack in the next folder over
 * cannot be imported here, and that is a real improvement rather than a cosmetic
 * one.
 *
 * What remains is that **the keyword is short**. Guess it and everything else
 * follows deterministically: key letter `m + i` is plaintext letter `i`, which the
 * guess has already produced. So a wrong guess does not decrypt "most of" the
 * message — it produces garbage from the first letter onward, which makes the
 * right guess extremely easy to recognise.
 *
 * So this is a brute force, and it is **capped at `MAX_KEYWORD` letters**. Three
 * letters is 26³ = 17,576 trial decryptions and runs instantly; four would be
 * 456,976 and would lock the page up for seconds. The cap is stated on the page as
 * well as here, because an attack that quietly gives up teaches that the cipher
 * resisted when in fact the search stopped.
 *
 * Ranked by **bigram fit**, not chi-squared. A wrong autokey guess produces text
 * whose letters are a sum of two English letters, and sums of English letters have
 * a lumpy distribution that chi-squared can score misleadingly well. Adjacent
 * pairs are far harder to fake.
 *
 * Plain TypeScript, no React.
 */
import type { AttackCandidate } from '../../../types';
import { bigramScore } from '../../../../lib/bigrams';
import { A_TO_Z, ALPHABET_SIZE } from '../../../../lib/letters';
import { autokey } from './autokey';

/** Keywords longer than this are not searched. 26³ is instant; 26⁴ is not. */
export const MAX_KEYWORD = 3;

/** How many candidates the panel is offered. */
export const MAX_CANDIDATES = 6;

/**
 * Only this many letters of each trial decryption are scored.
 *
 * Not a corner cut. A wrong autokey guess poisons the keystream at the first
 * letter and never recovers, so the opening is where every candidate is decided —
 * scoring letter 900 tells you nothing that letter 9 did not. It makes the search
 * bounded by the key space rather than by the message length, which is what keeps
 * 17,576 trials feeling instant on a long paragraph.
 */
export const SCORE_PREFIX = 160;

/** Every keyword of exactly `length` letters, in alphabetical order. */
export function keywordsOfLength(length: number): string[] {
  if (length <= 0) return [''];
  const shorter = keywordsOfLength(length - 1);
  const out: string[] = [];
  for (const prefix of shorter) {
    for (const letter of A_TO_Z) out.push(prefix + letter);
  }
  return out;
}

/** How many trial decryptions a search up to `max` letters costs. */
export function searchSize(max: number): number {
  let total = 0;
  for (let n = 1; n <= max; n += 1) total += ALPHABET_SIZE ** n;
  return total;
}

/**
 * Candidate keywords, best fit first.
 *
 * `score` is the negated bigram fit, because `AttackCandidate.score` is
 * lower-is-better across the app and bigram fit is higher-is-better.
 */
export function breakAutokey(ciphertext: string, max: number = MAX_KEYWORD): AttackCandidate[] {
  if (ciphertext.replace(/[^A-Za-z]/g, '') === '') return [];

  const candidates: AttackCandidate[] = [];

  for (let length = 1; length <= max; length += 1) {
    for (const keyword of keywordsOfLength(length)) {
      const plaintext = autokey(ciphertext, keyword, 'decrypt');
      candidates.push({
        key: { keyword },
        plaintext,
        score: -bigramScore(plaintext.slice(0, SCORE_PREFIX)),
        label: `Keyword "${keyword}"`,
      });
    }
  }

  return candidates.sort((a, b) => a.score - b.score).slice(0, MAX_CANDIDATES);
}
