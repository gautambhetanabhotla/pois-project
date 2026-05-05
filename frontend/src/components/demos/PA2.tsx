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
  const [key, setKey] = useState("00000000000000000000000000000000");

  useEffect(() => {
    setKey(randomHex(16));
  }, []);
  const [result, setResult] = useState<{ result_hex: string; path_hex: string[]; tree_hex: list[list[string]] } | null>(null);
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
          {loading && <span className="ml-2 text-gb-blue">computing…</span>}
        </Label>
        <div className="flex gap-1">
          {bits.split("").map((b, i) => (
            <button
              key={i}
              onClick={() => setBits(bits.slice(0, i) + (b === "0" ? "1" : "0") + bits.slice(i + 1))}
              className={`h-10 w-10 rounded-md border font-mono text-lg transition ${
                b === "1" ? "border-blue-500 bg-blue-500/20 text-blue-500" : "border-border bg-card"
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
        <svg viewBox={`0 0 ${Math.pow(2, depth) * 70} ${depth * 80 + 40}`} className="w-full" style={{ minWidth: `${Math.pow(2, depth) * 70}px` }}>
          {Array.from({ length: depth + 1 }).map((_, lvl) => {
            const nodes = Math.pow(2, lvl);
            const w = Math.pow(2, depth) * 70;
            return Array.from({ length: nodes }).map((_, i) => {
              const x = (i + 0.5) * (w / nodes);
              const y = lvl * 80 + 20;
              const onPath = lvl <= depth && parseInt(bits.slice(0, lvl) || "0", 2) === i && bits.slice(0, lvl).length === lvl;
              const hexValue = result?.tree_hex?.[lvl]?.[i] || "";
              
              return (
                <g key={`${lvl}-${i}`}>
                  {lvl < depth && (
                    <>
                      <line x1={x} y1={y + 15} x2={(2 * i + 0.5) * (w / (nodes * 2))} y2={(lvl + 1) * 80 + 5}
                            stroke={onPath && bits[lvl] === "0" ? "#3b82f6" : "var(--color-border)"} 
                            strokeWidth={onPath && bits[lvl] === "0" ? 3 : 1} 
                            opacity={onPath && bits[lvl] === "0" ? 1 : 0.3} />
                      <line x1={x} y1={y + 15} x2={(2 * i + 1.5) * (w / (nodes * 2))} y2={(lvl + 1) * 80 + 5}
                            stroke={onPath && bits[lvl] === "1" ? "#3b82f6" : "var(--color-border)"} 
                            strokeWidth={onPath && bits[lvl] === "1" ? 3 : 1}
                            opacity={onPath && bits[lvl] === "1" ? 1 : 0.3} />
                    </>
                  )}
                  {/* Draw a rounded rectangle for the node */}
                  <rect 
                    x={x - 30} 
                    y={y - 12} 
                    width={60} 
                    height={24} 
                    rx={4} 
                    className={onPath ? "fill-blue-500/20 stroke-blue-500" : "fill-card stroke-border"} 
                    strokeWidth={onPath ? 2 : 1}
                    opacity={onPath ? 1 : 0.4}
                  />
                  {hexValue && (
                    <text 
                      x={x} 
                      y={y + 3} 
                      textAnchor="middle" 
                      className={`font-mono text-[9px] ${onPath ? "font-bold" : ""}`}
                      fill={onPath ? "#3b82f6" : "#71717a"}
                      opacity={onPath ? 1 : 0.4}
                    >
                      {hexValue.slice(0, 8)}…
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </Card>
      <MB>{`F_k(x) = G_{x_n}(G_{x_{n-1}}(\\dots G_{x_1}(k)\\dots))`}</MB>
      {result && (
        <Card className="p-6 bg-blue-500 text-white rounded-2xl shadow-xl shadow-blue-500/20 animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center text-center mt-6">
          <div className="text-[12px] font-bold uppercase tracking-widest opacity-80 mb-2">
            F_k(x) =
          </div>
          <div className="font-mono text-2xl font-black tracking-wider break-all px-4">
            {result.result_hex}
          </div>
          <div className="mt-4 px-4 py-1.5 rounded-full bg-black/10 text-[11px] font-mono opacity-90 inline-flex">
            {result.path_hex.length - 1} GGM steps computed from root
          </div>
        </Card>
      )}
    </div>
  );
}
