/**
 * A published MD5 collision.
 *
 * Two different 128-byte messages with the same MD5 digest, from Wang and Yu's
 * 2004 result — the paper that ended MD5. They are stored as hex because they
 * are not text: they are bytes chosen so that the difference introduced in the
 * first block is cancelled by the difference in the second.
 *
 * This is the module's answer to a problem the contract has: `attack(ciphertext)`
 * cannot express "find me two inputs that agree", because a hash has no
 * ciphertext and no key to recover. So MD5 ships no Attack tab, and its break
 * lives on **Visualize** instead — the same workaround RSA and Diffie-Hellman
 * use for their own version of gap 6.
 *
 * Nothing here is trusted. `md5.test.ts` hashes both messages with this app's own
 * implementation and asserts the digests are equal and the messages are not, so a
 * transcription error in the hex below fails the build rather than teaching a lie.
 */

/** Wang and Yu, 2004. Six bytes differ, at offsets 19, 45, 59, 83, 109 and 123. */
export const WANG_A =
  'd131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f89' +
  '55ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5b' +
  'd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0' +
  'e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70';

export const WANG_B =
  'd131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f89' +
  '55ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5b' +
  'd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0' +
  'e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70';

/** Byte offsets where the two messages differ. Derived, never asserted by hand. */
export function differingBytes(a: Uint8Array, b: Uint8Array): number[] {
  const at: number[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) at.push(i);
  }
  return at;
}
