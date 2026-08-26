/**
 * Four squares, and the rectangle across them.
 *
 * The only thing to draw here is the rectangle, and it has to be drawn across all
 * four squares at once or it is not a rectangle. So the four are laid out in a 2x2
 * block with no gap between them, the two corners you look up are marked one way
 * and the two you read off are marked another.
 *
 * The layout is fixed-width and does not shrink: at 320 px the letters would
 * render at a few pixels each, so the card scrolls instead. That is the house rule
 * and it exists because the Affine and Rail Fence diagrams broke it first.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { buildSquares } from './foursquare';

interface Pair {
  first: string;
  second: string;
  cipherFirst: string;
  cipherSecond: string;
  firstAt: { row: number; col: number };
  secondAt: { row: number; col: number };
}

function readPair(step: Step | undefined): Pair | null {
  const data = step?.data;
  if (data === undefined || data['isPair'] !== true) return null;
  const firstAt = data['firstAt'];
  const secondAt = data['secondAt'];
  if (typeof firstAt !== 'object' || firstAt === null || typeof secondAt !== 'object' || secondAt === null) {
    return null;
  }
  const a = firstAt as Record<string, unknown>;
  const b = secondAt as Record<string, unknown>;
  if (typeof a['row'] !== 'number' || typeof b['row'] !== 'number') return null;
  return {
    first: String(data['first'] ?? ''),
    second: String(data['second'] ?? ''),
    cipherFirst: String(data['cipherFirst'] ?? ''),
    cipherSecond: String(data['cipherSecond'] ?? ''),
    firstAt: { row: Number(a['row']), col: Number(a['col']) },
    secondAt: { row: Number(b['row']), col: Number(b['col']) },
  };
}

type Role = 'lookup' | 'answer' | null;

function Grid({
  cells,
  label,
  roleAt,
}: {
  cells: string[];
  label: string;
  roleAt: (row: number, col: number) => Role;
}) {
  return (
    <div className="shrink-0">
      <p className="cl-label mb-1">{label}</p>
      <table className="border-separate border-spacing-0">
        <tbody>
          {[0, 1, 2, 3, 4].map((row) => (
            <tr key={row}>
              {[0, 1, 2, 3, 4].map((col) => {
                const role = roleAt(row, col);
                return (
                  <td
                    key={col}
                    className={[
                      'h-7 w-7 border text-center font-mono text-sm',
                      role === 'answer'
                        ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                        : role === 'lookup'
                          ? 'border-line-strong bg-sunken font-bold text-ink-strong'
                          : 'border-line text-ink-muted',
                    ].join(' ')}
                  >
                    {cells[row * 5 + col]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FourSquareGrid({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const pairs = steps.filter((s) => s.data?.['isPair'] === true);
  const maxCursor = Math.max(0, pairs.length - 1);
  const at = Math.min(cursor, maxCursor);
  const pair = readPair(pairs[at]);

  const squares = buildSquares(String(params['keyOne'] ?? ''), String(params['keyTwo'] ?? ''));

  const none = () => null;

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">The four squares</p>
        <div className="mt-2 flex w-fit shrink-0 flex-col gap-3">
          <div className="flex gap-3">
            <Grid
              cells={squares.plain.cells}
              label="Top left — plain"
              roleAt={
                pair === null
                  ? none
                  : (row, col) => (row === pair.firstAt.row && col === pair.firstAt.col ? 'lookup' : null)
              }
            />
            <Grid
              cells={squares.topRight.cells}
              label="Top right — key one"
              roleAt={
                pair === null
                  ? none
                  : (row, col) =>
                      row === pair.firstAt.row && col === pair.secondAt.col ? 'answer' : null
              }
            />
          </div>
          <div className="flex gap-3">
            <Grid
              cells={squares.bottomLeft.cells}
              label="Bottom left — key two"
              roleAt={
                pair === null
                  ? none
                  : (row, col) =>
                      row === pair.secondAt.row && col === pair.firstAt.col ? 'answer' : null
              }
            />
            <Grid
              cells={squares.plain.cells}
              label="Bottom right — plain"
              roleAt={
                pair === null
                  ? none
                  : (row, col) =>
                      row === pair.secondAt.row && col === pair.secondAt.col ? 'lookup' : null
              }
            />
          </div>
        </div>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          Shaded cells are the two letters you look up, in the <strong>plain</strong> squares.
          Underlined orange cells are the two you read off, in the <strong>keyed</strong> squares.
          All four are corners of one rectangle spanning the whole block, which is why there are no
          special cases here &mdash; a shared row, a shared column and a doubled letter all work by
          the same rule.
        </p>
      </div>

      {pair === null ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and each pair will be traced through the squares.
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <p className="font-mono text-lg text-ink-strong">
            {pair.first}
            {pair.second}
            <span className="mx-2 text-ink-muted" aria-hidden="true">
              &rarr;
            </span>
            <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
              {pair.cipherFirst}
              {pair.cipherSecond}
            </span>
          </p>

          <p className="cl-prose text-sm text-ink-muted">{pairs[at]?.detail}</p>

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
              Pair {at + 1} of {pairs.length}
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
    </div>
  );
}
