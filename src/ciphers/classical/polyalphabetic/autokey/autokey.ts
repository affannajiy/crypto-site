/**
 * The autokey cipher.
 *
 * This is Vigenere's own answer to the flaw in Vigenere, and it is much older than
 * the flaw's discovery: Blaise de Vigenere described it in 1586, and the weaker
 * repeating-key cipher that carries his name is the one history remembered.
 *
 * The idea removes the repetition at its root. A Vigenere key of length 8 repeats
 * every 8 letters, and Kasiski and Friedman both attack exactly that. So do not
 * repeat it — after the keyword runs out, **use the message itself as the key**:
 *
 *     plaintext   A T T A C K A T D A W N
 *     keystream   K E Y A T T A C K A T D      (keyword KEY, then the plaintext)
 *
 * The keystream is now as long as the message and never repeats. The index of
 * coincidence of the key is English rather than flat, which is a real weakness,
 * but the periodic structure that Kasiski needs is simply gone.
 *
 * Decryption has to run strictly left to right: key letter `i` is plaintext letter
 * `i - m`, which you only know once you have decrypted it. That is why `autokey`
 * below cannot be written as a `map`, and why an error at one letter destroys
 * every letter after it rather than just that one.
 *
 * There is also a **ciphertext autokey** variant, which appends the ciphertext
 * instead. It is easier to use and much weaker, and the explainer covers why.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../../types';
import {
  A_TO_Z,
  describeChar,
  isUpperCase,
  keyIndices,
  letterFromIndex,
  letterIndex,
  normalise,
} from '../../../../lib/letters';

export type Direction = 'encrypt' | 'decrypt';

/** The keyword's letters as 0-25, or [0] for a keyword with no letters. */
export function keywordValues(keyword: string): number[] {
  const values = keyIndices(keyword);
  return values.length === 0 ? [0] : values;
}

/** The keyword as the trace shows it: uppercase, letters only. */
export function normalisedKeyword(keyword: string): string {
  return keywordValues(keyword)
    .map((n) => A_TO_Z.charAt(n))
    .join('');
}

/**
 * The full keystream for a message, as letters.
 *
 * Exported because it is the thing worth looking at: the keyword at the front, the
 * plaintext behind it, and nothing repeating anywhere.
 */
export function keystreamFor(plaintextLetters: string, keyword: string): string {
  const head = normalisedKeyword(keyword);
  return (head + plaintextLetters).slice(0, plaintextLetters.length);
}

/**
 * The cipher, untraced. Used by the benchmark.
 *
 * One loop for both directions on purpose. Encryption knows the plaintext up
 * front; decryption recovers it as it goes and feeds it back into the same
 * keystream. Writing them separately would hide that they are one process.
 */
export function autokey(text: string, keyword: string, direction: Direction): string {
  const head = keywordValues(keyword);
  const stream: number[] = [];
  let out = '';
  let position = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const index = letterIndex(char);
    if (index === -1) {
      // The key advances on letters only, matching every other cipher here.
      out += char;
      continue;
    }

    const keyValue = position < head.length ? (head[position] ?? 0) : (stream[position - head.length] ?? 0);
    const result =
      direction === 'encrypt' ? normalise(index + keyValue) : normalise(index - keyValue);

    // The keystream is always made of *plaintext*: the input when encrypting, the
    // answer when decrypting. This one line is the whole autokey idea.
    stream.push(direction === 'encrypt' ? index : result);

    out += letterFromIndex(result, isUpperCase(char));
    position += 1;
  }

  return out;
}

/** The cipher again, one `Step` per character, non-letters included. */
export function autokeyTrace(text: string, keyword: string, direction: Direction): TraceResult {
  const head = keywordValues(keyword);
  const headText = normalisedKeyword(keyword);
  const stream: number[] = [];
  const steps: Step[] = [];
  let output = '';
  let position = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const fromIndex = letterIndex(char);

    if (fromIndex === -1) {
      output += char;
      steps.push({
        index: i,
        title: `Pass ${describeChar(char)} through`,
        detail: `${describeChar(char)} is not a letter A-Z, so it is left alone and the keystream does not advance.`,
        input: char,
        output: char,
        highlight: { start: i, end: i + 1 },
        data: { isLetter: false, keyword: headText },
      });
      continue;
    }

    const fromKeyword = position < head.length;
    const keyValue = fromKeyword ? (head[position] ?? 0) : (stream[position - head.length] ?? 0);
    const keyChar = A_TO_Z.charAt(keyValue);
    const raw = direction === 'encrypt' ? fromIndex + keyValue : fromIndex - keyValue;
    const toIndex = normalise(raw);
    const upper = isUpperCase(char);
    const toChar = letterFromIndex(toIndex, upper);

    stream.push(direction === 'encrypt' ? fromIndex : toIndex);
    output += toChar;

    const source = fromKeyword
      ? `letter ${position + 1} of the keyword`
      : `the plaintext letter ${head.length} places back — position ${position - head.length + 1} of the message`;

    steps.push({
      index: i,
      title: `${char.toUpperCase()} ${direction === 'encrypt' ? '+' : '−'} ${keyChar} → ${toChar.toUpperCase()}`,
      detail: `The key letter here is ${keyChar}, taken from ${source}. ${char.toUpperCase()} is ${fromIndex} and ${keyChar} is ${keyValue}, so ${fromIndex} ${direction === 'encrypt' ? '+' : '−'} ${keyValue} = ${raw}${raw === toIndex ? '' : ` ≡ ${toIndex} (mod 26)`} → ${toChar.toUpperCase()}.${fromKeyword ? '' : ' Nothing repeats: this key letter came from the message itself.'}`,
      input: char,
      output: toChar,
      highlight: { start: i, end: i + 1 },
      data: {
        isLetter: true,
        upper,
        fromIndex,
        toIndex,
        keyValue,
        keyChar,
        position,
        fromKeyword,
        keywordLength: head.length,
        keyword: headText,
        direction,
      },
    });

    position += 1;
  }

  return { output, steps };
}
