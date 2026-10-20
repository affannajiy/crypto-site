import { describe, expect, it } from 'vitest';
import { letterSum, toyHash, toySign } from './signature';
import { modPow } from './rsa';

describe('the Lecture 06 toy signature', () => {
  it('sums "Cloud" to 503, not the 471 on the slide', () => {
    expect(toyHash('Cloud')).toMatchObject({ sum: 503, h: 41 });
  });

  it("reproduces the slide's arithmetic for its own H = 9", () => {
    expect(modPow(9n, 11n, 14n)).toBe(11n);
    expect(modPow(11n, 5n, 14n)).toBe(9n);
  });

  it('fails to verify a hash that is not below n', () => {
    const signed = toySign('Cloud');
    expect(signed.hashTooBig).toBe(true);
    expect(signed.recovered).toBe(41n % 14n);
    expect(signed.valid).toBe(false);
  });

  it('verifies when the hash is below n: "Rain" hashes to the same 9 as the slide', () => {
    const signed = toySign('Rain');
    expect(signed.hash.h).toBe(9);
    expect(signed.signature).toBe(11n);
    expect(signed.recovered).toBe(9n);
    expect(signed.valid).toBe(true);
  });

  it('gives the slide collision: ABC and F both sum to 6', () => {
    expect(letterSum('ABC')).toBe(6);
    expect(letterSum('F')).toBe(6);
  });
});
