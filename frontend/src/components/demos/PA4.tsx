import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── helpers ────────────────────────────────────────────────────────────────

function shortHex(h: string, n = 8) {
  if (!h) return "…";
  return h.slice(0, n) + (h.length > n ? "…" : "");
}

function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Three fixed 16-byte ASCII blocks (hex-encoded)
const DEFAULT_BLOCKS = [
  // "Hello, Block #1!" in hex
  "48656c6c6f2c20426c6f636b202331",
  // "Hello, Block #2!"
  "48656c6c6f2c20426c6f636b202332",
  // "Hello, Block #3!"
  "48656c6c6f2c20426c6f636b202333",
];

// ─── types ───────────────────────────────────────────────────────────────────

interface BlockData {
  m_hex: string;
  xor_in_hex: string;
  cipher_out_hex: string;
  c_hex: string;
}

interface AnimateRes {
  iv_hex: string;
  blocks: BlockData[];
  ciphertext_hex: string;
}

interface FlipRes {
  original_m_blocks: string[];
  recovered_m_blocks: string[];
  corrupted: boolean[];
}

interface IVReuseRes {
  iv_hex: string;
  c1_blocks: string[];
  c2_blocks: string[];
  matching_blocks: boolean[];
}

// ─── color palette ───────────────────────────────────────────────────────────
const BLOCK_COLORS = [
  { bg: "bg-gb-blue/20", border: "border-gb-blue/60", text: "text-gb-blue" },
  { bg: "bg-gb-purple/20", border: "border-gb-purple/60", text: "text-gb-purple" },
  { bg: "bg-gb-aqua/20", border: "border-gb-aqua/60", text: "text-gb-aqua" },
];
const IV_COLOR = { bg: "bg-gb-yellow/20", border: "border-gb-yellow/60", text: "text-gb-yellow" };

// ─── BlockBox ─────────────────────────────────────────────────────────────────

