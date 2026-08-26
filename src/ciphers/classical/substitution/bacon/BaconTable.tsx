/**
 * The two-symbol table, and the message hiding in plain sight.
 *
 * Two things are worth drawing here and they are different in kind. The **table**
 * is the code: twenty-four or twenty-six rows of letter and five-bit pattern, and
 * seeing it laid out is seeing that Bacon wrote binary in 1605. The **carrier** is
 * the steganography: the same five symbols spread across five ordinary letters,
 * where the only thing distinguishing a B from an A is that one is a capital.
 *
 * The second panel is the point of the cipher. A reader who does not know to look
 * at the case sees a slightly oddly typeset sentence, not a message.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { type Variant, table } from './bacon';

function readVariant(params: Params): Variant {
  return String(params['variant'] ?? '24') === '26' ? '26' : '24';
}

interface Group {
  letter: string;
  code: string;
  carried: number[];
}

function readGroups(steps: Step[]): Group[] {
  const out: Group[] = [];
  for (const step of steps) {
    const data = step.data;
    if (data === undefined || data['isLetter'] !== true) continue;
    const letter = data['letter'];
    const code = data['code'];
    if (typeof letter !== 'string' || typeof code !== 'string') continue;
    const carried = Array.isArray(data['carried']) ? data['carried'].map(Number) : [];
    out.push({ letter, code, carried });
  }
  return out;
}

/** Every symbol laid end to end, which is what the carrier actually holds. */
function streamOf(groups: Group[]): string {
  return groups.map((g) => g.code).join('');
}

export default function BaconTable({ steps, params }: { steps: Step[]; params: Params }) {
  const variant = readVariant(params);
  const rows = table(variant);
  const groups = readGroups(steps);
  const carrier = String(params['carrier'] ?? '');
  const hiding = carrier.trim() !== '';

  const [selected, setSelected] = useState(0);
  const at = Math.min(selected, Math.max(0, groups.length - 1));
  const current = groups[at];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="bacon-table" className="flex flex-col gap-3">
        <h3 id="bacon-table" className="text-sm font-semibold text-ink-strong">
          The {variant}-letter table
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Five symbols, two choices each: 2<sup>5</sup> = 32 patterns for {variant} letters. This is
          a five-bit character encoding, written down three hundred and forty years before anyone
          built a machine that needed one.
        </p>

        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-6">
          {rows.map((row) => {
            const active = current?.letter === row.letter;
            return (
              <li
                key={row.letter}
                className={[
                  'flex items-baseline gap-2 rounded border px-2 py-1 font-mono text-xs',
                  active
                    ? 'border-marker-line bg-marker-wash text-ink-strong'
                    : 'border-line text-ink-muted',
                ].join(' ')}
              >
                <span className="w-6 shrink-0 font-semibold text-ink">
                  {row.letter}
                  {row.alias !== undefined && (
                    <span className="text-ink-subtle">/{row.alias}</span>
                  )}
                </span>
                <span>{row.code}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {groups.length === 0 ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and its symbols will be laid out here.
        </p>
      ) : (
        <section aria-labelledby="bacon-stream" className="flex flex-col gap-3">
          <h3 id="bacon-stream" className="text-sm font-semibold text-ink-strong">
            {hiding ? 'The message, hidden in the carrier' : 'The symbol stream'}
          </h3>

          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">
              Letter {at + 1} of {groups.length}
            </p>
            <p className="mt-2 flex flex-wrap gap-1 font-mono text-sm">
              {groups.map((group, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={i === at}
                  className={[
                    'min-h-6 rounded border px-1.5 py-0.5',
                    i === at
                      ? 'border-marker-line bg-marker-wash text-ink-strong'
                      : 'border-line text-ink-muted hover:border-line-strong',
                  ].join(' ')}
                >
                  <span className="sr-only">{group.letter} is </span>
                  {group.code}
                </button>
              ))}
            </p>
          </div>

          {current !== undefined && (
            <div className="cl-card px-4 py-3">
              <p className="font-mono text-lg text-ink-strong">
                {current.letter}
                <span className="mx-2 text-ink-muted" aria-hidden="true">
                  →
                </span>
                <span className="rounded bg-marker-wash px-1.5 py-0.5 underline decoration-marker-line decoration-2 underline-offset-4">
                  {current.code}
                </span>
              </p>
              {hiding && (
                <p className="cl-prose mt-2 text-sm text-ink-muted">
                  Those five symbols are carried by five ordinary letters of the carrier text. A
                  capital is B, lowercase is A. Nothing was added to the sentence — only its
                  typography changed, and typography is not something a reader counts.
                </p>
              )}
            </div>
          )}

          {hiding && (
            <div className="cl-card overflow-x-auto px-4 py-3">
              <p className="cl-label">The carrier, with the carrying letters marked</p>
              <p className="mt-2 break-words font-mono text-sm leading-7">
                {(() => {
                  const marked = new Set(current?.carried ?? []);
                  return carrier.split('').map((char, i) =>
                    marked.has(i) ? (
                      <span
                        key={i}
                        className="rounded bg-marker-wash px-0.5 underline decoration-marker-line decoration-2 underline-offset-4"
                      >
                        {char}
                      </span>
                    ) : (
                      <span key={i} className="text-ink-muted">
                        {char}
                      </span>
                    ),
                  );
                })()}
              </p>
              <p className="cl-prose mt-2 text-sm text-ink-muted">
                The marked letters carry the selected letter&rsquo;s five symbols. The output pane on
                the Encrypt tab shows them with their real case, which is the message.
              </p>
            </div>
          )}

          <p className="cl-prose text-sm text-ink-muted">
            {streamOf(groups).length} symbols for {groups.length} letters — five each, always. Bacon
            needs five times the space of the message it hides, and a carrier at least that long.
            That cost is what steganography charges: you pay in text nobody reads.
          </p>
        </section>
      )}
    </div>
  );
}
