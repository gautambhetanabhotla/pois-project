
from __future__ import annotations

import math
import os
import sys
import time
import unittest
from typing import Callable, Tuple

def randbits(k: int) -> int:
    """Generate k random bits using os.urandom."""
    if k <= 0:
        raise ValueError("number of bits must be greater than zero")
    num_bytes = (k + 7) // 8
    x = int.from_bytes(os.urandom(num_bytes), "big")
    return x >> (num_bytes * 8 - k)

def randbelow(n: int) -> int:
    """Generate a random integer in [0, n) using os.urandom."""
    if n <= 0:
        raise ValueError("n must be > 0")
    k = n.bit_length()
    while True:
        r = randbits(k)
        if r < n:
            return r

def compare_digest(a: bytes, b: bytes) -> bool:
    """Constant-time comparison of two byte strings."""
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a, b):
        result |= x ^ y
    return result == 0


# 1. SELF-CONTAINED MILLER-RABIN PRIMALITY TEST
_SMALL_PRIMES = (
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
    73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151,
    157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233,
    239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293,
)


def miller_rabin(n: int, rounds: int = 40) -> bool:
    """Probabilistic primality test. Error probability < 4^(-rounds)."""
    if n < 2:
        return False
    for p in _SMALL_PRIMES:
        if n == p:
            return True
        if n % p == 0:
            return False

    d, s = n - 1, 0
    while d % 2 == 0:
        d //= 2
        s += 1

    for _ in range(rounds):
        a = randbelow(n - 3) + 2
        x = pow(a, d, n)
        if x == 1 or x == n - 1:
            continue
        composite = True
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                composite = False
                break
        if composite:
            return False
    return True


