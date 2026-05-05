"""
PA#12: RSA Public-Key Cryptosystem

Implements the RSA (Rivest-Shamir-Adleman) cryptosystem:
- Key generation: generates public (n, e) and private (n, d) keys
- Encryption: c = m^e mod n
- Decryption: m = c^d mod n

Security relies on the computational difficulty of factoring n = p*q.

No external crypto libraries used.
"""

import os
import random
import unittest
import pa1
import pa13


# =============================================================================
# Utility Functions
# =============================================================================

def extended_gcd(a: int, b: int) -> tuple:
    if b == 0:
        return (a, 1, 0)
    
    gcd, x1, y1 = extended_gcd(b, a % b)
    x = y1
    y = x1 - (a // b) * y1
    
    return (gcd, x, y)


def mod_inverse(a: int, m: int) -> int:
    gcd, x, _ = extended_gcd(a, m)
    
    if gcd != 1:
        raise ValueError(f"Modular inverse does not exist (gcd({a}, {m}) = {gcd})")
    
    return x % m

def mod_exp(base: int, exp: int, mod: int) -> int:
    """Fast modular exponentiation using square-and-multiply."""
    res = 1
    base = base % mod
    while exp > 0:
        if exp % 2 == 1:
            res = (res * base) % mod
        exp = exp >> 1
        base = (base * base) % mod
    return res

def keygen(bits: int) -> tuple:
    """
    Generate RSA public and private key pairs.
    Returns: (pk, sk)
    pk = (n, e)
    sk = (n, d, p, q, dp, dq, q_inv)
    """
    p = pa13.gen_prime(bits)
    q = pa13.gen_prime(bits)
    
    while p == q:
        q = pa13.gen_prime(bits)
    
    # Compute n and φ(n)
    n = p * q
    phi = (p - 1) * (q - 1)
    
    # Standard public exponent
    e = 65537
    
    # Ensure gcd(e, φ(n)) = 1
    while True:
        gcd, _, _ = extended_gcd(e, phi)
        if gcd == 1:
            break
        # Rarely happens with e=65537, but try different primes if it does
        p = pa13.gen_prime(bits)
        q = pa13.gen_prime(bits)
        while p == q:
            q = pa13.gen_prime(bits)
        n = p * q
        phi = (p - 1) * (q - 1)
    
    # Compute private exponent
    d = mod_inverse(e, phi)
    
    dp = d % (p - 1)
    dq = d % (q - 1)
    q_inv = mod_inverse(q, p)
    
    # Public key: (n, e)
    # Private key: (n, d, p, q, dp, dq, q_inv)
    return ((n, e), (n, d, p, q, dp, dq, q_inv))


# =============================================================================
# RSA Encryption and Decryption
# =============================================================================

def rsa_enc(pk: tuple, m: int) -> int:
    """
    Encrypt a message using RSA public key.
    
    Process:
      c = m^e mod n
    
    Args:
        pk: Public key (n, e)
        m: Plaintext message (as integer, m < n)
        
    Returns:
        Ciphertext c
    """
    n, e = pk
    
    if m >= n or m < 0:
        raise ValueError(f"Message must be in range [0, {n})")
    
    return pow(m, e, n)


def rsa_dec(sk: tuple, c: int) -> int:
    n, d = sk[0], sk[1]
    if c >= n or c < 0:
        raise ValueError(f"Ciphertext must be in range [0, {n})")
    return mod_exp(c, d, n)


# =============================================================================
# Unit Tests
# =============================================================================

class TestRSA(unittest.TestCase):
    """Test suite for RSA cryptosystem."""
    
    @classmethod
    def setUpClass(cls):
        """Generate keys once for all tests."""
        # Use small key size for testing speed
        cls.pk, cls.sk = keygen(bits=256)
    
    def test_encryption_decryption(self):
        """Test that encrypt(pk, m) then decrypt(sk, c) recovers m."""
        message = 12345
        ciphertext = encrypt(self.pk, message)
        decrypted = decrypt(self.sk, ciphertext)
        self.assertEqual(message, decrypted)
    
    def test_multiple_messages(self):
        """Test encryption/decryption of multiple messages."""
        messages = [1, 42, 100, 999, 123456789]
        for m in messages:
            if m < self.pk[0]:  # Only test valid messages
                c = encrypt(self.pk, m)
                m_recovered = decrypt(self.sk, c)
                self.assertEqual(m, m_recovered)
    
    def test_random_message(self):
        """Test encryption/decryption of random message."""
        # Generate random message smaller than modulus
        message = pa1.randbelow(self.pk[0] - 1) + 1
        ciphertext = encrypt(self.pk, message)
        decrypted = decrypt(self.sk, ciphertext)
        self.assertEqual(message, decrypted)
    
    def test_different_messages_different_ciphertexts(self):
        """Different plaintexts should (almost always) give different ciphertexts."""
        m1 = 100
        m2 = 200
        c1 = encrypt(self.pk, m1)
        c2 = encrypt(self.pk, m2)
        self.assertNotEqual(c1, c2)
    
    def test_modular_inverse(self):
        """Test that modular inverse works correctly."""
        # gcd(17, 100) = 1, so inverse should exist
        inv = mod_inverse(17, 100)
        self.assertEqual((17 * inv) % 100, 1)
    
    def test_modular_inverse_small(self):
        """Test modular inverse with small numbers."""
        inv = mod_inverse(3, 11)
        self.assertEqual((3 * inv) % 11, 1)
    

# =============================================================================
# Demo
# =============================================================================

def pkcs15_enc(pk: tuple, m_bytes: bytes) -> tuple[int, bytes]:
    """
    Pads the message according to PKCS#1 v1.5 and encrypts it.
    Returns (ciphertext, padding_bytes).
    """
    n, e = pk
    k = (n.bit_length() + 7) // 8
    
    if len(m_bytes) > k - 11:
        raise ValueError("Message too long")
        
    ps_len = k - len(m_bytes) - 3
    ps = bytearray()
    while len(ps) < ps_len:
        b = os.urandom(1)
        if b[0] != 0:
            ps.append(b[0])
            
    padded = b'\x00\x02' + bytes(ps) + b'\x00' + m_bytes
    m_int = int.from_bytes(padded, "big")
    c = rsa_enc(pk, m_int)
    return c, bytes(ps)

def pkcs15_dec(sk: tuple, c: int) -> bytes:
    """
    Decrypts the ciphertext and verifies PKCS#1 v1.5 padding.
    Returns the message, or b"?" if padding is invalid.
    """
    n = sk[0]
    k = (n.bit_length() + 7) // 8
    
    m_int = rsa_dec(sk, c)
    padded = m_int.to_bytes(k, "big")
    
    if padded[0] != 0 or padded[1] != 2:
        return b"?"
        
    sep_idx = padded.find(b'\x00', 2)
    if sep_idx < 10:  # PS must be at least 8 bytes
        return b"?"
        
    return padded[sep_idx + 1:]

# --- Bleichenbacher Toy Implementation ---
def bleichenbacher_attack(pk: tuple, c: int, oracle_fn) -> bytes:
    """
    A simplified Bleichenbacher padding oracle attack for small N.
    oracle_fn(c_val) -> bool (True if padding is valid PKCS#1 v1.5).
    This implements the core adaptive chosen ciphertext multiplication logic.
    """
    n, e = pk
    k = (n.bit_length() + 7) // 8
    B = 2 ** (8 * (k - 2))
    
    # Step 1: Blinding (assuming c is already PKCS#1 conforming)
    c_0 = c
    M = [(2 * B, 3 * B - 1)]
    
    # Step 2a: Starting the search
    s = (n + 3 * B - 1) // (3 * B)
    while True:
        c_test = (c_0 * mod_exp(s, e, n)) % n
        if oracle_fn(c_test):
            break
        s += 1
        
    # We found an s. Now iteratively narrow down M intervals.
    # Since this is a toy demo, we assume single interval convergence.
    while True:
        if len(M) == 1 and M[0][0] == M[0][1]:
            m_int = M[0][0]
            # Strip padding
            padded = m_int.to_bytes(k, "big")
            sep_idx = padded.find(b'\x00', 2)
            if sep_idx != -1:
                return padded[sep_idx + 1:]
            return b"?"
            
        a, b = M[0]
        r = (2 * (b * s - 2 * B) + n - 1) // n
        found_new_s = False
        
        while not found_new_s:
            min_s = (2 * B + r * n + b - 1) // b
            max_s = (3 * B - 1 + r * n) // a
            for s_test in range(min_s, max_s + 1):
                c_test = (c_0 * mod_exp(s_test, e, n)) % n
                if oracle_fn(c_test):
                    s = s_test
                    found_new_s = True
                    break
            r += 1
            
        # Step 3: Narrowing set of solutions
        new_M = []
        for a_i, b_i in M:
            min_r = (a_i * s - 3 * B + 1 + n - 1) // n
            max_r = (b_i * s - 2 * B) // n
            for r_val in range(min_r, max_r + 1):
                new_a = max(a_i, (2 * B + r_val * n + s - 1) // s)
                new_b = min(b_i, (3 * B - 1 + r_val * n) // s)
                if new_a <= new_b:
                    new_M.append((new_a, new_b))
        M = new_M
        
        if not M:
            return b"?"

# --- Backward compatibility with any old imports ---
encrypt = rsa_enc
decrypt = rsa_dec
