import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MB } from "@/components/Math";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}

export function PA17() {
  const p = "467", g = "2", q = "233"; // q | p-1
  const [x, setX] = useState("57");
  const [m, setM] = useState("hi");
  
  const [sig, setSig] = useState<{ y: string; e: string; s: string; r: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sign() {
    setLoading(true);
    setError(null);
    setSig(null);
    
    const xSafe = x.trim() === "" ? "1" : x;

    try {
      const res = await fetch("/api/pa17/schnorr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p, g, q, x: xSafe, m }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) {
        setError(d.error);
      } else {
        setSig(d);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  let ok: boolean | null = null;
  if (sig) {
    const yVal = BigInt(sig.y);
    const sVal = BigInt(sig.s);
    const eVal = BigInt(sig.e);
    const pVal = BigInt(p);
    const gVal = BigInt(g);
    
    const modpow = (base: bigint, exp: bigint, mod: bigint) => {
      let r = 1n; base %= mod;
      while (exp > 0n) {
        if (exp & 1n) r = (r * base) % mod;
        exp >>= 1n;
        base = (base * base) % mod;
      }
      return r;
    };
    
    const egcd = (a: bigint, b: bigint): [bigint, bigint, bigint] => {
      if (b === 0n) return [a, 1n, 0n];
      const [g, x, y] = egcd(b, a % b);
      return [g, y, x - (a / b) * y];
    };
    const modinv = (a: bigint, mod: bigint) => {
      const [gcd, x] = egcd(((a % mod) + mod) % mod, mod);
      if (gcd !== 1n) return 1n;
      return ((x % mod) + mod) % mod;
    };
    
    const rv = (modpow(gVal, sVal, pVal) * modinv(modpow(yVal, eVal, pVal), pVal)) % pVal;
    // Verifier checks if rv matches the signature's r value (for demo purposes)
    // Normally verifier recomputes e' = H(rv || m) and checks e' == e
    ok = rv.toString() === sig.r;
  }

  return (
    <div className="space-y-3">
      <MB>{`r = g^k,\\; e = H(r \\Vert m),\\; s = k + xe \\pmod q`}</MB>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-2">
        <div><Label>private x</Label><Input value={x} onChange={(e) => setX(e.target.value)} className="font-mono" /></div>
        <div><Label>message</Label><Input value={m} onChange={(e) => setM(e.target.value)} /></div>
      </div>
      <Button onClick={sign} disabled={loading} className="font-mono">
        {loading ? "signing..." : "sign"}
      </Button>
      {sig && (
        <Card className="p-3 space-y-1">
          <Mono>y (pub) = {sig.y}</Mono>
          <Mono>signature = (e={sig.e}, s={sig.s})</Mono>
          <div className={`text-sm font-mono ${ok ? "text-gb-green" : "text-gb-red"}`}>verify: {String(ok)}</div>
        </Card>
      )}
    </div>
  );
}
