/**
 * AES's entry in the registry.
 *
 * **No Attack tab, and for the first time on this site that is because the cipher
 * works.** Every previous omission was about the tool: the search is too big, no
 * search exists, the contract cannot hold a crib, the break needs several
 * messages. Here there is simply no known practical attack on full AES, and a
 * button pretending otherwise would be the single most misleading thing this app
 * could contain.
 *
 * The "How this breaks" section is still required and still earns its place, which
 * is the point worth taking away: **everything that has ever broken AES in the
 * field is a property of how it was used**, not of the algorithm. ECB mode, a
 * predictable IV, a repeated GCM nonce, a padding oracle, a key in a repository.
 * That is what the section is about.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { aes, aesTrace, readIv, readKey } from './aes';
import { MODE_OPTIONS, readMode } from '../../../../lib/modes';
import { FORMAT_OPTIONS, readFormat } from '../../../../lib/blockMessage';
import AesRounds from './AesRounds';

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
Rijndael, chosen by NIST in 2001. It has 128-bit blocks and 128, 192 or 256-bit keys, and no known practical attack.

## How it works

- The state is 16 bytes in a 4×4 grid, filled down the columns.
- **SubBytes:** the S-box. This is the only non-linear step.
- **ShiftRows:** row r rotates r places left.
- **MixColumns:** each column is multiplied by a fixed matrix over GF(2⁸).
- **AddRoundKey:** an XOR with the round key.
- There are 10, 12 or 14 rounds. The last round has no MixColumns.
- **Modes:** ECB, CBC, CFB, OFB and CTR. CFB, OFB and CTR only make keystream, so they need no padding.

## Lecture note

- "9, 11 or 13 rounds" plus a final round is 10, 12 or 14 in total.
- "Circulant MD5 matrix" should be **MDS matrix**. MD5 is a hash function.
- The mode table calls OFB "self-synchronizing". That describes CFB, not OFB.
- The S-box sends 45 → 6E. MixColumns sends 87 6E 46 A6 → 47 37 94 ED.

## How this breaks

- **The algorithm holds.** The best attack on AES-128 is only about 4× faster than brute force.
- **ECB leaks patterns.** Equal plaintext blocks give equal ciphertext blocks.
- **A reused nonce or IV breaks it.** A predictable CBC IV allowed BEAST, and a repeated GCM nonce leaks the plaintext.
- **A padding oracle decrypts the message.** If the system reports "bad padding", an attacker can decrypt byte by byte.
- **CBC and ECB have no authentication.** Use an authenticated mode such as AES-GCM.
- **Do not use this code for real.** Its table lookups are not constant-time.
`.trim();

const aesCipher: CipherModule = {
  slug: 'aes',
  name: 'AES',
  family: 'symmetric',
  year: '2001',
  origin: 'Joan Daemen and Vincent Rijmen, as Rijndael',
  keyType: 'A 128-bit key, as 32 hex characters',
  security: 'secure',
  difficulty: 'advanced',
  keywords: ['rijndael', 'block cipher', 'sbox', 'round', 'state matrix', 'fips 197', 'modern'],
  blurb: 'The modern standard. Ten rounds of confusion and diffusion, shown one at a time.',
  explainer,
  // No 'attack'. There is no known practical attack on full AES, and a button
  // suggesting otherwise would be the most misleading thing in this app.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key (32, 48 or 64 hex digits — 128, 192 or 256 bits)',
      default: '000102030405060708090a0b0c0d0e0f',
      placeholder: '32 hex digits for AES-128',
      randomise: { alphabet: 'hex', length: 32 },
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
      label: 'IV (32 hex digits; unused in ECB, the first counter in CTR)',
      default: '0f0e0d0c0b0a09080706050403020100',
      placeholder: '32 hex digits',
      randomise: { alphabet: 'hex', length: 32 },
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
    { question: 'Quiz 3: what is the block size of AES?', answer: '128 bits, as a 4×4 grid of bytes.' },
    { question: 'What are the key sizes of AES?', answer: '128, 192 or 256 bits.' },
    {
      question: 'How many rounds are in AES?',
      answer: '10, 12 or 14, for 128-, 192- and 256-bit keys.',
      note: 'One slide says 9, 11 or 13 rounds plus an initial round. That counts the same rounds a different way. The last round has no MixColumns.',
    },
    {
      question: 'What are the main strengths of AES?',
      answer:
        'No known practical attack on the full cipher, a key long enough to rule out brute force, fast in hardware and software, and a public standard (NIST, 2001) that is used everywhere.',
    },
    {
      question: 'SubBytes: what does the S-box give for 45? Use the panel above to check.',
      answer: '6e. Row X = 4, column Y = 5.',
    },
  ],
  examples: [
    {
      label: 'A sentence, in CBC',
      input: 'Meet me at the old bridge at midnight.',
      params: { key: '000102030405060708090a0b0c0d0e0f', mode: 'CBC', iv: '0f0e0d0c0b0a09080706050403020100' },
    },
    {
      label: 'FIPS-197 Appendix C.1: 69C4E0D86A7B0430…',
      input: '00112233445566778899aabbccddeeff',
      params: { key: '000102030405060708090a0b0c0d0e0f', mode: 'ECB', iv: '0f0e0d0c0b0a09080706050403020100', format: 'hex' },
    },
    {
      label: 'ECB: two equal blocks, two equal ciphertexts',
      input: 'YELLOW SUBMARINEYELLOW SUBMARINE',
      params: { key: '000102030405060708090a0b0c0d0e0f', mode: 'ECB', iv: '0f0e0d0c0b0a09080706050403020100' },
    },
    {
      label: 'CTR: no padding, so 5 letters give 5 bytes',
      input: 'Hello',
      params: { key: '000102030405060708090a0b0c0d0e0f', mode: 'CTR', iv: 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff' },
    },
    {
      label: 'CFB: a stream mode that feeds back ciphertext',
      input: 'Cipher feedback mode.',
      params: { key: '000102030405060708090a0b0c0d0e0f', mode: 'CFB', iv: '0f0e0d0c0b0a09080706050403020100' },
    },
    {
      label: 'OFB: a keystream that never sees the message',
      input: 'Output feedback mode.',
      params: { key: '000102030405060708090a0b0c0d0e0f', mode: 'OFB', iv: '0f0e0d0c0b0a09080706050403020100' },
    },
    {
      label: 'AES-256: fourteen rounds',
      input: 'Sixteen bytes..!',
      params: { key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', mode: 'ECB', iv: '0f0e0d0c0b0a09080706050403020100' },
    },
    {
      label: 'One block, in ECB, so the rounds are the whole story',
      input: 'Sixteen bytes..',
      params: { key: '000102030405060708090a0b0c0d0e0f', mode: 'ECB', iv: '0f0e0d0c0b0a09080706050403020100' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return aesTrace(input, readOptions(p), 'encrypt');
  },

  benchmark(input: string, p: Params): string {
    return aes(input, readOptions(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return aesTrace(input, readOptions(p), 'decrypt');
  },

  visualize: AesRounds,
};

export default aesCipher;
