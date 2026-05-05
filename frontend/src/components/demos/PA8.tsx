import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MB } from "@/components/Math";

// ─── helpers ─────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </div>
  );
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground break-all">{children}</span>;
}

// ─── DLP Hash Live ────────────────────────────────────────────────────────────

interface GroupInfo {
  p_bits: number;
  p_hex: string;
  g: number;
  h_hex: string;
  alpha_known: boolean;
}

interface HashRes {
  message_hex: string;
  digest_full_hex: string;
  digest_short_hex: string;
  digest_bits: number;
  group_p_bits: number;
}

function DLPHashPanel() {
  const [message, setMessage] = useState("hello world");
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [hashRes, setHashRes] = useState<HashRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Five messages integration test
  const [fiveRes, setFiveRes] = useState<{ results: { message: string; length: number; digest_hex: string }[]; all_distinct: boolean } | null>(null);
  const [fiveLoading, setFiveLoading] = useState(false);

  // Load group info once
  useEffect(() => {
    fetch("/api/pa8/group_info")
      .then((r) => r.json())
      .then(setGroupInfo)
      .catch(() => {});
  }, []);

  const hash = useCallback(async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa8/hash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHashRes(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [message]);

  const runFive = async () => {
    setFiveLoading(true);
    try {
      const res = await fetch("/api/pa8/five_messages", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFiveRes(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFiveLoading(false);
    }
  };

  // Auto-hash on mount
  const ran = useRef(false);
  useEffect(() => { if (!ran.current) { ran.current = true; hash(); } });

  return (
    <div className="space-y-4">
      <MB>{String.raw`h(x, y) = g^x \cdot \hat{h}^y \bmod p \quad (\hat{h} = g^\alpha,\; \alpha \text{ discarded})`}</MB>

      {/* Group parameters */}
      {groupInfo && (
        <Card className="p-3 border-gb-blue/30 bg-gb-blue/5">
          <Label>DLP group — RFC 3526 1024-bit MODP</Label>
          <div className="grid sm:grid-cols-2 gap-1 text-[10px] font-mono mt-1">
            <div><span className="text-muted-foreground">|p| = </span><span className="text-gb-blue">{groupInfo.p_bits} bits</span></div>
            <div><span className="text-muted-foreground">g = </span><span className="text-gb-blue">{groupInfo.g}</span></div>
            <div className="col-span-2"><span className="text-muted-foreground">p = </span><span className="text-foreground">{groupInfo.p_hex}</span></div>
            <div className="col-span-2"><span className="text-muted-foreground">ĥ = </span><span className="text-foreground">{groupInfo.h_hex}</span></div>
            <div className="col-span-2 text-gb-green">α discarded — nobody knows log_g(ĥ)</div>
          </div>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      {/* Hash input */}
      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="type any message…"
          className="font-mono"
        />
        <Button size="sm" onClick={hash} disabled={loading}>
          {loading ? "hashing…" : "hash"}
        </Button>
      </div>

      {hashRes && (
        <Card className="p-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2 text-[10px] font-mono">
            <div>
              <Label>message (UTF-8 hex)</Label>
              <span className="text-gb-blue break-all">{hashRes.message_hex}</span>
            </div>
            <div>
              <Label>group element size</Label>
              <span className="text-muted-foreground">{hashRes.group_p_bits}-bit = {hashRes.group_p_bits / 8} bytes</span>
            </div>
          </div>
          <div>
            <Label>DLP Hash (first 64 bits shown)</Label>
            <div className="font-mono text-sm text-gb-aqua break-all">{hashRes.digest_short_hex}</div>
          </div>
          <div>
            <Label>full {hashRes.group_p_bits}-bit digest (hex)</Label>
            <div className="font-mono text-[9px] text-muted-foreground break-all leading-relaxed max-h-20 overflow-y-auto">
              {hashRes.digest_full_hex}
            </div>
          </div>
        </Card>
      )}

      {/* Integration test */}
      <div className="border-t border-border/40 pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold">Integration test</div>
          <Button size="sm" variant="outline" onClick={runFive} disabled={fiveLoading} className="font-mono text-xs">
            {fiveLoading ? "hashing 5 msgs…" : "hash 5 messages"}
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground">Hashes empty, short, 1-block, multi-block, and 200-byte messages. Confirms all distinct.</div>
        {fiveRes && (
          <div className="space-y-2">
            <div className={`text-xs font-mono ${fiveRes.all_distinct ? "text-gb-green" : "text-gb-red"}`}>
              {fiveRes.all_distinct ? "✓ all 5 digests distinct" : "✗ collision detected — unexpected!"}
            </div>
            <div className="space-y-1">
              {fiveRes.results.map((r, i) => (
                <div key={i} className="flex gap-2 text-[11px] font-mono items-baseline">
                  <span className="text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                  <span className="text-foreground w-28 shrink-0 truncate" title={r.message}>{r.message}</span>
                  <span className="text-muted-foreground">{r.length}B →</span>
                  <span className="text-gb-aqua">{r.digest_hex}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Collision Hunt ───────────────────────────────────────────────────────────

interface HuntRes {
  tries: number;
  birthday_bound: number;
  input1: string;
  input2: string;
  digest_hex: string;
  hit_msg: string;
}

function CollisionHuntPanel() {
  const [bits, setBits] = useState(16);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<HuntRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  const birthday = Math.pow(2, bits / 2);
  const progress = result ? Math.min(100, (result.tries / (birthday * 3)) * 100) : 0;

  const hunt = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/pa8/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bits }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gb-orange/40 bg-gb-orange/5 p-3 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-gb-orange">Birthday bound:</strong>{" "}
        with <em>n</em>-bit output, expect a collision after ≈ 2<sup>n/2</sup> evaluations.
        Toy group p = 65537 with output truncated to <em>n</em> bits. Finding a collision
        requires only O(√q) evaluations — confirming collision resistance requires large q.
      </div>

      <MB>{String.raw`\Pr[\text{collision}] \approx 1 - e^{-k^2 / 2^{n+1}}, \quad k \approx 2^{n/2} \Rightarrow \Pr \approx 1 - e^{-1/2}`}</MB>

      <div>
        <Label>output bits: {bits} → birthday bound ≈ 2<sup>{bits/2}</sup> = {Math.round(birthday).toLocaleString()} tries</Label>
        <Slider
          value={[bits]}
          min={8}
          max={24}
          step={2}
          onValueChange={(v) => { setBits(v[0]); setResult(null); }}
          disabled={running}
          className="mt-2"
        />
      </div>

      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      <Button onClick={hunt} disabled={running} className="font-mono">
        {running ? "hunting for collision…" : `find ${bits}-bit DLP collision`}
      </Button>

      {running && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-mono animate-pulse">
            running birthday attack on toy group (p = 65537)…
          </div>
          <Progress value={50} className="animate-pulse" />
        </div>
      )}

      {result && !running && (
        <div className="space-y-3">
          {/* Counter */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <Label>hashes evaluated</Label>
              <div className="text-xl font-mono text-gb-yellow">{result.tries.toLocaleString()}</div>
            </Card>
            <Card className="p-3 text-center">
              <Label>birthday bound</Label>
              <div className="text-xl font-mono text-foreground">{result.birthday_bound.toLocaleString()}</div>
            </Card>
            <Card className="p-3 text-center">
              <Label>ratio / bound</Label>
              <div className="text-xl font-mono text-gb-aqua">
                {(result.tries / result.birthday_bound).toFixed(2)}×
              </div>
            </Card>
          </div>

          <Progress value={progress} />

          {/* Collision pair */}
          {result.input1 && (
            <Card className="p-3 border-gb-red/60 bg-gb-red/5 space-y-2">
              <div className="text-xs font-semibold text-gb-red">🎯 Collision found!</div>
              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex gap-2">
                  <span className="text-gb-blue shrink-0">input₁:</span>
                  <span className="text-foreground">{result.input1}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gb-purple shrink-0">input₂:</span>
                  <span className="text-foreground">{result.input2}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gb-red shrink-0">digest:</span>
                  <span className="text-gb-red">0x{result.digest_hex} (both!)</span>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                To find a collision in the <em>full</em> DLP hash (1024-bit output) you'd need to
                evaluate ≈ 2<sup>512</sup> hashes — computationally infeasible.
              </div>
            </Card>
          )}

          {/* DLP connection */}
          <Card className="p-3 border-gb-yellow/30 bg-gb-yellow/5">
            <div className="text-xs font-semibold text-gb-yellow mb-1">Connection to DLP hardness</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              A collision (x₁,y₁) ≠ (x₂,y₂) with h(x₁,y₁) = h(x₂,y₂) means
              g<sup>x₁</sup>ĥ<sup>y₁</sup> = g<sup>x₂</sup>ĥ<sup>y₂</sup> (mod p),
              which implies g<sup>x₁−x₂</sup> = ĥ<sup>y₂−y₁</sup>.
              If y₁ ≠ y₂, this lets you compute α = log_g(ĥ) — breaking DLP.
              Finding collisions in h is therefore as hard as solving DLP in the group.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function PA8() {
  return (
    <Tabs defaultValue="hash">
      <TabsList>
        <TabsTrigger value="hash" className="font-mono">DLP hash live</TabsTrigger>
        <TabsTrigger value="collision" className="font-mono">birthday attack</TabsTrigger>
      </TabsList>
      <TabsContent value="hash" className="mt-4">
        <DLPHashPanel />
      </TabsContent>
      <TabsContent value="collision" className="mt-4">
        <CollisionHuntPanel />
      </TabsContent>
    </Tabs>
  );
}
