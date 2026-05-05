import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MB, M } from "@/components/Math";
import { ShieldAlert, ShieldCheck, RefreshCw, Zap, Lock, Unlock } from "lucide-react";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground bg-muted px-1 rounded">{children}</span>;
}

export function PA16() {
  const [p] = useState("467");
  const [g] = useState("2");
  const [x] = useState("127"); // Private key
  const [m, setM] = useState("42");
  
  const [c1, setC1] = useState<string | null>(null);
  const [c2, setC2] = useState<string | null>(null);
  const [recoveredM, setRecoveredM] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function encrypt() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa16/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p, g, x, m }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setC1(data.c1);
      setC2(data.c2);
      setRecoveredM(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function decrypt() {
    if (!c1 || !c2) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pa16/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p, x, c1, c2 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRecoveredM(data.m);
      
      // Update success counter for malleability demonstration
      setTotalAttempts(prev => prev + 1);
      if (parseInt(data.m) === (parseInt(m) * 2) % parseInt(p) || parseInt(data.m) === parseInt(m)) {
        setSuccessCount(prev => prev + 1);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function multiplyC2() {
    if (!c2) return;
    const newC2 = (BigInt(c2) * 2n % BigInt(p)).toString();
    setC2(newC2);
    setRecoveredM(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Side: Malleability Demo */}
        <div className="space-y-4">
          <Card className="p-6 border-gb-purple/20 bg-muted/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap className="w-12 h-12" />
            </div>
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-gb-purple" /> ElGamal Malleability
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label>Plaintext m (Group Element)</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={m} 
                    onChange={(e) => setM(e.target.value)} 
                    className="font-mono"
                  />
                  <Button onClick={encrypt} disabled={loading} variant="outline" className="bg-gb-purple/10 text-gb-purple border-gb-purple/20">
                    Encrypt
                  </Button>
                </div>
              </div>

              {c1 && c2 && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-background border border-border/50 rounded-lg">
                      <Label>c₁ = gʳ</Label>
                      <div className="font-mono text-lg text-gb-aqua">{c1}</div>
                    </div>
                    <div className="p-3 bg-background border border-border/50 rounded-lg relative group">
                      <Label>c₂ = m · hʳ</Label>
                      <div className="font-mono text-lg text-gb-yellow">{c2}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={multiplyC2} 
                      className="flex-1 bg-gb-yellow/20 hover:bg-gb-yellow/30 text-gb-yellow border border-gb-yellow/30 font-bold text-xs"
                    >
                      Multiply c₂ by 2
                    </Button>
                    <Button 
                      onClick={decrypt} 
                      disabled={loading}
                      className="flex-1 bg-gb-green/20 hover:bg-gb-green/30 text-gb-green border border-gb-green/30 font-bold text-xs"
                    >
                      Decrypt
                    </Button>
                  </div>
                </div>
              )}

              {recoveredM !== null && (
                <div className="p-4 bg-background border-2 border-gb-green/30 rounded-xl text-center space-y-2 animate-in zoom-in-95">
                  <Label>Decrypted Result</Label>
                  <div className="font-mono text-3xl font-black text-gb-green">
                    {recoveredM}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {parseInt(recoveredM) === (parseInt(m) * 2) % parseInt(p) ? (
                      <span className="text-gb-yellow font-bold">Successfully manipulated! (2m mod p)</span>
                    ) : (
                      <span>Original message recovered.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 border-dashed border-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gb-green/10 rounded-full">
                <RefreshCw className="w-5 h-5 text-gb-green" />
              </div>
              <div>
                <Label className="mb-0">Attack Success Rate</Label>
                <div className="text-xs font-mono text-muted-foreground italic">Homomorphic multiplication test</div>
              </div>
            </div>
            <div className="text-2xl font-mono font-bold text-gb-green">
              {totalAttempts > 0 ? Math.round((successCount / totalAttempts) * 100) : 100}%
            </div>
          </Card>
        </div>

        {/* Right Side: Security Context */}
        <div className="space-y-4">
          <Card className="p-6 border-gb-red/20 bg-gb-red/5">
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-gb-red" /> Why CCA Fails
            </h3>
            
            <div className="space-y-4 text-xs font-mono leading-relaxed text-muted-foreground">
              <p>
                ElGamal is <span className="text-foreground font-bold">IND-CPA</span> secure but inherently <span className="text-gb-red font-bold">malleable</span>.
              </p>
              
              <div className="p-3 bg-background/50 border border-border/50 rounded-lg space-y-2">
                <Label>The CCA Vulnerability</Label>
                <p className="text-[10px]">
                  In the CCA game, an attacker intercepts <M>{"(c_1, c_2)"}</M> for a secret <M>{"m"}</M>. They can't ask to decrypt <M>{"(c_1, c_2)"}</M>, but they CAN ask to decrypt <M>{"(c_1, 2c_2)"}</M>.
                </p>
                <MB inline>{`(c_1, 2c_2) \\to \\text{Oracle} \\to 2m`}</MB>
                <p className="text-[10px]">
                  Since the result is <M>{"2m"}</M>, the attacker simply divides by 2 to recover the forbidden <M>{"m"}</M>.
                </p>
              </div>

              <div className="flex items-start gap-3 pt-2">
                <ShieldCheck className="w-5 h-5 text-gb-green shrink-0" />
                <p className="text-[10px]">
                  To fix this, we need <span className="text-gb-green font-bold">IND-CCA2</span> security, which often requires adding a MAC or switching to something like RSA-OAEP.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-muted/30">
            <Label>Mathematical Identity</Label>
            <div className="text-[11px] font-mono space-y-2">
              <div className="flex items-center gap-2">
                <M>{"Enc(m) = (g^r, m \\cdot h^r)"}</M>
              </div>
              <div className="flex items-center gap-2">
                <M>{"(c_1, 2c_2) = (g^r, 2m \\cdot h^r) = Enc(2m)"}</M>
              </div>
              <div className="text-[9px] text-muted-foreground italic mt-2">
                *Note: Multiplication is modulo p.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
