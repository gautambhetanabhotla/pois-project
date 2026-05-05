import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}

export function PA13() {
  const [n, setN] = useState("561"); // Carmichael number
  const [rounds, setRounds] = useState(1);
  const [isPrime, setIsPrime] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const nSafe = n.trim() === "" ? "4" : n;

    setLoading(true);
    setError(null);

    fetch("/api/pa13/miller_rabin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ n: nSafe, rounds }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          setIsPrime(null);
        } else {
          setIsPrime(d.is_prime);
        }
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [n, rounds]);

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>number n to test</Label>
          <Input value={n} onChange={(e) => setN(e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label>miller-rabin rounds: {rounds} {loading && <span className="text-gb-yellow lowercase">testing...</span>}</Label>
          <Slider value={[rounds]} min={1} max={40} step={1} onValueChange={(v) => setRounds(v[0])} className="mt-3" />
        </div>
      </div>
      <Card className="p-3">
        <div className={`text-lg font-mono ${isPrime ? "text-gb-green" : "text-gb-red"}`}>
          {isPrime === null ? "..." : (isPrime ? "probably prime" : "composite")}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          error probability &lt; <Mono>4^{`{-${rounds}}`}</Mono>
        </div>
      </Card>
      <div className="text-xs text-gb-yellow">
        try n=561 (Carmichael number). it fools Fermat's test, but Miller-Rabin catches it.
      </div>
    </div>
  );
}
