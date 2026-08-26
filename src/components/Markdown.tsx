/**
 * A very small markdown renderer for cipher explainers.
 *
 * It covers exactly what the explainers use: `##` headings, paragraphs, `-`
 * lists, **bold**, and `inline code`. Nothing else. When an explainer needs more,
 * add it here rather than reaching for a dependency — and if that happens three
 * times, that is the moment to reconsider.
 *
 * It builds React elements. It never touches dangerouslySetInnerHTML, so no
 * explainer can inject markup into the page.
 */
import type { ReactNode } from 'react';

/** Splits a line into text, **bold** runs, and `code` runs. */
function renderInline(line: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|`(.+?)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));

    if (match[1] !== undefined) {
      parts.push(
        <strong key={`${keyPrefix}-b${n}`} className="font-semibold text-ink-strong">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined) {
      parts.push(
        <code key={`${keyPrefix}-c${n}`} className="rounded bg-sunken px-1 py-0.5 font-mono text-[0.9em]">
          {match[2]}
        </code>,
      );
    }

    lastIndex = pattern.lastIndex;
    n += 1;
  }

  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return parts;
}

export default function Markdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);

  return (
    <div className="flex w-full flex-col gap-4">
      {blocks.map((block, i) => {
        const lines = block.split('\n');

        if (block.startsWith('## ')) {
          return (
            <h3 key={i} className="mt-3 text-lg font-semibold text-ink-strong">
              {renderInline(block.slice(3), `h${i}`)}
            </h3>
          );
        }

        if (lines.every((line) => line.startsWith('- '))) {
          return (
            // Padding, not margin: `.cl-prose` sets width to 100%, and a left
            // margin lands outside that width, so `ml-5` pushed the list 20px
            // past the column and gave the page a horizontal scrollbar at 320px.
            <ul key={i} className="cl-prose flex list-disc flex-col gap-2 pl-5 text-ink-muted">
              {lines.map((line, j) => (
                <li key={j}>{renderInline(line.slice(2), `l${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="cl-prose text-ink-muted">
            {renderInline(lines.join(' '), `p${i}`)}
          </p>
        );
      })}
    </div>
  );
}
