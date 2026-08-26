import { describe, expect, it } from 'vitest';
import {
  LABELS,
  adfgvx,
  adfgvxTrace,
  buildGrid,
  cleanMessage,
  defractionate,
  fractionate,
  inFives,
  labelsOnly,
  transpose,
  untranspose,
} from './adfgvx';
import { columnar } from '../../transposition/columnar/columnar';
import { chiSquaredEnglish } from '../../../../lib/frequency';
import adfgvxCipher from './index';

describe('the square', () => {
  it('holds 36 cells: the alphabet and the ten digits', () => {
    const square = buildGrid('');
    expect(square.cells).toHaveLength(36);
    expect(square.cells.slice().sort().join('')).toBe(
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    );
  });

  it('keeps J, unlike every 5x5 square on this site', () => {
    // The reason ADFGVX could send map references and Playfair could not.
    expect(buildGrid('')).not.toBeNull();
    expect(buildGrid('').cells).toContain('J');
    expect(buildGrid('').cells).toContain('7');
  });

  it('puts the keyword first, digits included', () => {
    expect(buildGrid('PAINVIN1918').cells.slice(0, 8).join('')).toBe('PAINV198');
  });

  it('labels the axes with the six Morse-distinct letters', () => {
    expect(LABELS).toBe('ADFGVX');
    expect(LABELS).toHaveLength(6);
  });
});

describe('fractionation', () => {
  const square = buildGrid('');

  it('turns every character into two label letters', () => {
    // Plain square: A is (0,0) -> AA, and the last cell 9 is (5,5) -> XX.
    expect(fractionate(square, 'A')).toBe('AA');
    expect(fractionate(square, '9')).toBe('XX');
    expect(fractionate(square, 'AB')).toHaveLength(4);
  });

  it('doubles the length of the message', () => {
    expect(fractionate(square, 'ATTACK')).toHaveLength(12);
  });

  it('reads back exactly', () => {
    expect(defractionate(square, fractionate(square, 'ATTACK9'))).toBe('ATTACK9');
  });

  it('keeps only letters and digits from the message', () => {
    const { chars, sources } = cleanMessage('Hill 42!');
    expect(chars).toBe('HILL42');
    expect(sources).toEqual([0, 1, 2, 3, 5, 6]);
  });
});

describe('the transposition stage', () => {
  it('is the Columnar Transposition already on this site', () => {
    // Asserted, not claimed: the same string through both must match. If this
    // ever diverges, the explainer's "it is not a variation on it, it is it" is
    // no longer true.
    const text = 'ADFGVXADFGVXADFG';
    expect(transpose(text, 'ARGUS')).toBe(columnar(text, 'ARGUS', 'encrypt'));
  });

  it('is undone exactly', () => {
    const text = 'ADFGVXADFGVXADFG';
    expect(untranspose(transpose(text, 'ARGUS'), 'ARGUS')).toBe(text);
  });
});

