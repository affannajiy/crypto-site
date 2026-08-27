import { describe, expect, it } from 'vitest';
import {
  BLOCK_BYTES,
  INV_SBOX,
  SBOX,
  addRoundKey,
  aes,
  aesTrace,
  blocksOf,
  decryptBlock,
  encryptBlock,
  expandKey,
  gmul,
  mixColumns,
  pad,
  readIv,
  readKey,
  roundsFor,
  shiftRows,
  subBytes,
  unpad,
  xtime,
} from './aes';
import { fromHex, toHex } from '../../../../lib/format';
import aesCipher from './index';

const hex = (s: string) => fromHex(s) ?? new Uint8Array();

/**
 * WebCrypto's types want a Uint8Array backed by a plain ArrayBuffer, and a
 * Uint8Array built from a slice is typed as backed by ArrayBufferLike. Copying
 * into a fresh buffer is the honest fix; a cast would hide a real distinction.
 */
function buf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

describe('the field', () => {
  it('multiplies by x with the Rijndael reduction', () => {
    expect(xtime(0x01)).toBe(0x02);
    expect(xtime(0x80)).toBe(0x1b);
    expect(xtime(0x57)).toBe(0xae);
  });

  it('multiplies two field elements', () => {
    // The example from the AES specification: 0x57 * 0x13 = 0xfe.
    expect(gmul(0x57, 0x13)).toBe(0xfe);
    expect(gmul(0x57, 0x83)).toBe(0xc1);
    expect(gmul(0x00, 0xff)).toBe(0);
    expect(gmul(0x01, 0xab)).toBe(0xab);
  });
});

describe('the S-box', () => {
  it('matches the published table at its landmark entries', () => {
    expect(SBOX[0x00]).toBe(0x63);
    expect(SBOX[0x01]).toBe(0x7c);
    expect(SBOX[0x53]).toBe(0xed);
    expect(SBOX[0xff]).toBe(0x16);
  });

  it('is a permutation of all 256 bytes', () => {
    expect(new Set(SBOX).size).toBe(256);
  });

  it('inverts exactly', () => {
    for (let i = 0; i < 256; i += 1) {
      expect(INV_SBOX[SBOX[i] ?? 0]).toBe(i);
    }
  });

  it('has no fixed point, which is what the affine step is for', () => {
    // The multiplicative inverse alone fixes 0 and 1. The affine transform after
    // it removes every fixed point, so no byte survives SubBytes unchanged.
    for (let i = 0; i < 256; i += 1) {
      expect(SBOX[i]).not.toBe(i);
    }
  });
});

describe('the round steps', () => {
  it('rotates each row by its own index', () => {
    // State is column-major: index = row + 4 * column.
    const state = new Uint8Array(16).map((_, i) => i);
    const shifted = shiftRows(state);
    expect(shifted[0]).toBe(0); // row 0 does not move
    expect(shifted[1]).toBe(5); // row 1 takes from column 1
    expect(shifted[2]).toBe(10);
    expect(shifted[3]).toBe(15);
  });

  it('undoes ShiftRows exactly', () => {
    const state = new Uint8Array(16).map((_, i) => i * 7);
    expect([...shiftRows(shiftRows(state), true)]).toEqual([...state]);
  });

  it('undoes MixColumns exactly', () => {
    const state = new Uint8Array(16).map((_, i) => (i * 31 + 7) & 0xff);
    expect([...mixColumns(mixColumns(state), true)]).toEqual([...state]);
  });

  it('mixes a column so every output depends on all four inputs', () => {
    // Diffusion, measured: changing one byte of a column must move more than one
    // byte of that column, which is exactly what Hill's 2x2 could not guarantee.
    const a = new Uint8Array(16);
    const b = new Uint8Array(16);
    b[0] = 1;
    const mixedA = mixColumns(a);
    const mixedB = mixColumns(b);
    let moved = 0;
    for (let i = 0; i < 4; i += 1) {
      if (mixedA[i] !== mixedB[i]) moved += 1;
    }
    expect(moved).toBe(4);
  });

  it('undoes SubBytes and AddRoundKey', () => {
    const state = new Uint8Array(16).map((_, i) => (i * 13) & 0xff);
    const key = new Uint8Array(16).map((_, i) => (i * 29) & 0xff);
    expect([...subBytes(subBytes(state), INV_SBOX)]).toEqual([...state]);
    expect([...addRoundKey(addRoundKey(state, key), key)]).toEqual([...state]);
  });
});

