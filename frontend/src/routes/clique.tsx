import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowLeft, ArrowLeftRight, ShieldAlert } from "lucide-react";
import { M, MB } from "@/components/Math";

export const Route = createFileRoute("/clique")({
  head: () => ({
    meta: [
      { title: "PA#0 — Minicrypt Scaffolding · PoIS" },
      { name: "description", content: "Interactive explorer of the Minicrypt clique: pick any primitive and reduce it to any other." },
    ],
  }),
  component: CliquePage,
});

const PRIMS = ["OWF", "PRG", "PRF", "SKE", "MAC", "CRHF"] as const;
type Prim = typeof PRIMS[number];

type ChainStep = { func: string; input: string; output: string };
type ChainResponse = { build_steps: ChainStep[]; reduce_steps: ChainStep[] };

const REDUCTIONS: Record<Prim, Record<Prim, { steps: string[]; refs: string }>> = {
  OWF: {
    OWF: { steps: ["Identity."], refs: "trivial" },
    PRG: { steps: ["Apply HILL theorem.", "Hardcore bit via Goldreich–Levin."], refs: "PA#1" },
    PRF: { steps: ["OWF → PRG (HILL).", "PRG → PRF (GGM tree, PA#2)."], refs: "PA#1, PA#2" },
    SKE: { steps: ["OWF → PRF.", "PRF + IV → CPA-secure SKE."], refs: "PA#1–3" },
    MAC: { steps: ["OWF → PRF.", "PRF as a fixed-length MAC."], refs: "PA#5" },
    CRHF: { steps: ["Open in standard model from OWFs alone (separation, Simon)."], refs: "stub" },
  },
  PRG: {
    OWF: { steps: ["A PRG is itself a OWF (length-doubling, hard to invert)."], refs: "PA#1" },
    PRG: { steps: ["Identity."], refs: "trivial" },
    PRF: { steps: ["GGM binary tree of depth n with PRG at each node."], refs: "PA#2" },
    SKE: { steps: ["Use PRG to derive a one-time pad of message length."], refs: "PA#3" },
    MAC: { steps: ["PRG → PRF → MAC."], refs: "PA#2, PA#5" },
    CRHF: { steps: ["Black-box separation; no construction known."], refs: "stub" },
  },
  PRF: {
    OWF: { steps: ["PRF on a single point is a OWF."], refs: "PA#1" },
    PRG: { steps: ["Evaluate PRF on disjoint inputs."], refs: "PA#1" },
    PRF: { steps: ["Identity."], refs: "trivial" },
    SKE: { steps: ["Encrypt: c = (r, F_k(r) ⊕ m) — IND-CPA from PRF."], refs: "PA#3" },
    MAC: { steps: ["MAC(k, m) = F_k(m). Selectively secure for fixed-length m."], refs: "PA#5" },
    CRHF: { steps: ["No black-box reduction."], refs: "stub" },
  },
  SKE: {
    OWF: { steps: ["A CPA-secure SKE implies a OWF."], refs: "PA#1" },
    PRG: { steps: ["SKE → OWF → PRG (HILL)."], refs: "PA#1" },
    PRF: { steps: ["Long path via OWF → PRG → PRF."], refs: "PA#1–2" },
    SKE: { steps: ["Identity."], refs: "trivial" },
    MAC: { steps: ["SKE → OWF → PRF → MAC."], refs: "PA#5" },
    CRHF: { steps: ["Black-box separation."], refs: "stub" },
  },
  MAC: {
    OWF: { steps: ["A secure MAC implies a OWF."], refs: "PA#1" },
    PRG: { steps: ["MAC → OWF → PRG."], refs: "PA#1" },
    PRF: { steps: ["MAC → OWF → PRG → PRF."], refs: "PA#1–2" },
    SKE: { steps: ["MAC → OWF → … → SKE."], refs: "PA#3" },
    MAC: { steps: ["Identity."], refs: "trivial" },
    CRHF: { steps: ["Black-box separation."], refs: "stub" },
  },
  CRHF: {
    OWF: { steps: ["A CRHF is a OWF (collision implies inversion of compression)."], refs: "PA#1" },
    PRG: { steps: ["CRHF → OWF → PRG."], refs: "PA#1" },
    PRF: { steps: ["CRHF → OWF → … → PRF."], refs: "PA#2" },
    SKE: { steps: ["CRHF → OWF → … → SKE."], refs: "PA#3" },
    MAC: { steps: ["CRHF + key → HMAC-style PRF → MAC."], refs: "PA#10" },
    CRHF: { steps: ["Identity."], refs: "trivial" },
  },
};

