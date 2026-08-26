/**
 * The square, the sum, and the leak.
 *
 * Two panels. The first is the addition written out as a clerk would write it —
 * plaintext number over key number over sum — which is all the cipher is.
 *
 * The second is the part worth building: a histogram of the ciphertext numbers.
 * Because the sums are never reduced, they do not spread evenly. Values above 55
 * can only come from a large key digit, and values in the hundreds pin it down
 * further. The picture makes that visible without anyone having to be told, which
 * is the whole reason this app draws things.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { SIZE, buildSquareFor } from './support';

interface Sum {
  char: string;
  plainValue: number;
  keyValue: number;
  sum: number;
  position: number;
}

function readSums(steps: Step[]): Sum[] {
  const out: Sum[] = [];
  for (const step of steps) {
    const data = step.data;
    if (data === undefined || data['isLetter'] !== true) continue;
    if (typeof data['sum'] !== 'number') continue;
    out.push({
      char: String(data['char'] ?? ''),
      plainValue: Number(data['plainValue'] ?? 0),
      keyValue: Number(data['keyValue'] ?? 0),
      sum: Number(data['sum']),
      position: Number(data['position'] ?? 0),
    });
  }
  return out;
}

const BUCKETS = [
  { label: '22–55', test: (n: number) => n <= 55 },
  { label: '56–99', test: (n: number) => n > 55 && n < 100 },
  { label: '100+', test: (n: number) => n >= 100 },
];

export default function NihilistSums({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const sums = readSums(steps);
  const maxCursor = Math.max(0, sums.length - 1);
  const at = Math.min(cursor, maxCursor);
  const current = sums[at];

  const square = buildSquareFor(String(params['keyword'] ?? ''));
  const counts = BUCKETS.map((bucket) => sums.filter((s) => bucket.test(s.sum)).length);
  const total = Math.max(1, sums.length);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="nihilist-square" className="flex flex-col gap-3">
        <h3 id="nihilist-square" className="text-sm font-semibold text-ink-strong">
          The square, and the numbers it gives each letter
        </h3>
        <div className="cl-card w-fit overflow-x-auto px-4 py-3">
          <table className="border-separate border-spacing-0">
            <tbody>
              {[0, 1, 2, 3, 4].map((row) => (
                <tr key={row}>
                  {[0, 1, 2, 3, 4].map((col) => {
                    const value = (row + 1) * 10 + (col + 1);
                    const mark = current?.plainValue === value;
                    return (
                      <td
                        key={col}
                        className={[
                          'border px-2 py-1 text-center font-mono text-xs',
                          mark
                            ? 'border-marker-line bg-marker-wash text-ink-strong'
                            : 'border-line text-ink-muted',
                        ].join(' ')}
                      >
                        <span className="block text-sm text-ink">
                          {square.cells[row * SIZE + col]}
                        </span>
                        <span className="block text-[10px] text-ink-subtle">{value}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sums.length === 0 ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and the additions will be written out here.
        </p>
      ) : (
        <>
          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">The addition, as a clerk would write it</p>
            <table className="mt-2 border-separate border-spacing-0">
              <tbody>
                <tr>
                  <th
                    scope="row"
                    className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle"
                  >
                    Letter
                  </th>
                  {sums.map((s, i) => (
                    <td
                      key={i}
                      className={[
                        'border px-1.5 py-0.5 text-center font-mono text-sm',
                        i === at ? 'border-marker-line bg-marker-wash text-ink-strong' : 'border-line text-ink-muted',
                      ].join(' ')}
                    >
                      {s.char}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle"
                  >
                    Plain
                  </th>
                  {sums.map((s, i) => (
                    <td
                      key={i}
                      className={[
                        'border px-1.5 py-0.5 text-center font-mono text-sm',
                        i === at ? 'border-marker-line bg-marker-wash text-ink-strong' : 'border-line text-ink-muted',
                      ].join(' ')}
                    >
                      {s.plainValue}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle"
                  >
                    Key
                  </th>
                  {sums.map((s, i) => (
                    <td
                      key={i}
                      className={[
                        'border bg-sunken px-1.5 py-0.5 text-center font-mono text-sm',
                        i === at ? 'border-marker-line bg-marker-wash text-ink-strong' : 'border-line text-ink-muted',
                      ].join(' ')}
                    >
                      {s.keyValue}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th
                    scope="row"
                    className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle"
                  >
                    Sum
                  </th>
                  {sums.map((s, i) => (
                    <td
                      key={i}
                      className={[
                        'border px-1.5 py-0.5 text-center font-mono text-sm font-semibold',
                        i === at
                          ? 'border-marker-line bg-marker-wash text-ink-strong'
                          : 'border-line text-ink',
                      ].join(' ')}
                    >
                      {s.sum}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <section aria-labelledby="nihilist-leak" className="flex flex-col gap-3">
            <h3 id="nihilist-leak" className="text-sm font-semibold text-ink-strong">
              What the numbers give away
            </h3>
            <div className="cl-card flex flex-col gap-2 px-4 py-3">
              {BUCKETS.map((bucket, i) => (
                <div key={bucket.label} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 font-mono text-xs text-ink-subtle">
                    {bucket.label}
                  </span>
                  <span
                    className="h-4 rounded-sm bg-marker"
                    style={{ width: `${Math.round(((counts[i] ?? 0) / total) * 100)}%` }}
                  />
                  <span className="text-xs text-ink-muted">{counts[i] ?? 0}</span>
                </div>
              ))}
            </div>
            <p className="cl-prose text-sm text-ink-muted">
              Nothing here is reduced. A plaintext number is 11&ndash;55 and so is a key number, so
              a sum lands anywhere from 22 to 110 &mdash; and <strong>where it lands is evidence</strong>.
              A sum above 55 cannot have come from a small key digit; a sum of 100 or more forces
              both tens digits to be large. Vigen&egrave;re does the same addition and then reduces
              modulo 26, which destroys exactly this information. Nihilist keeps it, and hands the
              analyst a constraint on every single character.
            </p>
          </section>

          <div className="flex min-w-0 flex-col gap-3">
            <p className="cl-prose text-sm text-ink-muted">
              {steps.filter((s) => s.data?.['isLetter'] === true)[at]?.detail}
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
                Letter {at + 1} of {sums.length}
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
    </div>
  );
}
