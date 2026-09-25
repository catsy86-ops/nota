/**
 * Fast, synchronous, non-cryptographic content hash for images (base64 data URLs).
 * Used only to identify identical image content across devices for P2P sync
 * (`imageSync.ts`) — not a security boundary, collisions just mean a rare
 * self-healing display mix-up, never data loss (same tolerance as `roomNameFor`
 * in yjsSync.ts). Kept synchronous (rather than crypto.subtle SHA-256) so it can
 * be called directly from the existing synchronous yjsStore.ts write paths.
 */
export function hashImage(base64: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193 ^ base64.length;
  // Sampling every 7th char keeps this fast even for multi-MB data URLs while
  // still spreading across the whole string (unlike hashing only a prefix).
  const step = base64.length > 4096 ? 7 : 1;
  for (let i = 0; i < base64.length; i += step) {
    const c = base64.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 ^ c) >>> 0;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}${base64.length.toString(16)}`;
}
