/**
 * Key generation, and the key being broken.
 *
 * Two panels, and the second is the reason this page exists in this shape.
 *
 * There is **no Attack tab** on RSA, because `attack(ciphertext)` receives only a
 * ciphertext and RSA's break needs the *public key* — which is a param. The
 * visualizer does receive params, so the attack lives here: it factors n by trial
 * division, times it, recovers d, and decrypts. On this page that takes a
 * millisecond, which is exactly the thing to see. Nothing about the method changes
 * for a 2048-bit modulus except how long it runs, and how long it runs is the
 * entire security of RSA.
 *
 * This is the only file in the cipher folder that knows React exists.
 */
import { useMemo, useState } from 'react';
import type { Params, Step } from '../../../types';
import { buildKeys, factor, modInverse, modPow } from './rsa';

function readNumber(params: Params, name: string, fallback: number): number {
  const value = Number(params[name]);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

/** Roughly how many divisions trial division needs for a modulus of `bits` bits. */
function trialDivisionsFor(bits: number): string {
  // sqrt(2^bits) = 2^(bits/2), reported as a power of ten.
  const digits = (bits / 2) * Math.log10(2);
  return `10^${Math.round(digits)}`;
}

export default function RsaKeys({ steps, params }: { steps: Step[]; params: Params }) {
  const [broken, setBroken] = useState<{
    p: string;
    q: string;
    phi: string;
    d: string;
    tried: number;
    ms: number;
    matches: boolean;
  } | null>(null);

  const p = readNumber(params, 'p', 61);
  const q = readNumber(params, 'q', 53);
  const e = readNumber(params, 'e', 17);

  const keys = useMemo(() => {
    try {
      return buildKeys(p, q, e);
    } catch {
      return null;
    }
  }, [p, q, e]);

  const firstCipher = steps.find((s) => s.data?.['isByte'] === true)?.data?.['cipher'];

  const breakIt = () => {
    if (keys === null) return;
    const started = performance.now();
    const factors = factor(keys.n);
    const ms = performance.now() - started;
    if (factors === null) {
      setBroken(null);
      return;
    }
    const phi = (factors.p - 1n) * (factors.q - 1n);
    const d = modInverse(keys.e, phi);
    setBroken({
      p: factors.p.toString(),
      q: factors.q.toString(),
      phi: phi.toString(),
      d: (d ?? 0n).toString(),
      tried: factors.tried,
      ms,
      matches: d === keys.d,
    });
  };

  if (keys === null) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        These parameters do not make a valid key. The Encrypt tab says exactly which condition
        failed.
      </p>
    );
  }

  const rows: { label: string; value: string; secret: boolean; note: string }[] = [
    { label: 'p', value: String(p), secret: true, note: 'A prime. Secret, and half the private key.' },
    { label: 'q', value: String(q), secret: true, note: 'A different prime. Also secret.' },
    {
      label: 'n = p × q',
      value: keys.n.toString(),
      secret: false,
      note: 'The modulus. Public, and the only place p and q appear in the open.',
    },
    {
      label: 'φ(n) = (p−1)(q−1)',
      value: keys.phi.toString(),
      secret: true,
      note: 'Euler’s totient. Computing this needs p and q, which is the whole hinge.',
    },
    {
      label: 'e',
      value: keys.e.toString(),
      secret: false,
      note: 'The public exponent, coprime with φ(n). Real RSA almost always uses 65537.',
    },
    {
      label: 'd = e⁻¹ mod φ(n)',
      value: keys.d.toString(),
      secret: true,
      note: 'The private exponent. Derived from φ(n), so derived from p and q.',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="rsa-keygen" className="flex flex-col gap-3">
        <h3 id="rsa-keygen" className="text-sm font-semibold text-ink-strong">
          Making the key pair
        </h3>
        <div className="cl-card overflow-x-auto px-4 py-3">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {['', 'Value', 'Public?', ''].map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border-b border-line pb-1 text-left text-xs font-normal text-ink-subtle"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className="whitespace-nowrap border-b border-line py-1 pr-3 text-left font-mono text-xs font-normal text-ink"
                  >
                    {row.label}
                  </th>
                  <td className="border-b border-line py-1 pr-3 font-mono text-sm text-ink-strong">
                    {row.value}
                  </td>
                  <td className="border-b border-line py-1 pr-3 text-xs">
                    {row.secret ? (
                      <span className="rounded border border-marker-line bg-marker-wash px-1.5 py-0.5 text-marker-ink">
                        secret
                      </span>
                    ) : (
                      <span className="rounded border border-line bg-sunken px-1.5 py-0.5 text-ink-muted">
                        published
                      </span>
                    )}
                  </td>
                  <td className="border-b border-line py-1 text-xs text-ink-muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cl-prose text-sm text-ink-muted">
          The public key is <span className="font-mono">(n, e)</span> and can be printed in a
          newspaper. The private key is <span className="font-mono">d</span>, and every route to it
          runs through φ(n), and every route to φ(n) runs through <strong>p and q</strong>. That is
          the entire structure: <strong>n is public and its factors are not</strong>.
        </p>
      </section>

      <section aria-labelledby="rsa-break" className="flex flex-col gap-3">
        <h3 id="rsa-break" className="text-sm font-semibold text-ink-strong">
          Breaking it, with nothing but the public key
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          This page has no Attack tab because the attack contract here receives only a ciphertext,
          and RSA is broken through the <strong>public key</strong> instead. So the attack lives
          here: factor n by trying every odd divisor, recover φ(n), invert e, and read the message.
        </p>

        <div>
          <button type="button" className="cl-button cl-button-primary" onClick={breakIt}>
            Factor n = {keys.n.toString()}
          </button>
        </div>

        {broken !== null && (
          <div className="cl-card flex flex-col gap-2 px-4 py-3">
            <p className="font-mono text-sm text-ink-strong">
              n = {broken.p} × {broken.q}
            </p>
            <p className="font-mono text-sm text-ink">
              φ(n) = {broken.phi}, so d = {broken.d}
            </p>
            <p className="text-sm text-ink-muted">
              {broken.tried.toLocaleString('en-GB')} divisions, {broken.ms.toFixed(2)} ms.{' '}
              {broken.matches ? (
                <strong>That is the private key, recovered from public information alone.</strong>
              ) : (
                'The recovered exponent does not match, which should not happen.'
              )}
            </p>
            {firstCipher !== undefined && broken.matches && (
              <p className="font-mono text-sm text-ink">
                First ciphertext number {String(firstCipher)} decrypts to byte{' '}
                {modPow(BigInt(String(firstCipher)), BigInt(broken.d), keys.n).toString()}.
              </p>
            )}
          </div>
        )}

        <p className="cl-prose text-sm text-ink-muted">
          Nothing about that method changes for real RSA. Only the running time does, and the
          running time <em>is</em> the security. Trial division on a 2048-bit modulus needs roughly{' '}
          <span className="font-mono">{trialDivisionsFor(2048)}</span> divisions; the best known
          algorithm, the general number field sieve, is far faster than that and still leaves 2048
          bits comfortably out of reach. <strong>RSA is not safe because factoring is impossible.</strong>{' '}
          It is safe because nobody has found a fast way to do it &mdash; and that is a statement
          about the present state of knowledge rather than a proof. Shor&rsquo;s algorithm factors in
          polynomial time on a quantum computer, which is why post-quantum cryptography is a field.
        </p>
      </section>
    </div>
  );
}
