import os
import unittest
from pa4 import Encrypt, Decrypt, xor_bytes, BLOCK_SIZE
from pa5 import Mac, Vrfy

class InvalidCiphertextException(Exception):
    """Exception raised when ciphertext fails MAC verification."""
    pass

# -----------------------------------------------------------------------------
# PHASE 1: The CCA Core Implementation
# -----------------------------------------------------------------------------
def cca_encrypt(enc_mode: str, mac_mode: str, k_enc: bytes, k_mac: bytes, M: bytes) -> tuple[bytes, bytes, bytes]:
    if k_enc == k_mac:
        raise ValueError("Encryption key and MAC key MUST be independent for CCA security.")
        
    iv_or_nonce, C = Encrypt(enc_mode, k_enc, M)
    
    # Crucial Step: Authenticate both IV/nonce and ciphertext
    data_to_authenticate = iv_or_nonce + C
    
    T = Mac(mac_mode, k_mac, data_to_authenticate)
    
    return (iv_or_nonce, C, T)

def cca_decrypt(enc_mode: str, mac_mode: str, k_enc: bytes, k_mac: bytes, iv_or_nonce: bytes, C: bytes, T: bytes) -> bytes:
    # Reconstruct authenticated data
    data_to_authenticate = iv_or_nonce + C
    
    # The Golden Rule of Cryptography: Verify before decrypting!
    if not Vrfy(mac_mode, k_mac, data_to_authenticate, T):
        raise InvalidCiphertextException("MAC verification failed: Ciphertext or IV has been tampered with or corrupted.")
        
    # If verification passes, we decrypt
    return Decrypt(enc_mode, k_enc, iv_or_nonce, C)

