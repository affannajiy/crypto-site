/**
 * The fold.
 *
 * Caesar got a rotating disk because Caesar rotates. Atbash does not rotate — it
 * reflects — so it gets the alphabet written forwards on one line, backwards on
 * the line beneath, and a rung joining each pair. The two rows are the same
 * alphabet read from opposite ends, and the picture is meant to make that obvious
 * before the prose says it.
 *
 * The second panel is the same fact folded: thirteen pairs, each of which is its
 * own reverse. There is no key control anywhere on this page, because there is no
 * key.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Step } from '../../types';
import { pairs } from './atbash';

const CELL = 26;
const TOP = 26;
const ROW_GAP = 54;
const PLAY_INTERVAL_MS = 550;

interface Move {
  from: string;
  to: string;
  fromIndex: number;
  toIndex: number;
}

function readMove(step: Step | undefined): Move | null {
  const data = step?.data;
  if (data === undefined || data['isLetter'] !== true) return null;
  const from = data['from'];
  const to = data['to'];
  const fromIndex = data['fromIndex'];
  const toIndex = data['toIndex'];
  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    typeof fromIndex !== 'number' ||
    typeof toIndex !== 'number'
  ) {
    return null;
  }
  return { from, to, fromIndex, toIndex };
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function AtbashMirror({ steps }: { steps: Step[] }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const maxCursor = Math.max(0, steps.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = steps[safeCursor];
  const move = readMove(current);

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

  const folded = useMemo(() => pairs(), []);

  if (length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and each letter will be mirrored here.
      </p>
    );
  }

  const width = LETTERS.length * CELL;
  const height = TOP + ROW_GAP + 26;
  const x = (index: number) => index * CELL + CELL / 2;

  const summary =
    move === null
      ? 'The alphabet written forwards, and the same alphabet written backwards beneath it.'
      : `${move.from} on the forward alphabet joins ${move.to} on the reversed one.`;

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">The alphabet against its own reverse</p>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          // Deliberately not `max-w-full`: a fixed column count scaled down to a
          // narrow screen renders the letters at about 5px. The card scrolls.
          className="mt-1 block shrink-0"
          role="img"
          aria-label={summary}
        >
          {LETTERS.map((letter, index) => {
            const active = move !== null && (move.fromIndex === index || move.toIndex === index);
            return (
              <line
                key={`rung-${letter}`}
                x1={x(index)}
                y1={TOP + 5}
                x2={x(index)}
                y2={TOP + ROW_GAP - 13}
                stroke={active ? 'var(--color-marker-line)' : 'var(--color-line)'}
                strokeWidth={active ? 2 : 1}
              />
            );
          })}

          {LETTERS.map((letter, index) => {
            const active = move?.fromIndex === index;
            return (
              <text
                key={`top-${letter}`}
                x={x(index)}
                y={TOP}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={14}
                fontWeight={active ? 700 : 400}
                fill={active ? 'var(--color-marker-ink)' : 'var(--color-ink)'}
              >
                {letter}
              </text>
            );
          })}

          {LETTERS.map((letter, index) => {
            // The lower row is the alphabet backwards, so the letter drawn under
            // position `index` is the one this cipher maps `index` to.
            const shown = LETTERS[LETTERS.length - 1 - index] ?? '';
            const active = move?.fromIndex === index;
            return (
              <text
                key={`bottom-${letter}`}
                x={x(index)}
                y={TOP + ROW_GAP}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={14}
                fontWeight={active ? 700 : 400}
                fill={active ? 'var(--color-marker-ink)' : 'var(--color-ink)'}
              >
                {shown}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {/* The move in words as well as in colour — WCAG 1.4.1. */}
        <p className="font-mono text-lg">
          {move === null ? (
            <span className="text-ink-muted">This character is not a letter, so nothing moves.</span>
          ) : (
            <>
              <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                {move.from}
              </span>
              <span className="mx-2 text-ink-muted" aria-hidden="true">
                &harr;
              </span>
              <span className="sr-only">swaps with</span>
              <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                {move.to}
              </span>
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

      {/* The same fact, folded. Thirteen pairs, and no key anywhere. */}
      <section aria-labelledby="pairs-heading" className="flex flex-col gap-3">
        <h3 id="pairs-heading" className="text-sm font-semibold text-ink-strong">
          The thirteen pairs
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Fold the two rows together and the alphabet becomes thirteen pairs. Each pair is its own
          reverse, so there is nothing to remember and nothing to choose — this is the complete key,
          and everyone has it.
        </p>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <ul className="flex flex-wrap gap-2 font-mono text-sm">
            {folded.map((pair) => {
              const letter = move?.from.toUpperCase() ?? '';
              const active = letter === pair.left || letter === pair.right;
              return (
                <li
                  key={pair.left}
                  aria-current={active ? 'true' : undefined}
                  className={[
                    'rounded border px-2 py-1',
                    active
                      ? 'border-marker-mid bg-marker-wash font-bold text-ink-strong'
                      : 'border-line text-ink-muted',
                  ].join(' ')}
                >
                  {pair.left}
                  <span aria-hidden="true"> &harr; </span>
                  <span className="sr-only">swaps with</span>
                  {pair.right}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
