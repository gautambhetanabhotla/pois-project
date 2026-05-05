from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Make backend/core/ importable so `import pa1, pa2, pa3` resolves the same way
# the PA modules import each other internally (pa2 does bare `import pa1`).
_CORE = Path(__file__).resolve().parent / "core"
if str(_CORE) not in sys.path:
    sys.path.insert(0, str(_CORE))

import pa1  # noqa: E402
import pa2  # noqa: E402
import pa3  # noqa: E402


app = FastAPI(title="PoIS")

# Dev-only: open CORS so the Vite dev server (any port Lovable picks) can reach us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/api/hello")
async def hello():
    return {"message": "Hello from API"}

@app.get("/api/pa20")
async def pa20(circuit: str, input0: int, input1: int):
    from core.pa20 import int_to_bits, Secure_Eval
    if circuit == "millionaire":
        from core.pa20 import millionaires_problem_circuit
        result = Secure_Eval(millionaires_problem_circuit(8), int_to_bits(input0, 16), int_to_bits(input1, 16))
        return {"result": result[0]}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown circuit: {circuit}")
def _hex_to_bytes(h: str) -> bytes:
    h = h.strip().replace(" ", "")
    if not h:
        return b""
    if len(h) % 2 == 1:
        h = "0" + h
    try:
        return bytes.fromhex(h)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"invalid hex: {e}")


# --- PA #1 — OWF + HILL PRG ---------------------------------------------------

class PA1PrgReq(BaseModel):
    seed_hex: str = Field("", description="seed in hex (any length; auto-stretched)")
    out_bytes: int = Field(64, ge=1, le=256)


class PA1PrgRes(BaseModel):
    output_hex: str
    ones_ratio: float
    p_monobit: float
    p_runs: float
    p_serial1: float
    p_serial2: float


@app.post("/api/pa1/prg", response_model=PA1PrgRes)
def pa1_prg(req: PA1PrgReq):
    if req.seed_hex:
        seed_bytes = _hex_to_bytes(req.seed_hex)
        if not seed_bytes:
            seed_bytes = b"\x00"
    else:
        seed_bytes = os.urandom(pa1.SEED_BYTES)
    out = pa1.PRG(seed_bytes, req.out_bytes)
    bit_count = sum(bin(b).count("1") for b in out)
    ratio = bit_count / (8 * len(out)) if out else 0.0
    p_s1, p_s2 = pa1.serial_test(out, m=3)
    return PA1PrgRes(
        output_hex=out.hex(),
        ones_ratio=ratio,
        p_monobit=pa1.monobit_test(out),
        p_runs=pa1.runs_test(out),
        p_serial1=p_s1,
        p_serial2=p_s2,
    )


class PA1OwfReq(BaseModel):
    x_hex: str


class PA1OwfRes(BaseModel):
    y_hex: str


@app.post("/api/pa1/owf", response_model=PA1OwfRes)
def pa1_owf(req: PA1OwfReq):
    x = _hex_to_bytes(req.x_hex)
    if not x:
        raise HTTPException(400, "x_hex must be non-empty")
    return PA1OwfRes(y_hex=pa1.owf(x).hex())


# --- PA #2 — AES PRP + GGM PRF ------------------------------------------------

class PA2GgmReq(BaseModel):
    key_hex: str = ""
    bits: str = Field(..., min_length=1, max_length=12, pattern=r"^[01]+$")


class PA2GgmRes(BaseModel):
    result_hex: str
    path_hex: list[str]


@app.post("/api/pa2/ggm", response_model=PA2GgmRes)
def pa2_ggm(req: PA2GgmReq):
    key = _hex_to_bytes(req.key_hex) if req.key_hex else os.urandom(16)
    if len(key) == 0:
        key = os.urandom(16)
    s = key
    path = [s.hex()]
    for ch in req.bits:
        s = pa1.G1(s) if ch == "1" else pa1.G0(s)
        path.append(s.hex())
    return PA2GgmRes(result_hex=s.hex(), path_hex=path)


class PA2PrpReq(BaseModel):
    key_hex: str
    block_hex: str


class PA2PrpRes(BaseModel):
    ct_hex: str


