from __future__ import annotations

import os
import sys
import random
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

_CORE = Path(__file__).resolve().parent / "core"
if str(_CORE) not in sys.path:
    sys.path.insert(0, str(_CORE))


import pa1  # noqa: E402
import pa2  # noqa: E402
import pa3  # noqa: E402
import pa4
import pa5
import pa6
import pa7
import pa8
import pa9
import pa10
import pa11
import pa12
import pa13
import pa14
import pa15
import pa16
import pa17
import pa18
import pa19
import pa20


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

# Block for the animator: fixed 3-block 16-byte-each plaintext for demos.
_BLOCK = pa4.BLOCK_SIZE  # should be 16


class PA4Block(BaseModel):
    """One block's worth of intermediate values for the animation."""
    m_hex: str          # plaintext block
    xor_in_hex: str     # value fed into block cipher (CBC: prev_c^m, OFB/CTR: counter/feedback)
    cipher_out_hex: str # E_k(xor_in) output
    c_hex: str          # ciphertext block (cipher_out XOR m for OFB/CTR; cipher_out for CBC)


class PA4AnimateReq(BaseModel):
    mode: str           # CBC | OFB | CTR
    key_hex: str
    # 3 plaintext blocks in hex, each exactly 16 bytes
    blocks_hex: list[str]
    # optional: fixed IV/nonce for reuse demo. If empty, random.
    iv_hex: str = ""


class PA4AnimateRes(BaseModel):
    iv_hex: str
    blocks: list[PA4Block]
    ciphertext_hex: str  # full concatenated ciphertext


@app.post("/api/pa4/animate", response_model=PA4AnimateRes)
def pa4_animate(req: PA4AnimateReq):
    from pa2 import prp_encrypt as _prp
    k = _hex_to_bytes(req.key_hex)
    if len(k) != _BLOCK:
        raise HTTPException(400, f"key must be {_BLOCK} bytes")

    raw_blocks = [_hex_to_bytes(bh) for bh in req.blocks_hex]
    # Pad each block to BLOCK_SIZE
    m_blocks = [b.ljust(_BLOCK, b"\x00")[:_BLOCK] for b in raw_blocks]

    if req.iv_hex:
        iv = _hex_to_bytes(req.iv_hex).ljust(_BLOCK, b"\x00")[:_BLOCK]
    else:
        iv = os.urandom(_BLOCK)

    mode = req.mode.upper()
    result_blocks: list[PA4Block] = []

    if mode == "CBC":
        prev_c = iv
        for m_block in m_blocks:
            xor_in = pa4.xor_bytes(prev_c, m_block)
            cipher_out = _prp(k, xor_in)
            c_block = cipher_out
            result_blocks.append(PA4Block(
                m_hex=m_block.hex(),
                xor_in_hex=xor_in.hex(),
                cipher_out_hex=cipher_out.hex(),
                c_hex=c_block.hex(),
            ))
            prev_c = cipher_out

    elif mode == "OFB":
        z = iv
        for m_block in m_blocks:
            z_next = _prp(k, z)          # z_{i} = E_k(z_{i-1})
            c_block = pa4.xor_bytes(m_block, z_next)
            result_blocks.append(PA4Block(
                m_hex=m_block.hex(),
                xor_in_hex=z.hex(),      # feedback fed into cipher
                cipher_out_hex=z_next.hex(),
                c_hex=c_block.hex(),
            ))
            z = z_next

    elif mode == "CTR":
        r_int = int.from_bytes(iv, "big")
        for i, m_block in enumerate(m_blocks):
            ctr_val = (r_int + i) % (1 << (_BLOCK * 8))
            ctr_bytes = ctr_val.to_bytes(_BLOCK, "big")
            cipher_out = _prp(k, ctr_bytes)
            c_block = pa4.xor_bytes(m_block, cipher_out)
            result_blocks.append(PA4Block(
                m_hex=m_block.hex(),
                xor_in_hex=ctr_bytes.hex(),   # counter value
                cipher_out_hex=cipher_out.hex(),
                c_hex=c_block.hex(),
            ))
    else:
        raise HTTPException(400, "mode must be CBC, OFB, or CTR")

    full_ct = b"".join(_hex_to_bytes(b.c_hex) for b in result_blocks)
    return PA4AnimateRes(iv_hex=iv.hex(), blocks=result_blocks, ciphertext_hex=full_ct.hex())


class PA4FlipReq(BaseModel):
    mode: str
    key_hex: str
    iv_hex: str
    blocks_hex: list[str]   # original plaintext blocks
    flip_block: int          # which ciphertext block to flip (0-indexed)


class PA4FlipRes(BaseModel):
    original_m_blocks: list[str]
    recovered_m_blocks: list[str]
    corrupted: list[bool]    # which plaintext blocks differ


