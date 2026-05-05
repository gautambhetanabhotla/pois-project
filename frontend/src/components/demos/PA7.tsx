import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MB } from "@/components/Math";

// ─── helpers ─────────────────────────────────────────────────────────────────

function shortHex(h: string, n = 8) {
  if (!h) return "…";
  return h.slice(0, n) + (h.length > n ? "…" : "");
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChainBlock {
  index: number;
  raw_hex: string;
  is_padding: boolean;
  state_in_hex: string;
  state_out_hex: string;
}

interface ChainRes {
  message_raw_hex: string;
  padded_hex: string;
  block_size: number;
  iv_hex: string;
  blocks: ChainBlock[];
  final_digest_hex: string;
}

// ─── Arrow ───────────────────────────────────────────────────────────────────

function ArrowRight({ color = "text-muted-foreground" }: { color?: string }) {
  return (
    <div className={`flex items-center px-1 shrink-0 ${color}`}>
      <svg width="24" height="16" viewBox="0 0 24 16">
        <line x1="0" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="14,4 24,8 14,12" fill="currentColor" />
      </svg>
    </div>
  );
}

// ─── BlockBox ─────────────────────────────────────────────────────────────────

function BlockBox({
  block, visible, changed, editMode, onEdit,
}: {
  block: ChainBlock;
  visible: boolean;
  changed: boolean;
  editMode: boolean;
  onEdit: () => void;
}) {
  if (!visible) return null;

  const isPad = block.is_padding;

  return (
    <div className="flex items-stretch gap-0 animate-in fade-in slide-in-from-top-2 duration-400">
      {/* Compression function box */}
      <div className="flex flex-col items-center gap-1">
        {/* State-in badge */}
        <div className={`rounded px-1.5 py-0.5 text-[9px] font-mono border shrink-0 ${
          changed && !isPad
            ? "bg-gb-red/20 border-gb-red/50 text-gb-red"
            : "bg-gb-yellow/10 border-gb-yellow/30 text-gb-yellow"
        }`}>
          z{block.index}: {shortHex(block.state_in_hex, 10)}
        </div>

        {/* The block container */}
        <div
          className={`relative rounded-lg border-2 px-3 py-2 min-w-[110px] text-center cursor-pointer transition-all duration-300 ${
            isPad
              ? "border-dashed border-muted-foreground/40 bg-muted/20"
              : editMode
              ? "border-gb-red/70 bg-gb-red/10 shadow-[0_0_10px_rgba(251,73,52,0.3)]"
              : changed
              ? "border-gb-orange/70 bg-gb-orange/10"
              : "border-gb-blue/50 bg-gb-blue/10"
          }`}
          title={`Block ${block.index}: click to flip first bit`}
          onClick={editMode ? undefined : onEdit}
        >
          <div className="text-[9px] font-mono text-muted-foreground mb-0.5">
            M[{block.index}]{isPad ? " ← pad" : ""}
          </div>
          <div className="font-mono text-[10px] text-foreground break-all leading-tight">
            {shortHex(block.raw_hex, 16)}
          </div>
          {editMode && (
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-gb-red rounded-full text-[8px] text-white flex items-center justify-center">
              ✎
            </div>
          )}
        </div>

        {/* h() call */}
        <div className="rounded bg-card border border-border/60 px-2 py-0.5 text-[9px] font-mono text-muted-foreground">
          h(z,M)
        </div>

        {/* State-out badge */}
        <div className={`rounded px-1.5 py-0.5 text-[9px] font-mono border shrink-0 ${
          changed
            ? "bg-gb-red/20 border-gb-red/50 text-gb-red animate-pulse"
            : "bg-gb-aqua/10 border-gb-aqua/30 text-gb-aqua"
        }`}>
          z{block.index + 1}: {shortHex(block.state_out_hex, 10)}
        </div>
      </div>
    </div>
  );
}

// ─── Chain Viewer ─────────────────────────────────────────────────────────────

function ChainViewer() {
  const [message, setMessage] = useState("hello world");
  const [editBlock, setEditBlock] = useState<number | null>(null);
  const [origChain, setOrigChain] = useState<ChainRes | null>(null);
  const [editChain, setEditChain] = useState<ChainRes | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChain = useCallback(async (msg: string): Promise<ChainRes | null> => {
    const res = await fetch("/api/pa7/chain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  const buildEditedMsg = (original: ChainRes, blockIdx: number): string => {
    // Flip first byte of the chosen block in the *raw unpadded* message
    const rawHex = original.message_raw_hex;
    const rawBytes = rawHex.match(/.{2}/g) ?? [];
    const blockStart = blockIdx * original.block_size;
    if (blockStart < rawBytes.length) {
      rawBytes[blockStart] = (parseInt(rawBytes[blockStart], 16) ^ 0x01)
        .toString(16).padStart(2, "0");
    }
    // Re-encode as a hex string with 0x prefix so the backend knows it's hex
    return "0x" + rawBytes.join("");
  };

  const run = useCallback(async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setVisibleCount(0);
    setEditBlock(null);
    setEditChain(null);
    try {
      const d = await fetchChain(message);
      setOrigChain(d);
      // Stagger block reveal
      for (let i = 0; i <= (d?.blocks.length ?? 0); i++) {
        await new Promise((r) => setTimeout(r, 200 * i));
        setVisibleCount(i + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [message, fetchChain]);

  // Auto-run on mount
  const ran = useRef(false);
  useEffect(() => {
    if (!ran.current) { ran.current = true; run(); }
  });

  const handleBlockClick = async (blockIdx: number) => {
    if (!origChain) return;
    setEditBlock(blockIdx);
    const editedMsg = buildEditedMsg(origChain, blockIdx);
    try {
      const d = await fetchChain(editedMsg);
      setEditChain(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Determine which blocks changed after the edit
  const changedFrom = (editChain && editBlock !== null) ? editBlock : -1;

  return (
    <div className="space-y-4">
      <MB>{String.raw`H(M) = z_\ell, \quad z_i = h(z_{i-1},\, M_i), \quad z_0 = \mathbf{0}^8`}</MB>

      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="type any message…"
          className="font-mono"
        />
        <Button size="sm" onClick={run} disabled={loading}>{loading ? "hashing…" : "↺"}</Button>
      </div>

      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      {origChain && (
        <>
          {/* Padding info */}
          <div className="text-[10px] font-mono text-muted-foreground flex gap-4 flex-wrap">
            <span>raw: {origChain.message_raw_hex.length / 2} B</span>
            <span>padded: {origChain.padded_hex.length / 2} B</span>
            <span>blocks: {origChain.blocks.length}</span>
            <span className="text-gb-blue">IV: {origChain.iv_hex}</span>
          </div>

          {/* Block click hint */}
          {editBlock === null && (
            <div className="text-[10px] text-muted-foreground italic">
              ↓ click any block to flip its first bit and watch the avalanche effect
            </div>
          )}

          {/* Chain animation — horizontal scroll */}
          <div className="overflow-x-auto pb-2">
            <div className="flex items-start gap-0 min-w-max">
              {/* IV box */}
              <div className="flex flex-col items-center pt-6">
                <div className="rounded border border-gb-yellow/40 bg-gb-yellow/10 px-2 py-1 text-[9px] font-mono text-gb-yellow">
                  IV = {shortHex(origChain.iv_hex, 10)}
                </div>
              </div>

              {origChain.blocks.map((blk, i) => {
                const isVisible = visibleCount > i;
                const isChanged = editChain !== null && i >= changedFrom;
                const editBlk = editChain?.blocks[i];

                return (
                  <React.Fragment key={i}>
                    <ArrowRight color={isChanged ? "text-gb-red" : undefined} />
                    <BlockBox
                      block={isChanged && editBlk ? { ...blk, state_out_hex: editBlk.state_out_hex, state_in_hex: editBlk.state_in_hex } : blk}
                      visible={isVisible}
                      changed={isChanged}
                      editMode={editBlock === i}
                      onEdit={() => handleBlockClick(i)}
                    />
                  </React.Fragment>
                );
              })}

              {/* Final digest */}
              {visibleCount > (origChain.blocks.length ?? 0) - 1 && (
                <>
                  <ArrowRight color={editChain ? "text-gb-red" : undefined} />
                  <div className="flex flex-col items-center pt-6">
                    <div className={`rounded border px-2 py-1 text-[9px] font-mono ${
                      editChain
                        ? "border-gb-red/60 bg-gb-red/10 text-gb-red animate-pulse"
                        : "border-gb-green/50 bg-gb-green/10 text-gb-green"
                    }`}>
                      H(M) = {shortHex(
                        editChain ? editChain.final_digest_hex : origChain.final_digest_hex,
                        16
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Avalanche explanation */}
          {editBlock !== null && editChain && (
            <Card className="p-3 border-gb-orange/40 bg-gb-orange/5 space-y-1">
              <div className="text-xs font-semibold text-gb-orange">Avalanche effect</div>
              <div className="grid sm:grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-muted-foreground">original digest:</span>
                  <div className="text-gb-green break-all">{origChain.final_digest_hex}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">flipped block {editBlock} digest:</span>
                  <div className="text-gb-red break-all">{editChain.final_digest_hex}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Flipping 1 bit in block {editBlock} changes every subsequent chaining value — all{" "}
                {origChain.blocks.length - editBlock} downstream states diverge.
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setEditBlock(null); setEditChain(null); }}>
                clear
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Collision Demo ───────────────────────────────────────────────────────────

interface CollisionRes {
  msg1_hex: string;
  msg2_hex: string;
  compress_collision: boolean;
  md_collision: boolean;
  digest1_hex: string;
  digest2_hex: string;
  explanation: string;
}

function CollisionDemo() {
  const [result, setResult] = useState<CollisionRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa7/collision", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  function tryAscii(hex: string) {
    try {
      return '"' + new TextDecoder("ascii").decode(
        new Uint8Array((hex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)))
      ) + '"';
    } catch { return hex; }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gb-orange/40 bg-gb-orange/5 p-3 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-gb-orange">Collision-lifting lemma:</strong>{" "}
        if two inputs{" "}
        <span className="font-mono text-foreground">M₁ ≠ M₂</span> collide under the
        compression function <span className="font-mono">h(IV, M₁) = h(IV, M₂)</span>,
        then they also collide under the full Merkle-Damgård hash{" "}
        <span className="font-mono">H(M₁) = H(M₂)</span>.
        This shows H's security <em>reduces</em> to h's security.
      </div>
      <MB>{String.raw`h(\text{IV}, M_1) = h(\text{IV}, M_2) \Rightarrow H(M_1) = H(M_2)`}</MB>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <Button onClick={run} disabled={loading} className="font-mono">
        {loading ? "finding collision…" : "demonstrate collision lifting"}
      </Button>
      {result && (
        <div className="space-y-3">
          {/* The two messages */}
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "M₁", hex: result.msg1_hex, color: "text-gb-blue" },
              { label: "M₂", hex: result.msg2_hex, color: "text-gb-purple" },
            ].map(({ label, hex, color }) => (
              <Card key={label} className="p-3 space-y-1">
                <Label>{label}</Label>
                <div className={`font-mono text-xs ${color} break-all`}>{tryAscii(hex.slice(0, 16))}</div>
                <div className="font-mono text-[10px] text-muted-foreground break-all">{hex}</div>
              </Card>
            ))}
          </div>

          {/* Results */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Card className={`p-3 border ${result.compress_collision ? "border-gb-red/60" : "border-border"}`}>
              <Label>compression collision</Label>
              <div className={`font-mono text-lg ${result.compress_collision ? "text-gb-red" : "text-gb-green"}`}>
                {result.compress_collision ? "h(IV,M₁) = h(IV,M₂) ✓" : "no collision"}
              </div>
            </Card>
            <Card className={`p-3 border ${result.md_collision ? "border-gb-red/60" : "border-border"}`}>
              <Label>full MD hash collision</Label>
              <div className={`font-mono text-lg ${result.md_collision ? "text-gb-red" : "text-gb-green"}`}>
                {result.md_collision ? "H(M₁) = H(M₂) ✓" : "no collision"}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1 break-all">
                {result.digest1_hex}
              </div>
            </Card>
          </div>

          <Card className="p-3 border-gb-yellow/30 bg-gb-yellow/5">
            <div className="text-xs text-foreground leading-relaxed">{result.explanation}</div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function PA7() {
  return (
    <Tabs defaultValue="chain">
      <TabsList>
        <TabsTrigger value="chain" className="font-mono">MD chain viewer</TabsTrigger>
        <TabsTrigger value="collision" className="font-mono">collision lifting</TabsTrigger>
      </TabsList>
      <TabsContent value="chain" className="mt-4">
        <ChainViewer />
      </TabsContent>
      <TabsContent value="collision" className="mt-4">
        <CollisionDemo />
      </TabsContent>
    </Tabs>
  );
}
