/**
 * The Visualize tab for both modes of the pad.
 *
 * Letters mode draws the pad being spent and the reuse break with subtraction.
 * Vernam mode draws the bits being XORed and the same break with XOR. The mode
 * is a param, so the choice is made here, inside the cipher's own folder.
 */
import type { Params, Step } from '../../../types';
import OneTimePadReuse from './OneTimePadReuse';
import VernamTable from './VernamTable';

export default function OneTimePadVisual({ steps, params }: { steps: Step[]; params: Params }) {
  return String(params['mode'] ?? 'letters') === 'vernam' ? (
    <VernamTable steps={steps} params={params} />
  ) : (
    <OneTimePadReuse steps={steps} params={params} />
  );
}
