/**
 * Alice, Bob, and Eve.
 *
 * The exchange drawn as three columns: what Alice knows, what crossed the wire,
 * what Bob knows — with Eve's column underneath holding exactly the four numbers
 * that were public. Seeing Eve's column contain everything that was transmitted,
 * and still not contain the shared secret, is the entire idea.
 *
 * Then Eve tries. The discrete logarithm is solved here by trying every exponent,
 * which is the only method this page can offer and is also the honest one: the
 * security of Diffie-Hellman is not that the problem cannot be solved, it is that
 * the loop is too long to run. On a 100,000-ish prime it finishes in milliseconds,
 * and that is the number worth putting on screen next to "2048 bits".
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useMemo, useState } from 'react';
import type { Params, Step } from '../../../types';
import { discreteLog, exchange, modPow } from './dh';

function readNumber(params: Params, name: string, fallback: number): number {
  const value = Number(params[name]);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function Column({
  who,
  rows,
  tone,
}: {
  who: string;
  rows: { label: string; value: string; secret: boolean }[];
  tone: 'party' | 'eve';
}) {
  return (
    <div
      className={[
        'cl-card min-w-0 flex-1 px-4 py-3',
        tone === 'eve' ? 'border-marker-mid bg-marker-wash' : '',
      ].join(' ')}
    >
      <p className="cl-label">{who}</p>
      <dl className="mt-2 flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-ink-subtle">{row.label}</dt>
            <dd
              className={[
                'font-mono text-sm',
                row.secret ? 'text-marker-ink' : 'text-ink-strong',
              ].join(' ')}
            >
              {row.value}
              {row.secret && <span className="ml-1 text-[10px] text-ink-subtle">secret</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function DhChannel({ steps, params }: { steps: Step[]; params: Params }) {
  const [cracked, setCracked] = useState<{ a: number; tried: number; ms: number; shared: number; matches: boolean } | null>(
    null,
  );

  const p = readNumber(params, 'p', 104729);
  const g = readNumber(params, 'g', 3);
  const a = readNumber(params, 'a', 12345);
  const b = readNumber(params, 'b', 54321);

  const meeting = useMemo(() => {
    try {
      return exchange(p, g, a, b);
    } catch {
      return null;
    }
  }, [p, g, a, b]);

  if (meeting === null) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        These parameters do not make a valid exchange. The Encrypt tab says which condition failed.
      </p>
    );
  }

  const crack = () => {
    const started = performance.now();
    const found = discreteLog(meeting.g, meeting.publicA, meeting.p);
    const ms = performance.now() - started;
    if (found === null) {
      setCracked(null);
      return;
    }
    const shared = Number(modPow(BigInt(meeting.publicB), BigInt(found.exponent), BigInt(meeting.p)));
    setCracked({
      a: found.exponent,
      tried: found.tried,
      ms,
      shared,
      matches: shared === meeting.shared,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="dh-channel" className="flex flex-col gap-3">
        <h3 id="dh-channel" className="text-sm font-semibold text-ink-strong">
          The channel
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Column
            who="Alice knows"
            tone="party"
            rows={[
              { label: 'p', value: String(meeting.p), secret: false },
              { label: 'g', value: String(meeting.g), secret: false },
              { label: 'her secret a', value: String(meeting.a), secret: true },
              { label: 'B from Bob', value: String(meeting.publicB), secret: false },
              { label: 'shared = B^a', value: String(meeting.shared), secret: true },
            ]}
          />
          <Column
            who="Bob knows"
            tone="party"
            rows={[
              { label: 'p', value: String(meeting.p), secret: false },
              { label: 'g', value: String(meeting.g), secret: false },
              { label: 'his secret b', value: String(meeting.b), secret: true },
              { label: 'A from Alice', value: String(meeting.publicA), secret: false },
              { label: 'shared = A^b', value: String(meeting.shared), secret: true },
            ]}
          />
        </div>

        <Column
          who="Eve has recorded every single message, and has:"
          tone="eve"
          rows={[
            { label: 'p', value: String(meeting.p), secret: false },
            { label: 'g', value: String(meeting.g), secret: false },
            { label: 'A', value: String(meeting.publicA), secret: false },
            { label: 'B', value: String(meeting.publicB), secret: false },
            { label: 'shared', value: '?', secret: false },
          ]}
        />

        <p className="cl-prose text-sm text-ink-muted">
          Eve is not missing a message. She has <strong>everything that was ever transmitted</strong>
          , and the two parties still share a number she does not have. Nothing secret crossed the
          wire, so there was never a moment at which intercepting the traffic would have helped. That
          is the thing that was unthinkable before 1976.
        </p>
      </section>

      <section aria-labelledby="dh-eve" className="flex flex-col gap-3">
        <h3 id="dh-eve" className="text-sm font-semibold text-ink-strong">
          Eve tries anyway
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          To get the shared number, Eve needs Alice&rsquo;s secret{' '}
          <span className="font-mono">a</span> from{' '}
          <span className="font-mono">
            {meeting.g}
            <sup>a</sup> mod {meeting.p} = {meeting.publicA}
          </span>
          . That is the <strong>discrete logarithm problem</strong>, and the only method this page
          can offer is trying every exponent.
        </p>

        <div>
          <button type="button" className="cl-button cl-button-primary" onClick={crack}>
            Solve for a
          </button>
        </div>

        {cracked !== null && (
          <div className="cl-card flex flex-col gap-2 px-4 py-3">
            <p className="font-mono text-sm text-ink-strong">a = {cracked.a}</p>
            {cracked.a !== a && (
              <p className="cl-prose text-sm text-ink-muted">
                Note that this is <strong>not</strong> the number Alice chose ({a}) &mdash; and it
                does not need to be. Eve found the smallest exponent that produces the same value,
                which is congruent to Alice&rsquo;s modulo the order of g. It gives the identical
                shared secret, so Alice&rsquo;s actual choice was never the target. An attacker does
                not have to recover your secret; they only have to recover something that behaves
                like it.
              </p>
            )}
            <p className="font-mono text-sm text-ink">
              B<sup>a</sup> mod p = {cracked.shared}
            </p>
            <p className="text-sm text-ink-muted">
              {cracked.tried.toLocaleString('en-GB')} exponents tried, {cracked.ms.toFixed(2)} ms.{' '}
              {cracked.matches ? (
                <strong>
                  Eve now has the shared secret and can read the message on the Encrypt tab.
                </strong>
              ) : (
                'The recovered secret does not reproduce the shared number, which should not happen.'
              )}
            </p>
          </div>
        )}

        <p className="cl-prose text-sm text-ink-muted">
          That loop ran <span className="font-mono">p</span> times at worst. Real Diffie-Hellman uses
          a prime of <strong>2048 bits or more</strong>, so the same loop would run about 10
          <sup>616</sup> times &mdash; and the best known algorithm, the number field sieve, is far
          faster than that and still nowhere near enough. Note what this means: Diffie-Hellman is not
          secure because the discrete logarithm is impossible. It is secure because{' '}
          <strong>this loop is too long</strong>, which is a statement about how fast computers are
          and what algorithms are known. Shor&rsquo;s algorithm solves it in polynomial time on a
          quantum computer, exactly as it factors for RSA.
        </p>
      </section>

      <section aria-labelledby="dh-mitm" className="flex flex-col gap-3">
        <h3 id="dh-mitm" className="text-sm font-semibold text-ink-strong">
          The attack that actually works
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Eve does not have to break the mathematics. She has to sit in the middle. If she can
          intercept and <em>replace</em> rather than merely listen, she runs one exchange with Alice
          and a second with Bob, holding a different shared secret with each. She decrypts
          everything Alice sends, reads it, re-encrypts it for Bob, and neither of them notices,
          because nothing in the exchange above says <strong>who</strong> the other party is.
        </p>
        <p className="cl-prose text-sm text-ink-muted">
          Plain Diffie-Hellman gives you a secret shared with <em>somebody</em>. Which somebody is a
          separate problem, and it is solved by <strong>authentication</strong> &mdash; signatures,
          certificates, a trusted third party. That is what the certificate in your browser&rsquo;s
          address bar is for, and it is why an unauthenticated key exchange is not a secure channel.
        </p>
      </section>

      <details className="cl-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink-strong">
          The steps as the algorithm ran them
        </summary>
        <ol className="mt-3 flex flex-col gap-2">
          {steps.map((step) => (
            <li key={step.index} className="text-sm">
              <p className="font-semibold text-ink">{step.title}</p>
              <p className="cl-prose text-ink-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
