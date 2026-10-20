import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GROUPS, TECHNIQUES, ciphers, groupLabelOf, techniqueOf } from '../ciphers/registry';
import { textStartParams } from '../ciphers/params';
import type { CipherModule, ParamSpec, Params } from '../ciphers/types';
import ParamControls from '../components/ParamControls';
import { useCipherRun, type Direction } from '../components/useCipherRun';
import { MODE_OPTIONS, MODE_SUMMARY, readMode, type Mode } from '../lib/modes';

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
 *
 * One mode select drives every block cipher row. A row knows it is a block
 * cipher because one of its selects offers `MODE_OPTIONS`, the list from
 * `lib/modes.ts`, not because of its name. Three ciphers in five modes as
 * separate rows would be fifteen rows; one switch shows the same thing.
 *
 * The hash functions sit in their own section at the end. A hash has no
 * decrypt, so in decrypt mode the section hides and says why, and no row ever
 * runs in a different direction from the rest.
 */

/** The select that picks a block cipher's mode, if this cipher has one. */
function modeSpecOf(cipher: CipherModule): ParamSpec | undefined {
  return cipher.params.find((spec) => spec.kind === 'select' && spec.options === MODE_OPTIONS);
}

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
  mode,
  onDecrypt,
}: {
  cipher: CipherModule;
  input: string;
  direction: Direction;
  /** The page's block cipher mode. Ignored by a row with no mode select. */
  mode: Mode;
  /** Puts this row's ciphertext in the message box and flips every row to decrypt. */
  onDecrypt: (ciphertext: string) => void;
}) {
  const [ownParams, setParams] = useState<Params>(() => textStartParams(cipher));
  const [copied, setCopied] = useState(false);
  const copyButton = useRef<HTMLButtonElement>(null);
  const modeSpec = modeSpecOf(cipher);
  const params = modeSpec === undefined ? ownParams : { ...ownParams, [modeSpec.name]: mode };
  // The mode is set once for the page, so the row's own controls leave it out.
  const rowSpecs = cipher.params.filter((spec) => spec !== modeSpec);
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
            {direction === 'encrypt' && cipher.oneWay !== true && (
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

      {rowSpecs.length > 0 && (
        <details>
          <summary className="min-h-6 cursor-pointer text-sm text-ink-muted hover:text-ink">
            Change the key
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <ParamControls specs={rowSpecs} values={params} onChange={onParamChange} />
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
      )}
    </li>
  );
}

export default function Playground() {
  const inputId = useId();
  const directionName = useId();
  const [input, setInput] = useState('The quick brown fox jumps over the lazy dog');
  const [direction, setDirection] = useState<Direction>('encrypt');
  const [mode, setMode] = useState<Mode>('CBC');
  const modeId = useId();

  // A one-way module has no decrypt. It gets its own section at the end, which
  // hides in decrypt mode, so no row ever runs in the other direction.
  const reversible = ciphers.filter((cipher) => cipher.oneWay !== true);
  const oneWay = ciphers.filter((cipher) => cipher.oneWay === true);
  const hasBlockCiphers = ciphers.some((cipher) => modeSpecOf(cipher) !== undefined);
  const summary = MODE_SUMMARY[mode];

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
    ...(direction === 'encrypt'
      ? [
          {
            label: 'Hash functions (one-way)',
            description:
              'No key and no decrypt. The same message always gives the same digest, of a fixed length however long the message is. Change one letter and about half of the digest changes.',
            ciphers: oneWay,
          },
        ]
      : []),
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
        <p className="text-ink-muted">Type once. Every course cipher runs on it, with the lecture key.</p>
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

      {hasBlockCiphers && (
        <div className="flex flex-col gap-2">
          <label htmlFor={modeId} className="cl-label">
            Block cipher mode (every block cipher row)
          </label>
          <select
            id={modeId}
            value={mode}
            onChange={(event) => setMode(readMode(event.target.value))}
            className="cl-field w-full sm:w-auto"
          >
            {MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="cl-prose text-sm text-ink-muted">
            <strong>{summary.title}.</strong> {summary.strength} {summary.weakness} Used in:{' '}
            {summary.uses} Try ECB on YELLOW SUBMARINE twice.
          </p>
        </div>
      )}

      {direction === 'decrypt' && (
        <p role="status" className="cl-prose text-sm text-ink-muted">
          Paste a ciphertext. The row that reads as English is the cipher used.
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
            </div>
            <ul className="flex flex-col gap-3">
              {section.ciphers.map((cipher) => (
                <Row
                  key={cipher.slug}
                  cipher={cipher}
                  input={input}
                  direction={direction}
                  mode={mode}
                  onDecrypt={decryptThis}
                />
              ))}
            </ul>
          </section>
        ))}

      {direction === 'decrypt' && oneWay.length > 0 && (
        <p className="cl-prose text-sm text-ink-muted">
          Hashes hidden: a hash has no decrypt.
        </p>
      )}
    </div>
  );
}
