import { useCallback, useEffect, useId, useState } from 'react';
import { practiceQuizzes, quizAnswer, sameAnswer, shuffled } from '../ciphers/quiz';
import type { CipherModule, LectureQuiz, Params } from '../ciphers/types';

/**
 * The quizzes for one cipher, under its Visualize tab: the slide quizzes, if it
 * has any, and a few practice questions with a random message and key. The
 * order is shuffled, and "New questions" draws fresh practice ones.
 *
 * A computed quiz has an answer box and a Check button. The check runs the
 * cipher, so the answer on the page is the algorithm's and never a transcription.
 * A recall quiz has only a Show answer button, because a typed answer to "list
 * the design features" cannot be marked by string comparison.
 */

/** How many practice questions each draw adds. */
const PRACTICE_COUNT = 3;

/** The key of a run in one line, with a select's short label rather than its value. */
function describeKey(cipher: CipherModule, params: Params | undefined) {
  return Object.entries(params ?? {})
    .map(([name, value]) => {
      const spec = cipher.params.find((s) => s.name === name);
      const shown =
        spec?.kind === 'select'
          ? (spec.options.find((o) => o.value === value)?.label ?? String(value))
          : String(value);
      // Labels and option names carry help after a bracket or a dash. Drop it here.
      const label = (spec?.label ?? name).split(' (')[0];
      return `${label} = ${shown.split(' — ')[0]}`;
    })
    .join(', ');
}

function Quiz({ cipher, quiz, number }: { cipher: CipherModule; quiz: LectureQuiz; number: number }) {
  const answerId = useId();
  const [given, setGiven] = useState('');
  const [expected, setExpected] = useState<string | null>(null);
  const [checked, setChecked] = useState<'right' | 'wrong' | 'shown' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const reveal = async (mode: 'check' | 'show') => {
    try {
      const answer = await quizAnswer(cipher, quiz);
      setExpected(answer);
      setFailure(null);
      setChecked(mode === 'show' ? 'shown' : sameAnswer(given, answer) ? 'right' : 'wrong');
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };

  const run = quiz.run;

  return (
    <li className="cl-card flex flex-col gap-2 px-4 py-3">
      <p className="text-sm text-ink">
        <span className="font-semibold text-ink-strong">Q{number}.</span> {quiz.question}
      </p>
      {run !== undefined && (
        <p className="font-mono text-xs text-ink-muted wrap-anywhere">
          {cipher.oneWay === true ? 'Hash' : run.direction === 'decrypt' ? 'Decrypt' : 'Encrypt'} &ldquo;{run.input}&rdquo;
          {Object.keys(run.params ?? {}).length > 0 && ` with ${describeKey(cipher, run.params)}`}
        </p>
      )}

      {run !== undefined && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={answerId} className="cl-label">
              Your answer
            </label>
            <input
              id={answerId}
              value={given}
              onChange={(e) => {
                setGiven(e.target.value);
                if (checked !== 'shown') setChecked(null);
              }}
              className="cl-field w-full font-mono"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <button type="button" className="cl-button cl-button-primary" onClick={() => void reveal('check')} disabled={given.trim() === ''}>
            Check
          </button>
        </div>
      )}

      <div>
        <button type="button" className="cl-button" onClick={() => void reveal('show')}>
          Show answer
        </button>
      </div>

      <div role="status" className="flex flex-col gap-1 text-sm">
        {failure !== null && <p className="text-ink-muted">This quiz did not run: {failure}</p>}
        {checked === 'right' && <p className="font-semibold text-ink-strong">Correct.</p>}
        {checked === 'wrong' && (
          <p className="font-semibold text-ink-strong">Not quite.</p>
        )}
        {checked === 'shown' && expected !== null && (
          <p className={run !== undefined ? 'font-mono text-ink-strong wrap-anywhere' : 'cl-prose text-ink'}>
            {expected}
          </p>
        )}
        {checked !== null && quiz.note !== undefined && <p className="cl-prose text-ink-muted">{quiz.note}</p>}
      </div>
    </li>
  );
}

export default function LectureQuizzes({ cipher }: { cipher: CipherModule }) {
  const headingId = useId();
  const [draw, setDraw] = useState(0);
  const [quizzes, setQuizzes] = useState<LectureQuiz[]>(() => shuffled(cipher.quizzes ?? []));

  const newQuestions = useCallback(() => setDraw((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void practiceQuizzes(cipher, PRACTICE_COUNT).then((practice) => {
      if (!cancelled) setQuizzes(shuffled([...(cipher.quizzes ?? []), ...practice]));
    });
    return () => {
      cancelled = true;
    };
  }, [cipher, draw]);

  if (quizzes.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-sm font-semibold text-ink-strong">
        Quiz
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="cl-prose text-sm text-ink-muted">Work it by hand, then check. Order is shuffled.</p>
        <button type="button" className="cl-button" onClick={newQuestions}>
          New questions
        </button>
      </div>
      <ol className="flex flex-col gap-3">
        {quizzes.map((quiz, index) => (
          <Quiz
            key={`${draw}-${quiz.question}-${quiz.run?.input ?? ''}-${index}`}
            cipher={cipher}
            quiz={quiz}
            number={index + 1}
          />
        ))}
      </ol>
    </section>
  );
}
