import { useMemo, useState } from 'react';
import type { Params, Step } from '../../../types';
import { pbkdf2 } from './pbkdf2';

/**
 * What the salt does, and what the iterations cost.
 *
 * Two demonstrations, both computed here rather than described. The salt one is
 * instant. The cost one is deliberately not: it runs the real derivation at
 * increasing iteration counts and times each, which is the only way to make
 * "expensive" mean anything.
 *
 * The timings are measured on the reader's own machine, in the tab they are
 * reading, which is worth stating plainly on the page — a number lifted from a
 * server benchmark would teach the wrong order of magnitude.
 */

const LADDER = [1, 100, 1_000, 5_000, 20_000];

interface Row {
  iterations: number;
  ms: number;
  key: string;
}

/** Reads `params`, not `steps` — the cost is a property of the settings, not of one run. */
export default function Cost({ params }: { steps: Step[]; params: Params }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);
  const [password, setPassword] = useState('correct horse battery staple');

  const iterations = Number(params['iterations'] ?? 1000);

  const saltDemo = useMemo(() => {
    const options = { iterations: 1000, keyBytes: 32 };
    return [
      { salt: 'user-4417', key: pbkdf2(password, { ...options, salt: 'user-4417' }) },
      { salt: 'user-9082', key: pbkdf2(password, { ...options, salt: 'user-9082' }) },
    ];
  }, [password]);

  const measure = async () => {
    setRunning(true);
    const measured: Row[] = [];
    for (const count of LADDER) {
      // Yield between runs so the page can paint the row that just finished.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const started = performance.now();
      const key = pbkdf2(password, { salt: 'user-4417', iterations: count, keyBytes: 32 });
      measured.push({ iterations: count, ms: performance.now() - started, key });
      setRows([...measured]);
    }
    setRunning(false);
  };

  const slowest = rows?.[rows.length - 1];
  const perSecond = slowest !== undefined && slowest.ms > 0 ? 1000 / slowest.ms : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="cl-card px-4 py-4">
        <h3 className="text-sm font-semibold text-ink-strong">One password, two salts</h3>
        <p className="cl-prose mt-1 text-sm text-ink-muted">
          The same password, derived twice with different salts. Nothing about the two results
          suggests they came from the same word, which is exactly what a precomputed table needs
          and cannot have. The salt is stored in plain text beside the hash; it is not a secret,
          it only has to be different every time.
        </p>
        <label className="mt-3 flex flex-col gap-1">
          <span className="cl-label mb-0">Password</span>
          <input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="cl-field w-full wrap-anywhere font-mono"
          />
        </label>
        <dl className="mt-3 grid gap-3">
          {saltDemo.map((row) => (
            <div key={row.salt}>
              <dt className="text-xs uppercase tracking-wide text-ink-subtle">salt = {row.salt}</dt>
              <dd className="wrap-anywhere font-mono text-sm text-ink">{row.key}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="cl-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink-strong">What the iterations cost</h3>
          <button
            type="button"
            className="cl-button cl-button-primary"
            onClick={measure}
            disabled={running}
          >
            {running ? 'Measuring…' : 'Time it'}
          </button>
        </div>
        <p className="cl-prose mt-1 text-sm text-ink-muted">
          The same derivation at rising iteration counts, timed on this machine, in this tab. The
          milliseconds should roughly multiply as the count does — that linearity is the whole
          design, and it is why the count is the security parameter.
        </p>

        {rows !== null && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-max text-left text-sm">
              <thead>
                <tr className="text-ink-subtle">
                  <th scope="col" className="px-2 py-1 font-normal">Iterations</th>
                  <th scope="col" className="px-2 py-1 font-normal">Time</th>
                  <th scope="col" className="px-2 py-1 font-normal">Guesses per second</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.iterations} className="border-t border-line">
                    <th scope="row" className="px-2 py-1 font-mono font-normal text-ink">
                      {row.iterations.toLocaleString('en-GB')}
                    </th>
                    <td className="px-2 py-1 font-mono text-ink">{row.ms.toFixed(1)} ms</td>
                    <td className="px-2 py-1 font-mono text-ink-muted">
                      {row.ms > 0 ? Math.round(1000 / row.ms).toLocaleString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {perSecond !== null && slowest !== undefined && (
          <p className="cl-prose mt-3 text-sm text-ink-muted">
            At {slowest.iterations.toLocaleString('en-GB')} iterations this browser manages about{' '}
            <strong className="font-semibold text-ink-strong">
              {Math.round(perSecond).toLocaleString('en-GB')} guesses a second
            </strong>
            . Against a plain unsalted SHA-256, a graphics card manages billions. That gap is what
            you are buying — and it is also the reason the number needs raising every few years,
            because only one side of it improves on its own.
          </p>
        )}

        <p className="cl-prose mt-3 text-sm text-ink-muted">
          Your current setting is {iterations.toLocaleString('en-GB')}. OWASP's 2023 guidance for
          PBKDF2-HMAC-SHA-256 is 600,000, which this page will not run — every iteration here
          happens on the main thread, through a SHA-256 written to be read rather than to be fast.
        </p>
      </section>
    </div>
  );
}