function BlockBox({
  label,
  hex,
  bg,
  border,
  text,
  glow,
}: {
  label: string;
  hex: string;
  bg: string;
  border: string;
  text: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 min-w-[120px] text-center transition-all duration-500 ${bg} ${border} ${
        glow ? "ring-2 ring-gb-red shadow-[0_0_12px_rgba(251,73,52,0.5)]" : ""
      }`}
    >
      <div className={`text-[10px] uppercase tracking-wider font-mono ${text} mb-0.5`}>{label}</div>
      <div className="font-mono text-[11px] text-foreground break-all leading-tight">{shortHex(hex, 12)}</div>
    </div>
  );
}

function ArrowDown() {
  return (
    <div className="flex justify-center py-0.5">
      <svg width="16" height="20" viewBox="0 0 16 20" className="text-muted-foreground">
        <line x1="8" y1="0" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="4,14 12,14 8,20" fill="currentColor" />
      </svg>
    </div>
  );
}

function XorCircle() {
  return (
    <div className="flex justify-center py-0.5">
      <div className="w-6 h-6 rounded-full border-2 border-gb-yellow bg-gb-yellow/10 flex items-center justify-center text-gb-yellow font-bold text-sm">
        ⊕
      </div>
    </div>
  );
}

// ─── Block Step Animator ─────────────────────────────────────────────────────

function BlockStep({
  idx,
  data,
  ivHex,
  prevCHex,
  mode,
  visible,
  flipIndex,
  corrupted,
}: {
  idx: number;
  data: BlockData;
  ivHex: string;
  prevCHex: string | null;
  mode: string;
  visible: boolean;
  flipIndex: number | null;
  corrupted?: boolean;
}) {
  const col = BLOCK_COLORS[idx % 3];
  const isFlipped = flipIndex === idx;
  const isCorrupted = corrupted === true;

  if (!visible) return null;

  if (mode === "CBC") {
    const chainLabel = idx === 0 ? "IV" : `C[${idx - 1}]`;
    const chainHex = idx === 0 ? ivHex : prevCHex ?? ivHex;
    const chainCol = idx === 0 ? IV_COLOR : BLOCK_COLORS[(idx - 1) % 3];
    return (
      <div className="flex flex-col items-center gap-0 animate-in fade-in slide-in-from-top-3 duration-500">
        {/* plaintext + chain input at top */}
        <div className="flex items-end gap-3">
          <BlockBox label={`M[${idx}]`} hex={data.m_hex} {...col} glow={isCorrupted} />
          <BlockBox label={chainLabel} hex={chainHex} bg={chainCol.bg} border={chainCol.border} text={chainCol.text} />
        </div>
        <XorCircle />
        <BlockBox label="XOR out" hex={data.xor_in_hex} bg="bg-muted/40" border="border-border" text="text-muted-foreground" />
        <ArrowDown />
        <div className="rounded bg-card border border-border/60 px-2 py-1 text-[10px] font-mono text-muted-foreground">
          E<sub>k</sub>( · )
        </div>
        <ArrowDown />
        <BlockBox
          label={`C[${idx}]`}
          hex={data.c_hex}
          bg={col.bg}
          border={isFlipped ? "border-gb-red" : col.border}
          text={col.text}
          glow={isFlipped}
        />
      </div>
    );
  }

  if (mode === "OFB") {
    const feedbackLabel = idx === 0 ? "IV" : `Z[${idx - 1}]`;
    const feedbackHex = data.xor_in_hex;
    const feedbackCol = idx === 0 ? IV_COLOR : BLOCK_COLORS[(idx - 1) % 3];
    return (
      <div className="flex flex-col items-center gap-0 animate-in fade-in slide-in-from-top-3 duration-500">
        <BlockBox label={feedbackLabel} hex={feedbackHex} bg={feedbackCol.bg} border={feedbackCol.border} text={feedbackCol.text} />
        <ArrowDown />
        <div className="rounded bg-card border border-border/60 px-2 py-1 text-[10px] font-mono text-muted-foreground">
          E<sub>k</sub>( · )
        </div>
        <ArrowDown />
        <BlockBox label={`Z[${idx}]`} hex={data.cipher_out_hex} bg="bg-gb-yellow/10" border="border-gb-yellow/40" text="text-gb-yellow" />
        <div className="flex items-center gap-3 mt-0.5">
          <div className="text-xs text-muted-foreground">keystream</div>
          <XorCircle />
          <BlockBox label={`M[${idx}]`} hex={data.m_hex} {...col} glow={isCorrupted} />
        </div>
        <ArrowDown />
        <BlockBox
          label={`C[${idx}]`}
          hex={data.c_hex}
          bg={col.bg}
          border={isFlipped ? "border-gb-red" : col.border}
          text={col.text}
          glow={isFlipped}
        />
      </div>
    );
  }

  // CTR
  return (
    <div className="flex flex-col items-center gap-0 animate-in fade-in slide-in-from-top-3 duration-500">
      <BlockBox label={`CTR[${idx}]`} hex={data.xor_in_hex} bg="bg-gb-yellow/10" border="border-gb-yellow/40" text="text-gb-yellow" />
      <ArrowDown />
      <div className="rounded bg-card border border-border/60 px-2 py-1 text-[10px] font-mono text-muted-foreground">
        E<sub>k</sub>( · )
      </div>
      <ArrowDown />
      <BlockBox label={`KS[${idx}]`} hex={data.cipher_out_hex} bg="bg-gb-yellow/10" border="border-gb-yellow/40" text="text-gb-yellow" />
      <div className="flex items-center gap-3 mt-0.5">
        <BlockBox label={`M[${idx}]`} hex={data.m_hex} {...col} glow={isCorrupted} />
        <XorCircle />
      </div>
      <ArrowDown />
      <BlockBox
        label={`C[${idx}]`}
        hex={data.c_hex}
        bg={col.bg}
        border={isFlipped ? "border-gb-red" : col.border}
        text={col.text}
        glow={isFlipped}
      />
    </div>
  );
}

// ─── ModeAnimator ─────────────────────────────────────────────────────────────

function ModeAnimator({ mode, keyHex }: { mode: string; keyHex: string }) {
  const [data, setData] = useState<AnimateRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleBlocks, setVisibleBlocks] = useState(0);

  // Flip state
  const [flipIndex, setFlipIndex] = useState<number | null>(null);
  const [flipRes, setFlipRes] = useState<FlipRes | null>(null);
  const [flipping, setFlipping] = useState(false);

  const animate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    setVisibleBlocks(0);
    setFlipIndex(null);
    setFlipRes(null);
    try {
      const res = await fetch("/api/pa4/animate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, key_hex: keyHex, blocks_hex: DEFAULT_BLOCKS }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: AnimateRes = await res.json();
      setData(d);
      // Stagger block reveal
      for (let i = 0; i <= 3; i++) {
        await new Promise((r) => setTimeout(r, 350 * i));
        setVisibleBlocks(i + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [mode, keyHex]);

  // Auto-run on mount and mode change
  const ranRef = useRef(false);
  useEffect(() => {
    ranRef.current = false;
  }, [mode]);
  useEffect(() => {
    if (!ranRef.current) {
      ranRef.current = true;
      animate();
    }
  });

  const doFlip = async (blockIdx: number) => {
    if (!data) return;
    setFlipIndex(blockIdx);
    setFlipRes(null);
    setFlipping(true);
    try {
      const res = await fetch("/api/pa4/flip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          key_hex: keyHex,
          iv_hex: data.iv_hex,
          blocks_hex: DEFAULT_BLOCKS,
          flip_block: blockIdx,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fr: FlipRes = await res.json();
      setFlipRes(fr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFlipping(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={animate} disabled={loading} className="font-mono">
          {loading ? "encrypting…" : "↺ re-run"}
        </Button>
        {data && (
          <>
            <span className="text-xs text-muted-foreground">Flip C[i] bit:</span>
            {[0, 1, 2].map((i) => (
              <Button
                key={i}
                size="sm"
                variant={flipIndex === i ? "default" : "outline"}
                disabled={flipping}
                onClick={() => doFlip(i)}
                className="font-mono"
              >
                C[{i}]
              </Button>
            ))}
            {flipIndex !== null && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setFlipIndex(null); setFlipRes(null); }}
              >
                ✕ clear
              </Button>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* IV banner */}
          <div className="flex items-center gap-2">
            <div className={`rounded px-2 py-1 text-xs font-mono ${IV_COLOR.bg} ${IV_COLOR.border} border ${IV_COLOR.text}`}>
              {mode === "CTR" ? "nonce" : "IV"}: {shortHex(data.iv_hex, 16)}
            </div>
            {mode === "CTR" && (
              <span className="text-xs text-muted-foreground">blocks run in parallel ↔</span>
            )}
          </div>

          {/* block animator grid */}
          <div className="grid grid-cols-3 gap-4">
            {data.blocks.map((blk, i) => (
              <BlockStep
                key={i}
                idx={i}
                data={blk}
                ivHex={data.iv_hex}
                prevCHex={i > 0 ? data.blocks[i - 1].c_hex : null}
                mode={mode}
                visible={visibleBlocks > i}
                flipIndex={flipIndex}
                corrupted={flipRes?.corrupted[i]}
              />
            ))}
          </div>

          {/* flip-result explanation */}
          {flipRes && flipIndex !== null && (
            <Card className="p-3 border-gb-yellow/40 bg-gb-yellow/5 space-y-1">
              <div className="text-xs font-mono text-gb-yellow uppercase tracking-wider">
                Bit-flip in C[{flipIndex}] → error propagation
              </div>
              <div className="flex gap-2 flex-wrap">
                {flipRes.corrupted.map((c, i) => (
                  <span
                    key={i}
                    className={`text-xs font-mono px-2 py-0.5 rounded ${
                      c ? "bg-gb-red/20 text-gb-red border border-gb-red/40" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    M[{i}]: {c ? "✗ CORRUPTED" : "✓ ok"}
                  </span>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {mode === "CBC" &&
                  "CBC: flipped block is garbled AND the next block has exactly that one bit flipped (chaining)."}
                {mode === "OFB" &&
                  "OFB: only the same block position is corrupted — keystream is independent of ciphertext."}
                {mode === "CTR" &&
                  "CTR: only the same block position is corrupted — each counter is independent."}
              </div>
            </Card>
          )}

          {/* full ciphertext */}
          <div className="text-[10px] font-mono text-muted-foreground break-all leading-relaxed border border-border rounded p-2 bg-card/50">
            CT: {data.ciphertext_hex}
          </div>
        </>
      )}

      {loading && !data && (
        <div className="text-xs text-muted-foreground animate-pulse font-mono">
          calling backend (this uses the real prp_encrypt from pa2)…
        </div>
      )}
    </div>
  );
}

