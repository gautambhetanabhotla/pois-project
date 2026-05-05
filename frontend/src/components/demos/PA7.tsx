import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { bytesToHex, hexToBytes } from "@/lib/crypto-helpers";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}

export function PA7() {
  const [text, setText] = useState("hello world");
  const [edit, setEdit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocks = useMemo(() => {
    const enc = new TextEncoder().encode(text.padEnd(Math.ceil(text.length / 4) * 4));
    const out: string[] = [];
    for (let i = 0; i < enc.length; i += 4) {
      out.push(bytesToHex(enc.slice(i, i + 4)));
    }
    return out;
  }, [text]);

  const editedBlocks = useMemo(() => {
    return blocks.map((b, i) => {
      if (i === edit) {
        const bb = hexToBytes(b);
        bb[0] ^= 1;
        return bytesToHex(bb);
      }
      return b;
    });
  }, [blocks, edit]);

  const [chain, setChain] = useState<string[]>([]);
  const [chain2, setChain2] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch("/api/pa7/hash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks_hex: blocks }),
      }).then(r => r.json()),
      fetch("/api/pa7/hash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks_hex: editedBlocks }),
      }).then(r => r.json())
    ])
      .then(([res1, res2]) => {
        if (cancelled) return;
        if (res1.chain_hex) setChain(res1.chain_hex);
        if (res2.chain_hex) setChain2(res2.chain_hex);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [blocks, editedBlocks]);

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error}
        </div>
      )}
      <Input value={text} onChange={(e) => setText(e.target.value)} />
      <div>
        <Label>
          edit block #{edit}
          {loading && <span className="ml-2 text-gb-yellow lowercase">hashing...</span>}
        </Label>
        <Slider value={[edit]} min={0} max={Math.max(0, blocks.length - 1)} step={1} onValueChange={(v) => setEdit(v[0])} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[chain, chain2].map((ch, idx) => (
          <Card key={idx} className="p-3">
            <Label>{idx === 0 ? "original" : "with bit-flip in block " + edit}</Label>
            <div className="space-y-1">
              {ch.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground w-8">h{i}</span>
                  <Mono>{c}</Mono>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="text-xs text-gb-aqua">avalanche: a single bit flip cascades through all subsequent chaining values.</div>
    </div>
  );
}
