/**
 * The one-time pad, and the one mistake that destroys it.
 *
 * The other visualizers in this app draw how their cipher works. This one draws
 * how its cipher **fails**, because a one-time pad used correctly has nothing to
 * show — the arithmetic is Vigenere's, and the ciphertext is genuinely,
 * provably featureless. There is no pattern to point at. That absence is the
 * whole property.
 *
 * So the top half shows the pad being spent, one letter per letter, and the
 * bottom half shows what happens when it is spent twice. Encrypt a second message
 * with the same pad and subtract one ciphertext from the other: the pad cancels
 * exactly, and what falls out is the difference of the two plaintexts. The panel
 * computes that difference both ways — from the ciphertexts and from the
 * plaintexts — and shows them matching, because a claim you can check beats a
 * claim you are asked to believe.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Params, Step } from '../../types';
import { difference, letterCount, normalisePad, oneTimePad } from './otp';

const PLAY_INTERVAL_MS = 700;

/** Letters of the tape shown either side of the current one. */
const TAPE_RADIUS = 8;

interface Letter {
  from: string;
  to: string;
  padChar: string;
  shift: number;
  fromIndex: number;
  toIndex: number;
  encrypting: boolean;
}

function readLetter(step: Step | undefined): Letter | null {
  const data = step?.data;
  if (data === undefined || data['isLetter'] !== true) return null;

  const from = data['from'];
  const to = data['to'];
  const padChar = data['padChar'];
  const shift = data['shift'];
  const fromIndex = data['fromIndex'];
  const toIndex = data['toIndex'];
  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    typeof padChar !== 'string' ||
    typeof shift !== 'number' ||
    typeof fromIndex !== 'number' ||
    typeof toIndex !== 'number'
  ) {
    return null;
  }

  return {
    from,
    to,
    padChar,
    shift,
    fromIndex,
    toIndex,
    encrypting: data['direction'] !== 'decrypt',
  };
}

