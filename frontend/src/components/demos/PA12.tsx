import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, ShieldAlert, Key } from "lucide-react";

function Mono({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <span className={`font-mono text-[11px] break-all ${className}`}>{children}</span>;
}

export function PA12() {
  const [keys, setKeys] = useState<{n: string, e: string} | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(true);
  
  const [message, setMessage] = useState("yes");
  const [loadingEnc, setLoadingEnc] = useState(false);
  
  const [results, setResults] = useState<any>(null);
  const [mode, setMode] = useState<"textbook" | "pkcs15">("textbook");

  useEffect(() => {
    fetch("/api/pa12/keygen")
      .then(res => res.json())
      .then(data => {
        setKeys(data);
        setLoadingKeys(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingKeys(false);
      });
  }, []);

  const handleEncryptTwice = async (selectedMode: "textbook" | "pkcs15") => {
    if (!keys || !message.trim()) return;
    setLoadingEnc(true);
    setMode(selectedMode);
    
    try {
      const res = await fetch("/api/pa12/encrypt_twice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          n: keys.n,
          e: keys.e,
          message: message.trim()
        })
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
    }
    setLoadingEnc(false);
  };

  if (loadingKeys) return <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Generating 512-bit RSA Keys...</div>;
  if (!keys) return <div className="text-red-500">Failed to generate keys</div>;

  const isTextbook = mode === "textbook";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-4 border">
        <Key className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Public Key (512-bit)</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-xs text-muted-foreground mt-0.5">e =</span>
            <Mono>{keys.e}</Mono>
            <span className="text-xs text-muted-foreground mt-0.5">N =</span>
            <div className="overflow-hidden">
              <Mono className="text-muted-foreground break-all">{keys.n}</Mono>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 space-y-2 w-full">
          <label className="text-sm font-medium">Short Message (e.g. vote)</label>
          <Input 
            value={message} 
            onChange={e => setMessage(e.target.value)} 
            placeholder="yes" 
            className="font-mono"
            maxLength={20}
          />
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => handleEncryptTwice("textbook")} 
            disabled={loadingEnc || !message.trim()}
            variant={isTextbook && results ? "default" : "outline"}
            className="w-44"
          >
            {loadingEnc && mode === "textbook" ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "Encrypt (Textbook)"}
          </Button>
          <Button 
            onClick={() => handleEncryptTwice("pkcs15")} 
            disabled={loadingEnc || !message.trim()}
            variant={!isTextbook && results ? "default" : "outline"}
            className="w-44"
          >
            {loadingEnc && mode === "pkcs15" ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "Encrypt (PKCS#1 v1.5)"}
          </Button>
        </div>
      </div>

      {results && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isTextbook ? (
            <div className="bg-gb-red/10 border border-gb-red/30 p-4 rounded-lg flex items-start gap-3 text-gb-red">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm mb-1">Identical ciphertexts: plaintext leaked</div>
                <div className="text-xs opacity-90">
                  Textbook RSA is deterministic. Encrypting the same message always produces the exact same ciphertext. An attacker who sees this ciphertext can guess the message, encrypt their guess, and verify if it matches.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gb-green/10 border border-gb-green/30 p-4 rounded-lg flex items-start gap-3 text-gb-green">
              <Shield className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm mb-1">Ciphertexts differ: semantic security achieved</div>
                <div className="text-xs opacity-90">
                  PKCS#1 v1.5 adds random padding bytes (PS) before encrypting. Even if the underlying message is identical, the random padding ensures the resulting ciphertexts are completely different, preventing guessing attacks.
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Card className={`p-4 space-y-3 border-2 ${isTextbook ? "border-gb-red/20" : "border-gb-green/20"}`}>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
                <span>Encryption 1</span>
              </div>
              <div className="bg-muted/50 p-3 rounded border">
                <Mono className={isTextbook ? "text-gb-red font-bold" : ""}>{isTextbook ? results.textbook_c1 : results.pkcs15_c1}</Mono>
              </div>
              {!isTextbook && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Padding Bytes (PS)</div>
                  <div className="bg-gb-purple/10 p-2 rounded border border-gb-purple/20">
                    <Mono className="text-gb-purple font-bold">{results.pkcs15_ps1}</Mono>
                  </div>
                </div>
              )}
            </Card>

            <Card className={`p-4 space-y-3 border-2 ${isTextbook ? "border-gb-red/50 shadow-sm" : "border-gb-green/50 shadow-sm"}`}>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Encryption 2</div>
              <div className="bg-muted/50 p-3 rounded border">
                <Mono className={isTextbook ? "text-gb-red font-bold" : ""}>
                  {isTextbook ? results.textbook_c2 : results.pkcs15_c2}
                </Mono>
              </div>
              {!isTextbook && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Padding Bytes (PS)</div>
                  <div className="bg-gb-purple/10 p-2 rounded border border-gb-purple/20">
                    <Mono className="text-gb-purple font-bold">{results.pkcs15_ps2}</Mono>
                  </div>
                </div>
              )}
            </Card>
          </div>
          
          {!isTextbook && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg border">
              <strong>PKCS#1 v1.5 Structure:</strong> <Mono>00 || 02 || PS || 00 || M</Mono><br/>
              The <code>PS</code> (Padding String) consists of non-zero random bytes. Notice how the padding bytes differ entirely between the two encryptions, which radically changes the large integer that gets exponentiated by <code>e</code>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
