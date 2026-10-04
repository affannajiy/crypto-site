/**
 * The Feistel ladder, with the numbers on it.
 *
 * The lecture draws the structure as two columns, L and R, with F hanging between
 * them and the halves crossing after every round. This draws exactly that, for
 * every round of the current run, with each half's bits written in its box. The
 * selected round is marked, and the table beside it is the slide's own working.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';

interface Round {
  round: number;
  left: string;
  right: string;
  key: string;
  f: string;
  newLeft: string;
  newRight: string;
}

interface BlockView {
  block: number;
  input: string;
  output: string;
  start: { left: string; right: string };
  rounds: Round[];
  swappedOut: boolean;
  direction: string;
}

function isRound(value: unknown): value is Round {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r['left'] === 'string' && typeof r['right'] === 'string' && typeof r['key'] === 'string';
}

function readBlocks(steps: Step[]): BlockView[] {
  const blocks = new Map<number, BlockView>();
  for (const step of steps) {
    const d = step.data;
    if (d === undefined || d['isFeistel'] !== true) continue;
    const block = Number(d['block'] ?? 0);
    const rounds = Array.isArray(d['rounds']) ? d['rounds'].filter(isRound) : [];
    const view = blocks.get(block) ?? {
      block,
      input: '',
      output: '',
      start: { left: '', right: '' },
      rounds,
      swappedOut: false,
      direction: String(d['direction'] ?? 'encrypt'),
    };
    if (d['stage'] === 'split') {
      view.input = String(step.input ?? '');
      view.start = { left: String(d['left'] ?? ''), right: String(d['right'] ?? '') };
    }
    if (d['stage'] === 'join') {
      view.output = String(d['output'] ?? '');
      view.swappedOut = d['swappedOut'] === true;
    }
    blocks.set(block, view);
  }
  return [...blocks.values()].sort((a, b) => a.block - b.block);
}

const WIDTH = 470;
const LX = 100;
const RX = 370;
const FX = 235;
const ROW = 120;
const TOP = 40;
const BOX_W = 96;
const BOX_H = 28;

function Box({ x, y, text, label, active }: { x: number; y: number; text: string; label: string; active: boolean }) {
  return (
    <g>
      <rect
        x={x - BOX_W / 2}
        y={y - BOX_H / 2}
        width={BOX_W}
        height={BOX_H}
        rx={4}
        fill={active ? 'var(--color-marker-wash)' : 'var(--color-surface)'}
        stroke={active ? 'var(--color-marker-line)' : 'var(--color-line-strong)'}
        strokeWidth={active ? 2 : 1.5}
      />
      <text x={x} y={y + 5} textAnchor="middle" fontSize={14} className="font-mono" fill="var(--color-ink-strong)">
        {text}
      </text>
      <text x={x - BOX_W / 2 - 6} y={y + 5} textAnchor="end" fontSize={12} className="font-mono" fill="var(--color-ink-muted)">
        {label}
      </text>
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, tone = 'plain' }: { x1: number; y1: number; x2: number; y2: number; tone?: 'plain' | 'left' | 'right' }) {
  const stroke = tone === 'plain' ? 'var(--color-ink-muted)' : tone === 'left' ? 'var(--color-ink)' : 'var(--color-marker-line)';
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={tone === 'plain' ? 1.5 : 2} markerEnd="url(#feistel-arrow)" />
  );
}

function Ladder({ view, activeRound }: { view: BlockView; activeRound: number }) {
  const n = view.rounds.length;
  const height = TOP + n * ROW + 70;
  const yOf = (i: number) => TOP + i * ROW;

  return (
    <svg
      width={WIDTH}
      height={height}
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="block shrink-0"
      role="img"
      aria-label={`Feistel ladder, ${n} rounds, from ${view.start.left} ${view.start.right} to ${view.output}.`}
    >
      <defs>
        <marker id="feistel-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink-muted)" />
        </marker>
      </defs>

      <text x={LX} y={16} textAnchor="middle" fontSize={12} fill="var(--color-ink-muted)">left half</text>
      <text x={RX} y={16} textAnchor="middle" fontSize={12} fill="var(--color-ink-muted)">right half</text>

      {view.rounds.map((r, i) => {
        const y = yOf(i);
        const mid = y + 52;
        const active = activeRound === r.round;
        return (
          <g key={r.round}>
            <Box x={LX} y={y} text={r.left} label={`L${i}`} active={active} />
            <Box x={RX} y={y} text={r.right} label={`R${i}`} active={active} />

            {/* R feeds F; K feeds F from above; F feeds the XOR on the left. */}
            <line x1={RX} y1={y + BOX_H / 2} x2={RX} y2={mid} stroke="var(--color-ink-muted)" strokeWidth={1.5} />
            <Arrow x1={RX} y1={mid} x2={FX + 34} y2={mid} />
            <rect x={FX - 34} y={mid - 14} width={68} height={28} rx={4} fill="var(--color-sunken)" stroke="var(--color-ink)" strokeWidth={1.5} />
            <text x={FX} y={mid + 5} textAnchor="middle" fontSize={13} className="font-mono" fill="var(--color-ink-strong)">
              F={r.f}
            </text>
            <text x={FX} y={mid - 26} textAnchor="middle" fontSize={12} className="font-mono" fill="var(--color-ink)">
              K{i}={r.key}
            </text>
            <Arrow x1={FX} y1={mid - 22} x2={FX} y2={mid - 15} />
            <Arrow x1={FX - 34} y1={mid} x2={LX + 10} y2={mid} />

            <line x1={LX} y1={y + BOX_H / 2} x2={LX} y2={mid - 9} stroke="var(--color-ink-muted)" strokeWidth={1.5} />
            <circle cx={LX} cy={mid} r={9} fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth={1.5} />
            <line x1={LX - 9} y1={mid} x2={LX + 9} y2={mid} stroke="var(--color-ink)" strokeWidth={1.5} />
            <line x1={LX} y1={mid - 9} x2={LX} y2={mid + 9} stroke="var(--color-ink)" strokeWidth={1.5} />

            {/* The crossing. L XOR F goes right; the old R goes left unchanged. */}
            <line x1={LX} y1={mid + 9} x2={RX} y2={yOf(i + 1) - BOX_H / 2 - 2} stroke="var(--color-marker-line)" strokeWidth={2} />
            <line x1={RX} y1={mid} x2={LX} y2={yOf(i + 1) - BOX_H / 2 - 2} stroke="var(--color-ink)" strokeWidth={2} />
          </g>
        );
      })}

      {n > 0 && (
        <g>
          <Box x={LX} y={yOf(n)} text={view.rounds[n - 1]?.newLeft ?? ''} label={`L${n}`} active={activeRound === n} />
          <Box x={RX} y={yOf(n)} text={view.rounds[n - 1]?.newRight ?? ''} label={`R${n}`} active={activeRound === n} />
          <text x={(LX + RX) / 2} y={yOf(n) + 50} textAnchor="middle" fontSize={14} className="font-mono" fill="var(--color-ink-strong)">
            {view.swappedOut ? `R${n} || L${n}` : `L${n} || R${n}`} = {view.output}
          </text>
        </g>
      )}
    </svg>
  );
}

