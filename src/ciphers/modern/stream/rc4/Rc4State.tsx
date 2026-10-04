/**
 * RC4's whole state, as a 16 × 16 grid of the 256 bytes of S.
 *
 * Step through the keystream and watch i walk along, j jump about, two cells
 * swap, and a third cell give up the keystream byte. Underneath is the bias
 * experiment: run thousands of random keys and count how often the second
 * output byte is 0. That count is the break.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { secondByteZeroRate } from './rc4';

interface Snapshot {
  label: string;
  state: number[];
  i: number | null;
  j: number | null;
  t: number | null;
  k: number | null;
  plain: number | null;
  result: number | null;
}

function readSnapshots(steps: Step[]): Snapshot[] {
  const out: Snapshot[] = [];
  for (const step of steps) {
    const d = step.data;
    if (d === undefined) continue;
    const state = d['state'];
    if (!Array.isArray(state) || state.length !== 256) continue;
    const num = (key: string) => (typeof d[key] === 'number' ? (d[key] as number) : null);
    out.push({
      label: d['isKsa'] === true ? 'After the key schedule' : `Keystream byte ${(num('n') ?? 0) + 1}`,
      state: state.map((v) => Number(v)),
      i: num('i'),
      j: num('j'),
      t: num('t'),
      k: num('k'),
      plain: num('plain'),
      result: num('result'),
    });
  }
  return out;
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

function randomKey(): Uint8Array {
  const key = new Uint8Array(16);
  crypto.getRandomValues(key);
  return key;
}

export default function Rc4State({ steps }: { steps: Step[]; params: Params }) {
  const snapshots = readSnapshots(steps);
  const [at, setAt] = useState(1);
  const [bias, setBias] = useState<{ trials: number; rate: number } | null>(null);

  const snap = snapshots[Math.min(at, Math.max(0, snapshots.length - 1))];

  if (snap === undefined) {
    return <p className="cl-prose text-sm text-ink-muted">Type a key and a message on the Encrypt tab to see S.</p>;
  }

  const runBias = () => {
    const trials = 40000;
    setBias({ trials, rate: secondByteZeroRate(trials, randomKey) });
  };

  const role = (index: number): string | null => {
    if (index === snap.i && index === snap.j) return 'i=j';
    if (index === snap.i) return 'i';
    if (index === snap.j) return 'j';
    if (index === snap.t) return 't';
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="rc4-state" className="flex flex-col gap-3">
        <h3 id="rc4-state" className="text-sm font-semibold text-ink-strong">
          The state S: {snap.label}
        </h3>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <table className="border-separate border-spacing-0 font-mono text-[11px]">
            <thead>
              <tr>
                <th scope="col" className="sr-only">Row</th>
                {Array.from({ length: 16 }, (_, c) => (
                  <th key={c} scope="col" className="px-1 pb-1 font-normal text-ink-subtle">
                    _{c.toString(16)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 16 }, (_, r) => (
                <tr key={r}>
                  <th scope="row" className="pr-1 text-right font-normal text-ink-subtle">
                    {r.toString(16)}_
                  </th>
                  {Array.from({ length: 16 }, (_, c) => {
                    const index = r * 16 + c;
                    const mark = role(index);
                    return (
                      <td
                        key={c}
                        title={`S[${index}] = ${snap.state[index] ?? 0}`}
                        className={[
                          'relative h-7 w-7 border text-center align-middle',
                          mark === null
                            ? 'border-line text-ink-muted'
                            : mark === 't'
                              ? 'border-ink-strong font-bold text-ink-strong'
                              : 'border-marker-line bg-marker-wash font-bold text-ink-strong',
                        ].join(' ')}
                      >
                        {hex2(snap.state[index] ?? 0)}
                        {mark !== null && (
                          <span className="absolute -top-1 right-0 text-[9px] leading-none text-marker-ink">{mark}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {snap.k !== null ? (
          <p className="font-mono text-sm text-ink">
            i = {snap.i}, j = {snap.j}, swap, then K = S[S[i] + S[j]] = S[{snap.t}] = {snap.k} (0x{hex2(snap.k)}).{' '}
            {snap.plain !== null && snap.result !== null && (
              <>
                {snap.plain} XOR {snap.k} = {snap.result}.
              </>
            )}
          </p>
        ) : (
          <p className="cl-prose text-sm text-ink-muted">
            The key has shuffled 0…255 into this order. Every byte value is in the grid exactly once.
          </p>
        )}

        <label className="block">
          <span className="cl-label">
            {at === 0 ? 'Key schedule' : `Keystream byte ${at} of ${snapshots.length - 1}`}
            {snapshots.length - 1 < steps.length - 1 ? ' (the first 64 are drawn)' : ''}
          </span>
          <input
            type="range"
            className="h-6 w-full accent-[var(--color-marker)]"
            min={0}
            max={Math.max(0, snapshots.length - 1)}
            value={Math.min(at, snapshots.length - 1)}
            onChange={(e) => setAt(Number(e.target.value))}
          />
        </label>
        <p className="cl-prose text-sm text-ink-muted">
          Orange cells are S[i] and S[j], the two that just swapped. The dark outline is S[t], which became
          the keystream byte. The row is the high hex digit of the index and the column the low one.
        </p>
      </section>

      <section aria-labelledby="rc4-bias" className="flex flex-col gap-3">
        <h3 id="rc4-bias" className="text-sm font-semibold text-ink-strong">
          The bias that broke it
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          A perfect keystream byte is 0 with probability 1/256, about 0.39%. In 2001 Mantin and Shamir
          showed that RC4&rsquo;s <strong>second</strong> output byte is 0 about twice as often, for any key.
          Run the experiment on random 128-bit keys:
        </p>
        <div>
          <button type="button" className="cl-button cl-button-primary" onClick={runBias}>
            Try 40,000 random keys
          </button>
        </div>
        {bias !== null && (
          <p role="status" className="font-mono text-sm text-ink-strong">
            Second byte was 0 in {(bias.rate * 100).toFixed(2)}% of {bias.trials.toLocaleString('en-GB')} keys.
            Expected for a fair byte: 0.39%. Ratio: {(bias.rate * 256).toFixed(2)}×.
          </p>
        )}
        <p className="cl-prose text-sm text-ink-muted">
          If the same plaintext is sent under many keys, as a cookie is in every HTTPS request, then the
          second ciphertext byte is the plaintext byte XOR 0 more often than anything else. Count, and the
          commonest value is the plaintext. That is a ciphertext-only attack, and it needs millions of
          ciphertexts, not one. So it lives here rather than on an Attack tab.
        </p>
      </section>
    </div>
  );
}
