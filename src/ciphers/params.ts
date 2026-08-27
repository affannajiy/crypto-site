/**
 * Values for a cipher's params, without React.
 *
 * These live beside the contract rather than inside `ParamControls` because a
 * unit test and the registry's own checks need them, and neither of those may
 * import a component — the workbench is not the only thing that has to know what
 * a `ParamSpec` means.
 */
import { randomBytes, toHex } from '../lib/format';
import type { CipherModule, ParamSpec, Params } from './types';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const HEX = '0123456789abcdef';

export function defaultParams(specs: readonly ParamSpec[]): Params {
  const values: Params = {};
  for (const spec of specs) {
    values[spec.name] = spec.kind === 'bytes' ? toHex(randomBytes(spec.lengthBytes)) : spec.default;
  }
  return values;
}

/** A uniform integer in [min, max], from the platform's CSPRNG. */
function randomInt(min: number, max: number): number {
  const span = max - min + 1;
  const scratch = new Uint32Array(1);
  crypto.getRandomValues(scratch);
  return min + ((scratch[0] ?? 0) % span);
}

function randomString(alphabet: string, length: number): string {
  const scratch = new Uint8Array(length);
  crypto.getRandomValues(scratch);
  return Array.from(scratch, (byte) => alphabet[byte % alphabet.length] ?? '').join('');
}

/**
 * Whether a value for this param can be invented at all.
 *
 * A number can always be randomised from its own range and a select from its own
 * options. Text cannot: a Vigenere keyword and an AES key are both strings, and
 * the cipher is the only thing that knows which it wants — so a text param opts
 * in with `randomise`, and one that does not is left alone rather than filled
 * with letters that will throw.
 */
export function canRandomise(spec: ParamSpec): boolean {
  switch (spec.kind) {
    case 'number':
      return true;
    case 'select':
      return spec.options.length > 1;
    case 'text':
      return spec.randomise !== undefined;
    case 'bytes':
      return true;
  }
}

/** A fresh value for one param. Returns undefined when it cannot invent one. */
export function randomValue(spec: ParamSpec): string | number | undefined {
  switch (spec.kind) {
    case 'number':
      return randomInt(spec.min, spec.max);
    case 'select': {
      const option = spec.options[randomInt(0, spec.options.length - 1)];
      return option?.value;
    }
    case 'text': {
      if (spec.randomise === undefined) return undefined;
      const alphabet = spec.randomise.alphabet === 'hex' ? HEX : LETTERS;
      return randomString(alphabet, spec.randomise.length);
    }
    case 'bytes':
      return toHex(randomBytes(spec.lengthBytes));
  }
}

/** Fresh values for every param that can have one, leaving the rest untouched. */
export function randomParams(specs: readonly ParamSpec[], current: Params): Params {
  const next: Params = { ...current };
  for (const spec of specs) {
    const value = randomValue(spec);
    if (value !== undefined) next[spec.name] = value;
  }
  return next;
}

/**
 * Whether a cipher offers a randomise button at all.
 *
 * A cipher whose only text param is Enigma's plugboard string, and which
 * declares no `randomKey`, gets no button rather than a button that does
 * nothing.
 */
export function cipherCanRandomise(cipher: CipherModule): boolean {
  return cipher.randomKey !== undefined || cipher.params.some(canRandomise);
}

/**
 * A fresh key for a whole cipher: its own generator when it has one, and the
 * per-param path when it does not.
 */
export function randomKeyFor(cipher: CipherModule, current: Params): Params {
  if (cipher.randomKey !== undefined) return { ...current, ...cipher.randomKey() };
  return randomParams(cipher.params, current);
}

/** A uniform integer in [min, max]. Exported for a cipher writing `randomKey`. */
export function randomIntInclusive(min: number, max: number): number {
  return randomInt(min, max);
}
