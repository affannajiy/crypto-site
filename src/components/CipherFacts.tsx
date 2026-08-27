import { DIFFICULTY, FAMILIES, groupLabelOf, SECURITY } from '../ciphers/registry';
import type { CipherModule } from '../ciphers/types';

/**
 * The information card: what this algorithm is, where it came from, and how far
 * it can be trusted.
 *
 * Everything here is read from `CipherModule`, so no component branches on a
 * slug and a new cipher gets its card by declaring metadata rather than by
 * anyone editing this file.
 *
 * **No rating is colour-coded.** Orange in this app means "look here" and
 * nothing else, and a red/green scale would say the security rating is the most
 * urgent thing on the page — which it is not, because the "How this breaks"
 * section below it is. The words carry the meaning, which is also what keeps
 * this readable to a screen reader and in a greyscale print.
 */

export function SecurityBadge({ cipher }: { cipher: CipherModule }) {
  return (
    <span className="rounded border border-line-strong bg-surface px-1.5 py-0.5 text-xs font-medium text-ink">
      {SECURITY[cipher.security].label}
    </span>
  );
}

export function DifficultyBadge({ cipher }: { cipher: CipherModule }) {
  return (
    <span className="rounded border border-line bg-sunken px-1.5 py-0.5 text-xs text-ink-muted">
      {DIFFICULTY[cipher.difficulty].label}
    </span>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-line py-2 first:border-t-0 sm:flex-row sm:gap-4 sm:py-1.5">
      <dt className="text-xs uppercase tracking-wide text-ink-subtle sm:w-40 sm:shrink-0">
        {term}
      </dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

export default function CipherFacts({ cipher }: { cipher: CipherModule }) {
  const family = FAMILIES.find((f) => f.id === cipher.family);
  const heading = groupLabelOf(cipher.slug);

  return (
    <section aria-labelledby="facts-heading" className="cl-card px-4 py-4">
      <h2 id="facts-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
        At a glance
      </h2>

      <dl className="mt-3 flex flex-col">
        <Fact term="Family">
          {family?.label ?? cipher.family}
          {heading !== undefined && ` · ${heading}`}
        </Fact>
        {cipher.year !== undefined && <Fact term="Era">{cipher.year}</Fact>}
        {cipher.origin !== undefined && <Fact term="Origin">{cipher.origin}</Fact>}
        {cipher.keyType !== undefined && <Fact term="Key">{cipher.keyType}</Fact>}
        <Fact term="Difficulty">{DIFFICULTY[cipher.difficulty].label}</Fact>
        <Fact term="Security">
          <span className="font-medium text-ink-strong">{SECURITY[cipher.security].label}</span>
          <span className="mt-0.5 block text-ink-muted">{SECURITY[cipher.security].summary}</span>
        </Fact>
      </dl>

      <p className="mt-3 border-t border-line pt-3 text-sm text-ink-muted">
        Every entry here carries a{' '}
        <a href="#explainer-heading" className="underline underline-offset-4 hover:text-ink">
          How this breaks
        </a>
        section, below. This one is no exception.
      </p>
    </section>
  );
}