describe('the key schedule', () => {
  it('gives 11, 13 or 15 round keys', () => {
    expect(roundsFor(16)).toBe(10);
    expect(roundsFor(24)).toBe(12);
    expect(roundsFor(32)).toBe(14);
    expect(expandKey(new Uint8Array(16))).toHaveLength(11);
    expect(expandKey(new Uint8Array(24))).toHaveLength(13);
    expect(expandKey(new Uint8Array(32))).toHaveLength(15);
  });

  it('starts with the key itself', () => {
    const key = hex('000102030405060708090a0b0c0d0e0f');
    expect(toHex(expandKey(key)[0] ?? new Uint8Array())).toBe('000102030405060708090a0b0c0d0e0f');
  });

  it('matches the published schedule for the all-zero 128-bit key', () => {
    // FIPS-197 Appendix A worked example, round key 10.
    const schedule = expandKey(new Uint8Array(16));
    expect(toHex(schedule[10] ?? new Uint8Array())).toBe('b4ef5bcb3e92e21123e951cf6f8f188e');
  });
});

describe('the FIPS-197 test vectors', () => {
  const plaintext = hex('00112233445566778899aabbccddeeff');

  it('encrypts the 128-bit vector', () => {
    const schedule = expandKey(hex('000102030405060708090a0b0c0d0e0f'));
    expect(toHex(encryptBlock(plaintext, schedule).out)).toBe('69c4e0d86a7b0430d8cdb78070b4c55a');
  });

  it('encrypts the 192-bit vector', () => {
    const schedule = expandKey(hex('000102030405060708090a0b0c0d0e0f1011121314151617'));
    expect(toHex(encryptBlock(plaintext, schedule).out)).toBe('dda97ca4864cdfe06eaf70a0ec0d7191');
  });

  it('encrypts the 256-bit vector', () => {
    const schedule = expandKey(hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'));
    expect(toHex(encryptBlock(plaintext, schedule).out)).toBe('8ea2b7ca516745bfeafc49904b496089');
  });

  it('decrypts every vector back', () => {
    for (const key of [
      '000102030405060708090a0b0c0d0e0f',
      '000102030405060708090a0b0c0d0e0f1011121314151617',
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    ]) {
      const schedule = expandKey(hex(key));
      const cipher = encryptBlock(plaintext, schedule).out;
      expect(toHex(decryptBlock(cipher, schedule).out)).toBe(toHex(plaintext));
    }
  });

  it('records one trace entry per round plus the initial AddRoundKey', () => {
    const schedule = expandKey(hex('000102030405060708090a0b0c0d0e0f'));
    const { trace } = encryptBlock(plaintext, schedule);
    expect(trace).toHaveLength(11);
    expect(trace[0]?.kind).toBe('initial');
    expect(trace[10]?.kind).toBe('final');
    // The final round has no MixColumns. Not an oversight: it is what makes
    // decryption the same shape as encryption.
    expect(trace[10]?.afterMix).toBeUndefined();
    expect(trace[5]?.afterMix).toBeDefined();
  });
});

describe('against the browser', () => {
  // The reason this file is allowed to hand-write AES at all. If these ever
  // disagree, the trace on screen is showing something that is not AES.
  it('agrees with WebCrypto for AES-128-CBC', async () => {
    const keyBytes = hex('000102030405060708090a0b0c0d0e0f');
    const iv = hex('0f0e0d0c0b0a09080706050403020100');
    const text = 'The middle of the algorithm is the whole point of this site.';

    const key = await crypto.subtle.importKey('raw', buf(keyBytes), 'AES-CBC', false, ['encrypt']);
    const reference = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-CBC', iv: buf(iv) }, key, buf(new TextEncoder().encode(text))),
    );

    expect(aes(text, { key: keyBytes, mode: 'CBC', iv }, 'encrypt')).toBe(toHex(reference));
  });

  it('agrees with WebCrypto for AES-256-CBC', async () => {
    const keyBytes = hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
    const iv = hex('00000000000000000000000000000000');
    const text = 'Checked block for block against the browser.';

    const key = await crypto.subtle.importKey('raw', buf(keyBytes), 'AES-CBC', false, ['encrypt']);
    const reference = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-CBC', iv: buf(iv) }, key, buf(new TextEncoder().encode(text))),
    );

    expect(aes(text, { key: keyBytes, mode: 'CBC', iv }, 'encrypt')).toBe(toHex(reference));
  });
});

