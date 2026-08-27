import { useMemo, useState } from 'react';
import { WANG_A, WANG_B, differingBytes } from './collisionData';
import { md5Bytes } from './md5';
import { hexToBytes } from '../../../../lib/bytes';

/**
 * Two messages, one digest.
 *
 * This is MD5's Attack tab, on the Visualize tab, because `attack(ciphertext)`
 * has nowhere to put "two inputs that agree" — see gap 6 in the project notes.
 * It is also the better home: the failure is a property of the function, not of
 * any message someone typed.
 *
 * Nothing is asserted here. Both digests are computed by this app's own MD5 from
 * the bytes shown on screen, so the claim is demonstrated rather than stated.
 */

const a = hexToBytes(WANG_A, 'first message');
const b = hexToBytes(WANG_B, 'second message');
const differences = differingBytes(a, b);

function HexBlock({ bytes, marked }: { bytes: Uint8Array; marked: number[] }) {
  const set = new Set(marked);
  return (
    <p className="wrap-anywhere font-mono text-xs leading-6 text-ink-muted">
      {[...bytes].map((byte, i) => (
        <span
          key={i}
          className={
            set.has(i)
              ? 'bg-marker-wash font-bold text-ink underline decoration-marker-line decoration-2'
              : undefined
          }
          title={set.has(i) ? `byte ${i}: differs` : `byte ${i}`}
        >
          {byte.toString(16).padStart(2, '0')}
        </span>
      ))}
    </p>
  );
}

export default function Collision() {
  const [suffix, setSuffix] = useState('');

  const [digestA, digestB] = useMemo(() => {
    // Appending the *same* bytes to both keeps the collision, because the states
    // were already equal when the shared tail started. This is the whole trick
    // behind two real files — two contracts, two certificates — that hash alike.
    const tail = new TextEncoder().encode(suffix);
    const join = (base: Uint8Array) => {
      const out = new Uint8Array(base.length + tail.length);
      out.set(base);
      out.set(tail, base.length);
      return out;
    };
    return [md5Bytes(join(a)), md5Bytes(join(b))];
  }, [suffix]);

  const same = digestA === digestB;

  return (
    <div className="flex flex-col gap-6">
      <section className="cl-card px-4 py-4">
        <h3 className="text-sm font-semibold text-ink-strong">
          {same ? 'Same digest, different messages' : 'The digests differ'}
        </h3>
        <p className="cl-prose mt-1 text-sm text-ink-muted">
          Two 128-byte messages published by Wang and Yu in 2004. They differ in{' '}
          {differences.length} bytes — at offsets {differences.join(', ')} — and this app’s own MD5
          gives both of them the same 128-bit answer. That is a collision, and one existing at all
          is enough to end a hash function’s career.
        </p>
        <p className="mt-3 wrap-anywhere font-mono text-sm text-ink">{digestA}</p>
        <p className="mt-1 wrap-anywhere font-mono text-sm text-ink">{digestB}</p>
        <p className="mt-2 text-xs text-ink-subtle">
          {same ? 'Identical, character for character.' : 'These no longer match.'}
        </p>
      </section>

      <section className="cl-card px-4 py-4">
        <h3 className="text-sm font-semibold text-ink-strong">The two messages</h3>
        <p className="cl-prose mt-1 text-sm text-ink-muted">
          Bold and underlined bytes are the ones that differ. Every other byte is identical, which
          is why a collision is dangerous rather than merely surprising: the two messages can be
          made to look alike to a person and still be different to a computer.
        </p>
        <div className="mt-3 grid gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-subtle">First message</p>
            <HexBlock bytes={a} marked={differences} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-subtle">Second message</p>
            <HexBlock bytes={b} marked={differences} />
          </div>
        </div>
      </section>

      <section className="cl-card px-4 py-4">
        <h3 className="text-sm font-semibold text-ink-strong">Append anything you like</h3>
        <p className="cl-prose mt-1 text-sm text-ink-muted">
          Add the same text to the end of both messages. The digests stay equal, because the two
          internal states had already converged before your text arrived. This is how a collision
          becomes two whole documents rather than two blobs of noise: put the colliding pair at the
          front, and everything after it is yours to write.
        </p>
        <label className="mt-3 flex flex-col gap-1">
          <span className="cl-label mb-0">Text appended to both</span>
          <input
            type="text"
            value={suffix}
            onChange={(event) => setSuffix(event.target.value)}
            placeholder="I agree to pay £10"
            className="cl-field w-full wrap-anywhere font-mono"
          />
        </label>
      </section>
    </div>
  );
}
