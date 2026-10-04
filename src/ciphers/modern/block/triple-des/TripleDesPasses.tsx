/**
 * Triple DES as three DES ladders in a row.
 *
 * The top table is the pipeline the lab sheet draws: each block through encrypt,
 * decrypt, encrypt, with the value between every pass. Pick a pass and the full
 * sixteen-round DES ladder for it opens underneath, reusing the DES visualizer,
 * because each pass *is* plain DES.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import FeistelRounds from '../des/FeistelRounds';

interface PassData {
  label: string;
  key: string;
  direction: string;
  input: string;
  output: string;
  trace: unknown[];
}

function isPass(value: unknown): value is PassData {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p['label'] === 'string' && typeof p['output'] === 'string' && Array.isArray(p['trace']);
}

function passesOf(step: Step): PassData[] {
  const trace = step.data?.['trace'];
  return Array.isArray(trace) ? trace.filter(isPass) : [];
}

export default function TripleDesPasses({ steps, params }: { steps: Step[]; params: Params }) {
  const [passAt, setPassAt] = useState(0);
  const blocks = steps.filter((s) => s.data?.['isBlock'] === true);
  const first = blocks[0] === undefined ? [] : passesOf(blocks[0]);

  if (first.length !== 3) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and each block&rsquo;s three DES passes appear here.
      </p>
    );
  }

  const keying = String(blocks[0]?.data?.['keying'] ?? params['keying'] ?? '3-key');

  // The DES ladder reads `data.trace` as sixteen rounds. Hand it the chosen pass.
  const passSteps: Step[] = blocks.map((step) => {
    const pass = passesOf(step)[passAt];
    return { ...step, data: { ...step.data, trace: pass?.trace ?? [] } };
  });

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="tdes-pipeline" className="flex flex-col gap-3">
        <h3 id="tdes-pipeline" className="text-sm font-semibold text-ink-strong">
          Three passes per block{keying === '1-key' ? ' (one key: the first two cancel)' : ''}
        </h3>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="text-ink-subtle">
                <th scope="col" className="py-1 pr-3 font-medium">Block</th>
                <th scope="col" className="py-1 pr-3 font-medium">Into pass 1</th>
                {first.map((p, i) => (
                  <th key={i} scope="col" className="py-1 pr-3 font-medium">
                    After {p.label.charAt(0).toLowerCase() + p.label.slice(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocks.map((step, b) => {
                const passes = passesOf(step);
                return (
                  <tr key={b} className="border-t border-line">
                    <td className="py-1 pr-3 text-ink-subtle">{b + 1}</td>
                    <td className="py-1 pr-3 font-mono text-ink">{passes[0]?.input}</td>
                    {passes.map((p, i) => (
                      <td
                        key={i}
                        className={[
                          'py-1 pr-3 font-mono',
                          i === passAt ? 'bg-marker-wash text-ink-strong' : 'text-ink',
                        ].join(' ')}
                      >
                        {p.output}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <fieldset className="flex flex-wrap gap-2">
          <legend className="cl-label mb-1">Open the DES ladder for</legend>
          {first.map((p, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={i === passAt}
              onClick={() => setPassAt(i)}
              className={[
                'min-h-6 rounded border px-3 py-1 text-sm',
                i === passAt ? 'border-ink-strong bg-ink-strong text-ink-inverse' : 'border-line-strong bg-surface text-ink',
              ].join(' ')}
            >
              Pass {i + 1}: {p.label} <span className="font-mono">({p.key})</span>
            </button>
          ))}
        </fieldset>
        <p className="cl-prose text-sm text-ink-muted">
          The middle pass runs DES <strong>backwards</strong> with K2. With K1 = K2 it undoes the first
          pass exactly, which is how one 3DES box could still talk to an old single-DES box. Try the
          one-key option and watch the value after pass 2 equal the input.
        </p>
      </section>

      <FeistelRounds steps={passSteps} params={params} cipherName="3DES" />
    </div>
  );
}
