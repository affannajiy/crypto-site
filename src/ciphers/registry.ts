/**
 * The registry.
 *
 * Every cipher is discovered from the filesystem. Adding cipher number sixteen
 * means creating one folder with an `index.ts` that default-exports a
 * `CipherModule` — no edit to a central list, no route to register, no UI to
 * touch. If you find yourself editing this file to add a cipher, something has
 * gone wrong.
 */
import type { CipherModule, Tier } from './types';

/** Catalogue grouping. Ordered as the learning path, not alphabetically. */
export const FAMILIES = [
  {
    id: 'classical',
    label: 'Classical',
    description: 'Pen-and-paper ciphers. Every one of them is broken, and that is the lesson.',
  },
  {
    id: 'hashing',
    label: 'Hashing',
    description: 'One-way functions. No key, no decryption, and a great deal of misuse.',
  },
  {
    id: 'symmetric',
    label: 'Symmetric',
    description: 'One shared key. Modern, fast, and unforgiving of a repeated nonce.',
  },
  {
    id: 'asymmetric',
    label: 'Asymmetric',
    description: 'Two keys. How strangers agree on a secret in the open.',
  },
] as const satisfies readonly { id: CipherModule['family']; label: string; description: string }[];

const FAMILY_ORDER: readonly CipherModule['family'][] = FAMILIES.map((f) => f.id);

/**
 * Which optional member each tier promises. A cipher that lists a tier without
 * the implementation behind it would render an empty tab, so the registry
 * refuses to load instead.
 */
const TIER_REQUIREMENTS: Partial<Record<Tier, keyof CipherModule>> = {
  attack: 'attack',
  visualize: 'visualize',
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Checks every invariant the UI depends on and throws with all violations at
 * once, so one run fixes one round of mistakes rather than one mistake.
 *
 * Exported for its own test. Called at module load in development.
 */
export function validateRegistry(entries: readonly { path: string; cipher: CipherModule }[]): void {
  const problems: string[] = [];
  const seenSlugs = new Map<string, string>();

  for (const { path, cipher } of entries) {
    const where = `${path} (${cipher.slug || 'no slug'})`;

    if (!SLUG_PATTERN.test(cipher.slug)) {
      problems.push(`${where}: slug must be lowercase kebab-case and URL-safe.`);
    }

    const firstSeenAt = seenSlugs.get(cipher.slug);
    if (firstSeenAt !== undefined) {
      problems.push(`${where}: slug '${cipher.slug}' is already used by ${firstSeenAt}.`);
    } else {
      seenSlugs.set(cipher.slug, path);
    }

    if (cipher.tiers.length === 0) {
      problems.push(`${where}: tiers is empty, so the cipher would render no panels.`);
    }
    if (!cipher.tiers.includes('encrypt')) {
      problems.push(`${where}: tiers must include 'encrypt'.`);
    }
    if (new Set(cipher.tiers).size !== cipher.tiers.length) {
      problems.push(`${where}: tiers contains a duplicate.`);
    }

    for (const tier of cipher.tiers) {
      const required = TIER_REQUIREMENTS[tier];
      if (required !== undefined && cipher[required] === undefined) {
        problems.push(`${where}: tier '${tier}' is declared but ${required}() is not implemented.`);
      }
    }

    const seenParams = new Set<string>();
    for (const spec of cipher.params) {
      if (seenParams.has(spec.name)) {
        problems.push(`${where}: two params share the name '${spec.name}'.`);
      }
      seenParams.add(spec.name);

      if (spec.kind === 'number' && (spec.default < spec.min || spec.default > spec.max)) {
        problems.push(
          `${where}: param '${spec.name}' defaults to ${spec.default}, outside ${spec.min}..${spec.max}.`,
        );
      }
      if (spec.kind === 'select' && !spec.options.some((o) => o.value === spec.default)) {
        problems.push(`${where}: param '${spec.name}' defaults to '${spec.default}', not an option.`);
      }
      if (spec.kind === 'bytes' && spec.lengthBytes <= 0) {
        problems.push(`${where}: param '${spec.name}' has lengthBytes ${spec.lengthBytes}.`);
      }
    }

    if (!cipher.explainer.toLowerCase().includes('how this breaks')) {
      problems.push(
        `${where}: explainer is missing a "How this breaks" section. Every cipher must ship its own failure.`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Cipher registry is invalid:\n  - ${problems.join('\n  - ')}`);
  }
}

const discovered = import.meta.glob<{ default: CipherModule }>('./**/index.ts', { eager: true });

const entries = Object.entries(discovered).map(([path, mod]) => {
  const cipher = mod.default;
  if (cipher === undefined || typeof cipher !== 'object') {
    throw new Error(`${path}: expected a default export of a CipherModule.`);
  }
  return { path, cipher };
});

if (import.meta.env.DEV) {
  validateRegistry(entries);
}

/** Every registered cipher, ordered by family and then by name. */
export const ciphers: readonly CipherModule[] = entries
  .map((e) => e.cipher)
  .sort(
    (a, b) =>
      FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) ||
      a.name.localeCompare(b.name),
  );

const bySlug = new Map(ciphers.map((c) => [c.slug, c]));

/** Returns undefined for an unknown slug; the caller decides what the user sees. */
export function getCipher(slug: string | undefined): CipherModule | undefined {
  return slug === undefined ? undefined : bySlug.get(slug);
}

/** Families that actually contain a cipher, in learning-path order. */
export function populatedFamilies(): { id: CipherModule['family']; label: string; description: string; ciphers: CipherModule[] }[] {
  return FAMILIES.map((family) => ({
    ...family,
    ciphers: ciphers.filter((c) => c.family === family.id),
  })).filter((group) => group.ciphers.length > 0);
}
