import { describe, expect, it } from 'vitest';
import { effectiveKeys, tripleBlock, tripleDes, tripleDesTrace } from './tripledes';
import { des } from '../des/des';
import { fromHex } from '../../../../lib/format';
import tripleDesCipher from './index';

const hex = (s: string) => fromHex(s) ?? new Uint8Array();
const K1 = hex('133457799bbcdff1');
const K2 = hex('0123456789abcdef');
const K3 = hex('fedcba9876543210');
const IV = hex('0f0e0d0c0b0a0908');

const raw = (keying: '1-key' | '2-key' | '3-key', mode: 'ECB' = 'ECB') => ({
  k1: K1,
  k2: K2,
  k3: K3,
  keying,
  mode,
  iv: IV,
  format: 'hex' as const,
});

/**
 * Reference values from OpenSSL's des-ede3 through Node's crypto module,
 * computed once and pinned here. The test environment has no OpenSSL binding,
 * and a second hand-written 3DES would only agree with itself.
 */
describe('against OpenSSL des-ede3', () => {
  it('matches two-key EDE with the Lab 04 keys', () => {
    expect(tripleDes('0123456789abcdef', raw('2-key'), 'encrypt')).toBe('a553228bcac80eb5');
  });

  it('matches three-key EDE', () => {
    expect(tripleDes('0123456789abcdef', raw('3-key'), 'encrypt')).toBe('eb2ef3d233bbeb25');
  });

  it('matches CBC, CFB and OFB on a sentence', () => {
    const text = 'Meet me at the old bridge at midnight.';
    const opts = (mode: 'CBC' | 'CFB' | 'OFB') => ({ ...raw('3-key'), mode, format: 'text' as const });
    expect(tripleDes(text, opts('CBC'), 'encrypt')).toBe(
      '4950779d10ef0bf31820e8f5cfa387db8e1cdf6ae291ebe42bc925278c778d00b897a44720247c91',
    );
    expect(tripleDes(text, opts('CFB'), 'encrypt')).toBe(
      '37d118b8851a1db649aff4b80aa7ea13b4889576605f4568196353c8f776ff46863e1c84fa1f',
    );
    expect(tripleDes(text, opts('OFB'), 'encrypt')).toBe(
      '37d118b8851a1db617c83da53ae421f5cb318a845201c0577bd2958ea6b34a415dc94cb922bd',
    );
  });
});

describe('backward compatibility', () => {
  it('is single DES when all three keys are equal', () => {
    expect(tripleDes('0123456789abcdef', raw('1-key'), 'encrypt')).toBe('85e813540f0ab405');
    const text = 'Same as DES, every mode.';
    for (const mode of ['ECB', 'CBC', 'CFB', 'OFB', 'CTR'] as const) {
      expect(tripleDes(text, { ...raw('1-key'), mode, format: 'text' }, 'encrypt')).toBe(
        des(text, { key: K1, mode, iv: IV }, 'encrypt'),
      );
    }
  });

  it('lets the first two passes cancel when K1 = K2', () => {
    const { trace } = tripleBlock(hex('0123456789abcdef'), [K1, K1, K1], 'encrypt');
    expect(trace[1]?.output).toEqual(hex('0123456789abcdef'));
  });
});

describe('the keying options', () => {
  it('sets K3 = K1 for two keys and all equal for one', () => {
    expect(effectiveKeys({ k1: K1, k2: K2, k3: K3, keying: '2-key' })).toEqual([K1, K2, K1]);
    expect(effectiveKeys({ k1: K1, k2: K2, k3: K3, keying: '1-key' })).toEqual([K1, K1, K1]);
    expect(effectiveKeys({ k1: K1, k2: K2, k3: K3, keying: '3-key' })).toEqual([K1, K2, K3]);
  });

  it('round-trips text through every keying option and mode', () => {
    const text = 'Encrypt, decrypt, encrypt: Café — 3DES';
    for (const keying of ['1-key', '2-key', '3-key'] as const) {
      for (const mode of ['ECB', 'CBC', 'CFB', 'OFB', 'CTR'] as const) {
        const options = { ...raw(keying), mode, format: 'text' as const };
        expect(tripleDes(tripleDes(text, options, 'encrypt'), options, 'decrypt')).toBe(text);
      }
    }
  });
});

describe('the trace', () => {
  it('carries three passes of sixteen rounds per block', () => {
    const { steps } = tripleDesTrace('0123456789abcdef', raw('2-key'), 'encrypt');
    const passes = steps[0]?.data?.['trace'] as { label: string; trace: unknown[] }[];
    expect(passes.map((p) => p.label)).toEqual(['Encrypt with K1', 'Decrypt with K2', 'Encrypt with K3']);
    expect(passes.every((p) => p.trace.length === 16)).toBe(true);
  });

  it('runs the passes in reverse to decrypt', () => {
    const { steps, output } = tripleDesTrace('a553228bcac80eb5', raw('2-key'), 'decrypt');
    expect(output).toBe('0123456789abcdef');
    const passes = steps[0]?.data?.['trace'] as { label: string }[];
    expect(passes.map((p) => p.label)).toEqual(['Decrypt with K3', 'Encrypt with K2', 'Decrypt with K1']);
  });

  it('opens on the lab keys', () => {
    expect(tripleDesCipher.examples?.[0]?.params).toMatchObject({ keying: '2-key', k1: '133457799bbcdff1', k2: '0123456789abcdef' });
  });
});
