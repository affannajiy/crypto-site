/**
 * The Affine mapping.
 *
 * Caesar got a disk, Vigenere a turning disk, Rail Fence a zigzag, Playfair a
 * grid. Affine is a straight line in modular arithmetic, so it gets the picture a
 * function deserves: both alphabets side by side with a line from every input to
 * its output.
 *
 * The fan those lines make is the signature of the key. With a = 1 they are
 * parallel — that is Caesar, and it looks like Caesar. Raise `a` and they cross
 * in a regular pattern whose slope is the multiplier.
 *
 * The toggle at the bottom answers the question the keyword dropdown provokes:
 * why only twelve multipliers? Turning it on draws the mapping an even multiplier
 * would give, where lines converge two-to-one and the cipher stops being a cipher.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Params, Step } from '../../../types';
import { ALPHABET } from '../../../../lib/frequency';
import { ALPHABET_SIZE, affineMapping } from './affine';

const COLUMN = 24;
const WIDTH = ALPHABET_SIZE * COLUMN;
const TOP = 22;
const BOTTOM = 132;
const HEIGHT = BOTTOM + 22;
const PLAY_INTERVAL_MS = 700;

/** The multiplier the toggle demonstrates. Even, so it shares a factor with 26. */
const BROKEN_MULTIPLIER = 2;

const x = (index: number) => index * COLUMN + COLUMN / 2;

/** What the diagram needs from a step, read defensively out of the free-form `data` bag. */
interface Mapping {
  fromIndex: number;
  toIndex: number;
  from: string;
  to: string;
  a: number;
  b: number;
  encrypting: boolean;
}

function readMapping(step: Step | undefined): Mapping | null {
  const data = step?.data;
  if (data === undefined || data['isLetter'] !== true) return null;

  const fromIndex = data['fromIndex'];
  const toIndex = data['toIndex'];
  const from = data['from'];
  const to = data['to'];
  const a = data['a'];
  const b = data['b'];
  if (
    typeof fromIndex !== 'number' ||
    typeof toIndex !== 'number' ||
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    typeof a !== 'number' ||
    typeof b !== 'number'
  ) {
    return null;
  }

  const encrypting = data['direction'] !== 'decrypt';
  return { fromIndex, toIndex, from, to, a, b, encrypting };
}

