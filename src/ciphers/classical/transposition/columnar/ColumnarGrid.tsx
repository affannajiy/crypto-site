/**
 * The grid.
 *
 * Rail Fence got a zigzag because its route is a shape. Columnar's route is not a
 * shape, it is an *order*, so this draws the thing the order applies to: the grid,
 * with the keyword across the top and each column's alphabetical rank under it.
 *
 * The two facts the picture has to carry are the ones people get wrong. First,
 * the columns are read in rank order, not left to right — so the rank numbers are
 * the instructions and the keyword is just how they were remembered. Second, the
 * last row is ragged, which makes the columns different lengths, and that is what
 * makes decrypting harder than it looks. Both are visible without reading a word.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useRef, useState } from 'react';
import type { Params, Step } from '../../../types';
import { columnLengths, keyRanks } from './columnar';

const PLAY_INTERVAL_MS = 420;

/** Cells of readout shown either side of the current one. */
const READOUT_RADIUS = 20;

interface Cell {
  char: string;
  row: number;
  column: number;
  columns: number;
  rank: number;
  keyLetter: string;
  outputIndex: number;
  encrypting: boolean;
}

function readCell(step: Step | undefined): Cell | null {
  const data = step?.data;
  if (data === undefined) return null;
  const char = data['char'];
  const row = data['row'];
  const column = data['column'];
  const columns = data['columns'];
  const rank = data['rank'];
  const keyLetter = data['keyLetter'];
  const outputIndex = data['outputIndex'];
  if (
    typeof char !== 'string' ||
    typeof row !== 'number' ||
    typeof column !== 'number' ||
    typeof columns !== 'number' ||
    typeof rank !== 'number' ||
    typeof keyLetter !== 'string' ||
    typeof outputIndex !== 'number'
  ) {
    return null;
  }
  return {
    char,
    row,
    column,
    columns,
    rank,
    keyLetter,
    outputIndex,
    encrypting: data['direction'] !== 'decrypt',
  };
}

/** A space drawn as a space is an empty cell, which reads as a bug. */
function visible(char: string): string {
  if (char === ' ') return '␣';
  if (char === '\n') return '⏎';
  if (char === '\t') return '⇥';
  if (char === '') return '';
  return char;
}

export default function ColumnarGrid({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const maxCursor = Math.max(0, steps.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = steps[safeCursor];
  const cell = readCell(current);

  const length = steps.length;
  useEffect(() => {
    setCursor(0);
  }, [length]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || length === 0) return;
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => {
      if (timer.current !== null) clearInterval(timer.current);
    };
  }, [playing, length]);

  if (length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and it will be written into the grid here.
      </p>
    );
  }

  const keyword = String(params['keyword'] ?? '');
  const ranks = keyRanks(keyword);
  const letters = keyword.replace(/[^A-Za-z]/g, '').toUpperCase().split('');
  const columns = cell?.columns ?? Math.max(1, letters.length);
  const rows = Math.ceil(length / columns);
  const heights = columnLengths(length, columns);

  // Rebuild the grid from the trace: every step knows its own cell, so the panel
  // never has to re-run the cipher to draw it.
  const grid = new Array<string>(rows * columns).fill('');
  for (const step of steps) {
    const c = readCell(step);
    if (c === null) continue;
    grid[c.row * columns + c.column] = c.char;
  }

  // The readout, in the order the columns are taken — this row is the ciphertext.
  const readout = steps.map((step) => readCell(step)?.char ?? '');
  const focus = safeCursor;
  const start = Math.max(0, Math.min(focus - READOUT_RADIUS, readout.length - READOUT_RADIUS * 2 - 1));
  const windowStart = Math.max(0, start);
  const windowed = readout.slice(windowStart, windowStart + READOUT_RADIUS * 2 + 1);

  const encrypting = cell?.encrypting ?? true;

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          The grid — {columns} columns, {rows} rows
          {length % columns !== 0 && (
            <span className="font-normal text-ink-subtle">
              {' '}
              (the last row is short, so the columns are not all the same height)
            </span>
          )}
        </p>
        <table className="mt-1 border-collapse font-mono text-sm">
          <caption className="sr-only">
            The message written across the grid row by row. Each column is headed by a letter of the
            keyword and the position that letter takes in alphabetical order, which is the order the
            columns are read in.
          </caption>
          <thead>
            <tr>
              {letters.map((letter, column) => {
                const active = cell?.column === column;
                return (
                  <th
                    key={`head-${column}`}
                    scope="col"
                    className={[
                      'w-8 border-b px-1 pb-1 text-center',
                      active
                        ? 'border-b-marker-line bg-marker-wash text-ink-strong'
                        : 'border-b-line text-ink-muted',
                    ].join(' ')}
                  >
                    <span className="block font-bold">{letter}</span>
                    <span className="block text-[0.7rem] font-normal text-ink-subtle">
                      <span className="sr-only">read </span>#{ranks[column] ?? '?'}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={`row-${row}`}>
                {Array.from({ length: columns }, (_, column) => {
                  const active = cell?.row === row && cell?.column === column;
                  const inColumn = cell?.column === column;
                  const empty = row >= (heights[column] ?? 0);
                  return (
                    <td
                      key={`cell-${row}-${column}`}
                      aria-current={active ? 'true' : undefined}
                      className={[
                        'w-8 border px-1 py-0.5 text-center',
                        empty ? 'border-dashed border-line bg-transparent' : 'border-line',
                        active
                          ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                          : inColumn
                            ? 'bg-marker-wash/50 text-ink'
                            : 'text-ink-muted',
                      ].join(' ')}
                    >
                      {visible(grid[row * columns + column] ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          Taken column by column, in rank order — this row is the{' '}
          {encrypting ? 'ciphertext' : 'message'}
        </p>
        <div className="mt-1 flex font-mono text-sm">
          {windowed.map((char, offset) => {
            const index = windowStart + offset;
            const active = index === safeCursor;
            return (
              <span
                key={index}
                aria-current={active ? 'true' : undefined}
                className={[
                  'w-6 shrink-0 border-b-2 py-0.5 text-center',
                  active
                    ? 'border-b-marker-line bg-marker-wash font-bold text-ink-strong'
                    : 'border-b-transparent text-ink-muted',
                ].join(' ')}
              >
                {visible(char)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {/* The move in words as well as in colour — WCAG 1.4.1. */}
        <p className="font-mono text-lg">
          {cell === null ? (
            <span className="text-ink-muted">Nothing at this step.</span>
          ) : (
            <>
              <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                {visible(cell.char)}
              </span>
              <span className="ml-3 text-sm text-ink-muted">
                column {cell.column + 1} ({cell.keyLetter}, read #{cell.rank}), row {cell.row + 1}
              </span>
              <span className="mx-2 text-ink-muted" aria-hidden="true">
                &rarr;
              </span>
              <span className="sr-only">moves to</span>
              <span className="text-sm text-ink-muted">position {cell.outputIndex + 1}</span>
            </>
          )}
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
            className="cl-button cl-button-primary"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
          >
            {playing ? 'Pause' : 'Play'}
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
            onChange={(e) => {
              setPlaying(false);
              setCursor(Number(e.target.value));
            }}
          />
        </label>
      </div>
    </div>
  );
}