def is_safe_prime(p: int) -> bool:
    """A safe prime satisfies p = 2q + 1 with q also prime."""
    if not miller_rabin(p):
        return False
    return miller_rabin((p - 1) // 2)


# 2. GROUP PARAMETERS (1024-bit MODP Group 2 from RFC 3526)

_MOD_P = int(
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1"
    "29024E088A67CC74020BBEA63B139B22514A08798E3404DD"
    "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245"
    "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381"
    "FFFFFFFFFFFFFFFF", 16,
)
_GEN_G = 2
_SUB_Q = (_MOD_P - 1) // 2

_P_BITS = _MOD_P.bit_length()
_P_BYTES = (_P_BITS + 7) // 8
N_BYTES = _P_BYTES
R_BYTES = _P_BYTES
SEED_BYTES = N_BYTES + R_BYTES


# 3. ONE-WAY FUNCTION (forward direction -- the DLP is hard)

def owf(x: bytes) -> bytes:
    """
    f(x) = g^x mod p  --  one-way assuming the Discrete Log Problem is hard.

    Input  : x  -- any-length byte string, interpreted as an integer then
                   reduced mod q (the prime-order subgroup).
    Output : y  -- fixed-length (N_BYTES) byte string containing g^x mod p.
    """
    x_int = int.from_bytes(x, "big") % _SUB_Q
    y_int = pow(_GEN_G, x_int, _MOD_P)
    return y_int.to_bytes(_P_BYTES, "big")


# 4. GOLDREICH-LEVIN HARD-CORE BIT + HILL ITERATION

def _inner_product_mod2(a: int, b: int) -> int:
    return (a & b).bit_count() & 1


def hill_bit(x: bytes, r: bytes) -> Tuple[bytes, int]:
    """
    One HILL iteration.

    Returns (next_state, hard_core_bit) where
        bit         = <x, r> mod 2   (Goldreich-Levin predicate)
        next_state  = f(x)            (apply the OWF to advance)
    """
    x_int = int.from_bytes(x, "big")
    r_int = int.from_bytes(r, "big")
    bit = _inner_product_mod2(x_int, r_int)
    return owf(x), bit


# 5. STREAMING PRG API

class PRGState:
    """Mutable state for the HILL PRG: (current x, fixed reference r)."""
    __slots__ = ("x", "r", "_buf", "_buf_bits")

    def __init__(self, x: bytes, r: bytes):
        if len(x) != N_BYTES or len(r) != R_BYTES:
            raise ValueError(f"expected x of {N_BYTES} bytes and r of {R_BYTES} bytes")
        self.x = x
        self.r = r
        self._buf = 0
        self._buf_bits = 0


def seed(seed_bytes: bytes) -> PRGState:
    """Initialise PRG state from SEED_BYTES bytes, split as (x || r)."""
    if len(seed_bytes) != SEED_BYTES:
        raise ValueError(f"seed must be exactly {SEED_BYTES} bytes")
    return PRGState(seed_bytes[:N_BYTES], seed_bytes[N_BYTES:])


def next_bits(state: PRGState, n_bits: int) -> int:
    """Return the next n_bits pseudo-random bits as an integer (MSB first)."""
    if n_bits < 0:
        raise ValueError("n_bits must be non-negative")
    while state._buf_bits < n_bits:
        state.x, b = hill_bit(state.x, state.r)
        state._buf = (state._buf << 1) | b
        state._buf_bits += 1
    extra = state._buf_bits - n_bits
    out = state._buf >> extra
    state._buf &= (1 << extra) - 1
    state._buf_bits = extra
    return out


def next_bytes(state: PRGState, n_bytes: int) -> bytes:
    return next_bits(state, n_bytes * 8).to_bytes(n_bytes, "big")


# 6. BATCH PRG + LENGTH-DOUBLING G, G0, G1 (consumed by PA #2's GGM tree)

def _stretch_to_seed(seed_bytes: bytes, counter: int) -> bytes:
    """Deterministically fold an arbitrary-size seed into a SEED_BYTES seed."""
    # Simple domain-separating expansion: feed chunks of (seed || counter || i)
    # through owf to fill out SEED_BYTES deterministically.
    blocks: list[bytes] = []
    i = 0
    while sum(len(b) for b in blocks) < SEED_BYTES:
        msg = seed_bytes + counter.to_bytes(8, "big") + i.to_bytes(4, "big")
        blocks.append(owf(msg))
        i += 1
    return b"".join(blocks)[:SEED_BYTES]


def PRG(seed_bytes: bytes, out_bytes: int) -> bytes:
    """
    Batch PRG: deterministic expansion of seed_bytes into out_bytes output.

    If the seed is exactly SEED_BYTES long it is used verbatim; otherwise
    it is deterministically stretched first so that G / G0 / G1 work for
    any input size (needed by the GGM tree).
    """
    if len(seed_bytes) == SEED_BYTES:
        st = seed(seed_bytes)
    else:
        st = seed(_stretch_to_seed(seed_bytes, 0))
    return next_bytes(st, out_bytes)


def G(seed_bytes: bytes) -> bytes:
    """Length-doubling PRG: |output| == 2 * |seed|."""
    return PRG(seed_bytes, 2 * len(seed_bytes))


def G0(seed_bytes: bytes) -> bytes:
    """Left child in the GGM tree: first half of G(seed)."""
    return G(seed_bytes)[: len(seed_bytes)]


def G1(seed_bytes: bytes) -> bytes:
    """Right child in the GGM tree: second half of G(seed)."""
    return G(seed_bytes)[len(seed_bytes):]


# 7. BACKWARD REDUCTION: PRG ==> OWF
#
# Claim: f(s) := G(s) is a one-way function whenever G is a length-doubling PRG.
#
# Why an adversary given y = G(s) cannot efficiently recover s.
# Suppose, for contradiction, there is an efficient algorithm A such that for
# random s in {0,1}^n, A(G(s)) outputs some s' with G(s') = G(s) with
# non-negligible probability eps. Build a PRG distinguisher D:
#
#     D(y): run s' <- A(y);  if G(s') == y output 1 ("real"), else output 0.
#
# Analysis of D:
#   - On y = G(s), s uniform in {0,1}^n:  Pr[D = 1] >= eps  (A succeeds).
#   - On y uniform in {0,1}^{2n}:  the image of G has size <= 2^n out of
#     2^{2n} total strings, so Pr[y in Image(G)] <= 2^{-n}, and therefore
#     Pr[D = 1] <= 2^{-n}.
#
# Distinguishing advantage:  |Pr[D(G(s)) = 1] - Pr[D(U_{2n}) = 1]| >= eps - 2^{-n}.
#
# That advantage is non-negligible whenever eps is, contradicting the
# pseudorandomness of G. Therefore no efficient inverter for f can exist;
# f is one-way. See _demo() section (5) for an empirical brute-force
# inversion attempt that fails as predicted by this bound.

def owf_from_prg(prg: Callable[[bytes], bytes], x: bytes) -> bytes:
    """Build an OWF from a length-doubling PRG by literally calling it."""
    y = prg(x)
    if len(y) < 2 * len(x):
        raise ValueError("input PRG must be length-doubling (or longer)")
    return y


# 8. NIST SP 800-22 STATISTICAL TESTS (monobit / runs / serial)

def _bit_array(data: bytes) -> list[int]:
    bits: list[int] = []
    for byte in data:
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)
    return bits


