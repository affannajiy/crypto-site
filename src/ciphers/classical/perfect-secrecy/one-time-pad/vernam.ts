/**
 * The one-time pad as Vernam built it: XOR on bits.
 *
 * Gilbert Vernam's 1917 teleprinter cipher added a key tape to the message tape
 * one bit at a time, with XOR:
 *
 *     ciphertext bit = message bit XOR pad bit
 *
 * 0 XOR 0 = 0, 0 XOR 1 = 1, 1 XOR 0 = 1, 1 XOR 1 = 0. XOR is its own inverse,
 * so decrypting is the same operation with the same pad. This is the form the
 * lecture's stream-cipher notes describe, and the one Salsa20, ChaCha20, RC4 and
 * A5/1 copy with a computed keystream in place of the pad.
 *
 * Here the message is read as its UTF-8 bytes and the pad is random bytes,
 * written in hex. The letter form in `otp.ts` is the same idea with mod 26 in
 * place of XOR.
 *
 * Plain TypeScript. This file imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { bytesToHex, hexToBytes, utf8Bytes } from '../../../../lib/bytes';
import type { Direction } from './otp';

/** A byte as eight bits, the way the lecture writes binary. */
export function bits(byte: number): string {
  return byte.toString(2).padStart(8, '0');
}

interface Range {
  start: number;
  end: number;
}

/** For each UTF-8 byte of `text`, the character range it came from. */
function byteSources(text: string): Range[] {
  const encoder = new TextEncoder();
  const ranges: Range[] = [];
  let at = 0;
  for (const char of text) {
    const count = encoder.encode(char).length;
    for (let i = 0; i < count; i += 1) ranges.push({ start: at, end: at + char.length });
    at += char.length;
  }
  return ranges;
}

/** The pad bytes, or an error that says what is wrong with them. */
export function readHexPad(hexPad: string): Uint8Array {
  return hexToBytes(hexPad, 'hex pad');
}

/**
 * Refuses a pad shorter than the message, for the same reason as the letter
 * form: a pad that repeats is not a one-time pad.
 */
export function assertBytePadLongEnough(needed: number, pad: Uint8Array): void {
  if (pad.length >= needed) return;
  const short = needed - pad.length;
  throw new Error(
    `The hex pad is ${short} byte${short === 1 ? '' : 's'} too short. The message is ${needed} bytes and the pad has ${pad.length}. Repeating the pad would make it a repeating-key XOR, which is breakable, so the cipher stops instead.`,
  );
}

/** XOR of the message bytes with the first bytes of the pad. */
export function vernamBytes(message: Uint8Array, pad: Uint8Array): Uint8Array {
  assertBytePadLongEnough(message.length, pad);
  const out = new Uint8Array(message.length);
  for (let i = 0; i < message.length; i += 1) out[i] = (message[i] ?? 0) ^ (pad[i] ?? 0);
  return out;
}

/** Ciphertext hex to message bytes: the input as bytes, with a clear error. */
function readCiphertext(hex: string): Uint8Array {
  return hexToBytes(hex, 'ciphertext');
}

/**
 * The Vernam cipher, one step per byte.
 *
 * Encrypting, text goes in and hex comes out. Decrypting, hex goes in and the
 * text comes back.
 */
export function vernamTrace(text: string, hexPad: string, direction: Direction = 'encrypt'): TraceResult {
  const pad = readHexPad(hexPad);
  const encrypting = direction === 'encrypt';
  const input = encrypting ? utf8Bytes(text) : readCiphertext(text);
  const result = vernamBytes(input, pad);
  const output = encrypting ? bytesToHex(result) : new TextDecoder().decode(result);

  // Where each byte sits in the input box and in the output box.
  const textSide = byteSources(encrypting ? text : output);
  // Hex input may contain spaces; map each hex digit pair to its characters.
  const hexDigits: number[] = [];
  if (!encrypting) {
    for (let i = 0; i < text.length; i += 1) if (!/\s/.test(text.charAt(i))) hexDigits.push(i);
  }
  const hexRange = (b: number): Range =>
    encrypting
      ? { start: b * 2, end: b * 2 + 2 }
      : { start: hexDigits[b * 2] ?? 0, end: (hexDigits[b * 2 + 1] ?? 0) + 1 };

  const steps: Step[] = [];
  for (let b = 0; b < input.length; b += 1) {
    const inByte = input[b] ?? 0;
    const padByte = pad[b] ?? 0;
    const outByte = result[b] ?? 0;
    const plainByte = encrypting ? inByte : outByte;
    const cipherByte = encrypting ? outByte : inByte;
    const source = textSide[b] ?? { start: 0, end: 0 };
    const char = (encrypting ? text : output).slice(source.start, source.end);
    const multi = source.end - source.start > 0 && utf8Bytes(char).length > 1;

    steps.push({
      index: b,
      title: `Byte ${b + 1}: ${bits(inByte)} XOR ${bits(padByte)} = ${bits(outByte)}`,
      detail: encrypting
        ? `"${char}" is ${multi ? 'a character of several bytes; this one is ' : 'the byte '}${bits(plainByte)} (hex ${bytesToHex(Uint8Array.of(plainByte))}). Pad byte ${b + 1} is ${bits(padByte)}. XOR each bit: 1 where they differ, 0 where they match. The ciphertext byte is ${bits(cipherByte)}, hex ${bytesToHex(Uint8Array.of(cipherByte))}. This pad byte is now used up.`
        : `Ciphertext byte ${b + 1} is ${bits(cipherByte)}. XOR it with the same pad byte ${bits(padByte)} and the pad cancels: ${bits(plainByte)}, which is ${multi ? 'part of ' : ''}"${char}".`,
      input: encrypting ? char : bytesToHex(Uint8Array.of(cipherByte)),
      output: encrypting ? bytesToHex(Uint8Array.of(cipherByte)) : char,
      highlight: encrypting ? source : hexRange(b),
      outputHighlight: encrypting ? hexRange(b) : source,
      data: {
        vernam: true,
        position: b,
        char,
        plainByte,
        padByte,
        cipherByte,
        direction,
      },
    });
  }

  return { output, steps };
}

/** The ciphertext as hex, untraced. For the benchmark and the reuse demo. */
export function vernam(text: string, hexPad: string, direction: Direction = 'encrypt'): string {
  return vernamTrace(text, hexPad, direction).output;
}
