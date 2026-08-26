/**
 * Two stages, drawn as two stages.
 *
 * ADFGVX is a composition, and a picture that blurs the two halves together would
 * hide the only thing worth understanding about it. So: the 6x6 square with its
 * ADFGVX labels, then the fractionated string, then the transposition grid, then
 * the wire text.
 *
 * The one measurement worth putting on screen is **how far apart the two halves of
 * a character end up**. That distance is the entire security argument, and it is
 * computable, so it is shown as a number rather than described.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { LABELS, SIZE, buildGrid } from './adfgvx';
import { columnarOrder, keyRanks } from '../../transposition/columnar/columnar';

function readStage(steps: Step[], stage: string): Step | undefined {
  return steps.find((s) => s.data?.['stage'] === stage);
}

export default function AdfgvxStages({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const square = buildGrid(String(params['keyword'] ?? ''));
  const transKeyword = String(params['transposition'] ?? '').replace(/[^A-Za-z]/g, '').toUpperCase();

  const letterSteps = steps.filter((s) => s.data?.['stage'] === 'fractionate');
  const maxCursor = Math.max(0, letterSteps.length - 1);
  const at = Math.min(cursor, maxCursor);
  const current = letterSteps[at];
  const row = Number(current?.data?.['row'] ?? -1);
  const col = Number(current?.data?.['col'] ?? -1);

  const transposeStep = readStage(steps, 'transpose');
  const pairs = String(transposeStep?.data?.['pairs'] ?? '');
  const scrambled = String(transposeStep?.data?.['scrambled'] ?? '');

  // Where did this character's two label letters end up after the transposition?
  const order = pairs === '' ? [] : columnarOrder(pairs.length, transKeyword);
  const positionOf = (source: number) => order.indexOf(source);
  const firstAt = positionOf(at * 2);
  const secondAt = positionOf(at * 2 + 1);
  const distance = firstAt >= 0 && secondAt >= 0 ? Math.abs(firstAt - secondAt) : 0;

  const ranks = transKeyword === '' ? [] : keyRanks(transKeyword);
  const columns = Math.max(1, transKeyword.length);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="adfgvx-square" className="flex flex-col gap-3">
        <h3 id="adfgvx-square" className="text-sm font-semibold text-ink-strong">
          Stage one: the 6&times;6 square
        </h3>
        <div className="cl-card w-fit overflow-x-auto px-4 py-3">
          <table className="border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="w-7" />
                {LABELS.split('').map((label, i) => (
                  <th
                    key={label}
                    scope="col"
                    className={[
                      'border px-2 py-1 text-center font-mono text-xs',
                      i === col
                        ? 'border-marker-line bg-marker-wash text-ink-strong'
                        : 'border-line bg-sunken text-ink-subtle',
                    ].join(' ')}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LABELS.split('').map((label, r) => (
                <tr key={label}>
                  <th
                    scope="row"
                    className={[
                      'border px-2 py-1 text-center font-mono text-xs',
                      r === row
                        ? 'border-marker-line bg-marker-wash text-ink-strong'
                        : 'border-line bg-sunken text-ink-subtle',
                    ].join(' ')}
                  >
                    {label}
                  </th>
                  {LABELS.split('').map((_, c) => (
                    <td
                      key={c}
                      className={[
                        'border px-2 py-1 text-center font-mono text-sm',
                        r === row && c === col
                          ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                          : 'border-line text-ink-muted',
                      ].join(' ')}
                    >
                      {square.cells[r * SIZE + c]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cl-prose text-sm text-ink-muted">
          Thirty-six cells: the alphabet <strong>and the ten digits</strong>. That is why the German
          army could send map references with this and could not with Playfair, whose 5&times;5
          square has no room for numbers. The six labels are A, D, F, G, V and X because those are
          the six characters least likely to be confused with each other in Morse over a noisy
          wireless link &mdash; a decision about radio, not about cryptography, and the kind that
          decides whether a cipher gets used.
        </p>
      </section>

      {letterSteps.length === 0 ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and both stages will be drawn here.
        </p>
      ) : (
        <>
          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">The fractionated string, before transposition</p>
            <p className="mt-2 flex flex-wrap gap-0.5 font-mono text-sm">
              {pairs.split('').map((char, i) => (
                <span
                  key={i}
                  className={[
                    'rounded px-1',
                    i === at * 2 || i === at * 2 + 1
                      ? 'bg-marker-wash font-bold text-ink-strong underline decoration-marker-line decoration-2 underline-offset-4'
                      : 'text-ink-muted',
                  ].join(' ')}
                >
                  {char}
                </span>
              ))}
            </p>
            <p className="cl-prose mt-2 text-sm text-ink-muted">
              Every message character is two letters here, side by side. At this point the cipher is
              only a substitution, and counting pairs would break it in an afternoon.
            </p>
          </div>

          <section aria-labelledby="adfgvx-transpose" className="flex flex-col gap-3">
            <h3 id="adfgvx-transpose" className="text-sm font-semibold text-ink-strong">
              Stage two: the transposition, and how far it throws the halves
            </h3>
            <div className="cl-card overflow-x-auto px-4 py-3">
              <p className="cl-label">
                Written under &ldquo;{transKeyword || '(none)'}&rdquo; in {columns} columns
              </p>
              <table className="mt-2 border-separate border-spacing-0">
                <thead>
                  <tr>
                    {transKeyword.split('').map((char, i) => (
                      <th
                        key={i}
                        scope="col"
                        className="border border-line bg-sunken px-1.5 py-0.5 text-center font-mono text-xs text-ink"
                      >
                        {char}
                        <span className="block text-[10px] text-ink-subtle">{ranks[i]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.ceil(pairs.length / columns) }, (_, r) => (
                    <tr key={r}>
                      {Array.from({ length: columns }, (_, c) => {
                        const index = r * columns + c;
                        const mark = index === at * 2 || index === at * 2 + 1;
                        return (
                          <td
                            key={c}
                            className={[
                              'border px-1.5 py-0.5 text-center font-mono text-sm',
                              index >= pairs.length
                                ? 'border-dashed border-line text-transparent'
                                : mark
                                  ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                                  : 'border-line text-ink-muted',
                            ].join(' ')}
                          >
                            {index < pairs.length ? pairs.charAt(index) : '·'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cl-card px-4 py-3">
              <p className="cl-prose text-sm text-ink-muted">
                Character {at + 1} of the message became two letters. After the transposition they
                sit at positions <strong>{firstAt + 1}</strong> and <strong>{secondAt + 1}</strong>{' '}
                of the wire text &mdash; <strong>{distance}</strong> places apart, in a string of{' '}
                {scrambled.length}. That distance is the entire security argument. Fractionation
                alone is a substitution and falls to counting pairs; transposition alone preserves
                every letter and falls to anagramming. Composed, the pairs are torn apart before
                anyone can count them, and there is no language left to anagram.
              </p>
            </div>
          </section>

          <div className="flex min-w-0 flex-col gap-3">
            <p className="cl-prose text-sm text-ink-muted">{current?.detail}</p>

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
                Character {at + 1} of {letterSteps.length}
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
