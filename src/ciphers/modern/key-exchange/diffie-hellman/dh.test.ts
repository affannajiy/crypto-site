import { describe, expect, it } from 'vitest';
import { dh, dhTrace, discreteLog, exchange, isPrime, keystream, modPow } from './dh';
import dhCipher from './index';

describe('the arithmetic', () => {
  it('recognises primes', () => {
    expect(isPrime(23)).toBe(true);
    expect(isPrime(104729)).toBe(true);
    expect(isPrime(104730)).toBe(false);
    expect(isPrime(1)).toBe(false);
  });

  it('exponentiates modulo p without overflowing', () => {
    expect(modPow(5n, 6n, 23n)).toBe(8n);
    expect(modPow(5n, 15n, 23n)).toBe(19n);
  });
});

describe('the exchange', () => {
  it('matches the textbook example', () => {
    // p=23, g=5, a=6, b=15: A=8, B=19, shared=2.
    const meeting = exchange(23, 5, 6, 15);
    expect(meeting.publicA).toBe(8);
    expect(meeting.publicB).toBe(19);
    expect(meeting.shared).toBe(2);
  });

  it('has both sides arrive at the same number, whatever the parameters', () => {
    // The property the whole thing rests on: (g^a)^b = (g^b)^a. Asserted across
    // a spread of parameters rather than for one example.
    for (const p of [23, 47, 3001, 104729]) {
      for (const g of [2, 3, 5]) {
        const meeting = exchange(p, g, 7, 11);
        expect(Number(modPow(BigInt(meeting.publicA), 11n, BigInt(p)))).toBe(meeting.shared);
        expect(Number(modPow(BigInt(meeting.publicB), 7n, BigInt(p)))).toBe(meeting.shared);
      }
    }
  });

  it('never transmits either secret', () => {
    // A and B are what crossed the wire. Neither is the secret that produced it.
    const meeting = exchange(104729, 3, 12345, 54321);
    expect(meeting.publicA).not.toBe(meeting.a);
    expect(meeting.publicB).not.toBe(meeting.b);
    expect(meeting.shared).not.toBe(meeting.publicA);
    expect(meeting.shared).not.toBe(meeting.publicB);
  });

  it('refuses parameters that would not work, and says which', () => {
    expect(() => exchange(24, 5, 6, 15)).toThrow(/p must be prime/);
    expect(() => exchange(3, 2, 1, 1)).toThrow(/at least 5/);
    expect(() => exchange(23, 23, 6, 15)).toThrow(/g must be between/);
    expect(() => exchange(23, 5, 0, 15)).toThrow(/Alice/);
    expect(() => exchange(23, 5, 6, 22)).toThrow(/Bob/);
  });
});

describe('the keystream stand-in', () => {
  it('is deterministic in the shared secret', () => {
    expect([...keystream(2, 8)]).toEqual([...keystream(2, 8)]);
  });

  it('differs for a different shared secret', () => {
    expect([...keystream(2, 8)]).not.toEqual([...keystream(3, 8)]);
  });

  it('produces exactly the number of bytes asked for', () => {
    expect(keystream(2, 0)).toHaveLength(0);
    expect(keystream(2, 100)).toHaveLength(100);
  });

  it('does not fall over on a shared secret that cancels its seed', () => {
    expect(keystream(0x9e3779b9, 4).some((b) => b !== 0)).toBe(true);
  });
});

describe('dh', () => {
  const meeting = exchange(104729, 3, 12345, 54321);

  it('round-trips a message', () => {
    const text = 'Meet me at the old bridge — 日本語';
    expect(dh(dh(text, meeting, 'encrypt'), meeting, 'decrypt')).toBe(text);
  });

  it('gives a different ciphertext when the shared secret differs', () => {
    const other = exchange(104729, 3, 999, 54321);
    expect(dh('Attack at dawn', meeting, 'encrypt')).not.toBe(dh('Attack at dawn', other, 'encrypt'));
  });

  it('decrypts with either party, because both hold the same number', () => {
    // Bob's view of the same exchange, constructed from his side.
    const bobsView = exchange(104729, 3, 12345, 54321);
    const encrypted = dh('Attack at dawn', meeting, 'encrypt');
    expect(dh(encrypted, bobsView, 'decrypt')).toBe('Attack at dawn');
  });

  it('handles the empty message', () => {
    expect(dh('', meeting, 'encrypt')).toBe('');
    expect(dh('', meeting, 'decrypt')).toBe('');
  });
});

