import type { Step } from '../ciphers/types';
import { PANE_LAYER, paneHeight } from './textPane';

/**
 * A read-only pane of monospace text with one range picked out.
 *
 * The highlight is a `<mark>` — the native element for "this is the relevant
 * part right now" — carrying both the wash and an underline, so it is still
 * visible to a reader who cannot see the colour (WCAG 1.4.1).
 *
 * It takes its metrics from the same constants as the editable pane beside it,
 * so the two are always the same size.
 */
export default function HighlightedText({
  text,
  highlight,
  emptyMessage,
  label,
  rows,
}: {
  text: string;
  highlight: Step['highlight'] | undefined;
  emptyMessage: string;
  label: string;
  rows?: number;
}) {
  const start = highlight === undefined ? -1 : Math.max(0, Math.min(highlight.start, text.length));
  const end = highlight === undefined ? -1 : Math.max(start, Math.min(highlight.end, text.length));
  const marked = start >= 0 && end > start;

  return (
    <div
      className={`cl-card overflow-auto ${PANE_LAYER}`}
      style={{ height: paneHeight(rows) }}
      aria-label={label}
    >
      {text === '' ? (
        <span className="font-sans text-ink-subtle">{emptyMessage}</span>
      ) : marked ? (
        <>
          {text.slice(0, start)}
          <mark className="rounded-sm bg-marker-wash px-px text-ink underline decoration-marker-line decoration-2 underline-offset-4">
            {text.slice(start, end)}
          </mark>
          {text.slice(end)}
        </>
      ) : (
        text
      )}
    </div>
  );
}
