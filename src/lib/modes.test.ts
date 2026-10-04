import { describe, expect, it } from 'vitest';
import { fromHex, toHex } from './format';
import { MODES, type Mode, increment, needsPadding, pad, runMode, unpad, usesBlockDecrypt } from './modes';
import { decryptBlock, encryptBlock, expandKey } from '../ciphers/modern/block/aes/aes';

const hex = (s: string) => fromHex(s.replace(/\s+/g, '')) ?? new Uint8Array();

/**
 * WebCrypto's types want a Uint8Array backed by a plain ArrayBuffer, and a
 * slice is the shortest honest way to give it one.
 */
const buf = (bytes: Uint8Array) => new Uint8Array(bytes).buffer;

/**
 * NIST SP 800-38A, Appendix F: the same four plaintext blocks under the same
 * AES-128 key, in each of the five modes. CFB is F.3.13 (CFB128), CTR is F.5.1.
 */
const KEY = hex('2b7e151628aed2a6abf7158809cf4f3c');
const IV = hex('000102030405060708090a0b0c0d0e0f');
const COUNTER = hex('f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff');
const PLAIN = hex(`
  6bc1bee22e409f96e93d7e117393172a ae2d8a571e03ac9c9eb76fac45af8e51
  30c81c46a35ce411e5fbc1191a0a52ef f69f2445df4f9b17ad2b417be66c3710`);

const VECTORS: Record<Mode, string> = {
  ECB: `3ad77bb40d7a3660a89ecaf32466ef97 f5d3d58503b9699de785895a96fdbaaf
        43b1cd7f598ece23881b00e3ed030688 7b0c785e27e8ad3f8223207104725dd4`,
  CBC: `7649abac8119b246cee98e9b12e9197d 5086cb9b507219ee95db113a917678b2
        73bed6b8e3c1743b7116e69e22229516 3ff1caa1681fac09120eca307586e1a7`,
  CFB: `3b3fd92eb72dad20333449f8e83cfb4a c8a64537a0b3a93fcde3cdad9f1ce58b
        26751f67a3cbb140b1808cf187a4f4df c04b05357c5d1c0eeac4c66f9ff7f2e6`,
  OFB: `3b3fd92eb72dad20333449f8e83cfb4a 7789508d16918f03f53c52dac54ed825
        9740051e9c5fecf64344f7a82260edcc 304c6528f659c77866a510d9c1d6ae5e`,
  CTR: `874d6191b620e3261bef6864990db6ce 9806f66b7970fdff8617187bb9fffdff
        5ae4df3edbd5d35e5b4f09020db03eab 1e031dda2fbe03d1792170a0f3009cee`,
};

const schedule = expandKey(KEY);
const options = (mode: Mode) => ({
  mode,
  iv: mode === 'CTR' ? COUNTER : IV,
  blockBytes: 16,
  encryptBlock: (b: Uint8Array) => encryptBlock(b, schedule),
  decryptBlock: (b: Uint8Array) => decryptBlock(b, schedule),
});

describe('runMode against NIST SP 800-38A', () => {
  it.each(MODES.map((m) => [m] as const))('%s encrypts the four F.x blocks exactly', (mode) => {
    const { out } = runMode(PLAIN, options(mode), 'encrypt');
    // ECB and CBC add a whole block of PKCS#7 padding that the NIST vectors do
    // not have, so compare the first four blocks.
    expect(toHex(out.slice(0, 64))).toBe(VECTORS[mode].replace(/\s+/g, ''));
    expect(out.length).toBe(needsPadding(mode) ? 80 : 64);
  });

  it.each(MODES.map((m) => [m] as const))('%s decrypts its own output back', (mode) => {
    const encrypted = runMode(PLAIN, options(mode), 'encrypt').out;
    const back = runMode(encrypted, options(mode), 'decrypt');
    expect(back.paddingOk).toBe(true);
    expect(toHex(back.out)).toBe(toHex(PLAIN));
  });
});

