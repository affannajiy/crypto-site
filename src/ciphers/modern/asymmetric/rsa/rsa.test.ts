import { describe, expect, it } from 'vitest';
import {
  buildKeys,
  factor,
  gcd,
  isPrime,
  modInverse,
  modPow,
  parseNumbers,
  recoverPrivate,
  rsa,
  rsaTrace,
} from './rsa';
import rsaCipher from './index';

describe('the number theory', () => {
  it('recognises primes', () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(61)).toBe(true);
    expect(isPrime(3229)).toBe(true);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(0)).toBe(false);
    expect(isPrime(-7)).toBe(false);
    expect(isPrime(3233)).toBe(false); // 61 x 53
    expect(isPrime(4)).toBe(false);
  });

  it('computes a greatest common divisor', () => {
    expect(gcd(3120n, 17n)).toBe(1n);
    expect(gcd(3120n, 12n)).toBe(12n);
  });

  it('inverts modulo m, and reports when there is no inverse', () => {
    // The textbook example: 17 inverse mod 3120 is 2753.
    expect(modInverse(17n, 3120n)).toBe(2753n);
    expect((17n * 2753n) % 3120n).toBe(1n);
    expect(modInverse(12n, 3120n)).toBeNull();
  });

  it('exponentiates without ever computing the power itself', () => {
    // 65^17 has 31 digits and would not survive as a Number.
    expect(modPow(65n, 17n, 3233n)).toBe(2790n);
    expect(modPow(2790n, 2753n, 3233n)).toBe(65n);
    expect(modPow(5n, 0n, 7n)).toBe(1n);
    expect(modPow(5n, 3n, 1n)).toBe(0n);
  });
});

describe('buildKeys', () => {
  it('builds the textbook key pair', () => {
    // p=61, q=53, e=17: the example from every RSA introduction.
    const keys = buildKeys(61, 53, 17);
    expect(keys.n).toBe(3233n);
    expect(keys.phi).toBe(3120n);
    expect(keys.d).toBe(2753n);
  });

  it('refuses a p or q that is not prime, and says which', () => {
    expect(() => buildKeys(60, 53, 17)).toThrow(/p must be prime/);
    expect(() => buildKeys(61, 52, 17)).toThrow(/q must be prime/);
  });

  it('refuses p equal to q, because n would be a perfect square', () => {
    expect(() => buildKeys(61, 61, 17)).toThrow(/perfect square/);
  });

  it("refuses an e that shares a factor with phi — the Affine cipher's condition", () => {
    expect(() => buildKeys(61, 53, 12)).toThrow(/coprime/);
    expect(() => buildKeys(61, 53, 12)).toThrow(/Affine/);
  });

  it('refuses an n too small to hold a byte', () => {
    expect(() => buildKeys(3, 5, 7)).toThrow(/too small/);
  });

  it('refuses an e outside the usable range', () => {
    expect(() => buildKeys(61, 53, 1)).toThrow(/between 2/);
    expect(() => buildKeys(61, 53, 3120)).toThrow(/between 2/);
  });
});

describe('rsa', () => {
  const keys = buildKeys(61, 53, 17);

  it('encrypts one byte at a time', () => {
    // 'A' is 65, and 65^17 mod 3233 = 2790.
    expect(rsa('A', keys, 'encrypt')).toBe('2790');
  });

  it('round-trips a message', () => {
    const text = 'Attack at dawn!';
    expect(rsa(rsa(text, keys, 'encrypt'), keys, 'decrypt')).toBe(text);
  });

  it('round-trips multi-byte characters, because it works on UTF-8 bytes', () => {
    const text = 'Café — 日本語';
    expect(rsa(rsa(text, keys, 'encrypt'), keys, 'decrypt')).toBe(text);
  });

  it('round-trips under a larger key too', () => {
    const bigger = buildKeys(1009, 1013, 65537);
    const text = 'Meet me at dawn';
    expect(rsa(rsa(text, bigger, 'encrypt'), bigger, 'decrypt')).toBe(text);
  });

  it('is deterministic, which is textbook RSA being unusable', () => {
    // The same byte always gives the same number, so an attacker with the public
    // key can build a table of all 256 possibilities. This is not a quirk of the
    // toy primes: it is why real RSA must pad with randomness.
    const table = new Map<string, number>();
    for (let byte = 0; byte < 256; byte += 1) {
      const cipher = modPow(BigInt(byte), keys.e, keys.n).toString();
      expect(table.has(cipher)).toBe(false);
      table.set(cipher, byte);
    }
    expect(table.size).toBe(256);
    expect(table.get(rsa('A', keys, 'encrypt'))).toBe(65);
  });

  it('is malleable: multiplying the ciphertext multiplies the plaintext', () => {
    // No key needed. This is why encryption without authentication keeps failing.
    const m = 7n;
    const c = modPow(m, keys.e, keys.n);
    const tampered = (c * modPow(2n, keys.e, keys.n)) % keys.n;
    expect(modPow(tampered, keys.d, keys.n)).toBe((m * 2n) % keys.n);
  });

  it('handles the empty message', () => {
    expect(rsa('', keys, 'encrypt')).toBe('');
    expect(rsa('', keys, 'decrypt')).toBe('');
  });
});

