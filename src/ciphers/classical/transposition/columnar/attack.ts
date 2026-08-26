/**
 * Breaking columnar transposition.
 *
 * Rail Fence has nine keys and this app tries all nine. Columnar has a *factorial*
 * key space — one order for every arrangement of the columns — and that changes
 * the character of the attack rather than just its size:
 *
 *     3 columns:        6 orders
 *     5 columns:      120 orders
 *     7 columns:    5,040 orders
 *     9 columns:  362,880 orders
 *    12 columns:  479,001,600 orders
 *
 * So this attack stops at `MAX_ATTACK_WIDTH` and **says so in the panel** rather
 * than quietly failing on longer keys. A tool that returns nothing and does not
 * explain why teaches the wrong lesson: the cipher did not resist you, the search
 * gave up. Where the real break comes from is multiple messages of the same
 * length in the same key, which is in the explainer.
 *
 * Scoring is by bigram fit, not chi-squared, for the reason Rail Fence
 * established: a transposition never replaces a letter, so every candidate has
 * identical letter counts and chi-squared cannot tell them apart. What a
 * transposition destroys is adjacency, so adjacency is what gets measured.
 *
 * Plain TypeScript, no React.
 */
import type { AttackCandidate } from '../../../types';
import { bigramScore } from '../../../../lib/bigrams';
import { columnar } from './columnar';

/**
 * The widest key this search will try. Seven columns is 5040 orders, which runs
 * in well under a second; eight is 40,320 and starts to block the page.
 */
export const MAX_ATTACK_WIDTH = 7;

const MIN_WIDTH = 2;
const RESULTS = 12;

/** Every arrangement of 0..n-1, in a fixed order so the ranking is reproducible. */
export function permutations(n: number): number[][] {
  if (n <= 1) return [[0]];
  const out: number[][] = [];
  const used = new Array<boolean>(n).fill(false);
  const current: number[] = [];

  const walk = () => {
    if (current.length === n) {
      out.push(current.slice());
      return;
    }
    for (let i = 0; i < n; i += 1) {
      if (used[i] === true) continue;
      used[i] = true;
      current.push(i);
      walk();
      current.pop();
      used[i] = false;
    }
  };

  walk();
  return out;
}

/**
 * Turns a reading order back into a keyword that produces it.
 *
 * The attack searches over column *orders*, but the cipher takes a *keyword*, and
 * the panel's "use this key" button has to hand back something the Encrypt tab
 * accepts. Any keyword with the right alphabetical ranking works, so this builds
 * the canonical one: the column read first is headed A, the next B, and so on.
 * It will not be the keyword the sender used — it produces the same permutation,
 * which is all the cipher ever knew about.
 */
export function keywordForOrder(order: number[]): string {
  const letters = new Array<string>(order.length).fill('A');
  order.forEach((column, position) => {
    letters[column] = String.fromCharCode(65 + position);
  });
  return letters.join('');
}

/**
 * Tries every column order for every width up to `MAX_ATTACK_WIDTH`, and ranks
 * the results by how much they look like English adjacency.
 *
 * `AttackCandidate.score` is lower-is-better everywhere in this app, and
 * `bigramScore` is higher-is-better, so it is negated here at the boundary. The
 * panel needs to know nothing about that.
 */
export function breakColumnar(ciphertext: string): AttackCandidate[] {
  const candidates: AttackCandidate[] = [];
  const seen = new Set<string>();

  for (let width = MIN_WIDTH; width <= MAX_ATTACK_WIDTH; width += 1) {
    // A key longer than the message cannot be distinguished from a shorter one,
    // and the grid would have empty columns.
    if (width > ciphertext.length) break;

    for (const order of permutations(width)) {
      const keyword = keywordForOrder(order);
      const plaintext = columnar(ciphertext, keyword, 'decrypt');
      if (seen.has(plaintext)) continue;
      seen.add(plaintext);

      candidates.push({
        key: { keyword },
        plaintext,
        score: -bigramScore(plaintext),
        label: `${width} columns, order ${order.map((c) => c + 1).join('-')}`,
      });
    }
  }

  // Array.prototype.sort is stable, so equal scores keep width-then-order and the
  // ranking is identical on every run.
  return candidates.sort((a, b) => a.score - b.score).slice(0, RESULTS);
}
