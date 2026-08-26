/**
 * The state matrix, round by round.
 *
 * This is the panel the hand-written implementation exists for. `crypto.subtle`
 * would give a ciphertext and nothing else; what a reader needs is the 4x4 grid of
 * bytes after SubBytes, after ShiftRows, after MixColumns, after AddRoundKey — and
 * the ability to step through ten of those.
 *
 * The grid is drawn **column-major**, because that is how AES fills it, and a
 * diagram that quietly fills it row-major makes ShiftRows and MixColumns look like
 * they do each other's job.
 *
 * Bytes that changed since the previous stage are marked. Watching the marks
 * spread from one byte to four to sixteen over two rounds *is* the avalanche, and
 * it is more convincing than the sentence saying so.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';

interface RoundData {
  round: number;
  kind: string;
  before: string;
  afterSub: string | null;
  afterShift: string | null;
  afterMix: string | null;
  roundKey: string;
  after: string;
}

interface BlockData {
  block: number;
  mode: string;
  bits: number;
  rounds: number;
  input: string;
  chained?: string;
  cipher: string;
  trace: RoundData[];
}

function readBlocks(steps: Step[]): BlockData[] {
  const out: BlockData[] = [];
  for (const step of steps) {
    const data = step.data;
    if (data === undefined || data['isBlock'] !== true) continue;
    const trace = data['trace'];
    if (!Array.isArray(trace)) continue;
    out.push({
      block: Number(data['block'] ?? 0),
      mode: String(data['mode'] ?? 'CBC'),
      bits: Number(data['bits'] ?? 128),
      rounds: Number(data['rounds'] ?? 10),
      input: String(data['input'] ?? ''),
      ...(typeof data['chained'] === 'string' ? { chained: data['chained'] } : {}),
      cipher: String(data['cipher'] ?? ''),
      trace: trace as RoundData[],
    });
  }
  return out;
}

/** 32 hex digits as 16 byte strings. */
function bytesOf(hex: string): string[] {
  return (hex.match(/.{2}/g) ?? []).slice(0, 16);
}

