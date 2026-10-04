/**
 * The Vernam pad, bit by bit, and the same pad used twice.
 *
 * The top panel is the usual Vernam picture: for every byte, the message bits,
 * the pad bits under them, and the XOR of the two. A pad bit of 1 flips the
 * message bit and a pad bit of 0 leaves it alone, so the flipped bits are marked.
 *
 * The bottom panel is the reuse break in XOR form. Encrypt a second message with
 * the same pad and XOR the two ciphertexts: the pad cancels, and what is left is
 * the XOR of the two messages. The panel computes it both ways and shows that
 * they match.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Params, Step } from '../../../types';
import { bytesToHex, utf8Bytes } from '../../../../lib/bytes';
import { bits, readHexPad } from './vernam';

const PLAY_INTERVAL_MS = 700;

/** Bytes shown either side of the current one. */
const WINDOW = 6;

interface Row {
  position: number;
  char: string;
  plainByte: number;
  padByte: number;
  cipherByte: number;
  encrypting: boolean;
}

function readRow(step: Step | undefined): Row | null {
  const data = step?.data;
  if (data === undefined || data['vernam'] !== true) return null;
  const position = data['position'];
  const char = data['char'];
  const plainByte = data['plainByte'];
  const padByte = data['padByte'];
  const cipherByte = data['cipherByte'];
  if (
    typeof position !== 'number' ||
    typeof char !== 'string' ||
    typeof plainByte !== 'number' ||
    typeof padByte !== 'number' ||
    typeof cipherByte !== 'number'
  ) {
    return null;
  }
  return { position, char, plainByte, padByte, cipherByte, encrypting: data['direction'] !== 'decrypt' };
}

/** Eight bits, with the ones the pad flips marked by weight and underline, not colour alone. */
function Bits({ value, pad, mark }: { value: number; pad: number; mark: boolean }) {
  const text = bits(value);
  const padBits = bits(pad);
  return (
    <span>
      {text.split('').map((bit, i) => {
        const flipped = mark && padBits.charAt(i) === '1';
        return (
          <span
            key={i}
            className={flipped ? 'font-bold text-ink-strong underline decoration-marker-line decoration-2 underline-offset-2' : undefined}
          >
            {bit}
          </span>
        );
      })}
    </span>
  );
}

function visible(char: string): string {
  if (char === ' ') return '␠';
  if (char === '\n') return '↵';
  return char;
}