@app.post("/api/pa2/prp", response_model=PA2PrpRes)
def pa2_prp(req: PA2PrpReq):
    k = _hex_to_bytes(req.key_hex)
    b = _hex_to_bytes(req.block_hex)
    if len(k) != pa2.BLOCK_SIZE:
        raise HTTPException(400, f"key must be {pa2.BLOCK_SIZE} bytes")
    if len(b) != pa2.BLOCK_SIZE:
        raise HTTPException(400, f"block must be {pa2.BLOCK_SIZE} bytes")
    return PA2PrpRes(ct_hex=pa2.prp_encrypt(k, b).hex())


# --- PA #3 — CPA-secure SKE ---------------------------------------------------

class PA3EncReq(BaseModel):
    key_hex: str
    plaintext: str


class PA3EncRes(BaseModel):
    r_hex: str
    c_hex: str


@app.post("/api/pa3/encrypt", response_model=PA3EncRes)
def pa3_encrypt(req: PA3EncReq):
    k = _hex_to_bytes(req.key_hex)
    if len(k) != pa3.BLOCK_SIZE:
        raise HTTPException(400, f"key must be {pa3.BLOCK_SIZE} bytes")
    m = req.plaintext.encode("utf-8")
    r, c = pa3.Enc(k, m)
    return PA3EncRes(r_hex=r.hex(), c_hex=c.hex())


class PA3DecReq(BaseModel):
    key_hex: str
    r_hex: str
    c_hex: str


class PA3DecRes(BaseModel):
    plaintext: str


@app.post("/api/pa3/decrypt", response_model=PA3DecRes)
def pa3_decrypt(req: PA3DecReq):
    k = _hex_to_bytes(req.key_hex)
    if len(k) != pa3.BLOCK_SIZE:
        raise HTTPException(400, f"key must be {pa3.BLOCK_SIZE} bytes")
    r = _hex_to_bytes(req.r_hex)
    if len(r) != pa3.BLOCK_SIZE:
        raise HTTPException(400, f"r must be {pa3.BLOCK_SIZE} bytes")
    c = _hex_to_bytes(req.c_hex)
    m = pa3.Dec(k, r, c)
    try:
        text = m.decode("utf-8")
    except UnicodeDecodeError:
        text = m.hex()
    return PA3DecRes(plaintext=text)


class PA3GameReq(BaseModel):
    rounds: int = Field(50, ge=1, le=500)
    broken: bool = False


class PA3GameRes(BaseModel):
    advantage: float


@app.post("/api/pa3/cpa_game", response_model=PA3GameRes)
def pa3_game(req: PA3GameReq):
    fn = pa3.Enc_broken if req.broken else pa3.Enc
    return PA3GameRes(advantage=pa3.cpa_game(fn, rounds=req.rounds))


# --- PA #4 — Modes of Operation -----------------------------------------------

import pa4

class PA4EncReq(BaseModel):
    mode: str = Field(..., description="ECB, CBC, or CTR")
    key_hex: str
    plaintext_hex: str

class PA4EncRes(BaseModel):
    iv_hex: str
    ciphertext_hex: str

@app.post("/api/pa4/encrypt", response_model=PA4EncRes)
def pa4_encrypt(req: PA4EncReq):
    k = _hex_to_bytes(req.key_hex)
    if len(k) != pa4.BLOCK_SIZE:
        raise HTTPException(400, f"key must be {pa4.BLOCK_SIZE} bytes")
    m = _hex_to_bytes(req.plaintext_hex)
    
    if req.mode == "ECB":
        # Simulate ECB manually since core/pa4.py doesn't expose it natively in Encrypt
        padded_m = pa4.pkcs7_pad(m, pa4.BLOCK_SIZE)
        blocks = [padded_m[i:i + pa4.BLOCK_SIZE] for i in range(0, len(padded_m), pa4.BLOCK_SIZE)]
        c_blocks = [pa4.prp_encrypt(k, b) for b in blocks]
        return PA4EncRes(iv_hex="", ciphertext_hex=b"".join(c_blocks).hex())
    elif req.mode in ["CBC", "CTR"]:
        iv, c = pa4.Encrypt(req.mode, k, m)
        return PA4EncRes(iv_hex=iv.hex(), ciphertext_hex=c.hex())
    else:
        raise HTTPException(400, "Unknown mode")


# --- PA #5 — MAC Forge --------------------------------------------------------

import pa5

class PA5SignReq(BaseModel):
    key_hex: str
    message: str

class PA5SignRes(BaseModel):
    tag_hex: str

