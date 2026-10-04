import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { populatedFamilies, searchCiphers } from '../ciphers/registry';
import { DifficultyBadge, SecurityBadge } from '../components/CipherFacts';
import type { CipherModule, Tier } from '../ciphers/types';

/**
 * The catalogue. Everything on this page comes from the registry, so a new
 * cipher folder appears here on its own — including its sub-heading, which is
 * read from the folder it was created in.
 */
const TIER_LABELS: Record<Tier, string> = {
  encrypt: 'Encrypt',
  attack: 'Attack',
  visualize: 'Visualize',
  benchmark: 'Benchmark',
};

function CipherGrid({ ciphers }: { ciphers: CipherModule[] }) {
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ciphers.map((cipher) => (
        <li key={cipher.slug} className="flex">
          <Link
            to={`/cipher/${cipher.slug}`}
            className="cl-card flex w-full flex-col gap-2 px-4 py-4 transition-colors hover:border-marker-mid hover:bg-marker-wash"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-ink-strong">{cipher.name}</span>
              {cipher.year !== undefined && (
                <span className="shrink-0 font-mono text-xs text-ink-subtle">{cipher.year}</span>
              )}
            </span>

            <span className="text-sm leading-relaxed text-ink-muted">{cipher.blurb}</span>

            <span className="mt-1 flex flex-wrap gap-1">
              <SecurityBadge cipher={cipher} />
              <DifficultyBadge cipher={cipher} />
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
  );
}

export default function Home() {
  const families = populatedFamilies();
  const total = families.reduce((sum, family) => sum + family.ciphers.length, 0);

  const [query, setQuery] = useState('');
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  // '/' jumps to the search box, the way it does in most tools that have one.
  // Guarded against firing while the reader is typing into something else,
  // which is the bug every implementation of this shortcut starts with.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const trimmed = query.trim();
  // Searching is cheap — the haystacks are built once at module load — but the
  // results feed a list that would otherwise rebuild on every unrelated render.
  const results = useMemo(() => (trimmed === '' ? null : searchCiphers(trimmed)), [trimmed]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex w-full flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          See how ciphers actually work
        </h1>
        <p className="cl-prose text-ink-muted">
          CryptoLab follows the course from pen and paper to public keys. The classical ciphers
          come in two halves. Substitution replaces each letter with another, which hides what
          the letters are: this is confusion. Transposition keeps the letters but moves them,
          which hides where they are: this is diffusion. Then come the stream ciphers, which XOR
          a computed keystream into the message, and the block ciphers, from the Feistel structure
          through DES and Triple DES to AES, with all five modes of operation. Last is RSA, with
          its digital signatures.
        </p>
        <p className="cl-prose text-ink-muted">
          Each page encrypts a message and then lists every step the algorithm took to get there.
          Every first example is the one from the lecture or the lab sheet, so you can check your
          working against it. Where a cipher can be broken, the page breaks it, and where it can be
          drawn, the page shows it move.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor={searchId} className="cl-label">
          Search the catalogue
        </label>
        <input
          id={searchId}
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="caesar, columnar, polyalphabetic, transposition…  (press /, or Ctrl-K anywhere)"
          className="cl-field w-full"
          autoComplete="off"
        />
        {/* Announced rather than merely shown, so a screen reader hears the count
            change as the query is typed. */}
        <p aria-live="polite" className="text-sm text-ink-muted">
          {results === null
            ? `${total} ${total === 1 ? 'entry' : 'entries'} in the catalogue.`
            : `${results.length} ${results.length === 1 ? 'match' : 'matches'} for “${trimmed}”.`}
        </p>
      </div>

      {results !== null ? (
        results.length === 0 ? (
          <p className="cl-prose text-ink-muted">
            Nothing matches every word of that search. The search reads names, families, key
            types and related terms, whereby “columnar” finds Row Transposition and “shift” finds
            Caesar. However, it does not guess at spellings, so a near miss returns nothing rather
            than the wrong cipher.
          </p>
        ) : (
          <CipherGrid ciphers={results} />
        )
      ) : (
        <>
      {families.map((family) => (
        <section key={family.id} aria-labelledby={`family-${family.id}`} className="flex flex-col gap-4">
          <div>
            <h2 id={`family-${family.id}`} className="text-lg font-semibold text-ink-strong">
              {family.label}
            </h2>
            <p className="cl-prose mt-1 text-sm text-ink-muted">{family.description}</p>
          </div>

          {family.groups.length === 0 ? (
            <CipherGrid ciphers={family.ciphers} />
          ) : (
            family.groups.map((group) => (
              <section key={group.id} aria-labelledby={`group-${family.id}-${group.id}`}>
                <h3
                  id={`group-${family.id}-${group.id}`}
                  className="text-sm font-semibold uppercase tracking-wide text-ink-subtle"
                >
                  {group.label}
                </h3>
                <p className="cl-prose mt-1 text-sm text-ink-muted">{group.description}</p>
                <CipherGrid ciphers={group.ciphers} />
              </section>
            ))
          )}
        </section>
      ))}

      <p className="text-sm text-ink-subtle">
        {total} {total === 1 ? 'entry' : 'entries'}. The same set reads differently
        as <Link to="/compare" className="underline underline-offset-4 hover:text-ink">one table</Link>,
        or <Link to="/playground" className="underline underline-offset-4 hover:text-ink">all at once on one message</Link>.
      </p>
        </>
      )}
    </div>
  );
}