describe('padding', () => {
  it('always adds at least one byte', () => {
    expect(pad(new Uint8Array(16))).toHaveLength(32);
    expect(pad(new Uint8Array(0))).toHaveLength(16);
    expect(pad(new Uint8Array(3))).toHaveLength(16);
  });

  it('fills with the number of bytes added', () => {
    const padded = pad(new Uint8Array(14));
    expect(padded[14]).toBe(2);
    expect(padded[15]).toBe(2);
  });

  it('round-trips', () => {
    for (const n of [0, 1, 15, 16, 17, 100]) {
      const bytes = new Uint8Array(n).map((_, i) => i & 0xff);
      expect([...(unpad(pad(bytes)) ?? [])]).toEqual([...bytes]);
    }
  });

  it('rejects padding that is not valid', () => {
    const bad = new Uint8Array(16).fill(0);
    bad[15] = 5;
    expect(unpad(bad)).toBeNull();
    expect(unpad(new Uint8Array(0))).toBeNull();
    expect(unpad(new Uint8Array(7))).toBeNull();
  });
});

describe('modes', () => {
  const key = hex('000102030405060708090a0b0c0d0e0f');
  const iv = hex('0f0e0d0c0b0a09080706050403020100');

  it('round-trips through ECB and CBC', () => {
    const text = 'Meet me at the old bridge at midnight.';
    for (const mode of ['ECB', 'CBC'] as const) {
      const encrypted = aes(text, { key, mode, iv }, 'encrypt');
      expect(aes(encrypted, { key, mode, iv }, 'decrypt')).toBe(text);
    }
  });

  it('gives identical plaintext blocks identical ciphertext in ECB — the penguin', () => {
    // Sixteen identical bytes twice over. In ECB the two ciphertext blocks match,
    // which is the entire reason an ECB-encrypted image still shows the picture.
    const text = 'AAAAAAAAAAAAAAAA' + 'AAAAAAAAAAAAAAAA';
    const out = aes(text, { key, mode: 'ECB', iv }, 'encrypt');
    expect(out.slice(0, 32)).toBe(out.slice(32, 64));
  });

  it('does not, in CBC', () => {
    const text = 'AAAAAAAAAAAAAAAA' + 'AAAAAAAAAAAAAAAA';
    const out = aes(text, { key, mode: 'CBC', iv }, 'encrypt');
    expect(out.slice(0, 32)).not.toBe(out.slice(32, 64));
  });

  it('gives a different ciphertext for every IV in CBC', () => {
    const text = 'Attack at dawn';
    const a = aes(text, { key, mode: 'CBC', iv }, 'encrypt');
    const b = aes(text, { key, mode: 'CBC', iv: new Uint8Array(16) }, 'encrypt');
    expect(a).not.toBe(b);
  });

  it('ignores the IV in ECB, which is why ECB has no way to vary its output', () => {
    const text = 'Attack at dawn';
    expect(aes(text, { key, mode: 'ECB', iv }, 'encrypt')).toBe(
      aes(text, { key, mode: 'ECB', iv: new Uint8Array(16) }, 'encrypt'),
    );
  });

  it('avalanches: one bit of plaintext changes about half the ciphertext bits', () => {
    const a = fromHex(aes('AAAAAAAAAAAAAAAA', { key, mode: 'ECB', iv }, 'encrypt')) ?? new Uint8Array();
    const b = fromHex(aes('BAAAAAAAAAAAAAAA', { key, mode: 'ECB', iv }, 'encrypt')) ?? new Uint8Array();
    let bits = 0;
    for (let i = 0; i < BLOCK_BYTES; i += 1) {
      let diff = (a[i] ?? 0) ^ (b[i] ?? 0);
      while (diff !== 0) {
        bits += diff & 1;
        diff >>= 1;
      }
    }
    // 128 bits, so about 64. Anything between 45 and 83 is comfortably normal.
    expect(bits).toBeGreaterThan(45);
    expect(bits).toBeLessThan(83);
  });

  it('handles multi-byte characters', () => {
    const text = 'Café — naïve — 日本語';
    const encrypted = aes(text, { key, mode: 'CBC', iv }, 'encrypt');
    expect(aes(encrypted, { key, mode: 'CBC', iv }, 'decrypt')).toBe(text);
  });
});

