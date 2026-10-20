import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { populatedFamilies, searchCiphers } from '../ciphers/registry';
import { SecurityBadge } from '../components/CipherFacts';
import type { CipherModule } from '../ciphers/types';

/**
 * The catalogue. Everything on this page comes from the registry, so a new
 * cipher folder appears here on its own — including its sub-heading, which is
 * read from the folder it was created in.
 */
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

            <span className="mt-auto">
              <SecurityBadge cipher={cipher} />
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
    <div className="flex flex-col gap-8">
      <header className="flex w-full flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          See how ciphers actually work
        </h1>
        <p className="text-ink-muted">Encrypt a message. Read every step. Examples follow the lectures.</p>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor={searchId} className="sr-only">
          Search
        </label>
        <input
          id={searchId}
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ciphers  ( / )"
          className="cl-field w-full"
          autoComplete="off"
        />
        {/* Announced rather than merely shown, so a screen reader hears the count
            change as the query is typed. */}
        <p aria-live="polite" className="text-sm text-ink-subtle">
          {results === null
            ? `${total} ciphers`
            : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
        </p>
      </div>

      {results !== null ? (
        results.length === 0 ? (
          <p className="text-ink-muted">No match. Try a name, family or key type.</p>
        ) : (
          <CipherGrid ciphers={results} />
        )
      ) : (
        <>
      {families.map((family) => (
        <section key={family.id} aria-labelledby={`family-${family.id}`} className="flex flex-col gap-4">
          <h2 id={`family-${family.id}`} className="text-lg font-semibold text-ink-strong">
            {family.label}
          </h2>

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
                <CipherGrid ciphers={group.ciphers} />
              </section>
            ))
          )}
        </section>
      ))}
        </>
      )}
    </div>
  );
}
