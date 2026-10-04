/**
 * A5/1 — the GSM voice cipher, about 1987. Reverse-engineered in 1999.
 *
 * Three linear feedback shift registers of 19, 22 and 23 bits, 64 bits of state
 * in all. Each register has a **clocking bit** near its middle. On every step,
 * the three clocking bits vote, and only the registers that agree with the
 * majority move. The output bit is the XOR of the three top bits.
 *
 *     R1: 19 bits, taps 18 17 16 13, clocking bit 8
 *     R2: 22 bits, taps 21 20,       clocking bit 10
 *     R3: 23 bits, taps 22 21 20 7,  clocking bit 10
 *
 * Setting up a frame:
 *
 *   1. Zero all three registers.
 *   2. For each of the 64 key bits: clock all three, then XOR the bit into bit 0
 *      of each.
 *   3. The same for the 22 bits of the frame number.
 *   4. Clock 100 times with the majority rule, and throw the output away.
 *   5. Clock 228 times with the majority rule: 114 bits for the phone-to-network
 *      burst, then 114 for the network-to-phone burst.
 *
 * This follows the reference code of Briceno, Goldberg and Wagner (1999) bit for
 * bit, including the order in which key and keystream bits are read and written,
 * and the test reproduces its published output.
 *
 * **Do not use this for anything.** A5/1 has been broken in real time since 2009.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import { fromHex, toHex } from '../../../../lib/format';

export type Direction = 'encrypt' | 'decrypt';

export interface RegisterSpec {
  name: string;
  length: number;
  taps: number[];
  clockBit: number;
}

export const REGISTERS: readonly RegisterSpec[] = [
  { name: 'R1', length: 19, taps: [18, 17, 16, 13], clockBit: 8 },
  { name: 'R2', length: 22, taps: [21, 20], clockBit: 10 },
  { name: 'R3', length: 23, taps: [22, 21, 20, 7], clockBit: 10 },
];

/** Bits per burst. One GSM frame carries 114 bits each way. */
export const BURST_BITS = 114;
export const FRAME_MAX = (1 << 22) - 1;

const bit = (reg: number, at: number) => (reg >>> at) & 1;

/** Shifts one register left by one, feeding back the XOR of its taps. */
export function clockOne(reg: number, spec: RegisterSpec): number {
  let feedback = 0;
  for (const tap of spec.taps) feedback ^= bit(reg, tap);
  const mask = (1 << spec.length) - 1;
  return ((reg << 1) & mask) | feedback;
}

export type State = [number, number, number];

export function majority(state: State): number {
  const votes = REGISTERS.reduce((sum, spec, r) => sum + bit(state[r] ?? 0, spec.clockBit), 0);
  return votes >= 2 ? 1 : 0;
}

/** Clocks the registers whose clocking bit agrees with the majority. Returns which moved. */
export function clockMajority(state: State): { next: State; moved: [boolean, boolean, boolean]; vote: number } {
  const vote = majority(state);
  const moved = REGISTERS.map((spec, r) => bit(state[r] ?? 0, spec.clockBit) === vote) as [boolean, boolean, boolean];
  const next = state.map((reg, r) => {
    const spec = REGISTERS[r];
    return moved[r] === true && spec !== undefined ? clockOne(reg, spec) : reg;
  }) as State;
  return { next, moved, vote };
}

export function clockAll(state: State): State {
  return state.map((reg, r) => {
    const spec = REGISTERS[r];
    return spec === undefined ? reg : clockOne(reg, spec);
  }) as State;
}

/** The output bit: the XOR of the top bit of each register. */
export function outputBit(state: State): number {
  return REGISTERS.reduce((x, spec, r) => x ^ bit(state[r] ?? 0, spec.length - 1), 0);
}

/** Steps 1 to 4: load key and frame, then mix for 100 clocks. */
export function setup(key: Uint8Array, frame: number): { state: State; afterKey: State; afterFrame: State } {
  let state: State = [0, 0, 0];
  for (let i = 0; i < 64; i += 1) {
    state = clockAll(state);
    const k = ((key[i >> 3] ?? 0) >> (i & 7)) & 1;
    state = state.map((reg) => reg ^ k) as State;
  }
  const afterKey = state;
  for (let i = 0; i < 22; i += 1) {
    state = clockAll(state);
    const f = (frame >>> i) & 1;
    state = state.map((reg) => reg ^ f) as State;
  }
  const afterFrame = state;
  for (let i = 0; i < 100; i += 1) state = clockMajority(state).next;
  return { state, afterKey, afterFrame };
}

/** One output clock, recorded for the visualizer. */
export interface ClockTrace {
  before: State;
  after: State;
  moved: [boolean, boolean, boolean];
  vote: number;
  out: number;
}

/**
 * The two 114-bit bursts for one frame, packed the way the reference code packs
 * them: bit i goes to byte i / 8, most significant bit first.
 */
