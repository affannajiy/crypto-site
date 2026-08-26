import { describe, expect, it } from 'vitest';
import {
  BLOCK_BYTES,
  CONSTANTS,
  KEY_BYTES,
  NONCE_BYTES,
  ROUNDS,
  block,
  chacha20,
  chacha20Trace,
  decryptText,
  encryptText,
  initialState,
  keystream,
  quarterRound,
  readKey,
  readNonce,
  rotl,
  wordAt,
} from './chacha20';
import { fromHex, toHex } from '../../../../lib/format';
import chachaCipher from './index';

const hex = (s: string) => fromHex(s) ?? new Uint8Array();

/** The RFC 8439 example key and nonce, used throughout the document. */
const RFC_KEY = hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
const RFC_NONCE = hex('000000090000004a00000000');

describe('the primitives', () => {
  it('rotates within 32 bits', () => {
    expect(rotl(0x80000000, 1)).toBe(1);
    expect(rotl(1, 31)).toBe(0x80000000);
    expect(rotl(0x12345678, 0)).toBe(0x12345678);
  });

  it('reads little-endian words', () => {
    expect(wordAt(hex('01000000'), 0)).toBe(1);
    expect(wordAt(hex('00000080'), 0)).toBe(0x80000000);
  });

  it('spells "expand 32-byte k" in its constants', () => {
    const bytes = CONSTANTS.flatMap((word) => [
      word & 0xff,
      (word >>> 8) & 0xff,
      (word >>> 16) & 0xff,
      (word >>> 24) & 0xff,
    ]);
    expect(String.fromCharCode(...bytes)).toBe('expand 32-byte k');
  });

  it('matches the RFC quarter-round test vector', () => {
    // RFC 8439 section 2.1.1.
    const state = [0x11111111, 0x01020304, 0x9b8d6f43, 0x01234567];
    quarterRound(state, 0, 1, 2, 3);
    expect(state.map((n) => n.toString(16))).toEqual([
      'ea2a92f4',
      'cb1cf8ce',
      '4581472e',
      '5881c4bb',
    ]);
  });
});

describe('the state', () => {
  it('is constants, key, counter, nonce, in that order', () => {
    const state = initialState(RFC_KEY, RFC_NONCE, 1);
    expect(state).toHaveLength(16);
    expect(state.slice(0, 4)).toEqual([...CONSTANTS]);
    expect(state[12]).toBe(1);
    // RFC 8439 section 2.3.2 starting state.
    expect(state.map((n) => n.toString(16).padStart(8, '0'))).toEqual([
      '61707865', '3320646e', '79622d32', '6b206574',
      '03020100', '07060504', '0b0a0908', '0f0e0d0c',
      '13121110', '17161514', '1b1a1918', '1f1e1d1c',
      '00000001', '09000000', '4a000000', '00000000',
    ]);
  });

  it('runs twenty rounds as ten column-then-diagonal pairs', () => {
    const { trace } = block(RFC_KEY, RFC_NONCE, 1);
    expect(ROUNDS).toBe(20);
    expect(trace.rounds).toHaveLength(10);
  });
});

describe('the RFC 8439 block-function vector', () => {
  it('produces the published state after twenty rounds and the addition', () => {
    // RFC 8439 section 2.3.2. If this matches, the rounds, the diagonal offsets,
    // the rotations and the final addition are all correct together.
    const { trace } = block(RFC_KEY, RFC_NONCE, 1);
    expect(trace.final.map((n) => n.toString(16).padStart(8, '0'))).toEqual([
      'e4e7f110', '15593bd1', '1fdd0f50', 'c47120a3',
      'c7f4d1c7', '0368c033', '9aaa2204', '4e6cd4c3',
      '466482d2', '09aa9f07', '05d7c214', 'a2028bd9',
      'd19c12b5', 'b94e16de', 'e883d0cb', '4e3c50a2',
    ]);
  });

  it('serialises that state little-endian into 64 keystream bytes', () => {
    const { bytes } = block(RFC_KEY, RFC_NONCE, 1);
    expect(bytes).toHaveLength(BLOCK_BYTES);
    expect(toHex(bytes).slice(0, 16)).toBe('10f1e7e4d13b5915');
  });

  it('needs the final addition — without it the rounds would be reversible', () => {
    const { trace } = block(RFC_KEY, RFC_NONCE, 1);
    expect(trace.beforeAdd).not.toEqual(trace.final);
    trace.final.forEach((word, i) => {
      expect(word).toBe((((trace.beforeAdd[i] ?? 0) + (trace.initial[i] ?? 0)) >>> 0));
    });
  });
});