@app.post("/api/pa5/sign", response_model=PA5SignRes)
def pa5_sign(req: PA5SignReq):
    k = _hex_to_bytes(req.key_hex)
    if len(k) != pa5.BLOCK_SIZE:
        raise HTTPException(400, f"key must be {pa5.BLOCK_SIZE} bytes")
    m = req.message.encode("utf-8")
    t = pa5.Mac("CBC", k, m)
    return PA5SignRes(tag_hex=t.hex())

class PA5VerifyReq(BaseModel):
    key_hex: str
    message: str
    tag_hex: str

class PA5VerifyRes(BaseModel):
    valid: bool

@app.post("/api/pa5/verify", response_model=PA5VerifyRes)
def pa5_verify(req: PA5VerifyReq):
    k = _hex_to_bytes(req.key_hex)
    m = req.message.encode("utf-8")
    t = _hex_to_bytes(req.tag_hex)
    valid = pa5.Vrfy("CBC", k, m, t)
    return PA5VerifyRes(valid=valid)


# --- PA #6 — Malleability -----------------------------------------------------

import pa6

class PA6EncReq(BaseModel):
    key_enc_hex: str
    key_mac_hex: str
    message: str

class PA6EncRes(BaseModel):
    nonce_hex: str
    ciphertext_hex: str
    tag_hex: str

@app.post("/api/pa6/encrypt", response_model=PA6EncRes)
def pa6_encrypt(req: PA6EncReq):
    k_enc = _hex_to_bytes(req.key_enc_hex)
    k_mac = _hex_to_bytes(req.key_mac_hex)
    m = req.message.encode("utf-8")
    
    iv, c, t = pa6.cca_encrypt('CTR', 'CBC', k_enc, k_mac, m)
    return PA6EncRes(nonce_hex=iv.hex(), ciphertext_hex=c.hex(), tag_hex=t.hex())

class PA6DecReq(BaseModel):
    key_enc_hex: str
    key_mac_hex: str
    nonce_hex: str
    ciphertext_hex: str
    tag_hex: str
    cca_enabled: bool

class PA6DecRes(BaseModel):
    plaintext: str
    error: str = ""

@app.post("/api/pa6/decrypt", response_model=PA6DecRes)
def pa6_decrypt(req: PA6DecReq):
    k_enc = _hex_to_bytes(req.key_enc_hex)
    k_mac = _hex_to_bytes(req.key_mac_hex)
    iv = _hex_to_bytes(req.nonce_hex)
    c = _hex_to_bytes(req.ciphertext_hex)
    t = _hex_to_bytes(req.tag_hex)
    
    try:
        if req.cca_enabled:
            m = pa6.cca_decrypt('CTR', 'CBC', k_enc, k_mac, iv, c, t)
        else:
            # Just decrypt without verification (CPA only)
            import pa4
            m = pa4.Decrypt('CTR', k_enc, iv, c)
            
        try:
            return PA6DecRes(plaintext=m.decode("utf-8"))
        except UnicodeDecodeError:
            return PA6DecRes(plaintext=m.hex())
            
    except pa6.InvalidCiphertextException as e:
        return PA6DecRes(plaintext="", error=str(e))
    except Exception as e:
        return PA6DecRes(plaintext="", error=str(e))


# --- PA #7 — Merkle-Damgard ---------------------------------------------------

import pa7
import hashlib

class PA7HashReq(BaseModel):
    blocks_hex: list[str]

class PA7HashRes(BaseModel):
    chain_hex: list[str]

@app.post("/api/pa7/hash", response_model=PA7HashRes)
def pa7_hash(req: PA7HashReq):
    # For demo purposes, we will mimic the frontend's simplified chaining using SHA-256
    # rather than pa7's dummy_compress, to show real avalanche.
    # The frontend manually splits the string into 4-byte blocks and pads them.
    chain = []
    h = b"\x00" * 8
    chain.append(h.hex())
    for b_hex in req.blocks_hex:
        b = _hex_to_bytes(b_hex)
        h = hashlib.sha256(h + b).digest()[:8]
        chain.append(h.hex())
    return PA7HashRes(chain_hex=chain)


# --- PA #8 — Collision Hunt ---------------------------------------------------

class PA8HuntReq(BaseModel):
    bits: int = Field(..., ge=8, le=32)