function Mono({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <span className={`font-mono text-[11px] break-all ${className}`}>{children}</span>;
}

function CliquePage() {
  const [foundation, setFoundation] = useState<"AES" | "DLP">("AES");
  const [from, setFrom] = useState<Prim>("OWF");
  const [to, setTo] = useState<Prim>("PRF");
  const [bidi, setBidi] = useState(false);
  const [keyInput, setKeyInput] = useState("secret");
  const [msgInput, setMsgInput] = useState("hello");
  
  const [chain, setChain] = useState<ChainResponse | null>(null);

  useEffect(() => {
    fetch("/api/pa0/chain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        foundation,
        source_prim: from,
        target_prim: to,
        key: keyInput,
        message: msgInput,
        bidi
      })
    })
    .then(r => r.json())
    .then(data => setChain(data))
    .catch(console.error);
  }, [foundation, from, to, bidi, keyInput, msgInput]);

  const fwd = REDUCTIONS[from][to];
  const bwd = REDUCTIONS[to][from];
  
  const isStub = fwd.refs === "stub" || (bidi && bwd.refs === "stub");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="font-mono text-xs text-gb-aqua">// PA#0</div>
          <h1 className="text-4xl font-bold">Minicrypt Scaffolding</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Interactive data-flow explorer. Select your foundation, trace the bits, and watch reductions happen live.
          </p>
        </div>
      </div>

      {/* TIER 1: Controls */}
      <Card className="p-5 border-2 border-border/50 bg-muted/20">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-8">
          <div className="space-y-5">
            <div>
              <div className="font-mono text-[10px] font-bold text-muted-foreground mb-2">1. FOUNDATION LAYER</div>
              <div className="flex bg-muted rounded-md p-1 border">
                <Button size="sm" variant={foundation === "AES" ? "default" : "ghost"} className="flex-1 font-mono text-xs" onClick={() => setFoundation("AES")}>
                  AESFoundation
                </Button>
                <Button size="sm" variant={foundation === "DLP" ? "default" : "ghost"} className="flex-1 font-mono text-xs" onClick={() => setFoundation("DLP")}>
                  DLPFoundation
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="font-mono text-[10px] font-bold text-muted-foreground mb-1">2. LIVE DATA</div>
              <div>
                <label className="font-mono text-[10px] text-muted-foreground">Key Input (k)</label>
                <Input className="font-mono text-xs h-8 bg-background" value={keyInput} onChange={e => setKeyInput(e.target.value)} />
              </div>
              <div>
                <label className="font-mono text-[10px] text-muted-foreground">Message Input (x / m)</label>
                <Input className="font-mono text-xs h-8 bg-background" value={msgInput} onChange={e => setMsgInput(e.target.value)} />
              </div>
            </div>
          </div>
          
          <div>
             <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <div className="font-mono text-[10px] font-bold text-muted-foreground mb-2">3. SOURCE PRIMITIVE (A)</div>
                  <div className="grid grid-cols-3 gap-2">
                    {PRIMS.map((p) => (
                      <Button key={p} size="sm" variant={from === p ? "default" : "outline"} onClick={() => setFrom(p)} className="font-mono text-xs">
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] font-bold text-muted-foreground mb-2">4. TARGET PRIMITIVE (B)</div>
                  <div className="grid grid-cols-3 gap-2">
                    {PRIMS.map((p) => (
                      <Button key={p} size="sm" variant={to === p ? "default" : "outline"} onClick={() => setTo(p)} className="font-mono text-xs">
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-3 bg-muted/50 p-2 rounded-lg border">
                <span className="rounded-md border border-gb-yellow/50 bg-gb-yellow/10 px-3 py-1 font-mono text-xs font-bold text-gb-yellow">
                  {from}
                </span>
                <Button size="sm" variant={bidi ? "default" : "outline"} onClick={() => setBidi(!bidi)} className="px-3 h-8">
                  {bidi ? <ArrowLeftRight className="w-3 h-3 mr-2" /> : <ArrowRight className="w-3 h-3 mr-2" />}
                  <span className="text-[10px] uppercase font-bold tracking-wider">{bidi ? "Bidirectional" : "Forward"}</span>
                </Button>
                <span className="rounded-md border border-gb-aqua/50 bg-gb-aqua/10 px-3 py-1 font-mono text-xs font-bold text-gb-aqua">
                  {to}
                </span>
              </div>
          </div>
        </div>
      </Card>

      {/* TIER 2: Two-Column Data Flow */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Column 1: Build Panel */}
        <Card className="p-0 overflow-hidden flex flex-col h-[400px]">
          <div className="bg-muted px-4 py-2 border-b flex justify-between items-center">
            <span className="font-mono text-xs font-bold uppercase">Column 1 | Build Panel</span>
            <span className="font-mono text-[10px] text-gb-yellow px-2 py-0.5 rounded-full bg-gb-yellow/10 border border-gb-yellow/20">Foundation ⟶ {from}</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-background/50">
             {chain?.build_steps.map((step, idx) => (
               <div key={idx} className="bg-card border border-border/60 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-gb-purple font-mono font-bold text-xs mb-2">ƒ: {step.func}</div>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[50px_1fr] gap-2 items-start">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Input</span>
                      <Mono className="bg-muted/50 px-2 py-1 rounded border border-border/40 inline-block">{step.input}</Mono>
                    </div>
                    <div className="grid grid-cols-[50px_1fr] gap-2 items-start">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Output</span>
                      <Mono className="bg-gb-aqua/10 text-gb-aqua px-2 py-1 rounded border border-gb-aqua/20 inline-block font-bold">{step.output}</Mono>
                    </div>
                  </div>
               </div>
             ))}
          </div>
        </Card>

        {/* Column 2: Reduce Panel */}
        <Card className="p-0 overflow-hidden flex flex-col h-[400px]">
          <div className="bg-muted px-4 py-2 border-b flex justify-between items-center">
            <span className="font-mono text-xs font-bold uppercase">Column 2 | Reduce Panel</span>
            <span className="font-mono text-[10px] text-gb-aqua px-2 py-0.5 rounded-full bg-gb-aqua/10 border border-gb-aqua/20">
              {bidi ? `${to} ⟶ ${from}` : `${from} ⟶ ${to}`}
            </span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-background/50">
            {isStub ? (
               <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-80 bg-muted/20 rounded-lg border border-dashed">
                 <ShieldAlert className="w-12 h-12 text-muted-foreground/50" />
                 <div>
                   <div className="font-mono font-bold text-muted-foreground">Not implemented yet (due: PA#N)</div>
                   <div className="text-[11px] mt-1 max-w-[250px] mx-auto text-muted-foreground/80">There is no known black-box reduction or this flow is unsupported. Try another path.</div>
                 </div>
               </div>
            ) : (
               chain?.reduce_steps.map((step, idx) => (
                 <div key={idx} className="bg-card border border-border/60 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-gb-orange font-mono font-bold text-xs mb-2">ƒ: {step.func}</div>
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-[50px_1fr] gap-2 items-start">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Input</span>
                        <Mono className="bg-muted/50 px-2 py-1 rounded border border-border/40 inline-block">{step.input}</Mono>
                      </div>
                      <div className="grid grid-cols-[50px_1fr] gap-2 items-start">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Output</span>
                        <Mono className="bg-gb-aqua/10 text-gb-aqua px-2 py-1 rounded border border-gb-aqua/20 inline-block font-bold">{step.output}</Mono>
                      </div>
                    </div>
                 </div>
               ))
            )}
          </div>
        </Card>
      </div>

      {/* TIER 3: Proof Panel */}
      <div className="pt-2">
        <div className="font-mono text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-wider">Formal Proof Summary</div>
        <div className={`grid gap-4 ${bidi ? "md:grid-cols-2" : "grid-cols-1"}`}>
          <ProofCard from={from} to={to} reduction={fwd} dir="fwd" />
          {bidi && <ProofCard from={to} to={from} reduction={bwd} dir="bwd" />}
        </div>
      </div>
    </div>
  );
}

function ProofCard({
  from, to, reduction, dir,
}: {
  from: Prim; to: Prim;
  reduction: { steps: string[]; refs: string };
  dir: "fwd" | "bwd";
}) {
  return (
    <Card className={`p-5 border-l-4 ${dir === "fwd" ? "border-l-gb-aqua" : "border-l-gb-orange"}`}>
      <div className="flex items-center gap-2 mb-3">
        {dir === "fwd" ? <ArrowRight className="text-gb-aqua h-4 w-4" /> : <ArrowLeft className="text-gb-orange h-4 w-4" />}
        <div className="font-mono text-xs text-muted-foreground font-bold tracking-wider">REDUCTION THEOREM</div>
        <div className="font-mono text-sm ml-auto bg-muted px-2 py-0.5 rounded font-bold">{from} ⟶ {to}</div>
      </div>
      <ol className="space-y-2 text-sm">
        {reduction.steps.map((s, i) => (
          <li key={i} className="flex gap-2 items-start">
            <span className="font-mono text-muted-foreground shrink-0 text-xs mt-0.5">{i + 1}.</span>
            <span className="leading-snug">{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 pt-3 border-t text-[11px] font-mono text-muted-foreground">Implemented in: <span className="font-bold text-foreground">{reduction.refs}</span></div>
      {reduction.refs === "stub" && (
        <div className="mt-2 rounded-md border border-gb-orange/40 bg-gb-orange/10 px-2 py-1.5 text-[11px] text-gb-orange font-mono">
          ⚠ Separation result — no generic black-box construction is known.
        </div>
      )}
      {from === to && (
        <div className="mt-2 text-[11px] text-muted-foreground italic">
          Identity transformation — nothing to reduce.
        </div>
      )}
    </Card>
  );
}
