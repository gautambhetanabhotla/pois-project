import { createFileRoute, Link } from "@tanstack/react-router";
import { PA_LIST, PARTS, colorMap } from "@/lib/pa-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Network, ListTree, Sparkles, BookOpen, Zap } from "lucide-react";
import { MB } from "@/components/Math";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PoIS — Interactive Cryptography Dashboard" },
      {
        name: "description",
        content:
          "Explore 20 cryptography programming assignments with live interactive demos and full LaTeX specs.",
      },
      { property: "og:title", content: "PoIS — Interactive Cryptography Dashboard" },
      {
        property: "og:description",
        content:
          "From OWFs to Garbled Circuits — a Gruvbox-themed playground for the entire CS8.401 PoIS course.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-background to-card p-8 sm:p-12">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
             style={{
               backgroundImage:
                 "radial-gradient(circle at 1px 1px, var(--color-foreground) 1px, transparent 0)",
               backgroundSize: "24px 24px",
             }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-gb-yellow/40 bg-gb-yellow/10 px-3 py-1 text-xs font-mono text-gb-yellow">
            <Sparkles className="h-3.5 w-3.5" /> CS8.401 · Spring
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight">
            <span className="text-foreground">Principles of </span>
            <span className="bg-gradient-to-r from-gb-yellow via-gb-orange to-gb-red bg-clip-text text-transparent">
              Information Security
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-muted-foreground">
            A hands-on cryptography lab. 20 programming assignments, every one with a live
            in-browser demo and a LaTeX-rendered security spec — from one-way functions all the
            way to Yao's two-party computation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="font-mono">
              <Link to="/clique"><Network className="mr-1" /> Explore the Clique</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-mono">
              <Link to="/assignments"><ListTree className="mr-1" /> Browse PAs <ArrowRight className="ml-1" /></Link>
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            {[
              { label: "Assignments", value: "20", c: "text-gb-yellow" },
              { label: "Live Demos", value: "20", c: "text-gb-aqua" },
              { label: "Crypto Topics", value: "5", c: "text-gb-green" },
              { label: "LaTeX Specs", value: "100%", c: "text-gb-purple" },
            ].map((s) => (
              <div key={s.label} className="rounded-md border border-border bg-card/50 px-3 py-2">
                <div className={`text-2xl font-bold font-mono ${s.c}`}>{s.value}</div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Minicrypt Clique infographic */}
      <section className="mt-12">
        <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
          <div>
            <div className="font-mono text-xs text-gb-aqua">// PA#0</div>
            <h2 className="text-2xl sm:text-3xl font-bold">The Minicrypt Clique</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              In Impagliazzo's Minicrypt, all symmetric-cryptography primitives are equivalent:
              from any one of them you can build the rest.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/clique">Open Explorer <ArrowRight className="ml-1" /></Link>
          </Button>
        </div>
        <Card className="p-6 overflow-hidden">
          <CliqueDiagram />
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <MB>{`\\text{OWF} \\;\\Longleftrightarrow\\; \\text{PRG} \\;\\Longleftrightarrow\\; \\text{PRF} \\;\\Longleftrightarrow\\; \\text{SKE} \\;\\Longleftrightarrow\\; \\text{MAC} \\;\\Longleftrightarrow\\; \\text{CRHF}`}</MB>
          </div>
        </Card>
      </section>

      {/* PA Grid */}
      <section className="mt-12">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="font-mono text-xs text-gb-yellow">// catalogue</div>
            <h2 className="text-2xl sm:text-3xl font-bold">Programming Assignments</h2>
          </div>
        </div>
        {PARTS.map((part) => (
          <div key={part.key} className="mt-6">
            <div className={`flex items-center gap-2 mb-3`}>
              <span className={`h-2 w-2 rounded-full bg-gb-${part.color}`} />
              <h3 className="text-lg font-semibold">{part.label}</h3>
              <span className="font-mono text-[11px] text-muted-foreground">
                {PA_LIST.filter((p) => p.part === part.key).length} assignments
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PA_LIST.filter((p) => p.part === part.key).map((pa) => (
                <Link
                  key={pa.n}
                  to="/pa/$n"
                  params={{ n: String(pa.n) }}
                  className="group"
                >
                  <Card className={`h-full p-4 border ${colorMap[pa.color]} transition-all hover:scale-[1.02] hover:shadow-lg`}>
                    <div className="flex items-baseline justify-between">
                      <div className="font-mono text-xs opacity-70">PA#{pa.n}</div>
                      <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="mt-1 font-semibold text-foreground">{pa.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{pa.short}</div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* How to use */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold mb-6">How to use this dashboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: ListTree, title: "Navigate", body: "Use the left sidebar to jump between assignments. Groups are organised by course part.", c: "gb-yellow" },
            { icon: BookOpen, title: "Read the spec", body: "Each PA page renders the formal specification in LaTeX with theorems and security games.", c: "gb-aqua" },
            { icon: Zap, title: "Play with the demo", body: "Every PA ships with a live interactive widget — tweak inputs and watch the math respond.", c: "gb-orange" },
          ].map((s) => (
            <Card key={s.title} className="p-5">
              <s.icon className={`h-6 w-6 text-${s.c}`} />
              <div className="mt-3 font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mt-16 border-t border-border pt-6 text-center font-mono text-xs text-muted-foreground">
        CS8.401 · Principles of Information Security · Interactive Edition
      </footer>
    </div>
  );
}

function CliqueDiagram() {
  const nodes = [
    { id: "OWF", label: "OWF", color: "gb-yellow" },
    { id: "PRG", label: "PRG", color: "gb-green" },
    { id: "PRF", label: "PRF", color: "gb-aqua" },
    { id: "SKE", label: "SKE", color: "gb-blue" },
    { id: "MAC", label: "MAC", color: "gb-purple" },
    { id: "CRHF", label: "CRHF", color: "gb-orange" },
  ];
  const cx = 200, cy = 180, r = 140;
  const positioned = nodes.map((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return { ...n, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  return (
    <svg viewBox="0 0 400 360" className="w-full max-w-2xl mx-auto">
      {positioned.map((a, i) =>
        positioned.slice(i + 1).map((b) => (
          <line
            key={`${a.id}-${b.id}`}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))
      )}
      {positioned.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={32} className={`fill-card stroke-${n.color}`} strokeWidth={2} />
          <text x={n.x} y={n.y + 5} textAnchor="middle" className={`fill-${n.color} font-mono font-bold text-sm`}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
