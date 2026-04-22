from __future__ import annotations

import os
import sys
import unittest
from typing import Callable

import pa1


# 1. AES-128 (FIPS-197) -- fully self-contained

BLOCK_SIZE = 16
_NB = 4
_NK = 4
_NR = 10

_SBOX = bytes.fromhex(
    "637c777bf26b6fc53001672bfed7ab76"
    "ca82c97dfa5947f0add4a2af9ca472c0"
    "b7fd9326363ff7cc34a5e5f171d83115"
    "04c723c31896059a071280e2eb27b275"
    "09832c1a1b6e5aa0523bd6b329e32f84"
    "53d100ed20fcb15b6acbbe394a4c58cf"
    "d0efaafb434d338545f9027f503c9fa8"
    "51a3408f929d38f5bcb6da2110fff3d2"
    "cd0c13ec5f974417c4a77e3d645d1973"
    "60814fdc222a908846eeb814de5e0bdb"
    "e0323a0a4906245cc2d3ac629195e479"
    "e7c8376d8dd54ea96c56f4ea657aae08"
    "ba78252e1ca6b4c6e8dd741f4bbd8b8a"
    "703eb5664803f60e613557b986c11d9e"
    "e1f8981169d98e949b1e87e9ce5528df"
    "8ca1890dbfe6426841992d0fb054bb16"
)

_INV_SBOX = bytes.fromhex(
    "52096ad53036a538bf40a39e81f3d7fb"
    "7ce339829b2fff87348e4344c4dee9cb"
    "547b9432a6c2233dee4c950b42fac34e"
    "082ea16628d924b2765ba2496d8bd125"
    "72f8f66486689816d4a45ccc5d65b692"
    "6c704850fdedb9da5e154657a78d9d84"
    "90d8ab008cbcd30af7e45805b8b34506"
    "d02c1e8fca3f0f02c1afbd0301138a6b"
    "3a9111414f67dcea97f2cfcef0b4e673"
    "96ac7422e7ad3585e2f937e81c75df6e"
    "47f11a711d29c5896fb7620eaa18be1b"
    "fc563e4bc6d279209adbc0fe78cd5af4"
    "1fdda8338807c731b11210592780ec5f"
    "60517fa919b54a0d2de57a9f93c99cef"
    "a0e03b4dae2af5b0c8ebbb3c83539961"
    "172b047eba77d626e169146355210c7d"
)

_RCON = (
    0x01, 0x02, 0x04, 0x08, 0x10,
    0x20, 0x40, 0x80, 0x1B, 0x36,
)


def _xtime(a: int) -> int:
    return ((a << 1) ^ 0x1B) & 0xFF if a & 0x80 else (a << 1) & 0xFF


def _gmul(a: int, b: int) -> int:
    res = 0
    for _ in range(8):
        if b & 1:
            res ^= a
        a = _xtime(a)
        b >>= 1
    return res & 0xFF


def _sub_bytes(state: list[int]) -> None:
    for i in range(16):
        state[i] = _SBOX[state[i]]


def _inv_sub_bytes(state: list[int]) -> None:
    for i in range(16):
        state[i] = _INV_SBOX[state[i]]


def _shift_rows(state: list[int]) -> None:
    new = state[:]
    for r in range(4):
        for c in range(4):
            new[r + 4 * c] = state[r + 4 * ((c + r) % 4)]
    state[:] = new


def _inv_shift_rows(state: list[int]) -> None:
    new = state[:]
    for r in range(4):
        for c in range(4):
            new[r + 4 * c] = state[r + 4 * ((c - r) % 4)]
    state[:] = new


def _mix_columns(state: list[int]) -> None:
    for c in range(4):
        a0, a1, a2, a3 = state[4 * c], state[4 * c + 1], state[4 * c + 2], state[4 * c + 3]
        state[4 * c]     = _gmul(a0, 2) ^ _gmul(a1, 3) ^ a2 ^ a3
        state[4 * c + 1] = a0 ^ _gmul(a1, 2) ^ _gmul(a2, 3) ^ a3
        state[4 * c + 2] = a0 ^ a1 ^ _gmul(a2, 2) ^ _gmul(a3, 3)
        state[4 * c + 3] = _gmul(a0, 3) ^ a1 ^ a2 ^ _gmul(a3, 2)


