import { useRef } from 'react';
import type { Step } from '../ciphers/types';
import { PANE_LAYER, PANE_ROWS, paneHeight } from './textPane';

/**
 * An editable textarea that can still show a highlight.
 *
 * A textarea cannot contain markup, so the text is drawn twice: once in a
 * backdrop that carries the `<mark>`, and once in a real textarea sitting on top
 * of it with transparent glyphs and a visible caret. The user types into a plain
 * native textarea — label, keyboard, undo, all of it native — and the highlight
 * is painted behind.
 *
 * The two layers must wrap identically or the highlight lands on the wrong
 * character, so both take every metric from PANE_LAYER in `textPane.ts`.
 * **Never style one layer alone.**
 */
const LAYER = `absolute inset-0 overflow-auto ${PANE_LAYER}`;

export default function HighlightedTextarea({
  id,
  value,
  onChange,
  highlight,
  placeholder,
  rows = PANE_ROWS,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  highlight: Step['highlight'] | undefined;
  placeholder: string;
  rows?: number;
}) {
  const backdrop = useRef<HTMLDivElement>(null);

  const start = highlight === undefined ? -1 : Math.max(0, Math.min(highlight.start, value.length));
  const end = highlight === undefined ? -1 : Math.max(start, Math.min(highlight.end, value.length));
  const marked = start >= 0 && end > start;

  return (
    <div className="cl-card relative overflow-hidden" style={{ height: paneHeight(rows) }}>
      <div ref={backdrop} className={`${LAYER} pointer-events-none text-ink`} aria-hidden="true">
        {marked ? (
          <>
            {value.slice(0, start)}
            <mark className="rounded-sm bg-marker-wash px-px text-ink underline decoration-marker-line decoration-2 underline-offset-4">
              {value.slice(start, end)}
            </mark>
            {value.slice(end)}
          </>
        ) : (
          value
        )}
        {/* A trailing newline collapses with nothing after it, which would put the
            backdrop one line out of step with the textarea. A zero-width space,
            written as an entity so it is visible to whoever reads this next. */}
        &#8203;
      </div>

      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        className={`${LAYER} resize-none border-0 bg-transparent text-transparent caret-marker-line outline-offset-[-2px] placeholder:font-sans placeholder:text-ink-subtle`}
        onScroll={(e) => {
          const el = backdrop.current;
          if (el === null) return;
          el.scrollTop = e.currentTarget.scrollTop;
          el.scrollLeft = e.currentTarget.scrollLeft;
        }}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
