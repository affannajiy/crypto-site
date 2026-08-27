import { useMemo, useState } from 'react';
import type { Step } from '../../../types';
import { hex32, sha256 } from './sha256';

/**
 * The avalanche, bit by bit.
 *
 * Two digests side by side, and every bit that differs marked. The claim on the
 * Encrypt tab — "change one letter and half the output changes" — is the sort of
 * thing a reader nods at and does not believe. This is the same claim as 256
 * squares they can count.
 *
 * `Step.data` is the only channel from the algorithm, and it is read defensively
 * here for the same reason it is everywhere else: a shape mismatch should render
 * nothing rather than throw.
 */

/** The message this trace was built from, recovered from the padding step. */
function readMessage(steps: Step[]): string | undefined {
  const data = steps[0]?.data;
  if (data === undefined) return undefined;
  const padded = data['padded'];
  const length = data['messageLength'];
  if (!Array.isArray(padded) || typeof length !== 'number') return undefined;
  const bytes = Uint8Array.from(padded.slice(0, length).filter((n): n is number => typeof n === 'number'));
  if (bytes.length !== length) return undefined;
  return new TextDecoder().decode(bytes);
}

function readDigest(steps: Step[]): string | undefined {
  const digest = steps[steps.length - 1]?.data?.['digest'];
  return typeof digest === 'string' ? digest : undefined;
}

/** The 256 bits of a hex digest, most significant first. */
function bitsOf(digest: string): number[] {
  return [...digest].flatMap((char) => {
    const nibble = parseInt(char, 16);
    return [8, 4, 2, 1].map((mask) => ((nibble & mask) === 0 ? 0 : 1));
  });
}

/**
 * A message with one bit flipped in its first byte.
 *
 * A bit rather than a letter, deliberately: flipping a letter changes eight bits
 * of input and invites the answer "well, you changed a lot". One bit is the
 * smallest change that can be made, and it still moves half the output.
 */
function flipOneBit(message: string): string {
  const bytes = new TextEncoder().encode(message);
  if (bytes.length === 0) return '';
  bytes[0] = (bytes[0] ?? 0) ^ 1;
  return new TextDecoder().decode(bytes);
}

export default function Avalanche({ steps }: { steps: Step[] }) {
  const [mode, setMode] = useState<'bit' | 'custom'>('bit');
  const [custom, setCustom] = useState('The quick brown fox jumps over the lazy cog');

  const message = readMessage(steps);
  const digest = readDigest(steps);

  const other = mode === 'bit' && message !== undefined ? flipOneBit(message) : custom;
  const otherDigest = useMemo(() => sha256(other), [other]);

  const rounds = steps.filter((step) => typeof step.data?.['round'] === 'number');

  if (message === undefined || digest === undefined) {
    return <p className="text-sm text-ink-muted">Type a message on the Encrypt tab to see this.</p>;
  }

  const bitsA = bitsOf(digest);
  const bitsB = bitsOf(otherDigest);
  const changed = bitsA.reduce((count, bit, i) => count + (bit === bitsB[i] ? 0 : 1), 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-ink-strong">Compare against</h3>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: 'bit', label: 'The same message, one bit flipped' },
              { value: 'custom', label: 'Something I type' },
            ] as const
          ).map((choice) => (
            <label
              key={choice.value}
              className={[
                'flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-1.5 text-sm',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marker-line',
                mode === choice.value
                  ? 'border-ink-strong bg-ink-strong font-medium text-ink-inverse'
                  : 'border-line-strong bg-surface text-ink hover:bg-sunken',
              ].join(' ')}
            >
              <input
                type="radio"
                name="avalanche-mode"
                value={choice.value}
                checked={mode === choice.value}
                onChange={() => setMode(choice.value)}
                className="sr-only"
              />
              {choice.label}
            </label>
          ))}
        </div>

        {mode === 'custom' && (
          <label className="flex flex-col gap-1">
            <span className="cl-label mb-0">Second message</span>
            <input
              type="text"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              className="cl-field w-full wrap-anywhere font-mono"
            />
          </label>
        )}
      </section>

      <section className="cl-card px-4 py-4">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink-strong">{changed} of 256 bits differ</span> —{' '}
          {((changed / 256) * 100).toFixed(1)}%. Half is what a hash with nothing left to give
          away looks like. Anything much less would be a pattern, and a pattern is a lever.
        </p>

        <div className="mt-3 grid gap-3">
          {[
            { label: 'This message', text: message, hash: digest, bits: bitsA },
            { label: 'The other one', text: other, hash: otherDigest, bits: bitsB },
          ].map((row) => (
            <div key={row.label}>
              <p className="text-xs uppercase tracking-wide text-ink-subtle">{row.label}</p>
              <p className="mt-0.5 wrap-anywhere font-mono text-xs text-ink-muted">
                {row.text === '' ? '(empty)' : row.text}
              </p>
              <p className="mt-1 wrap-anywhere font-mono text-sm text-ink">{row.hash}</p>
            </div>
          ))}
        </div>

        {/* The grid is the evidence. Differing bits are marked with a filled
            square *and* named in the label, so the difference is never carried
            by colour alone. */}
        <div className="mt-4 overflow-x-auto">
          <div
            className="grid w-max gap-px"
            style={{ gridTemplateColumns: 'repeat(32, minmax(0, 1fr))' }}
            role="img"
            aria-label={`${changed} of the 256 output bits differ between the two digests.`}
          >
            {bitsA.map((bit, i) => {
              const differs = bit !== bitsB[i];
              return (
                <span
                  key={i}
                  title={`bit ${i}: ${bit} → ${bitsB[i] ?? 0}`}
                  className={[
                    'block h-3 w-3 rounded-[1px] border',
                    differs
                      ? 'border-marker-line bg-marker'
                      : 'border-line bg-sunken',
                  ].join(' ')}
                />
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-subtle">
            256 output bits, 32 to a row. Filled squares changed.
          </p>
        </div>
      </section>

      <section className="cl-card px-4 py-4">
        <h3 className="text-sm font-semibold text-ink-strong">The eight working words</h3>
        <p className="cl-prose mt-1 text-sm text-ink-muted">
          Every round shifts all eight along and rewrites two of them, so a bit that arrives in
          one round has reached every word within about ten. This is the same avalanche, upstream
          of the output.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-max text-left font-mono text-xs">
            <thead>
              <tr className="text-ink-subtle">
                <th scope="col" className="px-2 py-1 font-normal">
                  Round
                </th>
                {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name) => (
                  <th key={name} scope="col" className="px-2 py-1 font-normal">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds
                .filter((_, i) => i < 8 || i === rounds.length - 1)
                .map((step) => {
                  const state = step.data?.['state'];
                  const round = step.data?.['round'];
                  if (!Array.isArray(state) || typeof round !== 'number') return null;
                  return (
                    <tr key={step.index} className="border-t border-line">
                      <th scope="row" className="px-2 py-1 font-normal text-ink-subtle">
                        {round + 1}
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
        <p className="mt-2 text-xs text-ink-subtle">
          The first eight rounds, and the last. The full sixty-four are on the Encrypt tab’s step
          trace.
        </p>
      </section>
    </div>
  );
}
