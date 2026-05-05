import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA8() {
  const [bits, setBits] = useState(20);
  const [running, setRunning] = useState(false);
  const [tries, setTries] = useState(0);
  const [hit, setHit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function hunt() {
    setRunning(true);
    setTries(0);
    setHit(null);
    setError(null);

    try {
      const res = await fetch("/api/pa8/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bits }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTries(d.tries);
      setHit(d.hit_msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error}
        </div>
      )}
      <div>
        <Label>truncate hash to: {bits} bits  (expected ≈ 2^{bits / 2} tries)</Label>
        <Slider value={[bits]} min={8} max={28} step={2} onValueChange={(v) => setBits(v[0])} disabled={running} />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={hunt} disabled={running} className="font-mono">
          {running ? "hunting on backend…" : "find collision"}
        </Button>
      </div>
      
      <Card className="p-3">
        <Label>tries</Label>
        <div className="font-mono text-2xl text-gb-yellow">{running ? "..." : tries.toLocaleString()}</div>
        {!running && tries > 0 && (
          <Progress value={Math.min(100, (tries / Math.pow(2, bits / 2 + 2)) * 100)} className="mt-2" />
        )}
        {hit && <div className="mt-2 text-sm font-mono text-gb-aqua break-all">collision: {hit}</div>}
      </Card>
    </div>
  );
}
