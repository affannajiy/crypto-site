import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ciphers, getCipher } from '../ciphers/registry';
import { defaultParams } from '../ciphers/params';
import type { CipherModule, Params } from '../ciphers/types';
import ParamControls from '../components/ParamControls';
import { useCipherRun } from '../components/useCipherRun';

/**
 * One message, two ciphers, at the same time.
 *
 * A cipher page can only ever answer "what does this one do". The questions
 * underneath the catalogue are comparative — why does changing one letter change
 * the whole SHA-256 digest but only one letter of the Caesar output, and why do
 * Vigenere and Beaufort produce different text from the same keyword. Both are
 * one screen and a shared input away, and neither survives being described.
 *
 * The two sides are ordinary `useCipherRun` calls, so async ciphers, thrown
 * parameter errors and the stale-response guard all behave exactly as they do on
 * a cipher page. Nothing here knows the name of a cipher.
 */
function useSide(initialSlug: string) {
  const [slug, setSlug] = useState(initialSlug);
  const cipher = getCipher(slug) ?? ciphers[0];
  const [params, setParams] = useState<Params>(() => defaultParams(cipher?.params ?? []));

  // Params belong to a cipher, so switching cipher must not carry the old ones
  // across — an AES key in a Caesar shift is a confusing error rather than an
  // interesting one.
  useEffect(() => {
    setParams(defaultParams(cipher?.params ?? []));
  }, [cipher]);

  const onParamChange = (name: string, value: string | number) =>
    setParams((current) => ({ ...current, [name]: value }));

  return { slug, setSlug, cipher, params, onParamChange };
}

function SideOutput({
  cipher,
  input,
  params,
}: {
  cipher: CipherModule;
  input: string;
  params: Params;
}) {
  const run = useCipherRun(cipher, input, params, 'encrypt');

  if (run.status === 'running') {
    return <p className="text-sm text-ink-subtle">Working…</p>;
  }

  if (run.status === 'error') {
    return (
      <div role="status" className="cl-card border-marker-mid bg-marker-wash px-3 py-2 text-sm">
        <p className="font-medium text-ink">This one will not run.</p>
        <p className="mt-1 text-ink-muted">{run.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* wrap-anywhere, not break-words: a 96-character hex digest with no
          spaces in it widens the grid track past the viewport otherwise. */}
      <output className="cl-card block min-h-24 wrap-anywhere px-3 py-2 font-mono text-sm text-ink">
        {run.result.output}
      </output>
      <p className="text-xs text-ink-subtle">
        {run.result.output.length} characters out, {run.result.steps.length}{' '}
        {run.result.steps.length === 1 ? 'step' : 'steps'} traced.{' '}
        <Link
          to={`/cipher/${cipher.slug}`}
          className="underline underline-offset-4 hover:text-marker-ink"
        >
          Open the steps
        </Link>
        .
      </p>
    </div>
  );
}

function Side({
  heading,
  side,
  input,
}: {
  heading: string;
  side: ReturnType<typeof useSide>;
  input: string;
}) {
  const selectId = useId();
  const { cipher } = side;
  if (cipher === undefined) return null;

  return (
    <section aria-label={heading} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="cl-label">
          {heading}
        </label>
        <select
          id={selectId}
          value={side.slug}
          onChange={(event) => side.setSlug(event.target.value)}
          className="cl-field w-full"
        >
          {ciphers.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm leading-relaxed text-ink-muted">{cipher.blurb}</p>

      <ParamControls specs={cipher.params} values={side.params} onChange={side.onParamChange} />

      <SideOutput cipher={cipher} input={input} params={side.params} />
    </section>
  );
}

export default function Playground() {
  const inputId = useId();
  const [input, setInput] = useState('The quick brown fox jumps over the lazy dog');

  // Two starting points chosen to make the page's point immediately: same
  // keyword, same message, different tables, different output.
  const left = useSide('vigenere');
  const right = useSide('beaufort');

  const identical = useMemo(() => left.slug === right.slug, [left.slug, right.slug]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          One message, two ciphers
        </h1>
        <p className="cl-prose text-ink-muted">
          Type once and watch both sides move. This is the page for the questions that need two
          algorithms to ask: change a single letter and see it move one character of a Caesar
          output and every character of a SHA-256 digest, or give Vigen&egrave;re and Beaufort the
          same keyword and watch them disagree.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="cl-label">
          Message
        </label>
        <textarea
          id={inputId}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          className="cl-field w-full wrap-anywhere font-mono"
          spellCheck={false}
        />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Side heading="On the left" side={left} input={input} />
        <Side heading="On the right" side={right} input={input} />
      </div>

      {identical && (
        <p role="status" className="cl-prose text-sm text-ink-muted">
          Both sides are running the same cipher. That is a legitimate thing to want — two keys,
          one algorithm, is how you see what the key actually does — but if you meant to compare
          two ciphers, change one of the dropdowns.
        </p>
      )}

      <p className="cl-prose text-sm text-ink-muted">
        Both sides encrypt. There is no direction control here on purpose: a decrypt on one side
        and an encrypt on the other is two unrelated runs sharing a text box, and the comparison
        it invites is a false one. To reverse something, open its own page.
      </p>
    </div>
  );
}
