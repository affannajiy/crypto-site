/**
 * The fold, drawn.
 *
 * Bifid is one of the few ciphers where a picture is genuinely the explanation.
 * Three rows: the block's letters, their row numbers, their column numbers. Then
 * the same two number lines read as one continuous stream, cut into pairs, with
 * the selected pair marked in both places at once.
 *
 * Seeing one pair straddle the join between the row line and the column line is
 * the whole cipher. That is the moment where a piece of one letter is glued to a
 * piece of another, and no amount of prose does it as quickly.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { squareFor } from './bifid';

interface Fold {
  letters: string;
  rows: number[];
  cols: number[];
  pick: number[];
  letter: string;
  rowValue: number;
  colValue: number;
}

function readFold(step: Step | undefined): Fold | null {
  const data = step?.data;
  if (data === undefined || data['isLetter'] !== true) return null;
  const letters = data['letters'];
  const rows = data['rows'];
  const cols = data['cols'];
  const pick = data['pick'];
  const letter = data['letter'];
  if (
    typeof letters !== 'string' ||
    !Array.isArray(rows) ||
    !Array.isArray(cols) ||
    !Array.isArray(pick) ||
    typeof letter !== 'string'
  ) {
    return null;
  }
  return {
    letters,
    rows: rows.map(Number),
    cols: cols.map(Number),
    pick: pick.map(Number),
    letter,
    rowValue: Number(data['rowValue'] ?? 0),
    colValue: Number(data['colValue'] ?? 0),
  };
}

function Digit({ value, mark, half }: { value: number; mark: boolean; half: 'rows' | 'cols' }) {
  return (
    <td
      className={[
        'border px-1.5 py-0.5 text-center font-mono text-sm',
        mark
          ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
          : half === 'rows'
            ? 'border-line bg-sunken text-ink-muted'
            : 'border-line text-ink-muted',
      ].join(' ')}
    >
      {value + 1}
    </td>
  );
}

export default function BifidGrid({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const folds = steps.filter((s) => s.data?.['isLetter'] === true);
  const maxCursor = Math.max(0, folds.length - 1);
  const at = Math.min(cursor, maxCursor);
  const fold = readFold(folds[at]);

  const square = squareFor(String(params['keyword'] ?? ''));
  const period = Number(params['period'] ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="bifid-square" className="flex flex-col gap-3">
        <h3 id="bifid-square" className="text-sm font-semibold text-ink-strong">
          The square
        </h3>
        <div className="cl-card w-fit overflow-x-auto px-4 py-3">
          <table className="border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="w-6" />
                {[1, 2, 3, 4, 5].map((n) => (
                  <th
                    key={n}
                    scope="col"
                    className="border border-line bg-sunken px-2 py-1 text-center font-mono text-xs text-ink-subtle"
                  >
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map((row) => (
                <tr key={row}>
                  <th
                    scope="row"
                    className="border border-line bg-sunken px-2 py-1 text-center font-mono text-xs text-ink-subtle"
                  >
                    {row + 1}
                  </th>
                  {[0, 1, 2, 3, 4].map((col) => {
                    const mark = fold !== null && fold.rowValue === row && fold.colValue === col;
                    return (
                      <td
                        key={col}
                        className={[
                          'border px-2 py-1 text-center font-mono text-sm',
                          mark
                            ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                            : 'border-line text-ink',
                        ].join(' ')}
                      >
                        {square.cells[row * 5 + col]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cl-prose text-sm text-ink-muted">
          Twenty-five cells for twenty-six letters, so <strong>J is written as I</strong> &mdash; the
          same compromise Playfair makes, and for the same reason.
        </p>
      </section>

      {fold === null ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and its fold will be drawn here.
        </p>
      ) : (
        <>
          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">
              The block, written as two lines of digits
              {period > 0 ? ` (period ${period})` : ' (no period: one block for the whole message)'}
            </p>
            <table className="mt-2 border-separate border-spacing-0">
              <tbody>
                <tr>
                  <th
                    scope="row"
                    className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle"
                  >
                    Letters
                  </th>
                  {fold.letters.split('').map((char, i) => (
                    <td
                      key={i}
                      className="border border-line px-1.5 py-0.5 text-center font-mono text-sm text-ink"
                    >
                      {char}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle"
                  >
                    Rows
                  </th>
                  {fold.rows.map((value, i) => (
                    <Digit key={i} value={value} half="rows" mark={fold.pick.includes(i)} />
                  ))}
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle"
                  >
                    Columns
                  </th>
                  {fold.cols.map((value, i) => (
                    <Digit
                      key={i}
                      value={value}
                      half="cols"
                      mark={fold.pick.includes(i + fold.rows.length)}
                    />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">
              Both lines read as one stream, cut into pairs &rarr; {fold.letter}
            </p>
            <p className="mt-2 flex flex-wrap gap-1 font-mono text-sm">
              {[...fold.rows, ...fold.cols].map((value, i) => (
                <span
                  key={i}
                  className={[
                    'rounded border px-1.5 py-0.5',
                    fold.pick.includes(i)
                      ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                      : i < fold.rows.length
                        ? 'border-line bg-sunken text-ink-muted'
                        : 'border-line text-ink-muted',
                  ].join(' ')}
                >
                  {value + 1}
                </span>
              ))}
            </p>
            <p className="cl-prose mt-3 text-sm text-ink-muted">
              The two marked digits are the pair being read. Shaded digits are rows, unshaded are
              columns. Step forward until a pair straddles the boundary between them:{' '}
              <strong>
                that is the moment a piece of one letter is joined to a piece of a different one
              </strong>
              , and it is the reason counting letters in the ciphertext tells you nothing.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <p className="cl-prose text-sm text-ink-muted">{folds[at]?.detail}</p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="cl-button"
                onClick={() => setCursor((c) => Math.max(0, c - 1))}
                disabled={at === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className="cl-button"
                onClick={() => setCursor((c) => Math.min(maxCursor, c + 1))}
                disabled={at >= maxCursor}
              >
                Next
              </button>
            </div>

            <label className="block">
              <span className="cl-label">
                Output letter {at + 1} of {folds.length}
              </span>
              <input
                type="range"
                className="h-6 w-full accent-[var(--color-marker)]"
                min={0}
                max={maxCursor}
                value={at}
                onChange={(e) => setCursor(Number(e.target.value))}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
