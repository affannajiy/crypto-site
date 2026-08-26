/**
 * The alphabet plumbing every letter cipher needs.
 *
 * The first eleven ciphers each carried their own copy of these four functions,
 * which was fine at two and silly at eleven. New modules import them from here.
 * The older ones keep their local copies: rewriting a working, tested algorithm to
 * save nine lines is churn, not cleanup.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */

export const ALPHABET_SIZE = 26;
export const A_TO_Z = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const UPPER_A = 65;
const LOWER_A = 97;

/** 0-25 for A-Z or a-z, and -1 for everything else. */
export function letterIndex(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= UPPER_A && code <= UPPER_A + 25) return code - UPPER_A;
  if (code >= LOWER_A && code <= LOWER_A + 25) return code - LOWER_A;
  return -1;
}

export function isUpperCase(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= UPPER_A && code <= UPPER_A + 25;
}

export function letterFromIndex(index: number, upper = true): string {
  return String.fromCharCode((upper ? UPPER_A : LOWER_A) + normalise(index));
}

/** Wraps into 0..25, including for negative inputs, where `%` alone does not. */
export function normalise(n: number): number {
  return ((n % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE;
}

/** Uppercase A-Z only, everything else discarded. What a cryptanalyst sees. */
export function lettersOnly(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const index = letterIndex(text.charAt(i));
    if (index !== -1) out += A_TO_Z.charAt(index);
  }
  return out;
}

/**
 * Names a character for a sentence a person reads. A literal space inside
 * quotation marks is invisible, and invisible is not an explanation.
 */
export function describeChar(char: string): string {
  switch (char) {
    case ' ':
      return 'the space';
    case '\n':
      return 'the line break';
    case '\t':
      return 'the tab';
    default:
      return `'${char}'`;
  }
}

/**
 * The letters of `key`, as indices. Returns an empty array for a key with no
 * letters in it, and every caller has to decide what that means rather than
 * being handed a silent default.
 */
export function keyIndices(key: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < key.length; i += 1) {
    const index = letterIndex(key.charAt(i));
    if (index !== -1) out.push(index);
  }
  return out;
}