export default function FeistelLadder({ steps }: { steps: Step[]; params: Params }) {
  const blocks = readBlocks(steps);
  const [blockAt, setBlockAt] = useState(0);
  const [roundAt, setRoundAt] = useState(1);
  const view = blocks[Math.min(blockAt, Math.max(0, blocks.length - 1))];

  if (view === undefined || view.rounds.length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a block of binary on the Encrypt tab, such as 10110110, and the ladder appears here.
      </p>
    );
  }

  const n = view.rounds.length;
  const active = Math.min(Math.max(roundAt, 1), n);
  const round = view.rounds[active - 1];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="cl-card overflow-x-auto px-4 py-3">
          <Ladder view={view} activeRound={active} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {round !== undefined && (
            <div className="cl-card px-4 py-3">
              <p className="cl-label">Round {active} of {n}, as the slide writes it</p>
              <pre className="mt-2 overflow-x-auto font-mono text-sm leading-6 text-ink">
{`K${active - 1} = ${round.key}
F${active - 1} = R${active - 1} XOR K${active - 1}
   = ${round.right} XOR ${round.key} = ${round.f}
R${active} = F${active - 1} XOR L${active - 1}
   = ${round.f} XOR ${round.left} = ${round.newRight}
L${active} = R${active - 1} = ${round.newLeft}`}
              </pre>
            </div>
          )}
          <label className="block">
            <span className="cl-label">Round {active} of {n}</span>
            <input
              type="range"
              className="h-6 w-full accent-[var(--color-marker)]"
              min={1}
              max={n}
              value={active}
              onChange={(e) => setRoundAt(Number(e.target.value))}
            />
          </label>
          {blocks.length > 1 && (
            <label className="block">
              <span className="cl-label">Block {view.block + 1} of {blocks.length}</span>
              <input
                type="range"
                className="h-6 w-full accent-[var(--color-marker)]"
                min={0}
                max={blocks.length - 1}
                value={Math.min(blockAt, blocks.length - 1)}
                onChange={(e) => setBlockAt(Number(e.target.value))}
              />
            </label>
          )}
          <p className="cl-prose text-sm text-ink-muted">
            The orange line is L XOR F crossing to the right. The dark line is the old right half crossing to
            the left <strong>unchanged</strong>. F never has to be undone, because decryption only needs F
            run forwards again with the keys in reverse order.
            {view.direction === 'decrypt'
              ? ' This run is a decryption: the keys are listed in reverse, and the ladder runs from the ciphertext up to the plaintext.'
              : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
