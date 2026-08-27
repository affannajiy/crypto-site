import { describe, expect, it } from 'vitest';
import {
  ciphers,
  getCipher,
  populatedFamilies,
  searchCiphers,
  validateRegistry,
} from './registry';
import type { CipherModule } from './types';
import { defaultParams } from './params';

/** A minimal valid module, so each test can break exactly one rule. */
function stub(overrides: Partial<CipherModule> = {}): CipherModule {
  return {
    slug: 'stub',
    name: 'Stub',
    family: 'classical',
    security: 'broken',
    difficulty: 'beginner',
    blurb: 'A cipher that exists only in this test.',
    explainer: '## How this breaks\nIt does not exist.',
    tiers: ['encrypt'],
    params: [],
    examples: [{ label: 'A message', input: 'Hello.' }],
    encrypt: () => ({ output: '', steps: [] }),
    decrypt: () => ({ output: '', steps: [] }),
    ...overrides,
  };
}

// The folder name is part of what gets validated, so the helper builds a path
// that agrees with the module rather than a placeholder that would fail on its own.
const at = (cipher: CipherModule) => [
  { path: `./classical/substitution/${cipher.slug}/index.ts`, cipher },
];

describe('validateRegistry', () => {
  it('rejects a folder that disagrees with the slug', () => {
    // The catalogue reads a cipher's group from its folder, so a folder that does
    // not match the slug is a trap rather than a cosmetic mismatch.
    expect(() =>
      validateRegistry([{ path: './classical/substitution/rot-13/index.ts', cipher: stub() }]),
    ).toThrow(/folder is 'rot-13' but the slug is 'stub'/);
  });

  it('rejects a folder group that has no heading text', () => {
    expect(() =>
      validateRegistry([{ path: './classical/mystery/stub/index.ts', cipher: stub() }]),
    ).toThrow(/not in GROUPS/);
  });

  it('accepts a well-formed module', () => {
    expect(() => validateRegistry(at(stub()))).not.toThrow();
  });

  it('rejects a duplicate slug', () => {
    const entries = [
      { path: './classical/substitution/stub/index.ts', cipher: stub() },
      { path: './classical/transposition/stub/index.ts', cipher: stub() },
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

describe('security and difficulty', () => {
  it('rejects a security rating outside the vocabulary', () => {
    // Cast: the point is what happens when a module lies to TypeScript, which is
    // exactly the case a runtime check exists for.
    const bad = stub({ security: 'quite good' as never });
    expect(() => validateRegistry(at(bad))).toThrow(/security is 'quite good'/);
  });

  it('rejects a difficulty outside the vocabulary', () => {
    expect(() => validateRegistry(at(stub({ difficulty: 'expert' as never })))).toThrow(
      /difficulty is 'expert'/,
    );
  });

  it('rates the encoding family as not encryption', () => {
    // The whole reason Morse is in the catalogue is that it is not a cipher. A
    // rating of 'broken' would undo that in one word.
    for (const cipher of ciphers.filter((c) => c.family === 'encoding')) {
      expect(cipher.security).toBe('not-encryption');
    }
  });

  it('rates every classical cipher as broken, except the one-time pad', () => {
    // The Classical family description promises every one of them is broken.
    // This test is what keeps that promise true as ciphers are added.
    for (const cipher of ciphers.filter((c) => c.family === 'classical')) {
      const expected = cipher.slug === 'one-time-pad' ? 'perfect' : 'broken';
      expect([cipher.slug, cipher.security]).toEqual([cipher.slug, expected]);
    }
  });
});

describe('one-way modules', () => {
  it('rejects a cipher with no decrypt that has not said it is one-way', () => {
    const bad = stub();
    delete (bad as { decrypt?: unknown }).decrypt;
    expect(() => validateRegistry(at(bad))).toThrow(/no decrypt\(\)/);
  });

  it('rejects a one-way module that still has a decrypt', () => {
    // The failure this prevents is a hash page with a Decrypt button on it,
    // which would teach that a digest can be reversed given the right settings.
    expect(() => validateRegistry(at(stub({ oneWay: true })))).toThrow(
      /oneWay is true but decrypt\(\) exists/,
    );
  });

  it('accepts a one-way module with no decrypt', () => {
    const hash = stub({ oneWay: true });
    delete (hash as { decrypt?: unknown }).decrypt;
    expect(() => validateRegistry(at(hash))).not.toThrow();
  });
});

describe('examples', () => {
  it('rejects a cipher with no worked example', () => {
    expect(() => validateRegistry(at(stub({ examples: [] })))).toThrow(/no examples/);
  });

  it('rejects an example that sets a param the cipher does not have', () => {
    // A typo here would silently change nothing, which is the worst way for a
    // preset to fail: the reader clicks it and quietly gets the default key.
    const bad = stub({ examples: [{ label: 'Typo', input: 'Hi', params: { shft: 3 } }] });
    expect(() => validateRegistry(at(bad))).toThrow(/param 'shft', which this cipher does not have/);
  });

  it('rejects two examples with the same label', () => {
    const bad = stub({
      examples: [
        { label: 'Same', input: 'a' },
        { label: 'Same', input: 'b' },
      ],
    });
    expect(() => validateRegistry(at(bad))).toThrow(/both labelled 'Same'/);
  });

  it('runs every example, except the ones that exist to fail', () => {
    // A preset that throws unexpectedly is worse than no preset, and every one of
    // these is hand-written, so this is the test that catches a typo in a hex key.
    for (const cipher of ciphers) {
      for (const example of cipher.examples ?? []) {
        const params = { ...defaultParams(cipher.params), ...example.params };
        const run = () => cipher.encrypt(example.input, params);
        if (example.demonstratesError === true) expect(run).toThrow();
        else expect(run).not.toThrow();
      }
    }
  });
});

describe('searchCiphers', () => {
  it('returns the whole catalogue for an empty query', () => {
    expect(searchCiphers('   ')).toHaveLength(ciphers.length);
  });

  it('matches a prefix of the name', () => {
    expect(searchCiphers('vig').map((c) => c.slug)).toContain('vigenere');
  });

  it('matches a group label the cipher never declares', () => {
    const slugs = searchCiphers('polyalphabetic').map((c) => c.slug);
    expect(slugs).toContain('vigenere');
    expect(slugs).toContain('beaufort');
  });

  it('matches a keyword rather than a name', () => {
    // "rotor" appears nowhere in Enigma's name or blurb. That is the point of
    // `keywords`: a learner searches for the concept they remember.
    expect(searchCiphers('rotor').map((c) => c.slug)).toEqual(['enigma']);
  });

  it('narrows on every term rather than widening', () => {
    // 'modern' alone reaches all three block-and-stream ciphers; adding a second
    // term must cut the list down, not add to it.
    expect(searchCiphers('modern').length).toBeGreaterThan(1);
    expect(searchCiphers('modern feistel').map((c) => c.slug)).toEqual(['des']);
  });

  it('returns nothing for a typo rather than guessing', () => {
    expect(searchCiphers('vigenaire')).toEqual([]);
  });
});

describe('the untraced benchmark path', () => {
  /**
   * Gap 2 in the project notes. `benchmark()` exists so the Benchmark tab stops
   * measuring how much English a trace allocates, and the whole thing is worthless
   * if the fast path and the traced path can disagree — a number would then be
   * timing something the app never shows anyone.
   *
   * So: every cipher that offers one is run both ways and the outputs compared.
   * The example's params are used rather than the defaults, because a fast path
   * that ignores a param is exactly the bug this catches.
   */
  const withBenchmark = ciphers.filter((cipher) => cipher.benchmark !== undefined);

  it('is offered by the ciphers where the trace dominates the measurement', () => {
    expect(withBenchmark.length).toBeGreaterThan(0);
  });

  it.each(withBenchmark.map((cipher) => [cipher.name, cipher] as const))(
    '%s agrees with its own traced output',
    async (_name, cipher) => {
      const example = cipher.examples?.find((candidate) => candidate.demonstratesError !== true);
      const params = { ...defaultParams(cipher.params), ...(example?.params ?? {}) };
      const input = example?.input ?? 'The quick brown fox jumps over the lazy dog';

      const traced = await cipher.encrypt(input, params);
      const fast = await cipher.benchmark?.(input, params);
      expect(fast).toBe(traced.output);
    },
  );
});
