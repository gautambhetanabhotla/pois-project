import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp, EyeOff, Crown, Equal, Cpu } from "lucide-react";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </div>
  );
}

const GATE_COLORS: Record<string, string> = {
  AND: "bg-gb-green/10 text-gb-green border-gb-green/20",
  XOR: "bg-gb-yellow/10 text-gb-yellow border-gb-yellow/20",
  NOT: "bg-gb-red/10 text-gb-red border-gb-red/20",
};

interface GateTrace {
  gate_idx: number;
  gate_type: string;
  input_wires: number[];
  input_values: number[];
  output_wire: number;
  output_value: number;
}

interface Result {
  x_greater: boolean;
  y_greater: boolean;
  equal: boolean;
  verdict: string;
  gate_trace: GateTrace[];
  total_gates: number;
  x_bits: number[];
  y_bits: number[];
  output_wire: number;
  error?: string;
}

export function PA20() {
  const [x, setX] = useState(7);
  const [y, setY] = useState(12);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  // Animation state
  const [animatedGates, setAnimatedGates] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnimatedGates(0);
    setShowTrace(false);
    if (animRef.current) clearInterval(animRef.current);

    try {
      const res = await fetch("/api/pa20/millionaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setResult(d);

      // Animate gate progress
      let count = 0;
      animRef.current = setInterval(() => {
        count += 1;
        setAnimatedGates(count);
        if (count >= d.total_gates) {
          if (animRef.current) clearInterval(animRef.current);
        }
      }, 60);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current); }, []);

  const verdictColor = result?.x_greater
    ? "border-gb-purple text-gb-purple bg-gb-purple/5"
    : result?.y_greater
      ? "border-gb-aqua text-gb-aqua bg-gb-aqua/5"
      : "border-gb-yellow text-gb-yellow bg-gb-yellow/5";

  const VerdictIcon = result?.equal ? Equal : Crown;

  return (
    <div className="space-y-6">
      {/* Panels */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Alice's Panel */}
        <Card className="p-5 border-gb-purple/30 bg-gb-purple/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-gb-purple" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-gb-purple">
                Alice — Wealth x
              </h3>
            </div>
            <Badge variant="outline" className="text-gb-purple border-gb-purple/30 text-[10px]">
              Hidden from Bob
            </Badge>
          </div>
          <input
            type="range" min={1} max={100} value={x}
            onChange={(e) => { setX(Number(e.target.value)); setResult(null); }}
            className="w-full accent-purple-400"
          />
          <div className="flex justify-between items-center">
            <span className="font-mono text-3xl font-black text-gb-purple">{x}</span>
            <div className="text-[10px] font-mono text-muted-foreground">
              {result?.x_bits && (
                <span>bits: [{result.x_bits.join(", ")}] (LSB first)</span>
              )}
            </div>
          </div>
        </Card>

        {/* Bob's Panel */}
        <Card className="p-5 border-gb-aqua/30 bg-gb-aqua/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-gb-aqua" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-gb-aqua">
                Bob — Wealth y
              </h3>
            </div>
            <Badge variant="outline" className="text-gb-aqua border-gb-aqua/30 text-[10px]">
              Hidden from Alice
            </Badge>
          </div>
          <input
            type="range" min={1} max={100} value={y}
            onChange={(e) => { setY(Number(e.target.value)); setResult(null); }}
            className="w-full accent-cyan-400"
          />
          <div className="flex justify-between items-center">
            <span className="font-mono text-3xl font-black text-gb-aqua">{y}</span>
            <div className="text-[10px] font-mono text-muted-foreground">
              {result?.y_bits && (
                <span>bits: [{result.y_bits.join(", ")}] (LSB first)</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Button
        onClick={compute}
        disabled={loading}
        className="w-full bg-gradient-to-r from-gb-purple to-gb-aqua text-white font-bold text-sm gap-2 h-12"
      >
        <Cpu className="w-4 h-4" />
        {loading ? "Evaluating Circuit..." : "Who is Richer?"}
      </Button>

      {error && (
        <div className="p-3 rounded-lg bg-gb-red/10 border border-gb-red/30 text-gb-red font-mono text-xs">
          {error}
        </div>
      )}

      {result && !result.error && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Gate Progress */}
          <Card className="p-4 border-border/50">
            <div className="flex justify-between items-center mb-2">
              <Label>Circuit Evaluation Progress</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {Math.min(animatedGates, result.total_gates)} / {result.total_gates} gates
              </span>
            </div>
            <Progress value={(Math.min(animatedGates, result.total_gates) / result.total_gates) * 100} className="h-2" />
            <div className="flex gap-3 mt-2">
              {["AND", "XOR", "NOT"].map(t => {
                const count = result.gate_trace.filter(g => g.gate_type === t).length;
                return (
                  <span key={t} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${GATE_COLORS[t]}`}>
                    {t}: {count}
                  </span>
                );
              })}
            </div>
          </Card>

          {/* Verdict */}
          {animatedGates >= result.total_gates && (
            <Card className={`p-6 border-2 text-center ${verdictColor} animate-in zoom-in-95 duration-500`}>
              <VerdictIcon className="w-10 h-10 mx-auto mb-3 opacity-80" />
              <div className="text-2xl font-black font-mono tracking-wide">{result.verdict}</div>
              <p className="text-[10px] mt-2 opacity-70 italic font-mono">
                Actual values x and y were NEVER revealed to the other party.
                Output wire W{result.output_wire} = {result.x_greater ? 1 : 0}.
              </p>
            </Card>
          )}

          {/* Privacy summary */}
          {animatedGates >= result.total_gates && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 border-gb-purple/20 bg-muted/10">
                <Label>What Alice Learns</Label>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  Alice sees only the final result: <span className="text-foreground font-bold">"{result.verdict}"</span>.
                  She does NOT learn Bob's wealth y={y}.
                </p>
              </Card>
              <Card className="p-4 border-gb-aqua/20 bg-muted/10">
                <Label>What Bob Learns</Label>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  Bob sees only the final result: <span className="text-foreground font-bold">"{result.verdict}"</span>.
                  He does NOT learn Alice's wealth x={x}.
                </p>
              </Card>
            </div>
          )}

          {/* Circuit Trace — expandable */}
          <Card className="border-border/50">
            <button
              onClick={() => setShowTrace(v => !v)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
                Circuit Trace ({result.total_gates} gates)
              </span>
              {showTrace ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showTrace && (
              <div className="border-t border-border/50 p-4 max-h-64 overflow-y-auto">
                <table className="w-full text-[9px] font-mono">
                  <thead>
                    <tr className="text-muted-foreground text-left border-b border-border/30 pb-1">
                      <th className="py-1 pr-3">Gate</th>
                      <th className="pr-3">Type</th>
                      <th className="pr-3">Inputs (wire=val)</th>
                      <th>Out (wire=val)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.gate_trace.map((g) => (
                      <tr key={g.gate_idx} className="border-b border-border/10 last:border-0">
                        <td className="py-0.5 pr-3 text-muted-foreground">G{g.gate_idx}</td>
                        <td className="pr-3">
                          <span className={`px-1 rounded text-[8px] border ${GATE_COLORS[g.gate_type]}`}>
                            {g.gate_type}
                          </span>
                        </td>
                        <td className="pr-3 text-muted-foreground">
                          {g.input_wires.map((w, i) => `W${w}=${g.input_values[i]}`).join(", ")}
                        </td>
                        <td className={g.output_value === 1 ? "text-gb-green font-bold" : "text-muted-foreground"}>
                          W{g.output_wire}={g.output_value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
