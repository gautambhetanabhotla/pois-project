import React from "react";
import { M, MB } from "@/components/Math";
import { PA1 } from "@/components/demos/PA1";
import { PA2 } from "@/components/demos/PA2";
import { PA3 } from "@/components/demos/PA3";
import { PA4 } from "@/components/demos/PA4";
import { PA5 } from "@/components/demos/PA5";
import { PA6 } from "@/components/demos/PA6";
import { PA7 } from "@/components/demos/PA7";
import { PA8 } from "@/components/demos/PA8";
import { PA9 } from "@/components/demos/PA9";
import { PA10 } from "@/components/demos/PA10";
import { PA11 } from "@/components/demos/PA11";
import { PA12 } from "@/components/demos/PA12";
import { PA13 } from "@/components/demos/PA13";
import { PA14 } from "@/components/demos/PA14";
import { PA15 } from "@/components/demos/PA15";
import { PA16 } from "@/components/demos/PA16";
import { PA17 } from "@/components/demos/PA17";
import { PA18 } from "@/components/demos/PA18";
import { PA19 } from "@/components/demos/PA19";
import { PA20 } from "@/components/demos/PA20";

export interface PASpec {
  spec: React.ReactNode;
  demo?: React.ReactNode;
  notes: React.ReactNode;
}

