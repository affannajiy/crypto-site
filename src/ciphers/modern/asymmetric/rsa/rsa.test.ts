import { describe, expect, it } from 'vitest';
import {
  buildKeys,
  euclidTable,
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
import { hashToNumber, sign, verify } from './signature';

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
    expect(() => buildKeys(61, 53, 1)).toThrow(/1 < e < φ\(n\)/);
    expect(() => buildKeys(61, 53, 3120)).toThrow(/1 < e < φ\(n\)/);
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
    const params = { p: 61, q: 53, e: 17, message: 'text' };
    const encrypted = rsaCipher.encrypt('Attack at dawn', params);
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = rsaCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, params);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, number | string> = {};
    for (const spec of rsaCipher.params) {
      if (spec.kind === 'number' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(defaults['message']).toBe('numbers');
    expect(() => rsaCipher.encrypt('31', defaults)).not.toThrow();
    expect(() => rsaCipher.encrypt('Meet me at dawn', { ...defaults, message: 'text' })).not.toThrow();
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

describe('the Lecture 05 example', () => {
  const keys = buildKeys(47, 59, 17, 'numbers');

  it('builds n = 2773, φ(n) = 2668 and d = 157', () => {
    expect([keys.n, keys.phi, keys.d]).toEqual([2773n, 2668n, 157n]);
  });

  it('encrypts M = 31 to C = 587 and back', () => {
    expect(rsa('31', keys, 'encrypt', 'numbers')).toBe('587');
    expect(rsa('587', keys, 'decrypt', 'numbers')).toBe('31');
  });

  it('works d out with the same Euclidean table the slide implies', () => {
    const rows = euclidTable(17n, 2668n);
    expect(rows.map((r) => r.remainder)).toEqual([2668n, 17n, 16n, 1n]);
    expect(rows.map((r) => r.quotient)).toEqual([null, null, 156n, 1n]);
    const last = rows[rows.length - 1];
    expect(((last?.s ?? 0n) % 2668n + 2668n) % 2668n).toBe(157n);
  });

  it('writes each number as the slide does', () => {
    const { steps } = rsaTrace('31', keys, 'encrypt', 'numbers');
    expect(steps[0]?.title).toBe('C = 31^17 mod 2773 = 587');
    const back = rsaTrace('587', keys, 'decrypt', 'numbers');
    expect(back.steps[0]?.title).toBe('M = 587^157 mod 2773 = 31');
  });

  it('opens on that example', () => {
    expect(rsaCipher.examples?.[0]).toMatchObject({ input: '31', params: { p: 47, q: 59, e: 17, message: 'numbers' } });
  });
});

describe('the other lecture and lab keys', () => {
  it('encrypts 2 to 4 with the diagram key n = 14, e = 5', () => {
    const keys = buildKeys(2, 7, 5, 'numbers');
    expect(rsa('2', keys, 'encrypt', 'numbers')).toBe('4');
    // The slide's d = 11 and this page's d = 5 are the same mod φ(n) = 6.
    expect(keys.d).toBe(5n);
    expect(modPow(4n, 11n, 14n)).toBe(2n);
  });

  it('accepts e = 5, 7 and 11 for p = 3, q = 7, and refuses the rest', () => {
    const ok = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((e) => {
      try {
        buildKeys(3, 7, e, 'numbers');
        return true;
      } catch {
        return false;
      }
    });
    expect(ok).toEqual([5, 7, 11]);
  });

  it('refuses Lab 05 as printed, because e = 65537 is larger than φ(n) = 160', () => {
    expect(() => buildKeys(17, 11, 65537, 'numbers')).toThrow(/1 < e < φ\(n\)/);
  });

  it('runs Lab 05 with a valid e', () => {
    const keys = buildKeys(17, 11, 7, 'numbers');
    expect([keys.n, keys.phi, keys.d]).toEqual([187n, 160n, 23n]);
    const c = rsa('42', keys, 'encrypt', 'numbers');
    expect(rsa(c, keys, 'decrypt', 'numbers')).toBe('42');
  });

  it('refuses M = 345 when n = 187, and says what it would have become', () => {
    const keys = buildKeys(17, 11, 7, 'numbers');
    expect(() => rsa('345', keys, 'encrypt', 'numbers')).toThrow(/not less than n = 187.*158/);
  });

  it('refuses words in number mode, and says how to encrypt them', () => {
    const keys = buildKeys(47, 59, 17, 'numbers');
    expect(() => rsa('hello', keys, 'encrypt', 'numbers')).toThrow(/set the message to text/);
  });

  it('allows a small n for numbers but not for text', () => {
    expect(() => buildKeys(2, 7, 5, 'numbers')).not.toThrow();
    expect(() => buildKeys(2, 7, 5, 'text')).toThrow(/too small for text/);
  });
});

describe('Lab 07 signatures', () => {
  const keys = buildKeys(47, 59, 17, 'numbers');

  it('verifies a signature made with d, using only e and n', () => {
    const signed = sign('I owe Bob 10 ringgit.', keys);
    expect(signed.signature).toBe(modPow(signed.h, keys.d, keys.n));
    expect(verify('I owe Bob 10 ringgit.', signed.signature, { n: keys.n, e: keys.e }).valid).toBe(true);
  });

  it('fails when the document changes', () => {
    const signed = sign('I owe Bob 10 ringgit.', keys);
    expect(verify('I owe Bob 99 ringgit.', signed.signature, keys).valid).toBe(false);
  });

  it('fails when the signature was made with a different key', () => {
    const other = buildKeys(61, 53, 17, 'numbers');
    const forged = sign('I owe Bob 10 ringgit.', other);
    expect(verify('I owe Bob 10 ringgit.', forged.signature, keys).valid).toBe(false);
  });

  it('hashes with SHA-256 and reduces mod n, which is the toy step', () => {
    const { digest, h } = hashToNumber('abc', keys.n);
    expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(h).toBe(BigInt(`0x${digest}`) % keys.n);
  });
});
