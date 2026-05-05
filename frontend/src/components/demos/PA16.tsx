import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MB } from "@/components/Math";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}

export function PA16() {
  const p = "467", g = "2";
  const [x, setX] = useState("127");  // private
  const [m, setM] = useState("99");
  const [r, setR] = useState("33");

  const [data, setData] = useState({ h: "?", c1: "?", c2: "?", m_recovered: "?" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const xSafe = x.trim() === "" ? "1" : x;
    const mSafe = m.trim() === "" ? "1" : m;
    const rSafe = r.trim() === "" ? "1" : r;

    fetch("/api/pa16/elgamal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p, g, x: xSafe, m: mSafe, r: rSafe }),
    })
      .then(res => res.json())
      .then(d => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => { cancelled = true; };
  }, [x, m, r]);

  return (
    <div className="space-y-3">
      <MB>{`(c_1, c_2) = (g^r, m \\cdot h^r), \\quad m = c_2 \\cdot (c_1^x)^{-1}`}</MB>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div><Label>private x</Label><Input value={x} onChange={(e) => setX(e.target.value)} className="font-mono" /></div>
        <div><Label>message m</Label><Input value={m} onChange={(e) => setM(e.target.value)} className="font-mono" /></div>
        <div><Label>randomness r</Label><Input value={r} onChange={(e) => setR(e.target.value)} className="font-mono" /></div>
      </div>
      <Card className="p-3 space-y-1">
        <Mono>h = gˣ = {data.h}</Mono>
        <Mono>c1 = {data.c1},  c2 = {data.c2}</Mono>
        <Mono>m' = {data.m_recovered}</Mono>
        <div className={`text-sm font-mono ${m === data.m_recovered && m !== "?" ? "text-gb-green" : "text-gb-red"}`}>
          recovered: {String(m === data.m_recovered && m !== "?")}
        </div>
      </Card>
    </div>
  );
}
