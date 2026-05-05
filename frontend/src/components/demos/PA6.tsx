import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MB } from "@/components/Math";

// ─── helpers ─────────────────────────────────────────────────────────────────

function randomHex(n: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function hexToBytes(h: string): Uint8Array {
  const s = h.replace(/[^0-9a-fA-F]/g, "").padEnd(h.length % 2 ? h.length + 1 : h.length, "0");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array) {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function tryUtf8(hex: string) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(hexToBytes(hex));
  } catch {
    return "[binary: " + hex.slice(0, 16) + "…]";
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs break-all">{children}</span>;
}
function HexRow({ label, hex, color = "text-foreground" }: { label: string; hex: string; color?: string }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="font-mono text-[10px] text-muted-foreground w-20 shrink-0 pt-0.5">{label}</span>
      <span className={`font-mono text-[11px] break-all ${color}`}>{hex || "…"}</span>
    </div>
  );
}

// ─── Byte-level bit-flip visualiser ──────────────────────────────────────────

function ByteRow({
  index, byteHex, isFlipped, onClick,
}: {
  index: number; byteHex: string; isFlipped: boolean; onClick: () => void;
}) {
  return (
    <button
      title={`byte ${index}: 0x${byteHex} — click to flip LSB`}
      onClick={onClick}
      className={`w-7 h-7 rounded text-[10px] font-mono border transition-all duration-200 ${
        isFlipped
          ? "bg-gb-red text-white border-gb-red shadow-[0_0_8px_rgba(251,73,52,0.6)]"
          : "bg-card border-border hover:border-gb-yellow hover:bg-gb-yellow/10 text-foreground"
      }`}
    >
      {byteHex}
    </button>
  );
}

// ─── Malleability Panel ───────────────────────────────────────────────────────

interface CpaData {
  nonce_hex: string;
  message_hex: string;
  keystream_hex: string;
  ciphertext_hex: string;
}
interface CcaData {
  nonce_hex: string;
  ciphertext_hex: string;
  tag_hex: string;
}

