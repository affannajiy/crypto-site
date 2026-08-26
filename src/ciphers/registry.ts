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
    id: 'encoding',
    label: 'Encoding',
    description:
      'Not cryptography at all. Here so the difference between hiding a message and merely rewriting it is on the same screen as the ciphers.',
  },
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
 * Sub-headings inside a family, in learning-path order.
 *
 * A cipher's group is its **parent folder** — `classical/substitution/caesar`
 * is in Substitution — so a cipher still declares nothing and the folder tree is
 * the curriculum. This list only says what order the headings appear in, which is
 * a pedagogical decision about the whole catalogue rather than a fact about any
 * one cipher, so it lives here. Adding a cipher to an existing group needs no
 * edit; inventing a new group costs one line, and an unlisted group sorts last.
 */
export const GROUPS: readonly { id: string; label: string; description: string }[] = [
  { id: 'substitution', label: 'Substitution', description: 'One letter stands for another. The whole family falls to counting.' },
  { id: 'polyalphabetic', label: 'Polyalphabetic', description: 'Several substitution alphabets in rotation, chosen by a keyword.' },
  { id: 'transposition', label: 'Transposition', description: 'The letters are the same. Only the order changed.' },
  { id: 'polygraphic', label: 'Polygraphic', description: 'Whole blocks of letters encrypted at once, not one at a time.' },
  { id: 'fractionation', label: 'Fractionation', description: 'Split each letter into pieces, then scatter the pieces. Much harder to unpick.' },
  { id: 'mechanical', label: 'Mechanical', description: 'A machine, not a rule. The key is a physical state.' },
  { id: 'perfect-secrecy', label: 'Perfect secrecy', description: 'Provably unbreakable, and almost unusable. Both facts matter.' },
  { id: 'symmetric', label: 'Block and stream ciphers', description: 'One shared key, real key sizes, and no known practical break.' },
  { id: 'asymmetric', label: 'Public key', description: 'Encrypt with one key, decrypt with another.' },
  { id: 'key-exchange', label: 'Key exchange', description: 'Not a cipher. How two strangers agree on a key in public.' },
];

const GROUP_ORDER = GROUPS.map((g) => g.id);

/**
 * The folder a cipher sits in, or undefined for a family with no sub-folders.
 * `./classical/substitution/caesar/index.ts` -> 'substitution'.
 */
export function groupFromPath(path: string): string | undefined {
  const parts = path.replace(/^\.\//, '').split('/');
  // family / group / slug / index.ts
  return parts.length >= 4 ? parts[1] : undefined;
}

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

    // The folder name is the slug, because the catalogue reads the path for the
    // cipher's group and a folder that disagrees with its module is a trap.
    const folder = path.replace(/\/index\.ts$/, '').split('/').pop();
    if (folder !== cipher.slug) {
      problems.push(`${where}: folder is '${folder ?? '?'}' but the slug is '${cipher.slug}'.`);
    }

    const group = groupFromPath(path);
    if (group !== undefined && !GROUP_ORDER.includes(group)) {
      problems.push(
        `${where}: folder group '${group}' is not in GROUPS, so it would sort last with no heading text.`,
      );
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

const groupOf = new Map(entries.map((e) => [e.cipher.slug, groupFromPath(e.path)]));

/** Where a cipher's group sits in the learning path. Unlisted groups sort last. */
function rankOf(cipher: CipherModule): number {
  const group = groupOf.get(cipher.slug);
  if (group === undefined) return -1;
  const at = GROUP_ORDER.indexOf(group);
  return at === -1 ? GROUP_ORDER.length : at;
}

/** Every registered cipher, ordered by family, then learning path, then name. */
export const ciphers: readonly CipherModule[] = entries
  .map((e) => e.cipher)
  .sort(
    (a, b) =>
      FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) ||
      rankOf(a) - rankOf(b) ||
      a.name.localeCompare(b.name),
  );

const bySlug = new Map(ciphers.map((c) => [c.slug, c]));

/** Returns undefined for an unknown slug; the caller decides what the user sees. */
export function getCipher(slug: string | undefined): CipherModule | undefined {
  return slug === undefined ? undefined : bySlug.get(slug);
}

export interface CatalogueGroup {
  id: string;
  label: string;
  description: string;
  ciphers: CipherModule[];
}

export interface CatalogueFamily {
  id: CipherModule['family'];
  label: string;
  description: string;
  ciphers: CipherModule[];
  /** Sub-headings, in learning-path order. Empty when the family has no folders. */
  groups: CatalogueGroup[];
}

/** Families that actually contain a cipher, in learning-path order. */
export function populatedFamilies(): CatalogueFamily[] {
  return FAMILIES.map((family) => {
    const members = ciphers.filter((c) => c.family === family.id);
    const groups: CatalogueGroup[] = [];
    for (const spec of GROUPS) {
      const inGroup = members.filter((c) => groupOf.get(c.slug) === spec.id);
      if (inGroup.length > 0) groups.push({ ...spec, ciphers: inGroup });
    }
    // A family whose members are all ungrouped renders as one flat list.
    const grouped = groups.reduce((n, g) => n + g.ciphers.length, 0);
    return { ...family, ciphers: members, groups: grouped === members.length ? groups : [] };
  }).filter((family) => family.ciphers.length > 0);
}
