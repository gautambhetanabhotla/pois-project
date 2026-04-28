"""
PA#9 — Birthday Attack (Collision Finding)
==========================================
Implements:
  1. Naive birthday attack       (dict-based, O(2^n/2) time, O(2^n/2) space)
  2. Floyd's cycle detection     (tortoise-and-hare, O(2^n/2) time, O(1) space)
  3. Toy hash (configurable n)   (deliberately weak, for fast demos)
  4. Truncated DLP hash attack   (shows birthday bound breaks PA#8 at short output)
  5. Empirical birthday curve    (100 trials per n, confirms O(2^n/2) prediction)
  6. MD5/SHA-1 context           (theoretical analysis at real CPU speeds)

Imports: pa8 (dlp_hash, get_toy_group, dlp_compress)
"""

import os
import math
import time
from pa8 import dlp_hash


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: Hash Utilities
# ─────────────────────────────────────────────────────────────────────────────

def truncate_to_int(digest: bytes, n_bits: int) -> int:
    """
    Truncate a byte digest to the lowest n_bits, returned as int.
    Used to shrink PA#8's large output for birthday attack demos.
    """
    val = int.from_bytes(digest, 'big')
    return val & ((1 << n_bits) - 1)


def make_truncated_dlp_hash(n_bits: int):
    """
    Wraps PA#8's dlp_hash and truncates to n_bits.

    Returns: hash_fn(data: bytes) -> int  [0, 2^n_bits)
    """
    def h(data: bytes) -> int:
        return truncate_to_int(dlp_hash(data), n_bits)
    return h


def toy_hash(data: bytes, n_bits: int) -> int:
    """
    Deliberately weak polynomial rolling hash, truncated to n_bits.

    Purpose: fast birthday attack demos for n in {8, 10, 12, 14, 16}.
    NOT cryptographically secure — designed to be broken quickly.
    """
    val = 0x345678
    for byte in data:
        val = (val * 1000003) ^ byte
        val &= 0xFFFFFFFF
    return val & ((1 << n_bits) - 1)


def make_toy_hash(n_bits: int):
    """
    Returns: hash_fn(data: bytes) -> int  [0, 2^n_bits)
    """
    def h(data: bytes) -> int:
        return toy_hash(data, n_bits)
    return h


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: Naive Birthday Attack (Dict-Based)
# ─────────────────────────────────────────────────────────────────────────────

def birthday_attack(hash_fn, n_bits: int, max_attempts: int = None) -> tuple:
    """
    Naive birthday attack: hash random inputs, store in dict, detect first collision.

    Algorithm:
        1. Sample random 4-byte input x
        2. Compute h = hash_fn(x)
        3. If h seen before with a DIFFERENT x: collision found
        4. Else: store h -> x, repeat

    Complexity: O(2^(n/2)) time and space.

    Args:
        hash_fn      : callable(bytes) -> int, output space = 2^n_bits
        n_bits       : bit width of hash output
        max_attempts : safety cap (default: 20 * 2^(n/2))

    Returns:
        (x1: bytes, x2: bytes, digest: int, attempts: int)
        Guarantee: x1 != x2, hash_fn(x1) == hash_fn(x2) == digest
    """
    if max_attempts is None:
        max_attempts = int(20 * (2 ** (n_bits / 2)))

    seen = {}   # digest -> first input bytes that produced it
    attempts = 0

    while attempts < max_attempts:
        x = os.urandom(4)
        h = hash_fn(x)
        attempts += 1

        if h in seen:
            x_prev = seen[h]
            if x_prev != x:
                return (x_prev, x, h, attempts)
        else:
            seen[h] = x

    raise RuntimeError(
        f"No collision found in {max_attempts} attempts for n_bits={n_bits}. "
        "This is statistically unlikely — check your hash function."
    )


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3: Floyd's Cycle Detection Attack (Space-Efficient)
# ─────────────────────────────────────────────────────────────────────────────

