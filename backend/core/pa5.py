import os
import secrets
import unittest
from pa4 import prp_encrypt, pkcs7_pad, xor_bytes, BLOCK_SIZE

# -----------------------------------------------------------------------------
# PHASE 1: PRF-MAC (Fixed-Length)
# -----------------------------------------------------------------------------
def prf_mac(k: bytes, m: bytes) -> bytes:
    if len(m) != BLOCK_SIZE:
        raise ValueError(f"Message must be exactly {BLOCK_SIZE} bytes for PRF-MAC")
    return prp_encrypt(k, m)

def prf_vrfy(k: bytes, m: bytes, t: bytes) -> bool:
    try:
        expected_tag = prf_mac(k, m)
        return secrets.compare_digest(expected_tag, t)
    except ValueError:
        return False

# -----------------------------------------------------------------------------
# PHASE 2: CBC-MAC (Variable-Length)
# -----------------------------------------------------------------------------
def cbc_mac(k: bytes, m: bytes) -> bytes:
    padded_m = pkcs7_pad(m, BLOCK_SIZE)
    blocks = [padded_m[i:i + BLOCK_SIZE] for i in range(0, len(padded_m), BLOCK_SIZE)]
    
    chain = b'\x00' * BLOCK_SIZE
    for block in blocks:
        chain = prp_encrypt(k, xor_bytes(chain, block))
        
    return chain

def cbc_vrfy(k: bytes, m: bytes, t: bytes) -> bool:
    expected_tag = cbc_mac(k, m)
    return secrets.compare_digest(expected_tag, t)

# -----------------------------------------------------------------------------
# PHASE 3: Unified Interface
# -----------------------------------------------------------------------------
def Mac(mode: str, k: bytes, m: bytes) -> bytes:
    mode = mode.upper()
    if mode == 'PRF':
        return prf_mac(k, m)
    elif mode == 'CBC':
        return cbc_mac(k, m)
    elif mode == 'HMAC':
        raise NotImplementedError("HMAC will be implemented in PA#10")
    else:
        raise ValueError(f"Unknown MAC mode: {mode}")

def Vrfy(mode: str, k: bytes, m: bytes, t: bytes) -> bool:
    mode = mode.upper()
    if mode == 'PRF':
        return prf_vrfy(k, m, t)
    elif mode == 'CBC':
        return cbc_vrfy(k, m, t)
    elif mode == 'HMAC':
        raise NotImplementedError("HMAC will be implemented in PA#10")
    else:
        raise ValueError(f"Unknown MAC mode: {mode}")

# -----------------------------------------------------------------------------
# PHASE 4 & 5: Attack Demonstrations & Tests
# -----------------------------------------------------------------------------
if __name__ == '__main__':
    print("=== PA#5 Message Authentication Codes (MACs) ===")
    
    attack_key = os.urandom(BLOCK_SIZE)
    
    # 1. MAC -> PRF Backward Reduction
    print("\n1. MAC -> PRF Backward Reduction")
    print("Generating MACs for 3 random uniformly distributed 16-byte blocks...")
    for i in range(3):
        rand_m = os.urandom(BLOCK_SIZE)
        tag = Mac('PRF', attack_key, rand_m)
        print(f"Message: {rand_m.hex()[:16]}... -> Tag: {tag.hex()}")
    print("Conclusion: The output is indistinguishable from a random oracle (pseudo-random).")
    
    # 2. EUF-CMA Forgery Simulation
    print("\n2. EUF-CMA Forgery Simulation")
    valid_pairs = []
    for i in range(50):
        msg = f"msg_{i:03d}".encode()
        tag = Mac('CBC', attack_key, msg)
        valid_pairs.append((msg, tag))
        
    print(f"Generated {len(valid_pairs)} valid (Message, Tag) pairs for a hidden key.")
    new_msg = b"msg_050" 
    
    attempts = 100
    success = 0
    for _ in range(attempts):
        guess_tag = os.urandom(BLOCK_SIZE)
        if Vrfy('CBC', attack_key, new_msg, guess_tag):
            success += 1
            
    print(f"Attacker attempted {attempts} random tag guesses for new message '{new_msg.decode()}'.")
    print(f"Successful forgeries: {success}")
    print("Conclusion: Extremely low probability of forgery without the key.")

    # 3. Length-Extension Vulnerability Demo
    import hashlib
    print("\n3. Length-Extension Vulnerability Demo (Naive Hash MAC)")
    secret_k = b"secret_key_12345"
    m_original = b"user=admin&action=read"
    
    h_original = hashlib.sha256(secret_k + m_original).hexdigest()
    print(f"Original M: {m_original}")
    print(f"Original Tag H(K||M): {h_original}")
    
    print("Attacker intercepts M and Tag. They DO NOT know K.")
    print("Because SHA-256 uses Merkle-Damgard construction, attacker can initialize a SHA-256 state")
    print("with the Original Tag, and hash new data, effectively computing H(K || M || padding || attacker_data).")
    print("This perfectly defeats the MAC integrity, which is why we must use CBC-MAC or HMAC!")

    print("-" * 50)
    
    # ------------- CORRECTNESS TESTS -------------
    print("\n--- Running Unittests ---")
    class TestMACModes(unittest.TestCase):
        def setUp(self):
            self.key = os.urandom(BLOCK_SIZE)
            self.exact_msg = os.urandom(BLOCK_SIZE)
            self.short_msg = b"Hello"
            self.long_msg = b"Hello world! This is a long message that crosses block boundary."
            
        def test_prf_mac(self):
            tag = Mac('PRF', self.key, self.exact_msg)
            self.assertTrue(Vrfy('PRF', self.key, self.exact_msg, tag))
            
            with self.assertRaises(ValueError):
                Mac('PRF', self.key, self.short_msg)
                
            bad_m = bytearray(self.exact_msg)
            bad_m[0] ^= 0x01
            self.assertFalse(Vrfy('PRF', self.key, bytes(bad_m), tag))
            
            bad_t = bytearray(tag)
            bad_t[0] ^= 0x01
            self.assertFalse(Vrfy('PRF', self.key, self.exact_msg, bytes(bad_t)))
            
        def test_cbc_mac(self):
            for m in [self.short_msg, self.exact_msg, self.long_msg]:
                tag = Mac('CBC', self.key, m)
                self.assertTrue(Vrfy('CBC', self.key, m, tag))
                
                bad_m = bytearray(m)
                bad_m[0] ^= 0x01
                self.assertFalse(Vrfy('CBC', self.key, bytes(bad_m), tag))
                
                bad_t = bytearray(tag)
                bad_t[0] ^= 0x01
                self.assertFalse(Vrfy('CBC', self.key, m, bytes(bad_t)))

    import sys
    sys.argv = ['pa5.py']
    unittest.main()