// ─── IV Reuse Panel ───────────────────────────────────────────────────────────

function IVReusePanel() {
  const [data, setData] = useState<IVReuseRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/pa4/iv_reuse", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const labels = ["Block 0 (identical)", "Block 1 (differs)", "Block 2 (differs)"];
  const m1Labels = ["Hello, crypto!!!", "This is message1", "Block three here"];
  const m2Labels = ["Hello, crypto!!!", "This is message2", "Block four--also"];

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground leading-relaxed">
        <strong className="text-gb-red">CBC IV-reuse attack:</strong> when two messages share the same block
        at position <em>i</em> and the same IV, the ciphertext blocks at position <em>i</em> will match —
        leaking that the plaintexts agreed at that block.
      </div>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <Button size="sm" onClick={run} disabled={loading} className="font-mono">
        {loading ? "running…" : "run CBC IV-reuse demo"}
      </Button>
      {data && (
        <>
          <div className="text-xs font-mono text-gb-yellow">
            IV: {shortHex(data.iv_hex, 24)} (same for both)
          </div>
          <div className="space-y-2">
            {data.c1_blocks.map((c1, i) => {
              const match = data.matching_blocks[i];
              return (
                <Card
                  key={i}
                  className={`p-3 border transition-colors ${
                    match ? "border-gb-red/60 bg-gb-red/5" : "border-border"
                  }`}
                >
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">
                    {labels[i]}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-gb-blue">M₁:</span> {m1Labels[i]}
                      <div className="text-muted-foreground mt-0.5 break-all">C₁: {shortHex(c1, 20)}</div>
                    </div>
                    <div>
                      <span className="text-gb-purple">M₂:</span> {m2Labels[i]}
                      <div className="text-muted-foreground mt-0.5 break-all">C₂: {shortHex(data.c2_blocks[i], 20)}</div>
                    </div>
                  </div>
                  {match && (
                    <div className="mt-2 text-xs font-mono text-gb-red flex items-center gap-1">
                      ⚠ C₁[{i}] = C₂[{i}] — attacker learns M₁[{i}] = M₂[{i}]
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function PA4() {
  // Stable 16-byte key for the session
  const [keyHex] = useState(() => randomHex(16));
  const [activeMode, setActiveMode] = useState<string>("CBC");
  const [showReuse, setShowReuse] = useState(false);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-mono text-muted-foreground">
          key: {shortHex(keyHex, 20)} (fixed this session)
        </div>
        <Button
          size="sm"
          variant={showReuse ? "default" : "outline"}
          className="font-mono text-xs"
          onClick={() => setShowReuse((v) => !v)}
        >
          {showReuse ? "← back to animator" : "CBC IV-reuse attack ⚠"}
        </Button>
      </div>

      {showReuse ? (
        <IVReusePanel />
      ) : (
        <Tabs value={activeMode} onValueChange={setActiveMode}>
          <TabsList>
            <TabsTrigger value="CBC" className="font-mono">CBC</TabsTrigger>
            <TabsTrigger value="OFB" className="font-mono">OFB</TabsTrigger>
            <TabsTrigger value="CTR" className="font-mono">CTR</TabsTrigger>
          </TabsList>
          <TabsContent value="CBC" className="mt-4">
            <div className="text-xs text-muted-foreground mb-3">
              <strong>CBC:</strong> C[i] = E_k(M[i] ⊕ C[i−1]). Bit-flip in C[i] corrupts M[i] (garbled) and flips 1 bit in M[i+1].
            </div>
            <ModeAnimator mode="CBC" keyHex={keyHex} />
          </TabsContent>
          <TabsContent value="OFB" className="mt-4">
            <div className="text-xs text-muted-foreground mb-3">
              <strong>OFB:</strong> keystream Z[i] = E_k(Z[i−1]); C[i] = M[i] ⊕ Z[i]. Keystream pre-computed independently of plaintext. Bit-flip affects only the same block.
            </div>
            <ModeAnimator mode="OFB" keyHex={keyHex} />
          </TabsContent>
          <TabsContent value="CTR" className="mt-4">
            <div className="text-xs text-muted-foreground mb-3">
              <strong>CTR:</strong> C[i] = M[i] ⊕ E_k(nonce + i). All blocks computable in parallel. Bit-flip affects only the same block position.
            </div>
            <ModeAnimator mode="CTR" keyHex={keyHex} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
