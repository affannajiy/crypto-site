import { describe, expect, it } from 'vitest';
import pbkdf2Cipher, { MAX_ITERATIONS } from './index';
import { hmacSha256, pbkdf2 } from './pbkdf2';
import { bytesToHex, utf8Bytes } from '../../../../lib/bytes';

/**
 * Two independent checks again, and here the platform can do both halves:
 * `crypto.subtle` implements HMAC and PBKDF2, so every claim in this module is
 * checked against an implementation this app did not write.
 *
 * Published vectors alone would not be enough. RFC 6070's are for PBKDF2-HMAC-
 * SHA-1, and this module uses SHA-256 — so the widely-copied vectors would have
 * been the wrong ones, quietly.
 */
async function subtleHmac(key: string, message: string): Promise<string> {
  const imported = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(key).slice().buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    imported,
    utf8Bytes(message).slice().buffer as ArrayBuffer,
  );
  return bytesToHex(new Uint8Array(signature));
}

async function subtlePbkdf2(
  password: string,
  salt: string,
  iterations: number,
  keyBytes: number,
): Promise<string> {
  const imported = await crypto.subtle.importKey(
    'raw',
    utf8Bytes(password).slice().buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: utf8Bytes(salt).slice().buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    imported,
    keyBytes * 8,
  );
  return bytesToHex(new Uint8Array(bits));
}

describe('HMAC-SHA-256', () => {
  it('agrees with the platform', async () => {
    for (const [key, message] of [
      ['key', 'The quick brown fox jumps over the lazy dog'],
      ['a', 'b'],
      ['k', ''],
      // A key longer than the 64-byte block is hashed down first. That branch is
      // easy to write and easy to never exercise.
      ['k'.repeat(100), 'message'],
      ['k'.repeat(64), 'exactly one block of key'],
      // A zero-length key is not in this list because `crypto.subtle` refuses to
      // import one, not because this HMAC cannot take it. No reference, no test.
    ] as [string, string][]) {
      expect([key.length, await subtleHmac(key, message)]).toEqual([
        key.length,
        bytesToHex(hmacSha256(utf8Bytes(key), utf8Bytes(message))),
      ]);
    }
  });
});

describe('PBKDF2-HMAC-SHA-256', () => {
  it('agrees with the platform', async () => {
    for (const [iterations, keyBytes] of [
      [1, 32],
      [2, 32],
      [100, 32],
      // More than one output block: 40 bytes needs T1 and part of T2, which is
      // where the counter in `salt || i` earns its place.
      [10, 40],
      [10, 64],
      [10, 1],
    ] as [number, number][]) {
      const mine = pbkdf2('correct horse battery staple', {
        salt: 'user-4417',
        iterations,
        keyBytes,
      });
      const theirs = await subtlePbkdf2('correct horse battery staple', 'user-4417', iterations, keyBytes);
      expect([iterations, keyBytes, mine]).toEqual([iterations, keyBytes, theirs]);
    }
  });

  it('gives a different key for a different salt', () => {
    const options = { iterations: 100, keyBytes: 32 };
    const a = pbkdf2('hunter2', { ...options, salt: 'user-4417' });
    const b = pbkdf2('hunter2', { ...options, salt: 'user-9082' });
    expect(a).not.toBe(b);
  });

  it('gives a different key for one more iteration', () => {
    // The obvious wrong implementation returns the last U rather than the XOR of
    // all of them, and it still passes a single-iteration vector.
    const options = { salt: 'user-4417', keyBytes: 32 };
    expect(pbkdf2('hunter2', { ...options, iterations: 5 })).not.toBe(
      pbkdf2('hunter2', { ...options, iterations: 6 }),
    );
  });
});

describe('the module', () => {
  it('is one-way and says so', () => {
    expect(pbkdf2Cipher.oneWay).toBe(true);
    expect(pbkdf2Cipher.decrypt).toBeUndefined();
  });

  it('offers an untraced path, which is the point of its benchmark tab', () => {
    // Gap 2. PBKDF2 is the first module where the Benchmark tab measures what the
    // algorithm is *for* rather than how readable its trace is.
    expect(pbkdf2Cipher.tiers).toContain('benchmark');
    expect(pbkdf2Cipher.benchmark).toBeDefined();
    expect(pbkdf2Cipher.benchmark?.('hunter2', { salt: 'user-4417', iterations: 10, keyBytes: 32 })).toBe(
      pbkdf2('hunter2', { salt: 'user-4417', iterations: 10, keyBytes: 32 }),
    );
  });

  it('refuses an empty salt, and says why', () => {
    expect(() => pbkdf2Cipher.encrypt('hunter2', { salt: '', iterations: 10, keyBytes: 32 })).toThrow(
      /salt is required/i,
    );
  });

  it('refuses an iteration count past the cap this page can run', () => {
    expect(() =>
      pbkdf2Cipher.encrypt('hunter2', {
        salt: 'user-4417',
        iterations: MAX_ITERATIONS + 1,
        keyBytes: 32,
      }),
    ).toThrow(/whole number between 1 and/i);
  });

  it('collapses the identical middle iterations into one step that counts them', () => {
    // A trace cannot hold twenty thousand steps and would teach nothing if it
    // could, so the skipped ones are named rather than hidden.
    const result = pbkdf2Cipher.encrypt('hunter2', {
      salt: 'user-4417',
      iterations: 500,
      keyBytes: 32,
    });
    if (result instanceof Promise) throw new Error('This derivation is synchronous.');
    expect(result.steps.length).toBeLessThan(20);
    const skipped = result.steps.find((step) => typeof step.data?.['skipped'] === 'number');
    expect(skipped?.data?.['skipped']).toBe(500 - 6 - 1);
  });
});