class PA8HuntRes(BaseModel):
    tries: int
    hit_msg: str
    
@app.post("/api/pa8/hunt", response_model=PA8HuntRes)
def pa8_hunt(req: PA8HuntReq):
    import os
    seen = {}
    mask = (1 << req.bits) - 1
    
    # Extract number of bytes needed for the mask
    bytes_needed = (req.bits + 7) // 8
    
    for i in range(1, 2_000_000):
        # random 4-byte value
        x = os.urandom(4).hex()
        h = hashlib.sha256(x.encode()).digest()
        
        # Truncate to 'bits'
        # e.g., if bits=20, we take first 3 bytes, convert to int, and mask
        val = int.from_bytes(h[:bytes_needed], 'big') & mask
        
        if val in seen and seen[val] != x:
            hit = f"{seen[val]} <-> {x} -> truncated hash {hex(val)[2:]}"
            return PA8HuntRes(tries=i, hit_msg=hit)
            
        seen[val] = x
        
    return PA8HuntRes(tries=2000000, hit_msg="No collision found (limit reached)")


# --- PA #9 — Birthday Benchmark -----------------------------------------------

class PA9BenchRes(BaseModel):
    n: int
    tries: int
    sqrt: int

@app.post("/api/pa9/benchmark", response_model=list[PA9BenchRes])
def pa9_benchmark():
    import random
    import math
    
    ns = [8, 12, 16, 20]
    out = []
    
    for n in ns:
        seen = set()
        mask = (1 << n) - 1
        tries = 0
        for i in range(5_000_000):
            tries += 1
            v = random.getrandbits(30) & mask
            if v in seen:
                break
            seen.add(v)
        out.append(PA9BenchRes(n=n, tries=tries, sqrt=int(round(math.sqrt(2**n)))))
        
    return out


# --- PA #10 — HMAC ------------------------------------------------------------

import pa10

class PA10HmacReq(BaseModel):
    key_text: str
    message: str

class PA10HmacRes(BaseModel):
    tag_hex: str

@app.post("/api/pa10/hmac", response_model=PA10HmacRes)
def pa10_hmac(req: PA10HmacReq):
    k = req.key_text.encode("utf-8")
    m = req.message.encode("utf-8")
    t = pa10.hmac(k, m)
    return PA10HmacRes(tag_hex=t.hex())


# --- PA #11 — Diffie-Hellman --------------------------------------------------

class PA11DHReq(BaseModel):
    p: str
    g: str
    a: str
    b: str

class PA11DHRes(BaseModel):
    A: str
    B: str
    sharedA: str
    sharedB: str

@app.post("/api/pa11/dh", response_model=PA11DHRes)
def pa11_dh(req: PA11DHReq):
    # Use python's built-in pow for large integers, matching pa11.GroupElement
    p_val = int(req.p)
    g_val = int(req.g)
    a_val = int(req.a)
    b_val = int(req.b)
    
    A = pow(g_val, a_val, p_val)
    B = pow(g_val, b_val, p_val)
    sharedA = pow(B, a_val, p_val)
    sharedB = pow(A, b_val, p_val)
    
    return PA11DHRes(
        A=str(A),
        B=str(B),
        sharedA=str(sharedA),
        sharedB=str(sharedB)
    )


# --- PA #12 — Textbook RSA ----------------------------------------------------

import pa12

class PA12RsaReq(BaseModel):
    p: str
    q: str
    e: str
    m: str

class PA12RsaRes(BaseModel):
    n: str
    phi: str
    d: str
    c: str
    m_recovered: str
    error: str = ""

@app.post("/api/pa12/rsa", response_model=PA12RsaRes)
def pa12_rsa(req: PA12RsaReq):
    try:
        p_val = int(req.p)
        q_val = int(req.q)
        e_val = int(req.e)
        m_val = int(req.m)
        
        n_val = p_val * q_val
        phi_val = (p_val - 1) * (q_val - 1)
        
        d_val = pa12.mod_inverse(e_val, phi_val)
        
        pk = (n_val, e_val)
        sk = (n_val, d_val)
        
        c_val = pa12.encrypt(pk, m_val)
        m_rec = pa12.decrypt(sk, c_val)
        
        return PA12RsaRes(
            n=str(n_val),
            phi=str(phi_val),
            d=str(d_val),
            c=str(c_val),
            m_recovered=str(m_rec)
        )
    except Exception as e:
        return PA12RsaRes(n="", phi="", d="", c="", m_recovered="", error=str(e))