def monobit_test(data: bytes) -> float:
    """NIST 2.1 Frequency (Monobit) Test. Returns a p-value in [0,1]."""
    bits = _bit_array(data)
    n = len(bits)
    if n == 0:
        return 1.0
    s = sum(1 if b else -1 for b in bits)
    s_obs = abs(s) / math.sqrt(n)
    return math.erfc(s_obs / math.sqrt(2))


def runs_test(data: bytes) -> float:
    """NIST 2.3 Runs Test. Returns a p-value in [0,1]."""
    bits = _bit_array(data)
    n = len(bits)
    if n == 0:
        return 1.0
    pi = sum(bits) / n
    if abs(pi - 0.5) >= 2.0 / math.sqrt(n):
        return 0.0
    vn = 1 + sum(1 for i in range(1, n) if bits[i] != bits[i - 1])
    num = abs(vn - 2 * n * pi * (1 - pi))
    den = 2 * math.sqrt(2 * n) * pi * (1 - pi)
    return math.erfc(num / den)


def _psi2(bits: list[int], m: int) -> float:
    n = len(bits)
    if m <= 0:
        return 0.0
    extended = bits + bits[: m - 1]
    counts: dict[int, int] = {}
    for i in range(n):
        pat = 0
        for j in range(m):
            pat = (pat << 1) | extended[i + j]
        counts[pat] = counts.get(pat, 0) + 1
    return (2 ** m / n) * sum(v * v for v in counts.values()) - n


def _igamc(a: float, x: float) -> float:
    """Regularised upper incomplete gamma Q(a, x)."""
    if a <= 0:
        return 1.0
    if x <= 0:
        return 1.0
    if x < a + 1:
        term = 1.0 / a
        total = term
        for k in range(1, 200):
            term *= x / (a + k)
            total += term
            if abs(term) < abs(total) * 1e-15:
                break
        p = total * math.exp(-x + a * math.log(x) - math.lgamma(a))
        return max(0.0, min(1.0, 1.0 - p))
    fpmin = 1e-300
    b = x + 1 - a
    c = 1.0 / fpmin
    d = 1.0 / b
    h = d
    for i in range(1, 200):
        an = -i * (i - a)
        b += 2
        d = an * d + b
        if abs(d) < fpmin:
            d = fpmin
        c = b + an / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-15:
            break
    q = h * math.exp(-x + a * math.log(x) - math.lgamma(a))
    return max(0.0, min(1.0, q))


def serial_test(data: bytes, m: int = 3) -> Tuple[float, float]:
    """NIST 2.11 Serial Test. Returns (p-value-1, p-value-2)."""
    bits = _bit_array(data)
    n = len(bits)
    if n == 0 or m < 1:
        return (1.0, 1.0)
    psi_m = _psi2(bits, m)
    psi_m1 = _psi2(bits, m - 1) if m >= 2 else 0.0
    psi_m2 = _psi2(bits, m - 2) if m >= 3 else 0.0
    d1 = psi_m - psi_m1
    d2 = psi_m - 2 * psi_m1 + psi_m2
    p1 = _igamc(2 ** (m - 2), d1 / 2) if m >= 2 else 1.0
    p2 = _igamc(2 ** (m - 3), d2 / 2) if m >= 3 else 1.0
    return (p1, p2)


# 9. DEMOS AND UNIT TESTS

