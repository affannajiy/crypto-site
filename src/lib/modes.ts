/**
 * Block cipher modes of operation, NIST SP 800-38A.
 *
 * A block cipher encrypts exactly one block. A **mode** says how to use that one
 * operation on a message of any length. The course names five, and all five are
 * here, for any block cipher: AES, DES and Triple DES all run through this file.
 *
 *   ECB  each block encrypted alone. Equal blocks give equal ciphertext.
 *   CBC  XOR each block with the previous ciphertext, then encrypt.
 *   CFB  encrypt the previous ciphertext, and XOR the result into the plaintext.
 *   OFB  encrypt the previous *output*, over and over, and XOR that stream in.
 *   CTR  encrypt a counter, and XOR that stream in.
 *
 * The last three turn a block cipher into a **stream cipher**. They never run the
 * block cipher backwards, not even to decrypt, and they need no padding. ECB and
 * CBC need both.
 *
 * CFB here is full-block CFB (CFB-128 for AES, CFB-64 for DES). That is the
 * variant whose NIST vectors the tests check.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */

export type Mode = 'ECB' | 'CBC' | 'CFB' | 'OFB' | 'CTR';
export type Direction = 'encrypt' | 'decrypt';

export const MODES: readonly Mode[] = ['ECB', 'CBC', 'CFB', 'OFB', 'CTR'];

/** The labels every block cipher's mode select uses, so they read the same everywhere. */
export const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'ECB', label: 'ECB — each block alone' },
  { value: 'CBC', label: 'CBC — each block chained to the last' },
  { value: 'CFB', label: 'CFB — cipher feedback, a self-synchronising stream' },
  { value: 'OFB', label: 'OFB — output feedback, a keystream from the IV' },
  { value: 'CTR', label: 'CTR — counter, a keystream from IV, IV+1, …' },
];

/**
 * The lecture's table of modes: strength, weakness and where each is used.
 * The mode diagram and the Playground both read it, so they cannot drift apart.
 */
export const MODE_SUMMARY: Record<Mode, { title: string; strength: string; weakness: string; uses: string }> = {
  ECB: {
    title: 'ECB — Electronic Codebook',
    strength: 'Simple, and every block can be done in parallel.',
    weakness: 'Identical plaintext blocks give identical ciphertext blocks, so patterns show through.',
    uses: 'Legacy systems. Only safe for one block of random data.',
  },
  CBC: {
    title: 'CBC — Cipher Block Chaining',
    strength: 'Each ciphertext block depends on every plaintext block before it.',
    weakness: 'Encryption is sequential, so slower. No integrity, and padding errors can leak.',
    uses: 'TLS (older versions), BitLocker, FileVault, VPNs.',
  },
  CFB: {
    title: 'CFB — Cipher Feedback',
    strength: 'Encrypts a stream as it arrives, and resynchronises one block after an error.',
    weakness: 'A bit error garbles the rest of its block and the whole of the next one.',
    uses: 'Secure voice, virtual machine disk encryption.',
  },
  OFB: {
    title: 'OFB — Output Feedback',
    strength: 'The keystream never sees the message, so it can be computed ahead of time.',
    weakness: 'No integrity: flip one ciphertext bit and exactly that plaintext bit flips.',
    uses: 'Noisy or unreliable channels, remote access systems.',
  },
  CTR: {
    title: 'CTR — Counter',
    strength: 'Fast, and every block is independent, so it runs in parallel both ways.',
    weakness: 'No integrity, and a counter value must never repeat under one key.',
    uses: 'SSD encryption, network protocols, and inside AES-GCM.',
  },
};

export function readMode(value: unknown, fallback: Mode = 'CBC'): Mode {
  const text = String(value ?? '').toUpperCase();
  return (MODES as readonly string[]).includes(text) ? (text as Mode) : fallback;
}

/** ECB and CBC feed the message itself into the block cipher, so it must fill whole blocks. */
export function needsPadding(mode: Mode): boolean {
  return mode === 'ECB' || mode === 'CBC';
}

/** Only ECB and CBC ever run the block cipher backwards. */
export function usesBlockDecrypt(mode: Mode): boolean {
  return needsPadding(mode);
}

export function usesIv(mode: Mode): boolean {
  return mode !== 'ECB';
}

/** PKCS#7: pad to a whole block, always adding at least one byte. */
export function pad(bytes: Uint8Array, blockBytes: number): Uint8Array {
  const extra = blockBytes - (bytes.length % blockBytes);
  const out = new Uint8Array(bytes.length + extra);
  out.set(bytes);
  out.fill(extra, bytes.length);
  return out;
}

/** Removes PKCS#7 padding, or returns null when it is not valid. */
export function unpad(bytes: Uint8Array, blockBytes: number): Uint8Array | null {
  if (bytes.length === 0 || bytes.length % blockBytes !== 0) return null;
  const extra = bytes[bytes.length - 1] ?? 0;
  if (extra < 1 || extra > blockBytes || extra > bytes.length) return null;
  for (let i = bytes.length - extra; i < bytes.length; i += 1) {
    if (bytes[i] !== extra) return null;
  }
  return bytes.slice(0, bytes.length - extra);
}

