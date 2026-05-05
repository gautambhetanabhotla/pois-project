import React, { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface AttackRes {
  x1: string; x2: string; digest: number;
  evaluations: number; expected: number; ratio: number;
  algorithm: string; hash_type: string;
}

// ─── Mini SVG probability chart ───────────────────────────────────────────────
// Renders the theoretical P(collision by k) curve + empirical mean marker

function BirthdayCurveChart({
  probs, mean, birthday, n,
}: {
  probs: number[];
  mean: number;
  birthday: number;
  n: number;
}) {
  const W = 320, H = 120, PAD = 28;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;
  const kMax = probs.length - 1;

  // Scale functions
  const sx = (k: number) => PAD + (k / kMax) * plotW;
  const sy = (p: number) => PAD + plotH - p * plotH;

  // Build SVG path for theoretical curve
  const points = probs.map((p, k) => `${sx(k).toFixed(1)},${sy(p).toFixed(1)}`).join(" ");
  const path = `M ${points.split(" ").join(" L ")}`;

  const meanX = Math.min(sx(mean), PAD + plotW);
  const bdX   = sx(birthday);

  return (
    <svg width={W} height={H} className="overflow-visible">
      {/* Axes */}
      <line x1={PAD} y1={PAD} x2={PAD} y2={PAD + plotH} stroke="var(--color-border)" strokeWidth="1" />
      <line x1={PAD} y1={PAD + plotH} x2={PAD + plotW} y2={PAD + plotH} stroke="var(--color-border)" strokeWidth="1" />

      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((p) => (
        <g key={p}>
          <line x1={PAD - 3} y1={sy(p)} x2={PAD} y2={sy(p)} stroke="var(--color-border)" strokeWidth="1" />
          <text x={PAD - 5} y={sy(p) + 3} textAnchor="end" fontSize="8" fill="var(--color-muted-foreground)" fontFamily="monospace">
            {p.toFixed(2)}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {[0, Math.round(kMax / 4), Math.round(kMax / 2), Math.round(3 * kMax / 4), kMax].map((k) => (
        <text key={k} x={sx(k)} y={PAD + plotH + 12} textAnchor="middle" fontSize="8" fill="var(--color-muted-foreground)" fontFamily="monospace">
          {k}
        </text>
      ))}

      {/* Birthday bound marker */}
      <line x1={bdX} y1={PAD} x2={bdX} y2={PAD + plotH} stroke="#fabd2f" strokeWidth="1" strokeDasharray="3,3" />
      <text x={bdX + 2} y={PAD + 8} fontSize="8" fill="#fabd2f" fontFamily="monospace">2^{n/2}={birthday}</text>

      {/* Empirical mean marker */}
      {mean > 0 && (
        <>
          <line x1={meanX} y1={PAD} x2={meanX} y2={PAD + plotH} stroke="#8ec07c" strokeWidth="1.5" strokeDasharray="2,2" />
          <text x={meanX + 2} y={PAD + 18} fontSize="8" fill="#8ec07c" fontFamily="monospace">
            emp. ≈{Math.round(mean)}
          </text>
        </>
      )}

      {/* Theoretical curve */}
      <polyline points={points} fill="none" stroke="#83a598" strokeWidth="1.5" />

      {/* Axis labels */}
      <text x={PAD + plotW / 2} y={H - 2} textAnchor="middle" fontSize="8" fill="var(--color-muted-foreground)" fontFamily="monospace">
        k (hash evaluations)
      </text>
      <text x={10} y={PAD + plotH / 2} textAnchor="middle" fontSize="8" fill="var(--color-muted-foreground)" fontFamily="monospace"
        transform={`rotate(-90, 10, ${PAD + plotH / 2})`}>
        P(collision)
      </text>
    </svg>
  );
}

// ─── Live Birthday Attack ─────────────────────────────────────────────────────

function BirthdayAttackPanel() {
  const [nBits, setNBits] = useState(12);
  const [algorithm, setAlgorithm] = useState<"naive" | "floyd">("naive");
  const [useDlp, setUseDlp] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AttackRes | null>(null);
  const [error, setError] = useState<string | null>(null);

  const birthday = Math.round(Math.pow(2, nBits / 2));

  const runAttack = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/pa9/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n_bits: nBits, algorithm, use_dlp: useDlp }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [nBits, algorithm, useDlp]);

  const progress = result ? Math.min(100, (result.evaluations / (birthday * 3)) * 100) : 0;

  return (
    <div className="space-y-4">
      <MB>{String.raw`\Pr[\text{collision in } k \text{ queries}] \approx 1 - e^{-k^2/2^{n+1}} \xrightarrow{k=2^{n/2}} 1-e^{-1/2} \approx 39\%`}</MB>

      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="space-y-3">
        <div>
          <Label>
            output bits: n = {nBits} → birthday bound 2<sup>{nBits/2}</sup> = {birthday.toLocaleString()} evaluations
          </Label>
          <Slider
            value={[nBits]}
            min={8}
            max={20}
            step={2}
            onValueChange={(v) => { setNBits(v[0]); setResult(null); }}
            disabled={running}
            className="mt-1"
          />
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as "naive" | "floyd")}
            className="rounded-md border border-border bg-card text-foreground text-xs px-2 py-1.5 font-mono"
            disabled={running || useDlp}
          >
            <option value="naive">naive (dict-based, O(√2ⁿ) space)</option>
            <option value="floyd">Floyd's cycle (tortoise-hare, O(1) space)</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs font-mono cursor-pointer">
            <input
              type="checkbox"
              checked={useDlp}
              onChange={(e) => { setUseDlp(e.target.checked); setAlgorithm("naive"); }}
              disabled={running}
              className="accent-gb-yellow"
            />
            <span className="text-muted-foreground">use truncated DLP hash (slower)</span>
          </label>
        </div>

        <Button onClick={runAttack} disabled={running} className="font-mono">
          {running ? "running birthday attack…" : `run ${algorithm} attack (n=${nBits})`}
        </Button>
      </div>

      {running && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-mono animate-pulse">
            {useDlp ? "running truncated DLP hash (1024-bit modexp per call)…" : "hashing random inputs and checking for collisions…"}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gb-yellow animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {result && !running && (
        <div className="space-y-3 animate-in fade-in duration-300">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2 text-center">
              <div className="text-[9px] text-muted-foreground font-mono uppercase">evaluations</div>
              <div className="text-lg font-mono text-gb-yellow">{result.evaluations.toLocaleString()}</div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-[9px] text-muted-foreground font-mono uppercase">birthday bound</div>
              <div className="text-lg font-mono text-foreground">{birthday.toLocaleString()}</div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-[9px] text-muted-foreground font-mono uppercase">ratio</div>
              <div className={`text-lg font-mono ${result.ratio < 3 ? "text-gb-green" : "text-gb-orange"}`}>
                {result.ratio.toFixed(2)}×
              </div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-[9px] text-muted-foreground font-mono uppercase">algorithm</div>
              <div className="text-xs font-mono text-gb-aqua capitalize">{result.algorithm}</div>
            </Card>
          </div>

          {/* Progress bar relative to birthday bound */}
          <div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
              <span>0</span>
              <span className="text-gb-yellow">← 2^{nBits/2} = {birthday}</span>
              <span>{(birthday * 3).toLocaleString()}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden relative">
              {/* Birthday bound marker */}
              <div className="absolute top-0 bottom-0 w-px bg-gb-yellow/80" style={{ left: `${33.3}%` }} />
              <div className="h-full bg-gb-aqua rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Collision pair */}
          <Card className="p-3 border-gb-red/50 bg-gb-red/5 space-y-1.5">
            <div className="text-xs font-semibold text-gb-red">🎯 Collision found — {result.hash_type}</div>
            <div className="grid sm:grid-cols-2 gap-1 text-[11px] font-mono">
              <div className="flex gap-1.5">
                <span className="text-gb-blue shrink-0">x₁:</span>
                <span className="text-foreground">{result.x1}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="text-gb-purple shrink-0">x₂:</span>
                <span className="text-foreground">{result.x2}</span>
              </div>
              <div className="col-span-2 flex gap-1.5">
                <span className="text-gb-red shrink-0">H(x₁) = H(x₂) =</span>
                <span className="text-gb-red">{result.digest}</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Birthday Probability Curve ───────────────────────────────────────────────

interface CurvePoint {
  n: number; mean: number; std: number; theoretical: number; ratio: number;
}

function CurvePanel() {
  const [points, setPoints] = useState<CurvePoint[]>([]);
  const [probCurves, setProbCurves] = useState<Record<string, number[]>>({});
  const [selectedN, setSelectedN] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa9/curve", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setPoints(d.points);
      setProbCurves(d.prob_curves);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const currentPoint = points.find((p) => p.n === selectedN);
  const currentCurve = probCurves[String(selectedN)] ?? [];
  const birthday = Math.round(Math.pow(2, selectedN / 2));

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground leading-relaxed">
        Runs 30 independent birthday attacks per n ∈ {"{"} 8,10,12,14,16 {"}"}, records the empirical mean
        evaluations until collision, and overlays the theoretical curve{" "}
        <span className="font-mono">1 − e^(−k²/2^(n+1))</span>.
        The empirical mean should land near 2^(n/2) (birthday constant ≈ 1.25×).
      </div>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <Button onClick={run} disabled={loading} className="font-mono">
        {loading ? "running 30 × 5 trials…" : "run empirical curve"}
      </Button>

      {points.length > 0 && (
        <>
          {/* n selector */}
          <div className="flex gap-1">
            {points.map((p) => (
              <button
                key={p.n}
                onClick={() => setSelectedN(p.n)}
                className={`rounded px-2 py-0.5 text-xs font-mono border transition-colors ${
                  selectedN === p.n
                    ? "border-gb-blue/70 bg-gb-blue/20 text-gb-blue"
                    : "border-border text-muted-foreground hover:border-gb-blue/40"
                }`}
              >
                n={p.n}
              </button>
            ))}
          </div>

          {/* Chart */}
          {currentCurve.length > 0 && currentPoint && (
            <Card className="p-3">
              <Label>P(collision by k) — n={selectedN} bits, birthday bound = {birthday}</Label>
              <BirthdayCurveChart
                probs={currentCurve}
                mean={currentPoint.mean}
                birthday={birthday}
                n={selectedN}
              />
              <div className="mt-2 grid sm:grid-cols-3 gap-2 text-[10px] font-mono">
                <div>
                  <span className="text-muted-foreground">theoretical 2^(n/2): </span>
                  <span className="text-gb-yellow">{currentPoint.theoretical}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">empirical mean: </span>
                  <span className="text-gb-green">{currentPoint.mean}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ratio: </span>
                  <span className={currentPoint.ratio < 2 ? "text-gb-green" : "text-gb-orange"}>
                    {currentPoint.ratio.toFixed(3)}×
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Summary table */}
          <Card className="p-3 border-border/50">
            <Label>all n values — empirical vs theoretical</Label>
            <div className="mt-1 space-y-1">
              <div className="grid grid-cols-5 gap-1 text-[9px] font-mono text-muted-foreground border-b border-border pb-1">
                <span>n</span>
                <span>theoretical</span>
                <span>mean</span>
                <span>std</span>
                <span>ratio</span>
              </div>
              {points.map((p) => (
                <div key={p.n} className="grid grid-cols-5 gap-1 text-[10px] font-mono">
                  <span className="text-gb-blue">{p.n}</span>
                  <span>{p.theoretical}</span>
                  <span className="text-gb-green">{p.mean}</span>
                  <span className="text-muted-foreground">±{p.std}</span>
                  <span className={p.ratio < 2 ? "text-gb-green" : "text-gb-orange"}>{p.ratio.toFixed(3)}×</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── MD5 / SHA-1 Context ─────────────────────────────────────────────────────

function ContextPanel() {
  const [algos, setAlgos] = useState<{ name: string; n_bits: number; birthday_exp: number; years_str: string; status: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa9/context", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setAlgos(d.algorithms);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const colorOf = (name: string) =>
    name === "MD5" ? "text-gb-red" : name === "SHA-1" ? "text-gb-orange" : "text-gb-green";
  const borderOf = (name: string) =>
    name === "MD5" ? "border-gb-red/40" : name === "SHA-1" ? "border-gb-orange/40" : "border-gb-green/40";

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground leading-relaxed">
        At 10⁹ hashes/second: how long does a birthday collision attack take on real hash functions?
        This contextualises why MD5 is broken and SHA-1 deprecated.
      </div>
      <MB>{String.raw`\text{time} = \frac{2^{n/2}}{10^9 \text{ hash/sec}}`}</MB>
      {error && (
        <div className="rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
          {error}
        </div>
      )}
      <Button onClick={run} disabled={loading} className="font-mono">
        {loading ? "computing…" : "compute birthday bounds"}
      </Button>

      {algos.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {algos.map((a) => (
            <Card key={a.name} className={`p-3 border ${borderOf(a.name)} space-y-2`}>
              <div className={`text-lg font-mono font-bold ${colorOf(a.name)}`}>{a.name}</div>
              <div className="space-y-0.5 text-[10px] font-mono">
                <div><span className="text-muted-foreground">output: </span>{a.n_bits} bits</div>
                <div>
                  <span className="text-muted-foreground">birthday: </span>
                  2<sup>{a.birthday_exp}</sup> ops
                </div>
                <div><span className="text-muted-foreground">@10⁹/s: </span><span className={colorOf(a.name)}>{a.years_str}</span></div>
              </div>
              <div className={`text-[9px] font-mono leading-tight ${colorOf(a.name)}`}>{a.status}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function PA9() {
  return (
    <Tabs defaultValue="attack">
      <TabsList>
        <TabsTrigger value="attack" className="font-mono">birthday attack</TabsTrigger>
        <TabsTrigger value="curve" className="font-mono">probability curve</TabsTrigger>
        <TabsTrigger value="context" className="font-mono">MD5/SHA-1 context</TabsTrigger>
      </TabsList>
      <TabsContent value="attack" className="mt-4">
        <BirthdayAttackPanel />
      </TabsContent>
      <TabsContent value="curve" className="mt-4">
        <CurvePanel />
      </TabsContent>
      <TabsContent value="context" className="mt-4">
        <ContextPanel />
      </TabsContent>
    </Tabs>
  );
}
