import { createFileRoute, Link } from "@tanstack/react-router";
import { PA_LIST, PARTS, colorMap } from "@/lib/pa-data";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/assignments")({
  head: () => ({
    meta: [
      { title: "All Assignments — PoIS" },
      { name: "description", content: "Index of all 20 PoIS programming assignments organised by topic." },
      { property: "og:title", content: "All Assignments — PoIS" },
      { property: "og:description", content: "Browse the full PoIS PA catalogue: Prelude, Symmetric, Hashing, Public-Key, MPC." },
    ],
  }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="font-mono text-xs text-gb-yellow">// catalogue</div>
      <h1 className="text-4xl font-bold">All Assignments</h1>
      <p className="mt-2 text-muted-foreground max-w-2xl">
        Twenty programming assignments grouped into the five parts of the course. Click any card
        to open its spec and live demo.
      </p>

      {PARTS.map((part) => (
        <section key={part.key} className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <span className={`h-2.5 w-2.5 rounded-full bg-gb-${part.color}`} />
            <h2 className="text-xl font-semibold">{part.label}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PA_LIST.filter((p) => p.part === part.key).map((pa) => (
              <Link key={pa.n} to="/pa/$n" params={{ n: String(pa.n) }}>
                <Card className={`h-full p-4 border ${colorMap[pa.color]} hover:shadow-lg transition`}>
                  <div className="font-mono text-xs opacity-70">PA#{pa.n}</div>
                  <div className="mt-1 font-semibold text-foreground">{pa.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{pa.short}</div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
