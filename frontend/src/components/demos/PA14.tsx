import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { M } from "@/components/Math";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA14() {
  const [a1, setA1] = useState("2"), [n1, setN1] = useState("3");
  const [a2, setA2] = useState("3"), [n2, setN2] = useState("5");
  const [a3, setA3] = useState("2"), [n3, setN3] = useState("7");
  const [x, setX] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setX(null);

    const rs = [a1, a2, a3].map(v => v.trim() || "0");
    const ms = [n1, n2, n3].map(v => v.trim() || "1");

    fetch("/api/pa14/crt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ residues: rs, moduli: ms }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
        } else {
          setX(d.x);
        }
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => { cancelled = true; };
  }, [a1, a2, a3, n1, n2, n3]);

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <div className="space-y-2 max-w-sm">
        <div className="flex items-center gap-2">
          <M>x \equiv</M><Input value={a1} onChange={(e) => setA1(e.target.value)} className="w-20" /><M>\pmod{'{'}</M><Input value={n1} onChange={(e) => setN1(e.target.value)} className="w-20" /><M>{'}'}</M>
        </div>
        <div className="flex items-center gap-2">
          <M>x \equiv</M><Input value={a2} onChange={(e) => setA2(e.target.value)} className="w-20" /><M>\pmod{'{'}</M><Input value={n2} onChange={(e) => setN2(e.target.value)} className="w-20" /><M>{'}'}</M>
        </div>
        <div className="flex items-center gap-2">
          <M>x \equiv</M><Input value={a3} onChange={(e) => setA3(e.target.value)} className="w-20" /><M>\pmod{'{'}</M><Input value={n3} onChange={(e) => setN3(e.target.value)} className="w-20" /><M>{'}'}</M>
        </div>
      </div>
      <Card className="p-3 mt-4">
        <Label>unique solution modulo ∏nᵢ</Label>
        <div className="font-mono text-xl text-gb-aqua">{x || "..."}</div>
      </Card>
      <div className="text-xs text-muted-foreground mt-2">
        CRT guarantees a unique solution for x modulo N = n₁n₂n₃ (if moduli are pairwise coprime).
      </div>
    </div>
  );
}
