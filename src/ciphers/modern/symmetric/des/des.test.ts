import { describe, expect, it } from 'vitest';
import {
  BLOCK_BYTES,
  EFFECTIVE_KEY_BITS,
  ROUNDS,
  bitsToBytes,
  bitsToHex,
  blocksOf,
  bytesToBits,
  des,
  desTrace,
  expandKey,
  feistelF,
  pad,
  permute,
  processBlock,
  readIv,
  readKey,
  unpad,
  xorBits,
} from './des';
import { fromHex, toHex } from '../../../../lib/format';
import desCipher from './index';

const hex = (s: string) => fromHex(s) ?? new Uint8Array();

describe('bits', () => {
  it('converts bytes to bits, most significant first', () => {
    expect(bytesToBits(new Uint8Array([0x80]))).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(bytesToBits(new Uint8Array([0x01]))).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('round-trips', () => {
    const bytes = hex('0123456789abcdef');
    expect(toHex(bitsToBytes(bytesToBits(bytes)))).toBe('0123456789abcdef');
  });

  it('permutes by a one-based table, as the standard prints them', () => {
    expect(permute([1, 0, 1, 1], [4, 3, 2, 1])).toEqual([1, 1, 0, 1]);
  });

  it('XORs bit by bit', () => {
    expect(xorBits([1, 0, 1], [1, 1, 0])).toEqual([0, 1, 1]);
  });
});

describe('the key schedule', () => {
  it('produces sixteen 48-bit round keys', () => {
    const keys = expandKey(hex('133457799bbcdff1'));
    expect(keys).toHaveLength(ROUNDS);
    for (const key of keys) expect(key).toHaveLength(48);
  });

  it('matches the published first round key for the classic worked example', () => {
    // The key schedule from the standard tutorial example: K1 = 000110110000
    // 001011101111111111000111000001110010, written here as bits.
    const keys = expandKey(hex('133457799bbcdff1'));
    expect(keys[0]?.join('')).toBe('000110110000001011101111111111000111000001110010');
  });

  it('discards the parity bits, so changing only those changes nothing', () => {
    // Every eighth bit is parity and PC-1 drops it. This is what "64-bit key,
    // 56-bit security" means, asserted rather than asserted-in-prose.
    expect(EFFECTIVE_KEY_BITS).toBe(56);
    const a = expandKey(hex('133457799bbcdff1'));
    // Flip the low bit of every byte: those are exactly the parity bits.
    const flipped = hex('133457799bbcdff1').map((b) => b ^ 1);
    const b = expandKey(flipped);
    expect(a.map((k) => k.join(''))).toEqual(b.map((k) => k.join('')));
  });
});

describe('the round function', () => {
  it('expands 32 bits to 48 and comes back with 32', () => {
    const right = new Array<number>(32).fill(0).map((_, i) => i % 2);
    const key = new Array<number>(48).fill(1);
    const f = feistelF(right, key);
    expect(f.expanded).toHaveLength(48);
    expect(f.mixed).toHaveLength(48);
    expect(f.substituted).toHaveLength(32);
    expect(f.out).toHaveLength(32);
  });

  it('runs all eight S-boxes, six bits in and four out', () => {
    const f = feistelF(new Array<number>(32).fill(0), new Array<number>(48).fill(0));
    expect(f.boxes).toHaveLength(8);
    for (const box of f.boxes) {
      expect(box.row).toBeGreaterThanOrEqual(0);
      expect(box.row).toBeLessThanOrEqual(3);
      expect(box.column).toBeLessThanOrEqual(15);
      expect(box.output).toBeLessThanOrEqual(15);
    }
  });

  it('is not invertible, which is the whole freedom a Feistel network buys', () => {
    // Six bits in, four bits out: four different inputs must collide on one
    // output for every S-box. If F were invertible there would be no collisions.
    const seen = new Map<string, number>();
    for (let value = 0; value < 64; value += 1) {
      const key = new Array<number>(48).fill(0);
      for (let i = 0; i < 6; i += 1) key[i] = (value >> (5 - i)) & 1;
      const f = feistelF(new Array<number>(32).fill(0), key);
      const out = String(f.boxes[0]?.output ?? -1);
      seen.set(out, (seen.get(out) ?? 0) + 1);
    }
    expect(seen.size).toBeLessThan(64);
  });
});

describe('the FIPS test vector', () => {
  it('encrypts the classic block', () => {
    // Key 133457799BBCDFF1, plaintext 0123456789ABCDEF -> 85E813540F0AB405.
    // The vector every DES implementation is checked against.
    const keys = expandKey(hex('133457799bbcdff1'));
    const { out } = processBlock(hex('0123456789abcdef'), keys, 'encrypt');
    expect(toHex(out)).toBe('85e813540f0ab405');
  });

  it('decrypts it back with the same sixteen rounds', () => {
    const keys = expandKey(hex('133457799bbcdff1'));
    const { out } = processBlock(hex('85e813540f0ab405'), keys, 'decrypt');
    expect(toHex(out)).toBe('0123456789abcdef');
  });

  it('encrypts the all-zero block under the all-zero key', () => {
    const keys = expandKey(new Uint8Array(8));
    expect(toHex(processBlock(new Uint8Array(8), keys, 'encrypt').out)).toBe('8ca64de9c1b123a7');
  });

  it('records one trace entry per round', () => {
    const keys = expandKey(hex('133457799bbcdff1'));
    const { trace } = processBlock(hex('0123456789abcdef'), keys, 'encrypt');
    expect(trace).toHaveLength(16);
    expect(trace[0]?.round).toBe(1);
    // The left half of round n+1 is the right half of round n. That IS Feistel.
    expect(bitsToHex(trace[1]?.left ?? [])).toBe(bitsToHex(trace[0]?.right ?? []));
  });
});

describe('modes', () => {
  const key = hex('133457799bbcdff1');
  const iv = hex('0f0e0d0c0b0a0908');

  it('round-trips through ECB and CBC', () => {
    const text = 'Meet me at the old bridge at midnight.';
    for (const mode of ['ECB', 'CBC'] as const) {
      const encrypted = des(text, { key, mode, iv }, 'encrypt');
      expect(des(encrypted, { key, mode, iv }, 'decrypt')).toBe(text);
    }
  });

  it('shows the ECB problem on an eight-byte block boundary', () => {
    const text = 'AAAAAAAA' + 'AAAAAAAA';
    const out = des(text, { key, mode: 'ECB', iv }, 'encrypt');
    expect(out.slice(0, 16)).toBe(out.slice(16, 32));
    const chained = des(text, { key, mode: 'CBC', iv }, 'encrypt');
    expect(chained.slice(0, 16)).not.toBe(chained.slice(16, 32));
  });

  it('avalanches: one plaintext bit changes about half the ciphertext bits', () => {
    const keys = expandKey(key);
    const a = processBlock(hex('0123456789abcdef'), keys, 'encrypt').out;
    const b = processBlock(hex('0123456789abcdee'), keys, 'encrypt').out;
    let bits = 0;
    for (let i = 0; i < BLOCK_BYTES; i += 1) {
      let diff = (a[i] ?? 0) ^ (b[i] ?? 0);
      while (diff !== 0) {
        bits += diff & 1;
        diff >>= 1;
      }
    }
    // 64 bits, so about 32. A wide band, because one sample is one sample.
    expect(bits).toBeGreaterThan(18);
    expect(bits).toBeLessThan(46);
  });

  it('handles multi-byte characters', () => {
    const text = 'Café — 日本語';
    expect(des(des(text, { key, mode: 'CBC', iv }, 'encrypt'), { key, mode: 'CBC', iv }, 'decrypt')).toBe(
      text,
    );
  });
});

describe('padding and blocks', () => {
  it('always adds at least one byte and round-trips', () => {
    for (const n of [0, 1, 7, 8, 9, 100]) {
      const bytes = new Uint8Array(n).map((_, i) => i & 0xff);
      expect(pad(bytes).length % BLOCK_BYTES).toBe(0);
      expect([...(unpad(pad(bytes)) ?? [])]).toEqual([...bytes]);
    }
  });

  it('cuts into eight-byte blocks', () => {
    expect(blocksOf(new Uint8Array(24))).toHaveLength(3);
  });

  it('rejects padding that is not valid', () => {
    const bad = new Uint8Array(8).fill(0);
    bad[7] = 9;
    expect(unpad(bad)).toBeNull();
  });
});

describe('reading the key', () => {
  it('accepts exactly 64 bits', () => {
    expect(readKey('133457799bbcdff1')).toHaveLength(8);
    expect(readKey('1334 5779 9bbc dff1')).toHaveLength(8);
  });

  it('says clearly what is wrong, and mentions the parity bits', () => {
    expect(() => readKey('zz')).toThrow(/hexadecimal/);
    expect(() => readKey('0011')).toThrow(/64 bits/);
    expect(() => readKey('0011')).toThrow(/parity/);
  });

  it('defaults the IV to zeros and rejects a wrong-sized one', () => {
    expect(readIv('')).toHaveLength(8);
    expect(() => readIv('00')).toThrow(/16 hex digits/);
  });
});

describe('desTrace', () => {
  const key = hex('133457799bbcdff1');
  const iv = hex('0f0e0d0c0b0a0908');

  it('agrees with the untraced cipher', () => {
    const text = 'Meet me at dawn';
    for (const mode of ['ECB', 'CBC'] as const) {
      expect(desTrace(text, { key, mode, iv }, 'encrypt').output).toBe(
        des(text, { key, mode, iv }, 'encrypt'),
      );
    }
  });

  it('emits one step per block and carries all sixteen rounds', () => {
    const { steps } = desTrace('A'.repeat(20), { key, mode: 'CBC', iv }, 'encrypt');
    expect(steps).toHaveLength(3);
    const trace = steps[0]?.data?.['trace'] as unknown[];
    expect(trace).toHaveLength(16);
  });

  it('carries the eight S-box results for the visualizer', () => {
    const { steps } = desTrace('hello', { key, mode: 'ECB', iv }, 'encrypt');
    const trace = steps[0]?.data?.['trace'] as { boxes: unknown[] }[];
    expect(trace[0]?.boxes).toHaveLength(8);
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const params = { key: '133457799bbcdff1', mode: 'CBC', iv: '0f0e0d0c0b0a0908' };
    const encrypted = desCipher.encrypt('Attack at dawn', params);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = desCipher.decrypt(output, params);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of desCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => desCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('has no Attack tab, because 2^56 is a machine and not a button', () => {
    expect(desCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(desCipher.attack).toBeUndefined();
  });

  it('tells the reader how it breaks, and credits Deep Crack', () => {
    expect(desCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(desCipher.explainer).toContain('Deep Crack');
    expect(desCipher.explainer).toContain('differential');
  });
});
