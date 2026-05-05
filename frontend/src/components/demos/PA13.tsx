import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { M, MB } from "@/components/Math";
import { Clock, ShieldCheck, ShieldAlert, FlaskConical, ChevronRight } from "lucide-react";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground bg-muted/50 px-1 rounded">{children}</span>;
}

interface RoundInfo {
  a: string;
  d: string;
  s: number;
  x_initial: string;
  sequence: string[];
  verdict: string;
}

interface TestResult {
  is_prime: boolean;
  rounds: RoundInfo[];
  reason: string;
  time_ms: number;
  error?: string;
}

const EXAMPLES = [
  { label: "561 (Carmichael)", n: "561" },
  { label: "512-bit Prime", n: "13362651063587830431715478290150212937793985074086413301730461282084087160121037033412166392919989142924170782821759924076032490760210233245114832827179923" },
  { label: "512-bit Composite", n: "13362651063587830431715478290150212937793985074086413301730461282084087160121037033412166392919989142924170782821759924076032490760210233245114832827179925" },
];

export function PA13() {
  const [n, setN] = useState("561");
  const [rounds, setRounds] = useState(5);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runTest() {
    setLoading(true);
    try {
      const res = await fetch("/api/pa13/miller_rabin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, rounds }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ is_prime: false, rounds: [], reason: "", time_ms: 0, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-muted/20 border-border/50">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label>Number to Test (n)</Label>
              <Input 
                value={n} 
                onChange={(e) => setN(e.target.value.replace(/\D/g, "").slice(0, 200))} // Allow more than 20 for the big examples
                className="font-mono text-sm tracking-tight"
                placeholder="Enter an integer..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map(ex => (
                <Button 
                  key={ex.label} 
                  variant="outline" 
                  size="sm" 
                  className="text-[10px] h-7"
                  onClick={() => setN(ex.n)}
                >
                  {ex.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Security Rounds (k): {rounds}</Label>
              <Slider 
                value={[rounds]} 
                min={1} 
                max={40} 
                step={1} 
                onValueChange={(v) => setRounds(v[0])} 
                className="mt-3"
              />
              <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                Error probability: <M>{`P(\\text{fail}) \\le 4^{-${rounds}} \\approx ${(1 / Math.pow(4, rounds)).toExponential(2)}`}</M>
              </p>
            </div>
            <Button 
              onClick={runTest} 
              disabled={loading || !n} 
              className="w-full bg-gb-purple hover:bg-gb-purple/90 text-white font-bold"
            >
              {loading ? "Computing Miller-Rabin..." : "Run Primality Test"}
            </Button>
          </div>
        </div>
      </Card>

      {result && !result.error && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <Card className={`p-6 border-2 ${result.is_prime ? "border-gb-green bg-gb-green/5" : "border-gb-red bg-gb-red/5"}`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${result.is_prime ? "bg-gb-green/20 text-gb-green" : "bg-gb-red/20 text-gb-red"}`}>
                  {result.is_prime ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
                </div>
                <div>
                  <h2 className={`text-2xl font-black font-mono uppercase tracking-tighter ${result.is_prime ? "text-gb-green" : "text-gb-red"}`}>
                    {result.is_prime ? "PROBABLY PRIME" : "COMPOSITE"}
                  </h2>
                  <p className="text-sm font-mono text-muted-foreground">{result.reason}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="font-mono gap-1 text-xs px-3 py-1">
                  <Clock className="w-3 h-3" /> {result.time_ms.toFixed(2)} ms
                </Badge>
                <Badge variant="outline" className="font-mono gap-1 text-xs px-3 py-1">
                  <FlaskConical className="w-3 h-3" /> {result.rounds.length} rounds
                </Badge>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Label>Witness Log (Round by Round)</Label>
            <div className="grid gap-3">
              {result.rounds.map((r, i) => (
                <Card key={i} className="p-4 border-border/50 bg-background/50 hover:bg-background transition-colors overflow-hidden">
                  <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div className="space-y-2 flex-grow">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-gb-purple/20 text-gb-purple border-none rounded text-[10px]">Round {i + 1}</Badge>
                        <Mono>a = {r.a}</Mono>
                        <span className="text-[10px] text-muted-foreground font-mono">witness candidate</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 items-center text-[11px] font-mono">
                        <span className="text-muted-foreground">Initial Test:</span>
                        <M>{`a^d \\pmod n = ${r.x_initial}`}</M>
                        {r.x_initial === "1" || r.x_initial === (BigInt(n) - 1n).toString() ? (
                          <Badge variant="outline" className="text-gb-green border-gb-green/30 h-5 text-[9px]">Passed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gb-yellow border-gb-yellow/30 h-5 text-[9px]">Continuing...</Badge>
                        )}
                      </div>

                      {r.sequence.length > 1 && (
                        <div className="space-y-1">
                          <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest">Square Sequence</div>
                          <div className="flex flex-wrap items-center gap-2">
                            {r.sequence.map((x, idx) => (
                              <React.Fragment key={idx}>
                                {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
                                <div className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                                  x === (BigInt(n) - 1n).toString() ? "bg-gb-green/10 border-gb-green/30 text-gb-green" : "bg-muted border-border"
                                }`}>
                                  {x}
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-[10px] font-bold uppercase tracking-widest ${
                        r.verdict.includes("composite") ? "text-gb-red" : "text-gb-green"
                      }`}>
                        {r.verdict}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {result?.error && (
        <div className="p-4 rounded-lg bg-gb-red/10 border border-gb-red/30 text-gb-red font-mono text-sm">
          <ShieldAlert className="w-5 h-5 inline mr-2 align-text-bottom" />
          {result.error}
        </div>
      )}

      {!result && !loading && (
        <Card className="p-12 border-dashed border-2 flex flex-col items-center justify-center text-center opacity-40">
          <FlaskConical className="w-12 h-12 mb-4" />
          <h3 className="font-mono font-bold uppercase tracking-widest text-sm">System Idle</h3>
          <p className="text-xs max-w-[300px] mt-2">Enter a candidate integer above and run the Miller-Rabin probabilistic test to verify primality.</p>
        </Card>
      )}
    </div>
  );
}
