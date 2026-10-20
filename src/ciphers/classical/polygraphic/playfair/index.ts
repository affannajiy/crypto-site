/**
 * Playfair's entry in the registry.
 *
 * The first cipher here with **no Attack tab**, and that is a deliberate use of
 * the tier system rather than an omission. Breaking Playfair properly means
 * hill-climbing over 25-letter key squares with a quadgram statistic — a real
 * technique, but one where the interesting part is the search and not the cipher.
 * A brute-force button would be a lie about the difficulty, and a disabled tab
 * would be clutter. So the tab simply does not exist, and the explainer says how
 * the cipher falls instead.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { playfairTrace } from './playfair';
import PlayfairSquare from './PlayfairSquare';

/** Params arrive as `string | number` because they come from form controls. */
function readKeyword(p: Params): string {
  return String(p['keyword'] ?? '');
}

const explainer = `
Letters are encrypted in **pairs** on a 5×5 key square. Charles Wheatstone invented it in 1854.

## How it works

- Write the keyword into a 5×5 grid, then the rest of the alphabet. I and J share one square.
- Split the message into pairs. A doubled letter gets an X between, so BALLOON becomes BA LX LO ON. An odd length gets a Z at the end, or an X if the last letter is Z.
- **Same row:** take the letter to the right.
- **Same column:** take the letter below.
- **Otherwise:** take the other corner of the rectangle, in the letter's own row.
- To decrypt, go left and up instead. Spaces and punctuation are dropped.

## Lecture note

- The slides use MONARCHY and INSTRUMENTS and give ST → TL, ME → CL and NT → RQ. The other pairs are IN → GA, RU → MZ and SZ → TX.
- The quiz words give BY → DB and OF → HP.
- The slides call Playfair both monoalphabetic and polyalphabetic. Neither name fits. The usual name is **polygraphic**, which is its heading here.

## How this breaks

- **Pair frequencies survive.** TH and HE are the most common English pairs. A few hundred letters of ciphertext is enough.
- **The square is not random.** After the keyword, the grid is in alphabetical order.
- **A pair never encrypts to itself.** That rules out candidates.
- **There is no Attack tab.** The real attack is a hill-climbing search over squares. The search is the interesting part, not the cipher.
`.trim();

const playfairCipher: CipherModule = {
  slug: 'playfair',
  name: 'Playfair Cipher',
  family: 'classical',
  year: '1854',
  origin: 'Charles Wheatstone, promoted by Lord Playfair',
  keyType: 'A keyword building a 5x5 square',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['digraph', 'polygraphic', 'wheatstone', 'square'],
  blurb: 'Letters are encrypted in pairs, using three rules on a 5x5 key square.',
  explainer,
  // No 'attack'. See the note at the top of this file — the tab does not exist
  // rather than existing and doing something dishonest.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'keyword',
      label: 'Keyword',
      default: 'MONARCHY',
      placeholder: 'A memorable word. It fills the square, then the alphabet follows',
      randomise: { alphabet: 'letters', length: 8 },
    },
  ],
  quizzes: [
    {
      question:
        'The slide splits INSTRUMENTS into in st ru me nt sz and gives st → TL, me → CL and nt → RQ. Complete the rest: in, ru and sz.',
      run: { input: 'instruments', params: { keyword: 'MONARCHY' } },
      note: 'The answer is the whole ciphertext. The pairs in, ru and sz are its first, third and sixth pairs. The z in sz is the padding for an odd length.',
    },
    {
      question: 'Find the ciphertext for "by".',
      run: { input: 'by', params: { keyword: 'MONARCHY' } },
    },
    {
      question: 'Find the ciphertext for "of".',
      run: { input: 'of', params: { keyword: 'MONARCHY' } },
    },
  ],
  examples: [
    {
      label: 'Lecture example: INSTRUMENTS',
      input: 'instruments',
      params: { keyword: 'MONARCHY' },
    },
    {
      label: 'Lecture quiz: BY and OF',
      input: 'by of',
      params: { keyword: 'MONARCHY' },
    },
    {
      label: 'Lab sheet: HIDEMONEY, padded with Z',
      input: 'HIDEMONEY',
      params: { keyword: 'MONARCHY' },
    },
    {
      label: 'A doubled letter, split by X',
      input: 'balloon',
      params: { keyword: 'MONARCHY' },
    },
    {
      label: 'A longer message',
      input: 'Meet me at the old bridge at midnight.',
      params: { keyword: 'MONARCHY' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return playfairTrace(input, readKeyword(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return playfairTrace(input, readKeyword(p), 'decrypt');
  },

  visualize: PlayfairSquare,
};

export default playfairCipher;
