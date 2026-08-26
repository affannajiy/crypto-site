/**
 * The dichotomic tree, and the table sorted by cost.
 *
 * Morse is usually printed as an alphabetical table, which hides the only
 * structural thing about it. Sorted by **code length** instead, the design is
 * obvious in one glance: E and T are one symbol, the next four are two, and Q and
 * Y and the digits are down at four and five. That ordering is English letter
 * frequency, worked out by Alfred Vail counting the type in a printer's tray.
 *
 * The tree makes the decoding rule visible: start at the root, go left on a dot
 * and right on a dash. Every letter is a path, which is what "prefix-free" looks
 * like when you draw it.
 *
 * This is the only file in the encoding folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../types';
import { charFor, lettersByCodeLength } from './morse';

const LEVELS = 4;
const NODE = 26;
const HEIGHT = 40 + LEVELS * 52;

interface Char {
  char: string;
  code: string;
}

function readChars(steps: Step[]): Char[] {
  const out: Char[] = [];
  for (const step of steps) {
    const data = step.data;
    if (data === undefined || data['isChar'] !== true) continue;
    if (typeof data['code'] !== 'string') continue;
    out.push({ char: String(data['char'] ?? ''), code: String(data['code']) });
  }
  return out;
}

/** Every node of the tree down to `LEVELS`, with the x offset it should sit at. */
function nodes(): { code: string; depth: number; slot: number }[] {
  const out: { code: string; depth: number; slot: number }[] = [];
  const walk = (code: string, depth: number) => {
    if (depth > LEVELS) return;
    if (depth > 0) out.push({ code, depth, slot: 0 });
    walk(`${code}.`, depth + 1);
    walk(`${code}-`, depth + 1);
  };
  walk('', 0);
  // Slot each node by its position within its own depth, left to right.
  const perDepth = new Map<number, number>();
  for (const node of out) {
    const next = perDepth.get(node.depth) ?? 0;
    node.slot = next;
    perDepth.set(node.depth, next + 1);
  }
  return out;
}

const TREE = nodes();
const WIDTH = 2 ** LEVELS * NODE + 40;

export default function MorseTree({ steps }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);

  const chars = readChars(steps);
  const maxCursor = Math.max(0, chars.length - 1);
  const at = Math.min(cursor, maxCursor);
  const current = chars[at];

  const xOf = (depth: number, slot: number) => {
    const count = 2 ** depth;
    return 20 + ((slot + 0.5) * (WIDTH - 40)) / count;
  };
  const yOf = (depth: number) => 20 + depth * 52;

  const onPath = (code: string) =>
    current !== undefined && current.code.startsWith(code) && code !== '';

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          The decoding tree: left on a dot, right on a dash{' '}
          {current === undefined ? '' : `— ${current.char} is ${current.code}`}
        </p>
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={
            current === undefined
              ? 'The Morse decoding tree, four levels deep'
              : `The Morse decoding tree, with the path to ${current.char} marked: ${current.code}`
          }
          className="mt-2 block shrink-0"
        >
          {TREE.map((node) => {
            const parentCode = node.code.slice(0, -1);
            const parent = TREE.find((n) => n.code === parentCode);
            const x = xOf(node.depth, node.slot);
            const y = yOf(node.depth);
            const px = parent === undefined ? WIDTH / 2 : xOf(parent.depth, parent.slot);
            const py = parent === undefined ? yOf(0) - 14 : yOf(parent.depth);
            const lit = onPath(node.code);
            return (
              <g key={node.code}>
                <line
                  x1={px}
                  y1={py + 9}
                  x2={x}
                  y2={y - 9}
                  className={
                    lit ? 'stroke-[var(--color-marker-line)]' : 'stroke-[var(--color-line)]'
                  }
                  strokeWidth={lit ? 2 : 1}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={9}
                  className={
                    lit
                      ? 'fill-[var(--color-marker-wash)] stroke-[var(--color-marker-line)]'
                      : 'fill-[var(--color-canvas)] stroke-[var(--color-line)]'
                  }
                  strokeWidth={lit ? 2 : 1}
                />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  className={
                    lit
                      ? 'fill-[var(--color-ink-strong)] font-mono text-[11px] font-bold'
                      : 'fill-[var(--color-ink-muted)] font-mono text-[11px]'
                  }
                >
                  {charFor(node.code) || '·'}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="cl-prose mt-2 text-sm text-ink-muted">
          Every letter is a <strong>path</strong> rather than a number, which is what a prefix-free
          code looks like when you draw it. Nothing here is secret: the tree has been published
          since 1844, and anyone holding it can read anything sent with it.
        </p>
      </div>

      <section aria-labelledby="morse-cost" className="flex flex-col gap-3">
        <h3 id="morse-cost" className="text-sm font-semibold text-ink-strong">
          Sorted by cost, not alphabetically
        </h3>
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-6">
          {lettersByCodeLength().map((row) => (
            <li
              key={row.letter}
              className={[
                'flex items-baseline gap-2 rounded border px-2 py-1 font-mono text-xs',
                current?.char === row.letter
                  ? 'border-marker-line bg-marker-wash text-ink-strong'
                  : 'border-line text-ink-muted',
              ].join(' ')}
            >
              <span className="w-4 shrink-0 font-semibold text-ink">{row.letter}</span>
              <span>{row.code}</span>
            </li>
          ))}
        </ul>
        <p className="cl-prose text-sm text-ink-muted">
          E and T cost one symbol. A, I, M and N cost two. Q, Y, J and Z cost four. That ordering is
          English letter frequency, and Alfred Vail worked it out by counting the type in a
          printer&rsquo;s tray. It is the same idea as the Straddling Checkerboard on this site, and
          the same idea Huffman proved optimal in 1952 &mdash; and it is about{' '}
          <strong>speed, not secrecy</strong>.
        </p>
      </section>

      {chars.length > 0 && (
        <div className="flex min-w-0 flex-col gap-3">
          <p className="cl-prose text-sm text-ink-muted">
            {steps.filter((s) => s.data?.['isChar'] === true)[at]?.detail}
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
              Character {at + 1} of {chars.length}
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
      )}
    </div>
  );
}