export function blocksOf(bytes: Uint8Array, blockBytes: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += blockBytes) out.push(bytes.slice(i, i + blockBytes));
  return out;
}

/** XOR over the shorter of the two, which is what a final partial stream block needs. */
export function xorShort(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.min(a.length, b.length));
  for (let i = 0; i < out.length; i += 1) out[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
  return out;
}

/** Adds one to a block read as a big-endian integer, wrapping at the top. */
export function increment(counter: Uint8Array): Uint8Array {
  const out = counter.slice();
  for (let i = out.length - 1; i >= 0; i -= 1) {
    out[i] = ((out[i] ?? 0) + 1) & 0xff;
    if (out[i] !== 0) break;
  }
  return out;
}

/** One block cipher call, and whatever trace the cipher wants to keep of it. */
export type BlockFn<T> = (block: Uint8Array) => { out: Uint8Array; trace: T };

export interface ModeOptions<T> {
  mode: Mode;
  iv: Uint8Array;
  blockBytes: number;
  encryptBlock: BlockFn<T>;
  decryptBlock: BlockFn<T>;
  /**
   * False to skip PKCS#7 in ECB and CBC, for raw test vectors that are already
   * whole blocks. Defaults to true. The stream modes never pad.
   */
  pad?: boolean;
}

/** What happened to one block, in enough detail to draw the mode diagram. */
export interface ModeBlock<T> {
  index: number;
  /** The block of the message this step read: plaintext to encrypt, ciphertext to decrypt. */
  source: Uint8Array;
  /** What went into the block cipher. */
  cipherIn: Uint8Array;
  /** What came out of it. */
  cipherOut: Uint8Array;
  /** Which way the block cipher ran. Stream modes always encrypt. */
  ran: Direction;
  /** The block XORed in, and whether before or after the block cipher. Null for ECB. */
  xorWith: Uint8Array | null;
  xorStage: 'before' | 'after' | null;
  /** The block this step produced. */
  result: Uint8Array;
  trace: T;
}

export interface ModeRun<T> {
  /** The whole output. Padding is added when encrypting and checked when decrypting. */
  out: Uint8Array;
  /** False when decryption found broken padding: almost always a wrong key, IV or mode. */
  paddingOk: boolean;
  blocks: ModeBlock<T>[];
}

/**
 * Runs a block cipher over a whole message in one of the five modes.
 *
 * Encrypting pads first for ECB and CBC. Decrypting strips that padding again and
 * reports when it is not valid. The caller decides what to tell the reader.
 */
export function runMode<T>(data: Uint8Array, options: ModeOptions<T>, direction: Direction): ModeRun<T> {
  const { mode, iv, blockBytes, encryptBlock, decryptBlock } = options;
  const padded = needsPadding(mode) && options.pad !== false;
  const input = padded && direction === 'encrypt' ? pad(data, blockBytes) : data;
  if (needsPadding(mode) && input.length % blockBytes !== 0) {
    throw new Error(`${mode} works on whole blocks of ${blockBytes} bytes.`);
  }

  const blocks: ModeBlock<T>[] = [];
  const output = new Uint8Array(input.length);
  // The feedback register: the previous ciphertext (CBC, CFB), the previous
  // keystream block (OFB), or the counter (CTR). It starts as the IV in all four.
  let register: Uint8Array = iv.slice();

  blocksOf(input, blockBytes).forEach((source, index) => {
    let cipherIn: Uint8Array;
    let ran: Direction = 'encrypt';
    let xorWith: Uint8Array | null = null;
    let xorStage: ModeBlock<T>['xorStage'] = null;
    let call: { out: Uint8Array; trace: T };
    let result: Uint8Array;

    if (mode === 'ECB') {
      ran = direction;
      cipherIn = source;
      call = (direction === 'encrypt' ? encryptBlock : decryptBlock)(source);
      result = call.out;
    } else if (mode === 'CBC') {
      xorWith = register;
      if (direction === 'encrypt') {
        xorStage = 'before';
        cipherIn = xorShort(source, register);
        call = encryptBlock(cipherIn);
        result = call.out;
        register = result;
      } else {
        xorStage = 'after';
        ran = 'decrypt';
        cipherIn = source;
        call = decryptBlock(source);
        result = xorShort(call.out, register);
        register = source;
      }
    } else {
      // CFB, OFB and CTR: the block cipher only ever makes keystream.
      cipherIn = register;
      call = encryptBlock(register);
      xorWith = call.out;
      xorStage = 'after';
      result = xorShort(source, call.out);
      if (mode === 'CFB') register = direction === 'encrypt' ? result : source;
      else if (mode === 'OFB') register = call.out;
      else register = increment(register);
    }

    output.set(result, index * blockBytes);
    blocks.push({
      index,
      source,
      cipherIn,
      cipherOut: call.out,
      ran,
      xorWith,
      xorStage,
      result,
      trace: call.trace,
    });
  });

  if (padded && direction === 'decrypt') {
    const stripped = unpad(output, blockBytes);
    return { out: stripped ?? output, paddingOk: stripped !== null, blocks };
  }
  return { out: output, paddingOk: true, blocks };
}
