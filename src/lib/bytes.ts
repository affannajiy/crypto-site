/**
 * Bytes and hex.
 *
 * The hashing family needs the same four conversions in every module, and the
 * first eleven ciphers each carrying their own copy of the alphabet plumbing was
 * the mistake this file exists to avoid repeating. Plain TypeScript, no React.
 *
 * `utf8Bytes` is the one worth reading twice: a hash sees bytes, not characters,
 * so an emoji is four inputs and not one. Every test in this family checks a
 * non-ASCII string for exactly that reason.
 */

/** UTF-8 bytes of a string. What actually gets hashed. */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Bytes from a hex string, or an error a reader can act on.
 *
 * `label` names the field, because "expected 32 hex characters" on its own does
 * not say which of a page's three hex boxes is wrong.
 */
export function hexToBytes(hex: string, label = 'value'): Uint8Array {
  const cleaned = hex.replace(/\s+/g, '');
  if (cleaned.length % 2 !== 0) {
    throw new Error(`The ${label} has ${cleaned.length} hex characters, and hex comes in pairs.`);
  }
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new Error(`The ${label} must be hex — the digits 0-9 and the letters a-f, nothing else.`);
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** XOR of two equal-length byte arrays. Throws rather than silently truncating. */
export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) throw new Error('Cannot XOR two runs of different lengths.');
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i += 1) out[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
  return out;
}
