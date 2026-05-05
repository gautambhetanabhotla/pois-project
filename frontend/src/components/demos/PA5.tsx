import React, { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MB, M } from "@/components/Math";

// ─── helpers ─────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs break-all text-foreground">{children}</span>;
}
function shortHex(h: string, n = 12) {
  if (!h) return "…";
  return h.slice(0, n) + (h.length > n ? "…" : "");
}

interface OraclePair { m: string; tag_hex: string; }

// ─── EUF-CMA Forgery Game ────────────────────────────────────────────────────

function ForgeGame() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<OraclePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgery state
  const [forgeM, setForgeM] = useState("");
  const [forgeT, setForgeT] = useState("");
  const [lastResult, setLastResult] = useState<{
    valid: boolean; is_known_pair: boolean; attempts: number; successes: number;
  } | null>(null);
  const [forging, setForging] = useState(false);

  // Additional signing
  const [signM, setSignM] = useState("");
  const [signMode, setSignMode] = useState<"CBC" | "PRF">("CBC");

  const initSession = async () => {
    setLoading(true);
    setError(null);
    setLastResult(null);
    setPairs([]);
    try {
      const res = await fetch("/api/pa5/session", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setSessionId(d.session_id);
      setPairs(d.pairs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const addSign = async () => {
    if (!sessionId || !signM.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pa5/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: signM, mac_mode: signMode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setPairs(prev => [{ m: signM, tag_hex: d.tag_hex }, ...prev].slice(0, 50));
      setSignM("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const submitForge = async () => {
    if (!sessionId) return;
    setForging(true);
    setError(null);
    try {
      const res = await fetch("/api/pa5/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: forgeM, tag_hex: forgeT }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLastResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setForging(false);
    }
  };

  // Auto-init on mount
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) { didInit.current = true; initSession(); }
  });

  const scoreColor = lastResult
    ? lastResult.valid && !lastResult.is_known_pair
      ? "text-gb-red"
      : lastResult.valid
      ? "text-gb-yellow"
      : "text-gb-green"
    : "";

  const verdict = lastResult
    ? lastResult.valid && !lastResult.is_known_pair
      ? "✓ Forgery accepted! (This should never happen with a secure MAC)"
      : lastResult.valid && lastResult.is_known_pair
      ? "⚠ Valid — but this is a known (m, t) pair, not a forgery"
      : "✗ Invalid tag — MAC is unforgeable"
    : null;

  return (
    <div className="space-y-4">
      <MB>{String.raw`\mathsf{Mac}_k(m) = \mathsf{CBC\text{-}MAC}_k(m), \quad \mathsf{Vrfy}_k(m,t) = [\mathsf{Mac}_k(m) \stackrel{?}{=} t]`}</MB>

      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      {/* Oracle pairs list */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={initSession} disabled={loading} className="font-mono">
          {loading && !sessionId ? "initialising…" : "↺ new session"}
        </Button>
        {sessionId && (
          <span className="text-[10px] font-mono text-muted-foreground">
            session: {sessionId.slice(0, 8)}…
          </span>
        )}
      </div>

      {pairs.length > 0 && (
        <Card className="p-3 border-gb-blue/40">
          <Label>oracle — {pairs.length} signed pairs (key hidden)</Label>
          <div className="max-h-40 overflow-y-auto space-y-0.5 mt-1">
            {pairs.map((p, i) => (
              <div key={i} className="flex gap-2 text-[11px] font-mono">
                <span className="text-gb-blue shrink-0">{i.toString().padStart(2, "0")}.</span>
                <span className="text-foreground">{p.m}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-gb-aqua">{shortHex(p.tag_hex, 16)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Ask oracle for more signatures */}
      {sessionId && (
        <div className="flex gap-2 flex-wrap">
          <Input
            value={signM}
            onChange={(e) => setSignM(e.target.value)}
            placeholder="ask oracle to sign…"
            className="font-mono"
            disabled={loading}
          />
          <select
            value={signMode}
            onChange={(e) => setSignMode(e.target.value as "CBC" | "PRF")}
            className="rounded-md border border-border bg-card text-foreground text-xs px-2 font-mono"
          >
            <option value="CBC">CBC-MAC</option>
            <option value="PRF">PRF-MAC</option>
          </select>
          <Button size="sm" onClick={addSign} disabled={loading || !signM.trim()}>
            sign
          </Button>
        </div>
      )}

      {/* Attempt counter */}
      {lastResult && (
        <div className="flex gap-4 text-xs font-mono">
          <span className="text-muted-foreground">attempts: <span className="text-foreground">{lastResult.attempts}</span></span>
          <span className={lastResult.successes > 0 ? "text-gb-red" : "text-gb-green"}>
            forgeries accepted: {lastResult.successes}
          </span>
          <span className="text-muted-foreground">
            (graders expect 0 in ≥20 attempts)
          </span>
        </div>
      )}

      {/* Forgery submission */}
      <Card className="p-3 border-gb-red/30 bg-gb-red/5 space-y-2">
        <Label>submit forgery — pick an m* NOT in the oracle list</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">message m*</div>
            <Input value={forgeM} onChange={(e) => setForgeM(e.target.value)} placeholder="new message" className="font-mono" disabled={forging} />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">tag t* (hex)</div>
            <Input value={forgeT} onChange={(e) => setForgeT(e.target.value)} placeholder="guessed tag hex" className="font-mono" disabled={forging} />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={submitForge}
          disabled={forging || !sessionId || !forgeM}
          className="font-mono border-gb-red/40 text-gb-red hover:bg-gb-red/10"
        >
          {forging ? "verifying…" : "submit forgery"}
        </Button>
        {verdict && (
          <div className={`text-sm font-mono mt-1 ${scoreColor}`}>{verdict}</div>
        )}
      </Card>
    </div>
  );
}

// ─── Length-Extension Demo ────────────────────────────────────────────────────

function LenExtDemo() {
  const [keyHex] = useState(() =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
  const [message, setMessage] = useState("user=admin&action=read");
  const [suffix, setSuffix] = useState("&action=delete");
  const [result, setResult] = useState<{
    original_tag_hex: string;
    extended_tag_hex: string;
    padded_message: string;
    attack_succeeded: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa5/len_ext", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_hex: keyHex, message, suffix }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gb-orange/40 bg-gb-orange/5 p-3 space-y-1">
        <div className="text-xs font-semibold text-gb-orange">Why naïve H(k∥m) breaks</div>
        <div className="text-xs text-muted-foreground leading-relaxed">
          A Merkle-Damgård hash processes data in blocks, chaining state forward.
          An attacker who sees <M>{String.raw`H(k \Vert m)`}</M> can set that as a new IV and hash
          a chosen suffix — producing <M>{String.raw`H(k \Vert m \Vert \text{pad} \Vert m')`}</M>{" "}
          <strong>without knowing k</strong>. This defeats the MAC entirely.
          HMAC prevents this by wrapping with an outer hash.
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>original message m (victim signs this)</Label>
          <Input value={message} onChange={(e) => setMessage(e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label>attacker suffix m′</Label>
          <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} className="font-mono" />
        </div>
      </div>

      <div className="text-[10px] font-mono text-muted-foreground">
        secret key (hidden from attacker): {keyHex.slice(0, 16)}…
      </div>

      <Button onClick={run} disabled={loading} className="font-mono">
        {loading ? "computing…" : "run length-extension attack"}
      </Button>

      {result && (
        <div className="space-y-3">
          {/* Step-by-step */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="rounded bg-gb-blue/20 text-gb-blue text-[10px] font-mono px-1.5 py-0.5 mt-0.5 shrink-0">1</span>
              <div>
                <div className="text-[10px] text-muted-foreground">Victim computes tag = H(k∥m), sends (m, tag) to server</div>
                <Mono>tag = {result.original_tag_hex}</Mono>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="rounded bg-gb-yellow/20 text-gb-yellow text-[10px] font-mono px-1.5 py-0.5 mt-0.5 shrink-0">2</span>
              <div>
                <div className="text-[10px] text-muted-foreground">
                  Attacker intercepts (m, tag). Knows MD pads k∥m to a block boundary, then adds suffix.
                  Sets new IV = tag, hashes only m′:
                </div>
                <Mono>extended_tag = md_hash_from_iv(tag, m′) = {result.extended_tag_hex}</Mono>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="rounded bg-gb-purple/20 text-gb-purple text-[10px] font-mono px-1.5 py-0.5 mt-0.5 shrink-0">3</span>
              <div>
                <div className="text-[10px] text-muted-foreground">
                  Attacker presents (m∥pad∥m′, extended_tag) to server — server verifies H(k∥m∥pad∥m′):
                </div>
                <Mono>padded msg (hex): {result.padded_message.slice(0, 48)}…</Mono>
              </div>
            </div>
          </div>

          <Card className={`p-3 border ${result.attack_succeeded ? "border-gb-red/60 bg-gb-red/5" : "border-gb-green/60 bg-gb-green/5"}`}>
            <div className={`text-sm font-mono ${result.attack_succeeded ? "text-gb-red" : "text-gb-green"}`}>
              {result.attack_succeeded
                ? "⚠ Attack succeeded — attacker forged a valid tag for extended message without the key!"
                : "✓ Attack failed — the hash is not vulnerable in this configuration."}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              extended_tag == real H(k∥m∥pad∥m′): {String(result.attack_succeeded)}
            </div>
          </Card>

          <Card className="p-3 border-gb-green/40 bg-gb-green/5">
            <div className="text-xs font-semibold text-gb-green mb-1">HMAC fixes this</div>
            <MB>{String.raw`\mathsf{HMAC}_k(m) = H\!\big((k \oplus \text{opad}) \Vert H((k \oplus \text{ipad}) \Vert m)\big)`}</MB>
            <div className="text-xs text-muted-foreground mt-1">
              The outer hash wraps the inner result — the attacker can't continue chaining because the
              outer key XOR opad is unknown. See PA#10 for the full implementation.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function PA5() {
  return (
    <Tabs defaultValue="euf-cma">
      <TabsList>
        <TabsTrigger value="euf-cma" className="font-mono">EUF-CMA game</TabsTrigger>
        <TabsTrigger value="len-ext" className="font-mono">Length-extension</TabsTrigger>
      </TabsList>
      <TabsContent value="euf-cma" className="mt-4">
        <ForgeGame />
      </TabsContent>
      <TabsContent value="len-ext" className="mt-4">
        <LenExtDemo />
      </TabsContent>
    </Tabs>
  );
}
