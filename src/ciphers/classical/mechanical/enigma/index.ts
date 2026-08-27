/**
 * Enigma's entry in the registry.
 *
 * Six params, which is the most of any cipher here and is not padding: the key to
 * an Enigma message genuinely was six separate settings, distributed on different
 * schedules, and reducing them to one box would misrepresent what the operators
 * were handling.
 *
 * **No Attack tab**, and this is the fourth distinct reason for one being absent
 * in this app. Playfair: the search is out of scope. One-Time Pad: no search can
 * exist. Atbash and ROT13: there is nothing to search. Enigma is none of those —
 * it is a search that is genuinely enormous and genuinely succeeded, but it needs
 * a **crib**: a guess at some plaintext, slid along the ciphertext, tested by the
 * one rule that no letter is ever itself. The contract's `attack(ciphertext)`
 * cannot express a crib, and a brute force over 158 million million million
 * settings is not a button. Turing's bombe is the answer, and the explainer
 * describes what it actually did rather than pretending this page can do it.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import {
  REFLECTORS,
  ROTORS,
  type Settings,
  enigmaTrace,
  parsePlugboard,
  parsePositions,
} from './enigma';
import EnigmaPath from './EnigmaPath';
import { randomIntInclusive } from '../../../params';
import { A_TO_Z } from '../../../../lib/letters';

/** Params arrive as `string | number` because they come from form controls. */
function readSettings(p: Params): Settings {
  const rotors: [string, string, string] = [
    String(p['left'] ?? 'I'),
    String(p['middle'] ?? 'II'),
    String(p['right'] ?? 'III'),
  ];
  if (new Set(rotors).size !== 3) {
    throw new Error(
      `The machine has three slots and each rotor is a physical wheel, so the same one cannot be fitted twice. Chosen: ${rotors.join(', ')}.`,
    );
  }
  return {
    rotors,
    reflector: String(p['reflector'] ?? 'B'),
    positions: parsePositions(String(p['positions'] ?? 'AAA'), 'The starting positions'),
    rings: parsePositions(String(p['rings'] ?? 'AAA'), 'The ring settings'),
    plugboard: parsePlugboard(String(p['plugboard'] ?? '')),
  };
}

const rotorOptions = ROTORS.map((r) => ({ value: r.name, label: `Rotor ${r.name}` }));

const explainer = `
Everything else in this app is a rule you could carry out with a pencil. This is a
**machine**, and the key is its physical state: which three rotors are fitted, in
which order, turned to which letters, with which ring settings, and which pairs of
letters are patched together by cables on the front panel.

Press a key and current runs through the plugboard, through three rotors, into a
reflector, back through the same three rotors by a different path, out through the
plugboard, and lights a lamp. Then — before the next press — the rotors turn.

## Why the turning is the point

Vigenère repeats its keyword every few letters, and Kasiski's attack lives entirely
on that repetition. Enigma's rotors give it a period of **16,900** letters, which
is longer than any message anyone sent. The substitution is different for every
single character, so there is no repeating alphabet to find.

That period is not 26³ = 17,576, and the missing 676 is a real mechanical quirk
called **double-stepping**: when the middle rotor sits on its own notch, the pawl
catches it again on the next press, so it advances twice in a row and drags the
left rotor with it. This page reproduces that, because a simulator that does not
will disagree with a real machine and with every historical message.

## The numbers the Germans trusted

Rotor choice and order, ring settings, starting positions, and ten plugboard
cables together give roughly **158 million million million** possible keys. That
number is correct, and it is why the system was believed to be unbreakable.

It is also, almost entirely, beside the point.

## How this breaks

**It can never encipher a letter to itself.** The reflector pairs the 26 contacts
with each other, and a contact cannot be paired with itself, so the return path is
always different from the outward one. That is one bit of information per letter,
given away for free, forever — and it is the hinge everything else turns on. If you
guess that a message contains WETTERBERICHT (weather report), you can slide that
guess along the ciphertext and instantly discard every alignment where any letter
matches itself. Most alignments die immediately. The survivors are worth work.

Turing's **bombe** was built to do that work: take a crib, chain the implied
letter-to-letter relationships into a loop, and run through rotor settings looking
for the ones that do not contradict themselves. It did not try 158 million million
million keys. It used the structure of the crib to make almost all of them
irrelevant before it started, which is what cryptanalysis usually looks like.

**Operators were the other half.** Message keys sent twice at the start of a
transmission gave Marian Rejewski's team in Poland a mathematical foothold years
before the war. Lazy operators chose predictable rotor start positions — their own
initials, or three adjacent keys. Stereotyped messages produced reliable cribs;
a station that reported "nothing to report" every morning was handing over a known
plaintext daily. One German outpost's routine weather signal was worth more than
any weakness in the wiring.

**The plugboard added less than it looked.** Ten cables are a huge factor on paper.
But a plug swap is applied at the very start and the very end of the path, so it
does not disturb the *structure* the bombe was testing — it can be peeled off
afterwards. A defence that multiplies the key space without changing the shape of
the problem is worth far less than its arithmetic suggests.

**And the key space was never the weak point.** This is the lesson, and it is the
one worth carrying out of the classical section entirely: Enigma was not broken by
out-computing it. It was broken by a structural property of the design, by
predictable human behaviour, and by procedure. **A cipher is only as strong as the
system around it** — the same conclusion the One-Time Pad reached from the
opposite direction, where a mathematically perfect algorithm still failed in the
field.

One deliberate simplification here: a real Enigma had no space bar, and operators
sent X for a space. This page passes spacing and punctuation through untouched
without turning the rotors, so the output stays readable. Everything else — the
rotor wirings, the notches, the reflectors, the stepping — is the real thing.
`.trim();

