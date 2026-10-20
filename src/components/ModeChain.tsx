/**
 * The mode of operation, drawn and then filled in with this run's numbers.
 *
 * AES, DES and Triple DES all draw their rounds differently, but the chain of
 * blocks around those rounds is the same for every block cipher. So the chain
 * lives here, once, and each cipher's visualizer places it under its own rounds.
 *
 * It reads only the fields `lib/blockMessage.ts` writes into every block step,
 * and it branches on the mode, never on the cipher.
 */
import type { Step } from '../ciphers/types';
import { MODE_SUMMARY, type Mode } from '../lib/modes';

interface ChainBlock {
  block: number;
  input: string;
  cipherIn: string;
  cipherOut: string;
  xorWith: string | null;
  xorStage: string | null;
  ran: string;
  cipher: string;
}

export function readChain(steps: Step[]): ChainBlock[] {
  const out: ChainBlock[] = [];
  for (const step of steps) {
    const data = step.data;
    if (data === undefined || data['isBlock'] !== true) continue;
    out.push({
      block: Number(data['block'] ?? 0),
      input: String(data['input'] ?? ''),
      cipherIn: String(data['cipherIn'] ?? ''),
      cipherOut: String(data['cipherOut'] ?? ''),
      xorWith: typeof data['xorWith'] === 'string' ? data['xorWith'] : null,
      xorStage: typeof data['xorStage'] === 'string' ? data['xorStage'] : null,
      ran: String(data['ran'] ?? 'encrypt'),
      cipher: String(data['cipher'] ?? ''),
    });
  }
  return out;
}

/** Fixed geometry: the diagram scrolls inside its card rather than shrinking. */
const COL = 200;
const LEFT = 70;
const BOX_W = 120;
const BOX_H = 30;
/** Width of a data box (P1, C1, IV); the block cipher's box is BOX_W. */
const SMALL_W = 64;
const WIDTH = LEFT + COL * 3 - 20;
const HEIGHT = 250;

type Node = { kind: 'box' | 'cipher' | 'xor' | 'label'; x: number; y: number; text: string };
type Edge = { from: [number, number]; to: [number, number]; dashed?: boolean };

/** The schematic for one mode, three blocks wide, as the lecture slides draw it. */
function schematic(mode: string, cipherName: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const cx = (i: number) => LEFT + i * COL + BOX_W / 2;
  const E = `${cipherName} encrypt`;

  for (let i = 0; i < 3; i += 1) {
    const x = cx(i);
    const P = `P${i + 1}`;
    const C = `C${i + 1}`;
    switch (mode) {
      case 'ECB':
        nodes.push({ kind: 'box', x, y: 30, text: P }, { kind: 'cipher', x, y: 110, text: E }, { kind: 'box', x, y: 200, text: C });
        edges.push({ from: [x, 45], to: [x, 95] }, { from: [x, 125], to: [x, 185] });
        break;
      case 'CBC':
        nodes.push(
          { kind: 'box', x, y: 25, text: P },
          { kind: 'xor', x, y: 75, text: '' },
          { kind: 'cipher', x, y: 135, text: E },
          { kind: 'box', x, y: 210, text: C },
        );
        edges.push({ from: [x, 40], to: [x, 66] }, { from: [x, 84], to: [x, 120] }, { from: [x, 150], to: [x, 195] });
        if (i === 0) {
          nodes.push({ kind: 'label', x: x - 90, y: 79, text: 'IV' });
          edges.push({ from: [x - 75, 75], to: [x - 9, 75] });
        } else {
          edges.push({ from: [cx(i - 1) + SMALL_W / 2 + 2, 210], to: [x - 9, 75], dashed: true });
        }
        break;
      case 'CFB':
      case 'OFB':
      case 'CTR': {
        const top = mode === 'CTR' ? `IV+${i}` : i === 0 ? 'IV' : mode === 'CFB' ? `C${i}` : `O${i}`;
        nodes.push(
          { kind: 'box', x, y: 25, text: top },
          { kind: 'cipher', x, y: 85, text: E },
          { kind: 'xor', x, y: 150, text: '' },
          { kind: 'box', x: x - 70, y: 150, text: P },
          { kind: 'box', x, y: 215, text: C },
        );
        edges.push(
          { from: [x, 40], to: [x, 70] },
          { from: [x, 100], to: [x, 141] },
          { from: [x - 40, 150], to: [x - 9, 150] },
          { from: [x, 159], to: [x, 200] },
        );
        if (i < 2 && mode === 'CFB') edges.push({ from: [x + SMALL_W / 2 + 2, 215], to: [cx(i + 1) - SMALL_W / 2 - 2, 25], dashed: true });
        if (i < 2 && mode === 'OFB') edges.push({ from: [x + BOX_W / 2 + 2, 85], to: [cx(i + 1) - SMALL_W / 2 - 2, 25], dashed: true });
        break;
      }
      default:
        break;
    }
  }
  return { nodes, edges };
}

