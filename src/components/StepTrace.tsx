import type { Dispatch, SetStateAction } from 'react';
import type { Step } from '../ciphers/types';
import { formatCount } from '../lib/format';

/**
 * The step trace, as a picker.
 *
 * Was a long scrolling list. A dropdown holds the same trace in one control
 * row, so the two text panes and the working stay on screen together instead of
 * the list pushing them out of view.
 *
 * Only the chosen step is orange, because orange means "look here" and a screen
 * where everything is orange has said nothing.
 */

/**
 * A select with fifty thousand options locks the main thread while the browser
 * builds them, and a 50,000-character input produces exactly that. The trace
 * still holds every step; this bounds what the picker offers.
 */
const MAX_OPTIONS = 2000;

export default function StepTrace({
  steps,
  activeIndex,
  onSelect,
}: {
  steps: Step[];
  activeIndex: number | null;
  // A setter, not a plain callback: Previous and Next step relative to the
  // current value, and reading that from a prop goes stale the moment two
  // clicks land in one tick (hold Enter on the button and they do).
  onSelect: Dispatch<SetStateAction<number | null>>;
}) {
  if (steps.length === 0) {
    return (
      <div className="cl-card px-4 py-6 text-center text-sm text-ink-subtle">
        No steps yet. Type something above and every character will show its working here.
      </div>
    );
  }

  const options = Math.min(steps.length, MAX_OPTIONS);
  const active = activeIndex === null ? undefined : steps[activeIndex];

  const move = (delta: number) => {
    onSelect((previous) => Math.min(options - 1, Math.max(0, (previous ?? -1) + delta)));
  };

  return (
    <section aria-labelledby="trace-heading" className="flex flex-col gap-3">
      <h3 id="trace-heading" className="text-sm font-semibold text-ink-strong">
        Step trace
        <span className="ml-2 font-normal text-ink-subtle">{formatCount(steps.length)} steps</span>
      </h3>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="cl-button"
          onClick={() => move(-1)}
          disabled={activeIndex === 0}
        >
          Previous
        </button>

        <select
          className="cl-field min-w-0 flex-1 font-mono"
          aria-label="Step to show"
          value={activeIndex === null ? '' : String(activeIndex)}
          onChange={(e) => onSelect(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Choose a step…</option>
          {steps.slice(0, options).map((step) => (
            <option key={step.index} value={step.index}>
              {step.index + 1} · {step.title}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="cl-button"
          onClick={() => move(1)}
          disabled={activeIndex !== null && activeIndex >= options - 1}
        >
          Next
        </button>
      </div>

      {options < steps.length && (
        <p className="text-xs text-ink-subtle">
          The picker lists the first {formatCount(options)} of {formatCount(steps.length)} steps.
        </p>
      )}

      {active === undefined ? (
        <p className="cl-card px-4 py-4 text-sm text-ink-subtle">
          Pick a step to see its working, and the character it touched will be marked in both
          panes above.
        </p>
      ) : (
        <div className="cl-card border-l-4 border-l-marker-line bg-marker-wash px-4 py-3">
          <p className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-bold tabular-nums text-marker-ink">
              {active.index + 1}
            </span>
            <span className="text-sm font-semibold text-ink">{active.title}</span>
          </p>
          <p className="cl-prose mt-1 font-mono text-xs text-ink-muted">{active.detail}</p>
        </div>
      )}
    </section>
  );
}
