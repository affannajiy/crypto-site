/**
 * The Caesar substitution table, drawn the way the lecture draws it.
 *
 * Two alphabets, one above the other. The top row is the plain alphabet. The
 * bottom row is the same alphabet started `shift` places along, so the letter
 * under any plain letter is what that letter becomes. A bar marks where the
 * bottom row wraps from Z back to A: that wrap is the "cyclic" in "key = 3
 * cyclic shifts".
 *
 * Decrypting reads the same table upwards: find the cipher letter in the bottom
 * row and read the letter above it.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Params, Step } from '../../../types';
import { ALPHABET } from '../../../../lib/frequency';
import { ALPHABET_SIZE } from './caesar';

const PLAY_INTERVAL_MS = 700;

/** What the table needs from a step, read defensively out of the free-form `data` bag. */
interface Mapping {
  plainIndex: number;
  cipherIndex: number;
  from: string;
  to: string;
  decrypting: boolean;
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
    decrypting,
  };
}

function normaliseShift(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw ?? 0);
  if (!Number.isFinite(n)) return 0;
  return ((Math.trunc(n) % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE;
}

const cellBase = 'h-7 w-7 min-w-7 border border-line text-center';
const activeCell = 'bg-marker-wash font-bold text-ink-strong underline decoration-marker-line decoration-2 underline-offset-2';

export default function CaesarStrips({ steps, params }: { steps: Step[]; params: Params }) {
  const shift = normaliseShift(params['shift']);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Only the steps that actually move a letter. Stepping through spaces and
  // commas would leave the table sitting still, which reads as broken.
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

  // On a narrow screen the table scrolls. Keep the active column in view.
  const scroller = useRef<HTMLDivElement>(null);
  const activeColumn = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    const box = scroller.current;
    const cell = activeColumn.current;
    if (box === null || cell === null) return;
    box.scrollLeft = cell.offsetLeft - box.clientWidth / 2 + cell.offsetWidth / 2;
  }, [mapping?.plainIndex]);

  if (letterSteps.length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type some letters on the Encrypt tab and the table will show what happens to each one.
      </p>
    );
  }

  const letters = ALPHABET.split('');
  // The cipher letter under plain letter i.
  const cipherRow = letters.map((_, i) => ALPHABET.charAt((i + shift) % ALPHABET_SIZE));
  // The column whose cipher letter is A: the bottom row wraps just before it.
  const wrapAt = (ALPHABET_SIZE - shift) % ALPHABET_SIZE;
  const active = mapping?.plainIndex ?? -1;

  return (
    <div className="flex flex-col gap-4">
      <p className="cl-prose text-sm text-ink-muted">
        Top row: the plain alphabet. Bottom row: the same alphabet moved{' '}
        <strong className="text-ink">{shift}</strong> place{shift === 1 ? '' : 's'} along, so the
        key is {shift} cyclic shift{shift === 1 ? '' : 's'}.{' '}
        {mapping?.decrypting === true
          ? 'Decrypting, find the letter in the bottom row and read the one above it.'
          : 'Encrypting, find the letter in the top row and read the one below it.'}
      </p>

      <div className="cl-card p-3">
        <div ref={scroller} className="overflow-x-auto">
          <table className="border-collapse font-mono text-sm">
            <caption className="sr-only">
              Caesar substitution table with shift {shift}. Each plain letter in the first row
              becomes the cipher letter beneath it.
            </caption>
            <tbody>
              <tr>
                <th scope="row" className="pr-2 text-left text-xs font-medium text-ink-subtle">
                  Plain
                </th>
                {letters.map((letter, i) => (
                  <td
                    key={letter}
                    ref={i === active ? activeColumn : undefined}
                    aria-current={i === active ? 'true' : undefined}
                    className={`${cellBase} ${i === active ? activeCell : 'text-ink'}`}
                  >
                    {letter}
                  </td>
                ))}
              </tr>
              {/* The arrow row: one arrow, under the letter being enciphered. */}
              <tr aria-hidden="true">
                <th />
                {letters.map((letter, i) => (
                  <td key={letter} className="h-6 text-center text-marker-ink">
                    {i === active ? (mapping?.decrypting === true ? '↑' : '↓') : ''}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="pr-2 text-left text-xs font-medium text-ink-subtle">
                  Cipher
                </th>
                {cipherRow.map((letter, i) => (
                  <td
                    key={letters[i]}
                    aria-current={i === active ? 'true' : undefined}
                    className={[
                      cellBase,
                      i === active ? activeCell : 'text-ink',
                      // The wrap: Z is followed by A again. A thick left edge marks it.
                      shift !== 0 && i === wrapAt ? 'border-l-4 border-l-marker-line' : '',
                    ].join(' ')}
                  >
                    {letter}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {shift !== 0 && (
          <p className="mt-2 text-xs text-ink-subtle">
            The thick bar in the bottom row is where the alphabet wraps from Z back to A.
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
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
