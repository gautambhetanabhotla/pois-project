import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ArrowLeftCircle } from "lucide-react";
import { getPA, PA_LIST, colorMap } from "@/lib/pa-data";
import { PA_CONTENT } from "@/components/pa-demos";

export const Route = createFileRoute("/pa/$n")({
  loader: ({ params }) => {
    const n = parseInt(params.n, 10);
    const pa = getPA(n);
    if (!pa) throw notFound();
    return { pa };
  },
  head: ({ loaderData }) => {
    const pa = loaderData?.pa;
    if (!pa) {
      return { meta: [{ title: "Assignment not found — PoIS" }] };
    }
    const title = `PA#${pa.n} — ${pa.title} · PoIS`;
    return {
      meta: [
        { title },
        { name: "description", content: pa.short },
        { property: "og:title", content: title },
        { property: "og:description", content: pa.short },
      ],
    };
  },
  component: PAPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold">PA not found</h1>
      <p className="mt-2 text-muted-foreground">There are 20 PoIS assignments — try one of those.</p>
      <Link to="/assignments" className="mt-4 inline-block text-gb-aqua underline font-mono">→ all assignments</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold text-gb-red">Error</h1>
      <p className="mt-2 font-mono text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function PAPage() {
  const { pa } = Route.useLoaderData();
  const content = PA_CONTENT[pa.n];
  const idx = PA_LIST.findIndex((p) => p.n === pa.n);
  const prev = PA_LIST[idx - 1];
  const next = PA_LIST[idx + 1];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/assignments" className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-gb-aqua">
        <ArrowLeftCircle className="h-3.5 w-3.5" /> all assignments
      </Link>

      <div className="mt-4 flex items-baseline gap-3 flex-wrap">
        <span className={`rounded-md border px-2 py-0.5 text-xs font-mono ${colorMap[pa.color as keyof typeof colorMap]}`}>PA#{pa.n}</span>
        <span className="text-xs font-mono text-muted-foreground">{pa.part}</span>
      </div>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{pa.title}</h1>
      <p className="mt-2 text-muted-foreground max-w-2xl">{pa.short}</p>

      <Tabs defaultValue="demo" className="mt-6">
        <TabsList>
          <TabsTrigger value="demo">Interactive Demo</TabsTrigger>
          <TabsTrigger value="spec">Spec</TabsTrigger>
          <TabsTrigger value="notes">Security Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="mt-4">
          <Card className="p-5">
            {content?.demo ?? <div className="text-sm text-muted-foreground">Demo coming soon.</div>}
          </Card>
        </TabsContent>

        <TabsContent value="spec" className="mt-4">
          <Card className="p-5 prose-invert max-w-none text-sm space-y-3 [&_p]:my-2">
            {content?.spec ?? <div>Spec pending.</div>}
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card className="p-5 text-sm text-muted-foreground">
            {content?.notes ?? <div>—</div>}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pager */}
      <div className="mt-8 flex justify-between gap-3">
        {prev ? (
          <Button asChild variant="outline" className="font-mono">
            <Link to="/pa/$n" params={{ n: String(prev.n) }}>
              <ArrowLeft className="h-3.5 w-3.5" /> PA#{prev.n} {prev.title}
            </Link>
          </Button>
        ) : <div />}
        {next ? (
          <Button asChild variant="outline" className="font-mono">
            <Link to="/pa/$n" params={{ n: String(next.n) }}>
              PA#{next.n} {next.title} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : <div />}
      </div>
    </div>
  );
}
