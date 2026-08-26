/**
 * DES's entry in the registry.
 *
 * **No Attack tab.** The attack on DES is a brute force over 2^56 keys, and that
 * is a real, successful, historically important attack — it just is not a button.
 * EFF's Deep Crack did it in 56 hours in 1998 using purpose-built hardware costing
 * a quarter of a million dollars; a browser tab would take longer than the
 * remaining lifetime of the sun. Offering a search that cannot finish would teach
 * that DES resisted, when what actually happened is that it fell.
 *
 * This is the same judgement Enigma's page makes, and it is worth noticing that
 * the two are opposites: Enigma's key space is far larger than DES's and Enigma
 * fell to structure, while DES has no usable structural weakness and fell to
 * money. Key size and cipher quality are independent, and here they are inverted.
 */
import type { CipherModule, Params, TraceResult } from '../../../types';
import { type Mode, desTrace, readIv, readKey } from './des';
import FeistelRounds from './FeistelRounds';

/** Params arrive as `string | number` because they come from form controls. */
function readOptions(p: Params) {
  return {
    key: readKey(String(p['key'] ?? '')),
    mode: (String(p['mode'] ?? 'CBC') === 'ECB' ? 'ECB' : 'CBC') as Mode,
    iv: readIv(String(p['iv'] ?? '')),
  };
}

const explainer = `
The Data Encryption Standard, adopted by the US government in 1977 and the first
cipher a government ever published **in full** and asked the world to use. That
decision looks unremarkable now and was not: before DES, ciphers were secrets about
secrets. Modern cryptography is a public discipline because of this one.

## The Feistel network

Split the 64-bit block in half. Each round:

    L(i) = R(i-1)
    R(i) = L(i-1) XOR F(R(i-1), K(i))

Sixteen times, then swap the halves once at the end.

Now the important part. **F does not have to be invertible.** Reversing the rounds
undoes them whatever F is, because the XOR cancels itself — so a designer can make
F as destructive as they like and decryption still costs nothing extra. DES's F
throws information away on purpose: its S-boxes take six bits and return four, so
four different inputs land on every output.

That freedom is what a Feistel network buys. AES gave it up and pays the price:
every step of AES needs its own inverse, and the decryption path is a different
piece of code. DES decrypts by running the same sixteen rounds with the key
schedule backwards, and nothing else changes at all.

## Inside F

**Expand** 32 bits to 48 by repeating the bits at the edge of each group — which is
how a change in one bit reaches two S-boxes instead of one. **XOR** the 48-bit
round key. **Substitute** through eight S-boxes, six bits in and four out.
**Permute** the 32 bits so each S-box's output feeds different boxes next round.

The S-boxes are the only non-linear part of DES. Without them the whole cipher
would be a system of linear equations and would fall the way the Hill cipher does.

## The S-box story

IBM designed DES and the NSA changed the S-boxes before publication, without
explanation. For sixteen years this was widely assumed to be a back door.

Then in 1990 Eli Biham and Adi Shamir published **differential cryptanalysis**, and
it turned out the modified S-boxes were close to optimally resistant to it while
the original ones were not. IBM later confirmed they had found the technique
themselves in 1974 and been asked to keep quiet. The NSA had strengthened DES
against an attack that would not be publicly discovered for another sixteen years.

They also **shortened the key from 64 bits to 56**, which is the other half of the
story and the half that killed it.

## How this breaks

**By trying all the keys.** 2⁵⁶ is about 72 quadrillion, which was out of reach in
1977 and was not for long. Whitfield Diffie and Martin Hellman argued in 1977 that
a $20 million machine could do it in a day, and were dismissed. In 1998 the
Electronic Frontier Foundation built **Deep Crack** for about $250,000 and broke a
DES key in 56 hours. In 1999 the same machine, working with distributed.net, did it
in 22 hours. Today it is a cloud bill.

There is no Attack tab on this page for the same reason there is none on Enigma's:
a brute force that cannot finish in a browser is not a demonstration of anything.

**Note what did *not* break it.** After fifty years of public attack there is no
practical structural weakness in DES. Differential cryptanalysis needs 2⁴⁷ chosen
plaintexts; linear cryptanalysis needs 2⁴³ known plaintexts. Both are academically
important and neither is how anyone actually broke DES. **The design was sound and
the key was too short**, and those are different failures with different lessons.
Compare Enigma, whose key space is vastly larger than DES's and which fell to
structure and procedure. Key size and cipher quality are independent variables.

**3DES bought time and then ran out of it.** Encrypt, decrypt, encrypt with two or
three keys gives about 112 bits of security — not 168, because of a
meet-in-the-middle attack — and it stayed in banking for decades. But its **64-bit
block** is a separate problem from its key: with a block that small, a repeated
ciphertext block becomes likely after about 32 GB of traffic, which the **Sweet32**
attack exploited against real HTTPS and OpenVPN connections in 2016. NIST withdrew
3DES entirely in 2023. A block size is a security parameter too, and AES's 128-bit
block is why it does not have this problem.

**And everything on the AES page still applies.** ECB still shows you the picture.
CBC still has no authentication. A padding oracle still decrypts your message.
Those are properties of modes, not of the cipher underneath them, and they came
along unchanged from DES to AES.
`.trim();

const desCipher: CipherModule = {
  slug: 'des',
  name: 'DES',
  family: 'symmetric',
  year: '1977',
  blurb: 'Sixteen Feistel rounds. A sound design with a key that was too short from the start.',
  explainer,
  // No 'attack'. The attack is 2^56 keys, which is hardware and money rather than
  // a button. See the note at the top of this file.
  tiers: ['encrypt', 'visualize', 'benchmark'],
  params: [
    {
      kind: 'text',
      name: 'key',
      label: 'Key (16 hex digits — 64 bits, of which 56 are used)',
      default: '133457799bbcdff1',
      placeholder: '16 hex digits',
    },
    {
      kind: 'select',
      name: 'mode',
      label: 'Mode',
      options: [
        { value: 'CBC', label: 'CBC — each block chained to the last' },
        { value: 'ECB', label: 'ECB — each block alone' },
      ],
      default: 'CBC',
    },
    {
      kind: 'text',
      name: 'iv',
      label: 'IV (16 hex digits; CBC only)',
      default: '0f0e0d0c0b0a0908',
      placeholder: '16 hex digits',
    },
  ],

  encrypt(input: string, p: Params): TraceResult {
    return desTrace(input, readOptions(p), 'encrypt');
  },

  decrypt(input: string, p: Params): TraceResult {
    return desTrace(input, readOptions(p), 'decrypt');
  },

  visualize: FeistelRounds,
};

export default desCipher;
