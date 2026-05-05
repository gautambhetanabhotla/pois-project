import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { M } from "@/components/Math";
import { bytesToHex } from "@/lib/crypto-helpers";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}

export function PA5() {
  // 16-byte key
  const [key] = useState(() => bytesToHex(crypto.getRandomValues(new Uint8Array(16))));
  const [pairs, setPairs] = useState<{ m: string; t: string }[]>([]);
  const [m, setM] = useState("hello");
  const [forgeM, setForgeM] = useState("");
  const [forgeT, setForgeT] = useState("");
  const [verdict, setVerdict] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sign() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa5/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_hex: key, message: m }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setPairs((p) => [{ m, t: d.tag_hex }, ...p].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function forge() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa5/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_hex: key, message: forgeM, tag_hex: forgeT || "00" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const isKnown = pairs.some((p) => p.m === forgeM && p.t === forgeT);
      if (d.valid && isKnown) {
        setVerdict("✓ valid — but it's a known tag, not a forgery");
      } else if (d.valid) {
        setVerdict("✓ valid forgery! (Wait, how did you do that without the key?)");
      } else {
        setVerdict("✗ invalid tag — MAC unforgeable");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground"><M>{`\\mathsf{Mac}_k(m) = \\mathsf{CBC\\text{-}MAC}(k, m)`}</M> · key hidden</div>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={m} onChange={(e) => setM(e.target.value)} placeholder="message" disabled={loading} />
        <Button onClick={sign} disabled={loading} className="font-mono">sign</Button>
      </div>
      {pairs.length > 0 && (
        <Card className="p-3 max-h-40 overflow-auto">
          <Label>signed pairs</Label>
          <div className="space-y-1">
            {pairs.map((p, i) => <div key={i}><Mono>{p.m} → {p.t}</Mono></div>)}
          </div>
        </Card>
      )}
      <div className="grid sm:grid-cols-2 gap-2">
        <Input value={forgeM} onChange={(e) => setForgeM(e.target.value)} placeholder="forge: message" disabled={loading} />
        <Input value={forgeT} onChange={(e) => setForgeT(e.target.value)} placeholder="forge: tag (hex)" className="font-mono" disabled={loading} />
      </div>
      <Button variant="outline" onClick={forge} disabled={loading} className="font-mono">attempt forgery</Button>
      {verdict && <div className={`text-sm font-mono ${verdict.includes("✗") ? "text-gb-red" : "text-gb-green"}`}>{verdict}</div>}
    </div>
  );
}