describe('parseNumbers', () => {
  it('reads a spaced list', () => {
    expect(parseNumbers('2790 1313')).toEqual([2790n, 1313n]);
  });

  it('ignores anything that is not a number', () => {
    expect(parseNumbers('2790, 1313.')).toEqual([2790n, 1313n]);
  });
});

describe('the break', () => {
  it('factors n by trial division, smaller factor first', () => {
    // Trial division counts upwards, so it reports 53 before 61. Which of the
    // two is called "p" is not a fact about the key — an attacker recovers the
    // pair, and phi is symmetric in them.
    expect(factor(3233n)).toMatchObject({ p: 53n, q: 61n });
    expect(factor(4n)).toMatchObject({ p: 2n, q: 2n });
  });

  it('reports nothing for a prime, because there is nothing to find', () => {
    expect(factor(3229n)).toBeNull();
  });

  it('recovers the private key from the public key alone', () => {
    // The whole attack. Given only (n, e), which are published.
    const keys = buildKeys(61, 53, 17);
    const broken = recoverPrivate(keys.n, keys.e);
    expect(broken?.d).toBe(keys.d);
    expect(broken?.phi).toBe(keys.phi);
  });

  it('recovers a larger key too, only more slowly', () => {
    const keys = buildKeys(1009, 1013, 65537);
    const broken = recoverPrivate(keys.n, keys.e);
    expect(broken?.d).toBe(keys.d);
    // The number of divisions is what grows, and it grows with the square root
    // of n. That growth rate is the entire security of RSA.
    const small = recoverPrivate(buildKeys(61, 53, 17).n, 17n);
    expect(broken?.tried ?? 0).toBeGreaterThan(small?.tried ?? 0);
  });

  it('decrypts a real message once the key is recovered', () => {
    const keys = buildKeys(61, 53, 17);
    const ciphertext = rsa('SECRET', keys, 'encrypt');
    const broken = recoverPrivate(keys.n, keys.e);
    const recovered = { ...keys, d: broken?.d ?? 0n };
    expect(rsa(ciphertext, recovered, 'decrypt')).toBe('SECRET');
  });
});

describe('rsaTrace', () => {
  const keys = buildKeys(61, 53, 17);

  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Meet me';
    expect(rsaTrace(text, keys, 'encrypt').output).toBe(rsa(text, keys, 'encrypt'));
    const encrypted = rsa(text, keys, 'encrypt');
    expect(rsaTrace(encrypted, keys, 'decrypt').output).toBe(rsa(encrypted, keys, 'decrypt'));
  });

  it('emits one step per byte', () => {
    expect(rsaTrace('ABC', keys, 'encrypt').steps).toHaveLength(3);
  });

  it('points each step at the character it came from, allowing for UTF-8', () => {
    // 'é' is two bytes, so bytes 1 and 2 both come from character 1.
    const { steps } = rsaTrace('aé', keys, 'encrypt');
    expect(steps).toHaveLength(3);
    expect(steps[0]?.highlight).toEqual({ start: 0, end: 1 });
    expect(steps[1]?.highlight).toEqual({ start: 1, end: 2 });
    expect(steps[2]?.highlight).toEqual({ start: 1, end: 2 });
  });

  it('points each step at the number it produced in the output', () => {
    const { steps } = rsaTrace('AB', keys, 'encrypt');
    const first = String(steps[0]?.output);
    expect(steps[0]?.outputHighlight).toEqual({ start: 0, end: first.length });
    expect(steps[1]?.outputHighlight?.start).toBe(first.length + 1);
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const params = { p: 61, q: 53, e: 17 };
    const encrypted = rsaCipher.encrypt('Attack at dawn', params);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = rsaCipher.decrypt(output, params);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, number> = {};
    for (const spec of rsaCipher.params) {
      if (spec.kind === 'number') defaults[spec.name] = spec.default;
    }
    expect(() => rsaCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('is in the asymmetric family, which no cipher was before it', () => {
    expect(rsaCipher.family).toBe('asymmetric');
  });

  it('has no Attack tab, because the break needs the public key rather than a ciphertext', () => {
    expect(rsaCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(rsaCipher.attack).toBeUndefined();
  });

  it('warns that textbook RSA is not an encryption scheme', () => {
    expect(rsaCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(rsaCipher.explainer).toContain('textbook RSA');
    expect(rsaCipher.explainer).toContain('OAEP');
    expect(rsaCipher.explainer).toContain("Shor's algorithm");
  });
});