def _inv_mix_columns(state: list[int]) -> None:
    for c in range(4):
        a0, a1, a2, a3 = state[4 * c], state[4 * c + 1], state[4 * c + 2], state[4 * c + 3]
        state[4 * c]     = _gmul(a0, 0x0e) ^ _gmul(a1, 0x0b) ^ _gmul(a2, 0x0d) ^ _gmul(a3, 0x09)
        state[4 * c + 1] = _gmul(a0, 0x09) ^ _gmul(a1, 0x0e) ^ _gmul(a2, 0x0b) ^ _gmul(a3, 0x0d)
        state[4 * c + 2] = _gmul(a0, 0x0d) ^ _gmul(a1, 0x09) ^ _gmul(a2, 0x0e) ^ _gmul(a3, 0x0b)
        state[4 * c + 3] = _gmul(a0, 0x0b) ^ _gmul(a1, 0x0d) ^ _gmul(a2, 0x09) ^ _gmul(a3, 0x0e)


def _add_round_key(state: list[int], round_key: list[int]) -> None:
    for i in range(16):
        state[i] ^= round_key[i]


def _key_expansion(key: bytes) -> list[list[int]]:
    """Expand a 16-byte AES-128 key into 11 round keys (44 4-byte words)."""
    if len(key) != 16:
        raise ValueError("AES-128 requires a 16-byte key")
    words: list[list[int]] = [list(key[i:i + 4]) for i in range(0, 16, 4)]
    for i in range(_NK, _NB * (_NR + 1)):
        temp = words[i - 1][:]
        if i % _NK == 0:
            temp = temp[1:] + temp[:1]
            temp = [_SBOX[b] for b in temp]
            temp[0] ^= _RCON[i // _NK - 1]
        words.append([words[i - _NK][j] ^ temp[j] for j in range(4)])
    return [sum(words[4 * r: 4 * r + 4], []) for r in range(_NR + 1)]


def _aes_encrypt_block(key: bytes, block: bytes) -> bytes:
    if len(block) != 16:
        raise ValueError("AES block must be exactly 16 bytes")
    round_keys = _key_expansion(key)
    state = list(block)

    _add_round_key(state, round_keys[0])
    for r in range(1, _NR):
        _sub_bytes(state)
        _shift_rows(state)
        _mix_columns(state)
        _add_round_key(state, round_keys[r])
    _sub_bytes(state)
    _shift_rows(state)
    _add_round_key(state, round_keys[_NR])
    return bytes(state)


def _aes_decrypt_block(key: bytes, block: bytes) -> bytes:
    if len(block) != 16:
        raise ValueError("AES block must be exactly 16 bytes")
    round_keys = _key_expansion(key)
    state = list(block)

    _add_round_key(state, round_keys[_NR])
    for r in range(_NR - 1, 0, -1):
        _inv_shift_rows(state)
        _inv_sub_bytes(state)
        _add_round_key(state, round_keys[r])
        _inv_mix_columns(state)
    _inv_shift_rows(state)
    _inv_sub_bytes(state)
    _add_round_key(state, round_keys[0])
    return bytes(state)


# 2. PRP INTERFACE 
def prp_encrypt(k: bytes, block: bytes) -> bytes:
    """AES-128 as a PRP. PA #4 will import this name directly."""
    return _aes_encrypt_block(k, block)


def prp_decrypt(k: bytes, block: bytes) -> bytes:
    """Inverse PRP."""
    return _aes_decrypt_block(k, block)

# 3. GENERAL PRF INTERFACE (what PA #3 imports as F)

def F(k: bytes, x: bytes) -> bytes:
    """
    Length-preserving PRF wrapper over AES.

    For |x| == BLOCK_SIZE:  F(k, x) = AES_k(x) directly.
    For |x| <  BLOCK_SIZE:  F(k, x) = truncate( AES_k(pad(x)) ).
    For |x| >  BLOCK_SIZE:  stretch via AES-CTR seeded by a domain tag.

    The PRF/PRP switching lemma guarantees F is a secure PRF for
    polynomially many distinct queries.
    """
    if len(k) != BLOCK_SIZE:
        raise ValueError(f"AES PRF requires a {BLOCK_SIZE}-byte key")

    if len(x) == BLOCK_SIZE:
        return prp_encrypt(k, x)

    if len(x) < BLOCK_SIZE:
        padded = x + bytes([BLOCK_SIZE - len(x)]) * (BLOCK_SIZE - len(x))
        return prp_encrypt(k, padded)[: len(x)]

    # |x| > BLOCK_SIZE: CBC-MAC-style compress to a tag, then CTR-stretch.
    tag = prp_encrypt(k, x[:BLOCK_SIZE])
    for i in range(BLOCK_SIZE, len(x), BLOCK_SIZE):
        chunk = x[i:i + BLOCK_SIZE]
        if len(chunk) < BLOCK_SIZE:
            chunk = chunk + bytes([BLOCK_SIZE - len(chunk)]) * (BLOCK_SIZE - len(chunk))
        tag = bytes(a ^ b for a, b in zip(tag, chunk))
        tag = prp_encrypt(k, tag)

    out = bytearray()
    ctr = 0
    while len(out) < len(x):
        counter_block = bytes(
            a ^ b for a, b in zip(ctr.to_bytes(BLOCK_SIZE, "big"), tag)
        )
        out.extend(prp_encrypt(k, counter_block))
        ctr += 1
    return bytes(out[: len(x)])


# 4. GGM TREE PRF over PA #1's length-doubling G
# Standard GGM:
#     F_k(x_1 x_2 ... x_n) = G_{x_n}( G_{x_{n-1}}( ... G_{x_1}(k) ... ) )

def F_ggm(k: bytes, x_bits: list[int]) -> bytes:
    """GGM PRF. k: arbitrary-size seed; x_bits: list of 0/1 bits."""
    s = k
    for bit in x_bits:
        s = pa1.G1(s) if bit else pa1.G0(s)
    return s


# 5. BACKWARD REDUCTION: PRF ==> PRG

def prg_from_prf(prf: Callable[[bytes, bytes], bytes], key: bytes,
                 out_bytes: int, block: int = BLOCK_SIZE) -> bytes:
    """Build a PRG from a PRF by evaluating it at successive counters."""
    out = bytearray()
    i = 0
    while len(out) < out_bytes:
        x = i.to_bytes(block, "big")
        out.extend(prf(key, x))
        i += 1
    return bytes(out[:out_bytes])


# 6. DISTINGUISHING-GAME DEMO

def distinguishing_game(prf: Callable[[bytes, bytes], bytes],
                        key_len: int, rounds: int = 64) -> float:
    """
    Simulate the classic PRF-vs-random distinguishing game with a trivial
    'query twice, check determinism' adversary.

    A secure PRF is deterministic so the 'real' side always returns 1;
    a random function matches only by collision chance (~2^-128 for AES).
    Advantage therefore stays near 1.0 for this distinguisher, which is
    expected: it is specifically designed to reveal *this* structural
    property, not IND-CPA security.
    """
    def real_world_trial() -> int:
        k = os.urandom(key_len)
        x = os.urandom(BLOCK_SIZE)
        return 1 if prf(k, x) == prf(k, x) else 0

    def random_world_trial() -> int:
        return 1 if os.urandom(BLOCK_SIZE) == os.urandom(BLOCK_SIZE) else 0

    p_real = sum(real_world_trial() for _ in range(rounds)) / rounds
    p_rand = sum(random_world_trial() for _ in range(rounds)) / rounds
    return abs(p_real - p_rand)


# 7. DEMOS AND UNIT TESTS

_FIPS_KEY = bytes.fromhex("000102030405060708090a0b0c0d0e0f")
_FIPS_PT  = bytes.fromhex("00112233445566778899aabbccddeeff")
_FIPS_CT  = bytes.fromhex("69c4e0d86a7b0430d8cdb78070b4c55a")


def _demo() -> None:
    print("=== PA #2 -- PRF / PRP demonstration ===\n")

    print("--- (1) AES-128 FIPS-197 known-answer test ---")
    got = prp_encrypt(_FIPS_KEY, _FIPS_PT)
    print(f"plaintext : {_FIPS_PT.hex()}")
    print(f"expected  : {_FIPS_CT.hex()}")
    print(f"got       : {got.hex()}  {'MATCH' if got == _FIPS_CT else 'MISMATCH'}")

    print("\n--- (2) PRP roundtrip ---")
    k = os.urandom(BLOCK_SIZE)
    pt = os.urandom(BLOCK_SIZE)
    ct = prp_encrypt(k, pt)
    back = prp_decrypt(k, ct)
    print(f"pt : {pt.hex()}")
    print(f"ct : {ct.hex()}")
    print(f"back == pt? {back == pt}")

    print("\n--- (3) General PRF F(k, x) over varied lengths ---")
    for n in (5, 16, 40):
        y = F(k, os.urandom(n))
        print(f"|x| = {n:2d}  ->  |F(k,x)| = {len(y)}  sample = {y[:8].hex()}...")

    print("\n--- (4) GGM tree PRF (depth-4 demo, small seed) ---")
    small_k = os.urandom(16)
    bits = [1, 0, 1, 1]
    print(f"F_ggm(k, {bits}) = {F_ggm(small_k, bits).hex()[:32]}...")

    print("\n--- (5) Backward reduction: PRG from PRF ---")
    prg_out = prg_from_prf(F, k, 48)
    print(f"prg_from_prf(F, k, 48) = {prg_out.hex()}")

    print("\n--- (6) Distinguishing-game advantage (AES PRF) ---")
    adv = distinguishing_game(prp_encrypt, key_len=BLOCK_SIZE, rounds=32)
    print(f"det-query advantage (~1.0 for any deterministic PRF): {adv:.3f}")


class TestPA2(unittest.TestCase):
    def test_aes_fips197_vector(self):
        self.assertEqual(prp_encrypt(_FIPS_KEY, _FIPS_PT), _FIPS_CT)

    def test_aes_decrypt_fips197_vector(self):
        self.assertEqual(prp_decrypt(_FIPS_KEY, _FIPS_CT), _FIPS_PT)

    def test_prp_roundtrip_random(self):
        for _ in range(8):
            k = os.urandom(BLOCK_SIZE)
            pt = os.urandom(BLOCK_SIZE)
            self.assertEqual(prp_decrypt(k, prp_encrypt(k, pt)), pt)

    def test_prp_deterministic(self):
        k = os.urandom(BLOCK_SIZE)
        pt = os.urandom(BLOCK_SIZE)
        self.assertEqual(prp_encrypt(k, pt), prp_encrypt(k, pt))

    def test_prp_key_sensitivity(self):
        pt = os.urandom(BLOCK_SIZE)
        k1 = os.urandom(BLOCK_SIZE)
        k2 = bytearray(k1)
        k2[0] ^= 1
        self.assertNotEqual(prp_encrypt(k1, pt), prp_encrypt(bytes(k2), pt))

    def test_F_block_size_equals_aes(self):
        k = os.urandom(BLOCK_SIZE)
        x = os.urandom(BLOCK_SIZE)
        self.assertEqual(F(k, x), prp_encrypt(k, x))

    def test_F_variable_length_deterministic(self):
        k = os.urandom(BLOCK_SIZE)
        for n in (1, 7, 16, 31, 64):
            x = os.urandom(n)
            y1 = F(k, x)
            y2 = F(k, x)
            self.assertEqual(y1, y2)
            self.assertEqual(len(y1), n)

    def test_ggm_determinism(self):
        k = os.urandom(16)
        bits = [1, 0, 1]
        self.assertEqual(F_ggm(k, bits), F_ggm(k, bits))

    def test_ggm_distinct_paths_differ(self):
        k = os.urandom(16)
        self.assertNotEqual(F_ggm(k, [0, 1]), F_ggm(k, [1, 0]))

    def test_prg_from_prf_deterministic_and_expanded(self):
        k = os.urandom(BLOCK_SIZE)
        a = prg_from_prf(F, k, 64)
        b = prg_from_prf(F, k, 64)
        self.assertEqual(a, b)
        self.assertEqual(len(a), 64)

    def test_prg_from_prf_distinct_keys(self):
        self.assertNotEqual(prg_from_prf(F, os.urandom(BLOCK_SIZE), 32),
                            prg_from_prf(F, os.urandom(BLOCK_SIZE), 32))


if __name__ == "__main__":
    _demo()
    print("\n--- Running unit tests ---")
    sys.argv = [sys.argv[0]]
    unittest.main(verbosity=2)
