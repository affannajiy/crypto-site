/**
 * The 4x4 state, and the nonce-reuse demonstration.
 *
 * Two panels. The first is the state through the ten double rounds, with the four
 * words the current quarter-round touched marked, and a row of labels along the
 * top saying which words are constants, key, counter and nonce — because the
 * layout is the design.
 *
 * The second is the one that matters. Nonce reuse is the way stream ciphers
 * actually fail, and it is demonstrable rather than describable: encrypt two
 * different messages under the same key and nonce, XOR the ciphertexts, and the
 * keystream cancels out entirely. The panel does that live with the reader's own
 * settings.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';
import { chacha20, readKey, readNonce } from './chacha20';

interface RoundData {
  double: number;
  afterColumns: number[];
  afterDiagonals: number[];
}

interface BlockData {
  block: number;
  counter: number;
  keystream: string;
  initial: number[];
  rounds: RoundData[];
  beforeAdd: number[];
  final: number[];
}

const ROLES = [
  'const', 'const', 'const', 'const',
  'key', 'key', 'key', 'key',
  'key', 'key', 'key', 'key',
  'counter', 'nonce', 'nonce', 'nonce',
];

function readBlocks(steps: Step[]): BlockData[] {
  const out: BlockData[] = [];
  for (const step of steps) {
    const data = step.data;
    if (data === undefined || data['isBlock'] !== true) continue;
    const rounds = data['rounds'];
    const initial = data['initial'];
    if (!Array.isArray(rounds) || !Array.isArray(initial)) continue;
    out.push({
      block: Number(data['block'] ?? 0),
      counter: Number(data['counter'] ?? 0),
      keystream: String(data['keystream'] ?? ''),
      initial: initial.map(Number),
      rounds: rounds as RoundData[],
      beforeAdd: Array.isArray(data['beforeAdd']) ? data['beforeAdd'].map(Number) : [],
      final: Array.isArray(data['final']) ? data['final'].map(Number) : [],
    });
  }
  return out;
}

const hexWord = (n: number) => (n >>> 0).toString(16).padStart(8, '0');

// `previous` takes undefined explicitly rather than being optional: under
// exactOptionalPropertyTypes an optional prop cannot be passed an undefined value,
// and "no previous state to compare against" is a real case here.
function StateGrid({ words, previous }: { words: number[]; previous: number[] | undefined }) {
  return (
    <table className="border-separate border-spacing-0">
      <tbody>
        {[0, 1, 2, 3].map((row) => (
          <tr key={row}>
            {[0, 1, 2, 3].map((col) => {
              const at = row * 4 + col;
              const changed = previous !== undefined && previous[at] !== words[at];
              return (
                <td
                  key={col}
                  className={[
                    'border px-2 py-1 text-center font-mono text-[11px]',
                    changed
                      ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                      : 'border-line text-ink-muted',
                  ].join(' ')}
                >
                  <span className="block">{hexWord(words[at] ?? 0)}</span>
                  <span className="block text-[9px] text-ink-subtle">{ROLES[at]}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ChachaState({ steps, params }: { steps: Step[]; params: Params }) {
  const [blockAt, setBlockAt] = useState(0);
  const [roundAt, setRoundAt] = useState(0);
  const [reuseA, setReuseA] = useState('ATTACK AT DAWN');
  const [reuseB, setReuseB] = useState('RETREAT AT SIX');

  const blocks = readBlocks(steps);
  const current = blocks[Math.min(blockAt, Math.max(0, blocks.length - 1))];

  // Two messages under one nonce, XORed. Computed here rather than described,
  // because "the keystream cancels" is the sort of claim a reader should see.
  let reuse: { xorOfCiphertexts: string; xorOfPlaintexts: string; identical: boolean } | null = null;
  try {
    const options = {
      key: readKey(String(params['key'] ?? '')),
      nonce: readNonce(String(params['nonce'] ?? '')),
      counter: Number(params['counter'] ?? 1),
    };
    const first = new TextEncoder().encode(reuseA);
    const second = new TextEncoder().encode(reuseB);
    const a = chacha20(first, options);
    const b = chacha20(second, options);
    const n = Math.min(a.length, b.length);
    const cipherXor = Array.from({ length: n }, (_, i) => (a[i] ?? 0) ^ (b[i] ?? 0));
    const plainXor = Array.from({ length: n }, (_, i) => (first[i] ?? 0) ^ (second[i] ?? 0));
    reuse = {
      xorOfCiphertexts: cipherXor.map((n_) => n_.toString(16).padStart(2, '0')).join(' '),
      xorOfPlaintexts: plainXor.map((n_) => n_.toString(16).padStart(2, '0')).join(' '),
      identical: cipherXor.every((value, i) => value === plainXor[i]),
    };
  } catch {
    reuse = null;
  }

  return (
    <div className="flex flex-col gap-6">
      {current === undefined ? (
        <p className="cl-prose text-sm text-ink-muted">
          Type a message on the Encrypt tab and the state will be laid out here.
        </p>
      ) : (
        <>
          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">
              Block {current.block + 1} of {blocks.length}, counter {current.counter} &mdash;{' '}
              {roundAt === 0
                ? 'the starting state'
                : `after double round ${roundAt} of 10 (20 rounds)`}
            </p>
            <div className="mt-2 flex w-fit shrink-0 flex-wrap gap-4">
              <div className="shrink-0">
                <p className="cl-label mb-1">After the column rounds</p>
                <StateGrid
                  words={
                    roundAt === 0
                      ? current.initial
                      : (current.rounds[roundAt - 1]?.afterColumns ?? current.initial)
                  }
                  previous={
                    roundAt === 0
                      ? undefined
                      : (current.rounds[roundAt - 2]?.afterDiagonals ?? current.initial)
                  }
                />
              </div>
              <div className="shrink-0">
                <p className="cl-label mb-1">After the diagonal rounds</p>
                <StateGrid
                  words={
                    roundAt === 0
                      ? current.initial
                      : (current.rounds[roundAt - 1]?.afterDiagonals ?? current.initial)
                  }
                  previous={
                    roundAt === 0 ? undefined : current.rounds[roundAt - 1]?.afterColumns
                  }
                />
              </div>
            </div>
            <p className="cl-prose mt-3 text-sm text-ink-muted">
              Four constants spelling <span className="font-mono">expand 32-byte k</span>, eight
              words of key, one counter, three words of nonce. Every round is{' '}
              <strong>add, XOR, rotate</strong> &mdash; no lookup table, no branch that depends on
              the data. That is why ChaCha20 is naturally constant-time on any processor, while a
              table-based AES is not unless the hardware helps, and it is why phones and embedded
              devices prefer it.
            </p>
            <p className="cl-prose mt-2 text-sm text-ink-muted">
              The column rounds mix within columns; the <strong>diagonal</strong> rounds are offset
              so a change carries across to other columns. Alternating the two is what spreads one
              bit through all sixteen words in a few rounds.
            </p>
          </div>

          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">The final addition, and the 64 keystream bytes</p>
            <div className="mt-2 flex w-fit shrink-0 flex-wrap gap-4">
              <div className="shrink-0">
                <p className="cl-label mb-1">After 20 rounds</p>
                <StateGrid words={current.beforeAdd} previous={undefined} />
              </div>
              <div className="shrink-0">
                <p className="cl-label mb-1">Plus the starting state</p>
                <StateGrid words={current.final} previous={current.beforeAdd} />
              </div>
            </div>
            <p className="mt-3 break-all font-mono text-xs text-ink-muted">{current.keystream}</p>
            <p className="cl-prose mt-2 text-sm text-ink-muted">
              That last addition is not decoration. Twenty rounds of add-XOR-rotate are{' '}
              <strong>reversible</strong>: without the addition, anyone could run them backwards
              from the keystream and read the key straight out of the state. Adding the original
              state back in throws that away.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="cl-label">
                {roundAt === 0 ? 'Starting state' : `Double round ${roundAt} of 10`}
              </span>
              <input
                type="range"
                className="h-6 w-full accent-[var(--color-marker)]"
                min={0}
                max={current.rounds.length}
                value={Math.min(roundAt, current.rounds.length)}
                onChange={(e) => setRoundAt(Number(e.target.value))}
              />
            </label>

            {blocks.length > 1 && (
              <label className="block">
                <span className="cl-label">
                  Block {current.block + 1} of {blocks.length}
                </span>
                <input
                  type="range"
                  className="h-6 w-full accent-[var(--color-marker)]"
                  min={0}
                  max={blocks.length - 1}
                  value={Math.min(blockAt, blocks.length - 1)}
                  onChange={(e) => {
                    setBlockAt(Number(e.target.value));
                    setRoundAt(0);
                  }}
                />
              </label>
            )}
          </div>
        </>
      )}

      <section aria-labelledby="chacha-reuse" className="flex flex-col gap-3">
        <h3 id="chacha-reuse" className="text-sm font-semibold text-ink-strong">
          What a repeated nonce costs
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Two different messages, encrypted with the <strong>same key, nonce and counter</strong>.
          XOR the two ciphertexts together and the keystream cancels itself out, because it was
          identical in both. What is left is the XOR of the two plaintexts &mdash; and the key was
          never involved in that at all.
        </p>

        <div className="flex flex-col gap-2">
          <label className="block">
            <span className="cl-label">First message</span>
            <input
              type="text"
              className="cl-field w-full font-mono text-sm"
              value={reuseA}
              onChange={(e) => setReuseA(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="cl-label">Second message</span>
            <input
              type="text"
              className="cl-field w-full font-mono text-sm"
              value={reuseB}
              onChange={(e) => setReuseB(e.target.value)}
            />
          </label>
        </div>

        {reuse !== null && (
          <div className="cl-card overflow-x-auto px-4 py-3">
            <p className="cl-label">Ciphertext one XOR ciphertext two</p>
            <p className="mt-1 break-all font-mono text-xs text-ink">{reuse.xorOfCiphertexts}</p>
            <p className="cl-label mt-3">Plaintext one XOR plaintext two</p>
            <p className="mt-1 break-all font-mono text-xs text-ink">{reuse.xorOfPlaintexts}</p>
            <p className="cl-prose mt-3 text-sm text-ink-muted">
              {reuse.identical ? (
                <>
                  <strong>Identical.</strong> An attacker who never sees the key can compute the top
                  line, and it is the bottom line. With enough messages, or one guessable one, both
                  plaintexts fall out by hand &mdash; this is exactly the attack that read Soviet
                  traffic in the Venona project, and exactly what a repeated AES-GCM nonce does
                  today. A nonce is not a password and does not need to be secret. It needs to be{' '}
                  <strong>used once</strong>, and that is the whole of its job.
                </>
              ) : (
                'The messages are different lengths, so only the overlapping prefix cancels.'
              )}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
