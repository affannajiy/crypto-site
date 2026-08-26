/**
 * The keystream tape.
 *
 * The single thing worth drawing about autokey is the keystream, because the
 * keystream is the entire difference from Vigenere. Two rows: the message, and
 * underneath it the key — the keyword for the first few letters, and then the
 * message again, shifted right by the keyword's length.
 *
 * Drawn that way, the mechanism is one glance: the lower row *is* the upper row,
 * moved along. There is no period to find because there is no period. And the
 * shift is exactly the keyword's length, which is why guessing a three-letter
 * keyword recovers everything.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { A_TO_Z } from '../../../../lib/letters';

interface Cell {
  plain: string;
  cipher: string;
  keyChar: string;
  fromKeyword: boolean;
}

function readCells(steps: Step[], direction: 'encrypt' | 'decrypt'): Cell[] {
  const out: Cell[] = [];
  for (const step of steps) {
    const data = step.data;
    if (data === undefined || data['isLetter'] !== true) continue;
    const fromIndex = data['fromIndex'];
    const toIndex = data['toIndex'];
    const keyChar = data['keyChar'];
    if (typeof fromIndex !== 'number' || typeof toIndex !== 'number' || typeof keyChar !== 'string') {
      continue;
    }
    // When decrypting, the *output* is the plaintext, so the roles swap.
    const from = A_TO_Z.charAt(fromIndex);
    const to = A_TO_Z.charAt(toIndex);
    out.push({
      plain: direction === 'encrypt' ? from : to,
      cipher: direction === 'encrypt' ? to : from,
      keyChar,
      fromKeyword: data['fromKeyword'] === true,
    });
  }
  return out;
}

function Row({
  label,
  cells,
  at,
  render,
  tone,
}: {
  label: string;
  cells: Cell[];
  at: number;
  render: (cell: Cell) => string;
  tone?: (cell: Cell) => boolean;
}) {
  return (
    <tr>
      <th scope="row" className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle">
        {label}
      </th>
      {cells.map((cell, i) => (
        <td
          key={i}
          className={[
            'border px-1 py-0.5 text-center font-mono text-sm',
            i === at
              ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
              : tone?.(cell) === true
                ? 'border-line bg-sunken text-ink'
                : 'border-line text-ink-muted',
          ].join(' ')}
        >
          {render(cell)}
        </td>
      ))}
    </tr>
  );
}

export default function AutokeyTape({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const direction =
    steps.find((s) => s.data?.['direction'] !== undefined)?.data?.['direction'] === 'decrypt'
      ? 'decrypt'
      : 'encrypt';
  const cells = readCells(steps, direction);
  const maxCursor = Math.max(0, cells.length - 1);
  const at = Math.min(cursor, maxCursor);
  const current = cells[at];
  const keyword = String(params['keyword'] ?? '').replace(/[^A-Za-z]/g, '').toUpperCase();
  const headLength = Math.max(1, keyword.length);

  if (cells.length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and its keystream will be laid out here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">The keystream: keyword first, then the message itself</p>
        <table className="mt-2 border-separate border-spacing-0">
          <tbody>
            <Row label="Message" cells={cells} at={at} render={(c) => c.plain} />
            <Row
              label="Key"
              cells={cells}
              at={at}
              render={(c) => c.keyChar}
              tone={(c) => c.fromKeyword}
            />
            <Row label="Cipher" cells={cells} at={at} render={(c) => c.cipher} />
          </tbody>
        </table>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          The shaded key cells are the keyword; everything after them is the message row copied and
          shifted right by {headLength} {headLength === 1 ? 'place' : 'places'}. Look along the key
          row for a repeat and there is none, which is exactly what Kasiski and the index of
          coincidence need in order to work.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <p className="cl-prose text-sm text-ink-muted">
          {current === undefined
            ? ''
            : current.fromKeyword
              ? `Letter ${at + 1} still comes from the keyword.`
              : `Letter ${at + 1} is keyed by message letter ${at - headLength + 1} — the cipher is eating its own plaintext.`}
        </p>

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
            Letter {at + 1} of {cells.length}
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

      <section aria-labelledby="autokey-error" className="flex flex-col gap-3">
        <h3 id="autokey-error" className="text-sm font-semibold text-ink-strong">
          Why one mistake ruins everything after it
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Decryption reads the key row out of the message row it is still building. Get letter{' '}
          {headLength + 1} wrong and it becomes the key for letter {headLength * 2 + 1}, which
          becomes the key for the one after that. A single garbled character does not damage one
          letter; it damages every letter from there to the end. Vigen&egrave;re, whose key comes
          from outside the message, loses exactly the one letter you got wrong. Error propagation is
          a real operational cost, and it is the reason ciphertext autokey was more common in the
          field despite being weaker.
        </p>
      </section>
    </div>
  );
}
