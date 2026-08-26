import { Link } from 'react-router-dom';
import { populatedFamilies } from '../ciphers/registry';
import type { Tier } from '../ciphers/types';

/**
 * The catalogue. Everything on this page comes from the registry, so a new
 * cipher folder appears here on its own.
 */
const TIER_LABELS: Record<Tier, string> = {
  encrypt: 'Encrypt',
  attack: 'Attack',
  visualize: 'Visualize',
  benchmark: 'Benchmark',
};

export default function Home() {
  const families = populatedFamilies();
  const total = families.reduce((sum, family) => sum + family.ciphers.length, 0);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex w-full flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          See how ciphers actually work
        </h1>
        <p className="cl-prose text-ink-muted">
          Encrypt something, then read every step the algorithm took to get there. Where a
          cipher can be broken, break it. Where it can be drawn, watch it move.
        </p>
      </header>

      {families.map((family) => (
        <section key={family.id} aria-labelledby={`family-${family.id}`}>
          <h2 id={`family-${family.id}`} className="text-lg font-semibold text-ink-strong">
            {family.label}
          </h2>
          <p className="cl-prose mt-1 text-sm text-ink-muted">{family.description}</p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {family.ciphers.map((cipher) => (
              <li key={cipher.slug} className="flex">
                <Link
                  to={`/cipher/${cipher.slug}`}
                  className="cl-card flex w-full flex-col gap-2 px-4 py-4 transition-colors hover:border-marker-mid hover:bg-marker-wash"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink-strong">{cipher.name}</span>
                    {cipher.year !== undefined && (
                      <span className="shrink-0 font-mono text-xs text-ink-subtle">
                        {cipher.year}
                      </span>
                    )}
                  </span>

                  <span className="text-sm leading-relaxed text-ink-muted">{cipher.blurb}</span>

                  <span className="mt-1 flex flex-wrap gap-1">
                    {cipher.tiers.map((tier) => (
                      <span
                        key={tier}
                        className="rounded border border-line bg-sunken px-1.5 py-0.5 text-xs text-ink-muted"
                      >
                        {TIER_LABELS[tier]}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-sm text-ink-subtle">
        {total} {total === 1 ? 'cipher' : 'ciphers'} so far. Hashing, symmetric, and asymmetric
        families are next.
      </p>
    </div>
  );
}
