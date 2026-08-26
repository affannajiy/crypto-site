/**
 * The Feistel ladder.
 *
 * Two columns of 32-bit halves descending the page, with the round function
 * hanging off the right one and its output crossing into the left. That crossing
 * is the cipher: every round is one X.
 *
 * The panel underneath opens up F for the selected round — expand, XOR the key,
 * eight S-boxes, permute — because the S-boxes are where the non-linearity lives
 * and they are the only part of DES that is not a table lookup or an XOR.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useState } from 'react';
import type { Params, Step } from '../../../types';

interface Box {
  box: number;
  input: number;
  row: number;
  column: number;
  output: number;
}

interface RoundData {
  round: number;
  left: string;
  right: string;
  roundKey: string;
  expanded: string;
  mixed: string;
  substituted: string;
  fOut: string;
  newLeft: string;
  newRight: string;
  boxes: Box[];
}

interface BlockData {
  block: number;
  mode: string;
  input: string;
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
      input: String(data['input'] ?? ''),
      cipher: String(data['cipher'] ?? ''),
      trace: trace as RoundData[],
    });
  }
  return out;
}

function Half({ hex, tone }: { hex: string; tone: 'plain' | 'active' }) {
  return (
    <span
      className={[
        'rounded border px-2 py-0.5 font-mono text-xs',
        tone === 'active'
          ? 'border-marker-line bg-marker-wash text-ink-strong'
          : 'border-line text-ink-muted',
      ].join(' ')}
    >
      {hex}
    </span>
  );
}

export default function FeistelRounds({ steps, params }: { steps: Step[]; params: Params }) {
  const [blockAt, setBlockAt] = useState(0);
  const [roundAt, setRoundAt] = useState(0);

  const blocks = readBlocks(steps);
  const block = blocks[Math.min(blockAt, Math.max(0, blocks.length - 1))];
  const trace = block?.trace ?? [];
  const round = trace[Math.min(roundAt, Math.max(0, trace.length - 1))];

  if (block === undefined || round === undefined) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and all sixteen rounds will be laid out here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">
          The ladder &mdash; block {block.block + 1} of {blocks.length},{' '}
          {String(params['mode'] ?? block.mode)} mode
        </p>
        <table className="mt-2 border-separate border-spacing-x-3 border-spacing-y-1">
          <thead>
            <tr>
              <th scope="col" className="text-left text-xs font-normal text-ink-subtle">
                Round
              </th>
              <th scope="col" className="text-left text-xs font-normal text-ink-subtle">
                Left (32 bits)
              </th>
              <th scope="col" className="text-left text-xs font-normal text-ink-subtle">
                Right (32 bits)
              </th>
            </tr>
          </thead>
          <tbody>
            {trace.map((r) => (
              <tr key={r.round}>
                <td className="text-xs text-ink-subtle">{r.round}</td>
                <td>
                  <Half hex={r.left} tone={r.round === round.round ? 'active' : 'plain'} />
                </td>
                <td>
                  <Half hex={r.right} tone={r.round === round.round ? 'active' : 'plain'} />
                </td>
              </tr>
            ))}
            <tr>
              <td className="text-xs text-ink-subtle">out</td>
              <td>
                <Half hex={trace[trace.length - 1]?.newLeft ?? ''} tone="plain" />
              </td>
              <td>
                <Half hex={trace[trace.length - 1]?.newRight ?? ''} tone="plain" />
              </td>
            </tr>
          </tbody>
        </table>
        <p className="cl-prose mt-3 text-sm text-ink-muted">
          Read down the columns: the <strong>left</strong> half of every round is the{' '}
          <strong>right</strong> half of the one above it, unchanged. Only the right column is doing
          work, and it is doing it by XOR &mdash; which is why running the rounds backwards undoes
          them no matter what F does.
        </p>
      </div>

      <div className="cl-card overflow-x-auto px-4 py-3">
        <p className="cl-label">Inside F, round {round.round}</p>
        <dl className="mt-2 flex flex-col gap-2 font-mono text-xs">
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="w-40 shrink-0 text-ink-subtle">Right half (32)</dt>
            <dd className="text-ink">{round.right}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="w-40 shrink-0 text-ink-subtle">Expanded (48)</dt>
            <dd className="break-all text-ink-muted">{round.expanded}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="w-40 shrink-0 text-ink-subtle">Round key (48)</dt>
            <dd className="break-all text-ink-muted">{round.roundKey}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="w-40 shrink-0 text-ink-subtle">XORed (48)</dt>
            <dd className="break-all text-ink-muted">{round.mixed}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="w-40 shrink-0 text-ink-subtle">After the S-boxes (32)</dt>
            <dd className="text-ink">{round.substituted}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="w-40 shrink-0 text-ink-subtle">After P, into the XOR</dt>
            <dd className="text-ink-strong">{round.fOut}</dd>
          </div>
        </dl>
      </div>

      <section aria-labelledby="des-sboxes" className="flex flex-col gap-3">
        <h3 id="des-sboxes" className="text-sm font-semibold text-ink-strong">
          The eight S-boxes
        </h3>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <table className="border-separate border-spacing-0">
            <thead>
              <tr>
                {['Box', 'Six bits in', 'Row', 'Column', 'Four bits out'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border border-line bg-sunken px-2 py-1 text-left text-xs font-normal text-ink-subtle"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {round.boxes.map((box) => (
                <tr key={box.box}>
                  <td className="border border-line px-2 py-1 font-mono text-xs text-ink">
                    S{box.box}
                  </td>
                  <td className="border border-line px-2 py-1 font-mono text-xs text-ink-muted">
                    {box.input.toString(2).padStart(6, '0')}
                  </td>
                  <td className="border border-line px-2 py-1 font-mono text-xs text-ink-muted">
                    {box.row}
                  </td>
                  <td className="border border-line px-2 py-1 font-mono text-xs text-ink-muted">
                    {box.column}
                  </td>
                  <td className="border border-line bg-marker-wash px-2 py-1 font-mono text-xs text-ink-strong">
                    {box.output.toString(2).padStart(4, '0')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cl-prose text-sm text-ink-muted">
          Six bits in, four bits out. <strong>Information is destroyed here</strong> &mdash; four
          different inputs land on every output &mdash; and that is allowed only because a Feistel
          network never has to invert F. These eight tables are the only non-linear part of DES, and
          they are the part the NSA quietly changed before publication. That change was suspected
          for years of being a back door. When differential cryptanalysis became public in 1990 it
          turned out the new boxes were <em>stronger</em> against it, which meant IBM and the NSA had
          both known about the attack for sixteen years and said nothing.
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="cl-label">
            Round {round.round} of {trace.length}
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
    </div>
  );
}
