/**
 * The three A5/1 registers, clock by clock.
 *
 * Each register is a row of bits, newest on the right, oldest on the left where
 * it leaves as output. The clocking bit of each is outlined, the feedback taps
 * are underlined, and on every clock the panel says how the vote went and which
 * registers moved. That irregular stepping is the only non-linear thing in A5/1.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { REGISTERS } from './a51';

interface Clock {
  before: string[];
  after: string[];
  moved: boolean[];
  vote: number;
  out: number;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function readSetup(steps: Step[]) {
  const d = steps.find((s) => s.data?.['isA51'] === true)?.data;
  if (d === undefined) return null;
  const clocks: Clock[] = Array.isArray(d['clocks'])
    ? d['clocks'].map((c) => {
        const r = (typeof c === 'object' && c !== null ? c : {}) as Record<string, unknown>;
        return {
          before: strings(r['before']),
          after: strings(r['after']),
          moved: Array.isArray(r['moved']) ? r['moved'].map((m) => m === true) : [],
          vote: Number(r['vote'] ?? 0),
          out: Number(r['out'] ?? 0),
        };
      })
    : [];
  return { afterMix: strings(d['afterMix']), clocks };
}

function Register({ bits, r, moved, vote }: { bits: string; r: number; moved: boolean | null; vote: number | null }) {
  const spec = REGISTERS[r];
  if (spec === undefined) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 font-mono text-xs text-ink-strong">{spec.name}</span>
      <div className="flex shrink-0">
        {bits.split('').map((b, i) => {
          // Displayed left to right as bit length-1 down to bit 0.
          const at = spec.length - 1 - i;
          const isClock = at === spec.clockBit;
          const isTap = spec.taps.includes(at);
          const isOut = at === spec.length - 1;
          return (
            <span
              key={i}
              title={`bit ${at}${isClock ? ', clocking bit' : ''}${isTap ? ', feedback tap' : ''}${isOut ? ', output' : ''}`}
              className={[
                'inline-flex h-6 w-5 items-center justify-center border-y border-l font-mono text-xs last:border-r',
                isClock ? 'border-marker-line bg-marker-wash font-bold text-ink-strong' : 'border-line text-ink',
                isTap ? 'underline decoration-ink-strong decoration-2 underline-offset-2' : '',
                isOut ? 'bg-sunken' : '',
              ].join(' ')}
            >
              {b}
            </span>
          );
        })}
      </div>
      {moved !== null && vote !== null && (
        <span className="shrink-0 text-xs text-ink-muted">
          clock bit {bits[spec.length - 1 - spec.clockBit]}, {moved ? 'agrees, moves' : 'outvoted, stays'}
        </span>
      )}
    </div>
  );
}

export default function A51Registers({ steps }: { steps: Step[]; params: Params }) {
  const setup = readSetup(steps);
  const [at, setAt] = useState(0);

  if (setup === null || setup.clocks.length === 0) {
    return <p className="cl-prose text-sm text-ink-muted">Set a key and frame on the Encrypt tab to see the registers.</p>;
  }

  const clock = setup.clocks[Math.min(at, setup.clocks.length - 1)];
  if (clock === undefined) return null;
  const bitsOut = setup.clocks.slice(0, at + 1).map((c) => c.out).join('');

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="a51-regs" className="flex flex-col gap-3">
        <h3 id="a51-regs" className="text-sm font-semibold text-ink-strong">
          Keystream clock {at + 1}: the vote is {clock.vote}
        </h3>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <p className="cl-label mb-2">Before this clock</p>
          <div className="flex w-fit flex-col gap-1">
            {clock.before.map((bits, r) => (
              <Register key={r} bits={bits} r={r} moved={clock.moved[r] ?? false} vote={clock.vote} />
            ))}
          </div>
          <p className="cl-label mt-4 mb-2">After it</p>
          <div className="flex w-fit flex-col gap-1">
            {clock.after.map((bits, r) => (
              <Register key={r} bits={bits} r={r} moved={null} vote={null} />
            ))}
          </div>
          <p className="mt-3 font-mono text-sm text-ink-strong">
            Output bit = top bits XORed = {clock.out}. Keystream so far: {bitsOut}
          </p>
        </div>
        <label className="block">
          <span className="cl-label">
            Clock {at + 1} of the first {setup.clocks.length}
          </span>
          <input
            type="range"
            className="h-6 w-full accent-[var(--color-marker)]"
            min={0}
            max={setup.clocks.length - 1}
            value={Math.min(at, setup.clocks.length - 1)}
            onChange={(e) => setAt(Number(e.target.value))}
          />
        </label>
        <p className="cl-prose text-sm text-ink-muted">
          The outlined orange cell in each register is its <strong>clocking bit</strong>. The three vote, and
          a register moves only if its bit matches the majority, so on every clock two or three registers move.
          Underlined cells are the <strong>taps</strong>: their XOR becomes the new bit on the right. The grey
          cell on the left is the top bit, and the three top bits XOR to the output. These pictures start after
          the 64 key clocks, the 22 frame clocks and the 100 discarded mixing clocks.
        </p>
      </section>
    </div>
  );
}
