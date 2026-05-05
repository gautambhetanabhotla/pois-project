import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { M } from "@/components/Math";
import { Send, ShieldCheck, ShieldAlert, Cpu, Calculator } from "lucide-react";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground bg-muted px-1 rounded">{children}</span>;
}

interface HastadResult {
  ciphertexts: string[];
  moduli: string[];
  recovered_m_3: string;
  recovered_m: string;
  is_success: boolean;
  error?: string;
}

export function PA14() {
  const [message, setMessage] = useState("PoIS");
  const [usePadding, setUsePadding] = useState(false);
  const [result, setResult] = useState<HastadResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAttack() {
    setLoading(true);
    try {
      const res = await fetch("/api/pa14/hastad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, padding: usePadding }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ ciphertexts: [], moduli: [], recovered_m_3: "", recovered_m: "", is_success: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-muted/20 border-border/50">
        <div className="grid md:grid-cols-2 gap-6 items-end">
          <div className="space-y-4">
            <div>
              <Label>Broadcast Message (m)</Label>
              <Input 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                className="font-mono"
                placeholder="Enter secret..."
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={usePadding} onCheckedChange={setUsePadding} />
              <Label className="mb-0">Use PKCS#1 v1.5 Padding</Label>
            </div>
          </div>
          <Button onClick={runAttack} disabled={loading} className="w-full bg-gb-purple hover:bg-gb-purple/90 text-white font-bold gap-2">
            <Send className="w-4 h-4" /> {loading ? "Broadcasting..." : "Broadcast & Intercept"}
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-4 border-border/50 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-gb-aqua/40" />
            <div className="flex justify-between items-start mb-3">
              <Label>Recipient {i + 1}</Label>
              <Badge variant="outline" className="text-[9px] font-mono">e = 3</Badge>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Modulus N{i+1}</Label>
                <div className="font-mono text-[10px] bg-background p-1.5 rounded border border-border/50 break-all h-12 overflow-y-auto">
                  {result?.moduli[i] || "..."}
                </div>
              </div>
              <div>
                <Label>Ciphertext c{i+1}</Label>
                <div className="font-mono text-[10px] text-gb-aqua bg-gb-aqua/5 p-1.5 rounded border border-gb-aqua/20 break-all h-20 overflow-y-auto">
                  {result?.ciphertexts[i] || "..."}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {result && (
        <Card className={`p-6 border-2 transition-all ${result.is_success ? "border-gb-green bg-gb-green/5" : "border-gb-red bg-gb-red/5"}`}>
          <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
            <div className={`p-2 rounded-lg ${result.is_success ? "bg-gb-green/20 text-gb-green" : "bg-gb-red/20 text-gb-red"}`}>
              {result.is_success ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono uppercase tracking-widest">Attacker Recovery Panel</h3>
              <p className="text-[10px] text-muted-foreground font-mono">Running CRT and Cube Root Extraction</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>1. Solve CRT for x</Label>
                <div className="flex items-center gap-2 mb-2">
                  <M>{"x \\equiv c_i \\pmod{N_i}"}</M>
                </div>
                <div className="font-mono text-[11px] bg-background p-3 rounded border border-border/50 break-all max-h-24 overflow-y-auto shadow-inner">
                   x = {result.recovered_m_3}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1 italic">
                  *CRT recovers m³ mod (N₁N₂N₃). Since m³ &lt; N₁N₂N₃, x is exactly m³.
                </p>
              </div>

              <div className="space-y-2">
                <Label>2. Compute Cube Root</Label>
                <div className="flex items-center gap-2 mb-2">
                  <M>{"m = \\sqrt[3]{x}"}</M>
                </div>
                <div className={`font-mono text-2xl font-black p-3 rounded border text-center ${
                  result.is_success ? "bg-gb-green/10 border-gb-green/30 text-gb-green" : "bg-gb-red/10 border-gb-red/30 text-gb-red"
                }`}>
                   {result.recovered_m}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50">
              <p className="text-xs font-mono leading-relaxed">
                {result.is_success ? (
                  <span className="text-gb-green">
                    [SUCCESS] Broadcast attack succeeded! Without padding, encrypting the same message with small exponent e=3 allows an attacker to recover the plaintext via CRT.
                  </span>
                ) : (
                  <span className="text-gb-red">
                    [FAILED] Attack defeated. {usePadding ? "Padding adds randomness to each ciphertext, so we are no longer solving for the same m^3." : "Recovery failed (check message length)."}
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {result?.error && (
        <div className="p-4 rounded-lg bg-gb-red/10 border border-gb-red/30 text-gb-red font-mono text-xs">
          {result.error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-4 border-dashed border-2 flex items-start gap-4 opacity-70">
           <Calculator className="w-8 h-8 text-muted-foreground mt-1" />
           <div>
             <Label>CRT Math</Label>
             <div className="text-[10px] space-y-1">
               <div className="flex items-center gap-2">
                 <M>{"x = \\sum c_i M_i y_i \\pmod N"}</M>
               </div>
               <div className="flex items-center gap-2">
                 <M>{"M_i = N / N_i"}</M>
               </div>
               <div className="flex items-center gap-2">
                 <M>{"y_i = M_i^{-1} \\pmod{N_i}"}</M>
               </div>
             </div>
           </div>
        </Card>
        <Card className="p-4 border-dashed border-2 flex items-start gap-4 opacity-70">
           <Cpu className="w-8 h-8 text-muted-foreground mt-1" />
           <div>
             <Label>Vulnerability</Label>
             <p className="text-[10px] leading-relaxed">
               This attack works because the exponent <M>{"e"}</M> is small and the same message is sent to <M>{"e"}</M> different recipients. 
               The unique solution <M>{"x < N_1 \\dots N_e"}</M> is exactly <M>{"m^e"}</M> in the integers.
             </p>
           </div>
        </Card>
      </div>
    </div>
  );
}
