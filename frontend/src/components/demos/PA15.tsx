import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA15() {
  const [oracle, setOracle] = useState<"valid" | "invalid" | null>(null);
  const [tries, setTries] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function step() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa15/oracle", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTries((t) => t + 1);
      setOracle(d.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Bleichenbacher's attack: send mauled ciphertexts, learn from a server that only says
        "padding ok / not ok". Each "ok" reveals one bit of the message.
      </div>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <Button onClick={step} disabled={loading} className="font-mono">
        {loading ? "querying..." : "send mauled ciphertext"}
      </Button>
      <Card className="p-3">
        <Label>oracle response</Label>
        <div className={`font-mono text-2xl ${oracle === "valid" ? "text-gb-green" : "text-gb-red"}`}>{oracle ?? "—"}</div>
        <div className="text-xs text-muted-foreground mt-1">queries: {tries}</div>
      </Card>
      <div className="text-xs text-gb-aqua">
        OAEP closes this oracle by combining the message with random masks — invalid ciphertexts look indistinguishable from valid ones.
      </div>
    </div>
  );
}
