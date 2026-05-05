import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MB } from "@/components/Math";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}

export function PA10() {
  const [k, setK] = useState("k3y");
  const [m, setM] = useState("authenticated");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    
    fetch("/api/pa10/hmac", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key_text: k, message: m }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (!cancelled) setTag(d.tag_hex);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });

    return () => { cancelled = true; };
  }, [k, m]);

  return (
    <div className="space-y-3">
      <MB>{`\\mathsf{HMAC}_k(m) = H\\big( (k \\oplus \\text{opad}) \\Vert H((k \\oplus \\text{ipad}) \\Vert m) \\big)`}</MB>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-2">
        <div><Label>key</Label><Input value={k} onChange={(e) => setK(e.target.value)} /></div>
        <div><Label>message</Label><Input value={m} onChange={(e) => setM(e.target.value)} /></div>
      </div>
      <Card className="p-3">
        <Label>HMAC tag</Label>
        <Mono>{tag || "..."}</Mono>
      </Card>
    </div>
  );
}
