/**
 * The Rail Fence cipher.
 *
 * The first cipher in this app that is not a substitution. Caesar and Vigenere
 * replace each letter with a different letter and leave it where it is. Rail
 * Fence does the opposite: it keeps every character exactly as it was and only
 * changes the order.
 *
 * Write the message in a zigzag across a number of rails, then read it off one
 * rail at a time:
 *
 *     rails = 3, message = WEAREDISCOVERED
 *
 *     W . . . E . . . C . . . R . .
 *     . E . R . D . S . O . E . E .
 *     . . A . . . I . . . V . . . D
 *
 *     read across the rows: WECR ERDSOEE AIVD  ->  WECRERDSOEEAIVD
 *
 * Every character takes part, spaces and punctuation included. That is a choice
 * worth naming: historically the spacing was stripped first, and keeping it makes
 * the cipher weaker, because the number of spaces and where they can land is
 * evidence. It is kept here because it makes the cipher exactly length-preserving
 * and perfectly reversible with no special cases, and because a learner can see
 * their own message survive intact inside the scramble.
 *
 * Plain TypeScript. This file imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';

export type Direction = 'encrypt' | 'decrypt';

export const MIN_RAILS = 2;
export const MAX_RAILS = 10;

/**
 * Which rail each position of the fence falls on: 0, 1, 2, 1, 0, 1, 2 ... for
 * three rails.
 *
 * A single rail has no zigzag to speak of — every character sits on it and the
 * cipher is the identity — so that case returns a flat row rather than dividing
 * by a period of zero.
 */
export function railPattern(length: number, rails: number): number[] {
  if (rails <= 1) return new Array<number>(Math.max(0, length)).fill(0);

  const pattern: number[] = [];
  let rail = 0;
  let step = 1;
  for (let i = 0; i < length; i += 1) {
    pattern.push(rail);
    // Turn round at the top and bottom rails. This is the whole zigzag.
    if (rail === 0) step = 1;
    else if (rail === rails - 1) step = -1;
    rail += step;
  }
  return pattern;
}

/**
 * The permutation the cipher applies, as `order[outputIndex] = inputIndex`.
 *
 * Everything else here is built from this one array, which is the honest shape of
 * a transposition cipher: it is a permutation and nothing more. Encrypting reads
 * the input in this order; decrypting puts each character back where it came
 * from. That symmetry is why there is no separate decryption algorithm below.
 */
export function railOrder(length: number, rails: number): number[] {
  const pattern = railPattern(length, rails);
  const order: number[] = [];
  const effective = Math.max(1, rails);
  for (let rail = 0; rail < effective; rail += 1) {
    for (let i = 0; i < length; i += 1) {
      if (pattern[i] === rail) order.push(i);
    }
  }
  return order;
}

/**
 * The whole cipher, with no trace. Used by the attack (which runs it once per
 * candidate rail count) and by the benchmark. `railFenceTrace` below is the same
 * algorithm, narrated.
 */
export function railFence(text: string, rails: number, direction: Direction = 'encrypt'): string {
  const order = railOrder(text.length, rails);

  if (direction === 'encrypt') {
    let out = '';
    for (const from of order) out += text.charAt(from);
    return out;
  }

  // Decrypting is the same permutation, read the other way round: the character
  // sitting at output position i belongs back at input position order[i].
  const restored = new Array<string>(text.length).fill('');
  for (let i = 0; i < order.length; i += 1) {
    restored[order[i] ?? 0] = text.charAt(i);
  }
  return restored.join('');
}

/**
 * Names a character for a sentence a person reads. A literal space or newline
 * inside quotation marks is invisible, and invisible is not an explanation.
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

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/**
 * The cipher again, this time emitting one `Step` per character of the input, in
 * input order — so a step's index is its position in the text the user typed and
 * the message pane needs no lookup table.
 *
 * The output pane does need one, and that is the point of `outputHighlight`. A
 * transposition moves a character to a different index; a single highlight range
 * cannot describe both panes, and pretending it can would mark the wrong
 * character in the result.
 */
export function railFenceTrace(
  text: string,
  rails: number,
  direction: Direction = 'encrypt',
): TraceResult {
  const output = railFence(text, rails, direction);
  const order = railOrder(text.length, rails);
  const pattern = railPattern(text.length, rails);

  // `order` maps output position to input position. Encrypting, a step walks the
  // input and needs the reverse of that; decrypting, the roles swap over.
  const outputOf = new Array<number>(text.length).fill(0);
  for (let outputIndex = 0; outputIndex < order.length; outputIndex += 1) {
    outputOf[order[outputIndex] ?? 0] = outputIndex;
  }

  const steps: Step[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    // Encrypting, position i of the input is a fence position, and the character
    // there ends up in the readout. Decrypting, position i of the input is a
    // readout position, and the character goes back onto the fence.
    const target = direction === 'encrypt' ? outputOf[i] ?? 0 : order[i] ?? 0;
    const fencePosition = direction === 'encrypt' ? i : target;
    const rail = pattern[fencePosition] ?? 0;

    const detail =
      direction === 'encrypt'
        ? `The zigzag puts position ${i + 1} on rail ${rail + 1} of ${Math.max(1, rails)}. Reading the rails top to bottom, this character is the ${ordinal(target + 1)} one out, so it moves from position ${i + 1} to position ${target + 1}. Nothing about the character itself changes — only where it sits.`
        : `Position ${i + 1} of the ciphertext is the ${ordinal(i + 1)} character read off the rails, which puts it back on rail ${rail + 1} at position ${target + 1} of the message. The letter is unchanged; it is going home.`;

    steps.push({
      index: i,
      title: `Move ${describeChar(char)} to position ${target + 1} (rail ${rail + 1})`,
      detail,
      input: char,
      output: char,
      highlight: { start: i, end: i + 1 },
      outputHighlight: { start: target, end: target + 1 },
      data: {
        rail,
        rails: Math.max(1, rails),
        fencePosition,
        inputIndex: i,
        outputIndex: target,
        char,
        direction,
      },
    });
  }

  return { output, steps };
}