export function bursts(key: Uint8Array, frame: number, record = 0): { aToB: Uint8Array; bToA: Uint8Array; clocks: ClockTrace[] } {
  let { state } = setup(key, frame);
  const aToB = new Uint8Array(15);
  const bToA = new Uint8Array(15);
  const clocks: ClockTrace[] = [];
  for (let i = 0; i < BURST_BITS * 2; i += 1) {
    const before = state;
    const { next, moved, vote } = clockMajority(state);
    state = next;
    const out = outputBit(state);
    if (i < record) clocks.push({ before, after: state, moved, vote, out });
    const target = i < BURST_BITS ? aToB : bToA;
    const n = i % BURST_BITS;
    target[n >> 3] = (target[n >> 3] ?? 0) | (out << (7 - (n & 7)));
  }
  return { aToB, bToA, clocks };
}

export function readKey(hex: string): Uint8Array {
  const bytes = fromHex(hex.replace(/\s+/g, ''));
  if (bytes === null || bytes.length !== 8) {
    throw new Error('The A5/1 session key Kc is 64 bits: exactly 16 hex digits.');
  }
  return bytes;
}

export function readFrame(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > FRAME_MAX) {
    throw new Error(`The frame number is 22 bits: a whole number from 0 to ${FRAME_MAX}.`);
  }
  return value;
}

/**
 * Keystream for a message of any length.
 *
 * A message longer than one burst uses the next frame numbers, the way a call
 * uses one frame after another. Only the phone-to-network burst is used, so the
 * page encrypts in one direction.
 */
export function keystream(key: Uint8Array, frame: number, length: number): { bytes: Uint8Array; frames: number } {
  const out: number[] = [];
  let f = frame;
  let frames = 0;
  // 114 bits is 14 whole bytes and 2 spare bits; the spare bits are dropped.
  while (out.length < length) {
    out.push(...bursts(key, f & FRAME_MAX).aToB.slice(0, 14));
    f += 1;
    frames += 1;
  }
  return { bytes: new Uint8Array(out.slice(0, length)), frames };
}

function messageBytes(text: string, direction: Direction): Uint8Array {
  if (direction === 'encrypt') return new TextEncoder().encode(text);
  const bytes = fromHex(text.replace(/\s+/g, ''));
  if (bytes === null) throw new Error('An A5/1 ciphertext is hexadecimal, two digits per byte.');
  return bytes;
}

export interface Options {
  key: Uint8Array;
  frame: number;
}

export function a51(text: string, options: Options, direction: Direction): string {
  const input = messageBytes(text, direction);
  const { bytes } = keystream(options.key, options.frame, input.length);
  const out = input.map((b, i) => b ^ (bytes[i] ?? 0));
  return direction === 'encrypt' ? toHex(out) : new TextDecoder().decode(out);
}

const regBits = (reg: number, length: number) => reg.toString(2).padStart(length, '0');

/** How many output clocks the visualizer can step through. */
export const RECORDED_CLOCKS = 48;

/**
 * The cipher again: a step for the setup, a step per frame of 14 bytes, and the
 * first clocks recorded in full for the visualizer.
 */
export function a51Trace(text: string, options: Options, direction: Direction): TraceResult {
  const input = messageBytes(text, direction);
  const { afterKey, afterFrame, state } = setup(options.key, options.frame);
  const { clocks } = bursts(options.key, options.frame, RECORDED_CLOCKS);
  const show = (s: State) => s.map((reg, r) => regBits(reg, REGISTERS[r]?.length ?? 0));
  const steps: Step[] = [
    {
      index: 0,
      title: `Set up frame ${options.frame}`,
      detail: `All three registers start at zero. The 64 bits of the key are clocked in one at a time, every register moving each time, then the 22 bits of the frame number the same way. Then 100 clocks under the majority rule mix the state, and their output is thrown away. Only then does the keystream begin.`,
      data: {
        isA51: true,
        afterKey: show(afterKey),
        afterFrame: show(afterFrame),
        afterMix: show(state),
        clocks: clocks.map((c) => ({
          before: show(c.before),
          after: show(c.after),
          moved: c.moved,
          vote: c.vote,
          out: c.out,
        })),
      },
    },
  ];

  const out = new Uint8Array(input.length);
  for (let start = 0, f = 0; start < input.length || (start === 0 && input.length === 0); start += 14, f += 1) {
    const frame = (options.frame + f) & FRAME_MAX;
    const stream = bursts(options.key, frame).aToB.slice(0, 14);
    const slice = input.slice(start, start + 14);
    const result = slice.map((b, i) => b ^ (stream[i] ?? 0));
    out.set(result, start);
    steps.push({
      index: steps.length,
      title: `Frame ${frame}: ${slice.length} bytes`,
      detail: `A fresh setup with frame number ${frame}, then 114 keystream bits: ${toHex(stream).slice(0, slice.length * 2)}. The first ${slice.length * 8} of them are XORed into this part of the message.`,
      output: toHex(result),
      highlight: { start: direction === 'encrypt' ? start : start * 2, end: direction === 'encrypt' ? start + slice.length : (start + slice.length) * 2 },
      outputHighlight: direction === 'encrypt' ? { start: start * 2, end: (start + slice.length) * 2 } : { start, end: start + slice.length },
      data: { isFrame: true, frame, keystream: toHex(stream) },
    });
    if (input.length === 0) break;
  }

  return { output: direction === 'encrypt' ? toHex(out) : new TextDecoder().decode(out), steps };
}