describe('the discrete logarithm', () => {
  it('recovers a secret exponent by trying every one', () => {
    const meeting = exchange(23, 5, 6, 15);
    expect(discreteLog(5, meeting.publicA, 23)?.exponent).toBe(6);
  });

  it('recovers the shared secret from public information alone', () => {
    // Eve's whole attack: she has p, g, A and B and nothing else.
    const meeting = exchange(3001, 3, 777, 1234);
    const found = discreteLog(meeting.g, meeting.publicA, meeting.p);
    const shared = Number(modPow(BigInt(meeting.publicB), BigInt(found?.exponent ?? 0), BigInt(meeting.p)));
    expect(shared).toBe(meeting.shared);
  });

  it('need not recover the secret itself, only something congruent to it', () => {
    // With p = 104729, g = 3 and Alice's secret 12345, the smallest exponent that
    // reproduces A is 4289 — not 12345. It works because the two are congruent
    // modulo the order of g, and it yields the identical shared secret. An
    // attacker does not need your secret; they need something that behaves like it.
    const meeting = exchange(104729, 3, 12345, 54321);
    const found = discreteLog(meeting.g, meeting.publicA, meeting.p);
    expect(found?.exponent).not.toBe(meeting.a);
    expect(Number(modPow(BigInt(meeting.g), BigInt(found?.exponent ?? 0), BigInt(meeting.p)))).toBe(
      meeting.publicA,
    );
    expect(Number(modPow(BigInt(meeting.publicB), BigInt(found?.exponent ?? 0), BigInt(meeting.p)))).toBe(
      meeting.shared,
    );
  });

  it('costs more as p grows, which is the entire security argument', () => {
    const small = discreteLog(5, exchange(23, 5, 20, 6).publicA, 23);
    const large = discreteLog(3, exchange(104729, 3, 90000, 6).publicA, 104729);
    expect(large?.tried ?? 0).toBeGreaterThan(small?.tried ?? 0);
  });

  it('reports nothing when no exponent produces the target', () => {
    expect(discreteLog(5, 0, 23)).toBeNull();
  });
});

describe('dhTrace', () => {
  const meeting = exchange(104729, 3, 12345, 54321);

  it('agrees with the untraced version', () => {
    const text = 'Meet me at dawn';
    expect(dhTrace(text, meeting, 'encrypt').output).toBe(dh(text, meeting, 'encrypt'));
  });

  it('walks the exchange before it touches the message', () => {
    const { steps } = dhTrace('hello', meeting, 'encrypt');
    expect(steps.map((s) => s.data?.['stage'])).toEqual([
      'public',
      'alice',
      'bob',
      'shared',
      'encrypt',
    ]);
  });

  it('labels the bolted-on encryption as a stand-in rather than part of the exchange', () => {
    // The honesty this page depends on. If this text ever goes away, a reader
    // could take the Encrypt tab for a construction worth copying.
    const { steps } = dhTrace('hello', meeting, 'encrypt');
    const last = steps[steps.length - 1];
    expect(last?.detail).toContain('NOT a key derivation function');
    expect(last?.detail).toContain('HKDF');
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const params = { p: 104729, g: 3, a: 12345, b: 54321 };
    const encrypted = dhCipher.encrypt('Attack at dawn', params);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = dhCipher.decrypt(output, params);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, number> = {};
    for (const spec of dhCipher.params) {
      if (spec.kind === 'number') defaults[spec.name] = spec.default;
    }
    expect(() => dhCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('says in its first line that it is not a cipher', () => {
    expect(dhCipher.explainer.startsWith('**This is not a cipher.**')).toBe(true);
    expect(dhCipher.blurb).toContain('Not a cipher');
  });

  it('has no Attack tab, and puts the break on Visualize instead', () => {
    expect(dhCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(dhCipher.attack).toBeUndefined();
    expect(dhCipher.visualize).toBeDefined();
  });

  it('warns about the man in the middle and about weak randomness', () => {
    expect(dhCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(dhCipher.explainer).toContain('Man in the middle');
    expect(dhCipher.explainer).toContain('Logjam');
    expect(dhCipher.explainer).toContain('forward secrecy');
  });
});
