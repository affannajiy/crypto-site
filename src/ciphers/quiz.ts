/**
 * Runs and marks the lecture quizzes. React-free, so tests and the panel share it.
 *
 * A computed quiz's answer is the cipher's own output. The slides are not the
 * answer key, because the slides have slips.
 */
import { cipherCanRandomise, defaultParams, randomKeyFor, textStartParams } from './params';
import type { CipherModule, LectureQuiz } from './types';

/** The answer to a quiz: the cipher's output for a computed one, the prose for a recall one. */
export async function quizAnswer(cipher: CipherModule, quiz: LectureQuiz): Promise<string> {
  if (quiz.run === undefined) return quiz.answer ?? '';
  const params = { ...defaultParams(cipher.params), ...quiz.run.params };
  const decrypt = quiz.run.direction === 'decrypt' ? cipher.decrypt : undefined;
  const result = await (decrypt !== undefined
    ? decrypt(quiz.run.input, params)
    : cipher.encrypt(quiz.run.input, params));
  return result.output;
}

/**
 * Case, spaces and punctuation do not count. The slides write the rail fence
 * answer in capitals and the row transposition answer in groups of four, and a
 * student who writes either way has the same answer.
 */
export function sameAnswer(given: string, expected: string): boolean {
  const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return squash(given) !== '' && squash(given) === squash(expected);
}

/** Plaintexts for practice questions: short, letters only, so every cipher takes them. */
const PRACTICE_WORDS = [
  'ATTACK', 'RETREAT', 'SECRET', 'MEETME', 'HELLO', 'CIPHER', 'BRIDGE', 'MIDNIGHT',
  'SIGNAL', 'GARDEN', 'ORANGE', 'LECTURE', 'WINTER', 'HARBOUR', 'CASTLE', 'KEYRING',
];

function randomBelow(n: number): number {
  const scratch = new Uint32Array(1);
  crypto.getRandomValues(scratch);
  return (scratch[0] ?? 0) % n;
}

/** A Fisher-Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomBelow(i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Practice questions with a fresh message and a fresh key each time.
 *
 * These are not from the slides, so nothing is invented that could be wrong:
 * the key comes from the cipher's own randomiser, the message from a word
 * list, and the answer from the cipher. A decrypt question shows a ciphertext
 * that this cipher made from the word. A key that the cipher refuses is
 * thrown away and drawn again; after a few misses the textbook key is used.
 */
export async function practiceQuizzes(cipher: CipherModule, count: number): Promise<LectureQuiz[]> {
  const quizzes: LectureQuiz[] = [];
  // Distinct words, so one draw never asks the same message twice.
  for (const word of shuffled(PRACTICE_WORDS).slice(0, count)) {
    const decrypt = cipher.decrypt !== undefined && cipher.oneWay !== true && randomBelow(2) === 1;
    const quiz = await practiceQuiz(cipher, word, decrypt);
    if (quiz !== undefined) quizzes.push(quiz);
  }
  return quizzes;
}

async function practiceQuiz(cipher: CipherModule, word: string, decrypt: boolean): Promise<LectureQuiz | undefined> {
  const start = textStartParams(cipher);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    // The last try is the textbook key, which is known to read English.
    const params =
      attempt < 5 && cipherCanRandomise(cipher)
        ? { ...randomKeyFor(cipher, start), ...(cipher.textParams ?? {}) }
        : start;
    try {
      const encrypted = (await cipher.encrypt(word, params)).output;
      if (encrypted === '') continue;
      if (cipher.oneWay === true) {
        return { question: 'Practice: hash this.', run: { input: word, params } };
      }
      if (!decrypt) {
        return { question: 'Practice: encrypt this.', run: { input: word, params } };
      }
      return {
        question: 'Practice: decrypt this.',
        run: { input: encrypted, params, direction: 'decrypt' },
      };
    } catch {
      // This key does not fit the word. Draw another.
    }
  }
  return undefined;
}
