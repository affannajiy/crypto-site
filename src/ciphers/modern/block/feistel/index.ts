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
A **Feistel cipher** is a structure, not one fixed algorithm. Horst Feistel
proposed it at IBM in the early 1970s, and DES is built on it. It is the lecture's
way into block ciphers, because the whole idea fits in one 8-bit example.

## How one round works

Split the block into a left half L and a right half R. Then each round does this:

    F(i-1) = F(R(i-1), K(i-1))
    L(i)   = R(i-1)
    R(i)   = L(i-1) XOR F(i-1)

The right half goes through the round function F with this round's key. The
result is XORed into the left half. Then the halves swap. Repeat for as many
rounds as there are keys.

In the lecture's example, F is simply **R XOR K**. Real ciphers use a much more
complicated F, but the ladder around it is identical.

## The worked example

The lecture encrypts the 8-bit block **10110110** in 3 rounds with the keys
**0110, 1100, 1010**. It is the first example above:

    L0 = 1011            R0 = 0110
    F0 = 0110 XOR 0110 = 0000      L1 = 0110   R1 = 0000 XOR 1011 = 1011
    F1 = 1011 XOR 1100 = 0111      L2 = 1011   R2 = 0111 XOR 0110 = 0001
    F2 = 0001 XOR 1010 = 1011      L3 = 0001   R3 = 1011 XOR 1011 = 0000
    Ciphertext = L3 || R3 = 0001 0000

The Encrypt tab lists each of those lines as a step. The Visualize tab draws the
ladder with every value in place.

## Decryption

Decryption is the same algorithm with the **round keys in reverse order**. The
lecture asks you to decrypt the example. Switch the direction to Decrypt and use
**00010000**: the answer is 10110110.

There is one detail. The worked example joins L3 || R3, with no final swap. So
the decryption first swaps the halves of the ciphertext, then runs the rounds with
the keys 1010, 1100, 0110, then swaps again. That is the "left-right switch" on
the decryption slide.

**The final swap.** The lecture's diagram ends with one more swap, R(n) || L(n),
and the slide says "some systems" add it. The worked example does not. The *Final
swap* control lets you try both. With the swap, encryption and decryption are
literally the same procedure, which is what DES does.

## Why F never has to be undone

Look at a round from the bottom up. If you know L(i) and R(i), then R(i-1) = L(i),
so you can compute F(R(i-1)) again, *forwards*, and XOR it out of R(i) to get
L(i-1). F is only ever run forwards. Therefore **F does not need to be
invertible**, and a designer can make it as destructive as they like. DES's F
throws information away in its S-boxes, and decryption still works.

## Design features

The lecture's Quiz 1 asks for the design features of a Feistel cipher. There are
five:

| Feature | Larger or more complex means |
| --- | --- |
| Block size | More security, through more diffusion, but slower |
| Key size | More security against brute force, but slower |
| Number of rounds | One round is weak; more rounds add security. DES uses 16 |
| Subkey generation | Harder cryptanalysis |
| Round function F | More resistance to cryptanalysis |

Use the *Block size* control and add or remove round keys to see the first and
third of these on the ladder.

## A sentence instead of bits

Set *Message* to **Text** and the box takes an ordinary sentence. Each character
becomes its UTF-8 byte, so an 8-bit block is one letter and a 16-bit block is two.
The ciphertext is still binary. Decrypting with *Text* turns the bits back into
the sentence. The Playground runs this cipher this way.

With 8-bit blocks the same letter always gives the same block, so the ciphertext
repeats wherever the message does. That is ECB's weakness, at the smallest size.

## How this breaks

**This F is linear, so this toy breaks with one known plaintext.** XOR is the
only operation anywhere in it. Every round key ends up XORed into the output as a
fixed constant. Therefore, for any two plaintexts P and P', the value
E(P) XOR E(P') does not depend on the key at all.

So an attacker who knows one plaintext and its ciphertext can decrypt any other
ciphertext without ever learning the keys. This is a **known-plaintext attack**,
the KPA from Lecture 03. The test suite checks this property directly.

There is no Attack tab, because the attack needs that known pair, and the attack
tab only receives a ciphertext.

**What a real cipher adds is non-linearity.** DES's F has eight S-boxes, and they
are the only non-linear part of DES. Without them, DES would fall to the same
algebra as this toy. Even with them, a few rounds are not enough. Feistel
networks with three or four rounds have known generic attacks. That is why DES
uses sixteen rounds, and why "number of rounds" is on the list of design features.
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
