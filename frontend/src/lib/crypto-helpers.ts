export function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(h: string): Uint8Array {
  const cleaned = h.replace(/[^0-9a-fA-F]/g, "");
  const padded = cleaned.length % 2 ? "0" + cleaned : cleaned;
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256(b: Uint8Array): Promise<Uint8Array> {
  const buf = new ArrayBuffer(b.byteLength);
  new Uint8Array(buf).set(b);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(h);
}

export function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i % b.length];
  return out;
}
