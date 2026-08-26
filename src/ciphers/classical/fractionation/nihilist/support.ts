/**
 * The one thing the visualizer needs that the algorithm does not export.
 *
 * `NihilistSums` has to draw the square, and the square is built from a keyword
 * the visualizer receives as a param rather than through `Step.data`. Re-exporting
 * it through a tiny module keeps `nihilist.ts` free of anything that exists only
 * for the screen.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import { type Square, buildSquare } from '../../../../lib/polybius';

export { SIZE } from './nihilist';

export function buildSquareFor(keyword: string): Square {
  return buildSquare(keyword, 5);
}
