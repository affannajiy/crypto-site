import { describe, expect, it } from 'vitest';
import md5Cipher from './index';
import { md5, md5Bytes, pad } from './md5';
import { WANG_A, WANG_B, differingBytes } from './collisionData';
import { hexToBytes } from '../../../../lib/bytes';

/**
 * There is no second opinion available here, and that is itself informative:
 * `crypto.subtle` has no MD5 at all, deliberately, because the platform will not
 * hand you a broken hash. So this file leans on published vectors chosen to span
 * every padding case — 55 and 56 bytes are where the length no longer fits in the
 * block, and 62 and 80 span two blocks — plus the collision, which is the
 * strongest cross-check of all: a wrong implementation would not reproduce it.
 */

describe('the RFC 1321 vectors', () => {
  const vectors: [string, string][] = [
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    ['12345678901234567890123456789012345678901234567890123456789012345678901234567890', '57edf4a22be3c955ac49da2e2107b67a'],
    // 62 bytes: the message plus its 9 bytes of padding no longer fits one block.
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
  ];

  it.each(vectors)('hashes %j', (input, expected) => {
    expect(md5(input)).toBe(expected);
  });
});

describe('the block boundary', () => {
  // 55 bytes plus a 0x80 plus eight length bytes is exactly 64. One more byte and
  // a whole extra block appears, which is the classic place to get padding wrong.
  it.each([
    [55, '04364420e25c512fd958a70738aa8f72'],
    [56, '668a72d5ba17f08e62dabcafad6db14b'],
    [64, 'c1bb4f81d892b2d57947682aeb252456'],
    [119, 'ab347a5f68c8a443cfcddc633f12c24f'],
    [128, 'd69cb61a6ee87200676eb0d4b90edbcb'],
  ])('hashes %i bytes', (n, expected) => {
    expect(md5('x'.repeat(n))).toBe(expected);
  });

  it('hashes UTF-8 bytes, not characters', () => {
    // An emoji is four inputs, not one. A digest computed per character would
    // differ, and this is the assertion that would catch it.
    expect(md5('日本語')).toBe('00110af8b4393ef3f72c50be5b332bec');
  });
});

describe('padding', () => {
  it('always lands on a multiple of 64 bytes', () => {
    for (let n = 0; n < 200; n += 1) expect(pad(new Uint8Array(n)).length % 64).toBe(0);
  });

  it('writes the length little-endian, unlike SHA-2', () => {
    const padded = pad(new Uint8Array(3));
    expect(new DataView(padded.buffer).getBigUint64(padded.length - 8, true)).toBe(24n);
  });
});

describe('the published collision', () => {
  const a = hexToBytes(WANG_A, 'first message');
  const b = hexToBytes(WANG_B, 'second message');

  it('is two different messages', () => {
    expect(WANG_A).not.toBe(WANG_B);
    expect(a.length).toBe(128);
    expect(differingBytes(a, b)).toEqual([19, 45, 59, 83, 109, 123]);
  });

  it('gives both of them the same digest', () => {
    // Computed by this app's own MD5, so a transcription error in the hex fails
    // here rather than shipping a page that demonstrates nothing.
    expect(md5Bytes(a)).toBe(md5Bytes(b));
    expect(md5Bytes(a)).toBe('79054025255fb1a26e4bc422aef54eb4');
  });

  it('survives appending the same bytes to both', () => {
    // The Visualize tab's suffix box, in one assertion. This is why a collision
    // is two documents rather than two blobs.
    const tail = new TextEncoder().encode(' and everything after this is mine to write.');
    const join = (base: Uint8Array) => {
      const out = new Uint8Array(base.length + tail.length);
      out.set(base);
      out.set(tail, base.length);
      return out;
    };
    expect(md5Bytes(join(a))).toBe(md5Bytes(join(b)));
  });
});

describe('the module', () => {
  it('is one-way and says so', () => {
    expect(md5Cipher.oneWay).toBe(true);
    expect(md5Cipher.decrypt).toBeUndefined();
  });

  it('has no attack tab, because a collision search has no ciphertext to take', () => {
    expect(md5Cipher.tiers).not.toContain('attack');
  });

  it('traces one step per round, plus padding and the final addition', () => {
    const result = md5Cipher.encrypt('abc', {});
    if (result instanceof Promise) throw new Error('This hash is synchronous.');
    expect(result.output).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(result.steps).toHaveLength(1 + 64 + 1);
  });
});
