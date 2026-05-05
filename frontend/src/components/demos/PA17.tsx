import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MB, M } from "@/components/Math";
import { ShieldCheck, ShieldAlert, Zap, Lock, Unlock, RefreshCw, Send } from "lucide-react";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

interface CCAResult {
  p: string;
  g: string;
  x_enc: string;
  x_sign: string;
  c1: string;
  c2: string;
  r_sig: string;
  s_sig: string;
  plain_c1: string;
  plain_c2: string;
  error?: string;
}

export function PA17() {
  const [m, setM] = useState("123");
  const [data, setData] = useState<CCAResult | null>(null);
  
  // Tampered states
  const [t_c1, setTC1] = useState<string | null>(null);
  const [t_c2, setTC2] = useState<string | null>(null);
  const [t_pc1, setTPC1] = useState<string | null>(null);
  const [t_pc2, setTPC2] = useState<string | null>(null);

  const [res_cca, setResCCA] = useState<{ m: string, status: string } | null>(null);
  const [res_plain, setResPlain] = useState<{ m: string, status: string } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function encrypt() {
    setLoading(true);
    setError(null);
    setResCCA(null);
    setResPlain(null);
    try {
      const res = await fetch("/api/pa17/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setTC1(d.c1);
      setTC2(d.c2);
      setTPC1(d.plain_c1);
      setTPC2(d.plain_c2);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function tamper() {
    if (!data || !t_c2 || !t_pc2) return;
    // Multiply c2 by 2 mod p
    const p = BigInt(data.p);
    setTC2(((BigInt(t_c2) * 2n) % p).toString());
    setTPC2(((BigInt(t_pc2) * 2n) % p).toString());
    setResCCA(null);
    setResPlain(null);
  }

  async function decrypt(isCCA: boolean) {
    if (!data) return;
    setLoading(true);
    try {
      const body = {
        p: data.p,
        x_enc: data.x_enc,
        x_sign: data.x_sign,
        c1: isCCA ? t_c1 : t_pc1,
        c2: isCCA ? t_c2 : t_pc2,
        r_sig: data.r_sig,
        s_sig: data.s_sig,
        is_cca: isCCA
      };
      
      const res = await fetch("/api/pa17/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (isCCA) setResCCA(d);
      else setResPlain(d);
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
            <div>
              <Label>Message m (Integer)</Label>
              <Input 
                type="number" 
                value={m} 
                onChange={(e) => setM(e.target.value)} 
                className="font-mono"
              />
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              The message will be encrypted using <span className="text-foreground font-bold underline">Encrypt-then-Sign</span> to provide Authenticated Encryption.
            </div>
          </div>
          <Button onClick={encrypt} disabled={loading} className="w-full bg-gb-purple hover:bg-gb-purple/90 text-white font-bold gap-2">
            <Send className="w-4 h-4" /> {loading ? "Encrypting..." : "Generate & Sign Ciphertexts"}
          </Button>
        </div>
      </Card>

      {data && (
        <div className="grid lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* CCA Side */}
          <div className="space-y-4">
            <Card className="p-5 border-gb-green/30 bg-gb-green/5 space-y-4 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <ShieldCheck className="w-12 h-12 text-gb-green" />
               </div>
               <h3 className="text-xs font-bold font-mono uppercase tracking-widest flex items-center gap-2">
                 Encrypt-then-Sign (CCA Secure)
               </h3>
               
               <div className="space-y-3">
                 <div className="p-3 bg-background border border-border/50 rounded-lg">
                   <Label>Ciphertext CE</Label>
                   <div className="font-mono text-xs break-all text-gb-aqua">
                     ({t_c1}, {t_c2})
                   </div>
                 </div>
                 <div className="p-3 bg-background border border-border/50 rounded-lg">
                   <Label>Signature σ</Label>
                   <div className="font-mono text-[10px] break-all opacity-60">
                     ({data.r_sig}, {data.s_sig})
                   </div>
                 </div>
               </div>

               <div className="flex gap-2">
                 <Button 
                   onClick={tamper} 
                   className="flex-1 bg-gb-red/10 hover:bg-gb-red/20 text-gb-red border border-gb-red/30 font-bold text-[10px] uppercase tracking-tighter"
                 >
                   Tamper with CE
                 </Button>
                 <Button 
                   onClick={() => decrypt(true)} 
                   disabled={loading}
                   className="flex-1 bg-gb-green/10 hover:bg-gb-green/20 text-gb-green border border-gb-green/30 font-bold text-[10px] uppercase tracking-tighter"
                 >
                   Decrypt Oracle
                 </Button>
               </div>

               {res_cca && (
                 <div className={`p-4 rounded-xl border-2 transition-all ${res_cca.m === "⊥" ? "bg-gb-red/10 border-gb-red/30" : "bg-gb-green/10 border-gb-green/30"}`}>
                   <div className="flex items-center justify-between mb-2">
                     <Label className="mb-0">Result</Label>
                     <Badge variant="outline" className={res_cca.m === "⊥" ? "text-gb-red border-gb-red/30" : "text-gb-green border-gb-green/30"}>
                        {res_cca.m === "⊥" ? "ABORTED" : "SUCCESS"}
                     </Badge>
                   </div>
                   <div className={`text-4xl font-black font-mono text-center mb-1 ${res_cca.m === "⊥" ? "text-gb-red" : "text-gb-green"}`}>
                     {res_cca.m}
                   </div>
                   <p className="text-[10px] text-center font-mono italic opacity-70 leading-tight">
                     {res_cca.status}
                   </p>
                 </div>
               )}
            </Card>
          </div>

          {/* Plain ElGamal Side */}
          <div className="space-y-4">
            <Card className="p-5 border-gb-red/30 bg-gb-red/5 space-y-4 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <ShieldAlert className="w-12 h-12 text-gb-red" />
               </div>
               <h3 className="text-xs font-bold font-mono uppercase tracking-widest flex items-center gap-2">
                 Plain ElGamal (Malleable)
               </h3>
               
               <div className="space-y-3">
                 <div className="p-3 bg-background border border-border/50 rounded-lg">
                   <Label>Ciphertext C</Label>
                   <div className="font-mono text-xs break-all text-gb-yellow">
                     ({t_pc1}, {t_pc2})
                   </div>
                 </div>
                 <div className="p-3 bg-muted/20 border border-dashed border-border/50 rounded-lg h-[54px] flex items-center justify-center">
                   <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest">No Integrity</span>
                 </div>
               </div>

               <div className="flex gap-2">
                 <div className="flex-1" />
                 <Button 
                   onClick={() => decrypt(false)} 
                   disabled={loading}
                   className="flex-1 bg-gb-yellow/10 hover:bg-gb-yellow/20 text-gb-yellow border border-gb-yellow/30 font-bold text-[10px] uppercase tracking-tighter"
                 >
                   Decrypt Oracle
                 </Button>
               </div>

               {res_plain && (
                 <div className="p-4 rounded-xl border-2 border-gb-yellow/30 bg-gb-yellow/10 transition-all">
                   <div className="flex items-center justify-between mb-2">
                     <Label className="mb-0">Result</Label>
                     <Badge variant="outline" className="text-gb-yellow border-gb-yellow/30">
                        MALLEABLE
                     </Badge>
                   </div>
                   <div className="text-4xl font-black font-mono text-center text-gb-yellow mb-1">
                     {res_plain.m}
                   </div>
                   <p className="text-[10px] text-center font-mono italic opacity-70 leading-tight">
                     Successfully manipulated message returned.
                   </p>
                 </div>
               )}
            </Card>
          </div>
        </div>
      )}

      {data && (
        <Card className="p-4 border-dashed border-2 bg-muted/10">
          <h4 className="text-[10px] font-bold font-mono uppercase mb-2">Security Analysis</h4>
          <p className="text-xs font-mono leading-relaxed text-muted-foreground">
            Encrypt-then-Sign achieves <span className="text-foreground font-bold underline">Authenticated Encryption</span>. 
            Because the signature <MB inline>{`\\sigma = \\mathsf{Sign}_{sk}(C_E)`}</MB> covers the entire ciphertext, any change to 
            the bytes of <M>{"C_E"}</M> will cause <M>{"\\mathsf{Verify}(\\sigma)"}</M> to fail before the decryption even looks at the data. 
            This provides <span className="text-gb-green font-bold">CCA Security</span> by design.
          </p>
        </Card>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-gb-red/10 border border-gb-red/30 text-gb-red font-mono text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
