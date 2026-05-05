import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { M } from "@/components/Math";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}

export function PA12() {
  const p = "61", q = "53", e = "17";
  const [m, setM] = useState("65");
  
  const [data, setData] = useState({ n: "?", phi: "?", d: "?", c: "?", m_recovered: "?" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    
    const mSafe = m.trim() === "" ? "0" : m;

    fetch("/api/pa12/rsa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p, q, e, m: mSafe }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          setData({ n: "?", phi: "?", d: "?", c: "?", m_recovered: "?" });
        } else {
          setData(d);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => { cancelled = true; };
  }, [m]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground"><M>p=61,\; q=53,\; e=17</M></div>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <Card className="p-3 grid grid-cols-2 gap-2">
        <div><Mono>n = pq = {data.n}</Mono></div>
        <div><Mono>φ(n) = {data.phi}</Mono></div>
        <div><Mono>e = {e}</Mono></div>
        <div><Mono>d = e⁻¹ mod φ = {data.d}</Mono></div>
      </Card>
      <div>
        <Label>message m</Label>
        <Input value={m} onChange={(ev) => setM(ev.target.value)} className="font-mono" />
      </div>
      <Card className="p-3 space-y-1">
        <Mono>c = mᵉ mod n = {data.c}</Mono>
        <Mono>m' = cᵈ mod n = {data.m_recovered}</Mono>
        <div className={`text-sm font-mono ${m === data.m_recovered && m !== "?" ? "text-gb-green" : "text-gb-red"}`}>
          recovered: {String(m === data.m_recovered && m !== "?")}
        </div>
      </Card>
    </div>
  );
}