def _demo() -> None:
    print("=== PA #1 -- OWF / HILL PRG demonstration ===\n")

    print(f"MODP prime p : {_P_BITS} bits")
    print(f"Seed size    : {SEED_BYTES} bytes  (x: {N_BYTES} + r: {R_BYTES})")
    print(f"p is prime?        {miller_rabin(_MOD_P, rounds=8)}")
    print(f"p is safe-prime?   {is_safe_prime(_MOD_P)}")

    print("\n--- (1) OWF determinism + avalanche ---")
    x = os.urandom(N_BYTES)
    y1, y2 = owf(x), owf(x)
    print(f"f(x) == f(x)?  {y1 == y2}")
    x2 = bytearray(x)
    x2[0] ^= 0x01
    y3 = owf(bytes(x2))
    diff_bits = bin(int.from_bytes(y1, "big") ^ int.from_bytes(y3, "big")).count("1")
    print(f"Hamming distance after 1-bit flip of x: {diff_bits} / {len(y1)*8} bits "
          f"(expected ~{len(y1)*4})")

    print("\n--- (2) HILL PRG streaming demo ---")
    st = seed(os.urandom(SEED_BYTES))
    t0 = time.perf_counter()
    first = next_bytes(st, 32)
    dt = time.perf_counter() - t0
    print(f"First 32 bytes of output: {first.hex()}")
    print(f"Throughput: 256 bits in {dt*1000:.1f} ms")

    print("\n--- (3) Length-doubling G / G0 / G1 ---")
    short_seed = os.urandom(16)
    g_out = G(short_seed)
    g0 = G0(short_seed)
    g1 = G1(short_seed)
    print(f"|seed|         = {len(short_seed)}  |G(seed)| = {len(g_out)}")
    print(f"G0||G1 == G?   {g0 + g1 == g_out}")

    print("\n--- (4) NIST statistical tests on 2048-bit PRG output ---")
    sample = PRG(os.urandom(SEED_BYTES), 256)
    p_mono = monobit_test(sample)
    p_runs = runs_test(sample)
    p_ser1, p_ser2 = serial_test(sample, m=3)
    print(f"monobit p-value : {p_mono:.4f}  {'OK' if p_mono > 0.01 else 'WEAK'}")
    print(f"runs    p-value : {p_runs:.4f}  {'OK' if p_runs > 0.01 else 'WEAK'}")
    print(f"serial  p-values: {p_ser1:.4f}, {p_ser2:.4f}")

    print("\n--- (5) Backward reduction: f(s) = G(s) is a OWF ---")
    seed_small = os.urandom(16)
    target = owf_from_prg(G, seed_small)
    print(f"|seed| = 16 bytes  ->  |f(seed)| = {len(target)} bytes")

    # Empirical demonstration that random inversion fails.
    # Search space for 16-byte seeds is 2^128; with the budget below the
    # success probability is ~ attempts / 2^128, i.e. effectively zero.
    attempts = 50_000
    found = False
    for _ in range(attempts):
        if G(os.urandom(16)) == target:
            found = True
            break
    print(f"Brute-force inversion: tried {attempts} random 16-byte preimages")
    print(f"  found preimage?  {found}   "
          f"(expected False; success prob ~ {attempts}/2^128 ≈ {attempts / (2**128):.2e})")


class TestPA1(unittest.TestCase):
    def test_miller_rabin_known_primes(self):
        for p in (2, 3, 5, 7, 97, 7919, 15485863):
            self.assertTrue(miller_rabin(p))
        for c in (1, 4, 9, 15, 100, 7920):
            self.assertFalse(miller_rabin(c))

    def test_modp_is_safe_prime(self):
        self.assertTrue(is_safe_prime(_MOD_P))

    def test_owf_deterministic(self):
        x = os.urandom(N_BYTES)
        self.assertEqual(owf(x), owf(x))
        self.assertEqual(len(owf(x)), N_BYTES)

    def test_prg_deterministic(self):
        s = os.urandom(SEED_BYTES)
        self.assertEqual(PRG(s, 64), PRG(s, 64))

    def test_prg_distinct_seeds(self):
        self.assertNotEqual(PRG(os.urandom(SEED_BYTES), 32),
                            PRG(os.urandom(SEED_BYTES), 32))

    def test_streaming_matches_batch(self):
        s = os.urandom(SEED_BYTES)
        batch = PRG(s, 40)
        st = seed(s)
        streamed = next_bytes(st, 13) + next_bytes(st, 7) + next_bytes(st, 20)
        self.assertEqual(batch, streamed)

    def test_length_doubling_seed_size(self):
        s = os.urandom(SEED_BYTES)
        self.assertEqual(len(G(s)), 2 * SEED_BYTES)
        self.assertEqual(G0(s) + G1(s), G(s))

    def test_length_doubling_small_seed(self):
        s = os.urandom(16)
        self.assertEqual(len(G(s)), 32)
        self.assertEqual(G0(s) + G1(s), G(s))
        self.assertEqual(len(G0(s)), 16)

    def test_owf_from_prg_roundtrip_shape(self):
        s = os.urandom(16)
        self.assertEqual(len(owf_from_prg(G, s)), 32)

    def test_monobit_passes_on_prg_output(self):
        sample = PRG(os.urandom(SEED_BYTES), 256)
        self.assertGreater(monobit_test(sample), 0.001)

    def test_runs_passes_on_prg_output(self):
        sample = PRG(os.urandom(SEED_BYTES), 256)
        self.assertGreater(runs_test(sample), 0.001)


if __name__ == "__main__":
    _demo()
    print("\n--- Running unit tests ---")
    sys.argv = [sys.argv[0]]
    unittest.main(verbosity=2)