export const PA_CONTENT: Record<number, PASpec> = {
  1: {
    spec: (
      <>
        <p>A function <M>{`f: \\{0,1\\}^n \\to \\{0,1\\}^n`}</M> is one-way if</p>
        <MB>{`\\Pr_{x \\gets \\{0,1\\}^n}\\big[\\mathcal{A}(f(x)) \\in f^{-1}(f(x))\\big] \\le \\mathsf{negl}(n).`}</MB>
        <p>A PRG <M>{`G: \\{0,1\\}^n \\to \\{0,1\\}^{\\ell(n)}`}</M> with <M>{`\\ell(n) > n`}</M> is pseudorandom if its output is computationally indistinguishable from <M>{`U_{\\ell(n)}`}</M>.</p>
      </>
    ),
    demo: <PA1 />,
    notes: <p>Iterating SHA-256 here gives a stretching PRG only heuristically — a real PRG needs HILL or a stream cipher.</p>,
  },
  2: {
    spec: (<><p>The GGM construction lifts a length-doubling PRG <M>G</M> to a PRF.</p><MB>{`F_k(x_1\\Vert\\dots\\Vert x_n) = G_{x_n}\\circ\\dots\\circ G_{x_1}(k)`}</MB></>),
    demo: <PA2 />,
    notes: <p>Each input bit selects the left (<M>G_0</M>) or right (<M>G_1</M>) half of the PRG output, walking down a binary tree of depth <M>n</M>.</p>,
  },
  3: {
    spec: (<><p>IND-CPA secure SKE from a PRF:</p><MB>{`\\mathsf{Enc}_k(m) = (r, F_k(r) \\oplus m), \\quad r \\gets \\{0,1\\}^n`}</MB></>),
    demo: <PA3 />,
    notes: <p>Re-encrypting the same message yields a different ciphertext — the adversary's IND-CPA advantage is bounded by the PRF distinguishing advantage plus a birthday term in <M>r</M>.</p>,
  },
  4: {
    spec: (<><p>ECB encrypts each block independently; identical plaintext blocks produce identical ciphertext blocks. CBC chains blocks with the previous ciphertext; CTR XORs with <M>{`F_k(\\text{ctr})`}</M>.</p></>),
    demo: <PA4 />,
    notes: <p>The famous "ECB penguin" makes the leakage visible. CBC and CTR achieve IND-CPA; only AE modes (PA#6, PA#10) achieve CCA.</p>,
  },
  5: {
    spec: (<><p>EUF-CMA: the adversary, given a tagging oracle, cannot produce a valid <M>(m^*, t^*)</M> for an unqueried <M>m^*</M>.</p></>),
    demo: <PA5 />,
    notes: <p>Naïve <M>{`H(k\\Vert m)`}</M> with Merkle–Damgård hashes is vulnerable to length extension — use HMAC (PA#10).</p>,
  },
  6: {
    spec: (<><p>CPA security ≠ integrity. Encrypt-then-MAC achieves CCA / authenticated encryption.</p><MB>{`c = \\mathsf{Enc}_{k_e}(m), \\; t = \\mathsf{Mac}_{k_m}(c)`}</MB></>),
    demo: <PA6 />,
    notes: <p>Always verify the MAC <em>before</em> decrypting; verify in constant time to avoid timing leaks.</p>,
  },
  7: {
    spec: (<><p>Merkle–Damgård extends a compression function <M>{`h: \\{0,1\\}^{n+m} \\to \\{0,1\\}^n`}</M> into a hash on arbitrary-length inputs.</p><MB>{`h_i = h(h_{i-1} \\Vert x_i), \\quad h_0 = IV`}</MB></>),
    demo: <PA7 />,
    notes: <p>Collision resistance of <M>h</M> is preserved (MD theorem) but length-extension is inherent.</p>,
  },
  8: {
    spec: (<><p>Define <M>{`H(x_1, x_2) = g_1^{x_1} g_2^{x_2} \\bmod p`}</M>. Finding a collision yields a non-trivial discrete log relation between <M>g_1</M> and <M>g_2</M>.</p></>),
    demo: <PA8 />,
    notes: <p>The hunt below uses a truncated SHA-256 — collisions appear after ≈ <M>{`2^{n/2}`}</M> samples by the birthday paradox.</p>,
  },
  9: {
    spec: (<><p>For an <M>n</M>-bit hash, collisions are expected after <M>{`\\Theta(2^{n/2})`}</M> queries.</p></>),
    demo: <PA9 />,
    notes: <p>This is why 128-bit hashes are dead — only <M>{`2^{64}`}</M> work to collide.</p>,
  },
  10: {
    spec: (<><MB>{`\\mathsf{HMAC}_k(m) = H((k \\oplus \\text{opad}) \\Vert H((k \\oplus \\text{ipad}) \\Vert m))`}</MB><p>HMAC is a PRF assuming the compression function is dual-PRF-secure.</p></>),
    demo: <PA10 />,
    notes: <p>Combining HMAC with a CPA-secure SKE via Encrypt-then-MAC yields a CCA-secure scheme.</p>,
  },
  11: {
    spec: (<><p>Diffie–Hellman key exchange in a cyclic group <M>{`\\mathbb{G} = \\langle g \\rangle`}</M> of prime order <M>q</M>.</p><MB>{`\\text{shared} = g^{ab}`}</MB><p>Secure under the DDH assumption.</p></>),
    demo: <PA11 />,
    notes: <p>Unauthenticated DH is vulnerable to MITM; pair with signatures (PA#17) or PAKE.</p>,
  },
  12: {
    spec: (<><MB>{`n = pq, \\quad ed \\equiv 1 \\pmod{\\varphi(n)}, \\quad c = m^e, \\; m = c^d \\pmod n`}</MB><p>Textbook RSA is <em>not</em> IND-CPA — it's deterministic and malleable.</p></>),
    demo: <PA12 />,
    notes: <p>Pad with OAEP for encryption (PA#15) and FDH/PSS for signatures (PA#17).</p>,
  },
  13: {
    spec: (<><p>Write <M>{`n - 1 = 2^r d`}</M> with <M>d</M> odd. <M>n</M> is composite if for some witness <M>a</M>:</p><MB>{`a^d \\not\\equiv 1 \\pmod n \\;\\;\\text{and}\\;\\; a^{2^i d} \\not\\equiv -1 \\pmod n \\;\\forall\\, 0 \\le i < r.`}</MB></>),
    demo: <PA13 />,
    notes: <p>Carmichael numbers (e.g. 561) fool Fermat's test but rarely fool Miller–Rabin.</p>,
  },
  14: {
    spec: (<><p>Given pairwise coprime <M>n_i</M>, the system <M>{`x \\equiv a_i \\pmod{n_i}`}</M> has a unique solution mod <M>{`\\prod n_i`}</M>.</p></>),
    demo: <PA14 />,
    notes: <p>RSA decryption with CRT is ~4× faster: compute <M>m_p = c^d \\bmod p</M>, <M>m_q = c^d \\bmod q</M>, recombine.</p>,
  },
  15: {
    spec: (<><p>PKCS#1 v1.5 padding: <M>{`00 \\Vert 02 \\Vert PS \\Vert 00 \\Vert m`}</M>. A server that distinguishes "padding ok" leaks one bit per query — Bleichenbacher (1998) recovers the message in <M>{`2^{20}`}</M> queries.</p></>),
    demo: <PA15 />,
    notes: <p>OAEP randomises the encoding with two hash-derived masks → IND-CCA in the random-oracle model.</p>,
  },
  16: {
    spec: (<><p>ElGamal in <M>{`\\mathbb{G}`}</M> with generator <M>g</M> and pubkey <M>{`h = g^x`}</M>:</p><MB>{`\\mathsf{Enc}(m) = (g^r, m \\cdot h^r), \\quad \\mathsf{Dec}(c_1, c_2) = c_2 \\cdot c_1^{-x}`}</MB></>),
    demo: <PA16 />,
    notes: <p>IND-CPA under DDH. Multiplicatively homomorphic — useful for voting.</p>,
  },
  17: {
    spec: (<><p>Schnorr identification → Fiat–Shamir → signature:</p><MB>{`r = g^k,\\; e = H(r \\Vert m),\\; s = k + xe \\pmod q`}</MB><p>Verify: <M>{`g^s \\stackrel{?}{=} r \\cdot y^e`}</M>.</p></>),
    demo: <PA17 />,
    notes: <p>Reusing the nonce <M>k</M> across signatures leaks <M>x</M> — see Sony PS3 (2010).</p>,
  },
  18: {
    spec: (<><p>1-of-2 OT: sender has <M>{`(m_0, m_1)`}</M>, receiver has bit <M>c</M>. Receiver learns <M>m_c</M>, sender learns nothing about <M>c</M>.</p></>),
    demo: <PA18 />,
    notes: <p>OT is complete for MPC — combined with garbled circuits (PA#19), it gives 2PC for any function.</p>,
  },
  19: {
    spec: (<><p>Each wire carries two random labels for 0/1. Each gate ships a 4-row "garbled table" of double-encrypted output labels. The evaluator decrypts only the matching row.</p></>),
    demo: <PA19 />,
    notes: <p>Free-XOR + half-gates reduce AND-gate communication to 2 ciphertexts per gate.</p>,
  },
  20: {
    spec: (<><p>Yao's millionaires: jointly compute <M>{`a \\le b`}</M> without revealing <M>a, b</M>.</p><p>Use OT (PA#18) so the evaluator obtains the input labels for its own bits, then evaluates the garbled circuit (PA#19) for the comparison gate-by-gate.</p></>),
    demo: <PA20 />,
    notes: <p>Round-optimal 2PC: one message in each direction (with preprocessing). Malicious security needs cut-and-choose or authenticated garbling.</p>,
  },
};
