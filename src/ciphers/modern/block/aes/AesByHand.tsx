/**
 * SubBytes and MixColumns worked by hand, as Lecture 04 slides 35 to 39 do them.
 *
 * The arithmetic is in `byHand.ts`. This file only draws it. It sits under the
 * round-by-round grid in `AesRounds`, and can borrow a column from the round on
 * screen, so the hand calculation and the cipher are visibly the same thing.
 *
 * This is a visualizer file, so it may know React exists.
 */
import { useId, useState } from 'react';
import { bin8, hex2, mixColumnByHand, readByte, readColumn, sboxLookup, times2, times3 } from './byHand';

function attempt<T>(f: () => T): { value: T; error: null } | { value: null; error: string } {
  try {
    return { value: f(), error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function AesByHand({ liveColumn }: { liveColumn: string | null }) {
  const byteId = useId();
  const columnId = useId();
  const [byteText, setByteText] = useState('45');
  const [columnText, setColumnText] = useState('d4 bf 5d 30');

  const byte = attempt(() => readByte(byteText));
  const column = attempt(() => mixColumnByHand(readColumn(columnText)));

  return (
    <section aria-labelledby={`${byteId}-h`} className="flex flex-col gap-4">
      <h3 id={`${byteId}-h`} className="text-sm font-semibold text-ink-strong">
        By hand, as the lecture does it
      </h3>

      <div className="cl-card flex flex-col gap-3 px-4 py-3">
        <label htmlFor={byteId} className="cl-label">
          One byte (hex)
        </label>
        <input
          id={byteId}
          value={byteText}
          onChange={(e) => setByteText(e.target.value)}
          className="cl-field w-24 font-mono"
          spellCheck={false}
          autoComplete="off"
        />
        {byte.error !== null ? (
          <p role="status" className="text-sm text-ink-muted">{byte.error}</p>
        ) : (
          (() => {
            const s = sboxLookup(byte.value);
            const two = times2(byte.value);
            const three = times3(byte.value);
            return (
              <pre className="overflow-x-auto font-mono text-sm leading-6 text-ink">
{`SubBytes   ${hex2(s.input)}: row X = ${s.row.toString(16)}, column Y = ${s.column.toString(16)}  ->  S-box = ${hex2(s.output)}

02 x ${hex2(two.input)}    ${bin8(two.input)}   top bit ${two.msbSet ? '1' : '0'}
  shift left  ${bin8(two.shifted)}${two.msbSet ? `
  XOR 1B      ${bin8(0x1b)}` : '   (top bit was 0: no XOR)'}
  =           ${bin8(two.output)}  = ${hex2(two.output)}

03 x ${hex2(three.input)}  = (02 x ${hex2(three.input)}) XOR ${hex2(three.input)}
           = ${hex2(three.twice)} XOR ${hex2(three.input)} = ${hex2(three.output)}`}
              </pre>
            );
          })()
        )}
        <p className="cl-prose text-sm text-ink-muted">
          The slide&rsquo;s S-box example is 45 &rarr; 6e. Try 87 to see the other case of 02 &times; b: its
          top bit is 1, so the shift is followed by XOR 1B.
        </p>
      </div>

      <div className="cl-card flex flex-col gap-3 px-4 py-3">
        <label htmlFor={columnId} className="cl-label">
          One column for MixColumns (four bytes, hex)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={columnId}
            value={columnText}
            onChange={(e) => setColumnText(e.target.value)}
            className="cl-field w-48 font-mono"
            spellCheck={false}
            autoComplete="off"
          />
          {liveColumn !== null && (
            <button type="button" className="cl-button" onClick={() => setColumnText(liveColumn)}>
              Use column 1 of this round
            </button>
          )}
        </div>
        {column.error !== null ? (
          <p role="status" className="text-sm text-ink-muted">{column.error}</p>
        ) : (
          <pre className="overflow-x-auto font-mono text-sm leading-6 text-ink">
            {column.value
              .map(
                (row) =>
                  `${row.terms.map((t) => `${hex2(t.multiplier)}·${hex2(t.byte)}`).join(' ⊕ ')}\n  = ${row.terms
                    .map((t) => hex2(t.product))
                    .join(' ⊕ ')} = ${hex2(row.output)}`,
              )
              .join('\n')}
          </pre>
        )}
        <p className="cl-prose text-sm text-ink-muted">
          Each output byte is one row of the fixed matrix times the column, with XOR in place of
          addition. The default column d4 bf 5d 30 &rarr; 04 66 81 e5 is the FIPS-197 example. Only
          01, 02 and 03 appear, which is why the slide needs only those two rules. MixColumns is
          skipped in the last round.
        </p>
      </div>
    </section>
  );
}
