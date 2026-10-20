/**
 * Lecture 06's toy hash-then-sign example, and its collision slide.
 *
 * The arithmetic is in `signature.ts`. This file only draws it. It uses the
 * slide's own fixed keys, PU(5, 14) and PR(11, 14), not the key on this page,
 * because the point is to follow the slide line by line.
 *
 * This is a visualizer file, so it may know React exists.
 */
import { useId, useState } from 'react';
import { TOY_HASH_MODULUS, TOY_KEYS, letterSum, toySign } from './signature';

export default function ToySignature() {
  const messageId = useId();
  const firstId = useId();
  const secondId = useId();
  const [message, setMessage] = useState('Cloud');
  const [first, setFirst] = useState('ABC');
  const [second, setSecond] = useState('F');

  const signed = toySign(message);
  const { n, e, d } = TOY_KEYS;
  const sumFirst = letterSum(first);
  const sumSecond = letterSum(second);

  return (
    <section aria-labelledby={`${messageId}-h`} className="flex flex-col gap-3">
      <h3 id={`${messageId}-h`} className="text-sm font-semibold text-ink-strong">
        Lecture 06 toy example: Alice signs &ldquo;Cloud&rdquo;
      </h3>
      <p className="cl-prose text-sm text-ink-muted">
        The slide&rsquo;s keys: public PU = ({e.toString()}, {n.toString()}), private PR = ({d.toString()},{' '}
        {n.toString()}). The hash is the sum of the ASCII codes, mod {TOY_HASH_MODULUS}. Alice signs the hash
        with her private key. Bob recomputes the hash and opens the signature with her public key.
      </p>

      <div className="cl-card flex flex-col gap-3 px-4 py-3">
        <label htmlFor={messageId} className="cl-label">
          Message M
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={messageId}
            value={message}
            onChange={(ev) => setMessage(ev.target.value)}
            className="cl-field w-48 font-mono"
            spellCheck={false}
            autoComplete="off"
          />
          <button type="button" className="cl-button" onClick={() => setMessage('Cloud')}>
            Cloud
          </button>
          <button type="button" className="cl-button" onClick={() => setMessage('Rain')}>
            Rain
          </button>
        </div>
        <pre className="overflow-x-auto font-mono text-sm leading-6 text-ink">
{`H(M) = ${signed.hash.codes.map((c) => `${c.char} ${c.code}`).join(' + ') || '0'}
     = ${signed.hash.sum} mod ${TOY_HASH_MODULUS} = ${signed.hash.h}

Alice:  S  = H^d mod n = ${signed.hash.h}^${d} mod ${n} = ${signed.signature}
Bob:    S^e mod n      = ${signed.signature}^${e} mod ${n} = ${signed.recovered}
        H'(M)          = ${signed.hash.h}`}
        </pre>
        <p role="status" className="text-sm font-semibold text-ink-strong">
          {signed.valid
            ? `Match: ${signed.recovered} = ${signed.hash.h}. Bob accepts M.`
            : `No match: ${signed.recovered} ≠ ${signed.hash.h}. Bob rejects M.`}
        </p>
        {signed.hashTooBig && (
          <p className="cl-prose text-sm text-ink">
            <strong>Why it fails:</strong> H = {signed.hash.h} is not smaller than n = {n.toString()}. RSA works
            on numbers below n, so the signature can only carry {signed.hash.h} mod {n.toString()} ={' '}
            {(BigInt(signed.hash.h) % n).toString()}. Real RSA uses an n far larger than any hash.
          </p>
        )}
      </div>

      <div className="cl-card border-marker-mid bg-marker-wash px-4 py-3">
        <p className="cl-prose text-sm text-ink">
          <strong>Lecture note.</strong> The slide adds up &ldquo;Cloud&rdquo; to 471. The ASCII codes add up to
          503, so H = 41, not 9. With the correct hash the check fails, for the reason above. The
          slide&rsquo;s later arithmetic (9<sup>11</sup> mod 14 = 11, 11<sup>5</sup> mod 14 = 9) is right for its
          own 9. Press <strong>Rain</strong> to see that exact chain: &ldquo;Rain&rdquo; really does hash to 9.
        </p>
      </div>

      <h3 className="text-sm font-semibold text-ink-strong">The collision slide: A = 1, B = 2, &hellip; added up</h3>
      <div className="cl-card flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap gap-4">
          <label htmlFor={firstId} className="flex flex-col gap-1">
            <span className="cl-label">Message 1</span>
            <input
              id={firstId}
              value={first}
              onChange={(ev) => setFirst(ev.target.value)}
              className="cl-field w-40 font-mono"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <label htmlFor={secondId} className="flex flex-col gap-1">
            <span className="cl-label">Message 2</span>
            <input
              id={secondId}
              value={second}
              onChange={(ev) => setSecond(ev.target.value)}
              className="cl-field w-40 font-mono"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
        </div>
        <p role="status" className="font-mono text-sm text-ink">
          hash 1 = {sumFirst}, hash 2 = {sumSecond}
          <span className="font-sans font-semibold text-ink-strong">
            {first.trim() !== second.trim() && sumFirst === sumSecond ? ' — a collision.' : ''}
          </span>
        </p>
        <p className="cl-prose text-sm text-ink-muted">
          Two different messages with the same hash. A signature on one is then a signature on the other.
          That is why a real hash must be collision-resistant, and why the MD5 page shows a real collision.
        </p>
      </div>
    </section>
  );
}
