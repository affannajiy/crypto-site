import { describe, expect, it } from 'vitest';
import sha1Cipher from './index';
import { STAGE_K, pad, sha0, sha1, stageOf } from './sha1';

/**
 * The platform's own implementation, as the second opinion. `crypto.subtle`
 * offers SHA-1, so unlike MD5 this file can check itself against something it
 * did not write.
 *
 * The slice() is a type cast in disguise: TextEncoder is typed as returning a
 * view over any ArrayBufferLike, and `digest` insists on a plain ArrayBuffer.
 */
async function reference(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-1', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('the FIPS 180-1 vectors', () => {
  it('hashes "abc"', () => {
    expect(sha1('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('hashes the two-block vector', () => {
    expect(sha1('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
    );
  });

  it('hashes the empty string', () => {
    expect(sha1('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('hashes a million letter a', () => {
    expect(sha1('a'.repeat(1000000))).toBe('34aa973cd4c4daa4f61eeb2bdbad27316534016f');
  });
});

describe('against the platform', () => {
  it('agrees either side of every block boundary', async () => {
    for (const n of [0, 1, 54, 55, 56, 63, 64, 65, 119, 120, 127, 128, 129, 200]) {
      const text = 'x'.repeat(n);
      expect([n, sha1(text)]).toEqual([n, await reference(text)]);
    }
  });

  it('agrees on text that is not ASCII', async () => {
    for (const text of ['héllo', '日本語', '🔐🔐', 'naïve café']) {
      expect([text, sha1(text)]).toEqual([text, await reference(text)]);
    }
  });
});

describe('SHA-0', () => {
  it('is the same algorithm without one rotation, and gives a different answer', () => {
    // The claim the Visualize tab makes, asserted. Not a published vector: the
    // point is that a one-line difference produces an unrelated digest.
    expect(sha0('abc')).not.toBe(sha1('abc'));
    expect(sha0('abc')).toHaveLength(40);
  });

  it('differs even on the empty message', () => {
    // The obvious wrong guess is that a short message never reaches the expanded
    // words. It does: every block runs all eighty rounds, expansion included.
    expect(sha0('')).not.toBe(sha1(''));
  });
});

describe('the shape', () => {
  it('has four stages of twenty rounds', () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79].map(stageOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(STAGE_K).toHaveLength(4);
  });

  it('pads to a multiple of 64 bytes, big-endian unlike MD5', () => {
    for (let n = 0; n < 200; n += 1) expect(pad(new Uint8Array(n)).length % 64).toBe(0);
    const padded = pad(new Uint8Array(3));
    expect(new DataView(padded.buffer).getBigUint64(padded.length - 8, false)).toBe(24n);
  });
});

describe('the module', () => {
  it('is one-way and says so', () => {
    expect(sha1Cipher.oneWay).toBe(true);
    expect(sha1Cipher.decrypt).toBeUndefined();
  });

  it('traces one step per round, plus padding and the final addition', () => {
    const result = sha1Cipher.encrypt('abc', {});
    if (result instanceof Promise) throw new Error('This hash is synchronous.');
    expect(result.output).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(result.steps).toHaveLength(1 + 80 + 1);
  });
});
