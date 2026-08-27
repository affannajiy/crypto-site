import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ENGLISH_IOC,
  RANDOM_IOC,
  indexOfCoincidence,
  letterPercentages,
  observe,
  topNgrams,
} from '../lib/analysis';
import { ALPHABET, ENGLISH_LETTER_FREQUENCY, letterCounts, letterTotal } from '../lib/frequency';

/**
 * Cryptanalysis without a cipher.
 *
 * Every Attack tab in this app already knows which cipher it is attacking. This
 * page is the step before that: a ciphertext arrives, and the first job is to
 * work out what you are holding. It never claims to identify anything — it
 * reports measurements and what they suggest, because that is what identifying a
 * cipher actually is.
 */
const SAMPLE =
  'Wkh ohjlrqv pdufk dw gdzq. Krog wkh eulgjh xqwlo wkh vhfrqg frpsdqb dgydqfhv, dqg vhqg zrug wr wkh hdvwhuq jdwh ehiruh wkh jxqv duulyh.';

/**
 * One row of the frequency comparison.
 *
 * The bar is scaled against thirteen percent, which is a little above E's share
 * in English — so both columns share one scale and can honestly be compared by
 * eye. Every bar also carries its number, because a bar length is not a value a
 * screen reader can read out.
 */
function FrequencyRow({
  letter,
  observed,
  expected,
  count,
}: {
  letter: string;
  observed: number;
  expected: number;
  count: number;
}) {
  const scale = (share: number) => `${Math.min(100, (share / 13) * 100)}%`;
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-1 pr-2 text-left font-mono text-sm font-normal text-ink">
        {letter}
      </th>
      <td className="w-1/2 py-1 pr-2">
        <span className="flex items-center gap-2">
          <span
            className="block h-3 shrink-0 rounded-sm bg-marker"
            style={{ width: scale(observed) }}
          />
          <span className="font-mono text-xs text-ink-muted">{observed.toFixed(1)}%</span>
          <span className="font-mono text-xs text-ink-subtle">({count})</span>
        </span>
      </td>
      <td className="w-1/2 py-1">
        <span className="flex items-center gap-2">
          <span
            className="block h-3 shrink-0 rounded-sm bg-line-strong"
            style={{ width: scale(expected) }}
          />
          <span className="font-mono text-xs text-ink-muted">{expected.toFixed(1)}%</span>
        </span>
      </td>
    </tr>
  );
}

