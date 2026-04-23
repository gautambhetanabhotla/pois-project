"""
PA#10: CCA-Secure Symmetric Encryption

Implements:
1. HMAC using the PRF from PA#2
2. CTR mode encryption (length-preserving, randomized)
3. CCA-secure scheme using Encrypt-then-MAC pattern

Key components:
- HMAC(k, m) = F(k ⊕ opad, F(k ⊕ ipad, m))
- CTR mode: keystream = F(k, nonce || counter) XOR plaintext
- CCA: Encrypt-then-MAC with MAC verification before decryption

No external crypto libraries used - only PA#2's PRF.
"""

import os
import unittest
from pa2 import F, BLOCK_SIZE


# =============================================================================
# HMAC: Hash-based Message Authentication Code using PRF
# =============================================================================

def hmac(k: bytes, m: bytes) -> bytes:
    """
    HMAC using the PRF F from PA#2.
    
    Standard HMAC construction:
      HMAC(k, m) = F(k ⊕ opad, F(k ⊕ ipad, m))
    
    Args:
        k: Key (any length, will be padded/truncated to BLOCK_SIZE)
        m: Message
        
    Returns:
        HMAC output (length BLOCK_SIZE = 16 bytes)
    """
    # Normalize key to BLOCK_SIZE
    if len(k) < BLOCK_SIZE:
        k = k + bytes(BLOCK_SIZE - len(k))
    elif len(k) > BLOCK_SIZE:
        k = k[:BLOCK_SIZE]
    
    # ipad and opad
    ipad = bytes(0x36 for _ in range(BLOCK_SIZE))
    opad = bytes(0x5c for _ in range(BLOCK_SIZE))
    
    # XOR with key
    k_ipad = bytes(a ^ b for a, b in zip(k, ipad))
    k_opad = bytes(a ^ b for a, b in zip(k, opad))
    
    # HMAC(k, m) = F(k ⊕ opad, F(k ⊕ ipad, m))
    inner = F(k_ipad, m)
    outer = F(k_opad, inner)
    
    # Ensure fixed output size (pad if needed, truncate if longer)
    if len(outer) < BLOCK_SIZE:
        return outer + bytes(BLOCK_SIZE - len(outer))
    else:
        return outer[:BLOCK_SIZE]


# =============================================================================
# CTR Mode Encryption: Length-preserving, randomized encryption
# =============================================================================

def ctr_encrypt(k: bytes, m: bytes, nonce: bytes = None) -> tuple:
    """
    CTR (Counter) mode encryption using PRF from PA#2.
    
    For each block:
      keystream = F(k, nonce || counter)
      ciphertext = plaintext XOR keystream
    
    Args:
        k: Encryption key (must be BLOCK_SIZE = 16 bytes)
        m: Plaintext message
        nonce: Optional 16-byte nonce (randomly generated if not provided)
        
    Returns:
        (nonce, ciphertext) tuple
    """
    if len(k) != BLOCK_SIZE:
        raise ValueError(f"Key must be {BLOCK_SIZE} bytes, got {len(k)}")
    
    # Generate random nonce if not provided
    if nonce is None:
        nonce = os.urandom(BLOCK_SIZE)
    elif len(nonce) != BLOCK_SIZE:
        raise ValueError(f"Nonce must be {BLOCK_SIZE} bytes, got {len(nonce)}")
    
    ciphertext = bytearray()
    counter = 0
    
    # Process message in blocks
    for i in range(0, len(m), BLOCK_SIZE):
        # Generate keystream block
        counter_bytes = counter.to_bytes(BLOCK_SIZE, "big")
        keystream_input = bytes(a ^ b for a, b in zip(nonce, counter_bytes))
        keystream = F(k, keystream_input)
        
        # XOR with plaintext block
        block = m[i:i + BLOCK_SIZE]
        encrypted_block = bytes(a ^ b for a, b in zip(block, keystream[:len(block)]))
        ciphertext.extend(encrypted_block)
        
        counter += 1
    
    return (nonce, bytes(ciphertext))


def ctr_decrypt(k: bytes, nonce: bytes, c: bytes) -> bytes:
    """
    CTR mode decryption using PRF from PA#2.
    
    Decryption is identical to encryption in CTR mode.
    
    Args:
        k: Encryption key (must be BLOCK_SIZE = 16 bytes)
        nonce: 16-byte nonce (must match the one used in encryption)
        c: Ciphertext
        
    Returns:
        Plaintext
    """
    if len(k) != BLOCK_SIZE:
        raise ValueError(f"Key must be {BLOCK_SIZE} bytes, got {len(k)}")
    if len(nonce) != BLOCK_SIZE:
        raise ValueError(f"Nonce must be {BLOCK_SIZE} bytes, got {len(nonce)}")
    
    plaintext = bytearray()
    counter = 0
    
    # CTR decryption is identical to encryption
    for i in range(0, len(c), BLOCK_SIZE):
        counter_bytes = counter.to_bytes(BLOCK_SIZE, "big")
        keystream_input = bytes(a ^ b for a, b in zip(nonce, counter_bytes))
        keystream = F(k, keystream_input)
        
        block = c[i:i + BLOCK_SIZE]
        decrypted_block = bytes(a ^ b for a, b in zip(block, keystream[:len(block)]))
        plaintext.extend(decrypted_block)
        
        counter += 1
    
    return bytes(plaintext)


