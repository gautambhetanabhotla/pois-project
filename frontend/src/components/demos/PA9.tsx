import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA9() {
  const [data, setData] = useState<{ n: number; tries: number; sqrt: number }[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setData([]);
    setError(null);

    try {
      const res = await fetch("/api/pa9/benchmark", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const max = Math.max(1, ...data.flatMap((d) => [d.tries, d.sqrt]));

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error}
        </div>
      )}
      <Button onClick={run} disabled={running} className="font-mono">
        {running ? "running on backend…" : "run benchmark"}
      </Button>
      <Card className="p-3">
        <Label>tries to first collision vs √(2ⁿ)</Label>
        <div className="space-y-2 mt-2">
          {data.length === 0 && !running && <div className="text-xs text-muted-foreground">Click run benchmark</div>}
          {running && <div className="text-xs text-gb-yellow lowercase">running...</div>}
          {data.map((d) => (
            <div key={d.n} className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span>n={d.n}</span>
                <span>{d.tries} (√2ⁿ ≈ {d.sqrt})</span>
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div className="h-full bg-gb-aqua" style={{ width: `${(d.tries / max) * 100}%` }} />
              </div>
              <div className="h-1 rounded bg-muted overflow-hidden">
                <div className="h-full bg-gb-yellow" style={{ width: `${(d.sqrt / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