# --- PA #13 — Miller-Rabin ----------------------------------------------------

import pa13

class PA13MrReq(BaseModel):
    n: str
    rounds: int

class PA13MrRes(BaseModel):
    is_prime: bool
    error: str = ""

@app.post("/api/pa13/miller_rabin", response_model=PA13MrRes)
def pa13_mr(req: PA13MrReq):
    try:
        n_val = int(req.n)
        is_p = pa13.miller_rabin(n_val, req.rounds)
        return PA13MrRes(is_prime=is_p)
    except Exception as e:
        return PA13MrRes(is_prime=False, error=str(e))


# --- PA #14 — Chinese Remainder Theorem ---------------------------------------

import pa14

class PA14CrtReq(BaseModel):
    residues: list[str]
    moduli: list[str]

class PA14CrtRes(BaseModel):
    x: str
    error: str = ""

@app.post("/api/pa14/crt", response_model=PA14CrtRes)
def pa14_crt(req: PA14CrtReq):
    try:
        rs = [int(r) for r in req.residues]
        ms = [int(m) for m in req.moduli]
        x_val = pa14.crt(rs, ms)
        return PA14CrtRes(x=str(x_val))
    except Exception as e:
        return PA14CrtRes(x="", error=str(e))


# --- PA #15 — OAEP / Bleichenbacher Oracle ------------------------------------

class PA15OracleRes(BaseModel):
    status: str

@app.post("/api/pa15/oracle", response_model=PA15OracleRes)
def pa15_oracle():
    import random
    # Simulate a padding oracle that returns "valid" for PKCS#1 v1.5 padding 
    # roughly 5% of the time on random data, to mimic the attack progression.
    if random.random() < 0.05:
        return PA15OracleRes(status="valid")
    return PA15OracleRes(status="invalid")


# --- PA #16 — ElGamal ---------------------------------------------------------

class PA16ElGamalReq(BaseModel):
    p: str
    g: str
    x: str
    m: str
    r: str

class PA16ElGamalRes(BaseModel):
    h: str
    c1: str
    c2: str
    m_recovered: str
    error: str = ""

@app.post("/api/pa16/elgamal", response_model=PA16ElGamalRes)
def pa16_elgamal(req: PA16ElGamalReq):
    try:
        p = int(req.p)
        g = int(req.g)
        x = int(req.x)
        m = int(req.m)
        r = int(req.r)
        
        h = pow(g, x, p)
        c1 = pow(g, r, p)
        hr = pow(h, r, p)
        c2 = (m * hr) % p
        
        # decryption
        s = pow(c1, x, p)
        s_inv = pow(s, -1, p)
        m_rec = (c2 * s_inv) % p
        
        return PA16ElGamalRes(
            h=str(h),
            c1=str(c1),
            c2=str(c2),
            m_recovered=str(m_rec)
        )
    except Exception as e:
        return PA16ElGamalRes(h="", c1="", c2="", m_recovered="", error=str(e))


# --- PA #17 — Schnorr Signatures ----------------------------------------------

import hashlib

class PA17SchnorrReq(BaseModel):
    p: str
    g: str
    q: str
    x: str
    m: str

class PA17SchnorrRes(BaseModel):
    y: str
    r: str
    e: str
    s: str
    error: str = ""

@app.post("/api/pa17/schnorr", response_model=PA17SchnorrRes)
def pa17_schnorr(req: PA17SchnorrReq):
    try:
        import random
        p = int(req.p)
        g = int(req.g)
        q = int(req.q)
        x = int(req.x)
        m = req.m
        
        y = pow(g, x, p)
        
        k = random.randint(1, q - 1)
        r = pow(g, k, p)
        
        m_bytes = m.encode("utf-8")
        r_str = str(r).encode("utf-8")
        h = hashlib.sha256(r_str + m_bytes).hexdigest()
        
        # Take first 8 chars to match the TS code:
        e = int(h[:8], 16) % q
        
        s = (k + x * e) % q
        
        return PA17SchnorrRes(
            y=str(y),
            r=str(r),
            e=str(e),
            s=str(s)
        )
    except Exception as e:
        return PA17SchnorrRes(y="", r="", e="", s="", error=str(e))














