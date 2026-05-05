import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { M } from "@/components/Math";
import { Loader2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function Mono({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <span className={`font-mono text-xs ${className}`}>{children}</span>;
}

export function PA11() {
  const [params, setParams] = useState<{p: string, g: string} | null>(null);
  const [loadingParams, setLoadingParams] = useState(true);
  
  const [a, setA] = useState("0x123");
  const [b, setB] = useState("0x456");
  const [e, setE] = useState("0x789");
  
  const [enableEve, setEnableEve] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [exchangeResult, setExchangeResult] = useState<any>(null);
  
  const [cdhTime, setCdhTime] = useState<number | null>(null);
  const [cdhShared, setCdhShared] = useState<string | null>(null);
  const [cdhLoading, setCdhLoading] = useState(false);

  // Fetch parameters on mount
  useEffect(() => {
    fetch("/api/pa11/params")
      .then(res => res.json())
      .then(data => {
        setParams(data);
        setLoadingParams(false);
      })
      .catch(err => {
        console.error("Failed to load params", err);
        setLoadingParams(false);
      });
  }, []);

  const randomizeAll = () => {
    if (!params) return;
    const randomHex = () => "0x" + Math.floor(Math.random() * 0xFFFFFF).toString(16);
    setA(randomHex());
    setB(randomHex());
    setE(randomHex());
    setExchangeResult(null);
  };

  const handleExchange = async () => {
    if (!params) return;
    setExchanging(true);
    setExchangeResult(null);
    setCdhShared(null);
    setCdhTime(null);
    
    // Simulate animation delay
    setTimeout(async () => {
      try {
        const endpoint = enableEve ? "/api/pa11/dh_mitm" : "/api/pa11/dh";
        const body = enableEve 
          ? { p: params.p, g: params.g, a, b, e }
          : { p: params.p, g: params.g, a, b };
          
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        setExchangeResult(data);
      } catch (err) {
        console.error("Exchange failed", err);
      }
      setExchanging(false);
    }, 1500); // 1.5s for the animation
  };

  const runCDH = async () => {
    if (!params || !exchangeResult) return;
    setCdhLoading(true);
    try {
      const res = await fetch("/api/pa11/cdh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p: params.p,
          g: params.g,
          A: exchangeResult.A,
          B: exchangeResult.B
        })
      });
      const data = await res.json();
      setCdhShared(data.shared);
      setCdhTime(data.elapsed);
    } catch (err) {
      console.error("CDH failed", err);
    }
    setCdhLoading(false);
  };

  if (loadingParams) return <div className="flex items-center gap-2"><Loader2 className="animate-spin w-4 h-4"/> Loading parameters...</div>;
  if (!params) return <div className="text-red-500">Failed to load parameters</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6 bg-muted/50 p-4 rounded-lg">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Global Parameters</div>
          <div className="flex gap-4">
            <div><M>p = </M> <Mono>{params.p}</Mono></div>
            <div><M>g = </M> <Mono>{params.g}</Mono></div>
          </div>
        </div>
        
        <div className="flex-1"></div>
        
        <div className="flex items-center gap-2">
          <Switch id="eve-mode" checked={enableEve} onCheckedChange={(v) => { setEnableEve(v); setExchangeResult(null); }} />
          <Label htmlFor="eve-mode" className="text-sm font-medium text-gb-red">Enable Eve (MITM)</Label>
        </div>
        
        <Button onClick={randomizeAll} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Randomize Secrets
        </Button>
      </div>

      <div className="relative">
        <div className={`grid gap-4 ${enableEve ? "grid-cols-3" : "grid-cols-2"}`}>
          {/* Alice Panel */}
          <Card className="p-4 border-gb-blue/40 flex flex-col gap-3 relative">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-bold text-gb-blue">Alice</div>
            <div>
              <Label className="text-xs">Secret Exponent <M>a</M></Label>
              <Input className="font-mono h-8 mt-1" value={a} onChange={ev => setA(ev.target.value)} />
            </div>
            {exchangeResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 space-y-2 bg-muted/30 p-2 rounded">
                <div><span className="text-xs text-muted-foreground">Computed Public <M>A</M>:</span> <br/><Mono>{exchangeResult.A}</Mono></div>
                <div>
                  <span className="text-xs text-muted-foreground">Received:</span> <br/>
                  <Mono>{enableEve ? exchangeResult.B_prime : exchangeResult.B}</Mono>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Shared Secret <M>K_A</M>:</span> <br/>
                  <Mono className="text-gb-green font-bold bg-gb-green/10 p-1 rounded inline-block w-full truncate">{exchangeResult.sharedA}</Mono>
                </div>
              </motion.div>
            )}
          </Card>

          {/* Eve Panel */}
          <AnimatePresence>
            {enableEve && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Card className="p-4 border-gb-red/50 flex flex-col gap-3 relative h-full bg-gb-red/5">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-bold text-gb-red flex items-center justify-between">
                    <span>Eve (MITM)</span>
                    <span className="text-[10px] bg-gb-red/20 text-gb-red px-1 rounded">ACTIVE</span>
                  </div>
                  <div>
                    <Label className="text-xs">Eve's Secret <M>e</M></Label>
                    <Input className="font-mono h-8 mt-1 border-gb-red/30" value={e} onChange={ev => setE(ev.target.value)} />
                  </div>
                  {exchangeResult && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 space-y-2 bg-background/80 p-2 rounded border border-gb-red/20">
                      <div><span className="text-xs text-muted-foreground">Intercepted <M>A</M>:</span> <br/><Mono>{exchangeResult.A}</Mono></div>
                      <div><span className="text-xs text-muted-foreground">Intercepted <M>B</M>:</span> <br/><Mono>{exchangeResult.B}</Mono></div>
                      <div className="h-px bg-gb-red/20 my-1"></div>
                      <div>
                        <span className="text-xs text-muted-foreground">Forged <M>A' = g^e</M>:</span> <br/>
                        <Mono>{exchangeResult.A_prime}</Mono>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Forged <M>B' = g^e</M>:</span> <br/>
                        <Mono>{exchangeResult.B_prime}</Mono>
                      </div>
                      <div className="h-px bg-gb-red/20 my-1"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="overflow-hidden">
                          <span className="text-[10px] text-muted-foreground">Shared w/ Alice:</span><br/>
                          <Mono className="text-gb-green font-bold block truncate">{exchangeResult.sharedEveAlice || exchangeResult.sharedEveA}</Mono>
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-[10px] text-muted-foreground">Shared w/ Bob:</span><br/>
                          <Mono className="text-gb-green font-bold block truncate">{exchangeResult.sharedEveBob || exchangeResult.sharedEveB}</Mono>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bob Panel */}
          <Card className="p-4 border-gb-purple/40 flex flex-col gap-3 relative overflow-hidden">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-bold text-gb-purple">Bob</div>
            <div>
              <Label className="text-xs">Secret Exponent <M>b</M></Label>
              <Input className="font-mono h-8 mt-1" value={b} onChange={ev => setB(ev.target.value)} />
            </div>
            {exchangeResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 space-y-2 bg-muted/30 p-2 rounded">
                <div><span className="text-xs text-muted-foreground">Computed Public <M>B</M>:</span> <br/><Mono>{exchangeResult.B}</Mono></div>
                <div>
                  <span className="text-xs text-muted-foreground">Received:</span> <br/>
                  <Mono>{enableEve ? exchangeResult.A_prime : exchangeResult.A}</Mono>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Shared Secret <M>K_B</M>:</span> <br/>
                  <Mono className="text-gb-green font-bold bg-gb-green/10 p-1 rounded inline-block w-full truncate">{exchangeResult.sharedB}</Mono>
                </div>
              </motion.div>
            )}
          </Card>

          {/* Animation Overlays */}
          <AnimatePresence>
            {exchanging && !enableEve && (
              <>
                <motion.div
                  initial={{ left: "16%", top: "60%", opacity: 0 }}
                  animate={{ left: "84%", opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="absolute z-10 bg-gb-blue text-white text-xs px-2 py-1 rounded font-mono shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-1/2"
                >
                  Sending A...
                </motion.div>
                <motion.div
                  initial={{ left: "84%", top: "70%", opacity: 0 }}
                  animate={{ left: "16%", opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="absolute z-10 bg-gb-purple text-white text-xs px-2 py-1 rounded font-mono shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-1/2"
                >
                  Sending B...
                </motion.div>
              </>
            )}
            {exchanging && enableEve && (
              <>
                <motion.div
                  initial={{ left: "16%", top: "50%", opacity: 0 }}
                  animate={{ left: "50%", opacity: [0, 1, 0] }}
                  transition={{ duration: 0.75, ease: "easeInOut" }}
                  className="absolute z-10 bg-gb-blue text-white text-[10px] px-2 py-1 rounded font-mono shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-1/2"
                >
                  A (intercepted)
                </motion.div>
                <motion.div
                  initial={{ left: "84%", top: "50%", opacity: 0 }}
                  animate={{ left: "50%", opacity: [0, 1, 0] }}
                  transition={{ duration: 0.75, ease: "easeInOut" }}
                  className="absolute z-10 bg-gb-purple text-white text-[10px] px-2 py-1 rounded font-mono shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-1/2"
                >
                  B (intercepted)
                </motion.div>
                <motion.div
                  initial={{ left: "50%", top: "60%", opacity: 0 }}
                  animate={{ left: "16%", opacity: [0, 0, 1, 0] }}
                  transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                  className="absolute z-10 bg-gb-red text-white text-[10px] px-2 py-1 rounded font-mono shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-1/2"
                >
                  B' (forged)
                </motion.div>
                <motion.div
                  initial={{ left: "50%", top: "60%", opacity: 0 }}
                  animate={{ left: "84%", opacity: [0, 0, 1, 0] }}
                  transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                  className="absolute z-10 bg-gb-red text-white text-[10px] px-2 py-1 rounded font-mono shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-1/2"
                >
                  A' (forged)
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex justify-center my-4">
        <Button onClick={handleExchange} disabled={exchanging || !params} size="lg" className="w-48 relative overflow-hidden group border border-primary/50">
          <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          {exchanging ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Exchange Keys"}
        </Button>
      </div>

      {exchangeResult && !enableEve && (
        <Card className="p-4 bg-muted/30 border-muted">
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-bold">CDH Hardness Demo</div>
            <Button onClick={runCDH} disabled={cdhLoading} variant="secondary" size="sm" className="border">
              {cdhLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Run Brute-Force CDH"}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            To compute the shared secret without <M>a</M> or <M>b</M>, an attacker must solve the Computational Diffie-Hellman (CDH) problem. For these small parameters, we can brute-force <M>a</M> by computing <M>g^i \pmod p</M> until it equals <M>A</M>, then compute <M>B^i \pmod p</M>.
          </div>
          
          <AnimatePresence>
            {cdhShared && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-background border rounded-md p-3 flex flex-wrap gap-4 items-center">
                <div>
                  <span className="text-xs text-muted-foreground">Recovered Secret:</span><br/>
                  <Mono className="text-gb-red font-bold text-sm">{cdhShared}</Mono>
                </div>
                <div className="flex-1"></div>
                <div>
                  <span className="text-xs text-muted-foreground">Time taken:</span><br/>
                  <Mono className="text-sm">{cdhTime?.toFixed(4)} seconds</Mono>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

    </div>
  );
}
