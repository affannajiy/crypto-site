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
RC4 is the stream cipher that Ron Rivest designed for RSA Security in 1987. It
was a trade secret until someone posted it anonymously in 1994. It is ten lines
long, it needs no tables, and it is fast in software. So it went everywhere:
**WEP and WPA on wireless networks**, SSL and TLS, Microsoft Office, PDF and
Kerberos. The lecture lists it with Salsa20, ChaCha20 and A5 as its examples of
stream ciphers.

## How it works

The whole state is **S**, a shuffled list of the 256 byte values, plus two
indices i and j.

**Key scheduling.** S starts as 0, 1, 2, …, 255. Then for each i from 0 to 255:

    j = (j + S[i] + key[i mod keylength]) mod 256
    swap S[i] and S[j]

**Keystream.** For each byte of the message:

    i = (i + 1) mod 256
    j = (j + S[i]) mod 256
    swap S[i] and S[j]
    K = S[(S[i] + S[j]) mod 256]

The ciphertext byte is the plaintext byte XOR K. Decryption is the same
operation, because XORing with K twice gives back the original. The Visualize
tab draws S as a 16 × 16 grid and steps through the swaps.

## A stream cipher is a one-time pad with a computed key

This is the idea the lecture's stream-cipher slide makes. The one-time pad is
unbreakable, but its key must be as long as the message and shared in advance. A
stream cipher shares a short key instead, and **generates** a long keystream from
it. The cost is that the keystream is no longer random. It is only as good as the
generator, and RC4's generator is poor.

The test vectors are the published ones: the key "Key" turns "Plaintext" into
BBF316E8D940AF0AD3, and RFC 6229 gives the keystream for the key 0102030405.

## How this breaks

**The keystream is biased.** The second output byte is 0 about twice as often as
it should be, for any key. Other early bytes lean towards other values. The
Visualize tab measures the first of these live. With enough ciphertexts of the
same plaintext, an attacker counts the ciphertext bytes, and the commonest one
gives the plaintext byte away. In 2013 and 2015 this recovered HTTPS cookies and
passwords from real TLS connections.

**The key schedule leaks the key.** If the key is a secret joined to a value the
attacker can see, the first keystream bytes reveal the secret a little at a time.
This is the **Fluhrer, Mantin and Shamir** attack of 2001. WEP built every packet
key as a 24-bit public IV followed by the Wi-Fi password. So capturing a few tens
of thousands of packets recovered the password, and by 2007 that took under a
minute. WEP's failure is the reason WPA2 uses AES.

**There is no nonce.** RC4 takes only a key. Encrypt two messages under the same
key and the keystreams are identical. XOR the two ciphertexts and the keystream
cancels, which leaves the XOR of the two plaintexts. That is the one-time pad's
"two-time pad" failure, and protocols had to bolt a per-message key on top.

There is no Attack tab, because every one of these attacks needs many
ciphertexts, and the attack tab receives one. RFC 7465 has prohibited RC4 in TLS
since 2015. **Do not use it for anything.**
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
