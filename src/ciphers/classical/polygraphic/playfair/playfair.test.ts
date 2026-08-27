import { describe, expect, it } from 'vitest';
import {
  ALTERNATE_PADDING,
  PADDING,
  SIZE,
  SQUARE_ALPHABET,
  buildSquare,
  classify,
  findPosition,
  playfair,
  playfairTrace,
  prepare,
  transformPair,
} from './playfair';
import playfairCipher from './index';

/**
 * A seeded generator, so a property test that fails fails again on the next run.
 * An unreproducible test failure is worse than no test.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const letters = (prepared: ReturnType<typeof prepare>) =>
  prepared.map((p) => p.letter).join('');

describe('buildSquare', () => {
  it('puts the keyword first, then the rest of the alphabet', () => {
    expect(buildSquare('MONARCHY')).toBe('MONARCHYBDEFGIKLPQSTUVWXZ');
  });

  it('uses each letter once, however often the keyword repeats it', () => {
    expect(buildSquare('PLAYFAIR EXAMPLE')).toBe('PLAYFIREXMBCDGHKNOQSTUVWZ');
  });

  it('always holds all 25 letters, with no J', () => {
    const random = mulberry32(11);
    for (let run = 0; run < 100; run += 1) {
      let keyword = '';
      for (let i = 0; i < 1 + Math.floor(random() * 14); i += 1) {
        keyword += String.fromCharCode(65 + Math.floor(random() * 26));
      }
      const square = buildSquare(keyword);
      expect(square).toHaveLength(SIZE * SIZE);
      expect(square).not.toContain('J');
      expect([...square].sort().join('')).toBe([...SQUARE_ALPHABET].sort().join(''));
    }
  });

  it('folds a J in the keyword into I', () => {
    expect(buildSquare('JAM')).toBe(buildSquare('IAM'));
  });

  it('falls back to plain alphabetical order with no keyword', () => {
    expect(buildSquare('')).toBe(SQUARE_ALPHABET);
  });

  it('ignores spaces and punctuation in the keyword', () => {
    expect(buildSquare('play fair!')).toBe(buildSquare('PLAYFAIR'));
  });
});

describe('findPosition', () => {
  it('locates a letter by row and column', () => {
    const square = buildSquare('MONARCHY');
    expect(findPosition(square, 'M')).toEqual({ row: 0, column: 0 });
    expect(findPosition(square, 'R')).toEqual({ row: 0, column: 4 });
    expect(findPosition(square, 'Z')).toEqual({ row: 4, column: 4 });
  });

  it('finds J where I is', () => {
    const square = buildSquare('MONARCHY');
    expect(findPosition(square, 'J')).toEqual(findPosition(square, 'I'));
  });
});

describe('prepare', () => {
  it('drops anything that is not a letter', () => {
    // HITHERE is seven letters, so it also picks up the odd-length padding.
    expect(letters(prepare('Hi, there!'))).toBe('HITHEREX');
  });

  it('folds J into I', () => {
    expect(letters(prepare('JAM'))).toBe('IAMX');
  });

  it('wedges a padding letter between a doubled pair', () => {
    expect(letters(prepare('BALLOON'))).toBe('BALXLOON');
  });

  it('uses the alternate padding when the doubled letter is itself X', () => {
    // FO XQ XQ: the doubled X takes a Q between it, and the Q that lands last
    // then leaves an odd length, which is padded with a Q for the same reason.
    expect(letters(prepare('FOXX'))).toBe('FOXQXQ');
  });

  it('leaves a doubled pair alone when it straddles two pairs anyway', () => {
    // ABBC splits as AB BC, so the two Bs never share a pair and need no padding.
    expect(letters(prepare('ABBC'))).toBe('ABBC');
  });

  it('pads an odd length', () => {
    expect(letters(prepare('ODD'))).toBe('ODDX');
    expect(letters(prepare('BOX'))).toBe('BOXQ');
  });

  it('always produces an even number of letters', () => {
    const random = mulberry32(3);
    const source = ' abcXYZ.,!zqMjJ';
    for (let run = 0; run < 300; run += 1) {
      let text = '';
      for (let i = 0; i < Math.floor(random() * 40); i += 1) {
        text += source.charAt(Math.floor(random() * source.length));
      }
      expect(prepare(text).length % 2).toBe(0);
    }
  });

  it('never leaves a pair of identical letters', () => {
    const random = mulberry32(5);
    for (let run = 0; run < 300; run += 1) {
      let text = '';
      for (let i = 0; i < Math.floor(random() * 40); i += 1) {
        text += 'ABX'.charAt(Math.floor(random() * 3));
      }
      const prepared = prepare(text);
      for (let i = 0; i + 1 < prepared.length; i += 2) {
        expect(prepared[i]?.letter).not.toBe(prepared[i + 1]?.letter);
      }
    }
  });

  it('remembers where each letter came from, and marks the ones it invented', () => {
    const prepared = prepare('Hit!');
    expect(prepared.map((p) => p.source)).toEqual([0, 1, 2, -1]);
    expect(prepared[3]?.letter).toBe(PADDING);
  });

  it('is empty for text with no letters', () => {
    expect(prepare('123 !!')).toEqual([]);
  });
});

describe('classify', () => {
  it('names the three rules', () => {
    expect(classify({ row: 1, column: 0 }, { row: 1, column: 4 })).toBe('row');
    expect(classify({ row: 0, column: 2 }, { row: 3, column: 2 })).toBe('column');
    expect(classify({ row: 0, column: 1 }, { row: 3, column: 2 })).toBe('rectangle');
  });
});

describe('transformPair', () => {
  const square = buildSquare('MONARCHY');

  it('moves right along a row, wrapping at the edge', () => {
    // M O N A R is row 0, so AR becomes RM: R follows A, and M wraps round after R.
    expect(transformPair(square, 'A', 'R').output).toBe('RM');
  });

  it('moves down a column, wrapping at the bottom', () => {
    // M C E L U is column 0, so MU becomes CM: C is below M, and M wraps after U.
    expect(transformPair(square, 'M', 'U').output).toBe('CM');
  });

  it('swaps the columns of a rectangle', () => {
    expect(transformPair(square, 'H', 'S').output).toBe('BP');
  });

  it('reverses itself when decrypting', () => {
    for (const pair of ['AR', 'MU', 'HS', 'ZY', 'QT']) {
      const first = pair.charAt(0);
      const second = pair.charAt(1);
      const { output } = transformPair(square, first, second);
      const back = transformPair(square, output.charAt(0), output.charAt(1), 'decrypt');
      expect(back.output).toBe(pair);
    }
  });

  it('reports which rule it used', () => {
    expect(transformPair(square, 'A', 'R').rule).toBe('row');
    expect(transformPair(square, 'M', 'U').rule).toBe('column');
    expect(transformPair(square, 'H', 'S').rule).toBe('rectangle');
  });
});

describe('playfair', () => {
  it('matches the textbook vector', () => {
    expect(playfair('HIDETHEGOLDINTHETREESTUMP', 'PLAYFAIR EXAMPLE')).toBe(
      'BMODZBXDNABEKUDMUIXMMOUVIF',
    );
  });

  it('decrypts the textbook vector back to its prepared form', () => {
    // Not back to the original: the padding X in TREE survives the round trip and
    // a reader has to drop it. That loss is the price of working on pairs.
    expect(playfair('BMODZBXDNABEKUDMUIXMMOUVIF', 'PLAYFAIR EXAMPLE', 'decrypt')).toBe(
      'HIDETHEGOLDINTHETREXESTUMP',
    );
  });

  it('produces an even number of letters and nothing else', () => {
    const out = playfair('Meet me at the old bridge!', 'MONARCHY');
    expect(out).toMatch(/^[A-Z]*$/);
    expect(out.length % 2).toBe(0);
  });

  it('never contains a J', () => {
    expect(playfair('JUST A JOLLY JAUNT', 'JAZZ')).not.toContain('J');
  });

  it('round-trips the prepared text at any keyword', () => {
    const random = mulberry32(20260825);
    const source = ' abcXYZ.,!zqMjJ';
    for (let run = 0; run < 300; run += 1) {
      let keyword = '';
      for (let i = 0; i < 1 + Math.floor(random() * 10); i += 1) {
        keyword += String.fromCharCode(65 + Math.floor(random() * 26));
      }
      let text = '';
      for (let i = 0; i < Math.floor(random() * 40); i += 1) {
        text += source.charAt(Math.floor(random() * source.length));
      }

      const prepared = letters(prepare(text));
      const encrypted = playfair(text, keyword);
      expect(playfair(encrypted, keyword, 'decrypt')).toBe(prepared);
    }
  });

  it('handles text with no letters at all', () => {
    expect(playfair('123 !!', 'MONARCHY')).toBe('');
  });

  it('is its own decryption table', () => {
    // Encrypting with one square and decrypting with the same one is the whole
    // key management story of this cipher.
    const encrypted = playfair('ATTACKATDAWN', 'MONARCHY');
    expect(playfair(encrypted, 'monarchy', 'decrypt')).toBe(letters(prepare('ATTACKATDAWN')));
  });
});

describe('playfairTrace', () => {
  it('agrees with the untraced cipher', () => {
    const text = 'Meet me at the old bridge at midnight.';
    expect(playfairTrace(text, 'MONARCHY').output).toBe(playfair(text, 'MONARCHY'));
    expect(playfairTrace(text, 'MONARCHY', 'decrypt').output).toBe(
      playfair(text, 'MONARCHY', 'decrypt'),
    );
  });

  it('emits one step per pair, not per character', () => {
    const { steps, output } = playfairTrace('HIDETHEGOLDINTHETREESTUMP', 'PLAYFAIR EXAMPLE');
    expect(steps).toHaveLength(13);
    expect(output).toHaveLength(26);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i);
      expect(step.input).toHaveLength(2);
      expect(step.output).toHaveLength(2);
    });
  });

  it('gives each pair an output range two characters wide, in order', () => {
    const { steps, output } = playfairTrace('HIDETHEGOLD', 'PLAYFAIR EXAMPLE');
    steps.forEach((step) => {
      expect(step.outputHighlight).toEqual({ start: step.index * 2, end: step.index * 2 + 2 });
      expect(output.slice(step.outputHighlight?.start, step.outputHighlight?.end)).toBe(
        step.output,
      );
    });
  });

  it('points the input range back at the message the user actually typed', () => {
    // "Hi there" — the second pair is TH, at indices 3 and 4 of the typed text.
    const { steps } = playfairTrace('Hi there', 'MONARCHY');
    expect(steps[0]?.highlight).toEqual({ start: 0, end: 2 });
    expect(steps[1]?.highlight).toEqual({ start: 3, end: 5 });
  });

  it('covers the space when a pair straddles one', () => {
    // "AB CD" — the first pair is A and B, the second C and D, but "BC" would
    // straddle the space. Here the first pair is AB and the second CD.
    const { steps } = playfairTrace('A BCD', 'MONARCHY');
    expect(steps[0]?.highlight).toEqual({ start: 0, end: 3 });
  });

  it('names the rule in the title', () => {
    const { steps } = playfairTrace('AR', 'MONARCHY');
    expect(steps[0]?.title).toBe('AR → RM (row)');
  });

  it('says when a letter was inserted rather than typed', () => {
    const { steps } = playfairTrace('BALLOON', 'MONARCHY');
    const padded = steps[1];
    expect(padded?.data?.['inserted']).toBe(true);
    expect(padded?.detail).toContain('inserted by the cipher');
  });

  it('carries the shape the visualizer reads', () => {
    const step = playfairTrace('AR', 'MONARCHY').steps[0];
    expect(step?.data).toMatchObject({
      pairIndex: 0,
      first: 'A',
      second: 'R',
      result: 'RM',
      rule: 'row',
      firstPosition: { row: 0, column: 3 },
      secondPosition: { row: 0, column: 4 },
      inserted: false,
      square: 'MONARCHYBDEFGIKLPQSTUVWXZ',
      direction: 'encrypt',
    });
  });

  it('produces no steps for text with no letters', () => {
    expect(playfairTrace('123 !!', 'MONARCHY').steps).toEqual([]);
  });
});

describe('the module', () => {
  it('is wired to the algorithm', () => {
    const result = playfairCipher.encrypt('HIDETHEGOLDINTHETREESTUMP', {
      keyword: 'PLAYFAIR EXAMPLE',
    });
    expect('output' in result && result.output).toBe('BMODZBXDNABEKUDMUIXMMOUVIF');
  });

  it('round-trips through the module, to the prepared text', () => {
    const encrypted = playfairCipher.encrypt('Attack at dawn', { keyword: 'MONARCHY' });
    const output = 'output' in encrypted ? encrypted.output : '';
    // `decrypt` is optional on the contract now that a hash can declare itself
    // one-way, so a cipher's own test says out loud that it has one.
    const reverse = playfairCipher.decrypt;
    if (reverse === undefined) throw new Error('This cipher must be reversible.');
    const decrypted = reverse(output, { keyword: 'MONARCHY' });
    expect('output' in decrypted && decrypted.output).toBe('ATTACKATDAWN');
  });

  it('works with an empty keyword rather than throwing', () => {
    // Plain alphabetical order is a terrible key and a perfectly valid square, so
    // this is a weak cipher rather than an error.
    const result = playfairCipher.encrypt('HI', { keyword: '' });
    expect('output' in result && result.output).toMatch(/^[A-Z]{2}$/);
  });

  it('has no Attack tab, and does not pretend to', () => {
    expect(playfairCipher.tiers).toEqual(['encrypt', 'visualize', 'benchmark']);
    expect(playfairCipher.tiers).not.toContain('attack');
    expect(playfairCipher.attack).toBeUndefined();
  });

  it('implements every tier it does claim', () => {
    expect(playfairCipher.visualize).toBeDefined();
  });

  it('tells the reader how it breaks, including why there is no Attack tab', () => {
    expect(playfairCipher.explainer.toLowerCase()).toContain('how this breaks');
    expect(playfairCipher.explainer).toContain('no Attack tab');
  });

  it('uses the alternate padding letter it documents', () => {
    expect(ALTERNATE_PADDING).toBe('Q');
    expect(PADDING).toBe('X');
  });
});
