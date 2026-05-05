"""
PA#0: Minicrypt Scaffolding & Data Flow Logic
Implements Foundation stubs and chaining execution paths to demonstrate the reduction flows.
"""

import hashlib

class AESFoundation:
    def asOWF(self, x: str) -> str:
        h = hashlib.sha256(f"AES_OWF_{x}".encode()).hexdigest()
        return f"0x{h[:16]}"
        
    def asPRF(self, k: str, x: str) -> str:
        h = hashlib.sha256(f"AES_PRF_{k}_{x}".encode()).hexdigest()
        return f"0x{h[:16]}"
        
    def asPRP(self, k: str, x: str) -> str:
        h = hashlib.sha256(f"AES_PRP_{k}_{x}".encode()).hexdigest()
        return f"0x{h[:16]}"

class DLPFoundation:
    def asOWF(self, x: str) -> str:
        h = hashlib.sha256(f"DLP_OWF_{x}".encode()).hexdigest()
        return f"0x{h[:16]}"
        
    def asOWP(self, x: str) -> str:
        h = hashlib.sha256(f"DLP_OWP_{x}".encode()).hexdigest()
        return f"0x{h[:16]}"

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
        h = hashlib.sha256(f"PRG_{out1}".encode()).hexdigest()
        out2 = f"0x{h[:32]}"
        steps.append({"func": "HILL_PRG_Expansion", "input": out1, "output": out2})
        
    elif target == "PRF":
        if foundation_name == "AES":
            out = f.asPRF(key, msg)
            steps.append({"func": "AES.asPRF", "input": f"k={key}, x={msg}", "output": out})
        else:
            out1 = f.asOWF(key)
            steps.append({"func": "DLP.asOWF", "input": key, "output": out1})
            out2 = f"0x{hashlib.sha256(out1.encode()).hexdigest()[:32]}"
            steps.append({"func": "HILL_PRG", "input": out1, "output": out2})
            out3 = f"0x{hashlib.sha256((out2+msg).encode()).hexdigest()[:16]}"
            steps.append({"func": "GGM_Tree", "input": f"k={out2}, x={msg}", "output": out3})
            
    elif target == "SKE":
        if foundation_name == "AES":
            prf_out = f.asPRF(key, "0001")
            steps.append({"func": "AES.asPRF (derive pad)", "input": f"k={key}, IV=0001", "output": prf_out})
        else:
            prf_out = f"0x{hashlib.sha256(key.encode()).hexdigest()[:16]}"
            steps.append({"func": "DLP -> PRF (GGM)", "input": f"k={key}, IV=0001", "output": prf_out})
            
        c = f"0x{hashlib.sha256((prf_out + msg).encode()).hexdigest()[:16]}"
        steps.append({"func": "XOR_Pad", "input": f"m={msg}, pad={prf_out}", "output": c})
        
    elif target == "MAC":
        if foundation_name == "AES":
            mac_out = f.asPRF(key, msg)
            steps.append({"func": "AES.asPRF (MAC)", "input": f"k={key}, m={msg}", "output": mac_out})
        else:
            mac_out = f"0x{hashlib.sha256((key+msg).encode()).hexdigest()[:16]}"
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
        h = hashlib.sha256(msg.encode()).hexdigest()[:16]
        steps.append({"func": "CRHF_Hash", "input": msg, "output": f"0x{h}"})
        mac = hashlib.sha256((key+h).encode()).hexdigest()[:16]
        steps.append({"func": "HMAC_Construct", "input": f"k={key}, h=0x{h}", "output": f"0x{mac}"})
        return steps
        
    if source == "PRG" and target == "PRF":
        h = hashlib.sha256(key.encode()).hexdigest()[:16]
        steps.append({"func": "PRG_Expand", "input": key, "output": f"0x{h}"})
        steps.append({"func": "GGM_Tree", "input": f"G={h}, x={msg}", "output": f"0x{hashlib.sha256((h+msg).encode()).hexdigest()[:16]}"})
        return steps
        
    if source == "OWF" and target == "PRG":
        out1 = f"0x{hashlib.sha256(msg.encode()).hexdigest()[:16]}"
        steps.append({"func": "OWF_Eval", "input": msg, "output": out1})
        steps.append({"func": "Goldreich_Levin", "input": out1, "output": f"0x{hashlib.sha256(out1.encode()).hexdigest()[:32]}"})
        return steps
        
    if source == "PRF" and target == "MAC":
        mac = f"0x{hashlib.sha256((key+msg).encode()).hexdigest()[:16]}"
        steps.append({"func": "PRF_Eval", "input": f"k={key}, m={msg}", "output": mac})
        return steps
        
    if source == "PRF" and target == "SKE":
        pad = f"0x{hashlib.sha256(key.encode()).hexdigest()[:16]}"
        steps.append({"func": "PRF_Derive_Pad", "input": f"k={key}, IV=0001", "output": pad})
        steps.append({"func": "XOR", "input": f"pad={pad}, m={msg}", "output": f"0x{hashlib.sha256((pad+msg).encode()).hexdigest()[:16]}"})
        return steps

    # Fallback generic stub step
    steps.append({"func": f"Reduction_{source}_to_{target}", "input": f"k={key}, x={msg}", "output": f"0x{hashlib.sha256((source+target+key+msg).encode()).hexdigest()[:16]}"})
    
    return steps
