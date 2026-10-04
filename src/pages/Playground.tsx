import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GROUPS, TECHNIQUES, ciphers, groupLabelOf, techniqueOf } from '../ciphers/registry';
import { textStartParams } from '../ciphers/params';
import type { CipherModule, ParamSpec, Params } from '../ciphers/types';
import ParamControls from '../components/ParamControls';
import { useCipherRun, type Direction } from '../components/useCipherRun';

/**
 * One message, every cipher, at the same time.
 *
 * A cipher page answers "what does this one do". This page answers "what do they
 * all do to the same thing". Put the same sentence through a substitution and a
 * transposition and the difference between confusion and diffusion is visible
 * without a word of explanation: one row keeps the letters in place and changes
 * them, the other keeps the letters and moves them.
 *
 * Each row is an ordinary `useCipherRun`, so async ciphers, thrown param errors
 * and the stale-response guard behave exactly as they do on a cipher page. The
 * rows come from the registry and nothing here knows the name of a cipher.
 *
 * One direction applies to every row. Decrypting is useful here: paste a
 * ciphertext and see which row reads as English. Mixing directions across rows
 * would be two unrelated runs sharing a text box.
 *
 * Every shown cipher has a row, in the order of the course: the classical
 * techniques, then the pad, the stream ciphers, the block ciphers and RSA. A row
 * starts on `textStartParams`, the textbook key with the cipher's own
 * `textParams` on top, so Feistel and RSA read the sentence instead of
 * expecting binary or numbers.
 */

/** The key in one line, for the collapsed row: "Shift 3", "Keyword MONARCHY". */
function keySummary(specs: readonly ParamSpec[], values: Params): string {
  return specs
    .map((spec) => {
      const value = values[spec.name];
      if (spec.kind === 'select') {
        const option = spec.options.find((o) => o.value === value);
        return `${spec.label}: ${option?.label ?? String(value)}`;
      }
      return `${spec.label}: ${String(value ?? '')}`;
    })
    .join(' · ');
}

function Row({
  cipher,
  input,
  direction,
  onDecrypt,
}: {
  cipher: CipherModule;
  input: string;
  direction: Direction;
  /** Puts this row's ciphertext in the message box and flips every row to decrypt. */
  onDecrypt: (ciphertext: string) => void;
}) {
  const [params, setParams] = useState<Params>(() => textStartParams(cipher));
  const [copied, setCopied] = useState(false);
  const copyButton = useRef<HTMLButtonElement>(null);
  const run = useCipherRun(cipher, input, params, direction);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const onParamChange = (name: string, value: string | number) =>
    setParams((current) => ({ ...current, [name]: value }));

  const output = run.status === 'done' ? run.result.output : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
    } catch {
      // Clipboard access can be refused. The output is on screen to select by hand.
    }
  };

  return (
    <li className="cl-card flex min-w-0 flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold text-ink-strong">
          <Link
            to={`/cipher/${cipher.slug}`}
            className="underline underline-offset-4 hover:text-marker-ink"
          >
            {cipher.name}
          </Link>
        </h3>
        <p className="min-w-0 wrap-anywhere font-mono text-xs text-ink-subtle">
          {keySummary(cipher.params, params)}
        </p>
      </div>

      {run.status === 'running' && <p className="text-sm text-ink-subtle">Working…</p>}

      {/* Decrypting, most rows are expected to fail: a Caesar ciphertext is not
          hex, and an AES ciphertext is not letters. That is a quiet line, not
          an orange box, because nothing is wrong. */}
      {run.status === 'error' &&
        (direction === 'decrypt' ? (
          <p role="status" className="text-sm text-ink-subtle">
            Not a ciphertext this one can read. {run.message}
          </p>
        ) : (
          <div role="status" className="rounded border border-marker-mid bg-marker-wash px-3 py-2 text-sm">
            <p className="font-medium text-ink">This one will not run with this key.</p>
            <p className="mt-1 text-ink-muted">{run.message}</p>
          </div>
        ))}

      {run.status === 'done' && (
        <div className="flex items-start gap-2">
          {/* wrap-anywhere, not break-words: a long run with no spaces in it
              widens the row past the viewport otherwise. */}
          <output className="block min-h-6 min-w-0 flex-1 wrap-anywhere font-mono text-sm text-ink">
            {output === '' ? <span className="text-ink-subtle">(empty)</span> : output}
          </output>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="cl-button"
              ref={copyButton}
              onClick={copy}
              disabled={output === ''}
              aria-live="polite"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            {direction === 'encrypt' && (
              <button
                type="button"
                className="cl-button"
                onClick={() => {
                  onDecrypt(output);
                  // This button leaves with encrypt mode. Keep focus in the row,
                  // which now shows the decryption, instead of dropping it to the page.
                  copyButton.current?.focus();
                }}
                disabled={output === ''}
              >
                Decrypt this
              </button>
            )}
          </div>
        </div>
      )}

      <details>
        <summary className="min-h-6 cursor-pointer text-sm text-ink-muted hover:text-ink">
          Change the key
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <ParamControls specs={cipher.params} values={params} onChange={onParamChange} />
          <div>
            <button
              type="button"
              className="cl-button"
              onClick={() => setParams(textStartParams(cipher))}
            >
              Back to the textbook key
            </button>
          </div>
        </div>
      </details>
    </li>
  );
}