describe('runMode against WebCrypto', () => {
  it('agrees with AES-CTR, including a partial last block', async () => {
    const message = new TextEncoder().encode('Counter mode needs no padding at all, so 45 bytes.');
    const key = await crypto.subtle.importKey('raw', buf(KEY), 'AES-CTR', false, ['encrypt']);
    const reference = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-CTR', counter: buf(COUNTER), length: 128 }, key, buf(message)),
    );
    expect(toHex(runMode(message, options('CTR'), 'encrypt').out)).toBe(toHex(reference));
  });
});

describe('the shape of each mode', () => {
  it('runs the block cipher backwards only in ECB and CBC', () => {
    for (const mode of MODES) {
      const encrypted = runMode(PLAIN, options(mode), 'encrypt').out;
      const { blocks } = runMode(encrypted, options(mode), 'decrypt');
      const ran = new Set(blocks.map((b) => b.ran));
      expect([mode, [...ran]]).toEqual([mode, [usesBlockDecrypt(mode) ? 'decrypt' : 'encrypt']]);
    }
  });

  it('gives equal blocks equal ciphertext only in ECB', () => {
    const repeated = new Uint8Array(32).fill(0x41);
    for (const mode of MODES) {
      const out = toHex(runMode(repeated, options(mode), 'encrypt').out);
      expect([mode, out.slice(0, 32) === out.slice(32, 64)]).toEqual([mode, mode === 'ECB']);
    }
  });

  it('keeps a stream mode the same length as the message', () => {
    const odd = new Uint8Array(21).fill(7);
    for (const mode of ['CFB', 'OFB', 'CTR'] as const) {
      expect(runMode(odd, options(mode), 'encrypt').out.length).toBe(21);
    }
  });

  it('makes OFB and CTR keystreams independent of the message', () => {
    // Flip one ciphertext bit and exactly one plaintext bit flips: the
    // malleability the course table means by "no integrity protection".
    for (const mode of ['OFB', 'CTR'] as const) {
      const encrypted = runMode(PLAIN, options(mode), 'encrypt').out;
      encrypted[5] = (encrypted[5] ?? 0) ^ 1;
      const back = runMode(encrypted, options(mode), 'decrypt').out;
      const changed = [...back].filter((byte, i) => byte !== PLAIN[i]).length;
      expect([mode, changed]).toEqual([mode, 1]);
    }
  });

  it('lets a CFB bit error spread into the next block, as the lecture table says', () => {
    const encrypted = runMode(PLAIN, options('CFB'), 'encrypt').out;
    encrypted[5] = (encrypted[5] ?? 0) ^ 1;
    const back = runMode(encrypted, options('CFB'), 'decrypt').out;
    const wrongBlocks = [0, 1, 2, 3].filter(
      (b) => toHex(back.slice(b * 16, b * 16 + 16)) !== toHex(PLAIN.slice(b * 16, b * 16 + 16)),
    );
    expect(wrongBlocks).toEqual([0, 1]);
  });

  it('reports padding that does not check out instead of throwing', () => {
    const encrypted = runMode(PLAIN, options('CBC'), 'encrypt').out;
    const wrongIv = { ...options('CBC'), decryptBlock: (b: Uint8Array) => ({ out: b, trace: [] as never }) };
    expect(runMode(encrypted, wrongIv, 'decrypt').paddingOk).toBe(false);
  });
});

describe('helpers', () => {
  it('increments a counter with a carry, and wraps at the top', () => {
    expect(toHex(increment(hex('00ff')))).toBe('0100');
    expect(toHex(increment(hex('ffff')))).toBe('0000');
  });

  it('pads with PKCS#7 and undoes it', () => {
    for (const n of [0, 1, 7, 8, 15, 16, 17]) {
      const bytes = new Uint8Array(n).fill(3);
      expect(pad(bytes, 8).length % 8).toBe(0);
      expect(toHex(unpad(pad(bytes, 8), 8) ?? new Uint8Array([1]))).toBe(toHex(bytes));
    }
  });
});
