import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ShieldX, Terminal, Zap } from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </div>
  );
}

// ─── components ──────────────────────────────────────────────────────────────

export function PA6() {
  const [message, setMessage] = useState("Confidential Text");
  const [flipIndex, setFlipIndex] = useState<number>(-1);
  const [result, setResult] = useState<{
    ciphertext_hex: string;
    cpa_plaintext: string;
    cca_plaintext: string;
  } | null>(null);

  const fetchMalleability = useCallback(async (msg: string, index: number) => {
    try {
      const res = await fetch("/api/pa6/malleability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, flip_index: index }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchMalleability(message, flipIndex);
  }, [message, flipIndex, fetchMalleability]);

  const toggleBit = (idx: number) => {
    setFlipIndex(prev => (prev === idx ? -1 : idx));
  };

  // Convert hex to bits for the UI
  const ctHex = result?.ciphertext_hex || "";
  const ctBytes = ctHex.match(/.{1,2}/g) || [];
  
  return (
    <div className="space-y-6">
      <Card className="p-6 border-border/50 bg-muted/20">
        <div className="space-y-4">
          <Label>Original Message (m)</Label>
          <Input 
            value={message} 
            onChange={(e) => setMessage(e.target.value)} 
            placeholder="Type a message to encrypt..."
            className="font-mono text-sm bg-background border-gb-purple/20 focus-visible:ring-gb-purple/30"
          />
          <div className="text-[10px] font-mono text-muted-foreground italic">
            Note: Encryption uses CTR mode (CPA) and Encrypt-then-MAC with CBC-MAC (CCA).
          </div>
        </div>
      </Card>

      {/* Bit-Flip Interface */}
      <Card className="p-4 border-gb-yellow/30 bg-gb-yellow/5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label>Ciphertext (C) — Click a bit to flip</Label>
            {flipIndex >= 0 && (
              <div className="text-[10px] font-mono font-bold text-gb-yellow uppercase animate-pulse">
                Bit {flipIndex} Flipped!
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1 font-mono">
            {ctBytes.map((byteHex, bIdx) => {
              const byte = parseInt(byteHex, 16);
              return (
                <div key={bIdx} className="flex gap-[1px] bg-background/30 p-1 rounded-md border border-border/50">
                  {[...Array(8)].map((_, bitPos) => {
                    const globalIdx = bIdx * 8 + (7 - bitPos);
                    const isFlipped = flipIndex === globalIdx;
                    const bitValue = (byte >> (7 - bitPos)) & 1;
                    return (
                      <button
                        key={bitPos}
                        onClick={() => toggleBit(globalIdx)}
                        className={`w-3 h-5 text-[8px] flex items-center justify-center rounded-[2px] transition-all hover:scale-110 active:scale-95
                          ${isFlipped 
                            ? "bg-gb-yellow text-background font-black shadow-lg shadow-gb-yellow/40" 
                            : "bg-muted-foreground/10 text-muted-foreground/60 hover:bg-muted-foreground/20"
                          }`}
                      >
                        {bitValue}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Malleability Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* CPA-Only */}
        <Card className="relative overflow-hidden p-6 border-gb-red/30 bg-gb-red/5">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <ShieldX className="w-16 h-16 text-gb-red" />
          </div>
          
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-gb-red/20 rounded-lg">
              <Zap className="w-4 h-4 text-gb-red" />
            </div>
            <h3 className="text-sm font-black font-mono uppercase tracking-widest text-gb-red">
              CPA-Only (Malleable)
            </h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-background border border-gb-red/20 rounded-xl min-h-[100px] flex flex-col justify-center">
              <Label>Decrypted Plaintext (m′)</Label>
              <div className={`font-mono text-xl font-bold break-all transition-colors duration-300 ${flipIndex >= 0 ? "text-gb-red" : "text-foreground"}`}>
                {result?.cpa_plaintext || "..."}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
              In CTR mode, the adversary can flip bits in <span className="font-bold italic">C</span> to precisely flip the corresponding bits in <span className="font-bold italic">m</span>. 
              The system has no way to detect this modification.
            </p>
          </div>
        </Card>

        {/* CCA-Secure */}
        <Card className="relative overflow-hidden p-6 border-gb-green/30 bg-gb-green/5">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <ShieldCheck className="w-16 h-16 text-gb-green" />
          </div>

          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-gb-green/20 rounded-lg">
              <Terminal className="w-4 h-4 text-gb-green" />
            </div>
            <h3 className="text-sm font-black font-mono uppercase tracking-widest text-gb-green">
              CCA (Encrypt-then-MAC)
            </h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-background border border-gb-green/20 rounded-xl min-h-[100px] flex flex-col justify-center items-center">
              <Label>Decrypted Plaintext (m′)</Label>
              <div className={`font-mono text-4xl font-black transition-all duration-300 ${flipIndex >= 0 ? "text-gb-red scale-110" : "text-gb-green"}`}>
                {result?.cca_plaintext || "..."}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
              With a MAC, the decryption oracle verifies <span className="font-bold italic">Vrfy(k_M, C, t)</span> before attempting to decrypt. 
              Any modification to the ciphertext is detected, and the process returns <span className="text-gb-red font-bold">⊥</span>.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
