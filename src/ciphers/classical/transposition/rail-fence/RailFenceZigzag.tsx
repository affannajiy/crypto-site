/**
 * The fence.
 *
 * Caesar and Vigenere both got a disk, because both are substitutions and the
 * question they answer is "what does this letter become". Rail Fence answers a
 * different question — "where does this letter go" — so it gets a different
 * instrument: the zigzag itself, drawn, with the message written along it.
 *
 * Below the fence sits the readout: the rails emptied one at a time, left to
 * right, which is the ciphertext. Stepping through shows the same character
 * marked in two places at once — where it was written and where it ends up — and
 * that pair is the entire cipher.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Params, Step } from '../../../types';
import { railOrder, railPattern } from './railfence';

const CELL_WIDTH = 22;
const ROW_HEIGHT = 30;
const TOP_PADDING = 18;
const PLAY_INTERVAL_MS = 550;

/** Columns of fence shown at once. A long message scrolls the window, not the page. */
const WINDOW_COLUMNS = 30;

/** What the fence needs from a step, read defensively out of the free-form `data` bag. */
interface Placement {
  rail: number;
  rails: number;
  fencePosition: number;
  inputIndex: number;
  outputIndex: number;
  char: string;
  encrypting: boolean;
}

function readPlacement(step: Step | undefined): Placement | null {
  const data = step?.data;
  if (data === undefined) return null;

  const rail = data['rail'];
  const rails = data['rails'];
  const fencePosition = data['fencePosition'];
  const inputIndex = data['inputIndex'];
  const outputIndex = data['outputIndex'];
  const char = data['char'];
  if (
    typeof rail !== 'number' ||
    typeof rails !== 'number' ||
    typeof fencePosition !== 'number' ||
    typeof inputIndex !== 'number' ||
    typeof outputIndex !== 'number' ||
    typeof char !== 'string'
  ) {
    return null;
  }

  return {
    rail,
    rails,
    fencePosition,
    inputIndex,
    outputIndex,
    char,
    encrypting: data['direction'] !== 'decrypt',
  };
}

/** A space drawn as a space is an empty cell, which reads as a bug rather than a space. */
function visible(char: string): string {
  if (char === ' ') return '␣';
  if (char === '\n') return '⏎';
  if (char === '\t') return '⇥';
  return char;
}

