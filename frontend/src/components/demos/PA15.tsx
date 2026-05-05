import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MB, M } from "@/components/Math";
import { ShieldCheck, ShieldAlert, PenTool, Search, Zap, Trash2, Lock } from "lucide-react";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA15() {
  const [message, setMessage] = useState("Authenticated RSA");
  const [isRaw, setIsRaw] = useState(false);
  
  const [sigData, setSigData] = useState<{ sigma: string; n: string; e: string; h_m: string } | null>(null);
  const [verifyData, setVerifyData] = useState<{ is_valid: boolean; h_m: string; sigma_e: string } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgery demo states
  const [m1] = useState("3");
  const [m2] = useState("7");
  const [s1, setS1] = useState<string | null>(null);
  const [s2, setS2] = useState<string | null>(null);

  async function sign() {
    setLoading(true);
    setError(null);
    setVerifyData(null);
    try {
      const res = await fetch("/api/pa15/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m: message, is_raw: isRaw }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setSigData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!sigData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa15/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          m: message, 
          sigma: sigData.sigma, 
          is_raw: isRaw,
          n: sigData.n,
          e: sigData.e
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setVerifyData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function tamper() {
    setMessage(prev => prev + "!");
    setVerifyData(null);
  }

  async function runForgery() {
    setLoading(true);
    try {
      const r1 = await fetch("/api/pa15/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m: m1, is_raw: true }),
      });
      const d1 = await r1.json();
      setS1(d1.sigma);

      const r2 = await fetch("/api/pa15/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m: m2, is_raw: true }),
      });
      const d2 = await r2.json();
      setS2(d2.sigma);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-muted/20 border-border/50">
        <div className="grid md:grid-cols-2 gap-6 items-end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Message to Sign</Label>
              <div className="flex items-center gap-2">
                <Label className="mb-0 lowercase">Raw RSA (No Hash)</Label>
                <Switch checked={isRaw} onCheckedChange={(v) => { setIsRaw(v); setSigData(null); setVerifyData(null); }} />
              </div>
            </div>
            <Input 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
              className="font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={sign} disabled={loading} className="flex-1 bg-gb-purple hover:bg-gb-purple/90 text-white font-bold gap-2">
              <PenTool className="w-4 h-4" /> Sign
            </Button>
            <Button onClick={tamper} variant="outline" className="text-gb-red border-gb-red/30 hover:bg-gb-red/5">
              <Trash2 className="w-4 h-4" /> Tamper
            </Button>
          </div>
        </div>
      </Card>

      {sigData && (
        <div className="grid lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="p-5 border-gb-aqua/30 bg-gb-aqua/5 space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest flex items-center gap-2">
              <Lock className="w-4 h-4 text-gb-aqua" /> RSA Signature
            </h3>
            <div className="space-y-3">
              <div>
                <Label>Signature σ (Hex)</Label>
                <div className="font-mono text-[10px] break-all bg-background p-2 rounded border border-border/50 max-h-20 overflow-y-auto">
                  {sigData.sigma}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Modulus N</Label>
                  <div className="font-mono text-[9px] truncate opacity-60">{sigData.n}</div>
                </div>
                <div>
                  <Label>Exponent e</Label>
                  <div className="font-mono text-[9px] opacity-60">{sigData.e}</div>
                </div>
              </div>
            </div>
            <Button onClick={verify} disabled={loading} className="w-full bg-gb-aqua hover:bg-gb-aqua/90 text-white font-bold gap-2">
              <Search className="w-4 h-4" /> Verify Signature
            </Button>
          </Card>

          {verifyData && (
            <Card className={`p-5 border-2 transition-all ${verifyData.is_valid ? "border-gb-green bg-gb-green/5" : "border-gb-red bg-gb-red/5"}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${verifyData.is_valid ? "bg-gb-green/20 text-gb-green" : "bg-gb-red/20 text-gb-red"}`}>
                  {verifyData.is_valid ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <h3 className="text-xs font-bold font-mono uppercase tracking-widest">Verification Result</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-mono uppercase text-muted-foreground">
                    <span>σᵉ mod N</span>
                    <span>H(m) mod N</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono text-[10px] truncate bg-background p-1.5 rounded border border-border/50">{verifyData.sigma_e}</div>
                    <div className="text-xs">
                      {verifyData.is_valid ? <span className="text-gb-green">==</span> : <span className="text-gb-red">!=</span>}
                    </div>
                    <div className="flex-1 font-mono text-[10px] truncate bg-background p-1.5 rounded border border-border/50">{verifyData.h_m}</div>
                  </div>
                </div>
                <div className={`text-center font-mono text-sm font-black p-2 rounded ${verifyData.is_valid ? "text-gb-green bg-gb-green/10" : "text-gb-red bg-gb-red/10"}`}>
                  {verifyData.is_valid ? "VALID SIGNATURE" : "INVALID SIGNATURE"}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {isRaw && (
        <Card className="p-5 border-gb-yellow/30 bg-gb-yellow/5 space-y-4">
          <div className="flex items-center justify-between">
             <h3 className="text-xs font-bold font-mono uppercase tracking-widest flex items-center gap-2 text-gb-yellow">
               <Zap className="w-4 h-4" /> Multiplicative Forgery (Raw RSA)
             </h3>
             <Button onClick={runForgery} size="sm" variant="outline" className="text-gb-yellow border-gb-yellow/30 h-7 text-[10px]">
               Demonstrate Forgery
             </Button>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Step 1: Sign m₁ and m₂</Label>
              <div className="text-[10px] font-mono space-y-1 opacity-80">
                <div>m₁ = {m1}, σ₁ = {s1 ? s1.slice(0, 10) + "..." : "?"}</div>
                <div>m₂ = {m2}, σ₂ = {s2 ? s2.slice(0, 10) + "..." : "?"}</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Step 2: Forge σ₃ = σ₁ · σ₂</Label>
              <div className="text-[10px] font-mono space-y-1 opacity-80">
                <div>m₃ = m₁ · m₂ = {parseInt(m1) * parseInt(m2)}</div>
                <div>σ₃ = σ₁ · σ₂ mod N</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Step 3: Verification Success</Label>
              <p className="text-[9px] leading-relaxed italic text-muted-foreground">
                Because <M>{"(m_1 m_2)^d = m_1^d m_2^d"}</M>, the forged signature is valid without the private key!
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 border-dashed border-2 bg-muted/10">
        <h4 className="text-[10px] font-bold font-mono uppercase mb-2">Pedagogical Note</h4>
        <p className="text-xs font-mono leading-relaxed text-muted-foreground">
          RSA signatures must always use a <span className="text-foreground font-bold underline">Cryptographic Hash</span>. 
          Without hashing, RSA is homomorphic: <M>{"\\mathsf{Sign}(m_1) \\cdot \\mathsf{Sign}(m_2) = \\mathsf{Sign}(m_1 \\cdot m_2)"}</M>. 
          This allows an attacker to forge signatures on new messages. Hashing breaks this structural relationship.
        </p>
      </Card>

      {error && (
        <div className="p-4 rounded-lg bg-gb-red/10 border border-gb-red/30 text-gb-red font-mono text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
