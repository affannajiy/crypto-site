/**
 * DES's entry in the registry.
 *
 * **No Attack tab.** The attack on DES is a brute force over 2^56 keys, and that
 * is a real, successful, historically important attack — it just is not a button.
 * EFF's Deep Crack did it in 56 hours in 1998 using purpose-built hardware costing
 * a quarter of a million dollars; a browser tab would take longer than the
 * remaining lifetime of the sun. Offering a search that cannot finish would teach
 * that DES resisted, when what actually happened is that it fell.
 *
 * This is the same judgement Enigma's page makes, and it is worth noticing that
 * the two are opposites: Enigma's key space is far larger than DES's and Enigma
 * fell to structure, while DES has no usable structural weakness and fell to
 * money. Key size and cipher quality are independent, and here they are inverted.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { des, desTrace, readIv, readKey } from './des';
import { MODE_OPTIONS, readMode } from '../../../../lib/modes';
import { FORMAT_OPTIONS, readFormat } from '../../../../lib/blockMessage';
import FeistelRounds from './FeistelRounds';

/** Params arrive as `string | number` because they come from form controls. */
function readOptions(p: Params) {
  return {
    key: readKey(String(p['key'] ?? '')),
    mode: readMode(p['mode']),
    iv: readIv(String(p['iv'] ?? '')),
    format: readFormat(p['format']),
  };
}

const explainer = `
The US standard of 1977: 64-bit blocks, 16 Feistel rounds and a 56-bit key. It was the first cipher a government published in full.

## How it works

- Each of the 16 rounds sets L(i) = R(i-1) and R(i) = L(i-1) XOR F(R(i-1), K(i)). To decrypt, use the keys in reverse order.
- F expands 32 bits to 48, XORs in the round key, goes through eight S-boxes (6 bits in, 4 out), then permutes the result.
- The S-boxes are the only non-linear part.
- Set the message format to Hex for raw test vectors.

## Lecture note

- The key is written as 64 bits, but 8 of them are parity bits, so the **effective key is 56 bits**. Lab 04's "keys of 48 bits" are the **round subkeys**, not the key.
- The main weakness, from the quiz, is the **key size**.
- **Weak key:** with 0101010101010101, all 16 subkeys are equal. 0123456789ABCDEF → 617B3A0CE8F07100, and encrypting again gives 0123456789ABCDEF back.
- **Complement property:** invert the key and the plaintext, and the ciphertext inverts. 85E813540F0AB405 becomes 7A17ECABF0F54BFA. Brute force then needs only 2⁵⁵ trials.
- **Avalanche:** flip one plaintext bit and about half of the 64 output bits change.

## How this breaks

- **Brute force over 2⁵⁶ keys.** In 1998 the EFF's Deep Crack found a key in 56 hours.
- **The design is not the problem.** The differential cryptanalysis attack needs 2⁴⁷ chosen plaintexts. The NSA's S-boxes resist it.
- **There is no Attack tab.** A brute force that cannot finish in a browser shows nothing.
`.trim();

const desCipher: CipherModule = {
  slug: 'des',
  name: 'DES',
  family: 'symmetric',
  year: '1977',
  origin: 'IBM and the NSA, as the Data Encryption Standard',
  keyType: 'A 56-bit key, carried in 64 bits',
  security: 'deprecated',
  difficulty: 'advanced',
  keywords: ['feistel', 'block cipher', 'brute force', 'deep crack', 'nist', 'modern'],
  blurb: 'Sixteen Feistel rounds. A sound design with a key that was too short from the start.',
  explainer,
  // No 'attack'. The attack is 2^56 keys, which is hardware and money rather than
  // a button. See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key (16 hex digits — 64 bits, of which 56 are used)',
      default: '133457799bbcdff1',
      placeholder: '16 hex digits',
      randomise: { alphabet: 'hex', length: 16 },
    },
    {
      kind: 'select',
      name: 'mode',
      label: 'Mode',
      options: MODE_OPTIONS,
      default: 'CBC',
    },
    {
      kind: 'text',
      name: 'iv',
      label: 'IV (16 hex digits; unused in ECB, the first counter in CTR)',
      default: '0f0e0d0c0b0a0908',
      placeholder: '16 hex digits',
      randomise: { alphabet: 'hex', length: 16 },
    },
    {
      kind: 'select',
      name: 'format',
      label: 'Message format (when encrypting)',
      options: FORMAT_OPTIONS,
      default: 'text',
      randomise: false,
    },
  ],
  textParams: { format: 'text' },
  quizzes: [
    { question: 'Quiz 2: what is the block size of DES?', answer: '64 bits.' },
    {
      question: 'What is the length of the key (key size) of DES?',
      answer: '64 bits as written, of which 56 are used.',
      note: 'Every eighth bit is a parity bit and is dropped by PC-1. The slide says 64. Lab 04 says 48, which is the size of each round subkey, not of the key.',
    },
    { question: 'How many rounds are in DES?', answer: '16, with one 48-bit subkey for each round.' },
    {
      question: 'What is the main weakness of DES?',
      answer: 'The short key. 2⁵⁶ keys can be tried by brute force: the EFF machine Deep Crack did it in 56 hours in 1998.',
    },
  ],
  examples: [
    {
      label: 'The classic DES test vector: 85E813540F0AB405',
      input: '0123456789ABCDEF',
      params: { key: '133457799bbcdff1', mode: 'ECB', iv: '0f0e0d0c0b0a0908', format: 'hex' },
    },
    {
      label: 'Lab 04: weak key, first encryption',
      input: '0123456789ABCDEF',
      params: { key: '0101010101010101', mode: 'ECB', iv: '0f0e0d0c0b0a0908', format: 'hex' },
    },
    {
      label: 'Lab 04: weak key, encrypt the result again',
      input: '617b3a0ce8f07100',
      params: { key: '0101010101010101', mode: 'ECB', iv: '0f0e0d0c0b0a0908', format: 'hex' },
    },
    {
      label: 'Lab 04: complement key and plaintext',
      input: 'FEDCBA9876543210',
      params: { key: 'eccba8866443200e', mode: 'ECB', iv: '0f0e0d0c0b0a0908', format: 'hex' },
    },
    {
      label: 'Avalanche: the test vector with its last bit flipped',
      input: '0123456789ABCDEE',
      params: { key: '133457799bbcdff1', mode: 'ECB', iv: '0f0e0d0c0b0a0908', format: 'hex' },
    },
    {
      label: 'A sentence, in CBC',
      input: 'Meet me at the old bridge at midnight.',
      params: { key: '133457799bbcdff1', mode: 'CBC', iv: '0f0e0d0c0b0a0908' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return desTrace(input, readOptions(p), 'encrypt');
  },

  benchmark(input: string, p: Params): string {
    return des(input, readOptions(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return desTrace(input, readOptions(p), 'decrypt');
  },

  visualize: FeistelRounds,
};

export default desCipher;
