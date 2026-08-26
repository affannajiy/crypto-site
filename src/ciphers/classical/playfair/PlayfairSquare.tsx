/**
 * The Playfair square.
 *
 * Caesar and Vigenere got a disk because they turn an alphabet. Rail Fence got a
 * fence because it moves characters around. Playfair works on a 5x5 grid, so it
 * gets the grid — and the interesting part is that the *shape drawn on it* is the
 * rule being applied. A rectangle means the rectangle rule; a bar across a row
 * means the row rule. The geometry is not decoration here, it is the algorithm.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useRef, useState } from 'react';
import type { Params, Step } from '../../types';
import { SIZE, buildSquare } from './playfair';

const CELL = 46;
const PADDING = 14;
const BOARD = SIZE * CELL + PADDING * 2;
const PLAY_INTERVAL_MS = 900;

interface Position {
  row: number;
  column: number;
}

/** What the square needs from a step, read defensively out of the free-form `data` bag. */
interface Pair {
  first: string;
  second: string;
  result: string;
  rule: 'row' | 'column' | 'rectangle';
  firstPosition: Position;
  secondPosition: Position;
  square: string;
  inserted: boolean;
}

function readPosition(value: unknown): Position | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = (value as Record<string, unknown>)['row'];
  const column = (value as Record<string, unknown>)['column'];
  if (typeof row !== 'number' || typeof column !== 'number') return null;
  return { row, column };
}

function readPair(step: Step | undefined): Pair | null {
  const data = step?.data;
  if (data === undefined) return null;

  const first = data['first'];
  const second = data['second'];
  const result = data['result'];
  const rule = data['rule'];
  const square = data['square'];
  const firstPosition = readPosition(data['firstPosition']);
  const secondPosition = readPosition(data['secondPosition']);

  if (
    typeof first !== 'string' ||
    typeof second !== 'string' ||
    typeof result !== 'string' ||
    typeof square !== 'string' ||
    (rule !== 'row' && rule !== 'column' && rule !== 'rectangle') ||
    firstPosition === null ||
    secondPosition === null
  ) {
    return null;
  }

  return {
    first,
    second,
    result,
    rule,
    firstPosition,
    secondPosition,
    square,
    inserted: data['inserted'] === true,
  };
}

const x = (column: number) => PADDING + column * CELL + CELL / 2;
const y = (row: number) => PADDING + row * CELL + CELL / 2;

