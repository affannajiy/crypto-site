/**
 * The Feistel structure's entry in the registry.
 *
 * This is a structure more than a cipher: DES is one instance of it, and this
 * page is the lecture's 8-bit instance with F = R XOR K. It sits first in the
 * Block ciphers group so that DES, Triple DES and AES read as instances of the
 * ideas it introduces.
 *
 * **No Attack tab.** This F is linear, so one known plaintext and its ciphertext
 * decrypt everything else. That is a known-plaintext attack, and
 * `attack(ciphertext)` cannot be handed the known pair. This is gap 6 again.
 * The explainer works the attack by hand instead.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { type BlockBits, feistelTrace, readKeys } from './feistel';
import FeistelLadder from './FeistelLadder';

function readOptions(p: Params) {
  const blockBits: BlockBits = String(p['blockBits'] ?? '8') === '16' ? 16 : 8;
  return {
    blockBits,
    keys: readKeys(String(p['keys'] ?? ''), blockBits),
    finalSwap: String(p['finalSwap'] ?? 'no') === 'yes',
    format: String(p['format'] ?? 'binary') === 'text' ? ('text' as const) : ('binary' as const),
  };
}

const explainer = `
A structure, not one cipher. Horst Feistel designed it at IBM in the early 1970s, and DES is built on it.

    L(i) = R(i-1)
    R(i) = L(i-1) XOR F(R(i-1), K(i-1))

## How it works

- Put the right half through F with the round key, XOR the result into the left half, then swap the halves. Run one round per key.
- In the lecture, F is simply **R XOR K**.
- To decrypt, run the same rounds with the keys in reverse order. F is never run backwards, so F does not need to be invertible.
- Set *Message* to Text to encrypt a sentence. Each letter is one 8-bit block.

## Lecture note

- 10110110 with the keys 0110, 1100, 1010 gives **00010000**. Decrypting 00010000 gives 10110110.
- The worked example joins L3 || R3 with no final swap. The *Final swap* control adds the swap from the diagram.
- Quiz 1 lists five design features: block size, key size, number of rounds, subkey generation and round function F. Larger is safer but slower.

## How this breaks

- **This F is linear.** E(P) XOR E(P') does not depend on the key. Therefore one known plaintext and its ciphertext decrypt everything. This is a known-plaintext attack.
- **There is no Attack tab.** The attack needs that known pair.
- **Real ciphers add non-linear S-boxes and more rounds.** DES uses 16.
`.trim();

const feistelCipher: CipherModule = {
  slug: 'feistel',
  name: 'Feistel Cipher',
  family: 'symmetric',
  year: '1973',
  origin: 'Horst Feistel, IBM',
  keyType: 'One binary round key per round, each half a block wide',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['feistel structure', 'feistel network', 'round function', 'block cipher', 'lecture 04', 'ladder'],
  blurb: 'Split, mix one half into the other, swap, repeat. The structure inside DES, at the size of the lecture example.',
  explainer,
  visualizeNote:
    'The lecture draws the Feistel structure as a ladder. This is that ladder for the current run, with every half written in its box. Pick a round to see the slide working beside it.',
  // No 'attack'. The break is a known-plaintext attack, which needs a plaintext
  // and ciphertext pair the attack signature cannot receive. See the file header.
  tiers: ['encrypt', 'visualize'],
  params: [
    {
      kind: 'text',
      name: 'keys',
      label: 'Round keys (binary, one per round, half a block wide)',
      default: '0110 1100 1010',
      placeholder: '0110 1100 1010',
    },
    {
      kind: 'select',
      name: 'blockBits',
      label: 'Block size',
      options: [
        { value: '8', label: '8 bits — 4-bit halves, as in the lecture' },
        { value: '16', label: '16 bits — 8-bit halves' },
      ],
      default: '8',
    },
    {
      kind: 'select',
      name: 'finalSwap',
      label: 'Final swap after the last round',
      options: [
        { value: 'no', label: 'No — L(n) || R(n), as the worked example' },
        { value: 'yes', label: 'Yes — R(n) || L(n), as the diagram and DES' },
      ],
      default: 'no',
    },
    {
      kind: 'select',
      name: 'format',
      label: 'Message',
      options: [
        { value: 'binary', label: 'Binary — blocks of 0 and 1, as in the lecture' },
        { value: 'text', label: 'Text — each character as its 8-bit byte' },
      ],
      default: 'binary',
      randomise: false,
    },
  ],
  textParams: { format: 'text' },
  quizzes: [
    {
      question: 'Perform decryption using the encryption example: ciphertext 00010000, round keys 0110, 1100, 1010.',
      run: { input: '00010000', params: { keys: '0110 1100 1010' }, direction: 'decrypt' },
      note: 'You get the plaintext 10110110 back. Decryption is the same rounds with the keys in reverse order: 1010, then 1100, then 0110.',
    },
    {
      question: 'Quiz 1: list all design features proposed by the Feistel cipher structure.',
      answer:
        'Block size, key size, number of rounds, subkey generation algorithm, and round function F. For each one, more (larger, more complex) means more security and less speed.',
    },
  ],
  examples: [
    {
      label: 'Lecture example: 10110110, 3 rounds',
      input: '10110110',
      params: { keys: '0110 1100 1010', blockBits: '8', finalSwap: 'no' },
    },
    {
      label: 'With the final swap, as the diagram draws it',
      input: '10110110',
      params: { keys: '0110 1100 1010', blockBits: '8', finalSwap: 'yes' },
    },
    {
      label: 'One round only: half the block passes through untouched',
      input: '10110110',
      params: { keys: '0110', blockBits: '8', finalSwap: 'no' },
    },
    {
      label: 'Two blocks, 16-bit, 4 rounds',
      input: '0100100001101001 0010000100100001',
      params: { keys: '10101010 11001100 11110000 00001111', blockBits: '16', finalSwap: 'yes' },
    },
    {
      label: 'A word as text: each letter is one 8-bit block',
      input: 'feistel',
      params: { keys: '0110 1100 1010', blockBits: '8', finalSwap: 'no', format: 'text' },
    },
  ],

  randomKey(): Params {
    const half = 4;
    const key = () => Array.from({ length: half }, () => (Math.random() < 0.5 ? '0' : '1')).join('');
    return { keys: [key(), key(), key()].join(' '), blockBits: '8', finalSwap: 'no' };
  },

  encrypt(input: string, p: Params): TraceResult {
    return feistelTrace(input, readOptions(p), 'encrypt');
  },


  decrypt(input: string, p: Params): TraceResult {
    return feistelTrace(input, readOptions(p), 'decrypt');
  },

  visualize: FeistelLadder,
};

export default feistelCipher;