export default function RailFenceZigzag({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const maxCursor = Math.max(0, steps.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = steps[safeCursor];
  const placement = readPlacement(current);

  const rails = placement?.rails ?? Math.max(2, Number(params['rails'] ?? 3));
  const length = steps.length;

  // The fence is a property of the message length and the rail count, not of the
  // characters, so it is worth computing once rather than once per step.
  const pattern = useMemo(() => railPattern(length, rails), [length, rails]);
  const order = useMemo(() => railOrder(length, rails), [length, rails]);

  // A new trace means new text: go back to the start rather than leaving the
  // cursor pointing at a character that is no longer there.
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
        Type a message on the Encrypt tab and it will be written along the fence here.
      </p>
    );
  }

  // Characters in fence order. Encrypting, the input is already in that order.
  // Decrypting, the input is the readout, so it has to be put back first.
  const encrypting = placement?.encrypting ?? true;
  const onFence: string[] = new Array<string>(length).fill('');
  for (let i = 0; i < length; i += 1) {
    const step = steps[i];
    const cell = readPlacement(step);
    if (cell === null) continue;
    onFence[cell.fencePosition] = cell.char;
  }

  // The window follows the cursor, so a 500-character message does not draw a
  // 500-column SVG that no screen can hold.
  const focus = placement?.fencePosition ?? 0;
  const half = Math.floor(WINDOW_COLUMNS / 2);
  const start = Math.max(0, Math.min(focus - half, length - WINDOW_COLUMNS));
  const windowStart = Math.max(0, start);
  const windowEnd = Math.min(length, windowStart + WINDOW_COLUMNS);
  const columns = windowEnd - windowStart;

  const width = Math.max(1, columns) * CELL_WIDTH;
  const height = TOP_PADDING + rails * ROW_HEIGHT;

  const x = (position: number) => (position - windowStart) * CELL_WIDTH + CELL_WIDTH / 2;
  const y = (rail: number) => TOP_PADDING + rail * ROW_HEIGHT;

  // The zigzag line itself, across the visible window only.
  const path = [];
  for (let i = windowStart; i < windowEnd; i += 1) {
    path.push(`${i === windowStart ? 'M' : 'L'} ${x(i)} ${y(pattern[i] ?? 0)}`);
  }

  const readout = order.map((fencePosition, outputIndex) => ({
    outputIndex,
    fencePosition,
    char: onFence[fencePosition] ?? '',
    rail: pattern[fencePosition] ?? 0,
  }));

  // The readout is windowed too, around wherever the current character landed.
  const readoutFocus = placement?.outputIndex ?? 0;
  const readoutStart = Math.max(0, Math.min(readoutFocus - half, length - WINDOW_COLUMNS));
  const readoutWindow = readout.slice(Math.max(0, readoutStart), Math.max(0, readoutStart) + WINDOW_COLUMNS);

  const summary =
    placement === null
      ? `A rail fence of ${rails} rails.`
      : `A rail fence of ${rails} rails. The character ${visible(placement.char)} sits on rail ${placement.rail + 1} and is read out ${placement.outputIndex + 1}${placement.outputIndex === 0 ? 'st' : 'th'}.`;

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          The fence — {rails} rails
          {columns < length && (
            <span className="font-normal text-ink-subtle">
              {' '}
              (positions {windowStart + 1}–{windowEnd} of {length})
            </span>
          )}
        </p>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          // Deliberately not `max-w-full`: scaling the fence down to a narrow
          // screen shrank the characters to about 5px. The card around it
          // scrolls instead, and they stay readable at every width.
          className="mt-1 block shrink-0"
          role="img"
          aria-label={summary}
        >
          {/* One faint line per rail, so an empty cell still reads as a place. */}
          {Array.from({ length: rails }, (_, rail) => (
            <line
              key={`rail-${rail}`}
              x1={0}
              y1={y(rail)}
              x2={width}
              y2={y(rail)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
          ))}

          {/* The zigzag, drawn under the characters so it never hides one. */}
          <path d={path.join(' ')} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} />

          {Array.from({ length: columns }, (_, offset) => {
            const position = windowStart + offset;
            const rail = pattern[position] ?? 0;
            const isActive = placement?.fencePosition === position;
            return (
              <g key={`cell-${position}`}>
                {isActive && (
                  <circle
                    cx={x(position)}
                    cy={y(rail)}
                    r={11}
                    fill="var(--color-marker-wash)"
                    stroke="var(--color-marker-line)"
                    strokeWidth={2}
                  />
                )}
                <text
                  x={x(position)}
                  y={y(rail) + 4.5}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize={13}
                  fontWeight={isActive ? 700 : 400}
                  fill={isActive ? 'var(--color-marker-ink)' : 'var(--color-ink)'}
                >
                  {visible(onFence[position] ?? '')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* The readout: the rails emptied top to bottom. This row is the ciphertext,
          and the same character is marked here and on the fence at once. */}
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          Read off rail by rail — this row is the {encrypting ? 'ciphertext' : 'message'}
        </p>
        <div className="mt-1 flex font-mono text-sm">
          {readoutWindow.map((cell) => {
            const isActive = cell.outputIndex === placement?.outputIndex;
            return (
              <span
                key={cell.outputIndex}
                aria-current={isActive ? 'true' : undefined}
                className={[
                  'w-6 shrink-0 border-b-2 py-0.5 text-center',
                  isActive
                    ? 'border-b-marker-line bg-marker-wash font-bold text-ink-strong'
                    : 'border-b-transparent text-ink-muted',
                ].join(' ')}
              >
                {visible(cell.char)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {/* The move in words as well as in colour — WCAG 1.4.1. */}
        <p className="font-mono text-lg">
          {placement === null ? (
            <span className="text-ink-muted">Nothing at this step.</span>
          ) : (
            <>
              <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                {visible(placement.char)}
              </span>
              <span className="ml-3 text-sm text-ink-muted">
                position {placement.inputIndex + 1}
              </span>
              <span className="mx-2 text-ink-muted" aria-hidden="true">
                &rarr;
              </span>
              <span className="sr-only">moves to</span>
              <span className="text-sm text-ink-muted">position {placement.outputIndex + 1}</span>
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
