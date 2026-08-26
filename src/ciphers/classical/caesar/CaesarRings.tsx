/**
 * The Caesar disk.
 *
 * Two alphabet rings. The inner one is the plaintext alphabet and never moves.
 * The outer one is the ciphertext alphabet, turned by the shift — so the letter
 * sitting directly outside any plain letter is what that letter becomes. The
 * current character's mapping is the radial line, in orange.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Params, Step } from '../../types';
import { ALPHABET } from '../../../lib/frequency';
import { ALPHABET_SIZE } from './caesar';

const SIZE = 340;
const CENTRE = SIZE / 2;
const RING_INNER = 96;
const RING_OUTER = 138;
const DEGREES_PER_LETTER = 360 / ALPHABET_SIZE;
const PLAY_INTERVAL_MS = 700;

function pointOnCircle(radius: number, letterIndex: number): { x: number; y: number } {
  // -90 degrees puts A at the top, where a reader looks first.
  const radians = ((letterIndex * DEGREES_PER_LETTER - 90) * Math.PI) / 180;
  return { x: CENTRE + radius * Math.cos(radians), y: CENTRE + radius * Math.sin(radians) };
}

/** What the ring needs from a step, read defensively out of the free-form `data` bag. */
interface Mapping {
  plainIndex: number;
  cipherIndex: number;
  from: string;
  to: string;
}

function readMapping(step: Step | undefined): Mapping | null {
  const data = step?.data;
  if (data === undefined || data['isLetter'] !== true) return null;

  const fromIndex = data['fromIndex'];
  const toIndex = data['toIndex'];
  const from = data['from'];
  const to = data['to'];
  if (
    typeof fromIndex !== 'number' ||
    typeof toIndex !== 'number' ||
    typeof from !== 'string' ||
    typeof to !== 'string'
  ) {
    return null;
  }

  // Encrypting, the input is the plain letter. Decrypting, it is the cipher letter.
  const decrypting = data['direction'] === 'decrypt';
  return {
    plainIndex: decrypting ? toIndex : fromIndex,
    cipherIndex: decrypting ? fromIndex : toIndex,
    from,
    to,
  };
}

export default function CaesarRings({ steps, params }: { steps: Step[]; params: Params }) {
  const shift = typeof params['shift'] === 'number' ? params['shift'] : Number(params['shift'] ?? 0);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Only the steps that actually move a letter. Stepping through spaces and
  // commas would leave the disk sitting still, which reads as broken.
  const letterSteps = useMemo(
    () => steps.filter((step) => step.data?.['isLetter'] === true),
    [steps],
  );

  const maxCursor = Math.max(0, letterSteps.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = letterSteps[safeCursor];
  const mapping = readMapping(current);

  // A new trace means new text: go back to the start rather than leaving the
  // cursor pointing at a character that is no longer there.
  const traceLength = steps.length;
  useEffect(() => {
    setCursor(0);
  }, [traceLength]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || letterSteps.length === 0) return;
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= letterSteps.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => {
      if (timer.current !== null) clearInterval(timer.current);
    };
  }, [playing, letterSteps.length]);

  if (letterSteps.length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type some letters on the Encrypt tab and the disk will show what happens to each one.
      </p>
    );
  }

  const outerRotation = -shift * DEGREES_PER_LETTER;
  const summary =
    mapping === null
      ? `Caesar disk turned to shift ${shift}.`
      : `Caesar disk turned to shift ${shift}. The letter ${mapping.from} maps to ${mapping.to}.`;

  const line =
    mapping === null
      ? null
      : {
          from: pointOnCircle(RING_INNER - 20, mapping.plainIndex),
          to: pointOnCircle(RING_OUTER + 16, mapping.plainIndex),
          inner: pointOnCircle(RING_INNER, mapping.plainIndex),
          outer: pointOnCircle(RING_OUTER, mapping.plainIndex),
        };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-auto w-full max-w-sm shrink-0"
        role="img"
        aria-label={summary}
      >
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RING_OUTER + 18}
          fill="var(--color-surface)"
          stroke="var(--color-line)"
        />
        <circle cx={CENTRE} cy={CENTRE} r={RING_INNER + 20} fill="none" stroke="var(--color-line)" />
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RING_INNER - 22}
          fill="var(--color-sunken)"
          stroke="var(--color-line)"
        />

        {/* The mapping, drawn under the letters so it never hides one. */}
        {line !== null && (
          <g>
            <line
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
              stroke="var(--color-marker-line)"
              strokeWidth={2}
            />
            <circle
              cx={line.inner.x}
              cy={line.inner.y}
              r={11}
              fill="var(--color-marker-wash)"
              stroke="var(--color-marker-line)"
              strokeWidth={2}
            />
            <circle
              cx={line.outer.x}
              cy={line.outer.y}
              r={11}
              fill="var(--color-marker-wash)"
              stroke="var(--color-marker-line)"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Inner ring: the plaintext alphabet. Never moves. */}
        <g fontFamily="var(--font-mono)" fontSize={13} textAnchor="middle">
          {ALPHABET.split('').map((letter, i) => {
            const point = pointOnCircle(RING_INNER, i);
            const isActive = mapping?.plainIndex === i;
            return (
              <text
                key={`plain-${letter}`}
                x={point.x}
                y={point.y + 4.5}
                fontWeight={isActive ? 700 : 400}
                fill={isActive ? 'var(--color-marker-ink)' : 'var(--color-ink-muted)'}
              >
                {letter}
              </text>
            );
          })}
        </g>

        {/* Outer ring: the ciphertext alphabet, turned by the shift. Each letter is
            counter-rotated about its own point so it stays upright and readable. */}
        <g
          transform={`rotate(${outerRotation} ${CENTRE} ${CENTRE})`}
          style={{ transition: 'transform 320ms ease-out' }}
          fontFamily="var(--font-mono)"
          fontSize={14}
          textAnchor="middle"
        >
          {ALPHABET.split('').map((letter, i) => {
            const point = pointOnCircle(RING_OUTER, i);
            const isActive = mapping?.cipherIndex === i;
            return (
              <text
                key={`cipher-${letter}`}
                x={point.x}
                y={point.y + 5}
                transform={`rotate(${-outerRotation} ${point.x} ${point.y})`}
                fontWeight={isActive ? 700 : 500}
                fill={isActive ? 'var(--color-marker-ink)' : 'var(--color-ink)'}
              >
                {letter}
              </text>
            );
          })}
        </g>

        <text
          x={CENTRE}
          y={CENTRE - 6}
          textAnchor="middle"
          fontSize={12}
          fill="var(--color-ink-subtle)"
          fontFamily="var(--font-sans)"
        >
          shift
        </text>
        <text
          x={CENTRE}
          y={CENTRE + 18}
          textAnchor="middle"
          fontSize={22}
          fontWeight={700}
          fill="var(--color-ink)"
          fontFamily="var(--font-mono)"
        >
          {shift}
        </text>
      </svg>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* The mapping in words as well as in colour — WCAG 1.4.1. */}
        <p className="font-mono text-lg">
          {mapping === null ? (
            <span className="text-ink-muted">No letter at this step.</span>
          ) : (
            <>
              <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                {mapping.from}
              </span>
              <span className="mx-2 text-ink-muted" aria-hidden="true">
                &rarr;
              </span>
              <span className="sr-only">becomes</span>
              <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                {mapping.to}
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
            Previous letter
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
            Next letter
          </button>
        </div>

        <label className="block">
          <span className="cl-label">
            Letter {safeCursor + 1} of {letterSteps.length}
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
