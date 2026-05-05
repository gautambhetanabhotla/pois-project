import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MB } from "@/components/Math";

// ─── helpers ─────────────────────────────────────────────────────────────────

function randomHex(n: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </div>
  );
}

export function PA10() {
  const [keyHex] = useState(() => randomHex(16));
  const [message, setMessage] = useState("user=admin&role=guest");
  const [suffix, setSuffix] = useState("&role=root");
  const [hashType, setHashType] = useState<"dlp" | "sha256">("dlp");
  const [result, setResult] = useState<{
    naive_original_tag: string;
    naive_extended_tag: string;
    naive_real_tag: string;
    naive_attack_succeeded: boolean;
    hmac_original_tag: string;
    hmac_extended_tag: string;
    hmac_real_tag: string;
    hmac_attack_succeeded: boolean;
    padded_repr: string;
    block_size: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa10/len_ext", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_hex: keyHex, message, suffix, hash_type: hashType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [keyHex, message, suffix, hashType]);

  const ran = useRef(false);
  useEffect(() => {
    if (!ran.current) {
      ran.current = true;
      run();
    }
  }, [run]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold font-mono">Length-Extension vs HMAC</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">Underlying Hash:</span>
            <div className="flex bg-muted rounded-md p-1">
              <button
                onClick={() => setHashType("dlp")}
                className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                  hashType === "dlp" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                PA#8 DLP Hash
              </button>
              <button
                onClick={() => setHashType("sha256")}
                className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${
                  hashType === "sha256" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                SHA-256
              </button>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>original message (m)</Label>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} className="font-mono text-sm" />
          </div>
          <div>
            <Label>suffix (m′)</Label>
            <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} className="font-mono text-sm" />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button onClick={run} disabled={loading} className="font-mono h-9 px-6">
            {loading ? "Computing..." : "Run Attack"}
          </Button>
          <div className="text-[10px] text-muted-foreground font-mono">
            Secret Key (k): <span className="bg-muted px-1.5 py-0.5 rounded italic">HIDDEN</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-3 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      {result && (
        <div className="grid lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Left Panel: Broken Naive Hash */}
          <Card className="flex flex-col overflow-hidden border-gb-red/30">
            <div className="bg-gb-red/10 px-4 py-2 border-b border-gb-red/20">
              <h3 className="text-xs font-bold font-mono text-gb-red uppercase tracking-widest">
                Left: Broken H(k ∥ m)
              </h3>
            </div>
            <div className="p-4 space-y-4 flex-1">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label>Original Tag (t)</Label>
                  <span className="text-[9px] font-mono text-muted-foreground">H(k ∥ m)</span>
                </div>
                <div className="p-2 bg-muted rounded font-mono text-xs break-all border border-border/50">
                  {result.naive_original_tag}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label>Attacker's Forged Tag</Label>
                  <span className="text-[9px] font-mono text-muted-foreground">MD_Ext(t, m′)</span>
                </div>
                <div className="p-2 bg-gb-red/5 text-gb-red rounded font-mono text-xs break-all border border-gb-red/20">
                  {result.naive_extended_tag}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label>Actual Hash of (m ∥ pad ∥ m′)</Label>
                </div>
                <div className="p-2 bg-gb-green/5 text-gb-green rounded font-mono text-xs break-all border border-gb-green/20">
                  {result.naive_real_tag}
                </div>
              </div>

              <div className="pt-2">
                <div className={`p-3 rounded-md border text-center font-mono text-sm font-bold shadow-sm transition-all ${
                  result.naive_extended_tag === result.naive_real_tag 
                  ? "bg-gb-red/20 border-gb-red text-gb-red animate-pulse" 
                  : "bg-muted border-border text-muted-foreground"
                }`}>
                  {result.naive_extended_tag === result.naive_real_tag ? "⚠ FORGERY SUCCEEDED" : "ATTACK FAILED"}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono mt-2 leading-relaxed">
                  The attacker used the tag <span className="text-gb-red">t</span> as the new Chaining Value (IV) to hash <span className="text-gb-red">m′</span>.
                </p>
              </div>
            </div>
          </Card>

          {/* Right Panel: Secure HMAC */}
          <Card className="flex flex-col overflow-hidden border-gb-green/30">
            <div className="bg-gb-green/10 px-4 py-2 border-b border-gb-green/20">
              <h3 className="text-xs font-bold font-mono text-gb-green uppercase tracking-widest">
                Right: Secure HMAC_k(m)
              </h3>
            </div>
            <div className="p-4 space-y-4 flex-1">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label>Original HMAC Tag</Label>
                  <span className="text-[9px] font-mono text-muted-foreground">HMAC_k(m)</span>
                </div>
                <div className="p-2 bg-muted rounded font-mono text-xs break-all border border-border/50">
                  {result.hmac_original_tag}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label>Attacker's Extension Attempt</Label>
                  <span className="text-[9px] font-mono text-muted-foreground">MD_Ext(tag, m′)</span>
                </div>
                <div className="p-2 bg-gb-red/5 text-gb-red rounded font-mono text-xs break-all border border-gb-red/20">
                  {result.hmac_extended_tag}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label>Actual HMAC of (m ∥ pad ∥ m′)</Label>
                </div>
                <div className="p-2 bg-gb-green/5 text-gb-green rounded font-mono text-xs break-all border border-gb-green/20">
                  {result.hmac_real_tag}
                </div>
              </div>

              <div className="pt-2">
                <div className={`p-3 rounded-md border text-center font-mono text-sm font-bold shadow-sm transition-all ${
                  result.hmac_extended_tag === result.hmac_real_tag 
                  ? "bg-gb-red border-gb-red text-white" 
                  : "bg-gb-green/20 border-gb-green text-gb-green"
                }`}>
                  {result.hmac_extended_tag === result.hmac_real_tag ? "FORGERY SUCCEEDED" : "✓ FORGERY FAILED"}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono mt-2 leading-relaxed">
                  HMAC uses a nested structure <MB inline>{`H(k_o \\Vert H(k_i \\Vert m))`}</MB>. The outer hash prevents using the tag as an internal state.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {result && (
        <Card className="p-4 border-border/50 bg-muted/30">
          <Label>Message processed by server (m ∥ pad ∥ m′)</Label>
          <div className="mt-2 font-mono text-[10px] break-all bg-background p-3 rounded border border-border/50 max-h-32 overflow-y-auto">
            {result.padded_repr}
          </div>
          <p className="text-[9px] text-muted-foreground mt-2 text-center uppercase tracking-tight">
            The server verifies this entire string. The attacker only knows m and its tag.
          </p>
        </Card>
      )}
    </div>
  );
}
