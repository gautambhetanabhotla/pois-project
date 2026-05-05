import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { hexToBytes } from "@/lib/crypto-helpers";

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA1() {
  const [seed, setSeed] = useState("deadbeef");
  const [len, setLen] = useState(64);
  const [out, setOut] = useState("");
  const [stats, setStats] = useState<{
    ratio: number; mono: number; runs: number; s1: number; s2: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/pa1/prg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seed_hex: seed, out_bytes: len }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (cancelled) return;
        setOut(d.output_hex);
        setStats({
          ratio: d.ones_ratio, mono: d.p_monobit, runs: d.p_runs,
          s1: d.p_serial1, s2: d.p_serial2,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [seed, len]);

  const bytes = hexToBytes(out);
  const ratio = stats?.ratio ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Seed (hex) — backend stretches any length</Label>
          <Input value={seed} onChange={(e) => setSeed(e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label>
            Output length: {len} bytes
            {loading && <span className="ml-2 text-gb-yellow">computing…</span>}
          </Label>
          <Slider value={[len]} min={8} max={256} step={8} onValueChange={(v) => setLen(v[0])} />
        </div>
      </div>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error} — start uvicorn on :8000
        </div>
      )}
      <div>
        <Label>PRG output G(s) — pa1.PRG (HILL · 1024-bit DLP-OWF)</Label>
        <pre className="rounded-md border border-border bg-card p-3 text-[11px] font-mono break-all whitespace-pre-wrap max-h-40 overflow-auto">
          {out || (loading ? "…" : "(no output)")}
        </pre>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-3">
          <Label>Frequency test (1-bits)</Label>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-mono text-gb-aqua">{(ratio * 100).toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">target ≈ 50%</div>
          </div>
          <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
            <div className="h-full bg-gb-aqua" style={{ width: `${ratio * 100}%` }} />
          </div>
          {stats && (
            <div className="mt-3 space-y-0.5 text-[11px] font-mono text-muted-foreground">
              <div>NIST monobit p = <span className={stats.mono > 0.01 ? "text-gb-green" : "text-gb-red"}>{stats.mono.toFixed(4)}</span></div>
              <div>NIST runs    p = <span className={stats.runs > 0.01 ? "text-gb-green" : "text-gb-red"}>{stats.runs.toFixed(4)}</span></div>
              <div>NIST serial p1/p2 = {stats.s1.toFixed(4)} / {stats.s2.toFixed(4)}</div>
            </div>
          )}
        </Card>
        <Card className="p-3">
          <Label>Bit histogram</Label>
          <div className="flex items-end h-12 gap-px">
            {Array.from({ length: 32 }).map((_, i) => {
              const slice = bytes.slice(i * Math.max(1, Math.floor(bytes.length / 32)), (i + 1) * Math.max(1, Math.floor(bytes.length / 32)));
              let c = 0;
              for (const b of slice) for (let k = 0; k < 8; k++) if (b & (1 << k)) c++;
              const sl = slice.length * 8 || 1;
              return <div key={i} className="flex-1 bg-gb-yellow" style={{ height: `${(c / sl) * 100}%` }} />;
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