function StateGrid({
  hex,
  previous,
  label,
}: {
  hex: string;
  previous?: string;
  label: string;
}) {
  const bytes = bytesOf(hex);
  const before = previous === undefined ? null : bytesOf(previous);

  return (
    <div className="shrink-0">
      <p className="cl-label mb-1">{label}</p>
      <table className="border-separate border-spacing-0">
        <tbody>
          {[0, 1, 2, 3].map((row) => (
            <tr key={row}>
              {[0, 1, 2, 3].map((col) => {
                // Column-major: index = row + 4 * column. This is how AES fills it.
                const at = row + 4 * col;
                const changed = before !== null && before[at] !== bytes[at];
                return (
                  <td
                    key={col}
                    className={[
                      'border px-1.5 py-1 text-center font-mono text-xs',
                      changed
                        ? 'border-marker-line bg-marker-wash font-bold text-ink-strong'
                        : 'border-line text-ink-muted',
                    ].join(' ')}
                  >
                    {bytes[at] ?? '··'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AesRounds({ steps, params }: { steps: Step[]; params: Params }) {
  const [blockAt, setBlockAt] = useState(0);
  const [roundAt, setRoundAt] = useState(0);

  const blocks = readBlocks(steps);
  const block = blocks[Math.min(blockAt, Math.max(0, blocks.length - 1))];
  const trace = block?.trace ?? [];
  const round = trace[Math.min(roundAt, Math.max(0, trace.length - 1))];

  if (block === undefined || round === undefined) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and every round of every block will be laid out here.
      </p>
    );
  }

  const mode = String(params['mode'] ?? block.mode);
  const stages: { label: string; hex: string | null; previous?: string }[] = [
    { label: 'Start of round', hex: round.before },
    { label: 'After SubBytes', hex: round.afterSub, previous: round.before },
    { label: 'After ShiftRows', hex: round.afterShift, previous: round.afterSub ?? round.before },
    {
      label: 'After MixColumns',
      hex: round.afterMix,
      previous: round.afterShift ?? round.before,
    },
    {
      label: 'After AddRoundKey',
      hex: round.after,
      previous: round.afterMix ?? round.afterShift ?? round.before,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card px-4 py-3">
        <p className="cl-prose text-sm text-ink-muted">
          <strong>
            {block.bits}-bit key, {block.rounds} rounds, block {block.block + 1} of {blocks.length}.
          </strong>{' '}
          The state is sixteen bytes arranged in a 4&times;4 grid, filled{' '}
          <strong>down the columns</strong> &mdash; which is why ShiftRows (moving along rows) and
          MixColumns (working down columns) do genuinely different jobs.
        </p>
      </div>

      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          Round {round.round} of {block.rounds}
          {round.kind === 'initial'
            ? ' — the initial AddRoundKey, before any round proper'
            : round.kind === 'final'
              ? ' — the final round, which has no MixColumns'
              : ''}
        </p>
        <div className="mt-2 flex w-fit shrink-0 flex-wrap gap-4">
          {stages.map((stage) =>
            stage.hex === null ? (
              <div key={stage.label} className="shrink-0">
                <p className="cl-label mb-1">{stage.label}</p>
                <p className="rounded border border-dashed border-line px-3 py-6 text-xs text-ink-subtle">
                  skipped
                </p>
              </div>
            ) : (
              <StateGrid
                key={stage.label}
                label={stage.label}
                hex={stage.hex}
                {...(stage.previous === undefined ? {} : { previous: stage.previous })}
              />
            ),
          )}
          <StateGrid label="Round key (XORed in)" hex={round.roundKey} />
        </div>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          Orange cells changed at that stage. <strong>SubBytes</strong> is the only non-linear step
          and the only reason AES is not a solvable system of equations &mdash; Hill&rsquo;s cipher
          is pure linear algebra and falls to four known letters for exactly that reason.{' '}
          <strong>MixColumns</strong> is a matrix multiplication over GF(2<sup>8</sup>), which is
          Hill&rsquo;s idea in a field where every matrix has an inverse and there is no 13 to trip
          over. The final round leaves MixColumns out so that decryption is the same shape as
          encryption rather than a special case.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="cl-label">
            Round {round.round} of {block.rounds}
          </span>
          <input
            type="range"
            className="h-6 w-full accent-[var(--color-marker)]"
            min={0}
            max={Math.max(0, trace.length - 1)}
            value={Math.min(roundAt, trace.length - 1)}
            onChange={(e) => setRoundAt(Number(e.target.value))}
          />
        </label>

        {blocks.length > 1 && (
          <label className="block">
            <span className="cl-label">
              Block {block.block + 1} of {blocks.length}
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

      <section aria-labelledby="aes-mode" className="flex flex-col gap-3">
        <h3 id="aes-mode" className="text-sm font-semibold text-ink-strong">
          {mode === 'ECB' ? 'ECB: every block on its own' : 'CBC: every block chained to the last'}
        </h3>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {blocks.map((b, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-ink-subtle">Block {i + 1}</span>
                <span className="text-ink-muted">{b.input}</span>
                <span className="text-ink-subtle" aria-hidden="true">
                  →
                </span>
                <span
                  className={[
                    'rounded px-1',
                    blocks.some((other, j) => j !== i && other.cipher === b.cipher)
                      ? 'bg-marker-wash text-ink-strong underline decoration-marker-line decoration-2 underline-offset-4'
                      : 'text-ink',
                  ].join(' ')}
                >
                  {b.cipher}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="cl-prose text-sm text-ink-muted">
          {mode === 'ECB' ? (
            <>
              In ECB each block is encrypted independently, so{' '}
              <strong>identical plaintext blocks give identical ciphertext blocks</strong> &mdash;
              any repeats above are marked. Type sixteen of the same character twice and watch two
              rows match. That is the whole reason an ECB-encrypted image still shows the picture:
              the famous penguin is not a flaw in AES, it is a flaw in using AES this way. Switch
              the mode to CBC and the repeats disappear.
            </>
          ) : (
            <>
              In CBC each block is XORed with the previous ciphertext block before encryption, so
              identical plaintext blocks give different ciphertext. That is what ECB lacks, and it is
              why the IV must be <strong>unpredictable</strong> rather than merely different &mdash;
              a counter or a timestamp is not good enough. CBC still provides no{' '}
              <strong>authentication</strong>: an attacker cannot read the message but can flip
              chosen bits of it, which is what AES-GCM exists to prevent.
            </>
          )}
        </p>
      </section>
    </div>
  );
}