describe('reading the key', () => {
  it('accepts 128, 192 and 256 bits', () => {
    expect(readKey('000102030405060708090a0b0c0d0e0f')).toHaveLength(16);
    expect(readKey('00'.repeat(24))).toHaveLength(24);
    expect(readKey('00'.repeat(32))).toHaveLength(32);
  });

  it('ignores spacing', () => {
    expect(readKey('0001 0203 0405 0607 0809 0a0b 0c0d 0e0f')).toHaveLength(16);
  });

  it('says clearly what is wrong with a bad key', () => {
    expect(() => readKey('zz')).toThrow(/hexadecimal/);
    expect(() => readKey('0011')).toThrow(/128, 192 or 256 bits/);
  });

  it('defaults the IV to zeros and rejects a wrong-sized one', () => {
    expect(readIv('')).toHaveLength(16);
    expect(() => readIv('00')).toThrow(/32 hex digits/);
  });
});

describe('aesTrace', () => {
  const key = hex('000102030405060708090a0b0c0d0e0f');
  const iv = hex('0f0e0d0c0b0a09080706050403020100');

  it('agrees with the untraced cipher', () => {
    const text = 'Meet me at dawn';
    for (const mode of ['ECB', 'CBC'] as const) {
      expect(aesTrace(text, { key, mode, iv }, 'encrypt').output).toBe(
        aes(text, { key, mode, iv }, 'encrypt'),
      );
    }
  });

  it('emits one step per block', () => {
    // 40 characters is three blocks once padded.
    const text = 'A'.repeat(40);
    const { steps } = aesTrace(text, { key, mode: 'CBC', iv }, 'encrypt');
    expect(steps).toHaveLength(3);
    expect(blocksOf(pad(new TextEncoder().encode(text)))).toHaveLength(3);
  });

  it('carries every round state for the visualizer', () => {
    const { steps } = aesTrace('hello', { key, mode: 'CBC', iv }, 'encrypt');
    const trace = steps[0]?.data?.['trace'] as { round: number }[];
    expect(trace).toHaveLength(11);
  });

  it('points each step at the characters and hex digits it used', () => {
    const { steps } = aesTrace('A'.repeat(32), { key, mode: 'ECB', iv }, 'encrypt');
    expect(steps[0]?.highlight).toEqual({ start: 0, end: 16 });
    expect(steps[1]?.outputHighlight).toEqual({ start: 32, end: 64 });
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const params = {
      key: '000102030405060708090a0b0c0d0e0f',
      mode: 'CBC',
      iv: '0f0e0d0c0b0a09080706050403020100',
    };
    const encrypted = aesCipher.encrypt('Attack at dawn', params);
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = aesCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, params);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of aesCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => aesCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('has no Attack tab, and for the first time on this site that is because it works', () => {
    expect(aesCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(aesCipher.attack).toBeUndefined();
    expect(aesCipher.explainer).toContain('no known practical attack');
  });

  it('still ships a "How this breaks" section, because implementations break', () => {
    expect(aesCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(aesCipher.explainer).toContain('ECB');
    expect(aesCipher.explainer).toContain('padding oracle');
    expect(aesCipher.explainer).toContain('authenticat');
  });
});