describe('the keystream', () => {
  it('produces as many bytes as asked for, across block boundaries', () => {
    expect(keystream(RFC_KEY, RFC_NONCE, 1, 100)).toHaveLength(100);
    expect(keystream(RFC_KEY, RFC_NONCE, 1, 0)).toHaveLength(0);
  });

  it('advances the counter every 64 bytes', () => {
    const long = keystream(RFC_KEY, RFC_NONCE, 1, 128);
    expect(toHex(long.slice(0, 64))).toBe(toHex(block(RFC_KEY, RFC_NONCE, 1).bytes));
    expect(toHex(long.slice(64))).toBe(toHex(block(RFC_KEY, RFC_NONCE, 2).bytes));
  });

  it('changes completely when the nonce changes by one bit', () => {
    const a = keystream(RFC_KEY, RFC_NONCE, 1, 64);
    const other = RFC_NONCE.slice();
    other[11] = 1;
    const b = keystream(RFC_KEY, other, 1, 64);
    let same = 0;
    for (let i = 0; i < 64; i += 1) if (a[i] === b[i]) same += 1;
    // About 1 in 256 bytes should coincide by chance, so a handful at most.
    expect(same).toBeLessThan(6);
  });
});

describe('chacha20', () => {
  const options = { key: RFC_KEY, nonce: RFC_NONCE, counter: 1 };

  it('is its own inverse, because XOR is', () => {
    const bytes = new TextEncoder().encode('Meet me at the old bridge at midnight.');
    expect([...chacha20(chacha20(bytes, options), options)]).toEqual([...bytes]);
  });

  it('round-trips text through hex', () => {
    const text = 'Attack at dawn — café — 日本語';
    expect(decryptText(encryptText(text, options), options)).toBe(text);
  });

  it('does not change the length of the message', () => {
    // A stream cipher needs no padding, which is one real advantage over a block
    // cipher — and it is also why the ciphertext length leaks the plaintext length.
    for (const text of ['a', 'a'.repeat(63), 'a'.repeat(64), 'a'.repeat(65)]) {
      expect(encryptText(text, options)).toHaveLength(text.length * 2);
    }
  });

  it('gives identical plaintext blocks different ciphertext, unlike ECB', () => {
    const text = 'A'.repeat(128);
    const out = encryptText(text, options);
    expect(out.slice(0, 128)).not.toBe(out.slice(128, 256));
  });

  it('destroys everything when a nonce is reused — the One-Time Pad failure', () => {
    // Two messages under one nonce: XOR the ciphertexts and the keystream
    // cancels, leaving the XOR of the two plaintexts. The key is never involved.
    const first = new TextEncoder().encode('ATTACK AT DAWN');
    const second = new TextEncoder().encode('RETREAT AT SIX');
    const a = chacha20(first, options);
    const b = chacha20(second, options);
    const combined = a.map((byte, i) => byte ^ (b[i] ?? 0));
    const plainXor = first.map((byte, i) => byte ^ (second[i] ?? 0));
    expect([...combined]).toEqual([...plainXor]);
  });

  it('handles the empty message', () => {
    expect(encryptText('', options)).toBe('');
    expect(decryptText('', options)).toBe('');
  });
});

describe('reading the key and nonce', () => {
  it('accepts exactly 256 bits and 96 bits', () => {
    expect(readKey(toHex(RFC_KEY))).toHaveLength(KEY_BYTES);
    expect(readNonce(toHex(RFC_NONCE))).toHaveLength(NONCE_BYTES);
  });

  it('says clearly what is wrong', () => {
    expect(() => readKey('zz')).toThrow(/hexadecimal/);
    expect(() => readKey('00'.repeat(16))).toThrow(/always 256 bits/);
    expect(() => readNonce('00')).toThrow(/never be reused/);
  });
});

describe('chacha20Trace', () => {
  const options = { key: RFC_KEY, nonce: RFC_NONCE, counter: 1 };

  it('agrees with the untraced cipher', () => {
    const text = 'Meet me at dawn';
    expect(chacha20Trace(text, options, 'encrypt').output).toBe(encryptText(text, options));
  });

  it('emits one step per 64-byte block, with the counter advancing', () => {
    const { steps } = chacha20Trace('A'.repeat(130), options, 'encrypt');
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.data?.['counter'])).toEqual([1, 2, 3]);
  });

  it('carries every double round for the visualizer', () => {
    const { steps } = chacha20Trace('hello', options, 'encrypt');
    expect(steps[0]?.data?.['rounds']).toHaveLength(10);
    expect(steps[0]?.data?.['initial']).toHaveLength(16);
  });

  it('round-trips through the trace', () => {
    const text = 'Attack at dawn';
    const encrypted = chacha20Trace(text, options, 'encrypt').output;
    expect(chacha20Trace(encrypted, options, 'decrypt').output).toBe(text);
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const params = {
      key: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      nonce: '000000090000004a00000000',
      counter: 1,
    };
    const encrypted = chachaCipher.encrypt('Attack at dawn', params);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = chachaCipher.decrypt(output, params);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string | number> = {};
    for (const spec of chachaCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
      if (spec.kind === 'number') defaults[spec.name] = spec.default;
    }
    expect(() => chachaCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('has no Attack tab, because there is no known practical attack', () => {
    expect(chachaCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(chachaCipher.attack).toBeUndefined();
  });

  it('warns about nonce reuse and about the missing authentication', () => {
    expect(chachaCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(chachaCipher.explainer).toContain('nonce');
    expect(chachaCipher.explainer).toContain('Poly1305');
    expect(chachaCipher.explainer).toContain('not implemented here');
  });
});
