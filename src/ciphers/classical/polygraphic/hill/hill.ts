/**
 * The Hill cipher.
 *
 * Lester Hill, 1929, and the first cipher in this app that is genuinely
 * mathematics rather than clever bookkeeping. Every other classical cipher here
 * treats a letter as a thing to be shifted, mirrored or moved. Hill treats a pair
 * of letters as a **vector**, and the key as a **matrix**:
 *
 *     | c1 |   | a  b | | p1 |
 *     |    | = |      | |    |   (mod 26)
 *     | c2 |   | c  d | | p2 |
 *
 * That one change buys something no cipher before it had: each output letter
 * depends on *every* input letter of the block. Change one letter of the
 * plaintext and both letters of that ciphertext pair change. Modern block ciphers
 * call this **diffusion**, and this is where it enters the story.
 *
 * The price is that the key is not any four numbers. The matrix has to be
 * invertible modulo 26, which means its determinant must be coprime with 26 — the
 * same coprimality condition the Affine cipher ran into, one dimension up. This
 * file refuses a singular matrix rather than producing a ciphertext nobody can
 * decrypt.
 *
 * Like Playfair, this works on letters only and pads an odd-length message, so
 * the ciphertext is not the same length as the input and spacing does not survive.
 * A block cipher has to be fed whole blocks; that is a property of the family, not
 * an oversight.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export const ALPHABET_SIZE = 26;

/** Two letters per block. Hill generalises to any size; the page draws 2x2. */
export const BLOCK = 2;

/** The letter used to fill an odd-length message out to a whole block. */
export const PADDING = 'X';

export type Direction = 'encrypt' | 'decrypt';

/** A key matrix, row by row: [a, b, c, d] means [[a, b], [c, d]]. */
export type Matrix = readonly [number, number, number, number];

