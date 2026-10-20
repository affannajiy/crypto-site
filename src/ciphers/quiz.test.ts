import { describe, expect, it } from 'vitest';
import { allCiphers, ciphers, validateRegistry } from './registry';
import { practiceQuizzes, quizAnswer, sameAnswer, shuffled } from './quiz';
import type { CipherModule, LectureQuiz } from './types';

const bySlug = (slug: string): CipherModule => {
  const cipher = allCiphers.find((c) => c.slug === slug);
  if (cipher === undefined) throw new Error(`no cipher ${slug}`);
  return cipher;
};

const quizOf = (slug: string, fragment: string): LectureQuiz => {
  const quiz = bySlug(slug).quizzes?.find((q) => q.question.includes(fragment));
  if (quiz === undefined) throw new Error(`no quiz '${fragment}' on ${slug}`);
  return quiz;
};

describe('lecture quizzes', () => {
  it('runs every quiz to a non-empty answer', async () => {
    for (const cipher of allCiphers) {
      for (const quiz of cipher.quizzes ?? []) {
        expect((await quizAnswer(cipher, quiz)).trim(), `${cipher.slug}: ${quiz.question}`).not.toBe('');
      }
    }
  });

  it('agrees with the slides where the slides give the answer', async () => {
    const answer = async (slug: string, fragment: string) =>
      (await quizAnswer(bySlug(slug), quizOf(slug, fragment))).toUpperCase();
    expect(await answer('rail-fence', 'depth 2')).toBe('MEMATRHTGPRYETEFETEOAAT');
    expect(await answer('vigenere', 'ATTACKATDAWN')).toBe('LXFOPVEFRNHR');
    expect(await answer('vigenere', 'deceptive')).toBe('ZICVTWQNGRZGVTWAVZHCQYGLMGJ');
    expect(await answer('feistel', 'Perform decryption')).toBe('10110110');
    expect(await answer('rsa', 'M = 31')).toBe('587');
    // The slide gives st -> TL, me -> CL and nt -> RQ for the second, fourth and fifth pairs.
    const playfair = (await answer('playfair', 'INSTRUMENTS')).replace(/\s+/g, '');
    expect(playfair.slice(2, 4)).toBe('TL');
    expect(playfair.slice(6, 8)).toBe('CL');
    expect(playfair.slice(8, 10)).toBe('RQ');
  });

  it('marks an answer without caring about case, spaces or punctuation', () => {
    expect(sameAnswer('ttna aptm', 'TTNAAPTM')).toBe(true);
    expect(sameAnswer('TTNA', 'TTNB')).toBe(false);
    expect(sameAnswer('   ', '')).toBe(false);
  });
});

describe('practice quizzes', () => {
  it('gives every shown cipher questions that run, and decrypts back to the ciphertext', async () => {
    for (const cipher of ciphers) {
      const quizzes = await practiceQuizzes(cipher, 6);
      expect(quizzes.length, cipher.slug).toBe(6);
      for (const quiz of quizzes) {
        const answer = await quizAnswer(cipher, quiz);
        expect(answer.trim(), `${cipher.slug}: ${quiz.question}`).not.toBe('');
        if (quiz.run?.direction === 'decrypt') {
          const params = quiz.run.params ?? {};
          expect((await cipher.encrypt(answer, params)).output, cipher.slug).toBe(quiz.run.input);
        }
      }
    }
  });

  it('shuffles without losing or adding anything', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect([...shuffled(items)].sort((a, b) => a - b)).toEqual(items);
  });
});

describe('quiz validation', () => {
  const base = bySlug('caesar');
  const withQuiz = (quiz: LectureQuiz) => [
    { path: './classical/substitution/caesar/index.ts', cipher: { ...base, quizzes: [quiz] } },
  ];

  it('rejects a quiz with both a run and an answer', () => {
    expect(() => validateRegistry(withQuiz({ question: 'Q', run: { input: 'a' }, answer: 'b' }))).toThrow(
      /exactly one of run and answer/,
    );
  });

  it('rejects a quiz with neither', () => {
    expect(() => validateRegistry(withQuiz({ question: 'Q' }))).toThrow(/exactly one of run and answer/);
  });

  it('rejects a quiz that sets a param the cipher does not have', () => {
    expect(() => validateRegistry(withQuiz({ question: 'Q', run: { input: 'a', params: { shft: 3 } } }))).toThrow(
      /does not have/,
    );
  });
});
