import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA19() {
  const [gate, setGate] = useState("AND");
  const [a, setA] = useState("1");
  const [b, setB] = useState("0");
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function evaluateGate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/pa19/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gate,
          a: parseInt(a),
          b: gate === "NOT" ? 0 : parseInt(b),
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
        Evaluate a secure boolean gate (using Oblivious Transfer internally).
        Alice provides input a, Bob provides input b. Neither learns the other's input.
      </div>
      
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <Label>Gate</Label>
          <select 
            value={gate} 
            onChange={(e) => setGate(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="AND">AND</option>
            <option value="XOR">XOR</option>
            <option value="NOT">NOT</option>
          </select>
        </div>

        <div>
          <Label>Input a (Alice)</Label>
          <Input type="number" min={0} max={1} value={a} onChange={(e) => setA(e.target.value)} className="font-mono" />
        </div>

        {gate !== "NOT" && (
          <div>
            <Label>Input b (Bob)</Label>
            <Input type="number" min={0} max={1} value={b} onChange={(e) => setB(e.target.value)} className="font-mono" />
          </div>
        )}
      </div>

      <Button onClick={evaluateGate} disabled={loading} className="font-mono w-full sm:w-auto">
        {loading ? "evaluating..." : "Secure Evaluate"}
      </Button>

      {result !== null && (
        <Card className="p-3">
          <Label>Result ({gate})</Label>
          <div className="font-mono text-2xl text-gb-aqua">
            {result}
          </div>
        </Card>
      )}
    </div>
  );
}
