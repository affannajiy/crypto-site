import type { CipherModule, Params } from '../../ciphers/types';
import type { RunState } from '../useCipherRun';
import LectureQuizzes from '../LectureQuizzes';

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

  // The quizzes do not depend on this run, so they stay on screen while the
  // picture is waiting or has nothing to draw.
  let picture;
  if (run.status === 'running') {
    picture = <p className="text-sm text-ink-subtle">Working…</p>;
  } else if (run.status === 'error') {
    picture = (
      <div role="status" className="cl-card border-marker-mid bg-marker-wash px-4 py-3 text-sm">
        <p className="font-medium text-ink">There is nothing to draw yet.</p>
        <p className="mt-1 text-ink-muted">{run.message}</p>
      </div>
    );
  } else {
    picture = (
      <>
        {cipher.visualizeNote !== undefined && (
          <p className="cl-prose text-sm text-ink-muted">{cipher.visualizeNote}</p>
        )}
        <Visualizer steps={run.result.steps} params={params} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {picture}
      <LectureQuizzes cipher={cipher} />
    </div>
  );
}
