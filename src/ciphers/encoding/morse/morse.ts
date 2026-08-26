/**
 * Morse code.
 *
 * This is not a cipher and this file does not pretend otherwise. It is here
 * because the difference between **encoding** and **encryption** is the single
 * most common misunderstanding in this subject, and the fastest way to fix it is
 * to put an encoding on the same site as thirty ciphers and let it be obviously
 * different.
 *
 * Morse changes what a message looks like. It hides nothing, because there is no
 * key: the code is published, and has been since 1844. The same is true of Base64,
 * hexadecimal, URL escaping and ASCII. If a system's protection is that an
 * attacker has not yet worked out the format, it has no protection at all.
 *
 * What Morse *is* good at is worth respecting. It is a **variable-length code**
 * assigned by letter frequency — E is one dot, T is one dash, Q is dash-dash-dot-
 * dash — which is the same insight the Straddling Checkerboard uses and which
 * Huffman formalised a century later. Samuel Morse and Alfred Vail worked out the
 * frequencies by counting the type in a printer's tray.
 *
 * Plain TypeScript. Imports nothing from React and touches no DOM.
 */
import type { Step, TraceResult } from '../../types';

export type Direction = 'encode' | 'decode';

/** Letters, digits and the punctuation of the International Morse standard. */
export const TABLE: Readonly<Record<string, string>> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
};

/** The reverse table, built once. */
const FROM_CODE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(TABLE).map(([char, code]) => [code, char]),
);

/** Between letters. A word gap is `WORD_GAP`. */
export const LETTER_GAP = ' ';
export const WORD_GAP = ' / ';

/** The code for a character, or '' when Morse has none. */
export function codeFor(char: string): string {
  return TABLE[char.toUpperCase()] ?? '';
}

/** The character a code stands for, or '' when it is not in the table. */
export function charFor(code: string): string {
  return FROM_CODE[code] ?? '';
}

/**
 * The 26 letters ordered by how long their code is.
 *
 * Exported because the ordering is the interesting fact: it tracks English letter
 * frequency closely, and a test checks that the commonest letters really do have
 * the shortest codes rather than taking the story on trust.
 */
export function lettersByCodeLength(): { letter: string; code: string }[] {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    .split('')
    .map((letter) => ({ letter, code: codeFor(letter) }))
    .sort((a, b) => a.code.length - b.code.length || a.letter.localeCompare(b.letter));
}

/** Encoding, untraced. Used by the benchmark. */
export function morse(text: string): string {
  const words = text.trim().split(/\s+/).filter((w) => w !== '');
  return words
    .map((word) =>
      word
        .split('')
        .map(codeFor)
        .filter((code) => code !== '')
        .join(LETTER_GAP),
    )
    .filter((word) => word !== '')
    .join(WORD_GAP);
}

/** Decoding, untraced. */
export function unmorse(text: string): string {
  return text
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .map(charFor)
        .join(''),
    )
    .join(' ')
    .trim();
}

/** Encoding, one `Step` per character. */
export function morseTrace(text: string): TraceResult {
  const steps: Step[] = [];
  const pieces: string[] = [];
  let output = '';

  const flush = (separator: string) => {
    if (separator !== '' && output !== '') output += separator;
  };

  for (let i = 0; i < text.length; i += 1) {
    const raw = text.charAt(i);

    if (/\s/.test(raw)) {
      if (output !== '' && !output.endsWith(WORD_GAP)) {
        const at = output.length;
        output += WORD_GAP;
        steps.push({
          index: i,
          title: 'Word gap',
          detail: `A space between words is sent as a longer pause, written here as a slash. Morse has three units of silence between letters and seven between words, so the gaps carry real information — which is why a stream with the timing stripped out is genuinely harder to read.`,
          input: raw,
          output: WORD_GAP,
          highlight: { start: i, end: i + 1 },
          outputHighlight: { start: at, end: at + WORD_GAP.length },
          data: { isChar: false, gap: true },
        });
      }
      continue;
    }

    const code = codeFor(raw);
    if (code === '') {
      steps.push({
        index: i,
        title: `Drop '${raw}'`,
        detail: `International Morse has no code for this character, so it is dropped. The table covers the alphabet, the digits and about a dozen punctuation marks, and nothing else — Morse was designed for a telegraph key, not for arbitrary text.`,
        input: raw,
        highlight: { start: i, end: i + 1 },
        data: { isChar: false },
      });
      continue;
    }

    flush(output.endsWith(WORD_GAP) ? '' : LETTER_GAP);
    const at = output.length;
    output += code;
    pieces.push(code);

    steps.push({
      index: i,
      title: `${raw.toUpperCase()} → ${code}`,
      detail: `${raw.toUpperCase()} is ${code}: ${code.length} ${code.length === 1 ? 'symbol' : 'symbols'}. Morse gave the shortest codes to the commonest letters — E is a single dot, T a single dash, and Q is four symbols — after counting the type in a printer's tray to work out which letters were commonest. That is a frequency-weighted variable-length code, a century before Huffman proved how to build the optimal one.`,
      input: raw,
      output: code,
      highlight: { start: i, end: i + 1 },
      outputHighlight: { start: at, end: at + code.length },
      data: { isChar: true, char: raw.toUpperCase(), code, length: code.length },
    });
  }

  const symbols = pieces.reduce((n, code) => n + code.length, 0);
  if (pieces.length > 0) {
    steps.push({
      index: text.length,
      title: `${symbols} symbols for ${pieces.length} characters`,
      detail: `That is ${(symbols / pieces.length).toFixed(2)} dots and dashes per character. A fixed-length binary code for the same alphabet would need five bits each, so the frequency weighting is doing real work — and none of it has anything to do with secrecy.`,
      data: { isChar: false, summary: true, symbols, characters: pieces.length },
    });
  }

  return { output, steps };
}

/** Decoding, one `Step` per code group. */
export function unmorseTrace(text: string): TraceResult {
  const steps: Step[] = [];
  let output = '';

  const tokens = text.trim().split(/\s+/).filter((t) => t !== '');
  for (const token of tokens) {
    if (token === '/') {
      const at = output.length;
      output += ' ';
      steps.push({
        index: steps.length,
        title: 'Word gap',
        detail: 'A slash is the long pause between words.',
        input: token,
        output: ' ',
        outputHighlight: { start: at, end: at + 1 },
        data: { isChar: false, gap: true },
      });
      continue;
    }

    const char = charFor(token);
    const at = output.length;
    output += char;
    steps.push({
      index: steps.length,
      title: `${token} → ${char === '' ? '?' : char}`,
      detail:
        char === ''
          ? `${token} is not in the International Morse table. Either a symbol was misread, or two letters ran together because the gap between them was lost.`
          : `${token} is ${char}.`,
      input: token,
      output: char,
      outputHighlight: { start: at, end: at + 1 },
      data: { isChar: char !== '', code: token, char },
    });
  }

  return { output, steps };
}
