/**
 * The circle.
 *
 * Caesar's disk has two rings because Caesar's shift is a choice and you turn one
 * ring against the other to make it. ROT13 has no choice, so a second ring would
 * be a control with nothing to control. What it has instead is a geometric fact:
 * thirteen is half of twenty-six, so every letter sits **exactly opposite** its
 * partner. Draw the alphabet round a circle, draw the thirteen diameters, and the
 * cipher is the picture — each line is both directions at once.
 *
 * That is also the argument for why thirteen is the only shift that works this
 * way, made visually rather than in prose.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Step } from '../../types';
import { ALPHABET_SIZE, pairs } from './rot13';

const SIZE = 320;
const RADIUS = 120;
const LETTER_RADIUS = 142;
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

/** Index 0 (A) at the top, going clockwise. */
function angle(index: number): number {
  return (index / ALPHABET_SIZE) * Math.PI * 2 - Math.PI / 2;
}

function point(index: number, radius: number): { x: number; y: number } {
  const a = angle(index);
  return { x: SIZE / 2 + Math.cos(a) * radius, y: SIZE / 2 + Math.sin(a) * radius };
}

export default function Rot13Circle({ steps }: { steps: Step[] }) {
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

  const diameters = useMemo(() => pairs(), []);

  if (length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and each letter will be rotated half a turn here.
      </p>
    );
  }

  const summary =
    move === null
      ? 'The alphabet around a circle, with a line joining each letter to the one opposite.'
      : `${move.from} and ${move.to} sit at opposite ends of the same line through the centre.`;

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">Thirteen lines, each one straight through the middle</p>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          // Deliberately not `max-w-full`: shrinking a fixed-size diagram to a
          // narrow screen makes the letters unreadable. The card scrolls instead.
          className="mt-1 block shrink-0"
          role="img"
          aria-label={summary}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={1}
          />

          {/* One diameter per pair. Each line is the cipher in both directions. */}
          {diameters.map((pair, i) => {
            const a = point(i, RADIUS);
            const b = point(i + 13, RADIUS);
            const active = move !== null && (move.fromIndex % 13) === i;
            return (
              <line
                key={pair.left}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? 'var(--color-marker-line)' : 'var(--color-line)'}
                strokeWidth={active ? 2.5 : 1}
              />
            );
          })}

          {LETTERS.map((letter, index) => {
            const at = point(index, LETTER_RADIUS);
            const isFrom = move?.fromIndex === index;
            const isTo = move?.toIndex === index;
            const marked = isFrom || isTo;
            return (
              <g key={letter}>
                {marked && (
                  <circle
                    cx={at.x}
                    cy={at.y}
                    r={11}
                    fill="var(--color-marker-wash)"
                    stroke="var(--color-marker-line)"
                    strokeWidth={2}
                  />
                )}
                <text
                  x={at.x}
                  y={at.y + 4.5}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize={13}
                  fontWeight={marked ? 700 : 400}
                  fill={marked ? 'var(--color-marker-ink)' : 'var(--color-ink)'}
                >
                  {letter}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {/* The move in words as well as in colour — WCAG 1.4.1. */}
        <p className="font-mono text-lg">
          {move === null ? (
            <span className="text-ink-muted">This character is not a letter, so nothing rotates.</span>
          ) : (
            <>
              <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                {move.from}
              </span>
              <span className="mx-2 text-ink-muted" aria-hidden="true">
                &harr;
              </span>
              <span className="sr-only">is opposite</span>
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

      <section aria-labelledby="why-13" className="flex flex-col gap-3">
        <h3 id="why-13" className="text-sm font-semibold text-ink-strong">
          Why thirteen and nothing else
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Every line above is a diameter, so following it from either end lands you at the other.
          That only happens when the shift is exactly half the alphabet. Rotate by 12 and the two
          journeys disagree — you would need a second, opposite operation to get home, which is what
          every other Caesar shift needs and what the Caesar page has a direction switch for. There
          is no direction switch on this page.
        </p>
      </section>
    </div>
  );
}
