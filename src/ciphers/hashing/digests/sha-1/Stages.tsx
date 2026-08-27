import { useMemo, useState } from 'react';
import type { Step } from '../../../types';
import { STAGES, STAGE_K, hex32, sha0, sha1, stageOf } from './sha1';

/**
 * The one-bit fix, and the four stages.
 *
 * SHA-1's break is a collision, and like MD5's it cannot be a `attack(ciphertext)`
 * — gap 6 again. But unlike MD5 the published SHA-1 collision is two 400-kilobyte
 * PDFs, which is not something to embed in a page. So this tab teaches the two
 * things about SHA-1 that a reader can actually check for themselves:
 *
 * 1. SHA-0 and SHA-1 differ by one rotate-left-one in the message schedule, and
 *    both are computed here from whatever is on the Encrypt tab.
 * 2. The eighty rounds are four stages of twenty, each with its own function and
 *    constant — which is where SHA-256 got its shape from.
 *
 * `Step.data` is read defensively, as everywhere else.
 */

function readMessage(steps: Step[]): string | undefined {
  const message = steps[0]?.data?.['message'];
  return typeof message === 'string' ? message : undefined;
}

export default function Stages({ steps }: { steps: Step[] }) {
  const [showAll, setShowAll] = useState(false);
  const message = readMessage(steps);

  const pair = useMemo(
    () => (message === undefined ? undefined : { one: sha1(message), zero: sha0(message) }),
    [message],
  );

  if (message === undefined || pair === undefined) {
    return <p className="text-sm text-ink-muted">Type a message on the Encrypt tab to see this.</p>;
  }

  const rounds = steps.filter((step) => typeof step.data?.['round'] === 'number');
  const shown = showAll ? rounds : rounds.filter((_, i) => i % 20 === 0 || i === rounds.length - 1);

  return (
    <div className="flex flex-col gap-6">
      <section className="cl-card px-4 py-4">
        <h3 className="text-sm font-semibold text-ink-strong">SHA-0 and SHA-1, side by side</h3>
        <p className="cl-prose mt-1 text-sm text-ink-muted">
          The NSA published SHA in 1993 and withdrew it two years later without saying why. The
          replacement — SHA-1 — differs from it by a single <code>rotate left 1</code> in the
          message schedule. Nothing else changed: same eighty rounds, same four constants, same
          five words of state. Both are computed below from the message on the Encrypt tab.
        </p>
        <dl className="mt-3 grid gap-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              SHA-1 (with the rotation)
            </dt>
            <dd className="wrap-anywhere font-mono text-sm text-ink">{pair.one}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-subtle">
              SHA-0 (without it)
            </dt>
            <dd className="wrap-anywhere font-mono text-sm text-ink">{pair.zero}</dd>
          </div>
        </dl>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          Completely different answers, from one rotation. The reason it mattered is not that the
          digests differ — any change does that — but that without the rotation a difference in one
          message word travels down the schedule without spreading sideways, which is exactly the
          handle an attacker needs. SHA-0 fell in 1998. SHA-1 lasted until 2017.
        </p>
      </section>

      <section className="cl-card px-4 py-4">
        <h3 className="text-sm font-semibold text-ink-strong">Four stages of twenty rounds</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-max text-left text-sm">
            <thead>
              <tr className="text-ink-subtle">
                <th scope="col" className="px-2 py-1 font-normal">Rounds</th>
                <th scope="col" className="px-2 py-1 font-normal">Function</th>
                <th scope="col" className="px-2 py-1 font-normal">Definition</th>
                <th scope="col" className="px-2 py-1 font-normal">Constant</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((stage, i) => (
                <tr key={stage.from} className="border-t border-line">
                  <th scope="row" className="px-2 py-1 font-mono font-normal text-ink-subtle">
                    {stage.from + 1}–{stage.to + 1}
                  </th>
                  <td className="px-2 py-1 text-ink">{stage.name}</td>
                  <td className="px-2 py-1 font-mono text-xs text-ink-muted">{stage.formula}</td>
                  <td className="px-2 py-1 font-mono text-xs text-ink">
                    {hex32(STAGE_K[i] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          Two of the four stages use the same function, which is one of the things SHA-256 changed:
          it gives every round its own constant and mixes two rotations into each step instead.
        </p>
      </section>

      <section className="cl-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink-strong">The five working words</h3>
          <button type="button" className="cl-button" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show stage boundaries only' : `Show all ${rounds.length} rounds`}
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-max text-left font-mono text-xs">
            <thead>
              <tr className="text-ink-subtle">
                <th scope="col" className="px-2 py-1 font-normal">Round</th>
                {['a', 'b', 'c', 'd', 'e'].map((name) => (
                  <th key={name} scope="col" className="px-2 py-1 font-normal">{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((step) => {
                const state = step.data?.['state'];
                const round = step.data?.['round'];
                if (!Array.isArray(state) || typeof round !== 'number') return null;
                return (
                  <tr key={step.index} className="border-t border-line">
                    <th scope="row" className="px-2 py-1 font-normal text-ink-subtle">
                      {round + 1}
                      <span className="ml-1 not-italic text-ink-subtle">
                        {STAGES[stageOf(round)]?.name}
                      </span>
                    </th>
                    {state.map((word, i) => (
                      <td key={i} className="px-2 py-1 text-ink">
                        {typeof word === 'number' ? hex32(word) : '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
