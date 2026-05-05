import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { M } from "@/components/Math";
import { Eye, EyeOff, ShieldAlert, CheckCircle2, ChevronRight, Lock } from "lucide-react";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

interface LogEntry {
  step: string;
  detail: string;
}

interface OTResult {
  received: number;
  hidden: string;
  log: LogEntry[];
  c0_repr: string;
  c1_repr: string;
  cheat_result: number | null;
  error?: string;
}

export function PA18() {
  const [m0, setM0] = useState("42");
  const [m1, setM1] = useState("99");
  const [result, setResult] = useState<OTResult | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCheat, setShowCheat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runOT(c: number) {
    setLoading(true);
    setError(null);
    setResult(null);
    setChoice(c);
    setShowCheat(false);
    try {
      const res = await fetch("/api/pa18/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: c, m0: parseInt(m0), m1: parseInt(m1) }),
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

  return (
    <div className="space-y-6">
      {/* Alice's Panel */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 border-border/50 bg-muted/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gb-purple/40" />
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-muted-foreground">
              Alice (Sender) — Hidden from Bob
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>m₀ (Secret)</Label>
              <Input
                type="number"
                value={m0}
                onChange={(e) => { setM0(e.target.value); setResult(null); }}
                className="font-mono"
              />
            </div>
            <div>
              <Label>m₁ (Secret)</Label>
              <Input
                type="number"
                value={m1}
                onChange={(e) => { setM1(e.target.value); setResult(null); }}
                className="font-mono"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 italic font-mono">
            Alice holds both messages. She will learn nothing about Bob's choice bit.
          </p>
        </Card>

        {/* Bob's Panel */}
        <Card className="p-5 border-gb-aqua/30 bg-gb-aqua/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gb-aqua/60" />
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-4 h-4 text-gb-aqua" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-gb-aqua">
              Bob (Receiver) — Choose
            </h3>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => runOT(0)}
              disabled={loading}
              className="flex-1 bg-gb-aqua/20 hover:bg-gb-aqua/40 text-gb-aqua border border-gb-aqua/30 font-bold text-sm h-14"
            >
              Choose 0
              <br />
              <span className="text-[10px] opacity-70 font-normal">Receive m₀</span>
            </Button>
            <Button
              onClick={() => runOT(1)}
              disabled={loading}
              className="flex-1 bg-gb-purple/20 hover:bg-gb-purple/40 text-gb-purple border border-gb-purple/30 font-bold text-sm h-14"
            >
              Choose 1
              <br />
              <span className="text-[10px] opacity-70 font-normal">Receive m₁</span>
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 italic font-mono">
            Bob receives only <M>{"m_c"}</M>. Alice learns nothing about <M>{"c"}</M>.
          </p>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-gb-red/10 border border-gb-red/30 text-gb-red font-mono text-xs">
          {error}
        </div>
      )}

      {/* Protocol Trace */}
      {result && !result.error && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Step-by-Step Log */}
          <Card className="p-4 border-border/50">
            <Label>Protocol Trace</Label>
            <div className="mt-2 space-y-2">
              {result.log.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 group">
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <ChevronRight className="w-3 h-3 text-gb-aqua" />
                    <span className="font-mono text-[9px] bg-gb-aqua/10 text-gb-aqua px-1.5 py-0.5 rounded uppercase tracking-tighter whitespace-nowrap">
                      {entry.step}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground leading-relaxed break-all">
                    {entry.detail}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Outcome */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5 border-2 border-gb-green/30 bg-gb-green/5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-gb-green" />
                <Label className="mb-0">Bob Received</Label>
              </div>
              <div className="text-4xl font-black font-mono text-gb-green mb-1">
                {result.received}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                m<sub>{choice}</sub> = {result.received} ✓
              </div>
            </Card>

            <Card className="p-5 border-2 border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <EyeOff className="w-5 h-5 text-muted-foreground" />
                <Label className="mb-0">The Other Message</Label>
              </div>
              <div className="text-4xl font-black font-mono text-muted-foreground mb-1">
                ??
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                m<sub>{1 - (choice ?? 0)}</sub> is hidden — Bob cannot learn this.
              </div>
            </Card>
          </div>

          {/* Cheat Attempt */}
          <Card className="p-4 border-gb-yellow/30 bg-gb-yellow/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-gb-yellow" />
                <h4 className="text-xs font-bold font-mono uppercase tracking-widest text-gb-yellow">
                  Cheat Attempt
                </h4>
              </div>
              <Button
                onClick={() => setShowCheat(true)}
                size="sm"
                variant="outline"
                className="text-gb-yellow border-gb-yellow/30 h-7 text-[10px]"
              >
                Try to Decrypt C<sub>{1 - (choice ?? 0)}</sub>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mb-3">
              Bob tries to decrypt the ciphertext for the unchosen message using his (wrong) key.
            </p>
            {showCheat && (
              <div className="p-3 rounded-lg bg-gb-red/10 border border-gb-red/30 animate-in fade-in duration-300">
                <div className="font-mono text-xs text-gb-red font-bold mb-1">
                  Decrypted garbage: {result.cheat_result}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  Expected m<sub>{1 - (choice ?? 0)}</sub> = {choice === 0 ? m1 : m0},
                  but got <span className="text-gb-red font-bold">{result.cheat_result}</span>.{" "}
                  {result.cheat_result !== parseInt(choice === 0 ? m1 : m0)
                    ? "✗ Attack failed — the wrong sk produces a random group element."
                    : "Lucky coincidence (extremely rare)."}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
