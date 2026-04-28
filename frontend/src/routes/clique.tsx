import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { M, MB } from "@/components/Math";
import { ArrowRight, ArrowLeft, ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/clique")({
  head: () => ({
    meta: [
      { title: "PA#0 — Minicrypt Clique Explorer · PoIS" },
      { name: "description", content: "Interactive explorer of the Minicrypt clique: pick any primitive and reduce it to any other." },
      { property: "og:title", content: "PA#0 — Minicrypt Clique Explorer" },
      { property: "og:description", content: "Build any primitive from any other in Impagliazzo's Minicrypt." },
    ],
  }),
  component: CliquePage,
});

const PRIMS = ["OWF", "PRG", "PRF", "SKE", "MAC", "CRHF"] as const;
type Prim = typeof PRIMS[number];

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

function CliquePage() {
  const [from, setFrom] = useState<Prim>("OWF");
  const [to, setTo] = useState<Prim>("PRF");
  const [bidi, setBidi] = useState(false);

  const fwd = REDUCTIONS[from][to];
  const bwd = REDUCTIONS[to][from];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="font-mono text-xs text-gb-aqua">// PA#0</div>
      <h1 className="text-4xl font-bold">Minicrypt Clique Explorer</h1>
      <p className="mt-2 text-muted-foreground max-w-2xl">
        Pick a foundation primitive and a target — see the chain of reductions that builds one
        from the other. Toggle bidirectional mode to see both directions of the equivalence.
      </p>

      <Tabs defaultValue="explorer" className="mt-6">
        <TabsList>
          <TabsTrigger value="explorer">Explorer</TabsTrigger>
          <TabsTrigger value="theory">Theory</TabsTrigger>
        </TabsList>

        <TabsContent value="explorer" className="mt-4">
          <Card className="p-5">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-2">FOUNDATION</div>
                <div className="grid grid-cols-3 gap-2">
                  {PRIMS.map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={from === p ? "default" : "outline"}
                      onClick={() => setFrom(p)}
                      className="font-mono"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground mb-2">TARGET</div>
                <div className="grid grid-cols-3 gap-2">
                  {PRIMS.map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={to === p ? "default" : "outline"}
                      onClick={() => setTo(p)}
                      className="font-mono"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="rounded-md border border-gb-yellow/50 bg-gb-yellow/10 px-3 py-2 font-mono text-gb-yellow">
                {from}
              </span>
              {bidi ? <ArrowLeftRight className="text-gb-aqua" /> : <ArrowRight className="text-gb-aqua" />}
              <span className="rounded-md border border-gb-aqua/50 bg-gb-aqua/10 px-3 py-2 font-mono text-gb-aqua">
                {to}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setBidi((b) => !b)} className="ml-2">
                {bidi ? "single" : "bidirectional"}
              </Button>
            </div>
          </Card>

          <div className={`mt-4 grid gap-4 ${bidi ? "md:grid-cols-2" : "grid-cols-1"}`}>
            <ProofCard from={from} to={to} reduction={fwd} dir="fwd" />
            {bidi && <ProofCard from={to} to={from} reduction={bwd} dir="bwd" />}
          </div>
        </TabsContent>

        <TabsContent value="theory" className="mt-4">
          <Card className="p-5 space-y-4">
            <p className="text-sm">
              In Impagliazzo's <em>Minicrypt</em>, the existence of one-way functions is equivalent
              to the existence of every other major symmetric primitive:
            </p>
            <MB>{`\\text{OWF} \\;\\Longleftrightarrow\\; \\text{PRG} \\;\\Longleftrightarrow\\; \\text{PRF} \\;\\Longleftrightarrow\\; \\text{SKE} \\;\\Longleftrightarrow\\; \\text{MAC}`}</MB>
            <p className="text-sm">
              <span className="text-gb-yellow font-mono">HILL</span>: every OWF yields a PRG.
              <span className="text-gb-aqua font-mono"> GGM</span>: every PRG yields a PRF (PA#2).
              CRHF is <em>not</em> known to follow from generic OWFs (Simon 1998 separation), so
              it sits at the edge of the clique.
            </p>
            <MB>{`F_k(x_1\\Vert\\dots\\Vert x_n) = G_{x_n}(\\dots G_{x_1}(k)\\dots)`}</MB>
          </Card>
        </TabsContent>
      </Tabs>
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
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        {dir === "fwd" ? <ArrowRight className="text-gb-aqua h-4 w-4" /> : <ArrowLeft className="text-gb-purple h-4 w-4" />}
        <div className="font-mono text-xs text-muted-foreground">REDUCTION</div>
        <div className="font-mono text-sm">{from} ⟶ {to}</div>
      </div>
      <ol className="space-y-2 text-sm">
        {reduction.steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono text-gb-yellow shrink-0">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 text-[11px] font-mono text-muted-foreground">refs: {reduction.refs}</div>
      {reduction.refs === "stub" && (
        <div className="mt-2 rounded-md border border-gb-orange/40 bg-gb-orange/10 px-2 py-1 text-[11px] text-gb-orange font-mono">
          ⚠ separation result — no black-box construction
        </div>
      )}
      {from === to && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          <M>F=F</M> — nothing to reduce.
        </div>
      )}
    </Card>
  );
}
