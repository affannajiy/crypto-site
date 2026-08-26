import { Link, useParams } from 'react-router-dom';
import { getCipher } from '../ciphers/registry';
import CipherWorkbench from '../components/CipherWorkbench';
import Markdown from '../components/Markdown';

const FAMILY_LABELS: Record<string, string> = {
  classical: 'Classical',
  hashing: 'Hashing',
  symmetric: 'Symmetric',
  asymmetric: 'Asymmetric',
};

export default function CipherPage() {
  const { slug } = useParams();
  const cipher = getCipher(slug);

  if (cipher === undefined) {
    return (
      <div className="flex w-full flex-col gap-4">
        <h1 className="text-2xl font-semibold text-ink-strong">No cipher called “{slug}”</h1>
        <p className="cl-prose text-ink-muted">
          That address does not match anything in the catalogue. It may have been renamed, or
          it may not be built yet.
        </p>
        <p>
          <Link to="/" className="cl-button">
            Back to the catalogue
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb">
        <Link
          to="/"
          className="inline-block py-1 text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          ← All ciphers
        </Link>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
            {cipher.name}
          </h1>
          <span className="rounded border border-line bg-sunken px-1.5 py-0.5 text-xs text-ink-muted">
            {FAMILY_LABELS[cipher.family] ?? cipher.family}
          </span>
          {cipher.year !== undefined && (
            <span className="font-mono text-sm text-ink-subtle">{cipher.year}</span>
          )}
        </div>
        <p className="cl-prose text-ink-muted">{cipher.blurb}</p>
      </header>

      {/* Remounts on a slug change so no state survives from the previous cipher. */}
      <CipherWorkbench key={cipher.slug} cipher={cipher} />

      <section aria-labelledby="explainer-heading" className="border-t border-line pt-8">
        <h2 id="explainer-heading" className="mb-4 text-lg font-semibold text-ink-strong">
          About {cipher.name}
        </h2>
        <Markdown source={cipher.explainer} />
      </section>
    </div>
  );
}
