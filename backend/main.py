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
    elif circuit == ""

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
