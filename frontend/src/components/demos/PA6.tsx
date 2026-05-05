import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { bytesToHex, hexToBytes } from "@/lib/crypto-helpers";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{children}</div>;
}
function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-foreground">{children}</span>;
}

export function PA6() {
  const [m, setM] = useState("send 0100 USD");
  const [flip, setFlip] = useState(10 * 8); // default to flipping bit in "0100"
  
  // Keys
  const [kEnc] = useState(() => bytesToHex(crypto.getRandomValues(new Uint8Array(16))));
  const [kMac] = useState(() => bytesToHex(crypto.getRandomValues(new Uint8Array(16))));

  const [encData, setEncData] = useState<{ nonce: string, c: string, t: string } | null>(null);
  const [decCpa, setDecCpa] = useState<string>("");
  const [decCca, setDecCca] = useState<string>("");
  const [ccaError, setCcaError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    
    // Encrypt
    fetch("/api/pa6/encrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key_enc_hex: kEnc, key_mac_hex: kMac, message: m }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setEncData({ nonce: d.nonce_hex, c: d.ciphertext_hex, t: d.tag_hex });
      })
      .catch(console.error);

    return () => { cancelled = true; };
  }, [m, kEnc, kMac]);

  useEffect(() => {
    if (!encData) return;
    let cancelled = false;
    
    // 1. Flip bit in ciphertext
    const cBytes = hexToBytes(encData.c);
    const maxBit = cBytes.length * 8 - 1;
    const safeFlip = Math.min(flip, maxBit);
    
    if (safeFlip >= 0) {
      cBytes[Math.floor(safeFlip / 8)] ^= 1 << (safeFlip % 8);
    }
    const cForged = bytesToHex(cBytes);

    // 2. CPA Decrypt (decrypt without verifying MAC)
    fetch("/api/pa6/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        key_enc_hex: kEnc, 
        key_mac_hex: kMac, 
        nonce_hex: encData.nonce, 
        ciphertext_hex: cForged, 
        tag_hex: encData.t,
        cca_enabled: false 
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setDecCpa(d.plaintext);
      })
      .catch(console.error);

    // 3. CCA Decrypt (verify MAC before decrypting)
    fetch("/api/pa6/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        key_enc_hex: kEnc, 
        key_mac_hex: kMac, 
        nonce_hex: encData.nonce, 
        ciphertext_hex: cForged, 
        tag_hex: encData.t,
        cca_enabled: true 
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setDecCca(d.plaintext);
        setCcaError(d.error);
      })
      .catch(console.error);

    return () => { cancelled = true; };
  }, [encData, flip, kEnc, kMac]);

  const maxBits = (encData ? hexToBytes(encData.c).length : 0) * 8 - 1;

  return (
    <div className="space-y-3">
      <Input value={m} onChange={(e) => setM(e.target.value)} />
      <div>
        <Label>flip bit position: {flip}</Label>
        <Slider value={[flip]} min={0} max={Math.max(0, maxBits)} step={1} onValueChange={(v) => setFlip(v[0])} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="p-3">
          <Label>CPA-only SKE</Label>
          <Mono>{decCpa || "…"}</Mono>
          <div className="mt-2 text-[11px] text-gb-red">attacker mutated the message silently</div>
        </Card>
        <Card className="p-3">
          <Label>Encrypt-then-MAC</Label>
          <Mono>{ccaError ? "⊥ verification failed" : (decCca || "…")}</Mono>
          {ccaError && <div className="mt-2 text-[11px] text-gb-green">tampering detected → reject</div>}
        </Card>
      </div>
    </div>
  );
}
