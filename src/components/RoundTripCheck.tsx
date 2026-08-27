import { useCallback, useEffect, useState } from 'react';
import { lettersOnly } from '../lib/letters';
import type { CipherModule, Params } from '../ciphers/types';
import type { Direction } from './useCipherRun';

/**
 * Encrypt, then decrypt, then check what came back.
 *
 * This is the cheapest honest test of an implementation, and it also teaches
 * something the Encrypt tab hides: most classical ciphers do not round-trip
 * exactly. They drop punctuation and fold case on the way in, so what returns is
 * the message stripped rather than the message. Reporting that as a failure
 * would be wrong, and reporting it as a clean success would be a lie — so there
 * are three outcomes, not two.
 *
 * It is a button rather than something that runs on every keystroke because it
 * runs the cipher twice, and one of those ciphers is AES.
 */
type Verdict =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'exact'; recovered: string }
  | { kind: 'lossy'; recovered: string }
  | { kind: 'mismatch'; recovered: string }
  | { kind: 'error'; message: string };

/** Same letters in the same order, ignoring case, spacing and punctuation. */
function sameLetters(a: string, b: string): boolean {
  return lettersOnly(a.toUpperCase()) === lettersOnly(b.toUpperCase());
}

export default function RoundTripCheck({
  cipher,
  input,
  params,
  direction,
}: {
  cipher: CipherModule;
  input: string;
  params: Params;
  /** The direction the user is working in. The check runs it, then its inverse. */
  direction: Direction;
}) {
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'idle' });

  // A verdict is about one message under one key. Change either and the old
  // answer is no longer evidence of anything, so it goes rather than sitting
  // under a message it was never run against.
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    setVerdict({ kind: 'idle' });
  }, [cipher, input, paramsKey, direction]);

  const check = useCallback(async () => {
    setVerdict({ kind: 'running' });
    const reverse = cipher.decrypt;
    if (reverse === undefined) return;
    const forward = direction === 'encrypt' ? cipher.encrypt : reverse;
    const back = direction === 'encrypt' ? reverse : cipher.encrypt;
    try {
      const middle = (await forward.call(cipher, input, params)).output;
      const recovered = (await back.call(cipher, middle, params)).output;
      if (recovered === input) {
        setVerdict({ kind: 'exact', recovered });
      } else if (sameLetters(recovered, input)) {
        setVerdict({ kind: 'lossy', recovered });
      } else {
        setVerdict({ kind: 'mismatch', recovered });
      }
    } catch (error) {
      setVerdict({
        kind: 'error',
        message:
          error instanceof Error && error.message !== ''
            ? error.message
            : 'The cipher could not run with these settings.',
      });
    }
  }, [cipher, input, params, direction]);

  // Nothing to check on a one-way function: there is no second direction to
  // come back through, which is the entire distinction the tab is teaching.
  if (cipher.decrypt === undefined) return null;

  const other = direction === 'encrypt' ? 'decrypt' : 'encrypt';

  return (
    <section className="cl-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-strong">Round trip</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {direction === 'encrypt' ? 'Encrypt' : 'Decrypt'} this, then {other} the result, and
            compare it with what you typed.
          </p>
        </div>
        <button
          type="button"
          className="cl-button"
          onClick={() => void check()}
          disabled={input === '' || verdict.kind === 'running'}
        >
          {verdict.kind === 'running' ? 'Checking…' : 'Run round trip'}
        </button>
      </div>

      {verdict.kind !== 'idle' && verdict.kind !== 'running' && (
        // Announced, and worded so the outcome never depends on a colour or a
        // glyph alone.
        <div role="status" className="mt-3 border-t border-line pt-3 text-sm">
          {verdict.kind === 'exact' && (
            <p className="text-ink">
              <span className="font-semibold text-ink-strong">Exact.</span> Every character came
              back, including spacing and punctuation.
            </p>
          )}
          {verdict.kind === 'lossy' && (
            <>
              <p className="text-ink">
                <span className="font-semibold text-ink-strong">Recovered, but not identical.</span>{' '}
                The letters are all there in order. Spacing, case or punctuation did not survive,
                because this cipher normalises its input before it starts — which is also why real
                intercepts of these ciphers arrive as unbroken blocks of capitals.
              </p>
              <p className="mt-2 break-words font-mono text-xs text-ink-muted">
                {verdict.recovered}
              </p>
            </>
          )}
          {verdict.kind === 'mismatch' && (
            <>
              <p className="text-ink">
                <span className="font-semibold text-ink-strong">Did not come back.</span> With these
                settings the message cannot be recovered. That is usually a key that is wrong for
                the direction, not a broken cipher.
              </p>
              <p className="mt-2 break-words font-mono text-xs text-ink-muted">
                {verdict.recovered}
              </p>
            </>
          )}
          {verdict.kind === 'error' && (
            <p className="text-ink">
              <span className="font-semibold text-ink-strong">Could not run.</span>{' '}
              {verdict.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
