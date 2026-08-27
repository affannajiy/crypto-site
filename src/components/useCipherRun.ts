import { useEffect, useState } from 'react';
import type { CipherModule, Params, TraceResult } from '../ciphers/types';

export type Direction = 'encrypt' | 'decrypt';

export type RunState =
  | { status: 'running' }
  | { status: 'done'; result: TraceResult }
  | { status: 'error'; message: string };

/** Never show a raw stack to a user. Say what went wrong, in a sentence. */
function messageFor(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message;
  return 'The cipher could not run with these settings.';
}

/**
 * Runs a cipher and holds the result.
 *
 * One code path serves both synchronous ciphers and the WebCrypto-backed ones
 * that return a promise, and only the promise case ever shows a running state —
 * a cipher that finishes in the same tick should not flash a spinner.
 *
 * The `cancelled` flag is the stale-response guard: type quickly into the input
 * and several runs are in flight at once, so only the newest may set state.
 */
export function useCipherRun(
  cipher: CipherModule,
  input: string,
  params: Params,
  direction: Direction,
): RunState {
  const [state, setState] = useState<RunState>({ status: 'running' });

  // Params is a fresh object on every render, so the effect needs a value to
  // compare rather than an identity.
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    let outcome: TraceResult | Promise<TraceResult>;

    try {
      // A one-way module has no `decrypt`, and the workbench gives it no
      // direction control — but the state it owns still has a direction, so this
      // falls back rather than trusting that the UI can never be out of step.
      const run = direction === 'decrypt' ? cipher.decrypt : undefined;
      outcome = run === undefined ? cipher.encrypt(input, params) : run(input, params);
    } catch (error) {
      setState({ status: 'error', message: messageFor(error) });
      return;
    }

    if (outcome instanceof Promise) {
      setState({ status: 'running' });
      outcome.then(
        (result) => {
          if (!cancelled) setState({ status: 'done', result });
        },
        (error: unknown) => {
          if (!cancelled) setState({ status: 'error', message: messageFor(error) });
        },
      );
    } else {
      setState({ status: 'done', result: outcome });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paramsKey stands in for params
  }, [cipher, input, paramsKey, direction]);

  return state;
}
