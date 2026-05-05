import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bytesToHex } from "@/lib/crypto-helpers";
import { M } from "@/components/Math";

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA3() {
  const [msg, setMsg] = useState("attack at dawn");
  const [key] = useState(() => bytesToHex(crypto.getRandomValues(new Uint8Array(16))));
  const [ct, setCt] = useState<{ iv: string; c: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enc() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa3/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_hex: key, plaintext: msg }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setCt({ iv: d.r_hex, c: d.c_hex });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        <M>{`\\mathsf{Enc}_k(m) = (r, F_k(r) \\oplus m)`}</M>
        <span className="ml-1">— pa3.Enc · pa2.F (AES-128) under the hood</span>
      </div>
      <div><Label>Plaintext</Label><Input value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
      <Button onClick={enc} disabled={loading} className="font-mono">
        {loading ? "encrypting…" : "encrypt"}
      </Button>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error} — start uvicorn on :8000
        </div>
      )}
      {ct && (
        <Card className="p-3 space-y-2">
          <div><Mono>r = {ct.iv}</Mono></div>
          <div><Mono>c = {ct.c}</Mono></div>
          <div className="text-[11px] text-gb-aqua">Click encrypt twice — same plaintext, different ciphertext (IND-CPA).</div>
        </Card>
      )}
    </div>
  );
}
