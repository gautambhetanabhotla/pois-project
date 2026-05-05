from __future__ import annotations

import os
import sys
import math
import unittest
from typing import Tuple, Dict

import pa8
import pa1

# -----------------------------------------------------------------------------
# PHASE 1: Basic RSA Key Generation (PA#12 dependency)
# -----------------------------------------------------------------------------

def mod_inverse(a: int, m: int) -> int:
    m0, y, x = m, 0, 1
    if m == 1: return 0
    while a > 1:
        q = a // m
        a, m = m, a % m
        x, y = y, x - q * y
    if x < 0: x += m0
    return x

def get_prime(bits: int) -> int:
    while True:
        p = pa1.randbits(bits)
        p |= (1 << (bits - 1)) | 1
        if pa1.miller_rabin(p):
            return p

def rsa_keygen(bits: int = 2048, e: int = 65537) -> Tuple[Dict, Dict]:
    while True:
        p = get_prime(bits // 2)
        q = get_prime(bits // 2)
        if p == q: continue
        phi = (p - 1) * (q - 1)
        if math.gcd(e, phi) == 1:
            break
    N = p * q
    d = mod_inverse(e, phi)
    sk = {'N': N, 'd': d, 'p': p, 'q': q}
    vk = {'N': N, 'e': e}
    return sk, vk

# -----------------------------------------------------------------------------
# PHASE 2: Hash-then-Sign RSA
# -----------------------------------------------------------------------------

def Sign(sk: Dict, m: bytes) -> int:
    """Implement sign(sk, m) = H(m)^d mod N."""
    digest = pa8.dlp_hash(m)
    h_m = int.from_bytes(digest, 'big')
    # Textbook RSA signatures modulo N requires the hashed numerical representation
    # to be strictly bounded within [0, N-1].
    h_m = h_m % sk['N']
    return pow(h_m, sk['d'], sk['N'])

def Verify(vk: Dict, m: bytes, sigma: int) -> bool:
    """Implement verify(vk, m, sigma) -> (sigma^e mod N) == H(m)."""
    digest = pa8.dlp_hash(m)
    h_m = int.from_bytes(digest, 'big')
    h_m = h_m % vk['N']
    return pow(sigma, vk['e'], vk['N']) == h_m

# -----------------------------------------------------------------------------
# PHASE 3: Vulnerable Raw RSA Signatures
# -----------------------------------------------------------------------------

def sign_raw(sk: Dict, m_int: int) -> int:
    """Vulnerable signing of raw m without hashing."""
    return pow(m_int, sk['d'], sk['N'])

def verify_raw(vk: Dict, m_int: int, sigma: int) -> bool:
    """Vulnerable verification of raw m without hashing."""
    return pow(sigma, vk['e'], vk['N']) == (m_int % vk['N'])

# -----------------------------------------------------------------------------
# PHASE 4: EUF-CMA Game Simulation
# -----------------------------------------------------------------------------

def euf_cma_game(sk: Dict, vk: Dict, queries: int = 50) -> bool:
    """
    Shows that seeing arbitrary signed messages doesn't allow forgery 
    for a *new* message m under proper hash-then-sign methodology securely.
    """
    seen_messages = set()
    
    # Adversary queries the oracle
    for _ in range(queries):
        m = os.urandom(16)
        seen_messages.add(m)
        _ = Sign(sk, m) # Throwaway signature
        
    # Adversary tries to forge a signature for a NEW message
    m_forge = b"I am a forged message"
    while m_forge in seen_messages:
        m_forge = os.urandom(16)
        
    # Attacker tries to formulate a random or structurally mangled sigma
    forged_sigma = int.from_bytes(os.urandom(256), 'big') % vk['N']
    
    return Verify(vk, m_forge, forged_sigma)


# -----------------------------------------------------------------------------
# PHASE 5: Demos and Unit Tests
# -----------------------------------------------------------------------------

def _demo():
    print("=== PA #15 RSA Signatures & Hash-then-Sign ===\n")
    print("Generating 1024-bit RSA keys...")
    sk, vk = rsa_keygen(1024)
    
    print("\n--- (1) Secure Hash-then-Sign RSA ---")
    m = b"This is a secure document."
    sigma = Sign(sk, m)
    print(f"Message: {m}")
    print(f"Valid signature? {Verify(vk, m, sigma)}")
    print(f"Altered message valid? {Verify(vk, b'This is a secure document!', sigma)}")
    
    print("\n--- (2) Multiplicative Homomorphism Attack (Raw RSA) ---")
    m1 = 12345
    m2 = 67890
    sig1 = sign_raw(sk, m1)
    sig2 = sign_raw(sk, m2)
    
    m_forged = (m1 * m2) % vk['N']
    sig_forged = (sig1 * sig2) % vk['N']
    
    print(f"m1 = {m1}, sig1 = {sig1}")
    print(f"m2 = {m2}, sig2 = {sig2}")
    print(f"Forged message m3 = m1*m2: {m_forged}")
    print(f"Forged signature sig3 = sig1*sig2: {sig_forged}")
    print(f"Does the raw verify succeed on forged m3? {verify_raw(vk, m_forged, sig_forged)}")
    
    print("\n--- (3) EUF-CMA Game Simulation ---")
    success = euf_cma_game(sk, vk, 50)
    print("Did the adversary successfully forge a signature for a *new* message? ", success)
    print("Probability of forgery is overwhelmingly negligible.")

class TestPA15(unittest.TestCase):
    def setUp(self):
        self.sk, self.vk = rsa_keygen(1024)
        
    def test_sign_verify_valid(self):
        m = b"Test message"
        sigma = Sign(self.sk, m)
        self.assertTrue(Verify(self.vk, m, sigma))
        
    def test_sign_verify_invalid(self):
        m1 = b"Test message 1"
        m2 = b"Test message 2"
        sigma = Sign(self.sk, m1)
        self.assertFalse(Verify(self.vk, m2, sigma))
        
    def test_malleability_raw_rsa(self):
        m1, m2 = 2, 3
        s1, s2 = sign_raw(self.sk, m1), sign_raw(self.sk, m2)
        m3 = (m1 * m2) % self.vk['N']
        s3 = (s1 * s2) % self.vk['N']
        self.assertTrue(verify_raw(self.vk, m3, s3))

if __name__ == '__main__':
    _demo()
    print("\n--- Running unit tests ---")
    sys.argv = [sys.argv[0]]
    unittest.main()