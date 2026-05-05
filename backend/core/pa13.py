from __future__ import annotations

import os
import sys
import unittest
import math
import time
from pa1 import randbelow, randbits

# -----------------------------------------------------------------------------
# PHASE 1: Miller-Rabin Primality Testing
# -----------------------------------------------------------------------------

def miller_rabin(n: int, k: int = 40) -> bool:
    """Probabilistic primality test using the Miller-Rabin algorithm."""
    if n == 2 or n == 3:
        return True
    if n < 2 or n % 2 == 0:
        return False
        
    d = n - 1
    s = 0
    while d % 2 == 0:
        d //= 2
        s += 1
        
    for _ in range(k):
        a = randbelow(n - 3) + 2  # Range [2, n-2]
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

def is_prime(n: int) -> bool:
    """Sanity check function using 100 rounds."""
    return miller_rabin(n, 100)

def gen_prime(bits: int) -> int:
    """Generate a probable prime of specified bit-length."""
    while True:
        # Generate an odd number of exactly 'bits' length
        n = randbits(bits)
        n |= (1 << (bits - 1)) | 1
        
        if miller_rabin(n, 40):
            # Sanity check with 100 rounds
            if is_prime(n):
                return n

# -----------------------------------------------------------------------------
# PHASE 2: Demos and Unit Tests
# -----------------------------------------------------------------------------

def _demo():
    print("=== PA #13 Prime Generation & Miller-Rabin ===\n")
    
    print("--- (1) Testing known small values ---")
    primes = [2, 3, 5, 7, 11, 13, 97, 101]
    composites = [4, 9, 15, 21, 100, 1000]
    print(f"Known primes tested True? {all(miller_rabin(p) for p in primes)}")
    print(f"Known composites tested False? {all(not miller_rabin(c) for c in composites)}")
    
    print("\n--- (2) Generating Prime (1024-bit) ---")
    t0 = time.perf_counter()
    p = gen_prime(1024)
    dt = time.perf_counter() - t0
    print(f"Generated a 1024-bit prime in {dt*1000:.1f} ms.")
    print(f"p = {p}")
    print(f"p bit length: {p.bit_length()}")
    print(f"Is p probable prime (100 rounds)? {is_prime(p)}")


class TestPA13(unittest.TestCase):
    def test_small_primes(self):
        for p in [2, 3, 5, 7, 11, 13, 17, 19, 23, 101, 199]:
            self.assertTrue(miller_rabin(p, 10))

    def test_small_composites(self):
        for c in [4, 6, 8, 9, 15, 21, 25, 27, 33, 100]:
            self.assertFalse(miller_rabin(c, 10))

    def test_gen_prime_size(self):
        p = gen_prime(256)
        self.assertEqual(p.bit_length(), 256)
        self.assertTrue(p % 2 != 0)

    def test_gen_prime_is_prime(self):
        p = gen_prime(128)
        self.assertTrue(miller_rabin(p, 40))

    def test_carmichael_number(self):
        carmichael = [561]
        for c in carmichael:
            self.assertFalse(miller_rabin(c, 40))

if __name__ == '__main__':
    _demo()
    print("\n--- Running unit tests ---")
    sys.argv = [sys.argv[0]]
    unittest.main(verbosity=2)