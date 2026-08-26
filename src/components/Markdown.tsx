/**
 * A very small markdown renderer for cipher explainers.
 *
 * It covers exactly what the explainers use: `##` headings, paragraphs, `-`
 * lists, **bold**, *italic*, `inline code`, and four-space-indented code blocks.
 * Nothing else. When an explainer needs more, add it here rather than reaching for
 * a dependency.
 *
 * Italics and indented blocks were added late, and both were fixing a silent
 * defect rather than adding a feature: the explainers had been using `*italic*`
 * and indented diagrams since Hill landed, and the renderer was printing the
 * asterisks literally and folding the diagrams into one long paragraph. Alignment
 * is the whole point of a diagram, so that was worse than it looked.
 *
 * It builds React elements. It never touches dangerouslySetInnerHTML, so no
 * explainer can inject markup into the page.
 */
import type { ReactNode } from 'react';

/** A code block is a run of lines indented by four spaces. */
const INDENT = / {4}/;

/** Splits a line into text, **bold**, *italic* and `code` runs. */
function renderInline(line: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Bold is tried before italic, so `**x**` is never read as an empty italic.
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
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
        <em key={`${keyPrefix}-i${n}`} className="italic">
          {match[2]}
        </em>,
      );
    } else if (match[3] !== undefined) {
      parts.push(
        <code key={`${keyPrefix}-c${n}`} className="rounded bg-sunken px-1 py-0.5 font-mono text-[0.9em]">
          {match[3]}
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

        // A diagram, a worked example, a key schedule. Rendered verbatim: these
        // are aligned by hand, so `renderInline` must not run over them and the
        // line breaks must survive. Fixed width, so the block scrolls rather
        // than shrinking — the house rule that keeps the page itself from
        // scrolling sideways at 320px.
        const indented = lines.filter((line) => INDENT.test(line.slice(0, 4)));
        if (indented.length > 0 && lines.every((line) => line.trim() === '' || line.startsWith('    '))) {
          return (
            <pre
              key={i}
              className="w-full overflow-x-auto rounded border border-line bg-sunken px-3 py-2 font-mono text-xs leading-5 text-ink"
            >
              {lines.map((line) => line.replace(/^ {4}/, '')).join('\n')}
            </pre>
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