/** Wraps any integer into 0-25, including negatives. */
export function normalise(n: number): number {
  return ((n % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

/**
 * The multiplicative inverse of `n` modulo 26, or 0 when there is none.
 *
 * Modular arithmetic has no division, so undoing a multiplication means
 * multiplying by the number that turns it back into 1. Only the twelve values
 * coprime with 26 have one — exactly the twelve the Affine cipher offers as
 * multipliers, for exactly this reason.
 */
export function modInverse(n: number): number {
  const value = normalise(n);
  if (gcd(value, ALPHABET_SIZE) !== 1) return 0;
  for (let candidate = 1; candidate < ALPHABET_SIZE; candidate += 1) {
    if ((value * candidate) % ALPHABET_SIZE === 1) return candidate;
  }
  return 0;
}

/** ad − bc, wrapped into 0-25. */
export function determinant(m: Matrix): number {
  return normalise(m[0] * m[3] - m[1] * m[2]);
}

/**
 * Whether this matrix can be used as a key.
 *
 * The condition is that the determinant has an inverse mod 26 — equivalently that
 * it shares no factor with 26. A determinant of 0, 2, 13 or any even number fails,
 * and a matrix that fails cannot be undone: two different messages encrypt to the
 * same ciphertext, so no decryption exists at all.
 */
export function isInvertible(m: Matrix): boolean {
  return modInverse(determinant(m)) !== 0;
}

/**
 * The inverse key matrix. For 2x2 this is the adjugate over the determinant, and
 * "over" means multiplied by the determinant's modular inverse:
 *
 *     inverse = det^-1 * |  d  -b |
 *                        | -c   a |
 */
export function inverseMatrix(m: Matrix): Matrix {
  const inverseDet = modInverse(determinant(m));
  if (inverseDet === 0) {
    throw new Error(
      `This matrix has determinant ${determinant(m)}, which shares a factor with 26, so it has no inverse and nothing encrypted with it could ever be decrypted. Pick a key whose determinant is odd and not 13.`,
    );
  }
  return [
    normalise(inverseDet * m[3]),
    normalise(inverseDet * -m[1]),
    normalise(inverseDet * -m[2]),
    normalise(inverseDet * m[0]),
  ] as const;
}

/** One matrix-vector product, mod 26. This is the entire cipher. */
export function apply(m: Matrix, first: number, second: number): [number, number] {
  return [normalise(m[0] * first + m[1] * second), normalise(m[2] * first + m[3] * second)];
}

/** Letters only, uppercased. A block cipher has to be fed whole blocks. */
export function lettersOnly(text: string): string {
  return text.replace(/[^A-Za-z]/g, '').toUpperCase();
}

/**
 * The message reduced to whole blocks, plus a map back to where each letter came
 * from in the text the user typed.
 *
 * `sources[i]` is the index in the **original** text of the ith letter, or -1 for
 * a padding letter that was never sent. Without this the input pane would
 * highlight the wrong characters the moment the message contained a space: the
 * algorithm counts letters, and the pane counts characters.
 */
export interface Prepared {
  letters: string;
  sources: number[];
  padded: boolean;
}

export function prepare(text: string): Prepared {
  const letters: string[] = [];
  const sources: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (/[A-Za-z]/.test(char)) {
      letters.push(char.toUpperCase());
      sources.push(i);
    }
  }

  const padded = letters.length % BLOCK !== 0;
  if (padded) {
    letters.push(PADDING);
    sources.push(-1);
  }
  return { letters: letters.join(''), sources, padded };
}

/** The cipher, untraced. Used by the benchmark. */
export function hill(text: string, key: Matrix, direction: Direction = 'encrypt'): string {
  if (!isInvertible(key)) {
    throw new Error(
      `This matrix has determinant ${determinant(key)}, which shares a factor with 26. The cipher would be impossible to decrypt, so it stops here instead. Pick a key whose determinant is odd and not 13.`,
    );
  }
  const matrix = direction === 'encrypt' ? key : inverseMatrix(key);

  const { letters } = prepare(text);
  let out = '';
  for (let i = 0; i < letters.length; i += BLOCK) {
    const first = letters.charCodeAt(i) - 65;
    const second = letters.charCodeAt(i + 1) - 65;
    const [x, y] = apply(matrix, first, second);
    out += String.fromCharCode(65 + x, 65 + y);
  }
  return out;
}

/**
 * The cipher again, emitting one `Step` per **pair**, because the pair is the
 * unit the algorithm actually works on. A per-letter trace would have to lie
 * about when each output letter is known: neither one exists until both inputs
 * have been read, which is the whole property worth teaching here.
 *
 * Both `highlight` and `outputHighlight` are set and cover two characters each.
 */
export function hillTrace(text: string, key: Matrix, direction: Direction = 'encrypt'): TraceResult {
  const output = hill(text, key, direction);
  const matrix = direction === 'encrypt' ? key : inverseMatrix(key);
  const { letters, sources, padded } = prepare(text);

  const steps: Step[] = [];
  for (let i = 0; i < letters.length; i += BLOCK) {
    const index = i / BLOCK;
    const firstChar = letters.charAt(i);
    const secondChar = letters.charAt(i + 1);
    const first = firstChar.charCodeAt(0) - 65;
    const second = secondChar.charCodeAt(0) - 65;
    const [x, y] = apply(matrix, first, second);
    const outFirst = String.fromCharCode(65 + x);
    const outSecond = String.fromCharCode(65 + y);

    const isPad = padded && i + BLOCK === letters.length;
    const rawX = matrix[0] * first + matrix[1] * second;
    const rawY = matrix[2] * first + matrix[3] * second;

    steps.push({
      index,
      title: `${firstChar}${secondChar} → ${outFirst}${outSecond}`,
      detail: `${firstChar} is ${first} and ${secondChar} is ${second}, so the pair is the vector (${first}, ${second})${
        isPad ? `, where the ${PADDING} was added to complete the block — the message had an odd number of letters` : ''
      }. Multiplying by the key: (${matrix[0]} × ${first}) + (${matrix[1]} × ${second}) = ${rawX}, which wraps to ${x} → ${outFirst}. And (${matrix[2]} × ${first}) + (${matrix[3]} × ${second}) = ${rawY}, which wraps to ${y} → ${outSecond}. Both output letters used both input letters, which is the property that makes this different from every cipher before it.`,
      input: `${firstChar}${secondChar}`,
      output: `${outFirst}${outSecond}`,
      // The input range covers the two source characters in the text as typed,
      // which is not `i` once the message contains a space. A padding letter has
      // no source, so the range collapses onto the letter before it.
      highlight: inputRange(sources, i),
      outputHighlight: { start: i, end: i + BLOCK },
      data: {
        first,
        second,
        firstChar,
        secondChar,
        outFirst,
        outSecond,
        x,
        y,
        rawX,
        rawY,
        matrix: [...matrix],
        isPad,
        direction,
      },
    });
  }

  return { output, steps };
}

/** The span of original text the block at stripped index `i` came from. */
function inputRange(sources: number[], i: number): { start: number; end: number } {
  const first = sources[i] ?? 0;
  const second = sources[i + 1] ?? -1;
  const last = second === -1 ? first : second;
  return { start: first, end: last + 1 };
}
