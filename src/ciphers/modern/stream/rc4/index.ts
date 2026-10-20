/**
 * RC4's entry in the registry.
 *
 * **No Attack tab.** RC4 is thoroughly broken, but every real attack needs many
 * ciphertexts: many WEP packets under related keys, or the same cookie under
 * millions of TLS keys. `attack(ciphertext)` receives one. This is gap 6, in
 * the "several messages in depth" form that ADFGVX hit first. The bias itself is
 * measured live on the Visualize tab instead.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { type KeyFormat, rc4, rc4Trace, readRc4Key } from './rc4';
import Rc4State from './Rc4State';

function readKey(p: Params) {
  const format: KeyFormat = String(p['keyFormat'] ?? 'text') === 'hex' ? 'hex' : 'text';
  return readRc4Key(String(p['key'] ?? ''), format);
}

const explainer = `
A stream cipher by Ron Rivest, from 1987. It is ten lines long, and WEP and SSL/TLS used it.

## How it works

- The state S holds the 256 byte values. The key schedule shuffles them.
- Each step, all mod 256: add 1 to i, add S[i] to j, swap S[i] and S[j], then output K = S[S[i] + S[j]].
- The ciphertext is plaintext XOR K. Decryption is the same operation.
- The test vector: the key "Key" turns "Plaintext" into BBF316E8D940AF0AD3.

## How this breaks

- **The keystream is biased.** The second byte is 0 twice as often as it should be. The Visualize tab measures this. The bias recovered HTTPS cookies in 2013 and 2015.
- **The key schedule leaks the key.** This is the Fluhrer, Mantin and Shamir attack of 2001. WEP built each key from a public IV and the password, so by 2007 it fell in under a minute.
- **There is no nonce.** The same key gives the same keystream.
- **There is no Attack tab.** Every attack needs many ciphertexts. RFC 7465 has banned RC4 in TLS since 2015.
`.trim();

const rc4Cipher: CipherModule = {
  slug: 'rc4',
  name: 'RC4',
  family: 'symmetric',
  year: '1987',
  origin: 'Ron Rivest, RSA Security; leaked in 1994',
  keyType: 'A key of 1 to 256 bytes',
  security: 'broken',
  difficulty: 'intermediate',
  keywords: ['arcfour', 'arc4', 'stream cipher', 'wep', 'wireless', 'keystream', 'bias', 'ksa', 'prga'],
  blurb: 'A shuffled list of 256 bytes, stirred by two indices. Ran WEP and early TLS, and broke both.',
  explainer,
  visualizeNote:
    'This draws the current run: the state S after the key schedule, and after each keystream byte. The bias experiment below it runs on random keys of its own.',
  // No 'attack'. See the file header.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key',
      default: 'Key',
      placeholder: 'A password, or hex bytes',
      randomise: { alphabet: 'letters', length: 10 },
    },
    {
      kind: 'select',
      name: 'keyFormat',
      label: 'Key format',
      options: [
        { value: 'text', label: 'Text — the key is the UTF-8 bytes of what you type' },
        { value: 'hex', label: 'Hex — the key is raw bytes' },
      ],
      default: 'text',
      randomise: false,
    },
  ],
  examples: [
    {
      label: 'The classic vector: Key and Plaintext → BBF316E8D940AF0AD3',
      input: 'Plaintext',
      params: { key: 'Key', keyFormat: 'text' },
    },
    {
      label: 'Wiki and pedia → 1021BF0420',
      input: 'pedia',
      params: { key: 'Wiki', keyFormat: 'text' },
    },
    {
      label: 'Secret and Attack at dawn',
      input: 'Attack at dawn',
      params: { key: 'Secret', keyFormat: 'text' },
    },
    {
      label: 'A hex key, as RFC 6229 writes them',
      input: 'Meet me at the old bridge at midnight.',
      params: { key: '0102030405', keyFormat: 'hex' },
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return rc4Trace(input, readKey(p), 'encrypt');
  },

  benchmark(input: string, p: Params): string {
    return rc4(input, readKey(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return rc4Trace(input, readKey(p), 'decrypt');
  },

  visualize: Rc4State,
};

export default rc4Cipher;
