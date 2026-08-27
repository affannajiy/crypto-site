import { describe, expect, it } from 'vitest';
import sha256Cipher from './index';
import { pad, sha256, utf8Bytes } from './sha256';

/**
 * Two independent checks, because this file is hand-written crypto.
 *
 * The published vectors say the algorithm is right. The comparison against
 * `crypto.subtle.digest` says it is still right on inputs nobody chose — which
 * is what catches a padding bug at a block boundary, the mistake this algorithm
 * is easiest to get wrong.
 */
async function subtleDigest(text: string): Promise<string> {
  // The slice() is a type cast in disguise: TextEncoder is typed as returning a
  // view over any ArrayBufferLike, and `digest` insists on a plain ArrayBuffer.
  const bytes = utf8Bytes(text);
  const buffer = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('the FIPS 180-4 vectors', () => {
  it('hashes the empty string', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashes "abc"', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes the two-block vector', () => {
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('hashes a million a’s', () => {
    expect(sha256('a'.repeat(1000000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });
});

describe('padding', () => {
  it('always lands on a multiple of 64 bytes', () => {
    for (let n = 0; n < 200; n += 1) {
      expect(pad(new Uint8Array(n)).length % 64).toBe(0);
    }
  });

  it('spills into a second block at 56 bytes, where the length no longer fits', () => {
    // 55 bytes plus the 0x80 plus eight length bytes is exactly 64. One more and
    // the length has nowhere to go, so a whole extra block appears.
    expect(pad(new Uint8Array(55)).length).toBe(64);
    expect(pad(new Uint8Array(56)).length).toBe(128);
  });

  it('writes the original length in bits at the very end', () => {
    const padded = pad(new Uint8Array(3));
    const view = new DataView(padded.buffer);
    expect(view.getBigUint64(padded.length - 8, false)).toBe(24n);
  });
});

describe('against crypto.subtle', () => {
  it('agrees on lengths either side of every block boundary', async () => {
    for (const n of [0, 1, 54, 55, 56, 63, 64, 65, 119, 120, 127, 128, 129, 200]) {
      const text = 'x'.repeat(n);
      expect([n, sha256(text)]).toEqual([n, await subtleDigest(text)]);
    }
  });

  it('agrees on text that is not ASCII', async () => {
    // The hash sees UTF-8 bytes, not characters, and this is the test that says
    // so: an emoji is four bytes and a hash that counted characters would differ.
    for (const text of ['héllo', '日本語', '🔐🔐', 'naïve café']) {
      expect([text, sha256(text)]).toEqual([text, await subtleDigest(text)]);
    }
  });
});

describe('the avalanche', () => {
  it('changes about half the bits when one input bit changes', () => {
    const a = sha256('The quick brown fox jumps over the lazy dog');
    const b = sha256('The quick brown fox jumps over the lazy cog');
    const bits = [...a].reduce((count, char, i) => {
      const difference = parseInt(char, 16) ^ parseInt(b[i] ?? '0', 16);
      return count + difference.toString(2).replace(/0/g, '').length;
    }, 0);
    expect(bits).toBeGreaterThan(90);
    expect(bits).toBeLessThan(166);
  });
});

describe('the module', () => {
  it('is one-way and says so', () => {
    expect(sha256Cipher.oneWay).toBe(true);
    expect(sha256Cipher.decrypt).toBeUndefined();
  });

  it('traces one step per round, plus padding and the final addition', () => {
    const result = sha256Cipher.encrypt('abc', {});
    if (result instanceof Promise) throw new Error('This hash is synchronous.');
    expect(result.output).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(result.steps).toHaveLength(1 + 64 + 1);
  });
});