export default function Playground() {
  const inputId = useId();
  const directionName = useId();
  const [input, setInput] = useState('The quick brown fox jumps over the lazy dog');
  const [direction, setDirection] = useState<Direction>('encrypt');

  // A one-way module has no decrypt, so it cannot sit in a table that has a
  // Decrypt switch. None of the course ciphers is one, and this keeps it honest
  // if one is ever shown.
  const reversible = ciphers.filter((cipher) => cipher.oneWay !== true);

  // The classical techniques first, under the lecture's two headings. Then
  // every other group in catalogue order: the pad, stream, block, public key.
  const sections = [
    ...TECHNIQUES.map((technique) => ({
      label: technique.label,
      description: technique.description,
      ciphers: reversible.filter((cipher) => techniqueOf(cipher.slug) === technique.id),
    })),
    ...GROUPS.map((group) => ({
      label: group.label,
      description: group.description,
      ciphers: reversible.filter(
        (cipher) => techniqueOf(cipher.slug) === undefined && groupLabelOf(cipher.slug) === group.label,
      ),
    })),
  ];

  const decryptThis = (ciphertext: string) => {
    setInput(ciphertext);
    setDirection('decrypt');
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          One message, every cipher
        </h1>
        <p className="cl-prose text-ink-muted">
          Type a message once and every cipher in the course runs on it. The substitutions change
          the letters and leave them in place, whereas the transpositions keep the letters and
          move them. From the stream ciphers onwards the output is no longer letters at all: the
          stream and block ciphers give bytes, written in hex, Feistel gives bits, and RSA gives
          one number per character.
        </p>
        <p className="cl-prose text-ink-muted">
          Each row starts on the textbook key, and &ldquo;Change the key&rdquo; opens the controls
          to try another one. &ldquo;Decrypt this&rdquo; puts a row&rsquo;s ciphertext in the box
          and switches every row to decrypt, so you can see that only its own cipher reads it.
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

      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <legend className="cl-label mb-1">Every row</legend>
        {(['encrypt', 'decrypt'] as const).map((value) => (
          <label key={value} className="flex min-h-6 items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name={directionName}
              value={value}
              checked={direction === value}
              onChange={() => setDirection(value)}
              className="h-6 w-6 accent-[var(--color-marker)]"
            />
            {value === 'encrypt' ? 'Encrypts the message' : 'Decrypts the message'}
          </label>
        ))}
      </fieldset>

      {direction === 'decrypt' && (
        <p role="status" className="cl-prose text-sm text-ink-muted">
          Paste a ciphertext above. At most one row can be the right cipher with the right key, so
          every other row is expected to be nonsense or to refuse the input. That is the whole
          point, whereby the row that reads as English reveals which cipher was used.
        </p>
      )}

      {sections
        .filter((section) => section.ciphers.length > 0)
        .map((section, index) => (
          <section
            key={section.label}
            aria-labelledby={`${directionName}-section-${index}`}
            className="flex flex-col gap-3"
          >
            <div>
              <h2 id={`${directionName}-section-${index}`} className="text-lg font-semibold text-ink-strong">
                {section.label}
              </h2>
              {section.description !== '' && (
                <p className="cl-prose mt-1 text-sm text-ink-muted">{section.description}</p>
              )}
            </div>
            <ul className="flex flex-col gap-3">
              {section.ciphers.map((cipher) => (
                <Row
                  key={cipher.slug}
                  cipher={cipher}
                  input={input}
                  direction={direction}
                  onDecrypt={decryptThis}
                />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