const enigmaCipher: CipherModule = {
  slug: 'enigma',
  name: 'Enigma',
  family: 'classical',
  year: '1918',
  origin: 'Arthur Scherbius; used by the German military',
  keyType: 'Rotor order, ring settings, start positions and plugboard pairs',
  security: 'broken',
  difficulty: 'advanced',
  keywords: ['rotor', 'machine', 'bletchley', 'turing', 'wehrmacht', 'world war two'],
  blurb: 'Three rotors, a reflector and a plugboard. Broken by its own symmetry.',
  explainer,
  // No 'attack'. Breaking Enigma needs a crib, which `attack(ciphertext)` cannot
  // express. See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    { kind: 'select', name: 'left', label: 'Left rotor', options: rotorOptions, default: 'I' },
    { kind: 'select', name: 'middle', label: 'Middle rotor', options: rotorOptions, default: 'II' },
    { kind: 'select', name: 'right', label: 'Right rotor', options: rotorOptions, default: 'III' },
    {
      kind: 'select',
      name: 'reflector',
      label: 'Reflector',
      options: REFLECTORS.map((r) => ({ value: r.name, label: `Reflector ${r.name}` })),
      default: 'B',
    },
    {
      kind: 'text',
      name: 'positions',
      label: 'Starting positions',
      default: 'AAA',
      placeholder: 'Three letters, one per rotor',
      randomise: { alphabet: 'letters', length: 3 },
    },
    {
      kind: 'text',
      name: 'rings',
      label: 'Ring settings',
      default: 'AAA',
      placeholder: 'Three letters, one per rotor',
      randomise: { alphabet: 'letters', length: 3 },
    },
    {
      kind: 'text',
      name: 'plugboard',
      label: 'Plugboard',
      default: '',
      placeholder: 'Pairs of letters: AB CD EF',
    },
  ],
  examples: [
    {
      label: 'Rotors I II III, all at A',
      input: 'Meet me at the old bridge at midnight.',
      params: { left: 'I', middle: 'II', right: 'III', reflector: 'B', positions: 'AAA', rings: 'AAA', plugboard: '' },
    },
    {
      label: 'With a plugboard',
      input: 'Send the second company to the eastern gate before dawn.',
      params: { left: 'II', middle: 'IV', right: 'V', reflector: 'B', positions: 'WXC', rings: 'BQA', plugboard: 'AB CD EF GH' },
    },
    {
      label: 'No letter is ever itself',
      input: 'AAAAAAAAAAAAAAAAAAAAAAAAA',
      params: { left: 'I', middle: 'II', right: 'III', reflector: 'B', positions: 'AAA', rings: 'AAA', plugboard: '' },
    },
  ],

  /**
   * A whole machine setting: three *different* rotors, a reflector, ring
   * settings, start positions, and six plugboard pairs.
   *
   * The rotors are the reason this exists. Each one is a physical wheel, so the
   * same rotor cannot be fitted in two slots — a per-param randomiser choosing
   * three times from one list would produce III, III, II about a fifth of the
   * time. Six plugboard pairs is what the Wehrmacht actually used.
   */
  randomKey(): Params {
    const wheels = ROTORS.map((r) => r.name);
    // Fisher-Yates, then take the first three: the shuffle is what guarantees
    // they differ, rather than a retry loop that usually terminates.
    for (let i = wheels.length - 1; i > 0; i -= 1) {
      const j = randomIntInclusive(0, i);
      const swap = wheels[i] as string;
      wheels[i] = wheels[j] as string;
      wheels[j] = swap;
    }

    const letters = A_TO_Z.split('');
    for (let i = letters.length - 1; i > 0; i -= 1) {
      const j = randomIntInclusive(0, i);
      const swap = letters[i] as string;
      letters[i] = letters[j] as string;
      letters[j] = swap;
    }
    const plugboard = Array.from({ length: 6 }, (_, pair) =>
      `${letters[pair * 2] ?? ''}${letters[pair * 2 + 1] ?? ''}`,
    ).join(' ');

    const letter = () => A_TO_Z[randomIntInclusive(0, 25)] ?? 'A';
    const reflector = REFLECTORS[randomIntInclusive(0, REFLECTORS.length - 1)];

    return {
      left: wheels[0] ?? 'I',
      middle: wheels[1] ?? 'II',
      right: wheels[2] ?? 'III',
      reflector: reflector?.name ?? 'B',
      positions: `${letter()}${letter()}${letter()}`,
      rings: `${letter()}${letter()}${letter()}`,
      plugboard,
    };
  },

  encrypt(input: string, p: Params): TraceResult {
    return enigmaTrace(input, readSettings(p));
  },

  // Identical to `encrypt`. Not a stub: the reflector makes the machine its own
  // inverse, which is why an operator needed no second mode.
  decrypt(input: string, p: Params): TraceResult {
    return enigmaTrace(input, readSettings(p));
  },

  visualize: EnigmaPath,
};

export default enigmaCipher;