function Schematic({ mode, cipherName }: { mode: string; cipherName: string }) {
  const { nodes, edges } = schematic(mode, cipherName);
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block shrink-0"
      role="img"
      aria-label={`${mode} mode, three blocks: how each block reaches the block cipher and the XOR.`}
    >
      <defs>
        <marker id="mode-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink-muted)" />
        </marker>
      </defs>
      {edges.map((e, i) => (
        <line
          key={`e${i}`}
          x1={e.from[0]}
          y1={e.from[1]}
          x2={e.to[0]}
          y2={e.to[1]}
          stroke={e.dashed === true ? 'var(--color-marker-line)' : 'var(--color-ink-muted)'}
          strokeWidth={e.dashed === true ? 2 : 1.5}
          strokeDasharray={e.dashed === true ? '5 4' : undefined}
          markerEnd="url(#mode-arrow)"
        />
      ))}
      {nodes.map((n, i) => {
        if (n.kind === 'xor') {
          return (
            <g key={`n${i}`}>
              <circle cx={n.x} cy={n.y} r={9} fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth={1.5} />
              <line x1={n.x - 9} y1={n.y} x2={n.x + 9} y2={n.y} stroke="var(--color-ink)" strokeWidth={1.5} />
              <line x1={n.x} y1={n.y - 9} x2={n.x} y2={n.y + 9} stroke="var(--color-ink)" strokeWidth={1.5} />
            </g>
          );
        }
        if (n.kind === 'label') {
          return (
            <text key={`n${i}`} x={n.x} y={n.y} className="font-mono" fontSize={13} fill="var(--color-ink)">
              {n.text}
            </text>
          );
        }
        const w = n.kind === 'cipher' ? BOX_W : SMALL_W;
        return (
          <g key={`n${i}`}>
            <rect
              x={n.x - w / 2}
              y={n.y - BOX_H / 2}
              width={w}
              height={BOX_H}
              rx={4}
              fill={n.kind === 'cipher' ? 'var(--color-sunken)' : 'var(--color-surface)'}
              stroke={n.kind === 'cipher' ? 'var(--color-ink)' : 'var(--color-line-strong)'}
              strokeWidth={1.5}
            />
            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              className="font-mono"
              fontSize={12}
              fill="var(--color-ink-strong)"
            >
              {n.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Hex({ value, mark = false }: { value: string | null; mark?: boolean }) {
  if (value === null || value === '') return <span className="text-ink-subtle">—</span>;
  return (
    <span
      className={[
        'font-mono text-xs wrap-anywhere',
        mark ? 'rounded bg-marker-wash px-1 text-ink-strong underline decoration-marker-line decoration-2 underline-offset-4' : 'text-ink',
      ].join(' ')}
    >
      {value}
    </span>
  );
}

export default function ModeChain({
  steps,
  mode,
  cipherName,
}: {
  steps: Step[];
  mode: string;
  cipherName: string;
}) {
  const blocks = readChain(steps);
  const summary = MODE_SUMMARY[mode as Mode];
  if (blocks.length === 0 || summary === undefined) return null;

  const repeats = (b: ChainBlock) => mode === 'ECB' && blocks.some((other) => other !== b && other.cipher === b.cipher);

  return (
    <section aria-labelledby="mode-chain" className="flex flex-col gap-3">
      <h3 id="mode-chain" className="text-sm font-semibold text-ink-strong">
        Mode of operation: {summary.title}
      </h3>

      <div className="cl-card overflow-x-auto px-4 py-3">
        <Schematic mode={mode} cipherName={cipherName} />
        <p className="cl-prose mt-2 text-sm text-ink-muted">
          Encryption, three blocks. Dashed orange arrows carry one block&rsquo;s result into the next.
          {mode === 'CFB' || mode === 'OFB' || mode === 'CTR'
            ? ` ${cipherName} only ever runs forwards here, even to decrypt: it makes a keystream, and the XOR does the rest. To decrypt, swap P and C in the picture.`
            : ''}
        </p>
      </div>

      <div className="cl-card overflow-x-auto px-4 py-3">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="text-ink-subtle">
              <th scope="col" className="py-1 pr-3 font-medium">Block</th>
              <th scope="col" className="py-1 pr-3 font-medium">Input block</th>
              <th scope="col" className="py-1 pr-3 font-medium">Into {cipherName}</th>
              <th scope="col" className="py-1 pr-3 font-medium">Out of {cipherName}</th>
              <th scope="col" className="py-1 pr-3 font-medium">XORed with</th>
              <th scope="col" className="py-1 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.block} className="border-t border-line align-top">
                <td className="py-1 pr-3 text-ink-subtle">{b.block + 1}</td>
                <td className="py-1 pr-3"><Hex value={b.input} /></td>
                <td className="py-1 pr-3"><Hex value={b.cipherIn} /></td>
                <td className="py-1 pr-3">
                  <Hex value={b.cipherOut} />
                  {b.ran === 'decrypt' && <span className="ml-1 text-ink-subtle">(decrypt)</span>}
                </td>
                <td className="py-1 pr-3"><Hex value={b.xorWith} /></td>
                <td className="py-1"><Hex value={b.cipher} mark={repeats(b)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="cl-prose grid gap-1 text-sm text-ink-muted sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="font-semibold text-ink-strong">Strength</dt>
        <dd>{summary.strength}</dd>
        <dt className="font-semibold text-ink-strong">Weakness</dt>
        <dd>{summary.weakness}</dd>
        <dt className="font-semibold text-ink-strong">Used in</dt>
        <dd>{summary.uses}</dd>
      </dl>
      {mode === 'ECB' && blocks.some(repeats) && (
        <p className="cl-prose text-sm text-ink-muted">
          The marked results repeat because their message blocks repeat. That is the ECB weakness, live.
          Switch the mode and the repeats disappear.
        </p>
      )}
    </section>
  );
}
