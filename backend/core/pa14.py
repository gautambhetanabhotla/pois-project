from __future__ import annotations

import os
import sys
import unittest
import time
from typing import List, Dict

import pa1
import pa13

# 1. EXTENDED EUCLIDEAN ALGORITHM & CRT SOLVER

def mod_inverse(a: int, m: int) -> int:
    m0 = m
    y = 0
    x = 1
    if m == 1:
        return 0
    while a > 1:
        q = a // m
        t = m
        m = a % m
        a = t
        t = y
        y = x - q * y
        x = t
    if x < 0:
        x = x + m0
    return x

def crt(residues: list[int], moduli: list[int]) -> int:
    """
    CRT solver: takes a list of (ai, ni) pairs (with pairwise coprime ni)
    and returns the unique x mod ∏ ni satisfying all congruences.
    Uses the constructive formula with modular inverses.
    """
    if len(residues) != len(moduli):
        raise ValueError("residues and moduli must be the same length")
    
    total_product = 1
    for n in moduli:
        total_product *= n
        
    result = 0
    for a_i, n_i in zip(residues, moduli):
        m_i = total_product // n_i
        y_i = mod_inverse(m_i, n_i)
        result = (result + a_i * m_i * y_i) % total_product
        
    return result

# 2. CRT-BASED RSA DECRYPTION

def rsa_dec(sk: dict, c: int) -> int:
    """Standard RSA decryption."""
    return pow(c, sk['d'], sk['N'])

def rsa_dec_crt(sk: dict, c: int) -> int:
    """
    CRT-based RSA decryption (Garner's algorithm).
    sk must include p, q, dp, dq, q_inv.
    """
    p = sk['p']
    q = sk['q']
    dp = sk['dp']
    dq = sk['dq']
    q_inv = sk['q_inv']
    
    m1 = pow(c, dp, p)
    m2 = pow(c, dq, q)
    
    h = (q_inv * (m1 - m2)) % p
    m = m2 + h * q
    return m

# 3. HASTAD'S BROADCAST ATTACK AND INTEGER ROOTS

def integer_nth_root(x: int, n: int) -> int:
    """Computes the integer n-th root of x using Newton's method."""
    if x < 0:
        raise ValueError("Cannot compute root of negative number")
    if x == 0:
        return 0
    
    high = 1
    while high ** n <= x:
        high *= 2
    low = high // 2
    
    while low < high:
        mid = (low + high) // 2
        if mid ** n < x:
            low = mid + 1
        else:
            high = mid
            
    if low ** n > x:
        return low - 1
    return low

def hastad_attack(ciphertexts: list[int], moduli: list[int], e: int) -> int:
    """
    Hastad's broadcast attack: recovers m from e pairs of (c_i, N_i).
    """
    if len(ciphertexts) != e or len(moduli) != e:
        raise ValueError("Need exactly e ciphertexts and moduli")
        
    x = crt(ciphertexts, moduli)
    return integer_nth_root(x, e)


# 4. DEMOS AND UNIT TESTS

