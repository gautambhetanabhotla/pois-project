export type PAPart = "Prelude" | "Symmetric" | "Hashing" | "Public-Key" | "MPC";

export interface PAEntry {
  n: number;
  title: string;
  short: string;
  part: PAPart;
  color: "red" | "green" | "yellow" | "blue" | "purple" | "aqua" | "orange";
}

export const PA_LIST: PAEntry[] = [
  { n: 1, title: "OWFs & PRGs", short: "One-way functions, pseudorandom generators.", part: "Prelude", color: "yellow" },
  { n: 2, title: "GGM PRF", short: "PRG → PRF via the GGM tree construction.", part: "Prelude", color: "yellow" },
  { n: 3, title: "CPA-Secure SKE", short: "Build IND-CPA encryption from a PRF.", part: "Symmetric", color: "green" },
  { n: 4, title: "Block Cipher Modes", short: "ECB / CBC / CTR — see the penguin leak.", part: "Symmetric", color: "green" },
  { n: 5, title: "MACs", short: "Existential unforgeability and length extension.", part: "Symmetric", color: "green" },
  { n: 6, title: "Authenticated Encryption", short: "Encrypt-then-MAC vs malleable CPA.", part: "Symmetric", color: "green" },
  { n: 7, title: "Merkle–Damgård", short: "Compression function → variable-length hash.", part: "Hashing", color: "aqua" },
  { n: 8, title: "DLP-Based Hashing", short: "Collision resistance from hardness.", part: "Hashing", color: "aqua" },
  { n: 9, title: "Birthday Attack", short: "Generic √N collision finder benchmark.", part: "Hashing", color: "aqua" },
  { n: 10, title: "HMAC & CCA", short: "HMAC construction, CCA-secure SKE.", part: "Hashing", color: "aqua" },
  { n: 11, title: "Diffie–Hellman", short: "Public key exchange, MITM walk-through.", part: "Public-Key", color: "blue" },
  { n: 12, title: "Textbook RSA", short: "KeyGen / Enc / Dec with toy primes.", part: "Public-Key", color: "blue" },
  { n: 13, title: "Miller–Rabin", short: "Probabilistic primality testing.", part: "Public-Key", color: "blue" },
  { n: 14, title: "CRT & RSA Speedups", short: "CRT decryption, common-modulus break.", part: "Public-Key", color: "blue" },
  { n: 15, title: "RSA Sign and Verify", short: "RSA signature, verification and RSA Forgery.", part: "Public-Key", color: "blue" },
  { n: 16, title: "ElGamal", short: "DDH-based public-key encryption.", part: "Public-Key", color: "blue" },
  { n: 17, title: "Digital Signatures", short: "RSA-FDH & Schnorr sign/verify.", part: "Public-Key", color: "blue" },
  { n: 18, title: "Oblivious Transfer", short: "1-of-2 OT from RSA.", part: "MPC", color: "purple" },
  { n: 19, title: "Garbled Circuits", short: "Yao's GC for AND / XOR gates.", part: "MPC", color: "purple" },
  { n: 20, title: "Secure 2PC", short: "Yao's millionaires via GC + OT.", part: "MPC", color: "purple" },
];

export const PARTS: { key: PAPart; label: string; color: PAEntry["color"] }[] = [
  { key: "Prelude", label: "Prelude", color: "yellow" },  
  { key: "Symmetric", label: "Symmetric Crypto", color: "green" },
  { key: "Hashing", label: "Hashing & Auth", color: "aqua" },
  { key: "Public-Key", label: "Public-Key Crypto", color: "blue" },
  { key: "MPC", label: "MPC", color: "purple" },
];

export const colorMap: Record<PAEntry["color"], string> = {
  red: "text-gb-red border-gb-red/40 bg-gb-red/10",
  green: "text-gb-green border-gb-green/40 bg-gb-green/10",
  yellow: "text-gb-yellow border-gb-yellow/40 bg-gb-yellow/10",
  blue: "text-gb-blue border-gb-blue/40 bg-gb-blue/10",
  purple: "text-gb-purple border-gb-purple/40 bg-gb-purple/10",
  aqua: "text-gb-aqua border-gb-aqua/40 bg-gb-aqua/10",
  orange: "text-gb-orange border-gb-orange/40 bg-gb-orange/10",
};

export function getPA(n: number): PAEntry | undefined {
  return PA_LIST.find((p) => p.n === n);
}
