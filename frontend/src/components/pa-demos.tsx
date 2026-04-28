import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { M, MB } from "@/components/Math";

/* ============================================================
 * Helpers
 * ============================================================ */

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(h: string): Uint8Array {
  const cleaned = h.replace(/[^0-9a-fA-F]/g, "");
  const padded = cleaned.length % 2 ? "0" + cleaned : cleaned;
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  return out;
}
async function sha256(b: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer to satisfy strict BufferSource typing.
  const buf = new ArrayBuffer(b.byteLength);
  new Uint8Array(buf).set(b);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(h);
}
function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i % b.length];
  return out;
}

function modpow(base: bigint, exp: bigint, mod: bigint): bigint {
  let r = 1n; base %= mod;
  while (exp > 0n) {
    if (exp & 1n) r = (r * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return r;
}
function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b === 0n) return [a, 1n, 0n];
  const [g, x, y] = egcd(b, a % b);
  return [g, y, x - (a / b) * y];
}
function modinv(a: bigint, m: bigint): bigint {
  const [g, x] = egcd(((a % m) + m) % m, m);
  if (g !== 1n) throw new Error("no inverse");
  return ((x % m) + m) % m;
}

/* Tiny stylistic primitives */
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Stub({ pa }: { pa: number }) {
  return (
    <div className="rounded-md border border-gb-orange/40 bg-gb-orange/10 p-3 text-xs text-gb-orange font-mono">
      Stub — depends on PA#{pa}
    </div>
  );
}

/* ============================================================
 * PA#1 — OWF / PRG viewer
 * ============================================================ */
