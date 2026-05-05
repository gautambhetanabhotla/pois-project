"""
PA#12: RSA Public-Key Cryptosystem

Implements the RSA (Rivest-Shamir-Adleman) cryptosystem:
- Key generation: generates public (n, e) and private (n, d) keys
- Encryption: c = m^e mod n
- Decryption: m = c^d mod n

Security relies on the computational difficulty of factoring n = p*q.

No external crypto libraries used.
"""

import random
import unittest
import pa1
import pa13


# =============================================================================
# Utility Functions
# =============================================================================

def extended_gcd(a: int, b: int) -> tuple:
    """
    Extended Euclidean Algorithm.
    
    Finds integers x, y such that a*x + b*y = gcd(a, b).
    
    Args:
        a: First integer
        b: Second integer
        
    Returns:
        (gcd, x, y) where a*x + b*y = gcd
    """
    if b == 0:
        return (a, 1, 0)
    
    gcd, x1, y1 = extended_gcd(b, a % b)
    x = y1
    y = x1 - (a // b) * y1
    
    return (gcd, x, y)


def mod_inverse(a: int, m: int) -> int:
    """
    Compute the modular multiplicative inverse of a modulo m.
    
    Finds x such that a*x ≡ 1 (mod m).
    Uses extended Euclidean algorithm.
    
    Args:
        a: The number to invert
        m: The modulus
        
    Returns:
        x such that a*x ≡ 1 (mod m)
        
    Raises:
        ValueError: If gcd(a, m) != 1 (inverse doesn't exist)
    """
    gcd, x, _ = extended_gcd(a, m)
    
    if gcd != 1:
        raise ValueError(f"Modular inverse does not exist (gcd({a}, {m}) = {gcd})")
    
    return x % m


# =============================================================================
# RSA Key Generation
# =============================================================================

def keygen(bits: int) -> tuple:
    """
    Generate RSA public and private key pairs.
    
    Process:
      1. Generate two large random primes p and q
      2. Compute n = p * q (the RSA modulus)
      3. Compute φ(n) = (p-1) * (q-1)
      4. Choose public exponent e = 65537 (standard)
      5. Compute private exponent d = e^(-1) mod φ(n)
      6. Return public key (n, e) and private key (n, d)
    
    Args:
        bits: Bit length of each prime (total key size ~ 2*bits)
        
    Returns:
        ((n, e), (n, d)) where:
        - (n, e) is the public key
        - (n, d) is the private key
    """
    p = pa13.gen_prime(bits)
    q = pa13.gen_prime(bits)
    
    # Ensure p != q
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
    
    # Public key: (n, e)
    # Private key: (n, d)
    return ((n, e), (n, d))


# =============================================================================
# RSA Encryption and Decryption
# =============================================================================

def encrypt(pk: tuple, m: int) -> int:
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


def decrypt(sk: tuple, c: int) -> int:
    """
    Decrypt a ciphertext using RSA private key.
    
    Process:
      m = c^d mod n
    
    Args:
        sk: Private key (n, d)
        c: Ciphertext (as integer)
        
    Returns:
        Plaintext message m
    """
    n, d = sk
    
    if c >= n or c < 0:
        raise ValueError(f"Ciphertext must be in range [0, {n})")
    
    return pow(c, d, n)


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

def demo():
    """
    Demonstrate RSA encryption and decryption.
    """
    print("=" * 70)
    print("RSA PUBLIC-KEY CRYPTOSYSTEM DEMO")
    print("=" * 70)
    
    print("\n>>> Generating RSA keys (512-bit)...")
    pk, sk = keygen(bits=256)
    n, e = pk
    
    print(f"Public key (n, e):")
    print(f"  n (modulus): {n}")
    print(f"  e (exponent): {e}")
    print(f"  Bit length: {n.bit_length()}\n")
    
    print(f"Private key (n, d):")
    print(f"  n (modulus): {n}")
    _, d = sk
    print(f"  d (exponent): {d}\n")
    
    # Test with a message
    message = 123456789
    print(f"Original message: {message}")
    
    # Encrypt
    ciphertext = encrypt(pk, message)
    print(f"Encrypted: {ciphertext}")
    
    # Decrypt
    decrypted = decrypt(sk, ciphertext)
    print(f"Decrypted: {decrypted}")
    
    # Verify
    if message == decrypted:
        print("\n✓ Encryption/Decryption successful!")
    else:
        print("\n✗ Encryption/Decryption FAILED!")
    
    print("=" * 70)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "demo":
        demo()
    else:
        unittest.main()