# -----------------------------------------------------------------------------
# PHASE 2 & 3: Attack Demonstration and Unit Tests
# -----------------------------------------------------------------------------
if __name__ == '__main__':
    print("=== PA#6 CCA-Secure Symmetric Encryption ===")
    
    k_enc = os.urandom(BLOCK_SIZE)
    k_mac = os.urandom(BLOCK_SIZE)
    
    # Phase 2: Active Adversary Malleability Demo
    print("\n--- Phase 2: The Attack Demonstration (Why CCA matters) ---")
    
    original_msg = b"Transfer $00100 to Bob"
    print(f"[Bank Client] Message to send: {original_msg}")
    
    # 1. Encrypt message (Using CTR mode to make bit-flipping mathematically isolated, and CBC-MAC)
    nonce, C, T = cca_encrypt('CTR', 'CBC', k_enc, k_mac, original_msg)
    
    # 2. Adversary intercepts (nonce, C, T)
    print("\n[Adversary] Intercepted payload (nonce, C, T).")
    
    # Adversary wants to change "$00100" to "$99900".
    # Target index starts at index 10: b"Transfer $" is 10 bytes.
    target_pos = 10 
    original_str = b"00100"
    forged_str = b"99900"
    
    # Compute the XOR mask
    mask = xor_bytes(original_str, forged_str)
    
    # Apply mask to ciphertext to create C_forged directly utilizing CTR logic vulnerabilities
    c_list = bytearray(C)
    for i in range(len(mask)):
        c_list[target_pos + i] ^= mask[i]
    C_forged = bytes(c_list)
    
    print("[Adversary] Forged the ciphertext to mutate the amount to $99900.")
    print("[Adversary] Submitting (nonce, C_forged, T) to the Bank...")
    
    # 3. Defense (Bank side)
    print("\n[Bank Server] Receiving payload and attempting CCA decryption...")
    try:
        M_decrypted = cca_decrypt('CTR', 'CBC', k_enc, k_mac, nonce, C_forged, T)
        print(f"CRITICAL FAILURE: Bank decrypted message: {M_decrypted}")
    except InvalidCiphertextException as e:
        print("[Bank Server] Verification Failed!")
        print(f"Exception Caught: {e}")
        print("Success: The CCA-wrapper successfully blocked the forged ciphertext from reaching the decryption logic!")

    print("-" * 50)
    
    # Phase 3: Correctness Tests
    print("-" * 50)
    
    # IND-CCA2 Game Simulation
    print("\n--- Phase 2.5: IND-CCA2 Game Simulation ---")
    def ind_cca2_game_simulation(trials=100):
        game_k_enc = os.urandom(BLOCK_SIZE)
        game_k_mac = os.urandom(BLOCK_SIZE)
        
        # Oracle for decryption
        def dec_oracle(c, t):
            try:
                return cca_decrypt('CTR', 'CBC', game_k_enc, game_k_mac, c[:BLOCK_SIZE], c[BLOCK_SIZE:], t)
            except InvalidCiphertextException:
                return b"REJECT"
                
        successes = 0
        for _ in range(trials):
            m0 = os.urandom(16)
            m1 = os.urandom(16)
            
            # Select secret bit
            b = os.urandom(1)[0] % 2
            m_b = m1 if b else m0
            
            # Challenge
            iv, c, t = cca_encrypt('CTR', 'CBC', game_k_enc, game_k_mac, m_b)
            
            # Adversary tries to tweak the challenge and submit to Decrypt Oracle
            bad_c = bytearray(c)
            bad_c[0] ^= 0x01
            # The oracle reliably rejects and gives no info on `m_b`
            oracle_resp = dec_oracle(iv + bytes(bad_c), t)
            
            # Since the oracle rejected, the adversary must blind guess `b`
            guess = os.urandom(1)[0] % 2
            if guess == b:
                successes += 1
                
        # Calculate empirical advantage
        advantage = abs((successes / trials) - 0.5) * 2
        print(f"Executed {trials} IND-CCA2 Game iterations.")
        print(f"Adversary successfully guessed secret bit {successes} times.")
        print(f"Empirical Advantage: {advantage:.4f} (Expected ≈ 0.0)")

    ind_cca2_game_simulation()
    
    print("\n--- Phase 3: Running Unittests ---")
    class TestCCAModes(unittest.TestCase):
        def setUp(self):
            self.k_enc = os.urandom(BLOCK_SIZE)
            self.k_mac = os.urandom(BLOCK_SIZE)
            self.msg = b"This is a strictly confidential test payload."
            
        def test_successful_encryption_decryption(self):
            combos = [('CBC', 'CBC'), ('CTR', 'CBC'), ('OFB', 'CBC')]
            for enc_m, mac_m in combos:
                iv, C, T = cca_encrypt(enc_m, mac_m, self.k_enc, self.k_mac, self.msg)
                req_msg = cca_decrypt(enc_m, mac_m, self.k_enc, self.k_mac, iv, C, T)
                self.assertEqual(req_msg, self.msg)
                
        def test_flip_iv(self):
            iv, C, T = cca_encrypt('CTR', 'CBC', self.k_enc, self.k_mac, self.msg)
            bad_iv = bytearray(iv)
            bad_iv[0] ^= 0x01
            with self.assertRaises(InvalidCiphertextException):
                cca_decrypt('CTR', 'CBC', self.k_enc, self.k_mac, bytes(bad_iv), C, T)

        def test_flip_ciphertext(self):
            iv, C, T = cca_encrypt('CTR', 'CBC', self.k_enc, self.k_mac, self.msg)
            bad_c = bytearray(C)
            bad_c[-1] ^= 0x01
            with self.assertRaises(InvalidCiphertextException):
                cca_decrypt('CTR', 'CBC', self.k_enc, self.k_mac, iv, bytes(bad_c), T)
                
        def test_flip_tag(self):
            iv, C, T = cca_encrypt('CTR', 'CBC', self.k_enc, self.k_mac, self.msg)
            bad_t = bytearray(T)
            bad_t[5] ^= 0x01
            with self.assertRaises(InvalidCiphertextException):
                cca_decrypt('CTR', 'CBC', self.k_enc, self.k_mac, iv, C, bytes(bad_t))

    import sys
    sys.argv = ['pa6.py']
    unittest.main()
