/**
 * The board, and the cost of the message.
 *
 * The board is drawn as it was written: ten columns, a top row with two gaps, and
 * two more rows hanging off the escape digits. The gaps are the important part of
 * the picture — they are why the code can be read without separators.
 *
 * Underneath, a measurement rather than an assertion: digits per symbol, against
 * the flat 2.00 a Polybius square charges. That number is the compression, and it
 * moves as you type.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { TOP_ROW, buildBoard } from './checkerboard';

interface Symbol_ {
  char: string;
  code: string;
  row: number;
  col: number;
}

function readSymbols(steps: Step[]): Symbol_[] {
  const out: Symbol_[] = [];
  for (const step of steps) {
    const data = step.data;
    if (data === undefined || data['isSymbol'] !== true) continue;
    if (typeof data['code'] !== 'string') continue;
    out.push({
      char: String(data['char'] ?? ''),
      code: String(data['code']),
      row: Number(data['row'] ?? 0),
      col: Number(data['col'] ?? 0),
    });
  }
  return out;
}

export default function CheckerboardTable({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const board = buildBoard(String(params['keyword'] ?? ''), String(params['escapes'] ?? ''));
  const symbols = readSymbols(steps);
  const maxCursor = Math.max(0, symbols.length - 1);
  const at = Math.min(cursor, maxCursor);
  const current = symbols[at];

  const digits = symbols.reduce((n, s) => n + s.code.length, 0);
  const perSymbol = symbols.length === 0 ? 0 : digits / symbols.length;
  const singles = symbols.filter((s) => s.code.length === 1).length;

  const rows: { prefix: string; cells: (string | null)[] }[] = [
    {
      prefix: '',
      cells: Array.from({ length: 10 }, (_, d) => {
        const at_ = board.topDigits.indexOf(d);
        return at_ === -1 ? null : (board.symbols[at_] ?? null);
      }),
    },
    {
      prefix: String(board.escapes[0]),
      cells: Array.from({ length: 10 }, (_, d) => board.symbols[TOP_ROW + d] ?? null),
    },
    {
      prefix: String(board.escapes[1]),
      cells: Array.from({ length: 10 }, (_, d) => board.symbols[TOP_ROW + 10 + d] ?? null),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">The board</p>
        <table className="mt-2 border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-8" />
              {Array.from({ length: 10 }, (_, d) => (
                <th
                  key={d}
                  scope="col"
                  className="border border-line bg-sunken px-2 py-1 text-center font-mono text-xs text-ink-subtle"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <th
                  scope="row"
                  className="border border-line bg-sunken px-2 py-1 text-center font-mono text-xs text-ink"
                >
                  {row.prefix === '' ? '—' : row.prefix}
                </th>
                {row.cells.map((cell, c) => {
                  const mark = current !== undefined && current.row === r && current.col === c;
                  return (
                    <td
                      key={c}
                      className={[
                        'border px-2 py-1 text-center font-mono text-sm',
                        cell === null
                          ? 'border-dashed border-line-strong bg-sunken text-ink-subtle'
                          : mark
                            ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                            : 'border-line text-ink-muted',
                      ].join(' ')}
                    >
                      {cell ?? '↓'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          The two dashed cells are the gaps. Digits <strong>{board.escapes.join(' and ')}</strong>{' '}
          never stand for a symbol on their own, so when one appears in the stream a reader knows
          without being told to take the next digit as well. That is what makes the code{' '}
          <strong>prefix-free</strong>, and it is the same property that lets a ZIP file be read
          from front to back with no length fields.
        </p>
      </div>

      {symbols.length === 0 ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and its cost will be measured here.
        </p>
      ) : (
        <>
          <section aria-labelledby="board-cost" className="flex flex-col gap-3">
            <h3 id="board-cost" className="text-sm font-semibold text-ink-strong">
              What the message cost
            </h3>
            <div className="cl-card flex flex-wrap gap-6 px-4 py-3">
              <div>
                <p className="cl-label">Digits per symbol</p>
                <p className="font-mono text-2xl text-ink-strong">{perSymbol.toFixed(2)}</p>
              </div>
              <div>
                <p className="cl-label">A Polybius square would charge</p>
                <p className="font-mono text-2xl text-ink-muted">2.00</p>
              </div>
              <div>
                <p className="cl-label">Symbols that cost one digit</p>
                <p className="font-mono text-2xl text-ink-strong">
                  {singles}
                  <span className="text-sm text-ink-muted"> / {symbols.length}</span>
                </p>
              </div>
            </div>
            <p className="cl-prose text-sm text-ink-muted">
              The saving is real, and it comes from English being mostly the eight letters on the
              top row. Put rare letters up there instead and it drains away towards 2.00 &mdash; but
              never past it, because no code here is longer than two digits. 2.00 is a hard ceiling,
              so a badly arranged board wastes the opportunity rather than costing anything.
              Arranging it well is a statement about the language, not about the cipher. This is
              compression, worked out by hand thirty years before Huffman wrote the algorithm down.
            </p>
          </section>

          <div className="flex min-w-0 flex-col gap-3">
            <p className="cl-prose text-sm text-ink-muted">
              {steps.filter((s) => s.data?.['isSymbol'] === true)[at]?.detail}
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
                Symbol {at + 1} of {symbols.length}
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
