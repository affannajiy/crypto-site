import { useId, useState } from 'react';
import type { AttackCandidate, CipherModule, Params } from '../../ciphers/types';

/**
 * Breaking the cipher without the key.
 *
 * The ranking matters more than the winner. Seeing the runner-up scores lets a
 * person judge how confident the attack actually is, and seeing the ranking fail
 * on a short sample teaches more than seeing it succeed on a long one.
 */
type AttackState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; candidates: AttackCandidate[] }
  | { status: 'error'; message: string };

const PREVIEW_LENGTH = 120;

function formatScore(score: number): string {
  if (!Number.isFinite(score)) return 'no letters';
  return score.toFixed(1);
}

export default function AttackPanel({
  cipher,
  lastOutput,
  onUseKey,
}: {
  cipher: CipherModule;
  lastOutput: string;
  onUseKey: (key: Params) => void;
}) {
  const inputId = useId();
  // Seeded from the Encrypt tab, which is where the ciphertext usually comes
  // from. The panel unmounts on a tab change, so this re-seeds every visit.
  const [ciphertext, setCiphertext] = useState(lastOutput);
  const [state, setState] = useState<AttackState>({ status: 'idle' });
  const [applied, setApplied] = useState<string | null>(null);

  const attack = cipher.attack;
  // Which statistic ranked these is the cipher's business, not this panel's. A
  // transposition cannot be attacked by counting letters, so a hardcoded
  // "chi-squared" here would have been wrong for Rail Fence.
  const scoreLabel = cipher.attackScoreLabel ?? 'score';
  if (attack === undefined) return null;

  // Setting a key changes a control that may be scrolled off screen, so say so
  // rather than letting the click look like it did nothing.
  const applyKey = (candidate: AttackCandidate) => {
    onUseKey(candidate.key);
    setApplied(candidate.label);
  };

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    setState({ status: 'running' });
    try {
      const candidates = await attack(ciphertext);
      setState({ status: 'done', candidates });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'The attack could not run.',
      });
    }
  };

  const best = state.status === 'done' ? state.candidates[0] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={run} className="flex flex-col gap-3">
        <div>
          <label htmlFor={inputId} className="cl-label">
            Ciphertext to break
          </label>
          <textarea
            id={inputId}
            rows={4}
            value={ciphertext}
            spellCheck={false}
            placeholder="Paste an intercepted message…"
            className="cl-field resize-y font-mono leading-relaxed"
            onChange={(e) => setCiphertext(e.target.value)}
          />
          <p className="cl-prose mt-2 text-xs text-ink-subtle">
            Frequency analysis needs volume. A sentence usually works; five letters usually will
            not, and watching that fail is the point.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="cl-button cl-button-primary" disabled={ciphertext === ''}>
            {state.status === 'running' ? 'Working…' : 'Break it'}
          </button>
          {/*
            Only disabled when there is nothing to load. It was also disabled
            when the box already held that text, which is its state on arrival —
            so the control a user reaches for first was always greyed out, and
            correctly doing nothing looked exactly like being broken.
          */}
          <button
            type="button"
            className="cl-button"
            onClick={() => setCiphertext(lastOutput)}
            disabled={lastOutput === ''}
          >
            Load the Encrypt tab's output
          </button>
        </div>
      </form>

      {state.status === 'idle' && (
        <p className="cl-card px-4 py-6 text-center text-sm text-ink-subtle">
          Nothing has been attacked yet. Paste a ciphertext above and press{' '}
          <span className="font-medium text-ink-muted">Break it</span> to try every key.
        </p>
      )}

      {state.status === 'error' && (
        <div role="status" className="cl-card border-marker-mid bg-marker-wash px-4 py-3 text-sm">
          <p className="font-medium text-ink">The attack could not run.</p>
          <p className="cl-prose mt-1 text-ink-muted">{state.message}</p>
        </div>
      )}

      {applied !== null && (
        <p role="status" className="cl-prose text-sm text-ink-muted">
          <span className="font-semibold text-ink">{applied}</span> is now set under Key and
          settings, above the tabs. Open the Encrypt tab to run it.
        </p>
      )}

      {state.status === 'done' && best !== undefined && (
        <>
          <section aria-labelledby="best-heading" className="flex flex-col gap-2">
            <h3 id="best-heading" className="text-sm font-semibold text-ink">
              Best fit to English
            </h3>
            <div className="cl-card border-marker-mid bg-marker-wash px-4 py-3">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold text-marker-ink">{best.label}</span>
                <span className="font-mono text-xs text-ink-muted">
                  {scoreLabel} {formatScore(best.score)}
                </span>
              </p>
              <p className="mt-2 w-full font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">
                {best.plaintext}
              </p>
              <button type="button" className="cl-button mt-3" onClick={() => applyKey(best)}>
                Use this key
              </button>
            </div>
          </section>

          <section aria-labelledby="ranking-heading" className="flex min-w-0 flex-col gap-2">
            <h3 id="ranking-heading" className="text-sm font-semibold text-ink">
              All {state.candidates.length} keys, ranked
              <span className="ml-2 font-normal text-ink-subtle">lower score is a better fit</span>
            </h3>

            <div className="cl-card overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-subtle">
                    <th scope="col" className="px-3 py-2 font-medium">
                      Rank
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Key
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Score
                    </th>
                    <th scope="col" className="w-full px-3 py-2 font-medium">
                      Decrypts to
                    </th>
                    <th scope="col" className="px-3 py-2">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {state.candidates.map((candidate, rank) => (
                    <tr key={candidate.label} className={rank === 0 ? 'bg-marker-wash' : undefined}>
                      <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink-subtle">
                        {rank + 1}
                      </td>
                      <td
                        className={[
                          'px-3 py-2 font-mono text-xs whitespace-nowrap',
                          rank === 0 ? 'font-bold text-marker-ink' : 'text-ink',
                        ].join(' ')}
                      >
                        {candidate.label}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-ink-muted">
                        {formatScore(candidate.score)}
                      </td>
                      <td className="max-w-0 truncate px-3 py-2 font-mono text-xs text-ink-muted">
                        {candidate.plaintext.slice(0, PREVIEW_LENGTH)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="cl-button min-h-0 px-2.5 py-1 text-xs"
                          onClick={() => applyKey(candidate)}
                        >
                          Use
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
