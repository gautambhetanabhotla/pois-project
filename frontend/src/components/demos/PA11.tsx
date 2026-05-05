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

export function PA11() {
  const p = "467", g = "2";
  const [a, setA] = useState("123");
  const [b, setB] = useState("214");
  
  const [A, setAVal] = useState("?");
  const [B, setBVal] = useState("?");
  const [sA, setSA] = useState("?");
  const [sB, setSB] = useState("?");
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    
    // Prevent empty inputs
    const aSafe = a.trim() === "" ? "1" : a;
    const bSafe = b.trim() === "" ? "1" : b;

    fetch("/api/pa11/dh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p, g, a: aSafe, b: bSafe }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (cancelled) return;
        setAVal(d.A);
        setBVal(d.B);
        setSA(d.sharedA);
        setSB(d.sharedB);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => { cancelled = true; };
  }, [a, b]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground"><M>p=467, g=2</M></div>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="p-3 border-gb-blue/40">
          <Label>Alice</Label>
          <div>secret a: <Input className="inline-block w-24 ml-1" value={a} onChange={(e) => setA(e.target.value)} /></div>
          <div className="mt-2"><Mono>A = gᵃ mod p = {A}</Mono></div>
          <div className="mt-1"><Mono>shared = Bᵃ mod p = {sA}</Mono></div>
        </Card>
        <Card className="p-3 border-gb-purple/40">
          <Label>Bob</Label>
          <div>secret b: <Input className="inline-block w-24 ml-1" value={b} onChange={(e) => setB(e.target.value)} /></div>
          <div className="mt-2"><Mono>B = gᵇ mod p = {B}</Mono></div>
          <div className="mt-1"><Mono>shared = Aᵇ mod p = {sB}</Mono></div>
        </Card>
      </div>
      <Card className="p-3 border-gb-red/40">
        <Label>Eve (eavesdropper)</Label>
        <div className="text-xs">sees <Mono>A={A}, B={B}</Mono> — must solve DLP to recover the shared key.</div>
      </Card>
      <div className={`text-sm font-mono ${sA === sB && sA !== "?" ? "text-gb-green" : "text-gb-red"}`}>
        shared keys agree: {String(sA === sB && sA !== "?")}
      </div>
    </div>
  );
}
