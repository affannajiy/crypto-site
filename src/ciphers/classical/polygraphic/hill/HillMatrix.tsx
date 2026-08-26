/**
 * The multiplication, written out.
 *
 * Every other classical visualizer in this app can show the cipher as a place a
 * letter goes: a disk position, a square, a rail, a column. Hill has no such
 * place, because no output letter belongs to any single input letter. So this
 * draws the arithmetic itself — the matrix, the vector, and the two dot products
 * — with the row being computed marked.
 *
 * Below it is the property that arithmetic buys: change one letter of the pair and
 * the *other* ciphertext letter moves too. Seeing 25 alternatives move at once
 * makes the point better than the word "diffusion" does — and so do the ones that
 * do not move, which is why the table is not filtered. Where a coefficient is even
 * it cannot reach every letter, and the gap is visible in the row.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Step } from '../../../types';
import { apply } from './hill';

const PLAY_INTERVAL_MS = 900;

interface Block {
  first: number;
  second: number;
  firstChar: string;
  secondChar: string;
  outFirst: string;
  outSecond: string;
  x: number;
  y: number;
  rawX: number;
  rawY: number;
  matrix: [number, number, number, number];
  isPad: boolean;
}

function readBlock(step: Step | undefined): Block | null {
  const data = step?.data;
  if (data === undefined) return null;

  const matrix = data['matrix'];
  if (!Array.isArray(matrix) || matrix.length !== 4 || matrix.some((n) => typeof n !== 'number')) {
    return null;
  }

  const numbers = ['first', 'second', 'x', 'y', 'rawX', 'rawY'] as const;
  for (const name of numbers) {
    if (typeof data[name] !== 'number') return null;
  }
  const strings = ['firstChar', 'secondChar', 'outFirst', 'outSecond'] as const;
  for (const name of strings) {
    if (typeof data[name] !== 'string') return null;
  }

  return {
    first: data['first'] as number,
    second: data['second'] as number,
    firstChar: data['firstChar'] as string,
    secondChar: data['secondChar'] as string,
    outFirst: data['outFirst'] as string,
    outSecond: data['outSecond'] as string,
    x: data['x'] as number,
    y: data['y'] as number,
    rawX: data['rawX'] as number,
    rawY: data['rawY'] as number,
    matrix: matrix as [number, number, number, number],
    isPad: data['isPad'] === true,
  };
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function HillMatrix({ steps }: { steps: Step[] }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Which of the two output rows is emphasised. Both are always computed; this
  // only decides which dot product is spelled out large.
  const [row, setRow] = useState<0 | 1>(0);

  const maxCursor = Math.max(0, steps.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = steps[safeCursor];
  const block = readBlock(current);

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

  if (length === 0 || block === null) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type at least two letters on the Encrypt tab and the multiplication will be worked through
        here, one pair at a time.
      </p>
    );
  }

  const m = block.matrix;
  const rowA = row === 0 ? m[0] : m[2];
  const rowB = row === 0 ? m[1] : m[3];
  const raw = row === 0 ? block.rawX : block.rawY;
  const wrapped = row === 0 ? block.x : block.y;
  const outLetter = row === 0 ? block.outFirst : block.outSecond;

  return (
    <div className="flex flex-col gap-6">
      {/* The equation. Matrix, vector, result. */}
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          Pair {safeCursor + 1} of {length} — {block.firstChar}
          {block.secondChar} as the vector ({block.first}, {block.second})
          {block.isPad && (
            <span className="font-normal text-ink-subtle"> · the last letter is padding</span>
          )}
        </p>
        <div className="mt-2 flex items-center gap-3 font-mono text-sm">
          <Bracket>
            <MatrixCell value={m[0]} marked={row === 0} />
            <MatrixCell value={m[1]} marked={row === 0} />
            <MatrixCell value={m[2]} marked={row === 1} />
            <MatrixCell value={m[3]} marked={row === 1} />
          </Bracket>

          <span aria-hidden="true" className="text-ink-muted">
            ×
          </span>
          <span className="sr-only">multiplied by</span>

          <Bracket columns={1}>
            <MatrixCell value={block.first} label={block.firstChar} />
            <MatrixCell value={block.second} label={block.secondChar} />
          </Bracket>

          <span aria-hidden="true" className="text-ink-muted">
            =
          </span>
          <span className="sr-only">equals</span>

          <Bracket columns={1}>
            <MatrixCell value={block.x} label={block.outFirst} marked={row === 0} />
            <MatrixCell value={block.y} label={block.outSecond} marked={row === 1} />
          </Bracket>

          <span className="text-xs text-ink-subtle">(mod 26)</span>
        </div>
      </div>

      {/* One dot product, spelled out. */}
      <div className="flex flex-col gap-3">
        <p className="cl-prose font-mono text-sm text-ink">
          ({rowA} × {block.first}) + ({rowB} × {block.second}) = {raw}
          {raw !== wrapped && (
            <>
              {' '}
              <span aria-hidden="true">→</span>
              <span className="sr-only">wraps to</span> {raw} mod 26 = {wrapped}
            </>
          )}{' '}
          <span aria-hidden="true">→</span>
          <span className="sr-only">giving</span>{' '}
          <span className="rounded bg-marker-wash px-1.5 py-0.5 font-bold underline decoration-marker-line decoration-2 underline-offset-4">
            {outLetter}
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={row === 0 ? 'cl-button cl-button-primary' : 'cl-button'}
            onClick={() => setRow(0)}
            aria-pressed={row === 0}
          >
            First output letter
          </button>
          <button
            type="button"
            className={row === 1 ? 'cl-button cl-button-primary' : 'cl-button'}
            onClick={() => setRow(1)}
            aria-pressed={row === 1}
          >
            Second output letter
          </button>
        </div>

        <p className="cl-prose text-sm text-ink-muted">{current?.detail}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="cl-button"
            onClick={() => setCursor((c) => Math.max(0, c - 1))}
            disabled={safeCursor === 0}
          >
            Previous pair
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
            Next pair
          </button>
        </div>

        <label className="block">
          <span className="cl-label">
            Pair {safeCursor + 1} of {length}
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

      {/* Diffusion, demonstrated rather than asserted. */}
      <section aria-labelledby="diffusion" className="flex flex-col gap-3">
        <h3 id="diffusion" className="text-sm font-semibold text-ink-strong">
          Change one letter and both change
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Every column below keeps {block.secondChar} as the second letter and tries a different
          first letter. In Caesar or Vigenère only the first output letter would move. Here the
          second one moves too, because it was computed from both inputs — that is diffusion. Look
          for the columns where it does not: an even coefficient cannot reach every letter, so a
          change of exactly thirteen places can leave one output untouched. Every usable key over 26
          letters has one such blind spot somewhere.
        </p>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <table className="border-collapse font-mono text-sm">
            <caption className="sr-only">
              Each possible first plaintext letter, with the pair of ciphertext letters it produces.
            </caption>
            <tbody>
              <tr>
                <th scope="row" className="pr-3 text-left text-xs font-medium text-ink-subtle">
                  Message
                </th>
                {LETTERS.map((letter) => (
                  <td
                    key={letter}
                    className={[
                      'w-7 border-b-2 px-1 py-0.5 text-center',
                      letter === block.firstChar
                        ? 'border-b-marker-line bg-marker-wash font-bold text-ink-strong'
                        : 'border-b-transparent text-ink-muted',
                    ].join(' ')}
                  >
                    {letter}
                    {block.secondChar}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="pr-3 text-left text-xs font-medium text-ink-subtle">
                  Result
                </th>
                {LETTERS.map((letter, index) => {
                  const [x, y] = apply(m, index, block.second);
                  const pair =
                    String.fromCharCode(65 + x) + String.fromCharCode(65 + y);
                  return (
                    <td
                      key={letter}
                      className={[
                        'w-7 border-b-2 px-1 py-0.5 text-center',
                        letter === block.firstChar
                          ? 'border-b-marker-line bg-marker-wash font-bold text-ink-strong'
                          : 'border-b-transparent text-ink-muted',
                      ].join(' ')}
                    >
                      {pair}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Bracket({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return (
    <span className="inline-flex items-stretch">
      <span aria-hidden="true" className="w-1 rounded-l border-y border-l border-line-strong" />
      <span
        className="grid gap-x-2 gap-y-0.5 px-1.5 py-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </span>
      <span aria-hidden="true" className="w-1 rounded-r border-y border-r border-line-strong" />
    </span>
  );
}

function MatrixCell({
  value,
  label,
  marked = false,
}: {
  value: number;
  label?: string;
  marked?: boolean;
}) {
  return (
    <span
      className={[
        'min-w-6 rounded px-1 text-center tabular-nums',
        marked ? 'bg-marker-wash font-bold text-ink-strong' : 'text-ink',
      ].join(' ')}
    >
      {value}
      {label !== undefined && <span className="ml-1 text-xs text-ink-subtle">{label}</span>}
    </span>
  );
}
