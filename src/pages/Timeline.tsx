import { Link } from 'react-router-dom';
import { FAMILIES, ciphers, groupLabelOf } from '../ciphers/registry';
import { DifficultyBadge, SecurityBadge } from '../components/CipherFacts';
import { ERAS, byYear, eraOf, parseYear } from '../lib/chronology';

/**
 * The catalogue in the order it happened.
 *
 * The home page groups by family, which is the right shape for "what kind of
 * thing is this" and the wrong shape for "what came next". Reading the same
 * thirty-two entries by date is a different lesson: the Renaissance keyword and
 * the machine that replaced it are four centuries apart, and no amount of
 * describing that lands the way the gap on this page does.
 *
 * Nothing here is declared by a cipher. The dates are the `year` field the
 * catalogue already prints, parsed by `lib/chronology`.
 */
const FAMILY_LABEL = new Map(FAMILIES.map((f) => [f.id, f.label]));

export default function Timeline() {
  const ordered = byYear(ciphers, (c) => c.year);
  const undated = ordered.filter((c) => parseYear(c.year).sortYear === null);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          Two and a half thousand years, in order
        </h1>
        <p className="cl-prose text-ink-muted">
          The same entries as the catalogue, sorted by when they appeared rather than by what
          kind of thing they are. The dates are as precise as the history is — a decade or a
          tilde means nobody knows better, and the page says so rather than inventing a year.
        </p>
        <p className="cl-prose text-ink-muted">
          The shape worth noticing: almost nothing changes for two thousand years, then
          everything changes in fifty. Every entry above 1970 was published in the open, and
          that is the actual break in the story — not a new mathematics, a new willingness to
          print it.
        </p>
      </header>

      {ERAS.map((era) => {
        const members = ordered.filter((c) => eraOf(parseYear(c.year).sortYear)?.label === era.label);
        if (members.length === 0) return null;

        return (
          <section key={era.label} aria-labelledby={`era-${era.label}`} className="flex flex-col gap-3">
            <div>
              <h2 id={`era-${era.label}`} className="text-lg font-semibold text-ink-strong">
                {era.label}
              </h2>
              <p className="cl-prose mt-1 text-sm text-ink-muted">{era.note}</p>
            </div>

            <ol className="flex flex-col">
              {members.map((cipher) => {
                const { approximate } = parseYear(cipher.year);
                const group = groupLabelOf(cipher.slug);
                return (
                  <li key={cipher.slug} className="flex gap-3 sm:gap-4">
                    {/* The rail: a date, then a line that runs the height of the
                        row so the entries read as one sequence rather than as a
                        stack of unrelated cards. */}
                    <div className="flex w-20 shrink-0 flex-col items-end pt-4 sm:w-24">
                      <span className="font-mono text-xs text-ink-subtle">{cipher.year}</span>
                      {approximate && (
                        <span className="text-[0.65rem] text-ink-subtle">approximate</span>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-center" aria-hidden="true">
                      <span className="mt-5 h-2 w-2 shrink-0 rounded-full bg-marker" />
                      <span className="w-px flex-1 bg-line" />
                    </div>

                    <Link
                      to={`/cipher/${cipher.slug}`}
                      className="cl-card mb-3 flex w-full min-w-0 flex-col gap-2 px-4 py-3 transition-colors hover:border-marker-mid hover:bg-marker-wash"
                    >
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold text-ink-strong">{cipher.name}</span>
                        <span className="text-xs text-ink-subtle">
                          {FAMILY_LABEL.get(cipher.family)}
                          {group === undefined ? '' : ` · ${group}`}
                        </span>
                      </span>
                      {cipher.origin !== undefined && (
                        <span className="text-sm text-ink-muted">{cipher.origin}</span>
                      )}
                      <span className="text-sm leading-relaxed text-ink-muted">{cipher.blurb}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <SecurityBadge cipher={cipher} />
                        <DifficultyBadge cipher={cipher} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      {undated.length > 0 && (
        <section aria-labelledby="era-undated" className="flex flex-col gap-3">
          <div>
            <h2 id="era-undated" className="text-lg font-semibold text-ink-strong">
              No date at all
            </h2>
            <p className="cl-prose mt-1 text-sm text-ink-muted">
              A cipher whose `year` names no number sorts here rather than being guessed into a
              century. There is no honest place on a timeline for “ancient”.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {undated.map((cipher) => (
              <li key={cipher.slug} className="flex">
                <Link
                  to={`/cipher/${cipher.slug}`}
                  className="cl-card flex w-full flex-col gap-1 px-4 py-3 transition-colors hover:border-marker-mid hover:bg-marker-wash"
                >
                  <span className="font-semibold text-ink-strong">{cipher.name}</span>
                  <span className="text-sm text-ink-muted">{cipher.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
