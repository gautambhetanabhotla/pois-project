import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA18() {
  const [m0, setM0] = useState("42");
  const [m1, setM1] = useState("99");
  const [choice, setChoice] = useState("0");
  const [received, setReceived] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runOT() {
    setLoading(true);
    setError(null);
    setReceived(null);
    try {
      const res = await fetch("/api/pa18/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choice: parseInt(choice),
          m0: parseInt(m0),
          m1: parseInt(m1),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || `HTTP ${res.status}`);
      setReceived(d.received);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Alice has two messages, \(m_0\) and \(m_1\). Bob has a choice bit \(c\).
        Through Oblivious Transfer, Bob learns \(m_c\) but learns nothing about \(m_{1-c}\),
        and Alice learns nothing about \(c\).
      </div>
      
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-3 space-y-3 bg-muted/30">
          <Label>Alice (Sender)</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>m0</Label>
              <Input type="number" value={m0} onChange={(e) => setM0(e.target.value)} className="font-mono" />
            </div>
            <div className="flex-1">
              <Label>m1</Label>
              <Input type="number" value={m1} onChange={(e) => setM1(e.target.value)} className="font-mono" />
            </div>
          </div>
        </Card>

        <Card className="p-3 space-y-3 bg-gb-blue/10 border-gb-blue/20">
          <Label>Bob (Receiver)</Label>
          <div>
            <Label>choice bit c</Label>
            <Input type="number" min={0} max={1} value={choice} onChange={(e) => setChoice(e.target.value)} className="font-mono" />
          </div>
        </Card>
      </div>

      <Button onClick={runOT} disabled={loading} className="font-mono w-full sm:w-auto">
        {loading ? "transferring..." : "Run Oblivious Transfer"}
      </Button>

      {received !== null && (
        <Card className="p-3">
          <Label>Bob Received</Label>
          <div className="font-mono text-2xl text-gb-green">
            m_{choice} = {received}
          </div>
        </Card>
      )}
    </div>
  );
}
