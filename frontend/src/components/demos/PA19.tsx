import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { M } from "@/components/Math";
import { CheckCircle2, XCircle, ChevronRight, Eye, EyeOff, Play } from "lucide-react";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </div>
  );
}

function BitButton({
  value, selected, onSelect, color
}: {
  value: 0 | 1; selected: boolean; onSelect: () => void; color: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-14 h-14 rounded-xl font-black text-2xl font-mono border-2 transition-all ${
        selected
          ? `${color} scale-105 shadow-lg`
          : "border-border/40 text-muted-foreground hover:border-border"
      }`}
    >
      {value}
    </button>
  );
}

interface LogEntry { actor: string; step: string; detail: string; }
interface ANDResult {
  result: number;
  log: LogEntry[];
  alice_learns: string;
  bob_learns: string;
  ot_m0: number;
  ot_m1: number;
  error?: string;
}
interface BatchRow { a: number; b: number; expected: number; got: number; ok: boolean; }

const ACTOR_STYLES: Record<string, string> = {
  "Alice":     "text-gb-purple border-gb-purple/20 bg-gb-purple/5",
  "Bob":       "text-gb-aqua border-gb-aqua/20 bg-gb-aqua/5",
  "Bob→Alice": "text-gb-yellow border-gb-yellow/20 bg-gb-yellow/5",
  "Alice→Bob": "text-gb-green border-gb-green/20 bg-gb-green/5",
  "Both":      "text-foreground border-border/30 bg-muted/20",
};

export function PA19() {
  const [a, setA] = useState<0 | 1>(1);
  const [b, setB] = useState<0 | 1>(0);
  const [result, setResult] = useState<ANDResult | null>(null);
  const [batchRows, setBatchRows] = useState<BatchRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    setResult(null);
    setBatchRows(null);
    try {
      const res = await fetch("/api/pa19/and", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a, b }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setResult(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runAll() {
    setBatchLoading(true);
    setError(null);
    setBatchRows(null);
    setResult(null);
    try {
      const res = await fetch("/api/pa19/and_all", { method: "POST" });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setBatchRows(d.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Input Panels */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Alice */}
        <Card className="p-5 border-gb-purple/30 bg-gb-purple/5 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gb-purple/40" />
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gb-purple" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-gb-purple">
              Alice — Input a
            </h3>
          </div>
          <div className="flex gap-3">
            <BitButton value={0} selected={a === 0} onSelect={() => setA(0)}
              color="border-gb-purple text-gb-purple bg-gb-purple/10" />
            <BitButton value={1} selected={a === 1} onSelect={() => setA(1)}
              color="border-gb-purple text-gb-purple bg-gb-purple/10" />
          </div>
          <p className="text-[10px] text-muted-foreground italic font-mono">
            Alice contributes her private bit. Bob will NOT learn <M>{"a"}</M>.
          </p>
        </Card>

        {/* Bob */}
        <Card className="p-5 border-gb-aqua/30 bg-gb-aqua/5 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gb-aqua/40" />
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gb-aqua" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-gb-aqua">
              Bob — Input b (OT choice)
            </h3>
          </div>
          <div className="flex gap-3">
            <BitButton value={0} selected={b === 0} onSelect={() => setB(0)}
              color="border-gb-aqua text-gb-aqua bg-gb-aqua/10" />
            <BitButton value={1} selected={b === 1} onSelect={() => setB(1)}
              color="border-gb-aqua text-gb-aqua bg-gb-aqua/10" />
          </div>
          <p className="text-[10px] text-muted-foreground italic font-mono">
            Bob's bit is his OT choice. Alice will NOT learn <M>{"b"}</M>.
          </p>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={compute}
          disabled={loading}
          className="flex-1 bg-gb-purple hover:bg-gb-purple/90 text-white font-bold gap-2"
        >
          <Play className="w-4 h-4" />
          {loading ? "Running OT..." : `Compute ${a} AND ${b}`}
        </Button>
        <Button
          onClick={runAll}
          disabled={batchLoading}
          variant="outline"
          className="border-gb-yellow/40 text-gb-yellow hover:bg-gb-yellow/5 font-bold gap-2"
        >
          {batchLoading ? "Running..." : "Run All 4"}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-gb-red/10 border border-gb-red/30 text-gb-red font-mono text-xs">
          {error}
        </div>
      )}

      {/* Single Result + Trace */}
      {result && !result.error && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* OT Setup Summary */}
          <Card className="p-4 border-border/50 bg-muted/10">
            <Label>OT Setup — How Secure AND Works</Label>
            <p className="text-[10px] font-mono text-muted-foreground mt-1 leading-relaxed">
              Alice sets OT messages <M>{"(m_0, m_1) = (0, a)"}</M>.
              Bob's choice bit is <M>{"b"}</M>.
              Bob receives <M>{"m_b = b \\cdot a = a \\wedge b"}</M> via OT without Alice knowing <M>{"b"}</M>.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-[10px] font-mono">
              <div className="p-2 rounded bg-gb-purple/5 border border-gb-purple/20">
                <span className="text-gb-purple font-bold">OT m₀</span> = {result.ot_m0}
              </div>
              <div className="p-2 rounded bg-gb-purple/5 border border-gb-purple/20">
                <span className="text-gb-purple font-bold">OT m₁</span> = {result.ot_m1}
              </div>
            </div>
          </Card>

          {/* Protocol Log */}
          <Card className="p-4 border-border/50">
            <Label>Protocol Transcript</Label>
            <div className="mt-2 space-y-2">
              {result.log.map((entry, i) => {
                const style = ACTOR_STYLES[entry.actor] || "text-foreground";
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border ${style}`}>
                      {entry.actor}
                    </div>
                    <div className="flex items-start gap-1.5 flex-1 min-w-0">
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <span className="font-mono text-[9px] font-bold text-foreground">{entry.step}: </span>
                        <span className="font-mono text-[9px] text-muted-foreground break-words">{entry.detail}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Result */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-4 border-2 border-gb-green/30 bg-gb-green/5 col-span-1">
              <Label>Result</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-3xl font-black text-gb-green">{result.result}</span>
                <div className="text-[10px] text-muted-foreground font-mono">
                  <div>{a} AND {b} = {a & b}</div>
                  {result.result === (a & b)
                    ? <div className="text-gb-green flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Correct</div>
                    : <div className="text-gb-red flex items-center gap-1"><XCircle className="w-3 h-3" /> Wrong</div>}
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border/50 col-span-2 space-y-3">
              <Label>Privacy Analysis</Label>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-gb-purple border-gb-purple/30 text-[8px] shrink-0">Alice</Badge>
                <p className="text-[10px] text-muted-foreground font-mono">{result.alice_learns}</p>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-gb-aqua border-gb-aqua/30 text-[8px] shrink-0">Bob</Badge>
                <p className="text-[10px] text-muted-foreground font-mono">{result.bob_learns}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Batch Results (truth table) */}
      {batchRows && (
        <Card className="p-4 border-border/50 animate-in fade-in duration-500">
          <div className="flex items-center justify-between mb-3">
            <Label>AND Truth Table — All 4 Combinations</Label>
            {batchRows.every(r => r.ok) && (
              <Badge className="bg-gb-green text-white text-[9px]">
                <CheckCircle2 className="w-3 h-3 mr-1" /> All Correct
              </Badge>
            )}
          </div>
          <table className="w-full text-center font-mono text-xs">
            <thead>
              <tr className="text-[9px] text-muted-foreground uppercase border-b border-border/50">
                <th className="py-2">a</th>
                <th>b</th>
                <th>Expected (a∧b)</th>
                <th>Got</th>
                <th>✓?</th>
              </tr>
            </thead>
            <tbody>
              {batchRows.map((row, i) => (
                <tr key={i} className="border-b border-border/20 last:border-0">
                  <td className="py-2 font-bold text-gb-purple">{row.a}</td>
                  <td className="font-bold text-gb-aqua">{row.b}</td>
                  <td>{row.expected}</td>
                  <td className={row.ok ? "text-gb-green font-bold" : "text-gb-red font-bold"}>{row.got}</td>
                  <td>
                    {row.ok
                      ? <CheckCircle2 className="w-4 h-4 text-gb-green mx-auto" />
                      : <XCircle className="w-4 h-4 text-gb-red mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