export default function Analyse() {
  const inputId = useId();
  const [text, setText] = useState(SAMPLE);

  const stats = useMemo(
    () => ({
      counts: letterCounts(text),
      percentages: letterPercentages(text),
      total: letterTotal(text),
      ic: indexOfCoincidence(text),
      notes: observe(text),
      bigrams: topNgrams(text, 2),
      trigrams: topNgrams(text, 3),
    }),
    [text],
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          Frequency analysis
        </h1>
        <p className="cl-prose text-ink-muted">
          Paste a ciphertext and count it. Every Attack tab on this site already knows which cipher
          it is breaking; this page is the step before that, where all you have is the message.
          Nothing is decrypted here — these are measurements, and what they suggest.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="cl-label mb-0">
          Ciphertext
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          spellCheck={false}
          className="cl-field w-full wrap-anywhere font-mono"
          placeholder="Paste an intercept…"
        />
        <p className="text-xs text-ink-subtle">
          {stats.total} {stats.total === 1 ? 'letter' : 'letters'} counted, out of {text.length}{' '}
          characters.
        </p>
      </div>

      <section aria-labelledby="observations" className="cl-card px-4 py-4">
        <h2
          id="observations"
          className="text-sm font-semibold uppercase tracking-wide text-ink-subtle"
        >
          What this looks like
        </h2>
        {stats.notes.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing to measure yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {stats.notes.map((note) => (
              <li key={note.claim} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-medium text-ink-strong">{note.claim}</p>
                <p className="cl-prose mt-1 text-sm text-ink-muted">{note.evidence}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="cl-prose mt-4 border-t border-line pt-3 text-sm text-ink-muted">
          These are suggestions, not an identification. A short polyalphabetic sample and a long
          monoalphabetic one can measure the same, and no number here separates two ciphers that
          have the same shape — that is what trying one on its own page is for.
        </p>
      </section>

      <section aria-labelledby="ic-heading" className="cl-card px-4 py-4">
        <h2 id="ic-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          Index of coincidence
        </h2>
        <p className="mt-2 font-mono text-2xl text-ink-strong">{stats.ic.toFixed(4)}</p>
        {/* Both reference points are marked, because the number alone means
            nothing without them. */}
        <div className="mt-3">
          <div className="relative h-2 rounded-full bg-sunken">
            <span
              className="absolute top-0 h-2 w-1 rounded-full bg-marker-line"
              style={{ left: `${Math.min(100, Math.max(0, (stats.ic / 0.08) * 100))}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-xs text-ink-subtle">
            <span>0</span>
            <span>random {RANDOM_IOC.toFixed(4)}</span>
            <span>English {ENGLISH_IOC}</span>
          </div>
        </div>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          The chance that two letters picked at random from this text are the same letter. It
          survives substitution — renaming every letter does not change how often letters repeat —
          so it separates one-alphabet ciphers from many-alphabet ones without decrypting anything.
        </p>
      </section>

      <section aria-labelledby="freq-heading">
        <h2 id="freq-heading" className="text-lg font-semibold text-ink-strong">
          Letter frequency
        </h2>
        <p className="cl-prose mt-1 text-sm text-ink-muted">
          This text on the left, English on the right. A monoalphabetic cipher keeps the shape of
          the left column and moves it onto different letters; a transposition leaves it exactly
          where it is, which is why counting letters cannot break one.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-80">
            <caption className="sr-only">
              Observed letter frequency in the ciphertext, beside English letter frequency
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="pb-1 text-left text-xs uppercase tracking-wide text-ink-subtle"
                >
                  Letter
                </th>
                <th
                  scope="col"
                  className="pb-1 text-left text-xs uppercase tracking-wide text-ink-subtle"
                >
                  This text
                </th>
                <th
                  scope="col"
                  className="pb-1 text-left text-xs uppercase tracking-wide text-ink-subtle"
                >
                  English
                </th>
              </tr>
            </thead>
            <tbody>
              {ALPHABET.split('').map((letter, index) => (
                <FrequencyRow
                  key={letter}
                  letter={letter}
                  observed={stats.percentages[index] ?? 0}
                  expected={ENGLISH_LETTER_FREQUENCY[index] ?? 0}
                  count={stats.counts[index] ?? 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ngram-heading" className="grid gap-4 sm:grid-cols-2">
        <h2 id="ngram-heading" className="sr-only">
          Repeated runs
        </h2>
        {[
          {
            title: 'Repeated pairs',
            grams: stats.bigrams,
            hint: 'TH, HE, IN and ER lead English by a distance.',
          },
          {
            title: 'Repeated triples',
            grams: stats.trigrams,
            hint: 'A repeat at a fixed distance is what Kasiski counted to find a keyword length.',
          },
        ].map((group) => (
          <div key={group.title} className="cl-card px-4 py-4">
            <h3 className="text-sm font-semibold text-ink-strong">{group.title}</h3>
            {group.grams.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">Nothing repeats yet.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {group.grams.map((gram) => (
                  <li
                    key={gram.gram}
                    className="rounded border border-line bg-sunken px-1.5 py-0.5 font-mono text-xs text-ink"
                  >
                    {gram.gram}
                    <span className="ml-1 text-ink-subtle">×{gram.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="cl-prose mt-2 text-xs text-ink-muted">{group.hint}</p>
          </div>
        ))}
      </section>

      <p className="text-sm text-ink-muted">
        Found the shape?{' '}
        <Link to="/" className="underline underline-offset-4 hover:text-ink">
          Pick the cipher
        </Link>{' '}
        and take it to its Attack tab.
      </p>
    </div>
  );
}
