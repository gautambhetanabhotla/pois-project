import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, Box, Hash } from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </div>
  );
}

// Toy XOR Compression in JS for live "avalanche" updates
// Block size 8, State 4
function toyCompress(stateHex: string, blockHex: string): string {
  const s = hexToBytes(stateHex);
  const b = hexToBytes(blockHex);
  const res = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    res[i] = s[i] ^ b[i] ^ b[i + 4];
  }
  return bytesToHex(res);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── components ──────────────────────────────────────────────────────────────

export function PA7() {
  const [message, setMessage] = useState("Merkle-Damgard");
  const [blocks, setBlocks] = useState<string[]>([]);
  const [chain, setChain] = useState<string[]>([]);
  const [iv, setIv] = useState("00000000");
  const [loading, setLoading] = useState(false);

  // For the interactive collision reduction demo
  const [b1, setB1] = useState("0000000000000000");
  const [b2, setB2] = useState("FFFFFFFFFFFFFFFF");
  
  const b1Padded = b1.padEnd(16, "0");
  const b2Padded = b2.padEnd(16, "0");
  const h1 = toyCompress("00000000", b1Padded);
  const h2 = toyCompress("00000000", b2Padded);
  const isCollision = h1 === h2 && b1Padded !== b2Padded;

  const fetchTrace = useCallback(async (msg: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/pa7/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBlocks(data.blocks_hex);
      setChain(data.chain_hex);
      setIv(data.iv_hex);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrace(message);
  }, [message, fetchTrace]);

  // When a block is edited manually
  const updateBlock = (index: number, newHex: string) => {
    // Only allow hex characters, up to 16 chars (8 bytes)
    const hex = newHex.replace(/[^0-9a-fA-F]/g, "").slice(0, 16).padEnd(16, "0");
    const newBlocks = [...blocks];
    newBlocks[index] = hex;
    setBlocks(newBlocks);

    // Re-compute chain locally to show instant avalanche
    const newChain = [iv];
    let currentState = iv;
    for (const b of newBlocks) {
      currentState = toyCompress(currentState, b);
      newChain.push(currentState);
    }
    setChain(newChain);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border/50 bg-muted/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-foreground">
              MD Chain Viewer
            </h3>
            <div className="flex gap-4 text-[10px] font-mono text-muted-foreground">
              <span>Block: 8B</span>
              <span>State: 4B</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Input Message (Text or 0xHex)</Label>
            <Input 
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Merkle-Damgard or 0x414243"
              className="font-mono text-sm bg-background border-gb-purple/20 focus-visible:ring-gb-purple/30"
            />
          </div>
        </div>
      </Card>

      {/* The Chain Visualizer */}
      <div className="overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        <div className="flex items-center gap-4 min-w-max px-2">
          
          {/* IV */}
          <div className="flex flex-col items-center gap-2">
            <div className="px-3 py-2 bg-background border border-border/50 rounded-lg shadow-sm">
              <Label>IV (z₀)</Label>
              <div className="font-mono text-xs font-bold text-muted-foreground">0x{iv.toUpperCase()}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/30" />
          </div>

          {/* Blocks & Intermediate States */}
          {blocks.map((block, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col gap-3 group">
                {/* Block Box */}
                <div className="relative p-4 bg-gb-purple/5 border-2 border-gb-purple/20 rounded-xl hover:border-gb-purple/40 transition-all shadow-sm">
                  <div className="absolute -top-2 -right-2 bg-gb-purple text-background text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                    M{i+1}
                  </div>
                  <Label>Block Data (Hex)</Label>
                  <input 
                    value={block}
                    onChange={(e) => updateBlock(i, e.target.value)}
                    className="w-32 bg-transparent border-none font-mono text-xs font-bold text-foreground focus:ring-0 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center gap-1.5 opacity-40">
                    <Box className="w-3 h-3" />
                    <span className="text-[9px] font-mono uppercase">Block {i+1}</span>
                  </div>
                </div>

                {/* Chaining Value Result */}
                <div className="flex items-center gap-4">
                  <ArrowRight className="w-4 h-4 text-gb-purple/40" />
                  <div className="px-3 py-2 bg-background border-2 border-gb-purple/30 rounded-lg shadow-gb-purple/5 shadow-md animate-in slide-in-from-left-2 duration-300">
                    <Label>State (z{i+1})</Label>
                    <div className="font-mono text-sm font-bold text-gb-purple tabular-nums">
                      0x{chain[i+1]?.toUpperCase() || "????"}
                    </div>
                  </div>
                  {i < blocks.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground/30" />}
                </div>
              </div>
            </React.Fragment>
          ))}

          {/* Final Digest */}
          <div className="flex flex-col items-center gap-2 ml-4">
            <div className="p-6 bg-gb-purple text-background rounded-2xl shadow-xl shadow-gb-purple/20 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Final Digest</span>
              </div>
              <div className="font-mono text-2xl font-black tracking-wider">
                0x{chain[chain.length-1]?.toUpperCase() || "????"}
              </div>
            </div>
          </div>

        </div>
      </div>

      <Card className="p-4 border-border/50 bg-muted/5">
        <p className="text-[11px] text-muted-foreground font-mono leading-relaxed italic">
          Tip: Try editing the hex values in any block above. Notice how the <span className="text-gb-purple font-bold italic">avalanche effect</span> propagates 
          the change through the entire chain, demonstrating how Merkle-Damgård ensures every bit of the input affects the final digest.
        </p>
      </Card>

      {/* Collision Reduction Demo */}
      <Card className="p-6 border-gb-yellow/30 bg-gb-yellow/5">
        <div className="space-y-4">
          <div className="flex items-center gap-3 border-b border-border/50 pb-3">
            <div className="p-2 bg-gb-yellow/20 rounded-lg">
              <Hash className="w-5 h-5 text-gb-yellow" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-foreground">
                Collision Reduction Demo
              </h3>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                Collision in <span className="italic">h</span> ⇒ Collision in <span className="italic">H</span>
              </p>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-4 leading-relaxed">
            <p>
              The security of the Merkle-Damgård transform <span className="text-foreground font-bold">H</span> relies entirely on the collision resistance of the underlying compression function <span className="text-foreground font-bold">h</span>. If we can find a collision in <span className="italic">h</span>, we can trivially construct a collision for the full hash <span className="italic">H</span>.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4 bg-background border-border/50">
                <Label>1. Find a collision in h</Label>
                <p className="text-[10px] mb-3">Our toy compression function splits the 8-byte block into two 4-byte halves and XORs them with the state. Type two different 16-hex-char blocks that collide!</p>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex flex-col gap-1 p-2 bg-muted/30 rounded border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase">Block 1</span>
                      <span className="font-bold">→ h(IV, B₁) = <span className={isCollision ? "text-gb-green" : "text-gb-yellow"}>{h1}</span></span>
                    </div>
                    <input 
                      value={b1}
                      onChange={(e) => setB1(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 16))}
                      className="w-full bg-transparent border-b border-border/50 font-mono text-gb-yellow font-bold focus:outline-none focus:border-gb-yellow"
                    />
                  </div>
                  <div className="flex flex-col gap-1 p-2 bg-muted/30 rounded border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase">Block 2</span>
                      <span className="font-bold">→ h(IV, B₂) = <span className={isCollision ? "text-gb-green" : "text-gb-yellow"}>{h2}</span></span>
                    </div>
                    <input 
                      value={b2}
                      onChange={(e) => setB2(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 16))}
                      className="w-full bg-transparent border-b border-border/50 font-mono text-gb-yellow font-bold focus:outline-none focus:border-gb-yellow"
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-background border-border/50 flex flex-col">
                <Label>2. Propagate to full MD hash H</Label>
                <p className="text-[10px] mb-3">If we treat these blocks as full messages <span className="italic">M₁</span> and <span className="italic">M₂</span>, their lengths are identical (8 bytes). Thus, the MD padding appended to both will be exactly the same.</p>
                <div className="space-y-2 font-mono text-[10px] flex-grow">
                  <div className="p-2 bg-muted/30 rounded border border-border">
                    <div className="text-muted-foreground mb-1">M₁ || Padding</div>
                    <div><span className="text-gb-yellow font-bold">{b1Padded}</span> <span className="opacity-50">80000000... (Padding)</span></div>
                  </div>
                  <div className="p-2 bg-muted/30 rounded border border-border">
                    <div className="text-muted-foreground mb-1">M₂ || Padding</div>
                    <div><span className="text-gb-yellow font-bold">{b2Padded}</span> <span className="opacity-50">80000000... (Padding)</span></div>
                  </div>
                </div>
              </Card>
            </div>

            <Card className={`p-4 text-background rounded-xl text-center transition-colors ${isCollision ? "bg-gb-green" : "bg-gb-yellow"}`}>
              <div className="font-bold text-sm uppercase tracking-wider mb-1">
                {isCollision ? "Collision Achieved!" : "Waiting for Collision..."}
              </div>
              <div className="text-xs opacity-90">
                {isCollision 
                  ? <span>Since <span className="font-mono">z₁</span> is identical for both messages, and the remaining padding blocks are identical, the rest of the chain computes exactly the same states.</span>
                  : <span>Edit the blocks above to find two different inputs where <span className="font-mono">h(IV, B₁) == h(IV, B₂)</span>.</span>
                }
              </div>
              <div className="font-mono text-lg font-black mt-2">
                {isCollision ? "H(M₁) == H(M₂)" : "H(M₁) != H(M₂)"}
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}