# =============================================================================
# Basic Encryption/Decryption (using CTR mode)
# =============================================================================

def enc(k_enc: bytes, m: bytes) -> tuple:
    """
    Encrypt a message using CTR mode.
    
    Args:
        k_enc: Encryption key (BLOCK_SIZE = 16 bytes)
        m: Plaintext message
        
    Returns:
        (nonce, ciphertext) tuple
    """
    return ctr_encrypt(k_enc, m)


def dec(k_enc: bytes, nonce: bytes, c: bytes) -> bytes:
    """
    Decrypt a ciphertext using CTR mode.
    
    Args:
        k_enc: Encryption key (BLOCK_SIZE = 16 bytes)
        nonce: 16-byte nonce used during encryption
        c: Ciphertext
        
    Returns:
        Plaintext
    """
    return ctr_decrypt(k_enc, nonce, c)


# =============================================================================
# CCA-Secure Scheme: Encrypt-then-MAC
# =============================================================================

def enc_cca(k_enc: bytes, k_mac: bytes, m: bytes) -> tuple:
    """
    CCA-secure encryption using Encrypt-then-MAC pattern.
    
    Process:
      1. Encrypt message using CTR mode: (nonce, c) = CTR_enc(k_enc, m)
      2. Compute MAC over ciphertext: tag = HMAC(k_mac, nonce || c)
      3. Return (nonce, c, tag)
    
    Args:
        k_enc: Encryption key (BLOCK_SIZE = 16 bytes)
        k_mac: MAC key (any length, will be normalized in HMAC)
        m: Plaintext message
        
    Returns:
        (nonce, ciphertext, tag) tuple
    """
    # Encrypt the message
    nonce, c = enc(k_enc, m)
    
    # MAC the nonce and ciphertext (Encrypt-then-MAC)
    mac_input = nonce + c
    tag = hmac(k_mac, mac_input)
    
    return (nonce, c, tag)


def dec_cca(k_enc: bytes, k_mac: bytes, nonce: bytes, c: bytes, tag: bytes) -> bytes:
    """
    CCA-secure decryption using Encrypt-then-MAC pattern.
    
    Process:
      1. Verify MAC: expected_tag = HMAC(k_mac, nonce || c)
      2. If MAC is invalid, return None (reject the ciphertext)
      3. If MAC is valid, decrypt: m = CTR_dec(k_enc, nonce, c)
    
    Args:
        k_enc: Encryption key (BLOCK_SIZE = 16 bytes)
        k_mac: MAC key (any length, will be normalized in HMAC)
        nonce: 16-byte nonce from encryption
        c: Ciphertext
        tag: MAC tag to verify
        
    Returns:
        Plaintext if MAC verification succeeds, None otherwise
    """
    # Verify MAC before decrypting (Encrypt-then-MAC)
    mac_input = nonce + c
    expected_tag = hmac(k_mac, mac_input)
    
    # Constant-time comparison to prevent timing attacks
    if not _constant_time_compare(tag, expected_tag):
        return None
    
    # MAC verified, now decrypt
    m = dec(k_enc, nonce, c)
    
    return m


def _constant_time_compare(a: bytes, b: bytes) -> bool:
    """
    Constant-time byte comparison to prevent timing attacks.
    
    Args:
        a: First byte string
        b: Second byte string
        
    Returns:
        True if a == b, False otherwise
    """
    if len(a) != len(b):
        return False
    
    result = 0
    for x, y in zip(a, b):
        result |= x ^ y
    
    return result == 0


# =============================================================================
# Unit Tests
# =============================================================================