export default function OneTimePadReuse({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The demo's second message is this panel's own business. It never touches the
  // cipher's params, because it is not part of the key.
  const [second, setSecond] = useState('ATTACK AT DAWN INSTEAD');

  const pad = String(params['pad'] ?? '');

  const letters = useMemo(
    () =>
      steps
        .map(readLetter)
        .filter((letter): letter is Letter => letter !== null),
    [steps],
  );

  const maxCursor = Math.max(0, letters.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = letters[safeCursor];

  const traceLength = steps.length;
  useEffect(() => {
    setCursor(0);
  }, [traceLength]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || letters.length === 0) return;
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= letters.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => {
      if (timer.current !== null) clearInterval(timer.current);
    };
  }, [playing, letters.length]);

  // Whichever direction the workbench is running, the demo talks in plaintext and
  // ciphertext, so the two are named rather than assumed.
  const encrypting = current?.encrypting ?? true;
  const plainLetters = letters.map((l) => (encrypting ? l.from : l.to)).join('').toUpperCase();
  const cipherLetters = letters.map((l) => (encrypting ? l.to : l.from)).join('').toUpperCase();

  // The reuse demo. It only runs when the same pad genuinely covers both
  // messages, because a pad too short for the second message is a different
  // failure and would muddle the one being shown.
  const reuse = useMemo(() => {
    const key = normalisePad(pad);
    if (plainLetters.length === 0) return null;
    if (letterCount(second) === 0) return null;
    if (key.length < letterCount(second)) return null;

    const secondCipher = normalisePad(oneTimePad(second, pad, 'encrypt'));
    const secondPlain = normalisePad(second);
    return {
      secondCipher,
      secondPlain,
      fromCiphertexts: difference(cipherLetters, secondCipher),
      fromPlaintexts: difference(plainLetters, secondPlain),
    };
  }, [pad, second, plainLetters, cipherLetters]);

  const matches =
    reuse !== null && reuse.fromCiphertexts === reuse.fromPlaintexts && reuse.fromCiphertexts !== '';

  if (letters.length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and the pad will be spent against it here, one letter at
        a time.
      </p>
    );
  }

  const start = Math.max(0, Math.min(safeCursor - TAPE_RADIUS, letters.length - TAPE_RADIUS * 2 - 1));
  const window = letters.slice(Math.max(0, start), Math.max(0, start) + TAPE_RADIUS * 2 + 1);
  const windowStart = Math.max(0, start);

  return (
    <div className="flex flex-col gap-6">
      {/* Spending the pad. One letter of pad per letter of message, never reused. */}
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          Spending the pad — letter {safeCursor + 1} of {letters.length}, and{' '}
          {Math.max(0, normalisePad(pad).length - letters.length)} letters of pad still unused
        </p>
        <table className="mt-1 border-collapse font-mono text-sm">
          <caption className="sr-only">
            The message letters, the pad letter added to each, and the resulting ciphertext letter.
          </caption>
          <tbody>
            {(
              [
                ['Message', 'from'],
                ['Pad', 'padChar'],
                ['Result', 'to'],
              ] as const
            ).map(([label, field]) => (
              <tr key={field}>
                <th scope="row" className="pr-3 text-left text-xs font-medium text-ink-subtle">
                  {label}
                </th>
                {window.map((letter, offset) => {
                  const active = windowStart + offset === safeCursor;
                  return (
                    <td
                      key={windowStart + offset}
                      aria-current={active ? 'true' : undefined}
                      className={[
                        'w-7 border-b-2 px-1 py-0.5 text-center',
                        active
                          ? 'border-b-marker-line bg-marker-wash font-bold text-ink-strong'
                          : 'border-b-transparent text-ink-muted',
                      ].join(' ')}
                    >
                      {letter[field]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3">
        <p className="cl-prose text-sm text-ink-muted">{steps[0] !== undefined && current !== null ? letterDetail(steps, safeCursor) : ''}</p>

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
            Letter {safeCursor + 1} of {letters.length}
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

      {/* The failure. Everything above is the cipher working; this is the cipher
          being destroyed by one careless decision. */}
      <section aria-labelledby="reuse-heading" className="flex flex-col gap-3">
        <h3 id="reuse-heading" className="text-sm font-semibold text-ink-strong">
          What happens if the pad is used twice
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Send a second message with the <strong>same</strong> pad and an attacker who never learns
          a single letter of that pad can still subtract one ciphertext from the other. The pad
          appears in both, so it cancels — and what is left is the difference of the two messages.
        </p>

        <label className="block">
          <span className="cl-label">A second message, sent with the same pad</span>
          <input
            type="text"
            className="cl-field w-full font-mono"
            value={second}
            onChange={(e) => setSecond(e.target.value)}
          />
        </label>

        {reuse === null ? (
          <p className="cl-card px-3 py-2 text-sm text-ink-muted">
            Type a second message the pad is long enough to cover, and the cancellation will be
            worked out here.
          </p>
        ) : (
          <>
            <div className="cl-card overflow-x-auto px-4 py-3">
              <table className="border-collapse font-mono text-sm">
                <caption className="sr-only">
                  The two ciphertexts, their difference, and the difference of the two plaintexts,
                  shown to be the same.
                </caption>
                <tbody>
                  <Row label="Ciphertext 1" value={reuse.fromCiphertexts.length} text={cipherLetters} />
                  <Row label="Ciphertext 2" value={reuse.fromCiphertexts.length} text={reuse.secondCipher} />
                  <Row
                    label="C1 − C2"
                    value={reuse.fromCiphertexts.length}
                    text={reuse.fromCiphertexts}
                    marked
                  />
                  <Row
                    label="P1 − P2"
                    value={reuse.fromCiphertexts.length}
                    text={reuse.fromPlaintexts}
                    marked
                  />
                </tbody>
              </table>
            </div>

            <p
              className={[
                'cl-card px-3 py-2 text-sm',
                matches ? 'border-marker-mid bg-marker-wash text-ink' : 'text-ink-muted',
              ].join(' ')}
            >
              {matches ? (
                <>
                  The last two rows are identical, and neither one needed the pad. Subtracting the
                  ciphertexts gave exactly the difference of the plaintexts, so every letter of the
                  key has cancelled out. An attacker now holds a relationship between two English
                  messages, and English has enough structure that two overlapping messages can be
                  pulled apart from their difference alone. This is not a weakened one-time pad. It
                  is no longer a one-time pad at all.
                </>
              ) : (
                <>The two messages do not overlap for long enough to show the cancellation.</>
              )}
            </p>
          </>
        )}
      </section>
    </div>
  );
}

/** The detail line belonging to the nth letter, skipping the pass-through steps. */
function letterDetail(steps: Step[], nth: number): string {
  let seen = -1;
  for (const step of steps) {
    if (step.data?.['isLetter'] !== true) continue;
    seen += 1;
    if (seen === nth) return step.detail;
  }
  return '';
}

function Row({
  label,
  text,
  value,
  marked = false,
}: {
  label: string;
  text: string;
  value: number;
  marked?: boolean;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="whitespace-nowrap pr-3 text-left text-xs font-medium text-ink-subtle"
      >
        {label}
      </th>
      {text
        .slice(0, value)
        .split('')
        .map((char, index) => (
          <td
            key={index}
            className={[
              'w-6 px-0.5 py-0.5 text-center',
              marked ? 'bg-marker-wash font-bold text-ink-strong' : 'text-ink-muted',
            ].join(' ')}
          >
            {char}
          </td>
        ))}
    </tr>
  );
}
