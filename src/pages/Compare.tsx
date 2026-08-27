import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DIFFICULTY, FAMILIES, SECURITY, ciphers, groupLabelOf } from '../ciphers/registry';
import type { CipherModule, Difficulty, Security } from '../ciphers/types';
import { parseYear } from '../lib/chronology';

/**
 * Every entry on one table, so the metadata can be read across rather than down.
 *
 * The catalogue answers "tell me about this cipher". This answers the questions
 * that only exist between ciphers — which of these can I break in the browser,
 * which have no key at all, what is the oldest thing here that still holds up.
 * None of that needed a new field: it is the metadata the registry already
 * requires, turned ninety degrees.
 *
 * No column is colour-coded. A red-and-green table would claim the security
 * badge is the most urgent fact on the page, and it is not — the "How this
 * breaks" section on each cipher's page is.
 */
type SortKey = 'name' | 'year' | 'family' | 'security' | 'difficulty';

const FAMILY_LABEL = new Map(FAMILIES.map((f) => [f.id, f.label]));
const FAMILY_ORDER = FAMILIES.map((f) => f.id);
const SECURITY_ORDER = Object.keys(SECURITY) as Security[];
const DIFFICULTY_ORDER = Object.keys(DIFFICULTY) as Difficulty[];

function compare(a: CipherModule, b: CipherModule, key: SortKey): number {
  switch (key) {
    case 'year': {
      // Undated last in both directions, because "ancient" is not older or newer
      // than 1977 — it is unknown, and unknown is not a position on the axis.
      const x = parseYear(a.year).sortYear;
      const y = parseYear(b.year).sortYear;
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return x - y;
    }
    case 'family':
      return FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family);
    case 'security':
      return SECURITY_ORDER.indexOf(a.security) - SECURITY_ORDER.indexOf(b.security);
    case 'difficulty':
      return DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty);
    default:
      return a.name.localeCompare(b.name);
  }
}

function SortButton({
  label,
  columnKey,
  sort,
  onSort,
}: {
  label: string;
  columnKey: SortKey;
  sort: { key: SortKey; ascending: boolean };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === columnKey;
  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      aria-label={`Sort by ${label}`}
      className="flex min-h-6 items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted underline-offset-4 hover:text-ink hover:underline"
    >
      {label}
      <span aria-hidden="true" className={active ? 'text-marker-ink' : 'text-transparent'}>
        {active && !sort.ascending ? '▲' : '▼'}
      </span>
    </button>
  );
}

export default function Compare() {
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({
    key: 'year',
    ascending: true,
  });
  const [family, setFamily] = useState<string>('all');
  const [security, setSecurity] = useState<string>('all');

  const rows = useMemo(() => {
    const filtered = ciphers.filter(
      (c) =>
        (family === 'all' || c.family === family) &&
        (security === 'all' || c.security === security),
    );
    const sorted = [...filtered].sort(
      (a, b) => compare(a, b, sort.key) || a.name.localeCompare(b.name),
    );
    return sort.ascending ? sorted : sorted.reverse();
  }, [family, security, sort]);

  const onSort = (key: SortKey) =>
    setSort((current) => ({ key, ascending: current.key === key ? !current.ascending : true }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          Every entry, side by side
        </h1>
        <p className="cl-prose text-ink-muted">
          The catalogue tells you about one cipher at a time. This is the same information across
          all of them, which is the only way to answer the questions that live between ciphers:
          what still holds up, what has a key at all, and which of these you can break here in the
          browser.
        </p>
      </header>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-family" className="cl-label">
            Family
          </label>
          <select
            id="filter-family"
            value={family}
            onChange={(event) => setFamily(event.target.value)}
            className="cl-field"
          >
            <option value="all">All families</option>
            {FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filter-security" className="cl-label">
            Standing
          </label>
          <select
            id="filter-security"
            value={security}
            onChange={(event) => setSecurity(event.target.value)}
            className="cl-field"
          >
            <option value="all">Any standing</option>
            {SECURITY_ORDER.map((key) => (
              <option key={key} value={key}>
                {SECURITY[key].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p aria-live="polite" className="text-sm text-ink-muted">
        {rows.length} {rows.length === 1 ? 'entry' : 'entries'} shown.
      </p>

      {/* Eight columns do not shrink to 320px and should not try. The card
          scrolls; the page does not. */}
      <div className="cl-card overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-3 py-2">
                <SortButton label="Cipher" columnKey="name" sort={sort} onSort={onSort} />
              </th>
              <th scope="col" className="px-3 py-2">
                <SortButton label="Year" columnKey="year" sort={sort} onSort={onSort} />
              </th>
              <th scope="col" className="px-3 py-2">
                <SortButton label="Family" columnKey="family" sort={sort} onSort={onSort} />
              </th>
              <th scope="col" className="px-3 py-2">
                <SortButton label="Standing" columnKey="security" sort={sort} onSort={onSort} />
              </th>
              <th scope="col" className="px-3 py-2">
                <SortButton label="Level" columnKey="difficulty" sort={sort} onSort={onSort} />
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
              >
                Key
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
              >
                Breakable here
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
              >
                Reversible
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cipher) => (
              <tr key={cipher.slug} className="border-b border-line align-top last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <Link
                    to={`/cipher/${cipher.slug}`}
                    className="font-semibold text-ink-strong underline underline-offset-4 hover:text-marker-ink"
                  >
                    {cipher.name}
                  </Link>
                  <span className="block text-xs text-ink-subtle">
                    {groupLabelOf(cipher.slug) ?? '—'}
                  </span>
                </th>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-muted">
                  {cipher.year ?? '—'}
                </td>
                <td className="px-3 py-2 text-ink-muted">{FAMILY_LABEL.get(cipher.family)}</td>
                <td className="px-3 py-2 text-ink-muted">{SECURITY[cipher.security].label}</td>
                <td className="px-3 py-2 text-ink-muted">{DIFFICULTY[cipher.difficulty].label}</td>
                <td className="px-3 py-2 text-ink-muted">{cipher.keyType ?? '—'}</td>
                <td className="px-3 py-2 text-ink-muted">
                  {cipher.tiers.includes('attack') ? 'Yes — Attack tab' : 'No'}
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {cipher.oneWay === true ? 'One-way' : 'Yes'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="cl-prose text-sm text-ink-muted">
        <strong className="font-semibold text-ink">Breakable here</strong> means this app ships a
        working attack, not that the cipher is unbroken otherwise. Several of the entries marked
        &ldquo;No&rdquo; are thoroughly broken in the literature — Hill and Enigma both fall to a
        known crib, MD5 and SHA-1 both fall to collisions — but the attack needs an input this
        app&rsquo;s attack signature cannot pass it. Every one of those pages says which, and why,
        in its explainer.
      </p>
    </div>
  );
}
