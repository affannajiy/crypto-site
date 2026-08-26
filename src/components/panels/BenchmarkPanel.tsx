import { useId, useState } from 'react';
import type { CipherModule, Params } from '../../ciphers/types';
import { formatCount, formatThroughput } from '../../lib/format';

/**
 * How fast is it?
 *
 * Read the honesty note below the button before drawing conclusions from these
 * numbers. Every cipher here emits a full step trace, so this measures the
 * teaching implementation and its allocations, not an optimised one. It is a
 * fair comparison between ciphers in this app and nothing more.
 */
const SAMPLE =
  'The quick brown fox jumps over the lazy dog, and it does so with a certain weary ' +
  'regularity that the fox has long since stopped questioning. ';

const SIZES = [1_000, 10_000, 50_000] as const;
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

interface Measurement {
  sizeChars: number;
  medianMs: number;
  charsPerSecond: number;
  stepCount: number;
}

function buildInput(sizeChars: number): string {
  let text = '';
  while (text.length < sizeChars) text += SAMPLE;
  return text.slice(0, sizeChars);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Hands the main thread back so the browser can paint between runs. */
const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

export default function BenchmarkPanel({
  cipher,
  params,
}: {
  cipher: CipherModule;
  params: Params;
}) {
  const selectId = useId();
  const [sizeChars, setSizeChars] = useState<number>(10_000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Measurement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    const text = buildInput(sizeChars);

    try {
      // A first pass lets the engine settle before anything is recorded.
      for (let i = 0; i < WARMUP_RUNS; i += 1) {
        await cipher.encrypt(text, params);
      }

      const timings: number[] = [];
      let stepCount = 0;
      for (let i = 0; i < MEASURED_RUNS; i += 1) {
        await yieldToBrowser();
        const started = performance.now();
        const traced = await cipher.encrypt(text, params);
        timings.push(performance.now() - started);
        stepCount = traced.steps.length;
      }

      const medianMs = median(timings);
      setResult({
        sizeChars,
        medianMs,
        charsPerSecond: medianMs > 0 ? (sizeChars / medianMs) * 1000 : Infinity,
        stepCount,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The benchmark could not run.');
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={selectId} className="cl-label">
            Input size
          </label>
          <select
            id={selectId}
            className="cl-field w-auto"
            value={sizeChars}
            onChange={(e) => setSizeChars(Number(e.target.value))}
          >
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {formatCount(size)} characters
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="cl-button cl-button-primary" onClick={run} disabled={running}>
          {running ? 'Measuring…' : 'Run benchmark'}
        </button>
      </div>

      {error !== null && (
        <div role="status" className="cl-card border-marker-mid bg-marker-wash px-4 py-3 text-sm">
          <p className="font-medium text-ink">The benchmark could not run.</p>
          <p className="cl-prose mt-1 text-ink-muted">{error}</p>
        </div>
      )}

      {result === null && error === null && (
        <p className="cl-card px-4 py-6 text-center text-sm text-ink-subtle">
          No measurement yet. Pick a size and run it — the numbers become useful once there is
          a second cipher to compare against.
        </p>
      )}

      {result !== null && (
        <dl className="grid gap-3 sm:grid-cols-3" aria-live="polite">
          <div className="cl-card px-4 py-3">
            <dt className="text-xs font-medium text-ink-subtle">Throughput</dt>
            <dd className="mt-1 font-mono text-lg font-bold text-ink">
              {formatThroughput(result.charsPerSecond)}
            </dd>
          </div>
          <div className="cl-card px-4 py-3">
            <dt className="text-xs font-medium text-ink-subtle">
              Median of {MEASURED_RUNS} runs
            </dt>
            <dd className="mt-1 font-mono text-lg font-bold text-ink">
              {result.medianMs.toFixed(2)} ms
            </dd>
          </div>
          <div className="cl-card px-4 py-3">
            <dt className="text-xs font-medium text-ink-subtle">Steps traced</dt>
            <dd className="mt-1 font-mono text-lg font-bold text-ink">
              {formatCount(result.stepCount)}
            </dd>
          </div>
        </dl>
      )}

      <div className="w-full text-sm text-ink-muted">
        <p className="cl-prose">
          <strong className="font-semibold text-ink-strong">What this number is not.</strong> Every
          cipher in this app builds a full step trace as it works — one object per character,
          with a sentence of English inside it. That allocation dominates the measurement, so
          this is the speed of the teaching implementation, not of the algorithm.
        </p>
        <p className="cl-prose mt-3">
          It is still a fair comparison <em>between</em> ciphers here, because they all pay the
          same cost. It is not comparable to a published figure for the same algorithm, and it
          says nothing at all about whether a cipher is secure. Fast and broken is the normal
          state of a classical cipher.
        </p>
      </div>
    </div>
  );
}