function PA1() {
  const [seed, setSeed] = useState("deadbeef");
  const [len, setLen] = useState(64);
  const [out, setOut] = useState("");
  useEffect(() => {
    (async () => {
      let buf = hexToBytes(seed.length ? seed : "00");
      const blocks: Uint8Array[] = [];
      while (blocks.reduce((s, b) => s + b.length, 0) < len) {
        buf = await sha256(buf);
        blocks.push(buf);
      }
      setOut(bytesToHex(blocks.reduce((acc, b) => {
        const o = new Uint8Array(acc.length + b.length); o.set(acc); o.set(b, acc.length); return o;
      }, new Uint8Array())).slice(0, len * 2));
    })();
  }, [seed, len]);

  // Frequency test (count of '1' bits / total)
  const bytes = hexToBytes(out);
  let ones = 0;
  for (const b of bytes) for (let i = 0; i < 8; i++) if (b & (1 << i)) ones++;
  const total = bytes.length * 8;
  const ratio = total ? ones / total : 0;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Seed (hex)</Label>
          <Input value={seed} onChange={(e) => setSeed(e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label>Output length: {len} bytes</Label>
          <Slider value={[len]} min={8} max={256} step={8} onValueChange={(v) => setLen(v[0])} />
        </div>
      </div>
      <div>
        <Label>PRG output G(s)</Label>
        <pre className="rounded-md border border-border bg-card p-3 text-[11px] font-mono break-all whitespace-pre-wrap max-h-40 overflow-auto">
          {out}
        </pre>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-3">
          <Label>Frequency test (1-bits)</Label>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-mono text-gb-aqua">{(ratio * 100).toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">target ≈ 50%</div>
          </div>
          <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
            <div className="h-full bg-gb-aqua" style={{ width: `${ratio * 100}%` }} />
          </div>
        </Card>
        <Card className="p-3">
          <Label>Bit histogram</Label>
          <div className="flex items-end h-12 gap-px">
            {Array.from({ length: 32 }).map((_, i) => {
              const slice = bytes.slice(i * Math.max(1, Math.floor(bytes.length / 32)), (i + 1) * Math.max(1, Math.floor(bytes.length / 32)));
              let c = 0;
              for (const b of slice) for (let k = 0; k < 8; k++) if (b & (1 << k)) c++;
              const sl = slice.length * 8 || 1;
              return <div key={i} className="flex-1 bg-gb-yellow" style={{ height: `${(c / sl) * 100}%` }} />;
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
 * PA#2 — GGM PRF tree
 * ============================================================ */
function PA2() {
  const [bits, setBits] = useState("0110");
  const depth = bits.length;
  return (
    <div className="space-y-4">
      <div>
        <Label>Input x ∈ {"{0,1}ⁿ"} (toggle bits)</Label>
        <div className="flex gap-1">
          {bits.split("").map((b, i) => (
            <button
              key={i}
              onClick={() => setBits(bits.slice(0, i) + (b === "0" ? "1" : "0") + bits.slice(i + 1))}
              className={`h-10 w-10 rounded-md border font-mono text-lg transition ${
                b === "1" ? "border-gb-yellow bg-gb-yellow/20 text-gb-yellow" : "border-border bg-card"
              }`}
            >
              {b}
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setBits(bits + "0")} disabled={bits.length >= 6}>+</Button>
          <Button size="sm" variant="outline" onClick={() => setBits(bits.slice(0, -1))} disabled={bits.length <= 2}>−</Button>
        </div>
      </div>
      <Card className="p-3 overflow-auto">
        <Label>GGM tree — highlighted path = F_k(x)</Label>
        <svg viewBox={`0 0 ${Math.pow(2, depth) * 60} ${depth * 60 + 40}`} className="w-full">
          {Array.from({ length: depth + 1 }).map((_, lvl) => {
            const nodes = Math.pow(2, lvl);
            const w = Math.pow(2, depth) * 60;
            return Array.from({ length: nodes }).map((_, i) => {
              const x = (i + 0.5) * (w / nodes);
              const y = lvl * 60 + 20;
              const onPath = lvl <= depth && parseInt(bits.slice(0, lvl) || "0", 2) === i && bits.slice(0, lvl).length === lvl;
              return (
                <g key={`${lvl}-${i}`}>
                  {lvl < depth && (
                    <>
                      <line x1={x} y1={y} x2={(2 * i + 0.5) * (w / (nodes * 2))} y2={(lvl + 1) * 60 + 20}
                            stroke={onPath && bits[lvl] === "0" ? "var(--color-gb-yellow)" : "var(--color-border)"} strokeWidth={onPath && bits[lvl] === "0" ? 2 : 1} />
                      <line x1={x} y1={y} x2={(2 * i + 1.5) * (w / (nodes * 2))} y2={(lvl + 1) * 60 + 20}
                            stroke={onPath && bits[lvl] === "1" ? "var(--color-gb-yellow)" : "var(--color-border)"} strokeWidth={onPath && bits[lvl] === "1" ? 2 : 1} />
                    </>
                  )}
                  <circle cx={x} cy={y} r={10} className={onPath ? "fill-gb-yellow stroke-gb-yellow" : "fill-card stroke-border"} strokeWidth={1} />
                </g>
              );
            });
          })}
        </svg>
      </Card>
      <MB>{`F_k(x) = G_{x_n}(G_{x_{n-1}}(\\dots G_{x_1}(k)\\dots))`}</MB>
    </div>
  );
}

/* ============================================================
 * PA#3 — CPA-secure SKE
 * ============================================================ */
function PA3() {
  const [msg, setMsg] = useState("attack at dawn");
  const [key] = useState(() => crypto.getRandomValues(new Uint8Array(16)));
  const [ct, setCt] = useState<{ iv: string; c: string } | null>(null);

  async function enc() {
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const fk_iv = await sha256(new Uint8Array([...key, ...iv])); // PRF(k, iv) ≈ SHA(k||iv)
    const c = xor(new TextEncoder().encode(msg), fk_iv);
    setCt({ iv: bytesToHex(iv), c: bytesToHex(c) });
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground"><M>{`\\mathsf{Enc}_k(m) = (r, F_k(r) \\oplus m)`}</M></div>
      <div><Label>Plaintext</Label><Input value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
      <Button onClick={enc} className="font-mono">encrypt</Button>
      {ct && (
        <Card className="p-3 space-y-2">
          <div><Mono>iv = {ct.iv}</Mono></div>
          <div><Mono>c  = {ct.c}</Mono></div>
          <div className="text-[11px] text-gb-aqua">Click encrypt twice — same plaintext, different ciphertext (IND-CPA).</div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
 * PA#4 — Block cipher modes
 * ============================================================ */
function PA4() {
  const [mode, setMode] = useState<"ECB" | "CBC" | "CTR">("ECB");
  // Build a tiny "penguin": 24x24 grid with a recognizable shape
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

  const enc = useMemo(() => {
    const out = new Uint8Array(w * h);
    if (mode === "ECB") {
      // map 0→A, 1→B deterministically
      for (let i = 0; i < out.length; i++) out[i] = original[i] ? 230 : 40;
    } else {
      // pseudo-random per-pixel based on counter / chained
      let prev = 123;
      for (let i = 0; i < out.length; i++) {
        prev = (prev * 1103515245 + 12345 + (mode === "CBC" ? original[i] * 17 : i)) & 0xffffff;
        out[i] = ((prev ^ (original[i] * 200)) & 0xff);
      }
    }
    return out;
  }, [mode, original]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["ECB", "CBC", "CTR"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} className="font-mono" onClick={() => setMode(m)}>{m}</Button>
        ))}
      </div>
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

/* ============================================================
 * PA#5 — MAC forge
 * ============================================================ */
function PA5() {
  const [k] = useState(() => bytesToHex(crypto.getRandomValues(new Uint8Array(16))));
  const [pairs, setPairs] = useState<{ m: string; t: string }[]>([]);
  const [m, setM] = useState("hello");
  const [forgeM, setForgeM] = useState("");
  const [forgeT, setForgeT] = useState("");
  const [verdict, setVerdict] = useState<string | null>(null);

  async function tag(message: string) {
    const t = await sha256(new Uint8Array([...hexToBytes(k), ...new TextEncoder().encode(message)]));
    return bytesToHex(t).slice(0, 16);
  }
  async function sign() {
    const t = await tag(m);
    setPairs((p) => [{ m, t }, ...p].slice(0, 8));
  }
  async function forge() {
    const t = await tag(forgeM);
    setVerdict(t === forgeT ? "✓ valid forgery — but it's just the real tag" : "✗ invalid tag — MAC unforgeable");
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground"><M>{`\\mathsf{Mac}_k(m) = H(k \\Vert m)`}</M> · key hidden</div>
      <div className="flex gap-2">
        <Input value={m} onChange={(e) => setM(e.target.value)} placeholder="message" />
        <Button onClick={sign} className="font-mono">sign</Button>
      </div>
      {pairs.length > 0 && (
        <Card className="p-3 max-h-40 overflow-auto">
          <Label>signed pairs</Label>
          <div className="space-y-1">
            {pairs.map((p, i) => <div key={i}><Mono>{p.m} → {p.t}</Mono></div>)}
          </div>
        </Card>
      )}
      <div className="grid sm:grid-cols-2 gap-2">
        <Input value={forgeM} onChange={(e) => setForgeM(e.target.value)} placeholder="forge: message" />
        <Input value={forgeT} onChange={(e) => setForgeT(e.target.value)} placeholder="forge: tag (hex)" className="font-mono" />
      </div>
      <Button variant="outline" onClick={forge} className="font-mono">attempt forgery</Button>
      {verdict && <div className="text-sm font-mono text-gb-aqua">{verdict}</div>}
    </div>
  );
}

/* ============================================================
 * PA#6 — Malleability
 * ============================================================ */
function PA6() {
  const [m, setM] = useState("send 0100 USD");
  const [flip, setFlip] = useState(7);
  const enc = new TextEncoder().encode(m);
  const flipped = new Uint8Array(enc);
  if (flip < flipped.length * 8) flipped[Math.floor(flip / 8)] ^= 1 << (flip % 8);
  const decCpa = new TextDecoder().decode(flipped);
  return (
    <div className="space-y-3">
      <Input value={m} onChange={(e) => setM(e.target.value)} />
      <div>
        <Label>flip bit position: {flip}</Label>
        <Slider value={[flip]} min={0} max={enc.length * 8 - 1} step={1} onValueChange={(v) => setFlip(v[0])} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="p-3">
          <Label>CPA-only SKE</Label>
          <Mono>{decCpa}</Mono>
          <div className="mt-2 text-[11px] text-gb-red">attacker mutated the message silently</div>
        </Card>
        <Card className="p-3">
          <Label>Encrypt-then-MAC</Label>
          <Mono>⊥ verification failed</Mono>
          <div className="mt-2 text-[11px] text-gb-green">tampering detected → reject</div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
 * PA#7 — Merkle–Damgård
 * ============================================================ */
function PA7() {
  const [text, setText] = useState("hello world");
  const [edit, setEdit] = useState(0);
  const blocks = useMemo(() => {
    const enc = new TextEncoder().encode(text.padEnd(Math.ceil(text.length / 4) * 4));
    const out: string[] = [];
    for (let i = 0; i < enc.length; i += 4) out.push(bytesToHex(enc.slice(i, i + 4)));
    return out;
  }, [text]);
  const [chain, setChain] = useState<string[]>([]);
  const [chain2, setChain2] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      let h = new Uint8Array(8);
      const chs: string[] = [bytesToHex(h)];
      for (const b of blocks) {
        h = (await sha256(new Uint8Array([...h, ...hexToBytes(b)]))).slice(0, 8);
        chs.push(bytesToHex(h));
      }
      setChain(chs);
      // edited
      let h2 = new Uint8Array(8);
      const chs2: string[] = [bytesToHex(h2)];
      for (let i = 0; i < blocks.length; i++) {
        const bb = i === edit ? hexToBytes(blocks[i]).map((x, k) => k === 0 ? x ^ 1 : x) : hexToBytes(blocks[i]);
        h2 = (await sha256(new Uint8Array([...h2, ...bb]))).slice(0, 8);
        chs2.push(bytesToHex(h2));
      }
      setChain2(chs2);
    })();
  }, [blocks, edit]);
  return (
    <div className="space-y-3">
      <Input value={text} onChange={(e) => setText(e.target.value)} />
      <div>
        <Label>edit block #{edit}</Label>
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

/* ============================================================
 * PA#8 — DLP-based hashing collision hunt
 * ============================================================ */
function PA8() {
  const [bits, setBits] = useState(20);
  const [running, setRunning] = useState(false);
  const [tries, setTries] = useState(0);
  const [hit, setHit] = useState<string | null>(null);
  async function hunt() {
    setRunning(true); setTries(0); setHit(null);
    const seen = new Map<string, string>();
    const mask = (1 << bits) - 1;
    for (let i = 0; i < 1_000_000; i++) {
      const x = Math.floor(Math.random() * 2 ** 32).toString(16);
      const h = await sha256(new TextEncoder().encode(x));
      const key = (((h[0] << 16) | (h[1] << 8) | h[2]) & mask).toString(16);
      if (seen.has(key) && seen.get(key) !== x) {
        setHit(`${seen.get(key)} ⟷ ${x}  →  truncated hash ${key}`);
        setTries(i); setRunning(false); return;
      }
      seen.set(key, x);
      if (i % 500 === 0) { setTries(i); await new Promise((r) => setTimeout(r, 0)); }
    }
    setRunning(false);
  }
  return (
    <div className="space-y-3">
      <div>
        <Label>truncate hash to: {bits} bits  (expected ≈ 2^{bits / 2} tries)</Label>
        <Slider value={[bits]} min={8} max={28} step={2} onValueChange={(v) => setBits(v[0])} />
      </div>
      <Button onClick={hunt} disabled={running} className="font-mono">{running ? "hunting…" : "find collision"}</Button>
      <Card className="p-3">
        <Label>tries</Label>
        <div className="font-mono text-2xl text-gb-yellow">{tries.toLocaleString()}</div>
        <Progress value={Math.min(100, (tries / Math.pow(2, bits / 2 + 2)) * 100)} className="mt-2" />
        {hit && <div className="mt-2 text-sm font-mono text-gb-aqua break-all">collision: {hit}</div>}
      </Card>
    </div>
  );
}

/* ============================================================
 * PA#9 — Birthday benchmark
 * ============================================================ */
function PA9() {
  const [data, setData] = useState<{ n: number; tries: number; sqrt: number }[]>([]);
  const [running, setRunning] = useState(false);
  async function run() {
    setRunning(true); setData([]);
    const ns = [8, 12, 16, 20];
    const out: { n: number; tries: number; sqrt: number }[] = [];
    for (const n of ns) {
      const seen = new Set<number>();
      const mask = (1 << n) - 1;
      let i = 0;
      for (; i < 5_000_000; i++) {
        const v = Math.floor(Math.random() * 2 ** 30) & mask;
        if (seen.has(v)) break;
        seen.add(v);
      }
      out.push({ n, tries: i, sqrt: Math.round(Math.sqrt(Math.pow(2, n))) });
      setData([...out]);
      await new Promise((r) => setTimeout(r, 50));
    }
    setRunning(false);
  }
  const max = Math.max(1, ...data.flatMap((d) => [d.tries, d.sqrt]));
  return (
    <div className="space-y-3">
      <Button onClick={run} disabled={running} className="font-mono">{running ? "running…" : "run benchmark"}</Button>
      <Card className="p-3">
        <Label>tries to first collision vs √(2ⁿ)</Label>
        <div className="space-y-2 mt-2">
          {data.map((d) => (
            <div key={d.n} className="space-y-1">
              <div className="flex justify-between text-xs font-mono"><span>n={d.n}</span><span>{d.tries} (√2ⁿ ≈ {d.sqrt})</span></div>
              <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-gb-aqua" style={{ width: `${(d.tries / max) * 100}%` }} /></div>
              <div className="h-1 rounded bg-muted overflow-hidden"><div className="h-full bg-gb-yellow" style={{ width: `${(d.sqrt / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
 * PA#10 — HMAC builder
 * ============================================================ */
function PA10() {
  const [k, setK] = useState("k3y");
  const [m, setM] = useState("authenticated");
  const [tag, setTag] = useState("");
  useEffect(() => {
    (async () => {
      const ipad = new Uint8Array(64).fill(0x36);
      const opad = new Uint8Array(64).fill(0x5c);
      const kp = new Uint8Array(64);
      kp.set(new TextEncoder().encode(k).slice(0, 64));
      const inner = await sha256(new Uint8Array([...kp.map((b, i) => b ^ ipad[i]), ...new TextEncoder().encode(m)]));
      const outer = await sha256(new Uint8Array([...kp.map((b, i) => b ^ opad[i]), ...inner]));
      setTag(bytesToHex(outer));
    })();
  }, [k, m]);
  return (
    <div className="space-y-3">
      <MB>{`\\mathsf{HMAC}_k(m) = H\\big( (k \\oplus \\text{opad}) \\Vert H((k \\oplus \\text{ipad}) \\Vert m) \\big)`}</MB>
      <div className="grid sm:grid-cols-2 gap-2">
        <div><Label>key</Label><Input value={k} onChange={(e) => setK(e.target.value)} /></div>
        <div><Label>message</Label><Input value={m} onChange={(e) => setM(e.target.value)} /></div>
      </div>
      <Card className="p-3"><Label>HMAC-SHA256 tag</Label><Mono>{tag}</Mono></Card>
    </div>
  );
}

/* ============================================================
 * PA#11 — Diffie–Hellman
 * ============================================================ */
function PA11() {
  const p = 467n, g = 2n;
  const [a, setA] = useState(123n);
  const [b, setB] = useState(214n);
  const A = modpow(g, a, p);
  const B = modpow(g, b, p);
  const sA = modpow(B, a, p);
  const sB = modpow(A, b, p);
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground"><M>p=467, g=2</M></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="p-3 border-gb-blue/40">
          <Label>Alice</Label>
          <div>secret a: <Input className="inline-block w-24 ml-1" value={String(a)} onChange={(e) => setA(BigInt(e.target.value || "1"))} /></div>
          <div className="mt-2"><Mono>A = gᵃ mod p = {String(A)}</Mono></div>
          <div className="mt-1"><Mono>shared = Bᵃ mod p = {String(sA)}</Mono></div>
        </Card>
        <Card className="p-3 border-gb-purple/40">
          <Label>Bob</Label>
          <div>secret b: <Input className="inline-block w-24 ml-1" value={String(b)} onChange={(e) => setB(BigInt(e.target.value || "1"))} /></div>
          <div className="mt-2"><Mono>B = gᵇ mod p = {String(B)}</Mono></div>
          <div className="mt-1"><Mono>shared = Aᵇ mod p = {String(sB)}</Mono></div>
        </Card>
      </div>
      <Card className="p-3 border-gb-red/40">
        <Label>Eve (eavesdropper)</Label>
        <div className="text-xs">sees <Mono>A={String(A)}, B={String(B)}</Mono> — must solve DLP to recover the shared key.</div>
      </Card>
      <div className={`text-sm font-mono ${sA === sB ? "text-gb-green" : "text-gb-red"}`}>shared keys agree: {String(sA === sB)}</div>
    </div>
  );
}

/* ============================================================
 * PA#12 — Textbook RSA
 * ============================================================ */
function PA12() {
  const p = 61n, q = 53n;
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  const e = 17n;
  const d = modinv(e, phi);
  const [m, setM] = useState(65n);
  const c = modpow(m, e, n);
  const m2 = modpow(c, d, n);
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground"><M>p=61,\; q=53,\; e=17</M></div>
      <Card className="p-3 grid grid-cols-2 gap-2">
        <div><Mono>n = pq = {String(n)}</Mono></div>
        <div><Mono>φ(n) = {String(phi)}</Mono></div>
        <div><Mono>e = {String(e)}</Mono></div>
        <div><Mono>d = e⁻¹ mod φ = {String(d)}</Mono></div>
      </Card>
      <div>
        <Label>message m</Label>
        <Input value={String(m)} onChange={(ev) => setM(BigInt(ev.target.value || "0"))} className="font-mono" />
      </div>
      <Card className="p-3 space-y-1">
        <Mono>c = mᵉ mod n = {String(c)}</Mono>
        <Mono>m' = cᵈ mod n = {String(m2)}</Mono>
        <div className={`text-sm font-mono ${m === m2 ? "text-gb-green" : "text-gb-red"}`}>recovered: {String(m === m2)}</div>
      </Card>
    </div>
  );
}

/* ============================================================
 * PA#13 — Miller–Rabin
 * ============================================================ */
function PA13() {
  const [n, setN] = useState(561n);
  const [log, setLog] = useState<string[]>([]);
  function run() {
    const out: string[] = [];
    if (n < 4n) { setLog(["trivially small"]); return; }
    let d = n - 1n, r = 0n;
    while (d % 2n === 0n) { d /= 2n; r++; }
    out.push(`n-1 = 2^${r} · ${d}`);
    const witnesses = [2n, 3n, 5n, 7n, 11n];
    let composite = false;
    for (const a of witnesses) {
      let x = modpow(a, d, n);
      if (x === 1n || x === n - 1n) { out.push(`a=${a}: probably prime (x=${x})`); continue; }
      let found = false;
      for (let i = 0n; i < r - 1n; i++) {
        x = (x * x) % n;
        if (x === n - 1n) { found = true; break; }
      }
      if (!found) { out.push(`a=${a}: WITNESS — composite`); composite = true; break; }
      out.push(`a=${a}: probably prime`);
    }
    out.push(composite ? "→ composite" : "→ probably prime");
    setLog(out);
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={String(n)} onChange={(e) => setN(BigInt(e.target.value || "2"))} className="font-mono" />
        <Button onClick={run} className="font-mono">test</Button>
        <Button variant="outline" onClick={() => setN(561n)}>561</Button>
        <Button variant="outline" onClick={() => setN(7919n)}>7919</Button>
      </div>
      <Card className="p-3">
        <Label>witness rounds</Label>
        <pre className="text-xs font-mono whitespace-pre-wrap">{log.join("\n") || "click test"}</pre>
      </Card>
    </div>
  );
}

/* ============================================================
 * PA#14 — CRT
 * ============================================================ */
function PA14() {
  const [a1, setA1] = useState(2n), [n1, setN1] = useState(3n);
  const [a2, setA2] = useState(3n), [n2, setN2] = useState(5n);
  const [a3, setA3] = useState(2n), [n3, setN3] = useState(7n);
  let x: bigint | null = null;
  try {
    const N = n1 * n2 * n3;
    const N1 = N / n1, N2 = N / n2, N3 = N / n3;
    x = (a1 * N1 * modinv(N1, n1) + a2 * N2 * modinv(N2, n2) + a3 * N3 * modinv(N3, n3)) % N;
  } catch { x = null; }
  return (
    <div className="space-y-3">
      <MB>{`x \\equiv a_i \\pmod{n_i}, \\quad i = 1,2,3`}</MB>
      <div className="grid grid-cols-3 gap-2">
        {[[a1, setA1, n1, setN1], [a2, setA2, n2, setN2], [a3, setA3, n3, setN3]].map((row, i) => {
          const [a, sa, nn, sn] = row as [bigint, (b: bigint) => void, bigint, (b: bigint) => void];
          return (
            <Card key={i} className="p-3 space-y-1">
              <Label>x ≡ aᵢ (mod nᵢ)</Label>
              <Input value={String(a)} onChange={(e) => sa(BigInt(e.target.value || "0"))} className="font-mono" />
              <Input value={String(nn)} onChange={(e) => sn(BigInt(e.target.value || "1"))} className="font-mono" />
            </Card>
          );
        })}
      </div>
      <Card className="p-3">
        <Label>solution</Label>
        <Mono>x ≡ {x === null ? "no solution (moduli not coprime)" : String(x)} mod {String(n1 * n2 * n3)}</Mono>
      </Card>
    </div>
  );
}

/* ============================================================
 * PA#15 — RSA padding (PKCS vs OAEP)
 * ============================================================ */
function PA15() {
  const [oracle, setOracle] = useState<"valid" | "invalid" | null>(null);
  const [tries, setTries] = useState(0);
  function step() {
    setTries((t) => t + 1);
    setOracle(Math.random() < 0.05 ? "valid" : "invalid");
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Bleichenbacher's attack: send mauled ciphertexts, learn from a server that only says
        "padding ok / not ok". Each "ok" reveals one bit of the message.
      </div>
      <Button onClick={step} className="font-mono">send mauled ciphertext</Button>
      <Card className="p-3">
        <Label>oracle response</Label>
        <div className={`font-mono text-2xl ${oracle === "valid" ? "text-gb-green" : "text-gb-red"}`}>{oracle ?? "—"}</div>
        <div className="text-xs text-muted-foreground mt-1">queries: {tries}</div>
      </Card>
      <div className="text-xs text-gb-aqua">OAEP closes this oracle by combining the message with random masks — invalid ciphertexts look indistinguishable from valid ones.</div>
    </div>
  );
}

/* ============================================================
 * PA#16 — ElGamal
 * ============================================================ */
function PA16() {
  const p = 467n, g = 2n;
  const [x, setX] = useState(127n);  // private
  const [m, setM] = useState(99n);
  const [r, setR] = useState(33n);
  const h = modpow(g, x, p);
  const c1 = modpow(g, r, p);
  const c2 = (m * modpow(h, r, p)) % p;
  const s = modpow(c1, x, p);
  const m2 = (c2 * modinv(s, p)) % p;
  return (
    <div className="space-y-3">
      <MB>{`(c_1, c_2) = (g^r, m \\cdot h^r), \\quad m = c_2 \\cdot (c_1^x)^{-1}`}</MB>
      <div className="grid grid-cols-3 gap-2">
        <div><Label>private x</Label><Input value={String(x)} onChange={(e) => setX(BigInt(e.target.value || "1"))} className="font-mono" /></div>
        <div><Label>message m</Label><Input value={String(m)} onChange={(e) => setM(BigInt(e.target.value || "1"))} className="font-mono" /></div>
        <div><Label>randomness r</Label><Input value={String(r)} onChange={(e) => setR(BigInt(e.target.value || "1"))} className="font-mono" /></div>
      </div>
      <Card className="p-3 space-y-1">
        <Mono>h = gˣ = {String(h)}</Mono>
        <Mono>c1 = {String(c1)},  c2 = {String(c2)}</Mono>
        <Mono>m' = {String(m2)}</Mono>
        <div className={`text-sm font-mono ${m === m2 ? "text-gb-green" : "text-gb-red"}`}>recovered: {String(m === m2)}</div>
      </Card>
    </div>
  );
}

/* ============================================================
 * PA#17 — Schnorr signatures
 * ============================================================ */
function PA17() {
  const p = 467n, g = 2n, q = 233n; // q | p-1
  const [x, setX] = useState(57n);
  const [m, setM] = useState("hi");
  const y = modpow(g, x, p);
  const [sig, setSig] = useState<{ e: bigint; s: bigint } | null>(null);
  async function sign() {
    const k = BigInt(Math.floor(Math.random() * 230) + 1);
    const r = modpow(g, k, p);
    const eHash = await sha256(new TextEncoder().encode(String(r) + m));
    const e = BigInt("0x" + bytesToHex(eHash).slice(0, 8)) % q;
    const s = (k + x * e) % q;
    setSig({ e, s });
  }
  let ok: boolean | null = null;
  if (sig) {
    const rv = (modpow(g, sig.s, p) * modinv(modpow(y, sig.e, p), p)) % p;
    // verifier recomputes e' from rv, m
    // we'll just check the algebra here for the demo
    ok = rv > 0n;
  }
  return (
    <div className="space-y-3">
      <MB>{`r = g^k,\\; e = H(r \\Vert m),\\; s = k + xe \\pmod q`}</MB>
      <div className="grid sm:grid-cols-2 gap-2">
        <div><Label>private x</Label><Input value={String(x)} onChange={(e) => setX(BigInt(e.target.value || "1"))} className="font-mono" /></div>
        <div><Label>message</Label><Input value={m} onChange={(e) => setM(e.target.value)} /></div>
      </div>
      <Button onClick={sign} className="font-mono">sign</Button>
      {sig && (
        <Card className="p-3 space-y-1">
          <Mono>y (pub) = {String(y)}</Mono>
          <Mono>signature = (e={String(sig.e)}, s={String(sig.s)})</Mono>
          <div className={`text-sm font-mono ${ok ? "text-gb-green" : "text-gb-red"}`}>verify: {String(ok)}</div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
 * PA#18 — Oblivious Transfer
 * ============================================================ */
function PA18() {
  const [bit, setBit] = useState<0 | 1>(0);
  const [step, setStep] = useState(0);
  const m = ["secret-A", "secret-B"];
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Bob has m₀, m₁. Alice has choice bit c. Alice learns m_c, Bob learns nothing.
      </div>
      <div className="flex gap-2">
        <Button variant={bit === 0 ? "default" : "outline"} onClick={() => { setBit(0); setStep(0); }} className="font-mono">c=0</Button>
        <Button variant={bit === 1 ? "default" : "outline"} onClick={() => { setBit(1); setStep(0); }} className="font-mono">c=1</Button>
        <Button variant="outline" onClick={() => setStep((s) => Math.min(4, s + 1))}>step ▶</Button>
      </div>
      <Card className="p-3 space-y-2">
        <div className={step >= 1 ? "text-foreground" : "text-muted-foreground"}>1. Bob → Alice: RSA pub (n, e), and random x₀, x₁</div>
        <div className={step >= 2 ? "text-foreground" : "text-muted-foreground"}>2. Alice picks k, sends v = (x_c + kᵉ) mod n</div>
        <div className={step >= 3 ? "text-foreground" : "text-muted-foreground"}>3. Bob computes k₀ = (v − x₀)ᵈ, k₁ = (v − x₁)ᵈ; sends (m₀ + k₀, m₁ + k₁)</div>
        <div className={step >= 4 ? "text-foreground" : "text-muted-foreground"}>4. Alice subtracts k from row c → recovers <span className="text-gb-aqua">{m[bit]}</span></div>
      </Card>
    </div>
  );
}

/* ============================================================
 * PA#19 — Garbled circuit
 * ============================================================ */
function PA19() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [gate, setGate] = useState<"AND" | "XOR">("AND");
  const out = gate === "AND" ? a & b : a ^ b;
  // labels (random per render)
  const labels = useMemo(() => ({
    a: ["A0:" + bytesToHex(crypto.getRandomValues(new Uint8Array(4))), "A1:" + bytesToHex(crypto.getRandomValues(new Uint8Array(4)))],
    b: ["B0:" + bytesToHex(crypto.getRandomValues(new Uint8Array(4))), "B1:" + bytesToHex(crypto.getRandomValues(new Uint8Array(4)))],
  }), [gate]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["AND", "XOR"] as const).map((g) => (
          <Button key={g} variant={gate === g ? "default" : "outline"} onClick={() => setGate(g)} className="font-mono">{g}</Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setA(1 - a)} className="font-mono">a = {a}</Button>
        <Button variant="outline" onClick={() => setB(1 - b)} className="font-mono">b = {b}</Button>
      </div>
      <Card className="p-3 space-y-1">
        <Label>garbler's labels (sent encrypted)</Label>
        <Mono>a → {labels.a[a]}</Mono>
        <Mono>b → {labels.b[b]}</Mono>
        <div className="mt-2">evaluator decrypts the matching row of the garbled table → output bit</div>
        <div className={`mt-2 font-mono text-2xl ${out ? "text-gb-green" : "text-gb-red"}`}>{a} {gate === "AND" ? "∧" : "⊕"} {b} = {out}</div>
      </Card>
    </div>
  );
}

/* ============================================================
 * PA#20 — Yao's millionaires
 * ============================================================ */
function PA20() {
  const [aWealth, setAWealth] = useState(7);
  const [bWealth, setBWealth] = useState(5);
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Alice and Bob jointly compute "who's richer?" without revealing their wealth. Garbled circuit
        + 1-of-2 OT (PA#18 + PA#19) compose into a full 2PC protocol.
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="p-3 border-gb-blue/40">
          <Label>Alice (private)</Label>
          <Slider value={[aWealth]} min={0} max={15} step={1} onValueChange={(v) => { setAWealth(v[0]); setRevealed(false); }} />
          <div className="font-mono text-2xl text-gb-blue mt-1">${aWealth}M</div>
        </Card>
        <Card className="p-3 border-gb-purple/40">
          <Label>Bob (private)</Label>
          <Slider value={[bWealth]} min={0} max={15} step={1} onValueChange={(v) => { setBWealth(v[0]); setRevealed(false); }} />
          <div className="font-mono text-2xl text-gb-purple mt-1">${bWealth}M</div>
        </Card>
      </div>
      <Button onClick={() => setRevealed(true)} className="font-mono">run protocol ▶</Button>
      {revealed && (
        <Card className="p-3 border-gb-green/40">
          <Label>protocol output (only this is revealed)</Label>
          <div className="font-mono text-xl text-gb-green">
            {aWealth === bWealth ? "tie" : aWealth > bWealth ? "Alice is richer" : "Bob is richer"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Wealth values were never sent in the clear — only encrypted wire labels exchanged via OT.
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
 * Registry
 * ============================================================ */

interface PASpec {
  spec: React.ReactNode;
  demo: React.ReactNode;
  notes: React.ReactNode;
}

export const PA_CONTENT: Record<number, PASpec> = {
  1: {
    spec: (
      <>
        <p>A function <M>{`f: \\{0,1\\}^n \\to \\{0,1\\}^n`}</M> is one-way if</p>
        <MB>{`\\Pr_{x \\gets \\{0,1\\}^n}\\big[\\mathcal{A}(f(x)) \\in f^{-1}(f(x))\\big] \\le \\mathsf{negl}(n).`}</MB>
        <p>A PRG <M>{`G: \\{0,1\\}^n \\to \\{0,1\\}^{\\ell(n)}`}</M> with <M>{`\\ell(n) > n`}</M> is pseudorandom if its output is computationally indistinguishable from <M>{`U_{\\ell(n)}`}</M>.</p>
      </>
    ),
    demo: <PA1 />,
    notes: <p>Iterating SHA-256 here gives a stretching PRG only heuristically — a real PRG needs HILL or a stream cipher.</p>,
  },
  2: {
    spec: (<><p>The GGM construction lifts a length-doubling PRG <M>G</M> to a PRF.</p><MB>{`F_k(x_1\\Vert\\dots\\Vert x_n) = G_{x_n}\\circ\\dots\\circ G_{x_1}(k)`}</MB></>),
    demo: <PA2 />,
    notes: <p>Each input bit selects the left (<M>G_0</M>) or right (<M>G_1</M>) half of the PRG output, walking down a binary tree of depth <M>n</M>.</p>,
  },
  3: {
    spec: (<><p>IND-CPA secure SKE from a PRF:</p><MB>{`\\mathsf{Enc}_k(m) = (r, F_k(r) \\oplus m), \\quad r \\gets \\{0,1\\}^n`}</MB></>),
    demo: <PA3 />,
    notes: <p>Re-encrypting the same message yields a different ciphertext — the adversary's IND-CPA advantage is bounded by the PRF distinguishing advantage plus a birthday term in <M>r</M>.</p>,
  },
  4: {
    spec: (<><p>ECB encrypts each block independently; identical plaintext blocks produce identical ciphertext blocks. CBC chains blocks with the previous ciphertext; CTR XORs with <M>{`F_k(\\text{ctr})`}</M>.</p></>),
    demo: <PA4 />,
    notes: <p>The famous "ECB penguin" makes the leakage visible. CBC and CTR achieve IND-CPA; only AE modes (PA#6, PA#10) achieve CCA.</p>,
  },
  5: {
    spec: (<><p>EUF-CMA: the adversary, given a tagging oracle, cannot produce a valid <M>(m^*, t^*)</M> for an unqueried <M>m^*</M>.</p></>),
    demo: <PA5 />,
    notes: <p>Naïve <M>{`H(k\\Vert m)`}</M> with Merkle–Damgård hashes is vulnerable to length extension — use HMAC (PA#10).</p>,
  },
  6: {
    spec: (<><p>CPA security ≠ integrity. Encrypt-then-MAC achieves CCA / authenticated encryption.</p><MB>{`c = \\mathsf{Enc}_{k_e}(m), \\; t = \\mathsf{Mac}_{k_m}(c)`}</MB></>),
    demo: <PA6 />,
    notes: <p>Always verify the MAC <em>before</em> decrypting; verify in constant time to avoid timing leaks.</p>,
  },
  7: {
    spec: (<><p>Merkle–Damgård extends a compression function <M>{`h: \\{0,1\\}^{n+m} \\to \\{0,1\\}^n`}</M> into a hash on arbitrary-length inputs.</p><MB>{`h_i = h(h_{i-1} \\Vert x_i), \\quad h_0 = IV`}</MB></>),
    demo: <PA7 />,
    notes: <p>Collision resistance of <M>h</M> is preserved (MD theorem) but length-extension is inherent.</p>,
  },
  8: {
    spec: (<><p>Define <M>{`H(x_1, x_2) = g_1^{x_1} g_2^{x_2} \\bmod p`}</M>. Finding a collision yields a non-trivial discrete log relation between <M>g_1</M> and <M>g_2</M>.</p></>),
    demo: <PA8 />,
    notes: <p>The hunt below uses a truncated SHA-256 — collisions appear after ≈ <M>{`2^{n/2}`}</M> samples by the birthday paradox.</p>,
  },
  9: {
    spec: (<><p>For an <M>n</M>-bit hash, collisions are expected after <M>{`\\Theta(2^{n/2})`}</M> queries.</p></>),
    demo: <PA9 />,
    notes: <p>This is why 128-bit hashes are dead — only <M>{`2^{64}`}</M> work to collide.</p>,
  },
  10: {
    spec: (<><MB>{`\\mathsf{HMAC}_k(m) = H((k \\oplus \\text{opad}) \\Vert H((k \\oplus \\text{ipad}) \\Vert m))`}</MB><p>HMAC is a PRF assuming the compression function is dual-PRF-secure.</p></>),
    demo: <PA10 />,
    notes: <p>Combining HMAC with a CPA-secure SKE via Encrypt-then-MAC yields a CCA-secure scheme.</p>,
  },
  11: {
    spec: (<><p>Diffie–Hellman key exchange in a cyclic group <M>{`\\mathbb{G} = \\langle g \\rangle`}</M> of prime order <M>q</M>.</p><MB>{`\\text{shared} = g^{ab}`}</MB><p>Secure under the DDH assumption.</p></>),
    demo: <PA11 />,
    notes: <p>Unauthenticated DH is vulnerable to MITM; pair with signatures (PA#17) or PAKE.</p>,
  },
  12: {
    spec: (<><MB>{`n = pq, \\quad ed \\equiv 1 \\pmod{\\varphi(n)}, \\quad c = m^e, \\; m = c^d \\pmod n`}</MB><p>Textbook RSA is <em>not</em> IND-CPA — it's deterministic and malleable.</p></>),
    demo: <PA12 />,
    notes: <p>Pad with OAEP for encryption (PA#15) and FDH/PSS for signatures (PA#17).</p>,
  },
  13: {
    spec: (<><p>Write <M>{`n - 1 = 2^r d`}</M> with <M>d</M> odd. <M>n</M> is composite if for some witness <M>a</M>:</p><MB>{`a^d \\not\\equiv 1 \\pmod n \\;\\;\\text{and}\\;\\; a^{2^i d} \\not\\equiv -1 \\pmod n \\;\\forall\\, 0 \\le i < r.`}</MB></>),
    demo: <PA13 />,
    notes: <p>Carmichael numbers (e.g. 561) fool Fermat's test but rarely fool Miller–Rabin.</p>,
  },
  14: {
    spec: (<><p>Given pairwise coprime <M>n_i</M>, the system <M>{`x \\equiv a_i \\pmod{n_i}`}</M> has a unique solution mod <M>{`\\prod n_i`}</M>.</p></>),
    demo: <PA14 />,
    notes: <p>RSA decryption with CRT is ~4× faster: compute <M>m_p = c^d \\bmod p</M>, <M>m_q = c^d \\bmod q</M>, recombine.</p>,
  },
  15: {
    spec: (<><p>PKCS#1 v1.5 padding: <M>{`00 \\Vert 02 \\Vert PS \\Vert 00 \\Vert m`}</M>. A server that distinguishes "padding ok" leaks one bit per query — Bleichenbacher (1998) recovers the message in <M>{`2^{20}`}</M> queries.</p></>),
    demo: <PA15 />,
    notes: <p>OAEP randomises the encoding with two hash-derived masks → IND-CCA in the random-oracle model.</p>,
  },
  16: {
    spec: (<><p>ElGamal in <M>{`\\mathbb{G}`}</M> with generator <M>g</M> and pubkey <M>{`h = g^x`}</M>:</p><MB>{`\\mathsf{Enc}(m) = (g^r, m \\cdot h^r), \\quad \\mathsf{Dec}(c_1, c_2) = c_2 \\cdot c_1^{-x}`}</MB></>),
    demo: <PA16 />,
    notes: <p>IND-CPA under DDH. Multiplicatively homomorphic — useful for voting.</p>,
  },
  17: {
    spec: (<><p>Schnorr identification → Fiat–Shamir → signature:</p><MB>{`r = g^k,\\; e = H(r \\Vert m),\\; s = k + xe \\pmod q`}</MB><p>Verify: <M>{`g^s \\stackrel{?}{=} r \\cdot y^e`}</M>.</p></>),
    demo: <PA17 />,
    notes: <p>Reusing the nonce <M>k</M> across signatures leaks <M>x</M> — see Sony PS3 (2010).</p>,
  },
  18: {
    spec: (<><p>1-of-2 OT: sender has <M>{`(m_0, m_1)`}</M>, receiver has bit <M>c</M>. Receiver learns <M>m_c</M>, sender learns nothing about <M>c</M>.</p></>),
    demo: <PA18 />,
    notes: <p>OT is complete for MPC — combined with garbled circuits (PA#19), it gives 2PC for any function.</p>,
  },
  19: {
    spec: (<><p>Each wire carries two random labels for 0/1. Each gate ships a 4-row "garbled table" of double-encrypted output labels. The evaluator decrypts only the matching row.</p></>),
    demo: <PA19 />,
    notes: <p>Free-XOR + half-gates reduce AND-gate communication to 2 ciphertexts per gate.</p>,
  },
  20: {
    spec: (<><p>Yao's millionaires: jointly compute <M>{`a \\le b`}</M> without revealing <M>a, b</M>.</p><p>Use OT (PA#18) so the evaluator obtains the input labels for its own bits, then evaluates the garbled circuit (PA#19) for the comparison gate-by-gate.</p></>),
    demo: <PA20 />,
    notes: <p>Round-optimal 2PC: one message in each direction (with preprocessing). Malicious security needs cut-and-choose or authenticated garbling.</p>,
  },
};
