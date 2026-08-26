import { describe, expect, it } from 'vitest';
import { ciphers, getCipher, populatedFamilies, validateRegistry } from './registry';
import type { CipherModule } from './types';

/** A minimal valid module, so each test can break exactly one rule. */
function stub(overrides: Partial<CipherModule> = {}): CipherModule {
  return {
    slug: 'stub',
    name: 'Stub',
    family: 'classical',
    blurb: 'A cipher that exists only in this test.',
    explainer: '## How this breaks\nIt does not exist.',
    tiers: ['encrypt'],
    params: [],
    encrypt: () => ({ output: '', steps: [] }),
    decrypt: () => ({ output: '', steps: [] }),
    ...overrides,
  };
}

const at = (cipher: CipherModule) => [{ path: './x/index.ts', cipher }];

describe('validateRegistry', () => {
  it('accepts a well-formed module', () => {
    expect(() => validateRegistry(at(stub()))).not.toThrow();
  });

  it('rejects a duplicate slug', () => {
    const entries = [
      { path: './a/index.ts', cipher: stub() },
      { path: './b/index.ts', cipher: stub() },
    ];
    expect(() => validateRegistry(entries)).toThrow(/already used by/);
  });

  it('rejects a slug that is not URL-safe', () => {
    expect(() => validateRegistry(at(stub({ slug: 'One Time Pad' })))).toThrow(/kebab-case/);
  });

  it("rejects a declared 'attack' tier with no attack()", () => {
    expect(() => validateRegistry(at(stub({ tiers: ['encrypt', 'attack'] })))).toThrow(
      /tier 'attack' is declared but attack\(\) is not implemented/,
    );
  });

  it("rejects a declared 'visualize' tier with no visualize component", () => {
    expect(() => validateRegistry(at(stub({ tiers: ['encrypt', 'visualize'] })))).toThrow(
      /visualize/,
    );
  });

  it('rejects an empty tier list, and one without encrypt', () => {
    expect(() => validateRegistry(at(stub({ tiers: [] })))).toThrow(/tiers is empty/);
    expect(() => validateRegistry(at(stub({ tiers: ['benchmark'] })))).toThrow(
      /must include 'encrypt'/,
    );
  });

  it('rejects two params with the same name', () => {
    const params: CipherModule['params'] = [
      { kind: 'text', name: 'key', label: 'Key', default: 'a' },
      { kind: 'text', name: 'key', label: 'Other key', default: 'b' },
    ];
    expect(() => validateRegistry(at(stub({ params })))).toThrow(/share the name 'key'/);
  });

  it('rejects a default outside its own range', () => {
    const params: CipherModule['params'] = [
      { kind: 'number', name: 'shift', label: 'Shift', min: 1, max: 25, default: 99 },
    ];
    expect(() => validateRegistry(at(stub({ params })))).toThrow(/outside 1\.\.25/);
  });

  it('rejects a select default that is not one of its options', () => {
    const params: CipherModule['params'] = [
      { kind: 'select', name: 'mode', label: 'Mode', options: [{ value: 'a', label: 'A' }], default: 'b' },
    ];
    expect(() => validateRegistry(at(stub({ params })))).toThrow(/not an option/);
  });

  it('rejects an explainer with no "How this breaks" section', () => {
    expect(() => validateRegistry(at(stub({ explainer: 'It is very secure.' })))).toThrow(
      /How this breaks/,
    );
  });

  it('reports every problem at once, not just the first', () => {
    const broken = stub({ slug: 'Bad Slug', tiers: [], explainer: 'nothing here' });
    try {
      validateRegistry(at(broken));
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('kebab-case');
      expect(message).toContain('tiers is empty');
      expect(message).toContain('How this breaks');
    }
  });
});

describe('the live registry', () => {
  it('discovers ciphers from the filesystem with no central list', () => {
    expect(ciphers.length).toBeGreaterThan(0);
    expect(ciphers.map((c) => c.slug)).toContain('caesar');
  });

  it('passes its own validation rules', () => {
    expect(() =>
      validateRegistry(ciphers.map((cipher) => ({ path: `./${cipher.slug}`, cipher }))),
    ).not.toThrow();
  });

  it('looks a cipher up by slug and returns undefined for anything else', () => {
    expect(getCipher('caesar')?.name).toBe('Caesar Cipher');
    // Deliberately not the name of a real cipher: this used to be 'enigma',
    // which stopped being a miss the day the Enigma page shipped.
    expect(getCipher('not-a-cipher')).toBeUndefined();
    expect(getCipher(undefined)).toBeUndefined();
  });

  it('groups into families and hides the empty ones', () => {
    const families = populatedFamilies();
    expect(families.map((f) => f.id)).toContain('classical');
    for (const family of families) {
      expect(family.ciphers.length).toBeGreaterThan(0);
    }
  });
});