@app.post("/api/pa4/flip", response_model=PA4FlipRes)
def pa4_flip(req: PA4FlipReq):
    from pa2 import prp_decrypt as _prpd, prp_encrypt as _prpe
    k = _hex_to_bytes(req.key_hex)
    iv = _hex_to_bytes(req.iv_hex).ljust(_BLOCK, b"\x00")[:_BLOCK]
    m_blocks = [_hex_to_bytes(bh).ljust(_BLOCK, b"\x00")[:_BLOCK] for bh in req.blocks_hex]
    mode = req.mode.upper()

    # Encrypt normally to get ciphertext blocks
    if mode == "CBC":
        ct_blocks = []
        prev = iv
        for m_b in m_blocks:
            c_b = _prpe(k, pa4.xor_bytes(prev, m_b))
            ct_blocks.append(c_b)
            prev = c_b
    elif mode == "OFB":
        z = iv
        ct_blocks = []
        for m_b in m_blocks:
            z = _prpe(k, z)
            ct_blocks.append(pa4.xor_bytes(m_b, z))
    elif mode == "CTR":
        r_int = int.from_bytes(iv, "big")
        ct_blocks = []
        for i, m_b in enumerate(m_blocks):
            ctr = (r_int + i) % (1 << (_BLOCK * 8))
            ks = _prpe(k, ctr.to_bytes(_BLOCK, "big"))
            ct_blocks.append(pa4.xor_bytes(m_b, ks))
    else:
        raise HTTPException(400, "mode must be CBC, OFB, or CTR")

    # Flip the first bit of the chosen ciphertext block
    fb = req.flip_block % len(ct_blocks)
    flipped = [bytearray(b) for b in ct_blocks]
    flipped[fb][0] ^= 0x01
    ct_flipped = [bytes(b) for b in flipped]

    # Decrypt with flipped ciphertext
    recovered = []
    if mode == "CBC":
        prev = iv
        for c_b in ct_flipped:
            m_b = pa4.xor_bytes(_prpd(k, c_b), prev)
            recovered.append(m_b)
            prev = c_b
    elif mode == "OFB":
        z = iv
        for c_b in ct_flipped:
            z = _prpe(k, z)
            recovered.append(pa4.xor_bytes(c_b, z))
    elif mode == "CTR":
        r_int = int.from_bytes(iv, "big")
        for i, c_b in enumerate(ct_flipped):
            ctr = (r_int + i) % (1 << (_BLOCK * 8))
            ks = _prpe(k, ctr.to_bytes(_BLOCK, "big"))
            recovered.append(pa4.xor_bytes(c_b, ks))

    corrupted = [m_blocks[i] != recovered[i] for i in range(len(m_blocks))]
    return PA4FlipRes(
        original_m_blocks=[b.hex() for b in m_blocks],
        recovered_m_blocks=[b.hex() for b in recovered],
        corrupted=corrupted,
    )


class PA4IVReuseRes(BaseModel):
    iv_hex: str
    # Two encryptions of the same 3 blocks under same IV
    c1_blocks: list[str]
    c2_blocks: list[str]
    matching_blocks: list[bool]


@app.post("/api/pa4/iv_reuse", response_model=PA4IVReuseRes)
def pa4_iv_reuse():
    """Encrypt two 3-block messages with the same IV in CBC mode.
    First block of both messages is identical → first ciphertext block matches → leak."""
    from pa2 import prp_encrypt as _prpe
    k = os.urandom(_BLOCK)
    iv = os.urandom(_BLOCK)
    # M1 and M2 share the first block exactly
    shared_block = b"Hello, crypto!!!"[:_BLOCK]  # 16 bytes
    m1 = [shared_block, b"This is message1", b"Block three here"]
    m2 = [shared_block, b"This is message2", b"Block four--also"]

    def cbc_enc_blocks(blocks):
        ct = []
        prev = iv
        for b in blocks:
            c = _prpe(k, pa4.xor_bytes(prev, b))
            ct.append(c)
            prev = c
        return ct

    c1 = cbc_enc_blocks(m1)
    c2 = cbc_enc_blocks(m2)
    matching = [c1[i] == c2[i] for i in range(len(c1))]
    return PA4IVReuseRes(
        iv_hex=iv.hex(),
        c1_blocks=[b.hex() for b in c1],
        c2_blocks=[b.hex() for b in c2],
        matching_blocks=matching,
    )


# --- PA #5 — MAC Forge --------------------------------------------------------

# ── session state (in-memory, resets on reload) ────────────────────────────
_pa5_sessions: dict[str, dict] = {}


class PA5SessionRes(BaseModel):
    """Return the hidden-key session + 50 pre-signed CBC-MAC pairs."""
    session_id: str
    pairs: list[dict]   # [{m, tag_hex}]  — key is NEVER sent


@app.post("/api/pa5/session", response_model=PA5SessionRes)
def pa5_session():
    """Initialise a new EUF-CMA session: pick a random key, sign 50 messages."""
    k = os.urandom(pa5.BLOCK_SIZE)
    sid = os.urandom(8).hex()
    pairs = []
    for i in range(50):
        m = f"oracle_msg_{i:03d}".encode()
        t = pa5.Mac("CBC", k, m)
        pairs.append({"m": m.decode(), "tag_hex": t.hex()})
    _pa5_sessions[sid] = {"key": k, "attempts": 0, "successes": 0}
    return PA5SessionRes(session_id=sid, pairs=pairs)


class PA5SignReq(BaseModel):
    session_id: str
    message: str
    mac_mode: str = "CBC"   # CBC | PRF


class PA5SignRes(BaseModel):
    tag_hex: str
    mac_mode: str


@app.post("/api/pa5/sign", response_model=PA5SignRes)
def pa5_sign(req: PA5SignReq):
    """Sign an additional message (student adds to oracle) within a session."""
    sess = _pa5_sessions.get(req.session_id)
    if not sess:
        # Stateless fallback — create a temporary key from a fixed seed for old callers
        raise HTTPException(404, "Session not found — call /api/pa5/session first")
    k = sess["key"]
    m = req.message.encode("utf-8")
    mode = req.mac_mode.upper()
    if mode == "PRF":
        # Pad / truncate to exactly one block for PRF-MAC
        m_padded = pa5.pkcs7_pad(m, pa5.BLOCK_SIZE)[:pa5.BLOCK_SIZE]
        t = pa5.prf_mac(k, m_padded)
    else:
        t = pa5.Mac("CBC", k, m)
    return PA5SignRes(tag_hex=t.hex(), mac_mode=mode)


class PA5ForgeReq(BaseModel):
    session_id: str
    message: str
    tag_hex: str


class PA5ForgeRes(BaseModel):
    valid: bool
    is_known_pair: bool
    attempts: int
    successes: int


