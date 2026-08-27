import { useState } from 'react';
import type { Step } from '../../../types';

/**
 * What widening actually bought.
 *
 * SHA-512 has no break to show, so this tab does the other useful thing: it puts
 * the four hashes in this app on one table, and shows the eight 64-bit words
 * moving. Every number in the table is a fact about the algorithm rather than a
 * judgement about it, which is the same rule the security badge follows.
 *
 * `Step.data` carries the state as hex strings here, because a `bigint` is not
 * something a visualizer should have to know how to format.
 */

const COMPARISON = [
  { name: 'MD5', digest: 128, word: 32, rounds: 64, block: 512, length: 64, standing: 'Broken. Collisions in seconds.' },
  { name: 'SHA-1', digest: 160, word: 32, rounds: 80, block: 512, length: 64, standing: 'Broken. Collision published 2017.' },
  { name: 'SHA-256', digest: 256, word: 32, rounds: 64, block: 512, length: 64, standing: 'No known practical attack.' },
  { name: 'SHA-512', digest: 512, word: 64, rounds: 80, block: 1024, length: 128, standing: 'No known practical attack.' },
];

export default function Widths({ steps }: { steps: Step[] }) {
  const [showAll, setShowAll] = useState(false);

  const rounds = steps.filter((step) => typeof step.data?.['round'] === 'number');
  const shown = showAll ? rounds : rounds.filter((_, i) => i < 6 || i === rounds.length - 1);

  return (
    <div className="flex flex-col gap-6">
      <section className="cl-card px-4 py-4">
        <h3 className="text-sm font-semibold text-ink-strong">Four hashes, one table</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-max text-left text-sm">
            <thead>
              <tr className="text-ink-subtle">
                <th scope="col" className="px-2 py-1 font-normal">Hash</th>
                <th scope="col" className="px-2 py-1 font-normal">Digest</th>
                <th scope="col" className="px-2 py-1 font-normal">Word</th>
                <th scope="col" className="px-2 py-1 font-normal">Block</th>
                <th scope="col" className="px-2 py-1 font-normal">Rounds</th>
                <th scope="col" className="px-2 py-1 font-normal">Length field</th>
                <th scope="col" className="px-2 py-1 font-normal">Where it stands</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.name} className="border-t border-line">
                  <th scope="row" className="px-2 py-1 font-normal text-ink-strong">{row.name}</th>
                  <td className="px-2 py-1 font-mono text-xs text-ink">{row.digest} bits</td>
                  <td className="px-2 py-1 font-mono text-xs text-ink">{row.word} bits</td>
                  <td className="px-2 py-1 font-mono text-xs text-ink">{row.block} bits</td>
                  <td className="px-2 py-1 font-mono text-xs text-ink">{row.rounds}</td>
                  <td className="px-2 py-1 font-mono text-xs text-ink">{row.length} bits</td>
                  <td className="px-2 py-1 text-ink-muted">{row.standing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          Read down the digest column and it looks as though the story is size. It is not. MD5 and
          SHA-1 fell to attacks on their round functions, and a longer digest would have delayed
          that rather than prevented it. SHA-256 and SHA-512 are both far past the size where a
          birthday attack is conceivable — 2<sup>128</sup> operations to collide the smaller of them
          — so the difference between them is not security. It is the width of the machine you are
          running on.
        </p>
      </section>

      <section className="cl-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink-strong">The eight working words</h3>
          <button type="button" className="cl-button" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show the first few' : `Show all ${rounds.length} rounds`}
          </button>
        </div>
        <p className="cl-prose mt-1 text-sm text-ink-muted">
          Sixteen hex digits each, where SHA-256 has eight. Same shift-along-and-rewrite-two
          structure as SHA-256, over words twice as wide.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-max text-left font-mono text-xs">
            <thead>
              <tr className="text-ink-subtle">
                <th scope="col" className="px-2 py-1 font-normal">Round</th>
                {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name) => (
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
                    <th scope="row" className="px-2 py-1 font-normal text-ink-subtle">{round + 1}</th>
                    {state.map((word, i) => (
                      <td key={i} className="px-2 py-1 text-ink">
                        {typeof word === 'string' ? word : '—'}
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
