/**
 * The Beaufort slide rule, and the reason there is only one button.
 *
 * A Beaufort rule is a strip of alphabet with a reversed alphabet sliding under
 * it. Set the slide so the key letter sits over A, find the plaintext letter on
 * the reversed strip, and read the ciphertext above it. What the drawing has to
 * make visible is that reading it the other way — plaintext under ciphertext —
 * gives the same answer, because the two strips are symmetric about the key.
 *
 * So the strip is drawn once, and the current letter is marked in both roles at
 * the same time. If they land on the same pair of positions, self-reciprocity is
 * not a claim in the prose; it is a thing on the screen.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { A_TO_Z, ALPHABET_SIZE } from '../../../../lib/letters';
import { beaufortLetter } from './beaufort';

const CELL = 26;
const HEIGHT = 96;
const PAD = 8;
const WIDTH = ALPHABET_SIZE * CELL + PAD * 2;

interface Press {
  fromIndex: number;
  toIndex: number;
  keyValue: number;
  keyChar: string;
}

function readPress(step: Step | undefined): Press | null {
  const data = step?.data;
  if (data === undefined || data['isLetter'] !== true) return null;
  const fromIndex = data['fromIndex'];
  const toIndex = data['toIndex'];
  const keyValue = data['keyValue'];
  const keyChar = data['keyChar'];
  if (
    typeof fromIndex !== 'number' ||
    typeof toIndex !== 'number' ||
    typeof keyValue !== 'number' ||
    typeof keyChar !== 'string'
  ) {
    return null;
  }
  return { fromIndex, toIndex, keyValue, keyChar };
}

function Strip({
  label,
  letters,
  marks,
  y,
}: {
  label: string;
  letters: string[];
  marks: { at: number; text: string }[];
  y: number;
}) {
  return (
    <g>
      <text x={PAD} y={y - 10} className="fill-[var(--color-ink-subtle)] text-[10px]">
        {label}
      </text>
      {letters.map((char, i) => {
        const mark = marks.find((m) => m.at === i);
        return (
          <g key={i}>
            <rect
              x={PAD + i * CELL}
              y={y}
              width={CELL}
              height={CELL}
              className={
                mark === undefined
                  ? 'fill-transparent stroke-[var(--color-line)]'
                  : 'fill-[var(--color-marker-wash)] stroke-[var(--color-marker-line)]'
              }
              strokeWidth={mark === undefined ? 1 : 2}
            />
            <text
              x={PAD + i * CELL + CELL / 2}
              y={y + CELL - 8}
              textAnchor="middle"
              className={
                mark === undefined
                  ? 'fill-[var(--color-ink-muted)] font-mono text-[13px]'
                  : 'fill-[var(--color-ink-strong)] font-mono text-[13px] font-bold'
              }
            >
              {char}
            </text>
            {mark !== undefined && (
              <text
                x={PAD + i * CELL + CELL / 2}
                y={y + CELL + 12}
                textAnchor="middle"
                className="fill-[var(--color-marker-ink)] text-[9px]"
              >
                {mark.text}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export default function BeaufortRule({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const letterSteps = steps.filter((s) => s.data?.['isLetter'] === true);
  const maxCursor = Math.max(0, letterSteps.length - 1);
  const at = Math.min(cursor, maxCursor);
  const press = readPress(letterSteps[at]);

  const keyValue = press?.keyValue ?? 0;
  const plain = A_TO_Z.split('');
  // The reversed-and-rotated strip: position p holds the letter K - p.
  const slide = plain.map((_, p) => A_TO_Z.charAt(beaufortLetter(p, keyValue)));

  return (
    <div className="flex flex-col gap-6">
      {letterSteps.length === 0 ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and the rule will follow each letter through it.
        </p>
      ) : (
        <>
          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">
              The rule, set to key letter {press?.keyChar ?? A_TO_Z.charAt(keyValue)}
            </p>
            <svg
              width={WIDTH}
              height={HEIGHT}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={`A Beaufort rule set to key letter ${press?.keyChar ?? '?'}, mapping ${
                press === undefined || press === null ? '' : A_TO_Z.charAt(press.fromIndex)
              } to ${press === null ? '' : A_TO_Z.charAt(press.toIndex)}`}
              className="mt-2 block shrink-0"
            >
              <Strip
                label="Plain strip"
                letters={plain}
                marks={
                  press === null
                    ? []
                    : [
                        { at: press.fromIndex, text: 'plain' },
                        { at: press.toIndex, text: 'cipher' },
                      ]
                }
                y={18}
              />
              <Strip
                label={`Slide, set to ${press?.keyChar ?? A_TO_Z.charAt(keyValue)}`}
                letters={slide}
                marks={
                  press === null
                    ? []
                    : [
                        { at: press.fromIndex, text: '' },
                        { at: press.toIndex, text: '' },
                      ]
                }
                y={62}
              />
            </svg>
          </div>

          <p className="cl-prose text-sm text-ink-muted">
            {press === null
              ? 'This character is not a letter, so the rule does not move.'
              : `Under key letter ${press.keyChar}, ${A_TO_Z.charAt(press.fromIndex)} sits above ${A_TO_Z.charAt(
                  press.toIndex,
                )} — and ${A_TO_Z.charAt(press.toIndex)} sits above ${A_TO_Z.charAt(
                  press.fromIndex,
                )}. Both marked columns show the same pair, read from either end. That symmetry is why encrypting and decrypting are one operation.`}
          </p>

          <div className="flex min-w-0 flex-col gap-3">
            <p className="cl-prose text-sm text-ink-muted">{letterSteps[at]?.detail}</p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="cl-button"
                onClick={() => setCursor((c) => Math.max(0, c - 1))}
                disabled={at === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className="cl-button"
                onClick={() => setCursor((c) => Math.min(maxCursor, c + 1))}
                disabled={at >= maxCursor}
              >
                Next
              </button>
            </div>

            <label className="block">
              <span className="cl-label">
                Letter {at + 1} of {letterSteps.length}
              </span>
              <input
                type="range"
                className="h-6 w-full accent-[var(--color-marker)]"
                min={0}
                max={maxCursor}
                value={at}
                onChange={(e) => setCursor(Number(e.target.value))}
              />
            </label>
          </div>
        </>
      )}

      <section aria-labelledby="beaufort-vs" className="flex flex-col gap-3">
        <h3 id="beaufort-vs" className="text-sm font-semibold text-ink-strong">
          One sign, two ciphers
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          With key <span className="font-mono">{String(params['key'] ?? '')}</span>, the difference
          from Vigen&egrave;re is the direction of the arithmetic and nothing else. Vigen&egrave;re
          computes <span className="font-mono">P + K</span> and needs a second, different operation
          to undo it. Beaufort computes <span className="font-mono">K &minus; P</span>, which undoes
          itself. Neither is harder to break than the other, and the Attack tab uses the same
          period-finding code for both &mdash; the file imports it from Vigen&egrave;re rather than
          copying it, because that is the honest way to say so.
        </p>
      </section>
    </div>
  );
}