describe('adfgvx', () => {
  it('round-trips a message, digits included', () => {
    const text = 'Attack at 0600 on hill 42';
    const encrypted = adfgvx(text, 'PAINVIN1918', 'ARGUS', 'encrypt');
    expect(adfgvx(encrypted, 'PAINVIN1918', 'ARGUS', 'decrypt')).toBe('ATTACKAT0600ONHILL42');
  });

  it('emits only the six label letters, in groups of five', () => {
    const out = adfgvx('Attack at dawn', 'PAINVIN1918', 'ARGUS', 'encrypt');
    expect(out).toMatch(/^[ADFGVX]{1,5}( [ADFGVX]{1,5})*$/);
  });

  it('groups in fives, as it went out over the wire', () => {
    expect(inFives('ADFGVXADFG')).toBe('ADFGV XADFG');
  });

  it('ignores anything that is not a label letter when decrypting', () => {
    const encrypted = adfgvx('ATTACK', 'PAINVIN1918', 'ARGUS', 'encrypt');
    expect(labelsOnly(encrypted)).toBe(encrypted.replace(/ /g, ''));
    expect(adfgvx(encrypted.replace(/ /g, ''), 'PAINVIN1918', 'ARGUS', 'decrypt')).toBe('ATTACK');
  });

  it('separates the two halves of a character, which fractionation alone does not', () => {
    // Before the transposition the halves are adjacent; afterwards they are not.
    // That separation is the entire reason the composition is strong.
    const square = buildGrid('PAINVIN1918');
    const pairs = fractionate(square, 'ATTACKATDAWNTOMORROWATSIX');
    const scrambled = transpose(pairs, 'ARGUS');
    expect(scrambled).not.toBe(pairs);
    expect(scrambled.split('').sort().join('')).toBe(pairs.split('').sort().join(''));
  });

  it('changes when either keyword changes', () => {
    const text = 'ATTACKATDAWN';
    expect(adfgvx(text, 'ZEBRA', 'ARGUS', 'encrypt')).not.toBe(
      adfgvx(text, 'QUARTZ', 'ARGUS', 'encrypt'),
    );
    expect(adfgvx(text, 'ZEBRA', 'ARGUS', 'encrypt')).not.toBe(
      adfgvx(text, 'ZEBRA', 'PARIS', 'encrypt'),
    );
  });

  it('produces nothing that resembles English', () => {
    const text = 'The German army introduced this cipher in nineteen eighteen';
    const out = adfgvx(text, 'PAINVIN1918', 'ARGUS', 'encrypt');
    expect(chiSquaredEnglish(out)).toBeGreaterThan(chiSquaredEnglish(text));
  });

  it('handles the empty string', () => {
    expect(adfgvx('', 'PAINVIN1918', 'ARGUS', 'encrypt')).toBe('');
  });
});

describe('adfgvxTrace', () => {
  it('agrees with the untraced cipher, both directions', () => {
    const text = 'Attack at 0600';
    expect(adfgvxTrace(text, 'PAINVIN1918', 'ARGUS', 'encrypt').output).toBe(
      adfgvx(text, 'PAINVIN1918', 'ARGUS', 'encrypt'),
    );
    const encrypted = adfgvx(text, 'PAINVIN1918', 'ARGUS', 'encrypt');
    expect(adfgvxTrace(encrypted, 'PAINVIN1918', 'ARGUS', 'decrypt').output).toBe(
      adfgvx(encrypted, 'PAINVIN1918', 'ARGUS', 'decrypt'),
    );
  });

  it('emits one step per character for stage one and one for stage two', () => {
    const { steps } = adfgvxTrace('ATTACK', 'PAINVIN1918', 'ARGUS', 'encrypt');
    expect(steps.filter((s) => s.data?.['stage'] === 'fractionate')).toHaveLength(6);
    expect(steps.filter((s) => s.data?.['stage'] === 'transpose')).toHaveLength(1);
  });

  it('describes the transposition as one act, because it cannot be described per character', () => {
    const { steps } = adfgvxTrace('ATTACK', 'PAINVIN1918', 'ARGUS', 'encrypt');
    const last = steps[steps.length - 1];
    expect(last?.data?.['stage']).toBe('transpose');
    expect(String(last?.input)).toHaveLength(12);
  });

  it('indexes the input as typed, not as stripped', () => {
    const { steps } = adfgvxTrace('at 06', 'PAINVIN1918', 'ARGUS', 'encrypt');
    expect(steps[2]?.highlight).toEqual({ start: 3, end: 4 });
  });
});

describe('the module', () => {
  it('round-trips through the module', () => {
    const key = { keyword: 'PAINVIN1918', transposition: 'ARGUS' };
    const encrypted = adfgvxCipher.encrypt('Attack at 0600', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = adfgvxCipher.decrypt(output, key);
    expect('output' in decrypted && decrypted.output).toBe('ATTACKAT0600');
  });

  it('ships defaults that encrypt on first render', () => {
    const defaults: Record<string, string> = {};
    for (const spec of adfgvxCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => adfgvxCipher.encrypt('Attack at 0600 on hill 42', defaults)).not.toThrow();
  });

  it('has no Attack tab, because the historical break needs several messages', () => {
    expect(adfgvxCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(adfgvxCipher.attack).toBeUndefined();
    expect(adfgvxCipher.explainer).toContain('messages in depth');
  });

  it('tells the reader how it breaks, and credits Painvin', () => {
    expect(adfgvxCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(adfgvxCipher.explainer).toContain('Painvin');
  });
});
