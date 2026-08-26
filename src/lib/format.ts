/**
 * Display helpers for the things ciphers produce that are not readable text:
 * bytes, hex, base64. Plain TypeScript, no React.
 */

const HEX_DIGITS = '0123456789abcdef';

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += HEX_DIGITS[byte >> 4];
    out += HEX_DIGITS[byte & 15];
  }
  return out;
}

/**
 * Parses hex, ignoring spaces so a user can paste grouped output back in.
 * Returns null rather than throwing: a half-typed key is a normal state, not an
 * error condition (UI-UX §7c.6 — never show an error early).
 */
export function fromHex(hex: string): Uint8Array | null {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) return null;

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Groups hex into byte pairs so a long key stays readable: "a1 b2 c3". */
export function groupHex(hex: string, bytesPerGroup = 1): string {
  const clean = hex.replace(/\s+/g, '');
  const chars = bytesPerGroup * 2;
  return (clean.match(new RegExp(`.{1,${chars}}`, 'g')) ?? []).join(' ');
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Cryptographically random bytes, for generating a demo key. */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** "1,234" — thousands separators for counts shown to a person. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** Rounds to a fixed number of significant figures for a readable measurement. */
export function formatThroughput(charsPerSecond: number): string {
  if (charsPerSecond >= 1_000_000) return `${(charsPerSecond / 1_000_000).toFixed(1)}M chars/s`;
  if (charsPerSecond >= 1_000) return `${(charsPerSecond / 1_000).toFixed(1)}k chars/s`;
  return `${Math.round(charsPerSecond)} chars/s`;
}
