import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { MB } from "@/components/Math";

// ─── helpers ─────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </div>
  );
}

// ─── components ──────────────────────────────────────────────────────────────

export function PA8() {
  const [message, setMessage] = useState("Merkle-Damgard with Discrete Log");
  const [fullHash, setFullHash] = useState("");
  const [loadingHash, setLoadingHash] = useState(false);
  
  const [huntResult, setHuntResult] = useState<{
    tries: number;
    birthday_bound: number;
    input1: string;
    input2: string;
    digest_hex: string;
    hit_msg: string;
  } | null>(null);
  const [hunting, setHunting] = useState(false);
  const [huntCounter, setHuntCounter] = useState(0);
  const animationRef = useRef<number | null>(null);

  // ── Compute Full Hash ──
  const computeHash = useCallback(async (msg: string) => {
    setLoadingHash(true);
    try {
      const res = await fetch("/api/pa8/hash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFullHash(data.full_hash_hex);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHash(false);
    }
  }, []);

  useEffect(() => {
    computeHash(message);
  }, [message, computeHash]);

  // ── Collision Hunt ──
  const startHunt = useCallback(async () => {
    setHunting(true);
    setHuntResult(null);
    setHuntCounter(0);
    
    try {
      const res = await fetch("/api/pa8/hunt", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      // Animate the counter
      let start = 0;
      const duration = 2000; // 2 seconds
      const startTime = performance.now();
      
      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(progress * data.tries);
        setHuntCounter(current);
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setHuntResult(data);
          setHunting(false);
        }
      };
      animationRef.current = requestAnimationFrame(animate);
      
    } catch (e) {
      console.error(e);
      setHunting(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Part 1: Full DLP Hash */}
      <Card className="p-6 border-border/50 bg-muted/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-foreground">
              DLP Hash Live
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border">
              RFC 3526 1024-bit Group
            </span>
          </div>

          <div className="space-y-2">
            <Label>Input Message</Label>
            <Input 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
              placeholder="Type a message..."
              className="font-mono text-sm bg-background border-gb-purple/20 focus-visible:ring-gb-purple/30"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <Label>Full Hash (Group Element)</Label>
              {loadingHash && <span className="text-[10px] font-mono text-gb-purple animate-pulse">Computing...</span>}
            </div>
            <div className="p-4 bg-background border border-border/50 rounded-lg font-mono text-[11px] break-all leading-relaxed shadow-inner max-h-32 overflow-y-auto">
              {fullHash || "..."}
            </div>
          </div>
        </div>
      </Card>

      {/* Part 2: Collision Hunt (Toy 16-bit) */}
      <Card className="p-6 border-gb-yellow/30 bg-gb-yellow/5">
        <div className="flex flex-col md:flex-row md:items-start gap-8">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gb-yellow/20 rounded-md">
                <div className="w-3 h-3 bg-gb-yellow rounded-full animate-pulse" />
              </div>
              <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-gb-yellow">
                Collision Hunt (Toy 16-bit)
              </h3>
            </div>
            
            <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
              To demonstrate collision resistance, we truncate the DLP hash to <span className="text-foreground font-bold">16 bits</span>. 
              The birthday paradox predicts a collision in <MB inline>{`\\approx 2^{16/2} = 256`}</MB> trials.
            </p>

            <Button 
              onClick={startHunt} 
              disabled={hunting} 
              className="w-full md:w-auto font-mono bg-gb-yellow text-background hover:bg-gb-yellow/90"
            >
              {hunting ? "Hunting..." : "Start Collision Hunt"}
            </Button>
          </div>

          <div className="w-full md:w-72 space-y-4">
            <div className="p-4 bg-background border border-gb-yellow/20 rounded-xl shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <Label>Hashes Evaluated</Label>
                <span className={`font-mono text-xl font-bold ${hunting ? "text-gb-yellow animate-pulse" : "text-foreground"}`}>
                  {huntCounter}
                </span>
              </div>
              <Progress value={(huntCounter / 256) * 100} className="h-2 bg-gb-yellow/10">
                <div 
                  className="h-full bg-gb-yellow transition-all duration-300" 
                  style={{ width: `${Math.min((huntCounter / 256) * 100, 100)}%` }} 
                />
              </Progress>
              <div className="flex justify-between mt-1.5 text-[9px] font-mono text-muted-foreground uppercase">
                <span>0</span>
                <span>Target: 256</span>
              </div>
            </div>
          </div>
        </div>

        {huntResult && (
          <div className="mt-8 grid md:grid-cols-2 gap-4 animate-in zoom-in-95 duration-500">
            <div className="bg-background/80 border border-gb-green/30 rounded-lg p-3">
              <div className="text-[10px] font-bold text-gb-green uppercase tracking-widest mb-3">Collision Inputs</div>
              <div className="space-y-3">
                <div>
                  <Label>Input A (hex)</Label>
                  <div className="font-mono text-xs break-all text-gb-green bg-gb-green/5 p-2 rounded">{huntResult.input1}</div>
                </div>
                <div>
                  <Label>Input B (hex)</Label>
                  <div className="font-mono text-xs break-all text-gb-green bg-gb-green/5 p-2 rounded">{huntResult.input2}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-background/80 border border-gb-yellow/30 rounded-lg p-3 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-gb-yellow uppercase tracking-widest mb-3">Shared 16-bit Hash</div>
                <div className="font-mono text-2xl font-bold text-gb-yellow tracking-widest text-center py-4">
                  0x{huntResult.digest_hex.toUpperCase()}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono italic text-center border-t border-border/50 pt-2">
                Successfully found in {huntResult.tries} trials.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