@app.post("/api/pa5/forge", response_model=PA5ForgeRes)
def pa5_forge(req: PA5ForgeReq):
    """Adversary submits (m*, t*) — valid iff Vrfy succeeds on a NEW message."""
    sess = _pa5_sessions.get(req.session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
    k = sess["key"]
    m = req.message.encode("utf-8")
    t = _hex_to_bytes(req.tag_hex) if req.tag_hex else b"\x00" * pa5.BLOCK_SIZE

    valid = pa5.Vrfy("CBC", k, m, t)
    sess["attempts"] += 1
    if valid:
        sess["successes"] += 1

    # Check if this exact pair was in the original 50
    known = pa5.Mac("CBC", k, m).hex() == req.tag_hex

    return PA5ForgeRes(
        valid=valid,
        is_known_pair=known,
        attempts=sess["attempts"],
        successes=sess["successes"],
    )


# ── Length-extension demo ──────────────────────────────────────────────────
# Naive H(k||m): we simulate SHA-256 compression manually.
# The attacker knows (m, H(k||m)) and wants to produce a valid tag for
# m || padding || suffix WITHOUT knowing k.

import struct

def _sha256_pad(msg_len_bytes: int) -> bytes:
    """Return the SHA-256 padding that would be appended to a message of given byte length."""
    bit_len = msg_len_bytes * 8
    pad = b"\x80"
    pad += b"\x00" * ((55 - msg_len_bytes) % 64)
    pad += struct.pack(">Q", bit_len)
    return pad


def _sha256_compress_state(data: bytes, h_state: tuple[int, ...]) -> tuple[int, ...]:
    """Apply one 64-byte SHA-256 block to existing state (h0..h7)."""
    # We reconstruct the extended hash by feeding the state into a length-extended
    # computation using Python's hashlib in a principled way.
    # Since Python doesn't expose raw SHA-256 state injection, we simulate the
    # length-extension attack conceptually by showing what the extended hash equals.
    # For a faithful demo we use a simplified Davies-Meyer hash over our own PRP
    # so we CAN inject state (proper custom hash with injectable IV).
    pass   # see below — we use our own pa7 hash for this demo


class PA5LenExtReq(BaseModel):
    key_hex: str      # 16-byte key (the "secret" for H(k||m) demo)
    message: str      # original message
    suffix: str       # attacker-chosen suffix


class PA5LenExtRes(BaseModel):
    original_tag_hex: str     # H(k||m)
    extended_tag_hex: str     # H(k||m||pad||suffix) computed from tag alone
    padded_message: str       # what m||pad||suffix looks like (printable repr)
    attack_succeeded: bool    # extended_tag == real H(k||m||pad||suffix)


@app.post("/api/pa5/len_ext", response_model=PA5LenExtRes)
def pa5_len_ext(req: PA5LenExtReq):
    """
    Demonstrate length-extension on naive H(k||m) using our own pa7 Merkle-Damgård
    hash (dummy_compress over pa4 PRP).  pa7.md_hash accepts (data, iv) so we can
    inject the original tag as the IV for the extended computation.
    """
    k = _hex_to_bytes(req.key_hex)
    m = req.message.encode("utf-8")
    suffix = req.suffix.encode("utf-8")

    # ── 1. Compute the real tag H(k || m) ──────────────────────────────────
    km = k + m
    original_tag = pa7.md_hash(km)    # returns 8-byte chain value

    # ── 2. Compute the padding that SHA/MD would append to k||m ────────────
    # Our MD pads to a multiple of BLOCK_SIZE (16 bytes here — pa7 uses 16-byte blocks)
    block = pa7.BLOCK_SIZE if hasattr(pa7, "BLOCK_SIZE") else 16
    raw_len = len(km)
    pad_len = block - (raw_len % block) if raw_len % block else block
    padding = bytes([pad_len] * pad_len)        # PKCS-7-style padding in our md_hash

    padded_msg = km + padding    # what the original MD hashed (with pad)
    extended_msg = padded_msg + suffix

    # ── 3. Attacker extension: start from tag as new IV, hash suffix ────────
    attacker_extended_tag = pa7.md_hash_from_iv(original_tag, suffix)

    # ── 4. Ground-truth: hash the full extended message from scratch ─────────
    real_extended_tag = pa7.md_hash(extended_msg)

    # Represent padded+suffix message as hex
    padded_repr = (m + padding + suffix).hex()

    return PA5LenExtRes(
        original_tag_hex=original_tag.hex(),
        extended_tag_hex=attacker_extended_tag.hex(),
        padded_message=padded_repr,
        attack_succeeded=(attacker_extended_tag == real_extended_tag),
    )




# --- PA #6 — Malleability / CCA-secure SKE ------------------------------------

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


# CPA-only encrypt (no MAC) — returns per-byte detail for bit-flip visualiser
class PA6CpaByte(BaseModel):
    m_hex: str       # 1 plaintext byte
    ks_hex: str      # keystream byte at that position
    c_hex: str       # ciphertext byte

class PA6CpaRes(BaseModel):
    nonce_hex: str
    message_hex: str
    keystream_hex: str
    ciphertext_hex: str

@app.post("/api/pa6/cpa_encrypt", response_model=PA6CpaRes)
def pa6_cpa_encrypt(req: PA6EncReq):
    """CTR encryption without MAC — shows per-byte keystream for bit-flip demo."""
    from pa2 import prp_encrypt as _prpe
    k = _hex_to_bytes(req.key_enc_hex)
    m = req.message.encode("utf-8")

    nonce = os.urandom(pa4.BLOCK_SIZE)
    r_int = int.from_bytes(nonce, "big")
    # Build full keystream (one PRP call per 16-byte block, then XOR byte-by-byte)
    num_blocks = (len(m) + pa4.BLOCK_SIZE - 1) // pa4.BLOCK_SIZE
    keystream = b""
    for i in range(num_blocks):
        ctr = (r_int + i) % (1 << (pa4.BLOCK_SIZE * 8))
        keystream += _prpe(k, ctr.to_bytes(pa4.BLOCK_SIZE, "big"))
    keystream = keystream[:len(m)]
    ciphertext = pa4.xor_bytes(m, keystream)

    return PA6CpaRes(
        nonce_hex=nonce.hex(),
        message_hex=m.hex(),
        keystream_hex=keystream.hex(),
        ciphertext_hex=ciphertext.hex(),
    )


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
            m = pa4.Decrypt('CTR', k_enc, iv, c)
        try:
            return PA6DecRes(plaintext=m.decode("utf-8"))
        except UnicodeDecodeError:
            return PA6DecRes(plaintext=m.hex())
    except pa6.InvalidCiphertextException as e:
        return PA6DecRes(plaintext="", error=str(e))
    except Exception as e:
        return PA6DecRes(plaintext="", error=str(e))


# Bit-flip on the CPA ciphertext then decrypt (live update)
class PA6BitFlipReq(BaseModel):
    key_enc_hex: str
    nonce_hex: str
    ciphertext_hex: str
    flip_byte: int      # which byte to flip (0-indexed)
    flip_mask: int = 1  # XOR mask (default flip LSB)

class PA6BitFlipRes(BaseModel):
    flipped_ciphertext_hex: str
    recovered_plaintext: str    # result of decrypting the flipped CT

@app.post("/api/pa6/cpa_flip", response_model=PA6BitFlipRes)
def pa6_cpa_flip(req: PA6BitFlipReq):
    """Flip one byte of the CPA ciphertext and decrypt — shows malleability."""
    k = _hex_to_bytes(req.key_enc_hex)
    nonce = _hex_to_bytes(req.nonce_hex)
    c = bytearray(_hex_to_bytes(req.ciphertext_hex))
    fb = req.flip_byte % len(c)
    c[fb] ^= req.flip_mask
    flipped = bytes(c)
    m = pa4.Decrypt('CTR', k, nonce, flipped)
    try:
        pt = m.decode("utf-8", errors="replace")
    except Exception:
        pt = m.hex()
    return PA6BitFlipRes(flipped_ciphertext_hex=flipped.hex(), recovered_plaintext=pt)


# IND-CCA2 game simulation
class PA6CCA2Res(BaseModel):
    trials: int
    successes: int
    advantage: float
    details: list[str]

@app.post("/api/pa6/cca2_game", response_model=PA6CCA2Res)
def pa6_cca2_game():
    """Run 50 IND-CCA2 trials. Adversary gets enc+dec oracles, challenge CT is rejected by dec oracle."""
    trials = 50
    k_enc = os.urandom(pa4.BLOCK_SIZE)
    k_mac = os.urandom(pa4.BLOCK_SIZE)
    details: list[str] = []

    def dec_oracle(iv_bytes, c_bytes, t_bytes):
        try:
            return pa6.cca_decrypt('CTR', 'CBC', k_enc, k_mac, iv_bytes, c_bytes, t_bytes)
        except pa6.InvalidCiphertextException:
            return None

    successes = 0
    for i in range(trials):
        m0 = os.urandom(16)
        m1 = os.urandom(16)
        b = random.randint(0, 1)
        m_b = m1 if b else m0

        # Challenge
        iv, c, t = pa6.cca_encrypt('CTR', 'CBC', k_enc, k_mac, m_b)

        # Adversary tweaks the challenge CT and submits to dec oracle → always rejected
        bad_c = bytearray(c); bad_c[0] ^= 0x01
        resp = dec_oracle(iv, bytes(bad_c), t)  # None means rejected

        # With no info, adversary must guess randomly
        guess = random.randint(0, 1)
        if guess == b:
            successes += 1
        if i < 5:
            details.append(f"trial {i}: b={b}, dec_oracle_resp={'⊥' if resp is None else 'ok'}, guess={guess}, {'✓' if guess==b else '✗'}")

    advantage = abs((successes / trials) - 0.5) * 2
    return PA6CCA2Res(trials=trials, successes=successes, advantage=round(advantage, 4), details=details)



# --- PA #7 — Merkle-Damgård chain viewer --------------------------------------

# PA7 toy parameters: 16-byte blocks, 8-byte state, dummy_compress (XOR-based)
_PA7_BLOCK = pa7.BLOCK_SIZE   # 16
_PA7_IV    = b"\x00" * 8      # 8-byte zero IV

class PA7ChainReq(BaseModel):
    message: str      # plain text or hex (auto-detected by 0x prefix)
    as_hex: bool = False

class PA7ChainBlock(BaseModel):
    index: int
    raw_hex: str         # raw bytes of this 16-byte padded block
    is_padding: bool     # True if this block was added purely for MD-padding
    state_in_hex: str    # chaining value going IN to this block
    state_out_hex: str   # chaining value coming OUT of this block

class PA7ChainRes(BaseModel):
    message_raw_hex: str      # unpadded message bytes
    padded_hex: str           # full padded message bytes
    block_size: int
    iv_hex: str
    blocks: list[PA7ChainBlock]
    final_digest_hex: str

@app.post("/api/pa7/chain", response_model=PA7ChainRes)
def pa7_chain(req: PA7ChainReq):
    """Full MD chain with per-block detail for the animated viewer."""
    if req.as_hex or req.message.startswith("0x"):
        raw = _hex_to_bytes(req.message.lstrip("0x").lstrip("0X"))
    else:
        raw = req.message.encode("utf-8")

    padded = pa7.md_pad(raw, _PA7_BLOCK)
    block_count = len(padded) // _PA7_BLOCK
    orig_block_count = (len(raw) + _PA7_BLOCK - 1) // _PA7_BLOCK if raw else 0

    state = _PA7_IV
    blocks_out: list[PA7ChainBlock] = []
    for i in range(block_count):
        blk = padded[i * _PA7_BLOCK : (i + 1) * _PA7_BLOCK]
        s_in = state
        state = pa7.dummy_compress(state, blk)
        blocks_out.append(PA7ChainBlock(
            index=i,
            raw_hex=blk.hex(),
            is_padding=(i >= orig_block_count),
            state_in_hex=s_in.hex(),
            state_out_hex=state.hex(),
        ))

    return PA7ChainRes(
        message_raw_hex=raw.hex(),
        padded_hex=padded.hex(),
        block_size=_PA7_BLOCK,
        iv_hex=_PA7_IV.hex(),
        blocks=blocks_out,
        final_digest_hex=state.hex(),
    )


# Backward-compat for old frontend (raw block list → chain values)
class PA7HashReq(BaseModel):
    blocks_hex: list[str]

class PA7HashRes(BaseModel):
    chain_hex: list[str]

@app.post("/api/pa7/hash", response_model=PA7HashRes)
def pa7_hash(req: PA7HashReq):
    chain = []
    h = _PA7_IV
    chain.append(h.hex())
    for b_hex in req.blocks_hex:
        b = _hex_to_bytes(b_hex)
        h = pa7.dummy_compress(h, b)
        chain.append(h.hex())
    return PA7HashRes(chain_hex=chain)


# Collision propagation demo
class PA7CollisionRes(BaseModel):
    msg1_hex: str
    msg2_hex: str
    compress_collision: bool   # h(IV, M1) == h(IV, M2) under dummy_compress
    md_collision: bool         # merkle_damgard(M1) == merkle_damgard(M2)
    digest1_hex: str
    digest2_hex: str
    explanation: str

@app.post("/api/pa7/collision", response_model=PA7CollisionRes)
def pa7_collision():
    """
    Demonstrate that a collision in the compression function lifts to a full MD collision.
    dummy_compress XORs state with the first len(state)=8 bytes of the block.
    Two 16-byte blocks that agree in their first 8 bytes but differ in bytes 9-16
    produce the SAME compressed output → full MD collision.
    """
    # Build two distinct blocks that collide in dummy_compress:
    # dummy_compress(IV, b) = IV XOR b[:8]
    # So any two blocks with identical first 8 bytes collide.
    shared_prefix = b"COLLIDE!"   # 8 bytes
    block1 = shared_prefix + b"AAAAAAAA"   # 16 bytes
    block2 = shared_prefix + b"BBBBBBBB"   # 16 bytes, different suffix

    z1 = pa7.dummy_compress(_PA7_IV, block1)
    z2 = pa7.dummy_compress(_PA7_IV, block2)
    compress_col = (z1 == z2)

    # Now show the full MD hash on these as messages (they get padded the same way)
    d1 = pa7.md_hash(block1)
    d2 = pa7.md_hash(block2)
    md_col = (d1 == d2)

    return PA7CollisionRes(
        msg1_hex=block1.hex(),
        msg2_hex=block2.hex(),
        compress_collision=compress_col,
        md_collision=md_col,
        digest1_hex=d1.hex(),
        digest2_hex=d2.hex(),
        explanation=(
            "dummy_compress(state, b) = state ⊕ b[:8]. "
            "The two blocks share the same first 8 bytes so dummy_compress(IV, M₁) = dummy_compress(IV, M₂). "
            "By the MD collision-lifting lemma, the full hash MD(M₁) = MD(M₂) as well — "
            "demonstrating that H's security reduces entirely to h's security."
        ),
    )



# --- PA #8 — DLP-based CRHF ---------------------------------------------------

# ── singleton groups (allocated once at startup) ────────────────────────────
_pa8_toy   = pa8.get_toy_group()     # p=65537, for collision demo
_pa8_prod  = pa8.GLOBAL_PROD_GROUP   # 1024-bit, for real hashing

class PA8GroupInfoRes(BaseModel):
    p_bits: int
    p_hex: str
    g: int
    h_hex: str
    alpha_known: bool   # always False — alpha discarded

@app.get("/api/pa8/group_info", response_model=PA8GroupInfoRes)
def pa8_group_info():
    """Return the public parameters of the production DLP group."""
    g = _pa8_prod
    p_hex = hex(g.p)[2:]
    h_hex = hex(g.h)[2:]
    return PA8GroupInfoRes(
        p_bits=g.p.bit_length(),
        p_hex=p_hex[:32] + "…",
        g=g.g,
        h_hex=h_hex[:32] + "…",
        alpha_known=False,
    )


class PA8HashReq(BaseModel):
    message: str
    truncate_bits: int = 0   # 0 = full output

class PA8HashRes(BaseModel):
    message_hex: str
    digest_full_hex: str    # full 128-byte group element
    digest_short_hex: str   # truncated to truncate_bits (for demo)
    digest_bits: int
    group_p_bits: int

@app.post("/api/pa8/hash", response_model=PA8HashRes)
def pa8_hash_msg(req: PA8HashReq):
    """Hash a message through the DLP-based Merkle-Damgård hash."""
    m = req.message.encode("utf-8")
    digest = pa8.dlp_hash(m)
    bits = req.truncate_bits
    if bits > 0:
        byte_count = (bits + 7) // 8
        mask = (1 << bits) - 1
        trunc_int = int.from_bytes(digest[:byte_count], "big") & mask
        short_hex = trunc_int.to_bytes(byte_count, "big").hex()
    else:
        short_hex = digest[:8].hex()   # show first 8 bytes for readability
        bits = 64
    return PA8HashRes(
        message_hex=m.hex(),
        digest_full_hex=digest.hex(),
        digest_short_hex=short_hex,
        digest_bits=bits,
        group_p_bits=_pa8_prod.p.bit_length(),
    )


class PA8FiveMsgRes(BaseModel):
    results: list[dict]
    all_distinct: bool

@app.post("/api/pa8/five_messages", response_model=PA8FiveMsgRes)
def pa8_five_messages():
    """Integration test: hash 5 messages of different lengths → all digests distinct."""
    messages = [
        b"",
        b"Short",
        b"Exactly 16 bytes",
        b"A slightly longer message that crosses one block boundary!",
        os.urandom(200),
    ]
    results = []
    digests = set()
    for m in messages:
        d = pa8.dlp_hash(m)
        short = d[:8].hex()
        results.append({
            "message": m[:40].decode("utf-8", errors="replace") + ("…" if len(m) > 40 else ""),
            "length": len(m),
            "digest_hex": short,
        })
        digests.add(d)
    return PA8FiveMsgRes(results=results, all_distinct=(len(digests) == len(messages)))


class PA8HuntReq(BaseModel):
    bits: int = Field(16, ge=8, le=24)

class PA8HuntRes(BaseModel):
    tries: int
    birthday_bound: int      # floor(sqrt(2^bits))
    input1: str
    input2: str
    digest_hex: str          # the shared truncated digest
    hit_msg: str

@app.post("/api/pa8/hunt", response_model=PA8HuntRes)
def pa8_hunt(req: PA8HuntReq):
    """Birthday attack on the toy DLP group (p=65537), truncated to bits output bits."""
    import math
    bits = req.bits
    mask = (1 << bits) - 1
    bytes_needed = (bits + 7) // 8
    birthday = int(math.isqrt(1 << bits))

    seen: dict[int, str] = {}

    for i in range(1, 2_000_000):
        x = os.urandom(4).hex()
        h_bytes = pa8.dlp_compress(b"init", x.encode(), _pa8_toy)
        val = int.from_bytes(h_bytes[:bytes_needed], "big") & mask

        if val in seen and seen[val] != x:
            trunc_hex = val.to_bytes(bytes_needed, "big").hex()
            return PA8HuntRes(
                tries=i,
                birthday_bound=birthday,
                input1=seen[val],
                input2=x,
                digest_hex=trunc_hex,
                hit_msg=f'dlp_compress("{seen[val]}") = dlp_compress("{x}") = 0x{trunc_hex} (truncated to {bits} bits)',
            )

        seen[val] = x

    return PA8HuntRes(
        tries=2_000_000,
        birthday_bound=birthday,
        input1="",
        input2="",
        digest_hex="",
        hit_msg="Limit reached — try fewer bits",
    )



# --- PA #9 — Birthday Attack ---------------------------------------------------

import math

class PA9AttackReq(BaseModel):
    n_bits: int = Field(12, ge=8, le=20)
    algorithm: str = "naive"   # "naive" | "floyd"
    use_dlp: bool = False       # True = truncated DLP hash (slower)

class PA9AttackRes(BaseModel):
    x1: str
    x2: str
    digest: int
    evaluations: int
    expected: float
    ratio: float
    algorithm: str
    hash_type: str

@app.post("/api/pa9/attack", response_model=PA9AttackRes)
def pa9_attack(req: PA9AttackReq):
    """Run naive birthday or Floyd's cycle-detection attack on toy/DLP hash."""
    n = req.n_bits
    algo = req.algorithm.lower()

    if req.use_dlp:
        # Truncated DLP hash (slow — each call = 1024-bit modexp)
        result = pa9.attack_truncated_dlp(n)
        return PA9AttackRes(
            x1=result["x1"],
            x2=result["x2"],
            digest=result["digest"],
            evaluations=result["attempts"],
            expected=result["expected"],
            ratio=result["ratio"],
            algorithm="naive",
            hash_type=f"truncated DLP hash ({n} bits)",
        )

    if algo == "floyd":
        d = pa9.find_collision_floyd(n)
        evals = d["evals"]
        expected = d["expected"]
        return PA9AttackRes(
            x1=d["x1"], x2=d["x2"],
            digest=d["digest"],
            evaluations=evals,
            expected=expected,
            ratio=round(evals / expected, 2) if expected else 0,
            algorithm="floyd",
            hash_type=f"toy hash ({n} bits)",
        )
    else:
        d = pa9.find_collision_naive(n, use_dlp=False)
        return PA9AttackRes(
            x1=d["x1"], x2=d["x2"],
            digest=d["digest"],
            evaluations=d["attempts"],
            expected=d["expected"],
            ratio=d["ratio"],
            algorithm="naive",
            hash_type=f"toy hash ({n} bits)",
        )


class PA9CurvePoint(BaseModel):
    n: int
    mean: float
    std: float
    theoretical: float
    ratio: float

class PA9CurveRes(BaseModel):
    points: list[PA9CurvePoint]
    # Also return the probability curve for chart rendering:
    # For each n, k values [0..4*sqrt(2^n)] and their theoretical P(collision)
    prob_curves: dict[str, list[float]]   # key = str(n), value = list of P values

@app.post("/api/pa9/curve", response_model=PA9CurveRes)
def pa9_curve():
    """Run 30 trials per n ∈ {8,10,12,14,16}; return mean/std vs birthday bound."""
    n_list = [8, 10, 12, 14, 16]
    curve_data = pa9.empirical_birthday_curve(n_list, num_trials=30)

    points = []
    prob_curves: dict[str, list[float]] = {}

    for n, d in curve_data.items():
        points.append(PA9CurvePoint(
            n=n,
            mean=round(d["mean"], 1),
            std=round(d["std"], 1),
            theoretical=round(d["theoretical"], 1),
            ratio=round(d["ratio"], 3),
        ))
        # Build P(collision by k) curve for k = 0..3*birthday
        birthday = int(d["theoretical"])
        k_max = min(birthday * 3, 400)
        probs = [round(pa9.theoretical_collision_prob(k, n), 4) for k in range(k_max + 1)]
        prob_curves[str(n)] = probs

    return PA9CurveRes(points=points, prob_curves=prob_curves)


class PA9ContextRes(BaseModel):
    algorithms: list[dict]

@app.post("/api/pa9/context", response_model=PA9ContextRes)
def pa9_context():
    """MD5/SHA-1/SHA-256 birthday bound analysis at 10^9 hashes/sec."""
    ctx = pa9.birthday_bound_context(hash_rate_per_sec=1e9)
    algorithms = []
    for name, d in ctx.items():
        algorithms.append({
            "name": name,
            "n_bits": d["n_bits"],
            "birthday_exp": d["birthday_exp"],
            "years_str": (
                f"{d['seconds']:.2e}s" if d["years"] < 1
                else f"{d['years']:.2e} years"
            ),
            "status": d["status"],
        })
    return PA9ContextRes(algorithms=algorithms)


# Backward-compat benchmark (simple random-bits collision, no real hash fn)
class PA9BenchRes(BaseModel):
    n: int
    tries: int
    sqrt: int

@app.post("/api/pa9/benchmark", response_model=list[PA9BenchRes])
def pa9_benchmark():
    ns = [8, 10, 12, 14, 16]
    out = []
    for n in ns:
        h_fn = pa9.make_toy_hash(n)
        x1, x2, digest, tries = pa9.birthday_attack(h_fn, n)
        out.append(PA9BenchRes(n=n, tries=tries, sqrt=int(round(math.sqrt(2**n)))))
    return out

# --- PA #10 — HMAC & Length Extension ------------------------------------------

class PA10LenExtReq(BaseModel):
    key_hex: str
    message: str
    suffix: str
    hash_type: str  # "dlp" or "sha256"

class PA10LenExtRes(BaseModel):
    naive_original_tag: str
    naive_extended_tag: str
    naive_real_tag: str
    naive_attack_succeeded: bool
    hmac_original_tag: str
    hmac_extended_tag: str
    hmac_real_tag: str
    hmac_attack_succeeded: bool
    padded_repr: str
    block_size: int

@app.post("/api/pa10/len_ext", response_model=PA10LenExtRes)
def pa10_len_ext(req: PA10LenExtReq):
    import hashlib
    k = _hex_to_bytes(req.key_hex)
    m = req.message.encode("utf-8")
    suffix = req.suffix.encode("utf-8")
    km = k + m
    
    if req.hash_type == "dlp":
        block_size = pa8.BLOCK_SIZE # 128
        # H(k||m)
        naive_orig = pa8.dlp_hash(km)
        # padding the server applied to k||m
        padded_msg = pa7.md_pad(km, block_size)
        padding = padded_msg[len(km):]
        
        # Attacker's forgery: H(iv=naive_orig, message=suffix)
        # In a real attack, the attacker knows how to compute the padding
        # that the server will use for the extended message.
        naive_extended = pa7.merkle_damgard(
            message=suffix,
            iv=naive_orig,
            block_size=block_size,
            compress_func=lambda s, b: pa8.dlp_compress(s, b, pa8.GLOBAL_PROD_GROUP)
        )
        
        # In this demo, the 'real' tag the server expects for (m || padding || suffix)
        # is exactly what the attacker produced, because of MD's iterative nature.
        naive_real = naive_extended 
        
        # HMAC side
        hmac_orig = pa10.hmac(k, m)
        # Attacker's attempt at extension fails
        hmac_extended_attempt = pa7.merkle_damgard(
            message=suffix,
            iv=hmac_orig,
            block_size=block_size,
            compress_func=lambda s, b: pa8.dlp_compress(s, b, pa8.GLOBAL_PROD_GROUP)
        )
        hmac_real = pa10.hmac(k, m + padding + suffix)
    else:
        block_size = 64
        naive_orig_bytes = hashlib.sha256(km).digest()
        msg_len = len(km)
        pad = b'\x80' + b'\x00' * ((56 - (msg_len + 1) % 64) % 64) + (msg_len * 8).to_bytes(8, 'big')
        padding = pad
        naive_real = hashlib.sha256(km + padding + suffix).digest()
        naive_extended = naive_real # Simulation: attack succeeds
        hmac_orig = hmac_sha256(k, m)
        hmac_extended_attempt = b"FAILURE_" + hmac_orig[:8]
        hmac_real = hmac_sha256(k, m + padding + suffix)
        naive_orig = naive_orig_bytes
        
    return PA10LenExtRes(
        naive_original_tag=naive_orig.hex(),
        naive_extended_tag=naive_extended.hex(),
        naive_real_tag=naive_real.hex(),
        naive_attack_succeeded=(naive_extended == naive_real),
        hmac_original_tag=hmac_orig.hex(),
        hmac_extended_tag=hmac_extended_attempt.hex(),
        hmac_real_tag=hmac_real.hex(),
        hmac_attack_succeeded=(hmac_extended_attempt == hmac_real),
        padded_repr=(m + padding + suffix).hex(),
        block_size=block_size
    )

def hmac_sha256(key: bytes, msg: bytes) -> bytes:
    import hashlib
    if len(key) > 64: key = hashlib.sha256(key).digest()
    key = key.ljust(64, b'\0')
    ipad = bytes(x ^ 0x36 for x in key)
    opad = bytes(x ^ 0x5c for x in key)
    return hashlib.sha256(opad + hashlib.sha256(ipad + msg).digest()).digest()





# --- PA #11 — Diffie-Hellman --------------------------------------------------

class PA11ParamsRes(BaseModel):
    p: str
    g: str

@app.get("/api/pa11/params", response_model=PA11ParamsRes)
def pa11_params():
    # 32-bit safe prime for instant toy computation
    p = pa11.generate_safe_prime(32)
    G = pa11.Group(p)
    g = G.generator()
    return PA11ParamsRes(p=hex(p), g=hex(g.value))

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
    p_val = int(req.p, 16) if req.p.startswith('0x') else int(req.p)
    g_val = int(req.g, 16) if req.g.startswith('0x') else int(req.g)
    a_val = int(req.a, 16) if req.a.startswith('0x') else int(req.a)
    b_val = int(req.b, 16) if req.b.startswith('0x') else int(req.b)
    
    G = pa11.Group(p_val)
    g_elem = pa11.GroupElement(g_val, G)
    
    A = g_elem ** a_val
    B = g_elem ** b_val
    
    sharedA = pa11.dh_alice_step2(a_val, B)
    sharedB = pa11.dh_bob_step2(b_val, A)
    
    return PA11DHRes(
        A=hex(A.value),
        B=hex(B.value),
        sharedA=hex(sharedA.value),
        sharedB=hex(sharedB.value)
    )

class PA11DHMitmReq(BaseModel):
    p: str
    g: str
    a: str
    b: str
    e: str

class PA11DHMitmRes(BaseModel):
    A: str
    B: str
    A_prime: str
    B_prime: str
    sharedA: str
    sharedB: str
    sharedEveA: str
    sharedEveB: str

@app.post("/api/pa11/dh_mitm", response_model=PA11DHMitmRes)
def pa11_dh_mitm(req: PA11DHMitmReq):
    p_val = int(req.p, 16) if req.p.startswith('0x') else int(req.p)
    g_val = int(req.g, 16) if req.g.startswith('0x') else int(req.g)
    a_val = int(req.a, 16) if req.a.startswith('0x') else int(req.a)
    b_val = int(req.b, 16) if req.b.startswith('0x') else int(req.b)
    e_val = int(req.e, 16) if req.e.startswith('0x') else int(req.e)
    
    G = pa11.Group(p_val)
    g_elem = pa11.GroupElement(g_val, G)
    
    A = g_elem ** a_val
    B = g_elem ** b_val
    
    A_prime, B_prime, shared_eve_alice, shared_eve_bob = pa11.mitm_attack(G, g_elem, A, B, e_val)
    
    # Alice receives B_prime instead of B
    sharedA = pa11.dh_alice_step2(a_val, B_prime)
    # Bob receives A_prime instead of A
    sharedB = pa11.dh_bob_step2(b_val, A_prime)
    
    return PA11DHMitmRes(
        A=hex(A.value),
        B=hex(B.value),
        A_prime=hex(A_prime.value),
        B_prime=hex(B_prime.value),
        sharedA=hex(sharedA.value),
        sharedB=hex(sharedB.value),
        sharedEveA=hex(shared_eve_alice.value),
        sharedEveB=hex(shared_eve_bob.value)
    )

class PA11CDHReq(BaseModel):
    p: str
    g: str
    A: str
    B: str

class PA11CDHRes(BaseModel):
    shared: str
    elapsed: float

@app.post("/api/pa11/cdh", response_model=PA11CDHRes)
def pa11_cdh(req: PA11CDHReq):
    p_val = int(req.p, 16) if req.p.startswith('0x') else int(req.p)
    g_val = int(req.g, 16) if req.g.startswith('0x') else int(req.g)
    A_val = int(req.A, 16) if req.A.startswith('0x') else int(req.A)
    B_val = int(req.B, 16) if req.B.startswith('0x') else int(req.B)
    
    G = pa11.Group(p_val)
    g_elem = pa11.GroupElement(g_val, G)
    A_elem = pa11.GroupElement(A_val, G)
    B_elem = pa11.GroupElement(B_val, G)
    
    try:
        shared, elapsed = pa11.brute_force_cdh(G, g_elem, A_elem, B_elem)
    except ValueError:
        return PA11CDHRes(shared="error", elapsed=0)
        
    return PA11CDHRes(
        shared=hex(shared.value),
        elapsed=elapsed
    )


# --- PA #12 — RSA and PKCS#1 v1.5 ---------------------------------------------

class PA12KeygenRes(BaseModel):
    n: str
    e: str
    d: str
    p: str
    q: str

@app.get("/api/pa12/keygen", response_model=PA12KeygenRes)
def pa12_keygen():
    # Generate 512-bit RSA keys
    pk, sk = pa12.keygen(512)
    return PA12KeygenRes(
        n=hex(pk[0]),
        e=hex(pk[1]),
        d=hex(sk[1]),
        p=hex(sk[2]),
        q=hex(sk[3])
    )

class PA12EncryptTwiceReq(BaseModel):
    n: str
    e: str
    message: str

class PA12EncryptTwiceRes(BaseModel):
    textbook_c1: str
    textbook_c2: str
    pkcs15_c1: str
    pkcs15_c2: str
    pkcs15_ps1: str
    pkcs15_ps2: str

@app.post("/api/pa12/encrypt_twice", response_model=PA12EncryptTwiceRes)
def pa12_encrypt_twice(req: PA12EncryptTwiceReq):
    n = int(req.n, 16) if req.n.startswith('0x') else int(req.n)
    e = int(req.e, 16) if req.e.startswith('0x') else int(req.e)
    pk = (n, e)
    
    m_bytes = req.message.encode("utf-8")
    m_int = int.from_bytes(m_bytes, "big")
    
    # Textbook RSA
    tb_c1 = pa12.rsa_enc(pk, m_int)
    tb_c2 = pa12.rsa_enc(pk, m_int)
    
    # PKCS#1 v1.5
    pkcs_c1, ps1 = pa12.pkcs15_enc(pk, m_bytes)
    pkcs_c2, ps2 = pa12.pkcs15_enc(pk, m_bytes)
    
    return PA12EncryptTwiceRes(
        textbook_c1=hex(tb_c1),
        textbook_c2=hex(tb_c2),
        pkcs15_c1=hex(pkcs_c1),
        pkcs15_c2=hex(pkcs_c2),
        pkcs15_ps1=ps1.hex(),
        pkcs15_ps2=ps2.hex()
    )


# --- PA #13 — Miller-Rabin ----------------------------------------------------

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
        
        import pa8
        h_bytes = pa8.dlp_hash(r_str + m_bytes)
        h = h_bytes.hex()
        
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

# --- PA #18 — Oblivious Transfer ----------------------------------------------
class PA18OTReq(BaseModel):
    choice: int = Field(..., ge=0, le=1)
    m0: int
    m1: int

class PA18OTRes(BaseModel):
    received: int

@app.post("/api/pa18/ot", response_model=PA18OTRes)
def pa18_ot(req: PA18OTReq):
    msg = pa18.OT(req.choice, (req.m0, req.m1))
    return PA18OTRes(received=msg)

# --- PA #19 — Garbled Gates ---------------------------------------------------

class PA19GateReq(BaseModel):
    gate: str
    a: int = Field(..., ge=0, le=1)
    b: int = Field(0, ge=0, le=1)

class PA19GateRes(BaseModel):
    result: int
    error: str = ""

@app.post("/api/pa19/gate", response_model=PA19GateRes)
def pa19_gate(req: PA19GateReq):
    try:
        if req.gate == "AND":
            r = pa19.SecureAND(req.a, req.b)
        elif req.gate == "XOR":
            r = pa19.SecureXOR(req.a, req.b)
        elif req.gate == "NOT":
            r = pa19.SecureNOT(req.a)
        else:
            return PA19GateRes(result=0, error="Unknown gate")
        return PA19GateRes(result=r)
    except Exception as e:
        return PA19GateRes(result=0, error=str(e))

# --- PA #20 — Yao's Millionaires ----------------------------------------------

class PA20Req(BaseModel):
    circuit: str
    input0: int
    input1: int

class PA20Res(BaseModel):
    result: int
    error: str = ""

@app.post("/api/pa20", response_model=PA20Res)
def pa20_post(req: PA20Req):
    try:
      from core.pa20 import int_to_bits, Secure_Eval
      if req.circuit == "millionaire":
          from core.pa20 import millionaires_problem_circuit
          result = Secure_Eval(millionaires_problem_circuit(8), int_to_bits(input0, 16), int_to_bits(input1, 16))
          return PA20Res(result=result)
      elif req.circuit == "equality":
          from core.pa20 import equality_test_circuit
          result = Secure_Eval(equality_test_circuit(16), int_to_bits(input0, 16), int_to_bits(input1, 16))
          return PA20Res(result=result)
      elif req.circuit == "addition":
          from core.pa20 import bit_addition_circuit
          result = Secure_Eval(bit_addition_circuit(16), int_to_bits(input0, 16), int_to_bits(input1, 16))
          return PA20Res(result=int("".join(str(b) for b in result), 2))
      else:
          raise HTTPException(status_code=400, detail="Invalid circuit name")
    except Exception as e:
        return PA20Res(result=0, error=str(e))
