/**
 * The Salsa20 grid, round by round.
 *
 * Sixteen 32-bit words in a 4 × 4 grid. At the start each cell is labelled by
 * what it holds: constant, key, nonce or counter. Then step through the ten
 * double rounds and watch every cell change. Beside it, the two round patterns:
 * which four cells each quarter-round touches in a column round and a row round.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';

interface BlockData {
  block: number;
  counter: string;
  initial: string[];
  rounds: { double: number; afterColumns: string[]; afterRows: string[] }[];
  final: string[];
  keystream: string;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function readBlocks(steps: Step[]): BlockData[] {
  const out: BlockData[] = [];
  for (const step of steps) {
    const d = step.data;
    if (d === undefined || d['isSalsa'] !== true) continue;
    const rounds = Array.isArray(d['rounds'])
      ? d['rounds'].map((r) => {
          const round = (typeof r === 'object' && r !== null ? r : {}) as Record<string, unknown>;
          return {
            double: Number(round['double'] ?? 0),
            afterColumns: strings(round['afterColumns']),
            afterRows: strings(round['afterRows']),
          };
        })
      : [];
    out.push({
      block: Number(d['block'] ?? 0),
      counter: String(d['counter'] ?? '0'),
      initial: strings(d['initial']),
      rounds,
      final: strings(d['final']),
      keystream: String(d['keystream'] ?? ''),
    });
  }
  return out;
}

/** What each cell of the starting grid holds. Constants sit on the diagonal. */
const ROLE = [
  'const', 'key', 'key', 'key',
  'key', 'const', 'nonce', 'nonce',
  'counter', 'counter', 'const', 'key',
  'key', 'key', 'key', 'const',
];

/** The four quarter-rounds of each kind, as cell indices. */
const COLUMN_GROUPS = [
  [0, 4, 8, 12],
  [5, 9, 13, 1],
  [10, 14, 2, 6],
  [15, 3, 7, 11],
];
const ROW_GROUPS = [
  [0, 1, 2, 3],
  [5, 6, 7, 4],
  [10, 11, 8, 9],
  [15, 12, 13, 14],
];

function Grid({ words, previous, labels }: { words: string[]; previous?: string[]; labels?: boolean }) {
  return (
    <table className="border-separate border-spacing-0">
      <tbody>
        {[0, 1, 2, 3].map((r) => (
          <tr key={r}>
            {[0, 1, 2, 3].map((c) => {
              const at = r * 4 + c;
              const changed = previous !== undefined && previous[at] !== words[at];
              const role = ROLE[at] ?? '';
              return (
                <td
                  key={c}
                  className={[
                    'border px-1.5 py-1 text-center align-top font-mono text-xs',
                    changed ? 'border-marker-line bg-marker-wash text-ink-strong' : 'border-line text-ink',
                    labels === true && role === 'const' ? 'bg-sunken' : '',
                  ].join(' ')}
                >
                  {words[at] ?? '········'}
                  {labels === true && <span className="block text-[10px] text-ink-subtle">{role}</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pattern({ groups, label }: { groups: number[][]; label: string }) {
  // Each quarter-round gets a number; its four cells show it, in the order the
  // quarter-round updates them.
  const cell: string[] = Array.from({ length: 16 }, () => '');
  groups.forEach((g, q) => g.forEach((at, k) => (cell[at] = `${'ABCD'[q]}${k}`)));
  return (
    <div className="shrink-0">
      <p className="cl-label mb-1">{label}</p>
      <table className="border-separate border-spacing-0">
        <tbody>
          {[0, 1, 2, 3].map((r) => (
            <tr key={r}>
              {[0, 1, 2, 3].map((c) => (
                <td key={c} className="h-7 w-9 border border-line text-center font-mono text-xs text-ink">
                  {cell[r * 4 + c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SalsaGrid({ steps }: { steps: Step[]; params: Params }) {
  const blocks = readBlocks(steps);
  const [blockAt, setBlockAt] = useState(0);
  const [stage, setStage] = useState(0);
  const block = blocks[Math.min(blockAt, Math.max(0, blocks.length - 1))];

  if (block === undefined || block.initial.length !== 16) {
    return <p className="cl-prose text-sm text-ink-muted">Type a message on the Encrypt tab to see the grid.</p>;
  }

  // Stage 0 is the start; then two stages per double round; then the final add.
  const stages: { label: string; words: string[]; previous?: string[] }[] = [
    { label: 'Starting grid', words: block.initial },
  ];
  let prev = block.initial;
  for (const r of block.rounds) {
    stages.push({ label: `Double round ${r.double}: after the column round`, words: r.afterColumns, previous: prev });
    stages.push({ label: `Double round ${r.double}: after the row round`, words: r.afterRows, previous: r.afterColumns });
    prev = r.afterRows;
  }
  stages.push({ label: 'Starting grid added back: the keystream block', words: block.final, previous: prev });
  const current = stages[Math.min(stage, stages.length - 1)] ?? stages[0];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="salsa-grid" className="flex flex-col gap-3">
        <h3 id="salsa-grid" className="text-sm font-semibold text-ink-strong">
          Block {block.block + 1}, counter {block.counter}: {current?.label}
        </h3>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <div className="flex w-fit gap-6">
            <div className="shrink-0">
              {current !== undefined && (
                <Grid words={current.words} {...(current.previous === undefined ? {} : { previous: current.previous })} labels={stage === 0} />
              )}
            </div>
          </div>
        </div>
        <label className="block">
          <span className="cl-label">
            Stage {stage + 1} of {stages.length}
          </span>
          <input
            type="range"
            className="h-6 w-full accent-[var(--color-marker)]"
            min={0}
            max={stages.length - 1}
            value={Math.min(stage, stages.length - 1)}
            onChange={(e) => setStage(Number(e.target.value))}
          />
        </label>
        {blocks.length > 1 && (
          <label className="block">
            <span className="cl-label">
              Block {block.block + 1} of {blocks.length}
            </span>
            <input
              type="range"
              className="h-6 w-full accent-[var(--color-marker)]"
              min={0}
              max={blocks.length - 1}
              value={Math.min(blockAt, blocks.length - 1)}
              onChange={(e) => {
                setBlockAt(Number(e.target.value));
                setStage(0);
              }}
            />
          </label>
        )}
        <p className="cl-prose text-sm text-ink-muted">
          Orange cells changed at that stage. After one double round every cell has changed; that is how
          fast a single key bit spreads. The last stage adds the starting grid back, word by word. Without
          that addition, anyone could run the rounds backwards from the keystream and read off the key.
        </p>
      </section>

      <section aria-labelledby="salsa-patterns" className="flex flex-col gap-3">
        <h3 id="salsa-patterns" className="text-sm font-semibold text-ink-strong">
          Which cells each quarter-round mixes
        </h3>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <div className="flex w-fit gap-6">
            <Pattern groups={COLUMN_GROUPS} label="Column round" />
            <Pattern groups={ROW_GROUPS} label="Row round" />
          </div>
        </div>
        <p className="cl-prose text-sm text-ink-muted">
          A0 to A3 are the four cells of quarter-round A, in update order, and the same for B, C and D. Each
          quarter-round starts on a diagonal cell, where a constant sits. The quarter-round is four lines:{' '}
          <span className="font-mono">b ^= (a+d)&lt;&lt;&lt;7; c ^= (b+a)&lt;&lt;&lt;9; d ^= (c+b)&lt;&lt;&lt;13; a ^= (d+c)&lt;&lt;&lt;18</span>.
          ChaCha20 changes the rows to diagonals and updates each cell twice per quarter-round.
        </p>
      </section>
    </div>
  );
}
