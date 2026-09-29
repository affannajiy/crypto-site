/**
 * The two alphabets.
 *
 * Caesar got rings because its key is a rotation. This key is not a rotation of
 * anything, so a ring would draw a shape that is not there. What the reader
 * needs is what a cipher clerk had on paper: the plain alphabet with the key
 * alphabet written under it, and the column being used right now.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useState } from 'react';
import type { Params, Step } from '../../../types';
import { A_TO_Z } from '../../../../lib/letters';
import { parseKey } from './monoalphabetic';

function readPlainIndex(step: Step | undefined): number | null {
  const value = step?.data?.['plainIndex'];
  return typeof value === 'number' ? value : null;
}

export default function MonoTable({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);
  const length = steps.length;
  const maxCursor = Math.max(0, length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = steps[safeCursor];
  const active = readPlainIndex(current);

  useEffect(() => {
    setCursor(0);
  }, [length]);

  let keyAlphabet: string;
  try {
    keyAlphabet = parseKey(String(params['key'] ?? ''))
      .map((i) => A_TO_Z.charAt(i))
      .join('');
  } catch (error) {
    return <p className="cl-prose text-sm text-ink-muted">{(error as Error).message}</p>;
  }

  if (length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and each letter will be looked up in the table here.
      </p>
    );
  }

  const rows = [
    { label: 'Plain', letters: A_TO_Z.toLowerCase() },
    { label: 'Key', letters: keyAlphabet },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <table className="border-collapse font-mono text-sm">
          <caption className="sr-only">
            The plain alphabet with the key alphabet under it. Each plaintext letter is replaced by
            the key letter in the same column.
          </caption>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="pr-3 text-left font-sans text-xs font-medium text-ink-muted">
                  {row.label}
                </th>
                {row.letters.split('').map((letter, column) => (
                  <td
                    key={column}
                    aria-current={active === column ? 'true' : undefined}
                    className={[
                      'w-6 border px-1 py-0.5 text-center',
                      active === column
                        ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                        : 'border-line text-ink-muted',
                    ].join(' ')}
                  >
                    {letter}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <p className="font-mono text-lg">
          <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
            {current?.input === ' ' ? '␣' : current?.input}
          </span>
          <span className="mx-2 text-ink-muted" aria-hidden="true">
            &rarr;
          </span>
          <span className="sr-only">becomes</span>
          <span>{current?.output === ' ' ? '␣' : current?.output}</span>
        </p>
        <p className="cl-prose text-sm text-ink-muted">{current?.detail}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="cl-button"
            onClick={() => setCursor((c) => Math.max(0, c - 1))}
            disabled={safeCursor === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="cl-button"
            onClick={() => setCursor((c) => Math.min(maxCursor, c + 1))}
            disabled={safeCursor >= maxCursor}
          >
            Next
          </button>
        </div>

        <label className="block">
          <span className="cl-label">
            Character {safeCursor + 1} of {length}
          </span>
          <input
            type="range"
            className="h-6 w-full accent-[var(--color-marker)]"
            min={0}
            max={maxCursor}
            value={safeCursor}
            onChange={(e) => setCursor(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
