import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { randomHex } from "@/lib/crypto-helpers";
import { MB } from "@/components/Math";

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA2() {
  const [bits, setBits] = useState("0110");
  const [key] = useState(() => randomHex(16));
  const [result, setResult] = useState<{ result_hex: string; path_hex: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const depth = bits.length;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/pa2/ggm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key_hex: key, bits }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (!cancelled) setResult(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [key, bits]);

  return (
    <div className="space-y-4">
      <div>
        <Label>
          Input x ∈ {"{0,1}ⁿ"} (toggle bits)
          {loading && <span className="ml-2 text-gb-yellow">computing…</span>}
        </Label>
        <div className="flex gap-1">
          {bits.split("").map((b, i) => (
            <button
              key={i}
              onClick={() => setBits(bits.slice(0, i) + (b === "0" ? "1" : "0") + bits.slice(i + 1))}
              className={`h-10 w-10 rounded-md border font-mono text-lg transition ${
                b === "1" ? "border-gb-yellow bg-gb-yellow/20 text-gb-yellow" : "border-border bg-card"
              }`}
            >
              {b}
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setBits(bits + "0")} disabled={bits.length >= 6}>+</Button>
          <Button size="sm" variant="outline" onClick={() => setBits(bits.slice(0, -1))} disabled={bits.length <= 2}>−</Button>
        </div>
        <div className="mt-1 text-[11px] font-mono text-muted-foreground">
          k = {key.slice(0, 16)}…  (random per page load)
        </div>
      </div>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error} — start uvicorn on :8000
        </div>
      )}
      <Card className="p-3 overflow-auto">
        <Label>GGM tree — highlighted path = F_k(x)</Label>
        <svg viewBox={`0 0 ${Math.pow(2, depth) * 60} ${depth * 60 + 40}`} className="w-full">
          {Array.from({ length: depth + 1 }).map((_, lvl) => {
            const nodes = Math.pow(2, lvl);
            const w = Math.pow(2, depth) * 60;
            return Array.from({ length: nodes }).map((_, i) => {
              const x = (i + 0.5) * (w / nodes);
              const y = lvl * 60 + 20;
              const onPath = lvl <= depth && parseInt(bits.slice(0, lvl) || "0", 2) === i && bits.slice(0, lvl).length === lvl;
              return (
                <g key={`${lvl}-${i}`}>
                  {lvl < depth && (
                    <>
                      <line x1={x} y1={y} x2={(2 * i + 0.5) * (w / (nodes * 2))} y2={(lvl + 1) * 60 + 20}
                            stroke={onPath && bits[lvl] === "0" ? "var(--color-gb-yellow)" : "var(--color-border)"} strokeWidth={onPath && bits[lvl] === "0" ? 2 : 1} />
                      <line x1={x} y1={y} x2={(2 * i + 1.5) * (w / (nodes * 2))} y2={(lvl + 1) * 60 + 20}
                            stroke={onPath && bits[lvl] === "1" ? "var(--color-gb-yellow)" : "var(--color-border)"} strokeWidth={onPath && bits[lvl] === "1" ? 2 : 1} />
                    </>
                  )}
                  <circle cx={x} cy={y} r={10} className={onPath ? "fill-gb-yellow stroke-gb-yellow" : "fill-card stroke-border"} strokeWidth={1} />
                </g>
              );
            });
          })}
        </svg>
      </Card>
      <MB>{`F_k(x) = G_{x_n}(G_{x_{n-1}}(\\dots G_{x_1}(k)\\dots))`}</MB>
      {result && (
        <Card className="p-3 space-y-1">
          <Label>F_k(x) — pa2.F_ggm result</Label>
          <Mono>{result.result_hex}</Mono>
          <div className="text-[11px] text-muted-foreground">
            {result.path_hex.length - 1} GGM steps · root {result.path_hex[0].slice(0, 8)}… → leaf {result.result_hex.slice(0, 8)}…
          </div>
        </Card>
      )}
    </div>
  );
}