class TestPA10(unittest.TestCase):
    """Test suite for CCA-secure symmetric encryption."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.k_enc = os.urandom(BLOCK_SIZE)
        self.k_mac = os.urandom(BLOCK_SIZE)
    
    def test_hmac_consistency(self):
        """HMAC should be deterministic."""
        m = b"test message"
        tag1 = hmac(self.k_mac, m)
        tag2 = hmac(self.k_mac, m)
        self.assertEqual(tag1, tag2)
    
    def test_hmac_length(self):
        """HMAC output should always be BLOCK_SIZE."""
        for msg_len in [0, 1, 16, 100, 1000]:
            m = os.urandom(msg_len)
            tag = hmac(self.k_mac, m)
            self.assertEqual(len(tag), BLOCK_SIZE)
    
    def test_hmac_key_normalization(self):
        """HMAC should handle keys of any length."""
        m = b"message"
        
        # Short key
        tag1 = hmac(b"short", m)
        self.assertEqual(len(tag1), BLOCK_SIZE)
        
        # Long key (should be truncated)
        long_key = os.urandom(BLOCK_SIZE + 10)
        tag2 = hmac(long_key, m)
        self.assertEqual(len(tag2), BLOCK_SIZE)
        
        # Different keys produce different tags
        self.assertNotEqual(tag1, tag2)
    
    def test_ctr_mode_length_preservation(self):
        """CTR mode should preserve message length."""
        for msg_len in [0, 1, 16, 50, 100, 1000]:
            m = os.urandom(msg_len)
            _, c = ctr_encrypt(self.k_enc, m)
            self.assertEqual(len(c), len(m))
    
    def test_ctr_mode_decryption(self):
        """CTR mode encryption and decryption should be inverses."""
        messages = [
            b"",
            b"short",
            b"x" * BLOCK_SIZE,
            b"y" * (BLOCK_SIZE + 5),
            os.urandom(100),
        ]
        
        for m in messages:
            nonce, c = ctr_encrypt(self.k_enc, m)
            m_recovered = ctr_decrypt(self.k_enc, nonce, c)
            self.assertEqual(m, m_recovered)
    
    def test_ctr_mode_different_nonces(self):
        """Different nonces should produce different ciphertexts."""
        m = b"test message" * 10
        nonce1, c1 = ctr_encrypt(self.k_enc, m, os.urandom(BLOCK_SIZE))
        nonce2, c2 = ctr_encrypt(self.k_enc, m, os.urandom(BLOCK_SIZE))
        
        self.assertNotEqual(nonce1, nonce2)
        self.assertNotEqual(c1, c2)
    
    def test_ctr_mode_random_nonces(self):
        """Random nonces should be different across calls."""
        m = b"test"
        nonce1, _ = ctr_encrypt(self.k_enc, m)
        nonce2, _ = ctr_encrypt(self.k_enc, m)
        
        self.assertNotEqual(nonce1, nonce2)
    
    def test_enc_dec_basic(self):
        """Basic encryption and decryption should work."""
        m = b"Hello, World!"
        nonce, c = enc(self.k_enc, m)
        m_recovered = dec(self.k_enc, nonce, c)
        self.assertEqual(m, m_recovered)
    
    def test_enc_cca_basic(self):
        """CCA encryption should produce (nonce, ciphertext, tag)."""
        m = b"CCA test message"
        nonce, c, tag = enc_cca(self.k_enc, self.k_mac, m)
        
        self.assertEqual(len(nonce), BLOCK_SIZE)
        self.assertEqual(len(c), len(m))
        self.assertEqual(len(tag), BLOCK_SIZE)
    
    def test_dec_cca_valid(self):
        """CCA decryption with valid tag should recover plaintext."""
        m = b"Secret message"
        nonce, c, tag = enc_cca(self.k_enc, self.k_mac, m)
        m_recovered = dec_cca(self.k_enc, self.k_mac, nonce, c, tag)
        
        self.assertEqual(m, m_recovered)
    
    def test_dec_cca_invalid_tag(self):
        """CCA decryption with invalid tag should return None."""
        m = b"Secret message"
        nonce, c, tag = enc_cca(self.k_enc, self.k_mac, m)
        
        # Flip a bit in the tag
        corrupted_tag = bytes(tag[0] ^ 1 if i == 0 else tag[i] 
                             for i in range(len(tag)))
        
        m_recovered = dec_cca(self.k_enc, self.k_mac, nonce, c, corrupted_tag)
        self.assertIsNone(m_recovered)
    
    def test_dec_cca_corrupted_ciphertext(self):
        """CCA decryption with corrupted ciphertext should return None."""
        m = b"Secret message"
        nonce, c, tag = enc_cca(self.k_enc, self.k_mac, m)
        
        # Corrupt the ciphertext
        corrupted_c = bytes(c[0] ^ 1 if i == 0 else c[i] for i in range(len(c)))
        
        m_recovered = dec_cca(self.k_enc, self.k_mac, nonce, corrupted_c, tag)
        self.assertIsNone(m_recovered)
    
    def test_dec_cca_different_keys(self):
        """CCA decryption with different key should return None."""
        m = b"Secret message"
        nonce, c, tag = enc_cca(self.k_enc, self.k_mac, m)
        
        # Use different MAC key
        wrong_k_mac = os.urandom(BLOCK_SIZE)
        m_recovered = dec_cca(self.k_enc, wrong_k_mac, nonce, c, tag)
        self.assertIsNone(m_recovered)
    
    def test_dec_cca_multiple_messages(self):
        """CCA should work correctly for multiple messages."""
        messages = [
            b"",
            b"short",
            b"x" * BLOCK_SIZE,
            b"y" * (BLOCK_SIZE + 10),
            os.urandom(100),
        ]
        
        for m in messages:
            nonce, c, tag = enc_cca(self.k_enc, self.k_mac, m)
            m_recovered = dec_cca(self.k_enc, self.k_mac, nonce, c, tag)
            self.assertEqual(m, m_recovered)


if __name__ == "__main__":
    unittest.main()
