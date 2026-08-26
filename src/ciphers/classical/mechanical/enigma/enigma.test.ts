import { describe, expect, it } from 'vitest';
import {
  ALPHABET_SIZE,
  REFLECTORS,
  ROTORS,
  type Settings,
  enigma,
  enigmaTrace,
  findReflector,
  findRotor,
  neverItself,
  parsePlugboard,
  parsePositions,
  step,
} from './enigma';
import enigmaCipher from './index';

function machine(overrides: Partial<Settings> = {}): Settings {
  return {
    rotors: ['I', 'II', 'III'],
    reflector: 'B',
    positions: [0, 0, 0],
    rings: [0, 0, 0],
    plugboard: parsePlugboard(''),
    ...overrides,
  };
}

describe('the hardware', () => {
  it('ships the five Wehrmacht rotors', () => {
    expect(ROTORS.map((r) => r.name)).toEqual(['I', 'II', 'III', 'IV', 'V']);
  });

  it('wires each rotor as a permutation of the whole alphabet', () => {
    for (const rotor of ROTORS) {
      expect(rotor.wiring.split('').sort().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }
  });

  it('wires each reflector as a perfect pairing with no letter on itself', () => {
    for (const reflector of REFLECTORS) {
      for (let i = 0; i < ALPHABET_SIZE; i += 1) {
        const to = reflector.wiring.charCodeAt(i) - 65;
        // Symmetric, and never a fixed point. Both facts are load-bearing: the
        // first makes the machine its own inverse, the second is the flaw.
        expect(reflector.wiring.charCodeAt(to) - 65).toBe(i);
        expect(to).not.toBe(i);
      }
    }
  });

  it('refuses hardware the machine did not have', () => {
    expect(() => findRotor('VI')).toThrow(/no rotor VI/);
    expect(() => findReflector('A')).toThrow(/no reflector A/);
  });
});

describe('parsePlugboard', () => {
  it('swaps the pairs it is given and passes everything else through', () => {
    const board = parsePlugboard('AB CD');
    expect(board[0]).toBe(1);
    expect(board[1]).toBe(0);
    expect(board[2]).toBe(3);
    expect(board[4]).toBe(4);
  });

  it('is the identity when empty', () => {
    expect(parsePlugboard('')).toEqual(Array.from({ length: 26 }, (_, i) => i));
  });

  it('refuses an odd number of letters', () => {
    expect(() => parsePlugboard('ABC')).toThrow(/cannot be paired up/);
  });

  it('refuses a letter used twice, because a socket takes one cable', () => {
    expect(() => parsePlugboard('AB AC')).toThrow(/more than one plugboard pair/);
  });

  it('refuses a cable joining a letter to itself', () => {
    expect(() => parsePlugboard('AA')).toThrow(/to itself/);
  });
});

describe('parsePositions', () => {
  it('reads three window letters', () => {
    expect(parsePositions('AAZ', 'x')).toEqual([0, 0, 25]);
  });

  it('refuses anything that is not three letters', () => {
    expect(() => parsePositions('AA', 'The ring settings')).toThrow(
      /The ring settings needs exactly three letters/,
    );
  });
});

describe('step', () => {
  it('turns the right rotor on every press', () => {
    expect(step(machine({ positions: [0, 0, 0] }))).toEqual([0, 0, 1]);
  });

  it('turns the middle rotor when the right one passes its notch', () => {
    // Rotor III turns over at V, which is index 21.
    expect(step(machine({ positions: [0, 0, 21] }))).toEqual([0, 1, 22]);
  });

  it('double-steps: the middle rotor on its own notch moves itself and the left', () => {
    // Rotor II turns over at E, index 4. This is the anomaly that makes the
    // period 16,900 rather than 17,576 — a mechanical quirk, faithfully copied.
    expect(step(machine({ positions: [0, 4, 0] }))).toEqual([1, 5, 1]);
  });

  it('gives the machine a period of 16,900, not 26 cubed', () => {
    let positions: [number, number, number] = [0, 0, 0];
    const seen = new Set<string>();
    for (let i = 0; i < 26 ** 3; i += 1) {
      positions = step(machine({ positions }));
      // Comma-separated: joining bare numbers would make [12, 3, 4] and
      // [1, 23, 4] the same string and undercount the cycle.
      seen.add(positions.join(','));
    }
    expect(seen.size).toBe(16900);
  });
});

describe('enigma', () => {
  it('matches the canonical test vector', () => {
    // Rotors I II III, reflector B, rings AAA, positions AAA, no plugs:
    // AAAAA enciphers to BDZGO. This is the vector every simulator is checked
    // against, and it is what proves the stepping and wirings are right.
    expect(enigma('AAAAA', machine())).toBe('BDZGO');
  });

  it('is its own inverse, which is why the operator had no second mode', () => {
    const settings = machine({
      rotors: ['IV', 'II', 'V'],
      positions: [3, 14, 7],
      rings: [2, 0, 11],
      plugboard: parsePlugboard('AB CD EF GH IJ'),
    });
    const text = 'Meet me at the old bridge at midnight.';
    expect(enigma(enigma(text, settings), settings)).toBe(text);
  });

  it('never enciphers a letter to itself — the flaw Bletchley Park lived on', () => {
    // Asserted across many machine states rather than one, because the claim is
    // that it is impossible, not that it is unlikely.
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(8);
    for (const plugs of ['', 'AB CD EF GH IJ KL MN OP QR ST']) {
      const settings = machine({ plugboard: parsePlugboard(plugs) });
      const out = enigma(text, settings);
      for (let i = 0; i < text.length; i += 1) {
        expect(out.charAt(i)).not.toBe(text.charAt(i));
      }
    }
  });

  it('cannot be made to fix a letter by any rotor position', () => {
    for (let left = 0; left < ALPHABET_SIZE; left += 3) {
      for (let middle = 0; middle < ALPHABET_SIZE; middle += 5) {
        expect(neverItself(machine({ positions: [left, middle, 7] }))).toBe(true);
      }
    }
  });

  it('changes the substitution on every single letter', () => {
    // A repeated plaintext letter does not give a repeated ciphertext letter,
    // which is the whole difference from Vigenère.
    const out = enigma('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', machine());
    expect(new Set(out.split('')).size).toBeGreaterThan(10);
  });

  it('preserves case and passes non-letters through without turning the rotors', () => {
    // A deliberate departure from the real machine, noted in the explainer.
    const settings = machine();
    expect(enigma('AA AA', settings)).toBe(`${enigma('AAAA', settings).slice(0, 2)} ${enigma('AAAA', settings).slice(2)}`);
    expect(enigma('aaaaa', settings)).toBe('bdzgo');
  });

  it('changes completely when one ring setting moves', () => {
    expect(enigma('AAAAA', machine({ rings: [0, 0, 1] }))).not.toBe(enigma('AAAAA', machine()));
  });

  it('handles the empty string', () => {
    expect(enigma('', machine())).toBe('');
  });
});

describe('enigmaTrace', () => {
  it('agrees with the untraced machine', () => {
    const text = 'Meet me at dawn.';
    expect(enigmaTrace(text, machine()).output).toBe(enigma(text, machine()));
  });

  it('emits one step per character, each highlighting its own position', () => {
    const text = 'Hi there!';
    const { steps } = enigmaTrace(text, machine());
    expect(steps).toHaveLength(text.length);
    steps.forEach((step_, i) => {
      expect(step_.index).toBe(i);
      expect(step_.highlight).toEqual({ start: i, end: i + 1 });
    });
  });

  it('records the window letters after the rotors turned, as the operator saw them', () => {
    // The rotors move as the key goes down, before the circuit closes, so the
    // first letter of a message is enciphered at AAB and not at AAA.
    expect(enigmaTrace('AA', machine()).steps[0]?.data?.['windows']).toBe('AAB');
    expect(enigmaTrace('AA', machine()).steps[1]?.data?.['windows']).toBe('AAC');
  });

  it('carries the whole signal path for the visualizer', () => {
    const path = enigmaTrace('A', machine()).steps[0]?.data?.['path'] as Record<string, number>;
    expect(path['pressed']).toBe(0);
    expect(path['plugOut']).toBe(1); // A becomes B, the first letter of BDZGO.
    // The reflector's output must differ from its input, always.
    expect(path['reflected']).not.toBe(path['leftIn']);
  });

  it('says whether a plugboard cable was involved', () => {
    expect(enigmaTrace('A', machine()).steps[0]?.data?.['plugged']).toBe(false);
    expect(
      enigmaTrace('A', machine({ plugboard: parsePlugboard('AB') })).steps[0]?.data?.['plugged'],
    ).toBe(true);
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = enigmaCipher.encrypt('AAAAA', {
      left: 'I',
      middle: 'II',
      right: 'III',
      reflector: 'B',
      positions: 'AAA',
      rings: 'AAA',
      plugboard: '',
    });
    expect('output' in result && result.output).toBe('BDZGO');
  });

  it('round-trips through the module with the identical operation', () => {
    const key = {
      left: 'IV',
      middle: 'II',
      right: 'V',
      reflector: 'C',
      positions: 'QEH',
      rings: 'BCD',
      plugboard: 'AB CD EF',
    };
    const encrypted = enigmaCipher.encrypt('Attack at dawn!', key);
    const output = 'output' in encrypted ? encrypted.output : '';
    const decrypted = enigmaCipher.decrypt(output, key);
    expect('output' in decrypted && decrypted.output).toBe('Attack at dawn!');
  });

  it('refuses to fit the same rotor twice, because a rotor is a physical wheel', () => {
    expect(() =>
      enigmaCipher.encrypt('A', {
        left: 'I',
        middle: 'I',
        right: 'III',
        reflector: 'B',
        positions: 'AAA',
        rings: 'AAA',
        plugboard: '',
      }),
    ).toThrow(/cannot be fitted twice/);
  });

  it('ships defaults that encrypt on first render', () => {
    // A cipher whose first render is an error is a broken first impression.
    const defaults: Record<string, string> = {};
    for (const spec of enigmaCipher.params) {
      if (spec.kind === 'text' || spec.kind === 'select') defaults[spec.name] = spec.default;
    }
    expect(() => enigmaCipher.encrypt('Meet me at dawn', defaults)).not.toThrow();
  });

  it('has no Attack tab, because breaking it needs a crib', () => {
    expect(enigmaCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(enigmaCipher.attack).toBeUndefined();
  });

  it('implements every tier it does claim', () => {
    expect(enigmaCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks, and credits the people who did it', () => {
    expect(enigmaCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(enigmaCipher.explainer).toContain('bombe');
    expect(enigmaCipher.explainer).toContain('Rejewski');
  });

  it('admits the one place it departs from the real machine', () => {
    expect(enigmaCipher.explainer).toContain('no space bar');
  });
});