export default function AffineMapping({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showBroken, setShowBroken] = useState(false);
  const brokenId = useId();

  // Only the steps that actually map a letter. Stepping through spaces and commas
  // would leave the diagram sitting still, which reads as broken.
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

  const a = mapping?.a ?? Number(params['a'] ?? 5);
  const b = mapping?.b ?? Number(params['b'] ?? 8);
  const encrypting = mapping?.encrypting ?? true;

  const lines = useMemo(
    () => affineMapping(a, b, encrypting ? 'encrypt' : 'decrypt'),
    [a, b, encrypting],
  );
  const brokenLines = useMemo(() => affineMapping(BROKEN_MULTIPLIER, b, 'encrypt'), [b]);
  const shown = showBroken ? brokenLines : lines;

  // How many letters each output is reached by. Anything above one means the
  // cipher cannot be undone, which is the entire point of the toggle.
  const arrivals = useMemo(() => {
    const counts = new Array<number>(ALPHABET_SIZE).fill(0);
    for (const target of shown) counts[target] = (counts[target] ?? 0) + 1;
    return counts;
  }, [shown]);

  const distinct = arrivals.filter((n) => n > 0).length;
  const reversible = distinct === ALPHABET_SIZE;

  const summary = showBroken
    ? `The mapping an invalid multiplier of ${BROKEN_MULTIPLIER} would give: only ${distinct} of 26 letters are reachable, so the cipher cannot be undone.`
    : mapping === null
      ? `The Affine mapping for a = ${a}, b = ${b}.`
      : `The Affine mapping for a = ${a}, b = ${b}. The letter ${mapping.from} maps to ${mapping.to}.`;

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          {showBroken ? (
            <>
              a = {BROKEN_MULTIPLIER} (invalid), b = {b}
            </>
          ) : (
            <>
              a = {a}, b = {b} — every letter, and what it becomes
            </>
          )}
        </p>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width={WIDTH}
          height={HEIGHT}
          // Deliberately not `max-w-full`. All 26 columns are always drawn, so
          // scaling the diagram to a narrow screen shrank the letters to about
          // 5px. The card around it scrolls instead, and the letters stay
          // readable at every width.
          className="mt-1 block shrink-0"
          role="img"
          aria-label={summary}
        >
          {shown.map((target, index) => {
            const active = !showBroken && mapping?.fromIndex === index;
            const collides = (arrivals[target] ?? 0) > 1;
            return (
              <line
                key={`line-${index}`}
                x1={x(index)}
                y1={TOP + 8}
                x2={x(target)}
                y2={BOTTOM - 14}
                stroke={
                  active
                    ? 'var(--color-marker-line)'
                    : collides
                      ? 'var(--color-ink-muted)'
                      : 'var(--color-line)'
                }
                strokeWidth={active ? 2.5 : collides ? 1.5 : 1}
              />
            );
          })}

          {/* Top row: the plaintext alphabet. */}
          {ALPHABET.split('').map((letter, index) => {
            const active = !showBroken && mapping?.fromIndex === index;
            return (
              <text
                key={`plain-${letter}`}
                x={x(index)}
                y={TOP}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={13}
                fontWeight={active ? 700 : 400}
                fill={active ? 'var(--color-marker-ink)' : 'var(--color-ink)'}
              >
                {letter}
              </text>
            );
          })}

          {/* Bottom row: the ciphertext alphabet. A letter nothing reaches is a
              letter the cipher can never produce, and it is drawn faint to say so. */}
          {ALPHABET.split('').map((letter, index) => {
            const active = !showBroken && mapping?.toIndex === index;
            const unreachable = (arrivals[index] ?? 0) === 0;
            return (
              <text
                key={`cipher-${letter}`}
                x={x(index)}
                y={BOTTOM}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={13}
                fontWeight={active ? 700 : 400}
                fill={
                  active
                    ? 'var(--color-marker-ink)'
                    : unreachable
                      ? 'var(--color-line-strong)'
                      : 'var(--color-ink)'
                }
              >
                {letter}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {/* Reversibility stated in words, not only in the shape of the lines. */}
        <p
          className={[
            'cl-card px-3 py-2 text-sm',
            reversible ? 'text-ink-muted' : 'border-marker-mid bg-marker-wash text-ink',
          ].join(' ')}
        >
          {reversible ? (
            <>
              All 26 letters are reachable, so every ciphertext letter came from exactly one
              plaintext letter and the cipher can be undone.
            </>
          ) : (
            <>
              Only {distinct} of 26 letters are reachable. Two plaintext letters share each of
              them, so nothing — not even the key holder — can tell which one was written. This is
              why {BROKEN_MULTIPLIER} is not offered as a multiplier.
            </>
          )}
        </p>

        {/* min-h-6 on the label and h-6 w-6 on the box, because a browser's
            default checkbox renders around 13px and the house rule is a 24px
            minimum target (WCAG 2.5.8). */}
        <label className="flex min-h-6 items-center gap-2 text-sm">
          <input
            id={brokenId}
            type="checkbox"
            className="h-6 w-6 shrink-0 accent-[var(--color-marker)]"
            checked={showBroken}
            onChange={(e) => setShowBroken(e.target.checked)}
          />
          Show why even multipliers are missing from the list
        </label>

        {!showBroken && letterSteps.length > 0 && (
          <>
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
          </>
        )}

        {!showBroken && letterSteps.length === 0 && (
          <p className="cl-prose text-sm text-ink-muted">
            Type some letters on the Encrypt tab and each one will be traced through the diagram
            above. The mapping itself is drawn whether you have typed anything or not — it is the
            key.
          </p>
        )}
      </div>
    </div>
  );
}
