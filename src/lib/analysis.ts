/**
 * Statistics you run on a ciphertext before you know what it is.
 *
 * Plain TypeScript, like everything else that has to be testable without a DOM.
 * Nothing here breaks a cipher; these are the measurements that tell you *which*
 * cipher to try, which is the step the Attack tabs skip because they already
 * know the answer.
 */
import { ENGLISH_LETTER_FREQUENCY, letterCounts, letterTotal } from './frequency';

/** English text, measured the same way. Used as the reference line. */
export const ENGLISH_IOC = 0.0667;
/** Text with every letter equally likely: 1/26. */
export const RANDOM_IOC = 1 / 26;

/**
 * The index of coincidence: the chance that two letters drawn at random from the
 * text are the same letter.
 *
 *     IC = sum over letters of n(n - 1) / (N(N - 1))
 *
 * It is the single most useful number in classical cryptanalysis, because it
 * survives substitution. Renaming every letter does not change how often letters
 * repeat, so English enciphered with Caesar, Atbash or any monoalphabetic
 * substitution still measures about 0.067 — while Vigenere with a long keyword
 * pulls it towards 0.038, because several alphabets in rotation flatten the
 * repeats. That gap is what tells you which family you are looking at.
 *
 * Returns 0 for fewer than two letters: with no pairs to draw there is no
 * evidence, and inventing a number would be worse than admitting that.
 */
export function indexOfCoincidence(text: string): number {
  const counts = letterCounts(text);
  const total = letterTotal(text);
  if (total < 2) return 0;
  const coincidences = counts.reduce((sum, n) => sum + n * (n - 1), 0);
  return coincidences / (total * (total - 1));
}

export interface Ngram {
  gram: string;
  count: number;
}

/**
 * The commonest n-letter runs, longest-count first, ignoring everything that is
 * not a letter — so "the old" contributes "THEOLD", the way an attacker sees it
 * once spacing is stripped.
 */
export function topNgrams(text: string, n: number, limit = 8): Ngram[] {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '');
  const counts = new Map<string, number>();
  for (let i = 0; i + n <= letters.length; i += 1) {
    const gram = letters.slice(i, i + n);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([gram, count]) => ({ gram, count }));
}

/** Observed share of each letter, as a percentage. Parallel to the English table. */
export function letterPercentages(text: string): number[] {
  const counts = letterCounts(text);
  const total = letterTotal(text);
  if (total === 0) return counts.map(() => 0);
  return counts.map((n) => (n / total) * 100);
}

export interface Observation {
  /** What was noticed, in a few words. */
  claim: string;
  /** The measurement behind it, so the reader can disagree with the conclusion. */
  evidence: string;
}

const ADFGVX_LETTERS = new Set(['A', 'D', 'F', 'G', 'V', 'X']);

/**
 * What this text looks like — as observations, never as a verdict.
 *
 * Identification is inference, and the honest output of inference is the
 * evidence plus what it suggests. A page that printed "this is Vigenere" would
 * be teaching that cryptanalysis is a button, and it would be wrong often enough
 * to matter: a short Vigenere sample and a long Caesar sample can measure the
 * same. So every entry pairs a claim with the number it came from.
 */
export function observe(text: string): Observation[] {
  const notes: Observation[] = [];
  const total = letterTotal(text);
  const upper = text.toUpperCase();
  const distinct = new Set(upper.replace(/[^A-Z]/g, ''));

  if (/^[.\-\s/]+$/.test(text.trim()) && text.trim() !== '') {
    notes.push({
      claim: 'This is Morse, and Morse is not encryption.',
      evidence: 'Nothing here but dots, dashes and separators.',
    });
    return notes;
  }

  if (total === 0) {
    const digits = (text.match(/\d/g) ?? []).length;
    if (digits > 0) {
      notes.push({
        claim: 'Digits, not letters — a fractionating cipher or a code.',
        evidence: `${digits} digits and no letters. Nihilist and the Straddling Checkerboard both look like this.`,
      });
    }
    return notes;
  }

  if (distinct.size <= 6 && [...distinct].every((c) => ADFGVX_LETTERS.has(c))) {
    notes.push({
      claim: 'Only the letters A, D, F, G, V and X.',
      evidence: 'That alphabet was chosen because the six are unmistakable in Morse. This is ADFGVX.',
    });
  }

  const ic = indexOfCoincidence(text);
  const ratio = ic / ENGLISH_IOC;
  if (total < 40) {
    notes.push({
      claim: 'Too short to measure with any confidence.',
      evidence: `${total} letters. The index of coincidence needs a few hundred before it settles.`,
    });
  } else if (ratio > 0.85) {
    notes.push({
      claim: 'One alphabet: a substitution, or a transposition.',
      evidence: `Index of coincidence ${ic.toFixed(4)}, against ${ENGLISH_IOC} for English. Letters repeat as often as they do in English, so each plaintext letter still maps to one ciphertext letter — or none of them were replaced at all.`,
    });
  } else if (ratio < 0.72) {
    notes.push({
      claim: 'Several alphabets: polyalphabetic, or fractionated.',
      evidence: `Index of coincidence ${ic.toFixed(4)}, against ${ENGLISH_IOC} for English and ${RANDOM_IOC.toFixed(4)} for random letters. The repeats have been flattened, which is what a rotating key does.`,
    });
  } else {
    notes.push({
      claim: 'Between the two, so the measurement does not decide it.',
      evidence: `Index of coincidence ${ic.toFixed(4)}, between English (${ENGLISH_IOC}) and random (${RANDOM_IOC.toFixed(4)}). A short sample, or a short keyword.`,
    });
  }

  // A transposition keeps the letter counts of the plaintext exactly, so English
  // frequencies with no readable English is the signature worth naming.
  const percentages = letterPercentages(text);
  const drift = percentages.reduce(
    (worst, share, i) => Math.max(worst, Math.abs(share - (ENGLISH_LETTER_FREQUENCY[i] ?? 0))),
    0,
  );
  // 3.5 points, because a real English sample of a few hundred letters drifts
  // about three from the table on its own, while a substitution moves E by ten
  // or more — the gap between those two is wide enough not to need tuning.
  if (ratio > 0.85 && drift < 3.5 && total >= 40) {
    notes.push({
      claim: 'The letter counts are English. Only the order changed.',
      evidence: `No letter is more than ${drift.toFixed(1)} points away from its English share. A substitution would move E somewhere else; a transposition cannot, because it never replaces a letter.`,
    });
  }

  if (distinct.size > 0 && distinct.size < 20 && total >= 40) {
    notes.push({
      claim: `Only ${distinct.size} of the 26 letters appear.`,
      evidence: 'A cipher built on a 5x5 square drops one letter, usually J. Fewer than twenty suggests a smaller alphabet still.',
    });
  }

  return notes;
}