def floyd_attack(hash_fn, n_bits: int) -> tuple:
    """
    Space-efficient birthday attack using Floyd's tortoise-and-hare algorithm.

    Key idea: treat hash as an iterated map f: Z -> Z where f(x) = hash_fn(x as bytes).
    Any such map over a finite domain must eventually cycle (pigeonhole).
    The cycle contains two nodes whose PREDECESSORS in the sequence are distinct
    but map to the same value — giving us a collision in hash_fn.

    Algorithm:
        Phase 1 — Detect cycle   : tortoise (1 step) vs hare (2 steps) until they meet.
        Phase 2 — Find cycle entry (mu): reset tortoise to start, step both by 1.
        Phase 3 — Find cycle length (lam): walk around cycle from entry.
        Extract — Collision pair :
            x1 = s_{mu-1}        (mu-1 steps from start, last node before cycle)
            x2 = s_{mu+lam-1}    (lam-1 steps from cycle entry, wraps once around)
            Both f() to s_mu — collision!

    Complexity: O(2^(n/2)) time, O(1) space (only 3 integers stored at any time).

    Args:
        hash_fn : callable(bytes) -> int, output space = 2^n_bits
        n_bits  : bit width of hash output

    Returns:
        (x1: bytes, x2: bytes, digest: int, evals: int)
        Guarantee: x1 != x2, hash_fn(x1) == hash_fn(x2) == digest
    """
    byte_len = max(1, (n_bits + 7) // 8)
    evals = [0]

    def f(val: int) -> int:
        """Iterated map: int -> int via hash_fn."""
        evals[0] += 1
        return hash_fn(val.to_bytes(byte_len, 'big'))

    # Try different starting integers if mu=0 (no tail) is encountered.
    # mu=0 means the starting point is already inside the cycle; we can't
    # extract a tail-vs-cycle collision from it. A different start resolves this.
    for start in range(16):
        evals[0] = 0

        # ── Phase 1: Detect cycle ──────────────────────────────────────────
        tortoise = f(start)
        hare = f(f(start))
        while tortoise != hare:
            tortoise = f(tortoise)
            hare = f(f(hare))
        # Meeting point is somewhere inside the cycle.

        # ── Phase 2: Find cycle entry index (mu = tail length) ────────────
        mu = 0
        tortoise = start
        while tortoise != hare:
            tortoise = f(tortoise)
            hare = f(hare)
            mu += 1
        # tortoise == hare == s_mu (the cycle entry VALUE)

        if mu == 0:
            # Starting point is in the cycle — no distinct tail predecessor.
            # Try next starting integer.
            continue

        cycle_entry = tortoise   # = s_mu

        # ── Phase 3: Find cycle length (lam) ──────────────────────────────
        lam = 1
        runner = f(cycle_entry)
        while runner != cycle_entry:
            runner = f(runner)
            lam += 1
        # cycle_entry loops back to itself in exactly lam steps.

        # ── Extract collision pair ─────────────────────────────────────────
        # s_{mu-1}     : mu-1 steps from `start`  (in the tail)
        # s_{mu+lam-1} : lam-1 steps from cycle_entry  (in the cycle, one lap back)
        # Both map to s_mu under f → collision in hash_fn.

        x1_val = start
        for _ in range(mu - 1):
            x1_val = f(x1_val)       # walk mu-1 steps to s_{mu-1}

        x2_val = cycle_entry
        for _ in range(lam - 1):
            x2_val = f(x2_val)       # walk lam-1 steps to s_{mu+lam-1}

        x1_bytes = x1_val.to_bytes(byte_len, 'big')
        x2_bytes = x2_val.to_bytes(byte_len, 'big')

        # Verify before returning (guards against degenerate edge cases)
        if x1_bytes != x2_bytes and hash_fn(x1_bytes) == hash_fn(x2_bytes):
            digest = hash_fn(x1_bytes)
            evals[0] += 1
            return (x1_bytes, x2_bytes, digest, evals[0])

    # Fallback: naive attack (only if all 16 starts had mu=0 — extremely rare)
    x1, x2, digest, attempts = birthday_attack(hash_fn, n_bits)
    return (x1, x2, digest, attempts)


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4: Empirical Birthday Curve
# ─────────────────────────────────────────────────────────────────────────────

def theoretical_collision_prob(k: int, n_bits: int) -> float:
    """
    P(at least one collision among k hashes into 2^n buckets)
    ≈ 1 - e^{ -k(k-1) / 2^{n+1} }

    The birthday approximation — exact when k << 2^n.
    """
    N = 2 ** n_bits
    return 1.0 - math.exp(-k * (k - 1) / (2 * N))


def run_trials(hash_fn, n_bits: int, num_trials: int = 100) -> list:
    """
    Run num_trials independent birthday attacks.
    Returns list of attempt-counts until first collision for each trial.
    """
    return [birthday_attack(hash_fn, n_bits)[3] for _ in range(num_trials)]


def empirical_birthday_curve(n_bits_list: list, num_trials: int = 100) -> dict:
    """
    For each n in n_bits_list, run num_trials birthday attacks on the toy hash
    and compare empirical results to the theoretical O(2^(n/2)) prediction.

    Args:
        n_bits_list : list of ints, e.g. [8, 10, 12, 14, 16]
        num_trials  : independent runs per n value

    Returns:
        dict: n_bits -> {mean, std, theoretical, ratio, raw}
        ratio ≈ 1.0 confirms the birthday bound is tight.
    """
    results = {}
    for n in n_bits_list:
        h_fn = make_toy_hash(n)
        expected = 2 ** (n / 2)   # theoretical birthday bound

        counts = run_trials(h_fn, n, num_trials)
        mean = sum(counts) / len(counts)
        variance = sum((c - mean) ** 2 for c in counts) / len(counts)
        std = math.sqrt(variance)

        results[n] = {
            'mean': mean,
            'std': std,
            'theoretical': expected,
            'ratio': mean / expected,   # should be close to 1.25 (birthday constant)
            'raw': counts,
        }
    return results


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5: Attack Truncated DLP Hash (PA#8 Integration)
# ─────────────────────────────────────────────────────────────────────────────

def attack_truncated_dlp(n_bits: int = 16) -> dict:
    """
    Birthday attack on PA#8's DLP hash truncated to n_bits output.

    Demonstrates: even a provably collision-resistant hash (secure under DLP
    assumption) is broken at the birthday bound when its output is too short.
    The proof-of-security only guarantees collision resistance UP TO 2^(n/2) work.

    Args:
        n_bits: output bit length (16 recommended — ~256 DLP hash calls needed)

    Returns:
        dict: x1, x2, digest, attempts, expected, ratio, time_sec
    """
    h_fn = make_truncated_dlp_hash(n_bits)
    expected = 2 ** (n_bits / 2)

    t0 = time.time()
    x1, x2, digest, attempts = birthday_attack(h_fn, n_bits)
    elapsed = time.time() - t0

    return {
        'x1': x1.hex(),
        'x2': x2.hex(),
        'digest': digest,
        'attempts': attempts,
        'expected': round(expected, 1),
        'ratio': round(attempts / expected, 2),
        'time_sec': round(elapsed, 3),
    }


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6: MD5 / SHA-1 Context (Theoretical)
# ─────────────────────────────────────────────────────────────────────────────

def birthday_bound_context(hash_rate_per_sec: float = 1e9) -> dict:
    """
    Compute 2^(n/2) collision cost for real hash functions.
    Contextualises why MD5 is broken and SHA-1 is deprecated.

    Args:
        hash_rate_per_sec: CPU hash throughput (default 10^9 hashes/sec)

    Returns:
        dict: algorithm -> {n_bits, birthday_exp, ops, seconds, years, status}
    """
    algorithms = [
        ("MD5",     128, "BROKEN (Dobbertin 1996, Wang et al. 2004)"),
        ("SHA-1",   160, "DEPRECATED (SHAttered attack, 2017)"),
        ("SHA-256", 256, "SECURE (currently)"),
    ]
    results = {}
    for name, n, status in algorithms:
        ops = 2 ** (n / 2)
        seconds = ops / hash_rate_per_sec
        years = seconds / (365.25 * 24 * 3600)
        results[name] = {
            'n_bits': n,
            'birthday_exp': n // 2,
            'ops': ops,
            'seconds': seconds,
            'years': years,
            'status': status,
        }
    return results


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 7: Public API  (consumed by FastAPI / frontend)
# ─────────────────────────────────────────────────────────────────────────────

def find_collision_naive(n_bits: int = 16, use_dlp: bool = False) -> dict:
    """
    API: run naive birthday attack on toy hash or truncated DLP hash.
    use_dlp=True is slower (each call = modular exponentiation in 1024-bit group).
    Returns JSON-serialisable dict.
    """
    if use_dlp:
        return attack_truncated_dlp(n_bits)

    h_fn = make_toy_hash(n_bits)
    x1, x2, digest, attempts = birthday_attack(h_fn, n_bits)
    expected = 2 ** (n_bits / 2)
    return {
        'x1': x1.hex(),
        'x2': x2.hex(),
        'digest': digest,
        'attempts': attempts,
        'expected': round(expected, 1),
        'ratio': round(attempts / expected, 2),
    }


def find_collision_floyd(n_bits: int = 12) -> dict:
    """
    API: run Floyd's cycle-detection attack on toy hash.
    Returns JSON-serialisable dict.
    """
    h_fn = make_toy_hash(n_bits)
    x1, x2, digest, evals = floyd_attack(h_fn, n_bits)
    return {
        'x1': x1.hex(),
        'x2': x2.hex(),
        'digest': digest,
        'evals': evals,
        'expected': round(2 ** (n_bits / 2), 1),
    }


def get_birthday_curve_data(n_bits_list: list = None, num_trials: int = 100) -> dict:
    """
    API: return empirical birthday curve data for frontend chart rendering.
    Strips raw trial lists for efficiency (large payload otherwise).
    """
    if n_bits_list is None:
        n_bits_list = [8, 10, 12, 14, 16]

    curve = empirical_birthday_curve(n_bits_list, num_trials)
    return {
        n: {k: v for k, v in d.items() if k != 'raw'}
        for n, d in curve.items()
    }


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 8: Demo Runner
# ─────────────────────────────────────────────────────────────────────────────

def run_demo():
    print("=" * 62)
    print("PA#9 — Birthday Attack Demo")
    print("=" * 62)

    # ── Demo 1: Naive birthday attack on toy hash ──────────────────────────
    print("\n[1] Naive Birthday Attack — Toy Hash (n=12 bits)")
    print("    Expected collision near 2^6 = 64 evaluations")
    h12 = make_toy_hash(12)
    x1, x2, digest, attempts = birthday_attack(h12, 12)
    expected_12 = 2 ** 6
    print(f"    x1      : {x1.hex()}")
    print(f"    x2      : {x2.hex()}")
    print(f"    digest  : {digest}")
    print(f"    attempts: {attempts}  (expected ~{expected_12})")
    print(f"    ratio   : {attempts / expected_12:.2f}")
    assert h12(x1) == h12(x2) and x1 != x2, "FAIL: collision invalid"
    print("    ✓ Verified: hash_fn(x1) == hash_fn(x2), x1 != x2")

    # ── Demo 2: Floyd's cycle detection ───────────────────────────────────
    print("\n[2] Floyd's Cycle Detection — Toy Hash (n=12 bits)")
    print("    Same expected bound, O(1) space")
    x1f, x2f, df, evals = floyd_attack(h12, 12)
    print(f"    x1     : {x1f.hex()}")
    print(f"    x2     : {x2f.hex()}")
    print(f"    digest : {df}")
    print(f"    evals  : {evals}")
    assert h12(x1f) == h12(x2f) and x1f != x2f, "FAIL: Floyd collision invalid"
    print("    ✓ Verified: hash_fn(x1) == hash_fn(x2), x1 != x2")

    # ── Demo 3: Empirical birthday curve ──────────────────────────────────
    print("\n[3] Empirical Birthday Curve — Toy Hash (100 trials per n)")
    print("    Ratio should converge to ~1.25 (birthday constant sqrt(pi/2))")
    curve = empirical_birthday_curve([8, 10, 12, 14, 16], num_trials=100)
    print(f"\n    {'n':>4} | {'Expected':>10} | {'Mean':>10} | {'StdDev':>8} | {'Ratio':>6}")
    print(f"    {'-'*4}-+-{'-'*10}-+-{'-'*10}-+-{'-'*8}-+-{'-'*6}")
    for n, d in curve.items():
        print(
            f"    {n:>4} | {d['theoretical']:>10.1f} | {d['mean']:>10.1f} | "
            f"{d['std']:>8.1f} | {d['ratio']:>6.2f}"
        )

    # ── Demo 4: Attack truncated DLP hash (PA#8 integration) ──────────────
    print("\n[4] Birthday Attack — Truncated DLP Hash (n=16 bits)")
    print("    Each call = Merkle-Damgård + 1024-bit modular exponentiation")
    print("    Expected ~256 evaluations. May take a few seconds...")
    res = attack_truncated_dlp(16)
    print(f"    x1      : {res['x1']}")
    print(f"    x2      : {res['x2']}")
    print(f"    digest  : {res['digest']}")
    print(f"    attempts: {res['attempts']}  (expected ~{res['expected']})")
    print(f"    ratio   : {res['ratio']}")
    print(f"    time    : {res['time_sec']}s")
    print("    ✓ Even provably-secure DLP hash breaks at the birthday bound")

    # ── Demo 5: MD5 / SHA-1 context ───────────────────────────────────────
    print("\n[5] Birthday Bound — Real Hash Functions (at 10^9 hashes/sec)")
    ctx = birthday_bound_context(hash_rate_per_sec=1e9)
    for name, d in ctx.items():
        bound_str = f"2^{d['birthday_exp']}"
        if d['years'] < 1:
            time_str = f"{d['seconds']:.2e} seconds"
        elif d['years'] < 1e15:
            time_str = f"{d['years']:.2e} years"
        else:
            time_str = f"~{bound_str} operations (astronomical)"
        print(f"    {name:<8} n={d['n_bits']:>3}, bound={bound_str:<5} → {time_str}")
        print(f"             {d['status']}")

    print("\n" + "=" * 62)
    print("All demos complete.")


if __name__ == '__main__':
    run_demo()