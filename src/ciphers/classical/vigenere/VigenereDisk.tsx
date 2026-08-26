/**
 * The Vigenere disk.
 *
 * Deliberately the same instrument as the Caesar disk, because the whole lesson
 * is that Vigenere *is* Caesar — a different Caesar for every letter. Two rings:
 * the inner one is the plaintext alphabet and never moves, the outer one is the
 * ciphertext alphabet.
 *
 * The difference you can see: on Caesar the outer ring is set once and stays
 * there. Here it turns on every letter, to whatever the current key letter says.
 * Step through a message and watch the key tape underneath cycle — when it comes
 * back round to the start of the key, the ring returns to a position it has held
 * before, and that repetition is exactly what the Attack tab exploits.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Params, Step } from '../../types';
import { ALPHABET } from '../../../lib/frequency';
import { ALPHABET_SIZE } from './vigenere';

const SIZE = 340;
const CENTRE = SIZE / 2;
const RING_INNER = 96;
const RING_OUTER = 138;
const DEGREES_PER_LETTER = 360 / ALPHABET_SIZE;
const PLAY_INTERVAL_MS = 700;

/** How many key letters the tape shows either side of the current one. */
const TAPE_RADIUS = 6;

function pointOnCircle(radius: number, letterIndex: number): { x: number; y: number } {
  // -90 degrees puts A at the top, where a reader looks first.
  const radians = ((letterIndex * DEGREES_PER_LETTER - 90) * Math.PI) / 180;
  return { x: CENTRE + radius * Math.cos(radians), y: CENTRE + radius * Math.sin(radians) };
}

/** What the disk needs from a step, read defensively out of the free-form `data` bag. */
interface Mapping {
  plainIndex: number;
  cipherIndex: number;
  from: string;
  to: string;
  shift: number;
  keyChar: string;
  keyPosition: number;
  key: string;
}

function readMapping(step: Step | undefined): Mapping | null {
  const data = step?.data;
  if (data === undefined || data['isLetter'] !== true) return null;

  const fromIndex = data['fromIndex'];
  const toIndex = data['toIndex'];
  const from = data['from'];
  const to = data['to'];
  const shift = data['shift'];
  const keyChar = data['keyChar'];
  const keyPosition = data['keyPosition'];
  const key = data['key'];
  if (
    typeof fromIndex !== 'number' ||
    typeof toIndex !== 'number' ||
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    typeof shift !== 'number' ||
    typeof keyChar !== 'string' ||
    typeof keyPosition !== 'number' ||
    typeof key !== 'string'
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
    shift,
    keyChar,
    keyPosition,
    key,
  };
}

export default function VigenereDisk({ steps, params }: { steps: Step[]; params: Params }) {
  const typedKey = String(params['key'] ?? '');
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

  const key = mapping?.key ?? typedKey.replace(/[^A-Za-z]/g, '').toUpperCase();
  const shift = mapping?.shift ?? 0;
  const outerRotation = -shift * DEGREES_PER_LETTER;

  const summary =
    mapping === null
      ? 'Vigenere disk.'
      : `Vigenere disk turned to ${shift} by key letter ${mapping.keyChar}. The letter ${mapping.from} maps to ${mapping.to}.`;

  const line =
    mapping === null
      ? null
      : {
          from: pointOnCircle(RING_INNER - 20, mapping.plainIndex),
          to: pointOnCircle(RING_OUTER + 16, mapping.plainIndex),
          inner: pointOnCircle(RING_INNER, mapping.plainIndex),
          outer: pointOnCircle(RING_OUTER, mapping.plainIndex),
        };

  // The tape is the key repeated, laid alongside the message letters. It is
  // windowed rather than complete so a long message cannot push the disk off
  // screen; the window moves with the cursor.
  const tapeStart = Math.max(0, safeCursor - TAPE_RADIUS);
  const tapeEnd = Math.min(letterSteps.length, safeCursor + TAPE_RADIUS + 1);
  const tape = letterSteps.slice(tapeStart, tapeEnd).map((step, offset) => {
    const cell = readMapping(step);
    return {
      position: tapeStart + offset,
      plain: cell?.from ?? '',
      cipher: cell?.to ?? '',
      keyChar: cell?.keyChar ?? '',
    };
  });

  return (
    <div className="flex flex-col gap-6">
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
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={RING_INNER + 20}
            fill="none"
            stroke="var(--color-line)"
          />
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
              const isActive = mapping?.plainIndex === i;
              const point = pointOnCircle(RING_INNER, i);
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

          {/* Outer ring: the ciphertext alphabet. Unlike Caesar's, this turns on
              every letter — the key letter decides where it lands. */}
          <g
            transform={`rotate(${outerRotation} ${CENTRE} ${CENTRE})`}
            style={{ transition: 'transform 320ms ease-out' }}
            fontFamily="var(--font-mono)"
            fontSize={14}
            textAnchor="middle"
          >
            {ALPHABET.split('').map((letter, i) => {
              const isActive = mapping?.cipherIndex === i;
              const point = pointOnCircle(RING_OUTER, i);
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
            y={CENTRE - 20}
            textAnchor="middle"
            fontSize={12}
            fill="var(--color-ink-subtle)"
            fontFamily="var(--font-sans)"
          >
            key letter
          </text>
          <text
            x={CENTRE}
            y={CENTRE + 6}
            textAnchor="middle"
            fontSize={24}
            fontWeight={700}
            fill="var(--color-ink)"
            fontFamily="var(--font-mono)"
          >
            {mapping?.keyChar ?? '—'}
          </text>
          <text
            x={CENTRE}
            y={CENTRE + 26}
            textAnchor="middle"
            fontSize={12}
            fill="var(--color-ink-subtle)"
            fontFamily="var(--font-mono)"
          >
            shift {shift}
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

      {/* The key tape: the key written out under the message, repeating. This is
          the picture of the cipher's one real weakness, so it gets its own row. */}
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          Key tape — {key || 'no key'} repeating, position {(mapping?.keyPosition ?? 0) + 1} of{' '}
          {key.length || 1}
        </p>
        <table className="mt-1 border-collapse font-mono text-sm">
          <caption className="sr-only">
            The message letters, the key letter applied to each, and the resulting ciphertext
            letter.
          </caption>
          <tbody>
            {(
              [
                ['Message', 'plain'],
                ['Key', 'keyChar'],
                ['Result', 'cipher'],
              ] as const
            ).map(([label, field]) => (
              <tr key={field}>
                <th scope="row" className="pr-3 text-left text-xs font-medium text-ink-subtle">
                  {label}
                </th>
                {tape.map((cell) => {
                  const active = cell.position === safeCursor;
                  return (
                    <td
                      key={cell.position}
                      aria-current={active ? 'true' : undefined}
                      className={[
                        'w-7 border-b-2 px-1 py-0.5 text-center',
                        active
                          ? 'border-b-marker-line bg-marker-wash font-bold text-ink-strong'
                          : 'border-b-transparent text-ink-muted',
                      ].join(' ')}
                    >
                      {cell[field]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
