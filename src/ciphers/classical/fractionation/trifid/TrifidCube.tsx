/**
 * The cube, unfolded into three squares.
 *
 * Nobody can read a 3x3x3 cube drawn in perspective, so it is drawn the way it was
 * always written on paper: three separate 3x3 layers side by side. A symbol's
 * address is which square, then which row, then which column.
 *
 * Underneath, the three coordinate lines and the stream cut into triples — the
 * same drawing as Bifid's, one line taller. The count that matters is on the
 * screen: how many *different* plaintext symbols the current triple was assembled
 * from. In Bifid that is at most two. Here it is at most three.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { SIDE, buildCube, symbolAt } from './trifid';

interface Fold {
  symbols: string;
  layers: number[];
  rows: number[];
  cols: number[];
  pick: number[];
  values: number[];
  symbol: string;
  sourceCount: number;
}

function readFold(step: Step | undefined): Fold | null {
  const data = step?.data;
  if (data === undefined || data['isSymbol'] !== true) return null;
  const symbols = data['symbols'];
  const layers = data['layers'];
  const rows = data['rows'];
  const cols = data['cols'];
  const pick = data['pick'];
  const values = data['values'];
  const symbol = data['symbol'];
  if (
    typeof symbols !== 'string' ||
    !Array.isArray(layers) ||
    !Array.isArray(rows) ||
    !Array.isArray(cols) ||
    !Array.isArray(pick) ||
    !Array.isArray(values) ||
    typeof symbol !== 'string'
  ) {
    return null;
  }
  return {
    symbols,
    layers: layers.map(Number),
    rows: rows.map(Number),
    cols: cols.map(Number),
    pick: pick.map(Number),
    values: values.map(Number),
    symbol,
    sourceCount: Number(data['sourceCount'] ?? 0),
  };
}

function Line({
  label,
  values,
  offset,
  pick,
  shade,
}: {
  label: string;
  values: number[];
  offset: number;
  pick: number[];
  shade: boolean;
}) {
  return (
    <tr>
      <th scope="row" className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle">
        {label}
      </th>
      {values.map((value, i) => (
        <td
          key={i}
          className={[
            'border px-1.5 py-0.5 text-center font-mono text-sm',
            pick.includes(offset + i)
              ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
              : shade
                ? 'border-line bg-sunken text-ink-muted'
                : 'border-line text-ink-muted',
          ].join(' ')}
        >
          {value + 1}
        </td>
      ))}
    </tr>
  );
}

export default function TrifidCube({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const folds = steps.filter((s) => s.data?.['isSymbol'] === true);
  const maxCursor = Math.max(0, folds.length - 1);
  const at = Math.min(cursor, maxCursor);
  const fold = readFold(folds[at]);

  const cube = buildCube(String(params['keyword'] ?? ''));
  const n = fold?.symbols.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="trifid-cube" className="flex flex-col gap-3">
        <h3 id="trifid-cube" className="text-sm font-semibold text-ink-strong">
          The cube, unfolded into three layers
        </h3>
        <div className="flex flex-wrap gap-4">
          {[0, 1, 2].map((layer) => (
            <div key={layer} className="cl-card px-3 py-2">
              <p className="cl-label">Layer {layer + 1}</p>
              <table className="mt-1 border-separate border-spacing-0">
                <tbody>
                  {[0, 1, 2].map((row) => (
                    <tr key={row}>
                      {[0, 1, 2].map((col) => {
                        const mark =
                          fold !== null &&
                          fold.values[0] === layer &&
                          fold.values[1] === row &&
                          fold.values[2] === col;
                        return (
                          <td
                            key={col}
                            className={[
                              'border px-2 py-1 text-center font-mono text-sm',
                              mark
                                ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                                : 'border-line text-ink',
                            ].join(' ')}
                          >
                            {symbolAt(cube, layer, row, col)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <p className="cl-prose text-sm text-ink-muted">
          Twenty-seven cells for twenty-six letters and one spare, so{' '}
          <strong>nothing is merged</strong>. Bifid had to write J as I to fit 26 letters into 25
          cells; 3<sup>3</sup> = 27 has room to spare. Choosing the alphabet to fit the arithmetic
          rather than forcing the arithmetic to fit the alphabet is a habit modern cryptography
          never breaks.
        </p>
      </section>

      {fold === null ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and its fold will be drawn here.
        </p>
      ) : (
        <>
          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">The block, written as three lines of digits</p>
            <table className="mt-2 border-separate border-spacing-0">
              <tbody>
                <tr>
                  <th
                    scope="row"
                    className="whitespace-nowrap pr-3 text-left text-xs font-normal text-ink-subtle"
                  >
                    Symbols
                  </th>
                  {fold.symbols.split('').map((char, i) => (
                    <td
                      key={i}
                      className="border border-line px-1.5 py-0.5 text-center font-mono text-sm text-ink"
                    >
                      {char}
                    </td>
                  ))}
                </tr>
                <Line label="Layers" values={fold.layers} offset={0} pick={fold.pick} shade />
                <Line label="Rows" values={fold.rows} offset={n} pick={fold.pick} shade={false} />
                <Line label="Columns" values={fold.cols} offset={2 * n} pick={fold.pick} shade />
              </tbody>
            </table>
          </div>

          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">
              All three lines read as one stream, cut into triples &rarr; {fold.symbol}
            </p>
            <p className="mt-2 flex flex-wrap gap-1 font-mono text-sm">
              {[...fold.layers, ...fold.rows, ...fold.cols].map((value, i) => (
                <span
                  key={i}
                  className={[
                    'rounded border px-1.5 py-0.5',
                    fold.pick.includes(i)
                      ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                      : 'border-line text-ink-muted',
                  ].join(' ')}
                >
                  {value + 1}
                </span>
              ))}
            </p>
            <p className="cl-prose mt-3 text-sm text-ink-muted">
              This triple was assembled from <strong>{fold.sourceCount}</strong> different plaintext{' '}
              {fold.sourceCount === 1 ? 'symbol' : 'symbols'}. Bifid&rsquo;s pairs can reach at most
              two; a triple can reach three. Every extra coordinate is another direction for a
              letter&rsquo;s pieces to scatter in, which is the same reason a modern block cipher
              works on {SIDE === 3 ? 'bits' : 'bits'} rather than on letters.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <p className="cl-prose text-sm text-ink-muted">{folds[at]?.detail}</p>

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
                Output symbol {at + 1} of {folds.length}
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
