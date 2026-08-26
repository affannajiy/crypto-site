/**
 * Breaking Vigenere.
 *
 * Caesar falls to brute force because there are 25 keys. Vigenere with a key of
 * length 8 has 26^8 keys — about 209 billion — so brute force is finished as an
 * idea. The cipher falls anyway, and not because of a flaw in its arithmetic.
 *
 * It falls because the key repeats. Every 8th letter of the ciphertext was
 * enciphered with the same key letter, so those letters are a plain Caesar
 * cipher. Find the period and the message collapses into a handful of Caesars,
 * each of which is broken by counting letters.
 *
 * Two ways to find the period are implemented here, because they are the two
 * ideas worth teaching:
 *
 *   1. **Kasiski examination** (1863). A repeated word enciphered at the same key
 *      position produces the same ciphertext twice. The distance between those
 *      repeats is a multiple of the key length, so common divisors of many such
 *      distances are good guesses.
 *   2. **Index of coincidence** (Friedman, 1922). The chance that two letters
 *      drawn at random from a text are the same is about 0.067 for English and
 *      0.038 for random letters. Slice the ciphertext into `n` columns; when `n`
 *      is the true key length, each column is English-shaped and the average
 *      index jumps.
 *
 * Plain TypeScript, no React.
 */
import type { AttackCandidate } from '../../types';
import { chiSquaredEnglish, letterCounts } from '../../../lib/frequency';
import { ALPHABET_SIZE, vigenere } from './vigenere';

/**
 * Longest key length the attack will consider.
 *
 * Not a limit of the method — a limit of the evidence. Each extra letter of key
 * divides the ciphertext into one more column, and a column of four letters
 * cannot be attacked by frequency analysis at all. Past about 16 the ranking is
 * guessing, and guessing presented as an answer is worse than no answer.
 */
export const MAX_KEY_LENGTH = 16;

/** Letters need this many samples per column before a column's score means much. */
const MIN_SAMPLES_PER_COLUMN = 6;

/** Repeated substrings of this length are what Kasiski looks for. */
const KASISKI_GRAM = 3;

/** How many candidate lengths each method contributes. */
const CANDIDATES_PER_METHOD = 4;

/** A-Z only, uppercased. An attacker discards spacing; it carries no letter evidence. */
export function lettersOnly(text: string): string {
  return text.replace(/[^A-Za-z]/g, '').toUpperCase();
}

/**
 * Index of coincidence: the probability that two letters picked at random from
 * `text` (without replacement) are the same letter.
 *
 *     IC = sum over letters of n(n-1) / N(N-1)
 *
 * About 0.067 for English, about 0.038 for uniformly random letters. Returns 0
 * for fewer than two letters, where the quantity is undefined and any other
 * answer would be an invention.
 */
export function indexOfCoincidence(text: string): number {
  const counts = letterCounts(text);
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total < 2) return 0;

  let numerator = 0;
  for (const n of counts) numerator += n * (n - 1);
  return numerator / (total * (total - 1));
}

/** Every `length`th letter, starting at `offset`. One column is one Caesar cipher. */
export function column(letters: string, offset: number, length: number): string {
  let out = '';
  for (let i = offset; i < letters.length; i += length) out += letters.charAt(i);
  return out;
}

/**
 * Average index of coincidence across the columns a key of `length` would create.
 * The true key length, and its multiples, score near the English value.
 */
export function averageColumnIC(letters: string, length: number): number {
  let total = 0;
  for (let offset = 0; offset < length; offset += 1) {
    total += indexOfCoincidence(column(letters, offset, length));
  }
  return total / length;
}

/**
 * Kasiski examination: how much evidence each key length gets from repeated
 * trigrams. Returns a vote count per length, index 0 unused.
 *
 * A repeat can be coincidence, so no single distance is trusted. Divisors that
 * many distances agree on are.
 */
export function kasiskiVotes(letters: string, maxLength: number = MAX_KEY_LENGTH): number[] {
  const seen = new Map<string, number[]>();
  for (let i = 0; i + KASISKI_GRAM <= letters.length; i += 1) {
    const gram = letters.slice(i, i + KASISKI_GRAM);
    const positions = seen.get(gram);
    if (positions === undefined) seen.set(gram, [i]);
    else positions.push(i);
  }

  const votes = new Array<number>(maxLength + 1).fill(0);
  for (const positions of seen.values()) {
    if (positions.length < 2) continue;
    for (let a = 0; a < positions.length - 1; a += 1) {
      for (let b = a + 1; b < positions.length; b += 1) {
        const distance = (positions[b] ?? 0) - (positions[a] ?? 0);
        for (let length = 2; length <= maxLength; length += 1) {
          if (distance % length === 0) votes[length] = (votes[length] ?? 0) + 1;
        }
      }
    }
  }
  return votes;
}

