/**
 * The current, followed.
 *
 * Enigma is not a rule you can draw as a mapping, because the mapping is different
 * for every letter and is the *result* rather than the key. What can be drawn is
 * the journey: one letter entering the plugboard, crossing three rotors, turning
 * around at the reflector, crossing the same three rotors by a different path, and
 * coming back through the plugboard to the lamp.
 *
 * So this is a lane diagram of the nine stages, with the rotor windows above it,
 * and a panel underneath showing the whole alphabet's mapping at this exact
 * machine state — where the diagonal is conspicuously empty, because no letter can
 * ever encipher to itself. That empty diagonal is the flaw Bletchley Park lived
 * on, and it is the one thing on this page worth staring at.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useEffect, useRef, useState } from 'react';
import type { Params, Step } from '../../../types';

const PLAY_INTERVAL_MS = 700;

interface Path {
  pressed: number;
  plugIn: number;
  rightIn: number;
  middleIn: number;
  leftIn: number;
  reflected: number;
  leftBack: number;
  middleBack: number;
  rightBack: number;
  plugOut: number;
}

interface Press {
  windows: string;
  rotors: string[];
  reflector: string;
  plugged: boolean;
  path: Path;
}

const PATH_KEYS = [
  'pressed',
  'plugIn',
  'rightIn',
  'middleIn',
  'leftIn',
  'reflected',
  'leftBack',
  'middleBack',
  'rightBack',
  'plugOut',
] as const;

function readPress(step: Step | undefined): Press | null {
  const data = step?.data;
  if (data === undefined || data['isLetter'] !== true) return null;

  const raw = data['path'];
  const windows = data['windows'];
  const rotors = data['rotors'];
  const reflector = data['reflector'];
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof windows !== 'string' ||
    !Array.isArray(rotors) ||
    typeof reflector !== 'string'
  ) {
    return null;
  }

  const bag = raw as Record<string, unknown>;
  for (const key of PATH_KEYS) {
    if (typeof bag[key] !== 'number') return null;
  }

  return {
    windows,
    rotors: rotors.map(String),
    reflector,
    plugged: data['plugged'] === true,
    path: Object.fromEntries(PATH_KEYS.map((k) => [k, bag[k]])) as unknown as Path,
  };
}

function letter(index: number): string {
  return String.fromCharCode(65 + index);
}

export default function EnigmaPath({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const maxCursor = Math.max(0, steps.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = steps[safeCursor];
  const press = readPress(current);

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

  if (length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and each key press will be followed through the machine
        here.
      </p>
    );
  }

  const stages: { label: string; value: number | null }[] =
    press === null
      ? []
      : [
          { label: 'Key', value: press.path.pressed },
          { label: 'Plugboard', value: press.path.plugIn },
          { label: `Rotor ${press.rotors[2] ?? '?'} (right)`, value: press.path.rightIn },
          { label: `Rotor ${press.rotors[1] ?? '?'} (middle)`, value: press.path.middleIn },
          { label: `Rotor ${press.rotors[0] ?? '?'} (left)`, value: press.path.leftIn },
          { label: `Reflector ${press.reflector}`, value: press.path.reflected },
          { label: `Rotor ${press.rotors[0] ?? '?'} back`, value: press.path.leftBack },
          { label: `Rotor ${press.rotors[1] ?? '?'} back`, value: press.path.middleBack },
          { label: `Rotor ${press.rotors[2] ?? '?'} back`, value: press.path.rightBack },
          { label: 'Lamp', value: press.path.plugOut },
        ];

  const windows = press?.windows ?? String(params['positions'] ?? '');

  return (
    <div className="flex flex-col gap-6">
      {/* The rotor windows. This is what an operator actually saw. */}
      <div className="cl-card px-4 py-3">
        <p className="cl-label">The windows, after the rotors turned for this key press</p>
        <div className="mt-2 flex gap-2 font-mono text-2xl">
          {windows.split('').map((char, i) => (
            <span
              key={i}
              className="rounded border border-line-strong bg-marker-wash px-3 py-1 text-ink-strong"
            >
              {char}
            </span>
          ))}
        </div>
        <p className="cl-prose mt-2 text-sm text-ink-muted">
          The rightmost rotor turns on every press, so these three letters are different for every
          character of the message — and so is the substitution they produce.
        </p>
      </div>

      {/* The journey. */}
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          {press === null
            ? 'This character is not a letter, so no current flows.'
            : 'The current, stage by stage — out to the reflector and back'}
        </p>
        {press !== null && (
          <ol className="mt-2 flex flex-col gap-1">
            {stages.map((stage, i) => {
              const turnaround = i === 5;
              return (
                <li key={stage.label} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-xs text-ink-subtle">{stage.label}</span>
                  <span
                    className={[
                      'w-8 shrink-0 rounded border px-1 py-0.5 text-center font-mono text-sm',
                      turnaround
                        ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                        : 'border-line text-ink',
                    ].join(' ')}
                  >
                    {stage.value === null ? '?' : letter(stage.value)}
                  </span>
                  {turnaround && (
                    <span className="text-xs text-ink-muted">
                      the current turns around here and goes back through the same three rotors
                    </span>
                  )}
                  {i === 1 && press.plugged && (
                    <span className="text-xs text-ink-muted">a cable is fitted</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
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

      {/* The flaw. */}
      <section aria-labelledby="never-itself" className="flex flex-col gap-3">
        <h3 id="never-itself" className="text-sm font-semibold text-ink-strong">
          The letter that is always missing
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Step through the message and watch the pair below. However the rotors are set, and whatever
          cables are fitted, a letter is <strong>never</strong> enciphered to itself — the reflector
          makes it physically impossible. That single guarantee is what let Bletchley Park test a
          guessed word against a ciphertext: slide the guess along, and every position where a letter
          lines up with itself is eliminated instantly, for free.
        </p>
        {press !== null && (
          <div className="cl-card px-4 py-3">
            <p className="font-mono text-lg">
              <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                {letter(press.path.pressed)}
              </span>
              <span className="mx-2 text-ink-muted" aria-hidden="true">
                &rarr;
              </span>
              <span className="sr-only">became</span>
              <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                {letter(press.path.plugOut)}
              </span>
              <span className="ml-3 text-sm text-ink-muted">
                {letter(press.path.pressed)} could have become any of the other 25 letters, but never{' '}
                {letter(press.path.pressed)}.
              </span>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
