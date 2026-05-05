import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { M } from "@/components/Math";
import { ShieldAlert, ShieldCheck } from "lucide-react";

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}

type GameState = "setup" | "challenged" | "revealed";

export function PA3() {
  const [m0, setM0] = useState("AAAA");
  const [m1, setM1] = useState("BBBB");
  const [broken, setBroken] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>("setup");
  const [challenge, setChallenge] = useState<{ c_hex: string; b: number; r_hex: string } | null>(null);
  
  const [stats, setStats] = useState({ rounds: 0, wins: 0 });
  const [lastGuess, setLastGuess] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset stats when switching modes
  const handleBrokenToggle = (checked: boolean) => {
    setBroken(checked);
    setStats({ rounds: 0, wins: 0 });
    setGameState("setup");
    setChallenge(null);
  };

  async function encryptChallenge() {
    if (m0.length !== m1.length) {
      setError("m0 and m1 must be of equal length for the IND-CPA game.");
      return;
    }
    if (m0.length === 0) {
      setError("Messages cannot be empty.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pa3/play_round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m0, m1, broken }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setChallenge(d);
      setGameState("challenged");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function submitGuess(guess: number) {
    if (!challenge) return;
    setLastGuess(guess);
    const won = guess === challenge.b;
    setStats(prev => ({ rounds: prev.rounds + 1, wins: prev.wins + (won ? 1 : 0) }));
    setGameState("revealed");
  }

  const advantage = stats.rounds > 0 ? Math.abs((stats.wins / stats.rounds) - 0.5) * 2 : 0;

  return (
    <div className="space-y-6">
      <Card className={`p-4 border-l-4 ${broken ? "border-l-gb-red bg-gb-red/5" : "border-l-gb-green bg-gb-green/5"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {broken ? <ShieldAlert className="w-5 h-5 text-gb-red" /> : <ShieldCheck className="w-5 h-5 text-gb-green" />}
            <div>
              <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-foreground">
                IND-CPA Game
              </h3>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {broken ? "Fixed Nonce (Broken)" : "Fresh Nonce (Secure)"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-background/50 p-2 rounded-lg border border-border/50">
            <Label>Reuse Nonce</Label>
            <Switch checked={broken} onCheckedChange={handleBrokenToggle} className={broken ? "data-[state=checked]:bg-gb-red" : ""} />
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Panel: Adversary Input */}
        <div className="space-y-4">
          <Card className="p-4 bg-muted/20">
            <Label>Step 1: Choose Messages</Label>
            <div className="space-y-3 mt-3">
              <div>
                <Label>m₀</Label>
                <Input 
                  value={m0} 
                  onChange={e => setM0(e.target.value)} 
                  disabled={gameState !== "setup"}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label>m₁</Label>
                <Input 
                  value={m1} 
                  onChange={e => setM1(e.target.value)} 
                  disabled={gameState !== "setup"}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            
            {gameState === "setup" && (
              <Button onClick={encryptChallenge} disabled={loading} className="w-full mt-4 bg-gb-purple hover:bg-gb-purple/80 text-white font-mono uppercase tracking-widest">
                {loading ? "Encrypting..." : "Send to Oracle"}
              </Button>
            )}
            {gameState !== "setup" && (
              <Button onClick={() => setGameState("setup")} className="w-full mt-4 font-mono uppercase tracking-widest" variant="outline">
                Next Round
              </Button>
            )}
            {error && (
              <div className="mt-4 rounded-md border border-gb-red/40 bg-gb-red/10 p-2 text-xs text-gb-red font-mono">
                {error.includes("Failed to fetch") ? "Backend offline or unreachable — start uvicorn on :8000" : `Error: ${error}`}
              </div>
            )}
          </Card>

          <Card className="p-4 bg-background border-border/50">
            <Label>Adversary Stats</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="p-2 bg-muted/30 rounded-lg text-center">
                <div className="text-[10px] text-muted-foreground uppercase mb-1">Rounds</div>
                <div className="font-mono text-lg font-bold">{stats.rounds}</div>
              </div>
              <div className="p-2 bg-muted/30 rounded-lg text-center">
                <div className="text-[10px] text-muted-foreground uppercase mb-1">Wins</div>
                <div className="font-mono text-lg font-bold">{stats.wins}</div>
              </div>
              <div className={`p-2 rounded-lg text-center ${advantage > 0.4 ? "bg-gb-red/20 text-gb-red" : "bg-gb-green/20 text-gb-green"}`}>
                <div className="text-[10px] uppercase mb-1 opacity-80">Advantage</div>
                <div className="font-mono text-lg font-black">{advantage.toFixed(2)}</div>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground font-mono mt-3 leading-relaxed opacity-70">
              Advantage calculates how much better than random guessing you are: <M>{"2 \\cdot |\\Pr[\\text{win}] - 0.5|"}</M>. 
              Should converge to 0 if secure, or jump to 1.0 if broken.
            </p>
          </Card>
        </div>

        {/* Right Panel: Challenger */}
        <div className="space-y-4">
          <Card className={`p-4 border-2 transition-all duration-300 min-h-[300px] flex flex-col ${
            gameState === "setup" ? "border-dashed border-border bg-background/50 items-center justify-center" : 
            "border-gb-purple/30 bg-gb-purple/5"
          }`}>
            {gameState === "setup" ? (
              <div className="text-center opacity-50">
                <div className="font-mono text-sm font-bold uppercase tracking-widest mb-2">Awaiting Messages</div>
                <p className="text-xs">Submit m₀ and m₁ to receive a challenge ciphertext.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
                  <Label>Step 2: Challenge Ciphertext C*</Label>
                  <div className="text-[10px] font-mono bg-gb-purple/20 text-gb-purple px-2 py-1 rounded">
                    Enc(k, m_b)
                  </div>
                </div>
                
                <div className="space-y-3 mb-6 flex-grow">
                  <div>
                    <Label>Nonce (r)</Label>
                    <div className="font-mono text-xs bg-background p-2 rounded border border-border/50 break-all text-muted-foreground">
                      {challenge?.r_hex}
                    </div>
                  </div>
                  <div>
                    <Label>Ciphertext (c)</Label>
                    <div className="font-mono text-sm font-bold bg-background p-3 rounded border border-gb-purple/30 break-all shadow-sm">
                      {challenge?.c_hex}
                    </div>
                  </div>
                </div>

                {gameState === "challenged" ? (
                  <div className="space-y-2 mt-auto">
                    <div className="text-center w-full block"><Label>Step 3: Guess the bit b</Label></div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={() => submitGuess(0)} className="font-mono font-bold text-lg h-12 bg-background border-2 border-border text-foreground hover:bg-muted" variant="outline">
                        b = 0
                      </Button>
                      <Button onClick={() => submitGuess(1)} className="font-mono font-bold text-lg h-12 bg-background border-2 border-border text-foreground hover:bg-muted" variant="outline">
                        b = 1
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={`mt-auto p-4 rounded-xl border-2 text-center animate-in zoom-in-95 ${
                    lastGuess === challenge?.b 
                      ? "bg-gb-green/20 border-gb-green text-gb-green" 
                      : "bg-gb-red/20 border-gb-red text-gb-red"
                  }`}>
                    <div className="font-mono text-2xl font-black mb-1">
                      {lastGuess === challenge?.b ? "CORRECT!" : "WRONG!"}
                    </div>
                    <div className="font-mono text-sm opacity-90">
                      You guessed {lastGuess}, actual bit was <strong>{challenge?.b}</strong>.
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