def _generate_rsa_keypair(bits: int, e_val: int = 65537) -> dict:
    """Toy RSA key generation for testing."""
    import math
    while True:
        p = pa13.gen_prime(bits // 2)
        q = pa13.gen_prime(bits // 2)
        if p == q: continue
        phi = (p - 1) * (q - 1)
        if math.gcd(e_val, phi) == 1:
            break
            
    N = p * q
    d = mod_inverse(e_val, phi)
    dp = mod_inverse(e_val, p - 1)
    dq = mod_inverse(e_val, q - 1)
    q_inv = mod_inverse(q, p)
    
    return {
        'N': N, 'e': e_val, 'd': d, 'p': p, 'q': q, 
        'dp': dp, 'dq': dq, 'q_inv': q_inv, 'bits': bits
    }

def _demo() -> None:
    print("=== PA #14 CRT, RSA Decryption, and Hastad Attack ===\n")
    
    print("--- (1) CRT-based RSA Decryption Correctness ---")
    sk = _generate_rsa_keypair(1024)
    c_list = [pow(m, sk['e'], sk['N']) for m in range(2, 102)]
    print("Testing 100 decryptions...")
    match = all(rsa_dec(sk, c) == rsa_dec_crt(sk, c) for c in c_list)
    print(f"rsa_dec == rsa_dec_crt for 100 random messages? {match}")
    
    print("\n--- (2) Performance Comparison (1024-bit vs 2048-bit) ---")
    for b in [1024, 2048]:
        sk_perf = _generate_rsa_keypair(b)
        trials = 1000
        msgs = [os.urandom(b // 16) for _ in range(trials)]
        c_perf = [pow(int.from_bytes(m, 'big'), sk_perf['e'], sk_perf['N']) for m in msgs]
        
        t0 = time.perf_counter()
        for c in c_perf: rsa_dec(sk_perf, c)
        t_std = time.perf_counter() - t0
        
        t0 = time.perf_counter()
        for c in c_perf: rsa_dec_crt(sk_perf, c)
        t_crt = time.perf_counter() - t0
        
        print(f"{b}-bit RSA ({trials} decryptions):")
        print(f"  Standard : {t_std:.4f} s")
        print(f"  CRT      : {t_crt:.4f} s")
        print(f"  Speedup  : {t_std / t_crt:.2f}x")
        
    print("\n--- (3) Hastad's Broadcast Attack (e=3) ---")
    # Generate 3 keys with e=3
    keys = []
    e_val = 3
    while len(keys) < 3:
        k = _generate_rsa_keypair(1024, e_val)
        keys.append(k)
            
    m = b"secret!"
    m_int = int.from_bytes(m, "big")
    ciphertexts = [pow(m_int, e_val, k['N']) for k in keys]
    moduli = [k['N'] for k in keys]
    
    recovered_m_int = hastad_attack(ciphertexts, moduli, e_val)
    print(f"Recovered message: {recovered_m_int.to_bytes((recovered_m_int.bit_length() + 7) // 8, 'big')}")
    print(f"Matches original? {recovered_m_int == m_int}")
    
    print("\n--- (4) Attack Boundary ---")
    print("If m^3 >= N1*N2*N3, the CRT formula returns x = m^3 mod (N1*N2*N3),")
    print("which is strictly less than m^3. Taking the integer cubic root of x")
    print("will not yield m. For three 1024-bit moduli, the maximum message length")
    print("is ~384 bytes so that it is less than each N.")
    
    print("\n--- (5) Padding Defeats the Attack ---")
    print("If PKCS#1 v1.5 padding is applied before encryption, each recipient gets")
    print("a DIFFERENT padded plaintext m_i due to the random padding string PS.")
    print("Thus we are no longer encrypting the EXACT SAME m^e, and CRT doesn't")
    print("recover a single m^3 modulo N1*N2*N3.")

class TestPA14(unittest.TestCase):
    def test_mod_inverse(self):
        self.assertEqual(mod_inverse(3, 11), 4)
        self.assertEqual(mod_inverse(10, 17), 12)
        
    def test_crt(self):
        self.assertEqual(crt([2, 3, 2], [3, 5, 7]), 23)
        self.assertEqual(crt([3, 4, 5], [5, 7, 11]), 368)
        
    def test_integer_root(self):
        self.assertEqual(integer_nth_root(27, 3), 3)
        self.assertEqual(integer_nth_root(26, 3), 2)  # Floor value
        self.assertEqual(integer_nth_root(16, 2), 4)
        
    def test_hastad_attack(self):
        m = 42
        n1, n2, n3 = 101*103, 107*109, 113*127
        c1, c2, c3 = pow(m, 3, n1), pow(m, 3, n2), pow(m, 3, n3)
        self.assertEqual(hastad_attack([c1, c2, c3], [n1, n2, n3], 3), m)

if __name__ == "__main__":
    _demo()
    print("\n--- Running unit tests ---")
    sys.argv = [sys.argv[0]]
    unittest.main(verbosity=2)