import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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

export function PA9() {
  const [nBits, setNBits] = useState(12);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    x1: string;
    x2: string;
    digest: number;
    evaluations: number;
    expected: number;
    prob_history: number[];
  } | null>(null);
  
  const [currentCount, setCurrentCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);

  const runAttack = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setCurrentCount(0);
    try {
      const res = await fetch("/api/pa9/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n_bits: nBits }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
      
      // Start animation
      setIsAnimating(true);
      let start = 0;
      const duration = 1500; // 1.5 seconds for animation
      const startTime = performance.now();
      
      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function: easeOutExpo
        const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const nextCount = Math.floor(easedProgress * data.evaluations);
        setCurrentCount(nextCount);
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
        }
      };
      animationRef.current = requestAnimationFrame(animate);
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [nBits]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // ── Chart Dimensions ──
  const width = 400;
  const height = 200;
  const padding = 30;
  
  // ── Curve Generation ──
  // Theoretical curve: P = 1 - e^(-k^2 / 2^(n+1))
  const birthday = Math.pow(2, nBits / 2);
  const kMax = Math.max(birthday * 2.5, currentCount * 1.1);
  const theoreticalPoints: [number, number][] = [];
  for (let k = 0; k <= kMax; k += kMax / 100) {
    const p = 1 - Math.exp(-(k * k) / Math.pow(2, nBits + 1));
    theoreticalPoints.push([k, p]);
  }

  // ── Scaling ──
  const scaleX = (k: number) => padding + (k / kMax) * (width - 2 * padding);
  const scaleY = (p: number) => height - padding - p * (height - 2 * padding);

  const theoreticalPath = theoreticalPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p[0])} ${scaleY(p[1])}`)
    .join(" ");

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border/50 bg-muted/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-4">
                <Label>Output Bit-Length (n)</Label>
                <span className="font-mono text-sm font-bold bg-gb-purple/10 text-gb-purple px-2 py-0.5 rounded">
                  {nBits} bits (range: 0–{Math.pow(2, nBits) - 1})
                </span>
              </div>
              <Slider
                value={[nBits]}
                onValueChange={([v]) => setNBits(v)}
                min={8}
                max={16}
                step={2}
                className="py-4"
              />
            </div>
            <Button 
              onClick={runAttack} 
              disabled={loading || isAnimating} 
              className="w-full font-mono py-6 text-lg shadow-gb-purple/20 shadow-lg hover:shadow-gb-purple/40 transition-all active:scale-[0.98]"
            >
              {loading ? "Computing..." : isAnimating ? "Searching..." : "Run Birthday Attack"}
            </Button>
          </div>

          <div className="w-full md:w-64 bg-background/50 rounded-xl border border-border/50 p-6 flex flex-col items-center justify-center text-center shadow-inner">
            <Label>Hashes Computed</Label>
            <div className={`text-5xl font-mono font-bold tracking-tighter tabular-nums transition-colors ${isAnimating ? "text-gb-purple animate-pulse" : "text-foreground"}`}>
              {currentCount}
            </div>
            {result && !isAnimating && (
              <div className="mt-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Expected: ~{result.expected}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Probability Chart */}
        <Card className="p-4 border-border/50 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <Label>Collision Probability</Label>
            <div className="flex items-center gap-4 text-[9px] font-mono uppercase text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-0.5 bg-muted-foreground/40" /> Theoretical
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gb-purple" /> Empirical
              </div>
            </div>
          </div>
          
          <div className="relative aspect-[2/1] w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
              {/* Axes */}
              <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30" />
              <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30" />
              
              {/* Theoretical Curve */}
              <path d={theoreticalPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" className="text-muted-foreground/40" />
              
              {/* Birthday Bound Marker (2^n/2) */}
              <line 
                x1={scaleX(birthday)} y1={padding} x2={scaleX(birthday)} y2={height - padding} 
                stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" className="text-gb-yellow/50" 
              />
              <text x={scaleX(birthday)} y={padding - 5} textAnchor="middle" className="fill-gb-yellow text-[8px] font-mono uppercase">2^{nBits/2}</text>

              {/* Empirical Point (Animation) */}
              {currentCount > 0 && (
                <circle 
                  cx={scaleX(currentCount)} 
                  cy={scaleY(1 - Math.exp(-(currentCount * currentCount) / Math.pow(2, nBits + 1)))} 
                  r={isAnimating ? 3 : 5} 
                  className={`fill-gb-purple ${isAnimating ? "" : "animate-bounce"}`}
                />
              )}

              {/* Labels */}
              <text x={width - padding} y={height - padding + 15} textAnchor="end" className="fill-muted-foreground text-[8px] font-mono">Hashes (k)</text>
              <text x={padding - 5} y={padding} textAnchor="end" className="fill-muted-foreground text-[8px] font-mono" transform={`rotate(-90 ${padding-5} ${padding})`}>Prob</text>
            </svg>
          </div>
        </Card>

        {/* Collision Results */}
        <Card className="p-4 border-border/50 flex flex-col justify-center">
          <div className="space-y-4">
            {!result || isAnimating ? (
              <div className="text-center py-8 space-y-2">
                <div className="inline-block w-8 h-8 rounded-full border-2 border-t-gb-purple border-border animate-spin" />
                <div className="text-xs font-mono text-muted-foreground animate-pulse">
                  {isAnimating ? "Searching for collisions..." : "Adjust bits and start attack"}
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="bg-gb-green/10 border border-gb-green/20 rounded-lg p-3 mb-4">
                  <div className="text-[10px] font-bold text-gb-green uppercase tracking-widest mb-2">Collision Found!</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Input 1 (x)</Label>
                      <div className="font-mono text-xs break-all bg-background/50 p-1.5 rounded">{result.x1}</div>
                    </div>
                    <div>
                      <Label>Input 2 (x′)</Label>
                      <div className="font-mono text-xs break-all bg-background/50 p-1.5 rounded">{result.x2}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gb-purple/10 border border-gb-purple/20 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-gb-purple uppercase tracking-widest mb-1">Shared Hash</div>
                  <div className="font-mono text-lg font-bold flex items-center justify-between">
                    <span className="tabular-nums text-gb-purple">0x{result.digest.toString(16).toUpperCase()}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">({result.digest} decimal)</span>
                  </div>
                </div>
                
                <p className="mt-4 text-[10px] text-muted-foreground font-mono leading-relaxed italic">
                  Observation: For <MB>{`n = ${nBits}`}</MB>, the expected number of hashes is <MB>{`2^{${nBits}/2} \\approx ${Math.round(birthday)}`}</MB>. 
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
