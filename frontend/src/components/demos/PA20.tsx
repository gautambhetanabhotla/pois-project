import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA20() {
  const [x, setX] = useState("100");
  const [y, setY] = useState("50");
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function evaluateCircuit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/pa20", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          circuit: "millionaire",
          input0: parseInt(x),
          input1: parseInt(y),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || `HTTP ${res.status}`);
      if (d.error) throw new Error(d.error);
      setResult(d.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Yao's Millionaires' Problem: securely compute whether \(x > y\) using an 8-bit garbled circuit.
        Input values must be between 0 and 255.
      </div>
      
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-3 space-y-3 bg-muted/30">
          <Label>Alice</Label>
          <div>
            <Label>wealth x (0-255)</Label>
            <Input type="number" min={0} max={255} value={x} onChange={(e) => setX(e.target.value)} className="font-mono" />
          </div>
        </Card>

        <Card className="p-3 space-y-3 bg-gb-blue/10 border-gb-blue/20">
          <Label>Bob</Label>
          <div>
            <Label>wealth y (0-255)</Label>
            <Input type="number" min={0} max={255} value={y} onChange={(e) => setY(e.target.value)} className="font-mono" />
          </div>
        </Card>
      </div>

      <Button onClick={evaluateCircuit} disabled={loading} className="font-mono w-full sm:w-auto">
        {loading ? "evaluating..." : "Evaluate x > y"}
      </Button>

      {result !== null && (
        <Card className="p-3">
          <Label>Result</Label>
          <div className={`font-mono text-xl ${result === 1 ? "text-gb-green" : "text-gb-red"}`}>
            {result === 1 ? "x > y (Alice is richer)" : "x ≤ y (Bob is richer or equal)"}
          </div>
        </Card>
      )}
    </div>
  );
}
