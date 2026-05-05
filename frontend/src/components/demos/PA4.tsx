import React, { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { bytesToHex, hexToBytes } from "@/lib/crypto-helpers";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

export function PA4() {
  const [mode, setMode] = useState<"ECB" | "CBC" | "CTR">("ECB");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 16-byte key
  const [key] = useState(() => bytesToHex(crypto.getRandomValues(new Uint8Array(16))));

  // Build a tiny "penguin": 24x24 grid with a recognizable shape (576 pixels/bytes)
  const w = 24, h = 24;
  const original = useMemo(() => {
    const px = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = x - 12, cy = y - 14;
      const body = cx * cx * 0.7 + cy * cy < 60;
      const head = (cx) * (cx) + (cy + 6) * (cy + 6) < 14;
      px[y * w + x] = (body || head) ? 1 : 0;
    }
    return px;
  }, []);

  const [enc, setEnc] = useState<Uint8Array>(new Uint8Array(w * h));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    
    // Convert 0/1 pixel data into 576 bytes of "plaintext"
    // To make ECB leakage visible, we'll map 0 to a specific byte and 1 to another.
    // However, 576 bytes is 36 full 16-byte blocks. If an entire 16-pixel block
    // happens to be identical, ECB will leak it. 
    // To maximize ECB leakage visually, we'll map pixel 0 -> 0x00 and pixel 1 -> 0xFF.
    const plaintextBytes = new Uint8Array(w * h);
    for (let i = 0; i < plaintextBytes.length; i++) {
      plaintextBytes[i] = original[i] ? 0xFF : 0x00;
    }

    fetch("/api/pa4/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, key_hex: key, plaintext_hex: bytesToHex(plaintextBytes) }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(d => {
        if (cancelled) return;
        const cipherBytes = hexToBytes(d.ciphertext_hex);
        // Map ciphertext bytes back to a visual 0-255 scale
        const visual = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          visual[i] = cipherBytes[i] || 0;
        }
        setEnc(visual);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [mode, key, original]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        {(["ECB", "CBC", "CTR"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} className="font-mono" onClick={() => setMode(m)}>{m}</Button>
        ))}
        {loading && <span className="text-xs text-gb-yellow font-mono ml-2">encrypting on backend...</span>}
      </div>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          backend offline or unreachable: {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <Label>plaintext "penguin"</Label>
          <PixelGrid w={w} h={h} data={original.map((p) => (p ? 235 : 40)) as unknown as Uint8Array} />
        </Card>
        <Card className="p-3">
          <Label>encrypted under {mode}</Label>
          <PixelGrid w={w} h={h} data={enc} />
        </Card>
      </div>
      <div className="text-xs text-muted-foreground">
        ECB leaks block patterns — the bird is still visible. CBC/CTR look random.
      </div>
    </div>
  );
}

function PixelGrid({ w, h, data }: { w: number; h: number; data: Uint8Array }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full image-render-pixel" style={{ imageRendering: "pixelated" }}>
      {Array.from({ length: h }).map((_, y) =>
        Array.from({ length: w }).map((_, x) => {
          const v = data[y * w + x];
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={`rgb(${v},${v},${v})`} />;
        })
      )}
    </svg>
  );
}