function MalleabilityPanel() {
  const [message, setMessage] = useState("send 0100 USD");
  const [kEnc] = useState(() => randomHex(16));
  const [kMac] = useState(() => randomHex(16));

  const [cpaData, setCpaData] = useState<CpaData | null>(null);
  const [ccaData, setCcaData] = useState<CcaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flipped byte index for CPA side
  const [flipByte, setFlipByte] = useState<number | null>(null);
  const [flipResult, setFlipResult] = useState<string | null>(null);
  const [flipping, setFlipping] = useState(false);

  // CCA flip result
  const [ccaFlipResult, setCcaFlipResult] = useState<string | null>(null);
  const [ccaFlipping, setCcaFlipping] = useState(false);

  const encrypt = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFlipByte(null);
    setFlipResult(null);
    setCcaFlipResult(null);
    try {
      const body = JSON.stringify({ key_enc_hex: kEnc, key_mac_hex: kMac, message });
      const [r1, r2] = await Promise.all([
        fetch("/api/pa6/cpa_encrypt", { method: "POST", headers: { "Content-Type": "application/json" }, body }),
        fetch("/api/pa6/encrypt",     { method: "POST", headers: { "Content-Type": "application/json" }, body }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error(`HTTP ${r1.status}/${r2.status}`);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setCpaData(d1);
      setCcaData({ nonce_hex: d2.nonce_hex, ciphertext_hex: d2.ciphertext_hex, tag_hex: d2.tag_hex });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [message, kEnc, kMac]);

  // Auto-encrypt on mount
  const did = useRef(false);
  useEffect(() => { if (!did.current) { did.current = true; encrypt(); } });

  const doFlip = async (byteIdx: number) => {
    if (!cpaData) return;
    setFlipByte(byteIdx);
    setFlipping(true);
    setFlipResult(null);
    setCcaFlipResult(null);
    try {
      // CPA flip
      const r1 = await fetch("/api/pa6/cpa_flip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_enc_hex: kEnc,
          nonce_hex: cpaData.nonce_hex,
          ciphertext_hex: cpaData.ciphertext_hex,
          flip_byte: byteIdx,
          flip_mask: 1,
        }),
      });
      const d1 = await r1.json();
      setFlipResult(d1.recovered_plaintext);
    } catch (e) {
      setFlipResult("error");
    } finally {
      setFlipping(false);
    }

    // CCA side — just flip the ciphertext and try to CCA-decrypt
    if (ccaData) {
      setCcaFlipping(true);
      const cBytes = hexToBytes(ccaData.ciphertext_hex);
      const fb = byteIdx % cBytes.length;
      cBytes[fb] ^= 1;
      const flippedHex = bytesToHex(cBytes);
      try {
        const r2 = await fetch("/api/pa6/decrypt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key_enc_hex: kEnc,
            key_mac_hex: kMac,
            nonce_hex: ccaData.nonce_hex,
            ciphertext_hex: flippedHex,
            tag_hex: ccaData.tag_hex,
            cca_enabled: true,
          }),
        });
        const d2 = await r2.json();
        setCcaFlipResult(d2.error ? "⊥" : d2.plaintext);
      } catch {
        setCcaFlipResult("error");
      } finally {
        setCcaFlipping(false);
      }
    }
  };

  const cBytes = cpaData ? Array.from(hexToBytes(cpaData.ciphertext_hex)) : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} className="font-mono" />
        <Button size="sm" onClick={encrypt} disabled={loading}>{loading ? "encrypting…" : "↺ re-encrypt"}</Button>
      </div>
      {error && <div className="text-xs text-gb-red font-mono">{error}</div>}

      <div className="grid sm:grid-cols-2 gap-4">
        {/* ── CPA Side ── */}
        <Card className="p-3 border-gb-red/40 space-y-2">
          <div className="text-xs font-semibold text-gb-red">CPA-only (CTR, no MAC)</div>
          <div className="text-[10px] text-muted-foreground">
            Click any ciphertext byte to flip its LSB and watch the plaintext change silently.
          </div>
          {cpaData && (
            <>
              <HexRow label="nonce" hex={cpaData.nonce_hex.slice(0,16) + "…"} color="text-gb-yellow" />
              <HexRow label="message" hex={cpaData.message_hex} color="text-gb-blue" />
              <HexRow label="keystream" hex={cpaData.keystream_hex} color="text-gb-purple" />
              <div>
                <Label>ciphertext — click to flip</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {cBytes.map((b, i) => (
                    <ByteRow
                      key={i}
                      index={i}
                      byteHex={b.toString(16).padStart(2, "0")}
                      isFlipped={flipByte === i}
                      onClick={() => doFlip(i)}
                    />
                  ))}
                </div>
              </div>
              {flipByte !== null && (
                <div className="rounded bg-gb-red/10 border border-gb-red/40 p-2 space-y-1">
                  <div className="text-[10px] text-gb-red font-mono">bit flipped at byte {flipByte}</div>
                  <div className="text-sm font-mono text-gb-red">
                    {flipping ? "decrypting…" : (flipResult ?? "…")}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    ↑ attacker modified the ciphertext and got a different plaintext — no detection
                  </div>
                </div>
              )}
              {flipByte === null && (
                <div className="text-[10px] text-muted-foreground italic">← click a byte above</div>
              )}
            </>
          )}
        </Card>

        {/* ── CCA Side ── */}
        <Card className="p-3 border-gb-green/40 space-y-2">
          <div className="text-xs font-semibold text-gb-green">Encrypt-then-MAC (CCA-secure)</div>
          <div className="text-[10px] text-muted-foreground">
            Same bit-flip attempt — MAC verification fires before any decryption occurs.
          </div>
          {ccaData && (
            <>
              <HexRow label="nonce" hex={ccaData.nonce_hex.slice(0,16) + "…"} color="text-gb-yellow" />
              <HexRow label="ciphertext" hex={ccaData.ciphertext_hex.slice(0,24) + "…"} color="text-gb-blue" />
              <HexRow label="MAC tag" hex={ccaData.tag_hex} color="text-gb-aqua" />
              <div className="rounded bg-gb-green/5 border border-gb-green/30 p-2 text-xs font-mono space-y-1">
                <div className="text-gb-green">CCA Dec(kE, kM, c, t):</div>
                <div className="text-muted-foreground">1. Vrfy(kM, nonce∥c, t) → {flipByte !== null ? "FAIL ⊥" : "—"}</div>
                <div className="text-muted-foreground">2. Dec only if Vrfy passes</div>
                {flipByte !== null && (
                  <div className={`text-sm mt-1 font-mono font-bold ${ccaFlipResult === "⊥" ? "text-gb-green" : "text-gb-red"}`}>
                    {ccaFlipping ? "verifying…" : (ccaFlipResult ?? "…")}
                  </div>
                )}
              </div>
              {flipByte !== null && ccaFlipResult === "⊥" && (
                <div className="text-[10px] text-gb-green">
                  ✓ Tampering detected — plaintext never decrypted
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Key info */}
      <Card className="p-2 border-border/50 text-[10px] font-mono text-muted-foreground grid grid-cols-2 gap-1">
        <div>kE (enc): {kEnc.slice(0, 16)}…</div>
        <div>kM (mac): {kMac.slice(0, 16)}…</div>
        <div className="col-span-2 text-gb-green">kE ≠ kM — keys are independent (key separation)</div>
      </Card>
    </div>
  );
}

// ─── IND-CCA2 Game Panel ──────────────────────────────────────────────────────

function CCA2Panel() {
  const [result, setResult] = useState<{
    trials: number; successes: number; advantage: number; details: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa6/cca2_game", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const advColor =
    result === null ? "" : result.advantage < 0.15 ? "text-gb-green" : "text-gb-red";

  return (
    <div className="space-y-4">
      <MB>{String.raw`\mathbf{Adv}^{\mathrm{IND\text{-}CCA2}}_{\mathcal{A}} = \left|\Pr[\mathcal{A}\text{ wins}] - \tfrac{1}{2}\right| \cdot 2 \approx 0`}</MB>
      <div className="text-xs text-muted-foreground leading-relaxed">
        In the IND-CCA2 game the adversary gets an encryption oracle <em>and</em> a decryption
        oracle. The challenger encrypts <em>m<sub>b</sub></em> for secret bit <em>b</em> and hands
        the ciphertext to the adversary. The decryption oracle rejects the exact challenge
        ciphertext. Because Encrypt-then-MAC authenticates every byte, any tweak the adversary
        makes to the challenge is detected as ⊥ by the oracle — giving no information about <em>b</em>.
        The adversary is forced to guess randomly → advantage ≈ 0.
      </div>
      {error && <div className="text-xs text-gb-red font-mono">{error}</div>}
      <Button onClick={run} disabled={loading} className="font-mono">
        {loading ? "simulating 50 trials…" : "run IND-CCA2 simulation"}
      </Button>
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <div className="text-[10px] text-muted-foreground font-mono uppercase">trials</div>
              <div className="text-2xl font-mono text-foreground">{result.trials}</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-[10px] text-muted-foreground font-mono uppercase">correct guesses</div>
              <div className="text-2xl font-mono text-foreground">{result.successes}</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-[10px] text-muted-foreground font-mono uppercase">advantage</div>
              <div className={`text-2xl font-mono ${advColor}`}>{result.advantage.toFixed(4)}</div>
            </Card>
          </div>
          <Card className="p-3 border-border/50">
            <Label>first 5 trial details</Label>
            <div className="space-y-0.5 mt-1">
              {result.details.map((d, i) => (
                <div key={i} className="text-[11px] font-mono text-muted-foreground">{d}</div>
              ))}
            </div>
          </Card>
          <div className={`text-sm font-mono ${advColor}`}>
            {result.advantage < 0.15
              ? "✓ advantage ≈ 0 — CCA2-secure scheme, adversary cannot distinguish"
              : "⚠ advantage above threshold — investigate"}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function PA6() {
  return (
    <Tabs defaultValue="malleability">
      <TabsList>
        <TabsTrigger value="malleability" className="font-mono">Malleability</TabsTrigger>
        <TabsTrigger value="cca2" className="font-mono">IND-CCA2 game</TabsTrigger>
      </TabsList>
      <TabsContent value="malleability" className="mt-4">
        <MalleabilityPanel />
      </TabsContent>
      <TabsContent value="cca2" className="mt-4">
        <CCA2Panel />
      </TabsContent>
    </Tabs>
  );
}
