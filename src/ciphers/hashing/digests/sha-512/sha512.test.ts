import { describe, expect, it } from 'vitest';
import sha512Cipher from './index';
import { K, pad, sha512 } from './sha512';

/**
 * The platform's own implementation, as the second opinion. `crypto.subtle`
 * offers SHA-512, so unlike MD5 this file can check itself against something it
 * did not write.
 *
 * The slice() is a type cast in disguise: TextEncoder is typed as returning a
 * view over any ArrayBufferLike, and `digest` insists on a plain ArrayBuffer.
 */
async function reference(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-512', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('the constants', () => {
  it('computes the published first and last values', () => {
    // The eighty constants are derived from cube roots rather than pasted, so
    // these two assertions are what stands between a clever derivation and a
    // wrong one. Both are from FIPS 180-4.
    expect(K).toHaveLength(80);
    expect(K[0]?.toString(16)).toBe('428a2f98d728ae22');
    expect(K[79]?.toString(16)).toBe('6c44198c4a475817');
  });
});

describe('the FIPS 180-4 vectors', () => {
  it('hashes "abc"', () => {
    expect(sha512('abc')).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
        '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    );
  });

  it('hashes the empty string', () => {
    expect(sha512('')).toBe(
      'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce' +
        '47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
    );
  });
});

describe('against the platform', () => {
  it('agrees either side of every block boundary', async () => {
    // 128-byte blocks and a 16-byte length field, so the interesting lengths are
    // 111, 112 and 128 rather than SHA-256's 55, 56 and 64.
    for (const n of [0, 1, 110, 111, 112, 127, 128, 129, 239, 240, 255, 256, 257, 400]) {
      const text = 'x'.repeat(n);
      expect([n, sha512(text)]).toEqual([n, await reference(text)]);
    }
  });

  it('agrees on text that is not ASCII', async () => {
    for (const text of ['héllo', '日本語', '🔐🔐', 'naïve café']) {
      expect([text, sha512(text)]).toEqual([text, await reference(text)]);
    }
  });
});

describe('padding', () => {
  it('always lands on a multiple of 128 bytes', () => {
    for (let n = 0; n < 400; n += 7) expect(pad(new Uint8Array(n)).length % 128).toBe(0);
  });

  it('spills into a second block at 112 bytes, where the 16-byte length no longer fits', () => {
    expect(pad(new Uint8Array(111)).length).toBe(128);
    expect(pad(new Uint8Array(112)).length).toBe(256);
  });
});

describe('the module', () => {
  it('is one-way and says so', () => {
    expect(sha512Cipher.oneWay).toBe(true);
    expect(sha512Cipher.decrypt).toBeUndefined();
  });

  it('traces one step per round, plus padding and the final addition', () => {
    const result = sha512Cipher.encrypt('abc', {});
    if (result instanceof Promise) throw new Error('This hash is synchronous.');
    expect(result.steps).toHaveLength(1 + 80 + 1);
  });
});