/**
 * The key lengths worth trying, drawn from both methods.
 *
 * Deliberately a union rather than a single winner. The two methods fail in
 * different places — Kasiski needs repeated words, the index of coincidence needs
 * volume — and trying half a dozen lengths costs nothing next to being wrong.
 */
export function candidateKeyLengths(letters: string): number[] {
  const usable = Math.min(MAX_KEY_LENGTH, Math.floor(letters.length / MIN_SAMPLES_PER_COLUMN));
  if (usable < 1) return letters.length > 0 ? [1] : [];

  const lengths: number[] = [];
  for (let length = 1; length <= usable; length += 1) lengths.push(length);

  const byIC = [...lengths].sort((a, b) => averageColumnIC(letters, b) - averageColumnIC(letters, a));

  const votes = kasiskiVotes(letters, usable);
  // Shorter length wins a tie: 4 and 8 both divide every distance a key of 4
  // produces, and the shorter one is the honest answer.
  const byKasiski = [...lengths].sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0) || a - b);

  const chosen = new Set<number>([
    ...byIC.slice(0, CANDIDATES_PER_METHOD),
    ...byKasiski.slice(0, CANDIDATES_PER_METHOD),
  ]);
  return [...chosen].sort((a, b) => a - b);
}

/**
 * Given a key length, recovers the key one column at a time. Each column was
 * enciphered with a single Caesar shift, so each column is solved by trying all
 * 26 shifts and keeping the one whose letters look most like English.
 */
export function solveKey(letters: string, length: number): string {
  let key = '';
  for (let offset = 0; offset < length; offset += 1) {
    const slice = column(letters, offset, length);
    let bestShift = 0;
    let bestScore = Infinity;
    for (let shift = 0; shift < ALPHABET_SIZE; shift += 1) {
      const score = chiSquaredEnglish(shiftLetters(slice, ALPHABET_SIZE - shift));
      if (score < bestScore) {
        bestScore = score;
        bestShift = shift;
      }
    }
    key += String.fromCharCode(65 + bestShift);
  }
  return key;
}

/** Caesar over a string already reduced to uppercase A-Z. Local to the attack. */
function shiftLetters(letters: string, shift: number): string {
  let out = '';
  const effective = ((shift % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE;
  for (let i = 0; i < letters.length; i += 1) {
    out += String.fromCharCode(65 + ((letters.charCodeAt(i) - 65 + effective) % ALPHABET_SIZE));
  }
  return out;
}

/**
 * Reduces a key to its shortest repeating unit: LEMONLEMON is LEMON.
 *
 * A key length of 10 fits a real key of 5 perfectly, so the attack finds both and
 * would otherwise offer the same plaintext twice under two different keys. The
 * short one is the answer; the long one is an artefact of how the search works.
 */
export function shortestPeriod(key: string): string {
  for (let length = 1; length <= key.length; length += 1) {
    if (key.length % length !== 0) continue;
    const unit = key.slice(0, length);
    if (unit.repeat(key.length / length) === key) return unit;
  }
  return key;
}

/**
 * Recovers the key from ciphertext alone. Ranked by how closely the resulting
 * plaintext matches English letter frequencies, lowest chi-squared first.
 *
 * The ranking is only as good as the sample. On a paragraph the real key is
 * almost always first; on a short message the columns are too thin to score and
 * the answer is wrong, which is worth seeing happen.
 */
export function breakVigenere(ciphertext: string): AttackCandidate[] {
  const letters = lettersOnly(ciphertext);
  if (letters.length === 0) return [];

  const candidates: AttackCandidate[] = [];
  const seenKeys = new Set<string>();

  for (const length of candidateKeyLengths(letters)) {
    const key = shortestPeriod(solveKey(letters, length));
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const plaintext = vigenere(ciphertext, key, 'decrypt');
    candidates.push({
      key: { key },
      plaintext,
      score: chiSquaredEnglish(plaintext),
      label: `Key "${key}" (length ${key.length})`,
    });
  }

  // Array.prototype.sort is stable, so equal scores keep ascending key length
  // order and the ranking is the same on every run.
  return candidates.sort((a, b) => a.score - b.score);
}