export default function VernamTable({ steps, params }: { steps: Step[]; params: Params }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The demo's second message is this panel's own business, not part of the key.
  const [second, setSecond] = useState('ATTACK AT DAWN INSTEAD');

  const rows = useMemo(
    () => steps.map(readRow).filter((row): row is Row => row !== null),
    [steps],
  );

  const maxCursor = Math.max(0, rows.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const current = rows[safeCursor];

  const traceLength = steps.length;
  useEffect(() => {
    setCursor(0);
  }, [traceLength]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!playing || rows.length === 0) return;
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= rows.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => {
      if (timer.current !== null) clearInterval(timer.current);
    };
  }, [playing, rows.length]);

  // The reuse demo. It runs over the bytes both messages have, and only when the
  // pad covers them, because a short pad is a different failure.
  const reuse = useMemo(() => {
    let pad: Uint8Array;
    try {
      pad = readHexPad(String(params['hexPad'] ?? ''));
    } catch {
      return null;
    }
    const p1 = Uint8Array.from(rows.map((r) => r.plainByte));
    const c1 = Uint8Array.from(rows.map((r) => r.cipherByte));
    const p2 = utf8Bytes(second);
    const length = Math.min(p1.length, p2.length);
    if (length === 0 || pad.length < p2.length) return null;
    const c2 = p2.map((b, i) => b ^ (pad[i] ?? 0));
    const fromCiphertexts = new Uint8Array(length).map((_, i) => (c1[i] ?? 0) ^ (c2[i] ?? 0));
    const fromPlaintexts = new Uint8Array(length).map((_, i) => (p1[i] ?? 0) ^ (p2[i] ?? 0));
    return {
      c2: bytesToHex(c2),
      fromCiphertexts: bytesToHex(fromCiphertexts),
      fromPlaintexts: bytesToHex(fromPlaintexts),
    };
  }, [params, rows, second]);

  if (rows.length === 0) {
    return (
      <p className="cl-prose text-sm text-ink-muted">
        Type a message on the Encrypt tab and this table will show every byte being XORed with the
        pad.
      </p>
    );
  }

  const encrypting = current?.encrypting ?? true;
  const start = Math.max(0, safeCursor - WINDOW);
  const end = Math.min(rows.length, safeCursor + WINDOW + 1);
  const shown = rows.slice(start, end);
  const matches = reuse !== null && reuse.fromCiphertexts === reuse.fromPlaintexts;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="vernam-heading" className="flex flex-col gap-4">
        <h3 id="vernam-heading" className="text-sm font-semibold text-ink-strong">
          Vernam: message XOR pad, bit by bit
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          Each character becomes its byte, eight bits. Each bit is XORed with the pad bit under it:
          the result is 1 where the two differ and 0 where they match. So a pad bit of 1 flips the
          message bit, and a pad bit of 0 leaves it alone. The flipped bits are underlined. To
          decrypt, XOR the ciphertext with the same pad and every flip is undone.
        </p>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <table className="shrink-0 self-start border-collapse font-mono text-sm" aria-label="XOR truth table">
            <thead>
              <tr className="text-xs text-ink-subtle">
                <th className="px-2 font-medium">bit</th>
                <th className="px-2 font-medium">pad</th>
                <th className="px-2 font-medium">XOR</th>
              </tr>
            </thead>
            <tbody>
              {[
                [0, 0],
                [0, 1],
                [1, 0],
                [1, 1],
              ].map(([a, b]) => (
                <tr key={`${a}${b}`} className="text-center">
                  <td className="px-2">{a}</td>
                  <td className="px-2">{b}</td>
                  <td className="px-2 font-bold text-ink-strong">{(a ?? 0) ^ (b ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="cl-card min-w-0 flex-1 overflow-x-auto p-3">
            <table className="border-collapse font-mono text-sm">
              <caption className="sr-only">
                Each byte of the message, the pad byte, and their XOR, which is the ciphertext.
              </caption>
              <thead>
                <tr className="text-left text-xs text-ink-subtle">
                  <th scope="col" className="pr-3 font-medium">#</th>
                  <th scope="col" className="pr-3 font-medium">Char</th>
                  <th scope="col" className="pr-3 font-medium">{encrypting ? 'Message' : 'Ciphertext'}</th>
                  <th scope="col" className="pr-3 font-medium">Pad</th>
                  <th scope="col" className="pr-3 font-medium">{encrypting ? 'Ciphertext' : 'Message'}</th>
                  <th scope="col" className="font-medium">Hex out</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const active = row.position === safeCursor;
                  const inByte = row.encrypting ? row.plainByte : row.cipherByte;
                  const outByte = row.encrypting ? row.cipherByte : row.plainByte;
                  return (
                    <tr
                      key={row.position}
                      aria-current={active ? 'true' : undefined}
                      className={active ? 'bg-marker-wash text-ink-strong' : 'text-ink-muted'}
                    >
                      <td className="py-0.5 pr-3 text-xs">{row.position + 1}</td>
                      <td className="pr-3">{visible(row.char)}</td>
                      <td className="pr-3">{bits(inByte)}</td>
                      <td className="pr-3">{bits(row.padByte)}</td>
                      <td className="pr-3">
                        <Bits value={outByte} pad={row.padByte} mark={active} />
                      </td>
                      <td>{bytesToHex(Uint8Array.of(outByte))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="cl-prose text-sm text-ink-muted">{steps[current?.position ?? 0]?.detail}</p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="cl-button"
            onClick={() => setCursor((c) => Math.max(0, c - 1))}
            disabled={safeCursor === 0}
          >
            Previous byte
          </button>
          <button
            type="button"
            className="cl-button cl-button-primary"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="cl-button"
            onClick={() => setCursor((c) => Math.min(maxCursor, c + 1))}
            disabled={safeCursor >= maxCursor}
          >
            Next byte
          </button>
        </div>
        <label className="block">
          <span className="cl-label">
            Byte {safeCursor + 1} of {rows.length}
          </span>
          <input
            type="range"
            className="h-6 w-full accent-[var(--color-marker)]"
            min={0}
            max={maxCursor}
            value={safeCursor}
            onChange={(e) => {
              setPlaying(false);
              setCursor(Number(e.target.value));
            }}
          />
        </label>
      </section>

      <section aria-labelledby="vernam-reuse" className="flex flex-col gap-3">
        <h3 id="vernam-reuse" className="text-sm font-semibold text-ink-strong">
          The same pad twice
        </h3>
        <p className="cl-prose text-sm text-ink-muted">
          C1 = P1 XOR K and C2 = P2 XOR K, so C1 XOR C2 = P1 XOR P2. The pad cancels, and an attacker
          who never saw a bit of it holds the XOR of two messages.
        </p>
        <label className="flex flex-col gap-1">
          <span className="cl-label">A second message, encrypted with the same pad</span>
          <input
            type="text"
            className="cl-field font-mono"
            value={second}
            onChange={(e) => setSecond(e.target.value)}
            spellCheck={false}
          />
        </label>
        {reuse === null ? (
          <p className="text-sm text-ink-muted">
            The pad must cover the second message too, and both messages need at least one byte.
          </p>
        ) : (
          <>
          <dl className="flex flex-col gap-1 font-mono text-sm wrap-anywhere">
            <div className="flex flex-col sm:flex-row sm:gap-3">
              <dt className="shrink-0 text-ink-subtle sm:w-48">C2 (hex)</dt>
              <dd className="min-w-0">{reuse.c2}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-3">
              <dt className="shrink-0 text-ink-subtle sm:w-48">C1 XOR C2</dt>
              <dd className="min-w-0">{reuse.fromCiphertexts}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-3">
              <dt className="shrink-0 text-ink-subtle sm:w-48">P1 XOR P2</dt>
              <dd className="min-w-0">{reuse.fromPlaintexts}</dd>
            </div>
          </dl>
          <p role="status" className="text-sm text-ink">
            {matches
              ? 'The last two lines are identical. The pad is gone.'
              : 'The last two lines differ, which should not happen.'}
          </p>
          </>
        )}
      </section>
    </div>
  );
}
