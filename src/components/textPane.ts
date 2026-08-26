/**
 * Shared metrics for the input and output panes.
 *
 * The two panes sit side by side and must be the same size, and the highlighted
 * textarea draws its text twice in two stacked layers that must wrap
 * identically. Both facts come down to the same numbers, so the numbers live
 * here and nothing measures itself.
 */

/** Every metric the two layers of a text pane share. Change here or nowhere. */
export const PANE_LAYER =
  'px-3 py-2 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words';

export const PANE_ROWS = 7;

/**
 * text-sm (0.875rem) at leading-relaxed (1.625) is a 1.422rem line box, plus the
 * 0.5rem of py-2 top and bottom. Fixed rather than auto-growing, so the layers
 * cannot disagree about their height and the panes cannot disagree about theirs.
 */
export function paneHeight(rows: number = PANE_ROWS): string {
  return `${(rows * 1.422 + 1).toFixed(3)}rem`;
}
