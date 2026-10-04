import { describe, expect, it } from 'vitest';
import { keystream, ksa, rc4, rc4Trace, readRc4Key, secondByteZeroRate } from './rc4';
import { fromHex, toHex } from '../../../../lib/format';
import rc4Cipher from './index';

const text = (s: string) => new TextEncoder().encode(s);
const hex = (s: string) => fromHex(s) ?? new Uint8Array();

describe('published vectors', () => {
  it('turns Plaintext into BBF316E8D940AF0AD3 under the key Key', () => {
    expect(rc4('Plaintext', text('Key'), 'encrypt')).toBe('bbf316e8d940af0ad3');
  });

  it('matches the other two classic vectors', () => {
    expect(rc4('pedia', text('Wiki'), 'encrypt')).toBe('1021bf0420');
    expect(rc4('Attack at dawn', text('Secret'), 'encrypt')).toBe('45a01f645fc35b383552544b9bf5');
  });

  it('matches RFC 6229 for the 40-bit key 0102030405 and a 128-bit key', () => {
    expect(toHex(keystream(hex('0102030405'), 16))).toBe('b2396305f03dc027ccc3524a0a1118a8');
    expect(toHex(keystream(hex('0102030405060708090a0b0c0d0e0f10'), 16))).toBe('9ac7cc9a609d1ef7b2932899cde41b97');
  });

  it('agrees with OpenSSL ARC4 on a sentence', () => {
    // Computed once with Python's cryptography package, which wraps OpenSSL.
    expect(rc4('Meet me at the old bridge at midnight.', text('Password'), 'encrypt')).toBe(
      '6d8a0a136203c31962f381d6e6c429572b1c366bf2ca594174daae0c58a8ceae238076a70d2d',
    );
  });
});

describe('the cipher', () => {
  it('is its own inverse', () => {
    const message = 'Café — any bytes at all';
    expect(rc4(rc4(message, text('k'), 'encrypt'), text('k'), 'decrypt')).toBe(message);
  });

  it('makes S a permutation of all 256 bytes after the key schedule', () => {
    expect([...ksa(text('Key'))].sort((a, b) => a - b)).toEqual(Array.from({ length: 256 }, (_, i) => i));
  });

  it('cancels the keystream when one key is used twice: the two-time pad', () => {
    const key = text('reused');
    const a = hex(rc4('ATTACK AT DAWN', key, 'encrypt'));
    const b = hex(rc4('RETREAT AT TEN', key, 'encrypt'));
    const xorCipher = a.map((byte, i) => byte ^ (b[i] ?? 0));
    const xorPlain = text('ATTACK AT DAWN').map((byte, i) => byte ^ (text('RETREAT AT TEN')[i] ?? 0));
    expect(toHex(xorCipher)).toBe(toHex(xorPlain));
  });

  it('shows the Mantin-Shamir bias: the second byte is 0 about twice as often as it should be', () => {
    let seed = 12345;
    const randomKey = () =>
      new Uint8Array(16).map(() => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed >> 16 & 0xff;
      });
    const rate = secondByteZeroRate(40000, randomKey);
    // 2/256 is 0.0078; a fair byte gives 0.0039. Wide bounds, one sample.
    expect(rate).toBeGreaterThan(0.006);
    expect(rate).toBeLessThan(0.0095);
  });
});

describe('the trace and the module', () => {
  it('starts with the key schedule and then one step per byte, with S for the first bytes', () => {
    const { steps } = rc4Trace('Plaintext', text('Key'), 'encrypt');
    expect(steps).toHaveLength(10);
    expect(steps[0]?.data?.['isKsa']).toBe(true);
    expect((steps[1]?.data?.['state'] as number[]).length).toBe(256);
    expect(steps[1]?.data?.['k']).toBe(0xeb);
  });

  it('reads text and hex keys', () => {
    expect(toHex(readRc4Key('Key', 'text'))).toBe('4b6579');
    expect(toHex(readRc4Key('01 02', 'hex'))).toBe('0102');
    expect(() => readRc4Key('', 'text')).toThrow(/empty/);
  });

  it('opens on the classic vector', () => {
    expect(rc4Cipher.examples?.[0]).toMatchObject({ input: 'Plaintext', params: { key: 'Key' } });
  });
});
