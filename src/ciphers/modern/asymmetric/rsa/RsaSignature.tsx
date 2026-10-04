/**
 * Lab 07's digital signature, on this page's key.
 *
 * Sign with the private key, verify with the public key. The reader types a
 * document, signs it, and then edits the document or the signature to watch the
 * check fail. The arithmetic is in `signature.ts`; this file only draws it.
 *
 * This is the only file in the cipher folder, besides the other visualizer,
 * that knows React exists.
 */
import { useId, useState } from 'react';
import type { KeyPair } from './rsa';
import { sign, verify } from './signature';

export default function RsaSignature({ keys }: { keys: KeyPair }) {
  const docId = useId();
  const sigId = useId();
  const [document, setDocument] = useState('I, Alice, owe Bob 10 ringgit.');
  const [signed, setSigned] = useState<{ text: string; signature: string } | null>(null);
  const [signatureText, setSignatureText] = useState('');

  const doSign = () => {
    const result = sign(document, keys);
    setSigned({ text: document, signature: result.signature.toString() });
    setSignatureText(result.signature.toString());
  };

  const signatureValue = /^\d+$/.test(signatureText.trim()) ? BigInt(signatureText.trim()) : null;
  const signing = signed === null ? null : sign(signed.text, keys);
  const check = signatureValue === null ? null : verify(document, signatureValue, keys);

  return (
    <section aria-labelledby="rsa-sign" className="flex flex-col gap-3">
      <h3 id="rsa-sign" className="text-sm font-semibold text-ink-strong">
        Digital signature (Lab 07): sign with d, verify with e
      </h3>
      <p className="cl-prose text-sm text-ink-muted">
        A signature uses the keys the other way round. The owner signs with the <strong>private</strong>{' '}
        key, so only they can make it. Anyone verifies with the <strong>public</strong> key. Lab 07 lists
        the steps: hash the document, encrypt the hash with the private key, attach it. To verify,
        decrypt the signature with the public key, hash the document again, and compare.
      </p>

      <div className="cl-card flex flex-col gap-3 px-4 py-3">
        <label htmlFor={docId} className="cl-label">
          Document
        </label>
        <textarea
          id={docId}
          rows={2}
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          className="cl-field w-full wrap-anywhere font-mono"
          spellCheck={false}
        />
        <div>
          <button type="button" className="cl-button cl-button-primary" onClick={doSign}>
            Sign with the private key d = {keys.d.toString()}
          </button>
        </div>

        {signing !== null && signed !== null && (
          <ol className="flex list-decimal flex-col gap-1 pl-5 font-mono text-xs text-ink wrap-anywhere">
            <li>SHA-256(document) = {signing.digest}</li>
            <li>
              H = that digest mod n = {signing.h.toString()} <span className="font-sans text-ink-subtle">(the toy step: see below)</span>
            </li>
            <li>
              s = H<sup>d</sup> mod n = {signing.h.toString()}
              <sup>{keys.d.toString()}</sup> mod {keys.n.toString()} = <strong>{signed.signature}</strong>
            </li>
          </ol>
        )}

        <label htmlFor={sigId} className="cl-label">
          Signature attached to the document
        </label>
        <input
          id={sigId}
          inputMode="numeric"
          value={signatureText}
          onChange={(e) => setSignatureText(e.target.value)}
          placeholder="Sign first, or type a number"
          className="cl-field w-full font-mono"
        />

        {check !== null && (
          <div
            role="status"
            className={[
              'rounded border px-3 py-2 text-sm',
              check.valid ? 'border-line bg-sunken text-ink' : 'border-marker-line bg-marker-wash text-ink-strong',
            ].join(' ')}
          >
            <p className="font-mono text-xs wrap-anywhere">
              s<sup>e</sup> mod n = {signatureText.trim()}
              <sup>{keys.e.toString()}</sup> mod {keys.n.toString()} = {check.recovered.toString()}
            </p>
            <p className="font-mono text-xs">H(document) mod n = {check.h.toString()}</p>
            <p className="mt-1 font-semibold">
              {check.valid
                ? 'Valid. The document is unchanged, and only the holder of d could have signed it.'
                : 'Not valid. Either the document changed after signing, or the signature was not made with this key.'}
            </p>
          </div>
        )}
      </div>

      <p className="cl-prose text-sm text-ink-muted">
        Try it: sign, then change one character of the document. The hash changes, so the check fails.
        That is <strong>integrity</strong>. Only d makes a signature that e accepts, which is{' '}
        <strong>authentication</strong> and <strong>non-repudiation</strong>.
      </p>
      <p className="cl-prose text-sm text-ink-muted">
        <strong>The toy step.</strong> SHA-256 gives a 256-bit number and this n has about{' '}
        {keys.n.toString(2).length} bits, so the hash is reduced mod n before signing. That throws
        almost all of the hash away: any two documents with the same H mod n share a signature, and with
        n = {keys.n.toString()} the birthday paradox finds such a pair in about{' '}
        {Math.max(1, Math.round(Math.sqrt(Number(keys.n))))} tries. Real RSA signs the whole digest,
        with a 2048-bit n and a padding scheme such as PSS. The arithmetic is exactly this.
      </p>
    </section>
  );
}
