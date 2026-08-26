import { useId, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Step } from '../../ciphers/types';
import type { Direction, RunState } from '../useCipherRun';
import HighlightedText from '../HighlightedText';
import HighlightedTextarea from '../HighlightedTextarea';
import StepTrace from '../StepTrace';
import { paneHeight } from '../textPane';

/**
 * The main panel: text in, text out, and every step in between.
 *
 * Selecting a step marks the character it touched in both panes. That link is
 * the reason the app exists, so it is the one interaction worth getting right.
 *
 * The two panes are deliberately identical in height and their label rows share
 * a fixed height, so the Copy button cannot push one heading out of line with
 * the other.
 */
const LABEL_ROW = 'flex h-8 items-center justify-between gap-3';

export default function EncryptPanel({
  input,
  onInputChange,
  direction,
  onDirectionChange,
  run,
  activeIndex,
  onActiveIndexChange,
}: {
  input: string;
  onInputChange: (value: string) => void;
  direction: Direction;
  onDirectionChange: (direction: Direction) => void;
  run: RunState;
  activeIndex: number | null;
  onActiveIndexChange: Dispatch<SetStateAction<number | null>>;
}) {
  const inputId = useId();
  const groupName = useId();
  const [copied, setCopied] = useState(false);

  const steps: Step[] = run.status === 'done' ? run.result.steps : [];
  const output = run.status === 'done' ? run.result.output : '';
  const activeStep = activeIndex === null ? undefined : steps[activeIndex];
  const highlight = activeStep?.highlight;
  // A transposition cipher moves a character to a different index, so the output
  // pane needs its own range. Substitution ciphers set only `highlight`, and one
  // range correctly describes both panes for them.
  const outputHighlight = activeStep?.outputHighlight ?? highlight;

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="cl-label">Direction</legend>
        {(['encrypt', 'decrypt'] as const).map((value) => (
          <label
            key={value}
            className={[
              'flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-1.5 text-sm',
              // The radio itself is visually hidden, so the label has to carry
              // the focus ring or a keyboard user loses their position entirely.
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marker-line',
              direction === value
                ? 'border-ink-strong bg-ink-strong font-medium text-ink-inverse'
                : 'border-line-strong bg-surface text-ink hover:bg-sunken',
            ].join(' ')}
          >
            <input
              type="radio"
              name={groupName}
              value={value}
              checked={direction === value}
              onChange={() => onDirectionChange(value)}
              className="sr-only"
            />
            {value === 'encrypt' ? 'Encrypt' : 'Decrypt'}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className={LABEL_ROW}>
            <label htmlFor={inputId} className="cl-label mb-0">
              {direction === 'encrypt' ? 'Message to encrypt' : 'Ciphertext to decrypt'}
            </label>
          </div>
          <HighlightedTextarea
            id={inputId}
            value={input}
            onChange={onInputChange}
            highlight={highlight}
            placeholder={
              direction === 'encrypt'
                ? 'Type the message you want to hide…'
                : 'Paste the ciphertext you want to read…'
            }
          />
        </div>

        <div>
          <div className={LABEL_ROW}>
            <span className="cl-label mb-0">
              {direction === 'encrypt' ? 'Ciphertext' : 'Plaintext'}
            </span>
            <button
              type="button"
              className="cl-button min-h-0 px-2.5 py-1 text-xs"
              onClick={copy}
              disabled={output === ''}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {run.status === 'error' ? (
            <div
              role="status"
              className="cl-card overflow-auto border-marker-mid bg-marker-wash px-3 py-2 text-sm"
              style={{ height: paneHeight() }}
            >
              <p className="font-medium text-ink">This cipher could not run.</p>
              <p className="mt-1 text-ink-muted">{run.message}</p>
            </div>
          ) : run.status === 'running' ? (
            <div
              className="cl-card px-3 py-2 text-sm text-ink-subtle"
              style={{ height: paneHeight() }}
            >
              Working…
            </div>
          ) : (
            <HighlightedText
              text={output}
              highlight={outputHighlight}
              label={direction === 'encrypt' ? 'Ciphertext' : 'Plaintext'}
              emptyMessage="The result will appear here."
            />
          )}
        </div>
      </div>

      {/* The chosen step's working lives inside StepTrace now, next to the
          picker that chose it. Repeating it here said the same thing twice. */}
      <StepTrace steps={steps} activeIndex={activeIndex} onSelect={onActiveIndexChange} />
    </div>
  );
}
