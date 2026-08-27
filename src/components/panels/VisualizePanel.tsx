import type { CipherModule, Params } from '../../ciphers/types';
import type { RunState } from '../useCipherRun';

/**
 * Hosts whatever picture a cipher draws of itself.
 *
 * The panel supplies the trace and the current parameters and then gets out of
 * the way. It knows nothing about rings, grids, rotors, or S-boxes — only that
 * the cipher declared a `visualize` component and the registry checked it exists.
 */
export default function VisualizePanel({
  cipher,
  params,
  run,
}: {
  cipher: CipherModule;
  params: Params;
  run: RunState;
}) {
  const Visualizer = cipher.visualize;
  if (Visualizer === undefined) return null;

  if (run.status === 'running') {
    return <p className="text-sm text-ink-subtle">Working…</p>;
  }

  if (run.status === 'error') {
    return (
      <div role="status" className="cl-card border-marker-mid bg-marker-wash px-4 py-3 text-sm">
        <p className="font-medium text-ink">There is nothing to draw yet.</p>
        <p className="mt-1 text-ink-muted">{run.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="cl-prose text-sm text-ink-muted">
        {cipher.visualizeNote ??
          'This is the same run as the Encrypt tab, drawn rather than listed. Change the message or the key there and the picture follows.'}
      </p>
      <Visualizer steps={run.result.steps} params={params} />
    </div>
  );
}
