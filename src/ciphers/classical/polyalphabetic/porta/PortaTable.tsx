/**
 * Porta's table, all thirteen rows of it.
 *
 * The reason to draw the whole table rather than one row is that the shape of it
 * *is* the argument. Twenty-six key letters, thirteen rows, two letters per row —
 * printed side by side, the halving is not a claim in the prose, it is the left
 * column of the table.
 *
 * Each row is drawn as a pairing, first half over second half, because that is how
 * Porta printed it and because the pairing is what makes the cipher reciprocal.
 * The current letter is marked in both of its positions at once.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { A_TO_Z } from '../../../../lib/letters';
import { HALF, ROWS, keyLettersForRow, portaLetter } from './porta';

interface Press {
  fromIndex: number;
  toIndex: number;
  row: number;
  keyChar: string;
}

function readPress(step: Step | undefined): Press | null {
  const data = step?.data;
  if (data === undefined || data['isLetter'] !== true) return null;
  const fromIndex = data['fromIndex'];
  const toIndex = data['toIndex'];
  const row = data['row'];
  const keyChar = data['keyChar'];
  if (
    typeof fromIndex !== 'number' ||
    typeof toIndex !== 'number' ||
    typeof row !== 'number' ||
    typeof keyChar !== 'string'
  ) {
    return null;
  }
  return { fromIndex, toIndex, row, keyChar };
}

function Cell({ char, mark }: { char: string; mark: boolean }) {
  return (
    <td
      className={[
        'border px-1 py-0.5 text-center font-mono text-xs',
        mark
          ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
          : 'border-line text-ink-muted',
      ].join(' ')}
    >
      {char}
    </td>
  );
}

export default function PortaTable({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const letterSteps = steps.filter((s) => s.data?.['isLetter'] === true);
  const maxCursor = Math.max(0, letterSteps.length - 1);
  const at = Math.min(cursor, maxCursor);
  const press = readPress(letterSteps[at]);

  const firstHalf = A_TO_Z.slice(0, HALF).split('');

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">Porta&rsquo;s table: thirteen rows for twenty-six key letters</p>
        <table className="mt-2 border-separate border-spacing-0">
          <thead>
            <tr>
              <th scope="col" className="pr-2 text-left text-xs font-normal text-ink-subtle">
                Key
              </th>
              {firstHalf.map((char) => (
                <th
                  key={char}
                  scope="col"
                  className={[
                    'border px-1 py-0.5 text-center font-mono text-xs',
                    press !== null && (press.fromIndex % HALF) === A_TO_Z.indexOf(char)
                      ? 'border-marker-line bg-marker-wash text-ink-strong'
                      : 'border-line bg-sunken text-ink',
                  ].join(' ')}
                >
                  {char}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, row) => {
              const active = press?.row === row;
              return (
                <tr key={row}>
                  <th
                    scope="row"
                    className={[
                      'whitespace-nowrap border px-1 py-0.5 text-center font-mono text-xs',
                      active
                        ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                        : 'border-line bg-sunken text-ink',
                    ].join(' ')}
                  >
                    {keyLettersForRow(row)}
                  </th>
                  {firstHalf.map((_, i) => {
                    const to = portaLetter(i, row);
                    const mark =
                      active &&
                      press !== null &&
                      (press.fromIndex === i ||
                        press.toIndex === i ||
                        press.fromIndex === to ||
                        press.toIndex === to);
                    return <Cell key={i} char={A_TO_Z.charAt(to)} mark={mark} />;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          The left column is the key letters, <strong>two per row</strong>. Each row pairs the top
          half of the alphabet with the bottom half, so a letter from one half always comes out of
          the other and the mapping runs in both directions. Thirteen rows is why the table fits on
          one printed page &mdash; and why the Attack tab tries thirteen possibilities per column
          rather than twenty-six.
        </p>
      </div>

      {letterSteps.length === 0 ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and each letter will be traced through the table.
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <p className="cl-prose text-sm text-ink-muted">{letterSteps[at]?.detail}</p>

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
              Letter {at + 1} of {letterSteps.length}
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
      )}

      <section aria-labelledby="porta-halving" className="flex flex-col gap-3">
        <h3 id="porta-halving" className="text-sm font-semibold text-ink-strong">
          What the halving costs
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          With the key{' '}
          <span className="font-mono">{String(params['key'] ?? '').toUpperCase() || '(none)'}</span>,
          changing any key letter to its partner &mdash; A for B, C for D &mdash; produces{' '}
          <strong>exactly the same ciphertext</strong>. Two keys, one output. For a key of{' '}
          {String(params['key'] ?? '').replace(/[^A-Za-z]/g, '').length || 1} letters that means the
          real key space is 13<sup>n</sup> rather than 26<sup>n</sup>, and every letter you add
          doubles the gap. A design choice made for the printer became a factor an analyst never has
          to work for.
        </p>
      </section>
    </div>
  );
}