export default function PlayfairSquare({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const maxCursor = Math.max(0, steps.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = steps[safeCursor];
  const pair = readPair(current);

  // A new trace means new text: go back to the start rather than leaving the
  // cursor pointing at a pair that is no longer there.
  const traceLength = steps.length;
  useEffect(() => {
    setCursor(0);
  }, [traceLength]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || traceLength === 0) return;
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= traceLength - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => {
      if (timer.current !== null) clearInterval(timer.current);
    };
  }, [playing, traceLength]);

  // The square is drawn even with no text, because it is the key and worth
  // looking at on its own.
  const square = pair?.square ?? buildSquare(String(params['keyword'] ?? ''));

  const from = pair === null ? [] : [pair.firstPosition, pair.secondPosition];
  const to =
    pair === null
      ? []
      : pair.rule === 'rectangle'
        ? // Rows stay, columns swap.
          [
            { row: pair.firstPosition.row, column: pair.secondPosition.column },
            { row: pair.secondPosition.row, column: pair.firstPosition.column },
          ]
        : from.map((p) =>
            pair.rule === 'row'
              ? { row: p.row, column: (p.column + 1) % SIZE }
              : { row: (p.row + 1) % SIZE, column: p.column },
          );

  const isFrom = (row: number, column: number) =>
    from.some((p) => p.row === row && p.column === column);
  const isTo = (row: number, column: number) => to.some((p) => p.row === row && p.column === column);

  const summary =
    pair === null
      ? 'The Playfair key square.'
      : `The Playfair key square. ${pair.first} and ${pair.second} fall under the ${pair.rule} rule and become ${pair.result}.`;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <svg
        viewBox={`0 0 ${BOARD} ${BOARD}`}
        className="h-auto w-full max-w-sm shrink-0"
        role="img"
        aria-label={summary}
      >
        <rect
          x={PADDING}
          y={PADDING}
          width={SIZE * CELL}
          height={SIZE * CELL}
          fill="var(--color-surface)"
          stroke="var(--color-line)"
        />

        {/* The rule, drawn under the letters so it never hides one. Each rule gets
            the shape that names it. */}
        {pair !== null && pair.rule === 'rectangle' && (
          <rect
            x={Math.min(x(pair.firstPosition.column), x(pair.secondPosition.column))}
            y={Math.min(y(pair.firstPosition.row), y(pair.secondPosition.row))}
            width={Math.abs(x(pair.firstPosition.column) - x(pair.secondPosition.column))}
            height={Math.abs(y(pair.firstPosition.row) - y(pair.secondPosition.row))}
            fill="var(--color-marker-wash)"
            stroke="var(--color-marker-line)"
            strokeWidth={2}
          />
        )}
        {pair !== null && pair.rule === 'row' && (
          <rect
            x={PADDING}
            y={y(pair.firstPosition.row) - CELL / 2}
            width={SIZE * CELL}
            height={CELL}
            fill="var(--color-marker-wash)"
            stroke="var(--color-marker-line)"
            strokeWidth={2}
          />
        )}
        {pair !== null && pair.rule === 'column' && (
          <rect
            x={x(pair.firstPosition.column) - CELL / 2}
            y={PADDING}
            width={CELL}
            height={SIZE * CELL}
            fill="var(--color-marker-wash)"
            stroke="var(--color-marker-line)"
            strokeWidth={2}
          />
        )}

        {/* Grid lines, over the rule shape so the cells stay legible. */}
        {Array.from({ length: SIZE + 1 }, (_, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={PADDING + i * CELL}
              y1={PADDING}
              x2={PADDING + i * CELL}
              y2={PADDING + SIZE * CELL}
              stroke="var(--color-line)"
            />
            <line
              x1={PADDING}
              y1={PADDING + i * CELL}
              x2={PADDING + SIZE * CELL}
              y2={PADDING + i * CELL}
              stroke="var(--color-line)"
            />
          </g>
        ))}

        {square.split('').map((letter, index) => {
          const row = Math.floor(index / SIZE);
          const column = index % SIZE;
          const source = isFrom(row, column);
          const target = isTo(row, column);
          return (
            <g key={`${letter}-${index}`}>
              {source && (
                <circle
                  cx={x(column)}
                  cy={y(row)}
                  r={16}
                  fill="var(--color-surface)"
                  stroke="var(--color-marker-line)"
                  strokeWidth={2}
                />
              )}
              <text
                x={x(column)}
                y={y(row) + 5}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={16}
                fontWeight={source || target ? 700 : 400}
                fill={source || target ? 'var(--color-marker-ink)' : 'var(--color-ink)'}
              >
                {letter}
              </text>
              {/* The result letters get an underline rather than a ring, so the two
                  letters you start from and the two you end at never look alike. */}
              {target && (
                <line
                  x1={x(column) - 10}
                  y1={y(row) + 11}
                  x2={x(column) + 10}
                  y2={y(row) + 11}
                  stroke="var(--color-marker-line)"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {steps.length === 0 ? (
          <p className="cl-prose text-sm text-ink-muted">
            Type a message on the Encrypt tab and each pair of letters will be worked through the
            square here. The square above is your key.
          </p>
        ) : (
          <>
            {/* The pair in words as well as in colour — WCAG 1.4.1. */}
            <p className="font-mono text-lg">
              {pair === null ? (
                <span className="text-ink-muted">Nothing at this step.</span>
              ) : (
                <>
                  <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                    {pair.first}
                    {pair.second}
                  </span>
                  <span className="mx-2 text-ink-muted" aria-hidden="true">
                    &rarr;
                  </span>
                  <span className="sr-only">becomes</span>
                  <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                    {pair.result}
                  </span>
                  <span className="ml-3 text-sm text-ink-muted">{pair.rule} rule</span>
                </>
              )}
            </p>

            {pair?.inserted === true && (
              <p className="cl-card border-marker-mid bg-marker-wash px-3 py-2 text-sm text-ink">
                One letter in this pair was inserted by the cipher, not typed by you.
              </p>
            )}

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
                Pair {safeCursor + 1} of {steps.length}
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

            {/* Every pair at once, so the digraph structure is visible rather than
                implied. This is the unit the cipher works on. */}
            <div className="cl-card overflow-x-auto px-3 py-2">
              <p className="cl-label">The message, in pairs</p>
              <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-sm">
                {steps.map((step, index) => (
                  <button
                    key={step.index}
                    type="button"
                    aria-current={index === safeCursor ? 'true' : undefined}
                    onClick={() => {
                      setPlaying(false);
                      setCursor(index);
                    }}
                    className={[
                      'min-h-6 rounded border px-1.5 py-0.5',
                      index === safeCursor
                        ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                        : 'border-line text-ink-muted hover:border-line-strong',
                    ].join(' ')}
                  >
                    {String(step.input ?? '')}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
