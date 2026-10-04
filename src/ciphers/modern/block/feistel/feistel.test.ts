import { describe, expect, it } from 'vitest';
import { feistel, feistelBlock, feistelTrace, readBlocks, readKeys, roundFunction, xorBits } from './feistel';
import feistelCipher from './index';

const LECTURE = { blockBits: 8 as const, keys: ['0110', '1100', '1010'], finalSwap: false };

describe('the Lecture 04 worked example', () => {
  it('encrypts 10110110 to 00010000', () => {
    expect(feistel('10110110', LECTURE, 'encrypt')).toBe('00010000');
  });

  it('reproduces every intermediate value on the slide', () => {
    const { rounds } = feistelBlock('10110110', LECTURE.keys, false, 'encrypt');
    expect(rounds.map((r) => [r.f, r.newLeft, r.newRight])).toEqual([
      ['0000', '0110', '1011'], // F0 = 0110 XOR 0110; L1 = R0; R1 = F0 XOR L0
      ['0111', '1011', '0001'], // F1 = 1011 XOR 1100; R2 = F1 XOR L1
      ['1011', '0001', '0000'], // F2 = 0001 XOR 1010; R3 = F2 XOR L2
    ]);
  });

  it('answers the decryption exercise: 00010000 decrypts to 10110110', () => {
    expect(feistel('00010000', LECTURE, 'decrypt')).toBe('10110110');
  });

  it('ends with R3 || L3 when the final swap is on, as the diagram draws it', () => {
    expect(feistel('10110110', { ...LECTURE, finalSwap: true }, 'encrypt')).toBe('00000001');
    expect(feistel('00000001', { ...LECTURE, finalSwap: true }, 'decrypt')).toBe('10110110');
  });

  it('opens on that example', () => {
    const first = feistelCipher.examples?.[0];
    expect(first?.input).toBe('10110110');
    expect(first?.params).toMatchObject({ keys: '0110 1100 1010', finalSwap: 'no' });
  });
});

describe('the Feistel guarantee', () => {
  it('decrypts with the same rounds whatever the keys, sizes and swap', () => {
    let seed = 7;
    const bit = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) >> 16) & 1 ? '1' : '0';
    const bits = (n: number) => Array.from({ length: n }, bit).join('');
    for (const blockBits of [8, 16] as const) {
      for (const finalSwap of [false, true]) {
        for (let run = 0; run < 20; run += 1) {
          const keys = Array.from({ length: 1 + (run % 6) }, () => bits(blockBits / 2));
          const plain = bits(blockBits * 2);
          const options = { blockBits, keys, finalSwap };
          const cipher = feistel(plain, options, 'encrypt').replace(/ /g, '');
          expect(feistel(cipher, options, 'decrypt').replace(/ /g, '')).toBe(plain);
        }
      }
    }
  });

  it('uses XOR for F, as the slide does', () => {
    expect(roundFunction('0110', '0110')).toBe('0000');
    expect(xorBits('1011', '1100')).toBe('0111');
  });
});

describe('how this toy breaks', () => {
  it('is linear: E(P) XOR E(P\') does not depend on the key at all', () => {
    // With F = R XOR K the keys only ever add a constant, so the difference of
    // two ciphertexts is fixed by the plaintexts alone. One known pair then
    // decrypts everything. A real F needs a non-linear S-box.
    const a = '10110110';
    const b = '01011100';
    const diff = (keys: string[]) =>
      xorBits(feistel(a, { ...LECTURE, keys }, 'encrypt'), feistel(b, { ...LECTURE, keys }, 'encrypt'));
    expect(diff(['0110', '1100', '1010'])).toBe(diff(['0001', '1111', '0101']));
  });
});

describe('input checking', () => {
  it('reads keys of the right width and refuses others', () => {
    expect(readKeys('0110 1100,1010', 8)).toEqual(['0110', '1100', '1010']);
    expect(() => readKeys('011', 8)).toThrow(/4 binary digits/);
    expect(() => readKeys('', 8)).toThrow(/at least one/);
  });

  it('reads whole blocks with or without spaces', () => {
    expect(readBlocks('1011 0110 0000 1111', 8, 'plaintext')).toEqual(['10110110', '00001111']);
    expect(() => readBlocks('1011011', 8, 'plaintext')).toThrow(/whole number/);
    expect(() => readBlocks('10a1', 8, 'plaintext')).toThrow(/binary/);
  });

  it('traces a split, one step per round, and a join for each block', () => {
    const { steps, output } = feistelTrace('1011 0110', LECTURE, 'encrypt');
    expect(output).toBe('00010000');
    expect(steps.map((s) => s.data?.['stage'])).toEqual(['split', 'round', 'round', 'round', 'join']);
    expect(steps[0]?.highlight).toEqual({ start: 0, end: 9 });
  });
});

describe('the text format', () => {
  const TEXT = { ...LECTURE, format: 'text' as const };

  it('reads each character as one 8-bit block', () => {
    // "A" is 01000001. Each letter is one block, so the bits match feistel() on the bytes.
    expect(feistel('A', TEXT, 'encrypt')).toBe(feistel('01000001', LECTURE, 'encrypt'));
    expect(feistel('AA', TEXT, 'encrypt').split(' ')).toHaveLength(2);
  });

  it('decrypts back to the sentence, with 8-bit and 16-bit blocks', () => {
    const wide = { ...TEXT, blockBits: 16 as const, keys: ['10101010', '11001100'], finalSwap: true };
    for (const options of [TEXT, wide]) {
      for (const text of ['The quick brown fox', 'odd', 'café ☕']) {
        expect(feistel(feistel(text, options, 'encrypt'), options, 'decrypt')).toBe(text);
      }
    }
  });

  it('lights the character each block came from', () => {
    const { steps } = feistelTrace('héllo', TEXT, 'encrypt');
    const splits = steps.filter((s) => s.data?.['stage'] === 'split');
    // é is two bytes, so blocks 2 and 3 both belong to character 1.
    expect(splits.map((s) => s.highlight)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
      { start: 3, end: 4 },
      { start: 4, end: 5 },
    ]);
  });
});
