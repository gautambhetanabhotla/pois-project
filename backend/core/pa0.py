"""
PA#0: Minicrypt Scaffolding & Data Flow Logic
Implements Foundation stubs and chaining execution paths to demonstrate the reduction flows.
"""

import pa1, pa2, pa4, pa5, pa7

def _to_bytes(s: str, length: int = 16) -> bytes:
    """Helper to convert hex string or plain string to bytes of fixed length."""
    if s.startswith("0x"):
        try:
            b = bytes.fromhex(s[2:])
        except ValueError:
            b = s.encode()
    else:
        b = s.encode()
    return b.ljust(length, b'\x00')[:length]

def _from_bytes(b: bytes) -> str:
    """Helper to convert bytes to hex string."""
    return f"0x{b.hex()}"

class AESFoundation:
    def asOWF(self, x: str) -> str:
        # Simulate OWF with AES-128 using a fixed key
        k = b"AES_FOUNDATION_K"
        return _from_bytes(pa2.prp_encrypt(k, _to_bytes(x))[:8])
        
    def asPRF(self, k: str, x: str) -> str:
        return _from_bytes(pa2.F(_to_bytes(k), _to_bytes(x))[:8])
        
    def asPRP(self, k: str, x: str) -> str:
        return _from_bytes(pa2.prp_encrypt(_to_bytes(k), _to_bytes(x))[:8])

class DLPFoundation:
    def asOWF(self, x: str) -> str:
        # DLP-based OWF (g^x mod p)
        return _from_bytes(pa1.owf(_to_bytes(x))[:8])
        
    def asOWP(self, x: str) -> str:
        # DLP-based OWP
        return _from_bytes(pa1.owf(_to_bytes(x))[:8])

def get_foundation(name: str):
    if name.upper() == "AES":
        return AESFoundation()
    return DLPFoundation()

def build_chain(foundation_name: str, target: str, key: str, msg: str):
    """Computes Foundation -> Target (Column 1)"""
    f = get_foundation(foundation_name)
    steps = []
    
    if target == "OWF":
        out = f.asOWF(msg)
        steps.append({"func": f"{foundation_name}.asOWF", "input": msg, "output": out})
        
    elif target == "PRG":
        out1 = f.asOWF(key)
        steps.append({"func": f"{foundation_name}.asOWF", "input": key, "output": out1})
        out2 = _from_bytes(pa1.PRG(_to_bytes(out1), 32))
        steps.append({"func": "HILL_PRG_Expansion", "input": out1, "output": out2})
        
    elif target == "PRF":
        if foundation_name == "AES":
            out = f.asPRF(key, msg)
            steps.append({"func": "AES.asPRF", "input": f"k={key}, x={msg}", "output": out})
        else:
            out1 = f.asOWF(key)
            steps.append({"func": "DLP.asOWF", "input": key, "output": out1})
            out2 = _from_bytes(pa1.PRG(_to_bytes(out1), 32))
            steps.append({"func": "HILL_PRG", "input": out1, "output": out2})
            # GGM Tree: Use first 4 bits of msg for demo path
            msg_bits = [(ord(msg[0]) >> i) & 1 for i in range(4)] if msg else [0,0,0,0]
            out3 = _from_bytes(pa2.F_ggm(_to_bytes(out2), msg_bits))
            steps.append({"func": "GGM_Tree", "input": f"k={out2}, x={msg}", "output": out3})
            
    elif target == "SKE":
        if foundation_name == "AES":
            prf_out = f.asPRF(key, "0001")
            steps.append({"func": "AES.asPRF (derive pad)", "input": f"k={key}, IV=0001", "output": prf_out})
        else:
            prf_out = _from_bytes(pa2.F_ggm(_to_bytes(key), [0,0,0,1]))
            steps.append({"func": "DLP -> PRF (GGM)", "input": f"k={key}, IV=0001", "output": prf_out})
            
        c = _from_bytes(pa4.xor_bytes(_to_bytes(prf_out), _to_bytes(msg))[:8])
        steps.append({"func": "XOR_Pad", "input": f"m={msg}, pad={prf_out}", "output": c})
        
    elif target == "MAC":
        if foundation_name == "AES":
            mac_out = f.asPRF(key, msg)
            steps.append({"func": "AES.asPRF (MAC)", "input": f"k={key}, m={msg}", "output": mac_out})
        else:
            mac_out = _from_bytes(pa5.Mac('CBC', _to_bytes(key), _to_bytes(msg))[:8])
            steps.append({"func": "DLP -> PRF -> MAC", "input": f"k={key}, m={msg}", "output": mac_out})
            
    elif target == "CRHF":
        steps.append({"func": "ERROR", "input": "-", "output": "Cannot build CRHF generically from OWF (Simon's separation)"})
        
    return steps

def reduce_chain(source: str, target: str, key: str, msg: str):
    """Computes Source -> Target (Column 2)"""
    steps = []
    
    if source == target:
        steps.append({"func": "Identity", "input": msg, "output": msg})
        return steps
        
    if target == "CRHF" or (source == "PRG" and target == "CRHF"):
        steps.append({"func": "Black-box Separation", "input": "-", "output": "No known black-box reduction."})
        return steps
        
    if source == "CRHF" and target == "MAC":
        h = _from_bytes(pa7.md_hash(_to_bytes(msg))[:8])
        steps.append({"func": "CRHF_Hash", "input": msg, "output": h})
        mac = _from_bytes(pa5.Mac('CBC', _to_bytes(key), _to_bytes(h))[:8])
        steps.append({"func": "HMAC_Construct", "input": f"k={key}, h={h}", "output": mac})
        return steps
        
    if source == "PRG" and target == "PRF":
        h = _from_bytes(pa1.PRG(_to_bytes(key), 16)[:8])
        steps.append({"func": "PRG_Expand", "input": key, "output": h})
        # GGM Tree simulation
        res = _from_bytes(pa2.F_ggm(_to_bytes(h), [1,0,1,0]))
        steps.append({"func": "GGM_Tree", "input": f"G={h}, x={msg}", "output": res})
        return steps
        
    if source == "OWF" and target == "PRG":
        out1 = _from_bytes(pa1.owf(_to_bytes(msg))[:8])
        steps.append({"func": "OWF_Eval", "input": msg, "output": out1})
        out2 = _from_bytes(pa1.PRG(_to_bytes(out1), 32))
        steps.append({"func": "Goldreich_Levin", "input": out1, "output": out2})
        return steps
        
    if source == "PRF" and target == "MAC":
        mac = _from_bytes(pa5.Mac('PRF', _to_bytes(key), _to_bytes(msg))[:8])
        steps.append({"func": "PRF_Eval", "input": f"k={key}, m={msg}", "output": mac})
        return steps
        
    if source == "PRF" and target == "SKE":
        pad = _from_bytes(pa2.F(_to_bytes(key), b"\x00"*16)[:8])
        steps.append({"func": "PRF_Derive_Pad", "input": f"k={key}, IV=0001", "output": pad})
        c = _from_bytes(pa4.xor_bytes(_to_bytes(pad), _to_bytes(msg))[:8])
        steps.append({"func": "XOR", "input": f"pad={pad}, m={msg}", "output": c})
        return steps

    # Fallback generic stub step
    fallback = _from_bytes(pa2.F(_to_bytes(source + target), _to_bytes(key + msg))[:8])
    steps.append({"func": f"Reduction_{source}_to_{target}", "input": f"k={key}, x={msg}", "output": fallback})
    
    return steps
