import os
import sys
import concurrent.futures
from pa2 import prp_encrypt, prp_decrypt, BLOCK_SIZE

# -----------------------------------------------------------------------------
# PHASE 1: Setup & Padding Utility
# -----------------------------------------------------------------------------

def pkcs7_pad(data: bytes, block_size: int = BLOCK_SIZE) -> bytes:
    pad_len = block_size - (len(data) % block_size)
    return data + bytes([pad_len] * pad_len)

def pkcs7_unpad(data: bytes) -> bytes:
    if not data:
        raise ValueError("Cannot unpad empty bytes")
    pad_len = data[-1]
    if pad_len == 0 or pad_len > BLOCK_SIZE:
        raise ValueError("Invalid PKCS7 padding length")
    # Verify all padding bytes are correct
    for i in range(1, pad_len + 1):
        if data[-i] != pad_len:
            raise ValueError("Invalid PKCS7 padding bytes")
    return data[:-pad_len]

def xor_bytes(b1: bytes, b2: bytes) -> bytes:
    return bytes(a ^ b for a, b in zip(b1, b2))

# -----------------------------------------------------------------------------
# PHASE 2: Mode Implementations
# -----------------------------------------------------------------------------

def cbc_encrypt(k: bytes, M: bytes) -> tuple[bytes, bytes]:
    iv = os.urandom(BLOCK_SIZE)
    padded_m = pkcs7_pad(M, BLOCK_SIZE)
    
    blocks = [padded_m[i:i + BLOCK_SIZE] for i in range(0, len(padded_m), BLOCK_SIZE)]
    C = []
    
    prev_c = iv
    for m_block in blocks:
        # C_i = E_k(C_{i-1} ^ M_i)
        to_encrypt = xor_bytes(prev_c, m_block)
        c_block = prp_encrypt(k, to_encrypt)
        C.append(c_block)
        prev_c = c_block
        
    return iv, b''.join(C)

def cbc_decrypt(k: bytes, iv: bytes, C: bytes) -> bytes:
    if len(C) % BLOCK_SIZE != 0:
        raise ValueError("Ciphertext length must be a multiple of the block size")
        
    blocks = [C[i:i + BLOCK_SIZE] for i in range(0, len(C), BLOCK_SIZE)]
    M = []
    
    prev_c = iv
    for c_block in blocks:
        # M_i = E_k^-1(C_i) ^ C_{i-1}
        decrypted = prp_decrypt(k, c_block)
        m_block = xor_bytes(decrypted, prev_c)
        M.append(m_block)
        prev_c = c_block
        
    padded_m = b''.join(M)
    return pkcs7_unpad(padded_m)

def ofb_keystream(k: bytes, iv: bytes, num_blocks: int) -> bytes:
    z = iv
    stream = []
    for _ in range(num_blocks):
        z = prp_encrypt(k, z)
        stream.append(z)
    return b''.join(stream)

def ofb_crypt(k: bytes, iv: bytes, data: bytes) -> bytes:
    # Demonstrate precomputation: calculate keystream first
    num_blocks = (len(data) + BLOCK_SIZE - 1) // BLOCK_SIZE
    if num_blocks == 0:
        return b''
    stream = ofb_keystream(k, iv, num_blocks)
    # Then XOR instantly with the data
    return xor_bytes(data, stream[:len(data)])

def ctr_encrypt(k: bytes, M: bytes) -> tuple[bytes, bytes]:
    r = os.urandom(BLOCK_SIZE)
    r_int = int.from_bytes(r, byteorder='big')
    
    blocks = [M[i:i + BLOCK_SIZE] for i in range(0, len(M), BLOCK_SIZE)]
    
    def process_block(i, m_block):
        counter_val = (r_int + i) % (1 << (BLOCK_SIZE * 8))
        counter_bytes = counter_val.to_bytes(BLOCK_SIZE, byteorder='big')
        z = prp_encrypt(k, counter_bytes)
        return xor_bytes(m_block, z[:len(m_block)])
        
    # Demonstrate parallel block computation
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(process_block, i, block) for i, block in enumerate(blocks)]
        C = [f.result() for f in futures]
        
    return r, b''.join(C)

def ctr_decrypt(k: bytes, r: bytes, C: bytes) -> bytes:
    r_int = int.from_bytes(r, byteorder='big')
    
    blocks = [C[i:i + BLOCK_SIZE] for i in range(0, len(C), BLOCK_SIZE)]
    
    def process_block(i, c_block):
        counter_val = (r_int + i) % (1 << (BLOCK_SIZE * 8))
        counter_bytes = counter_val.to_bytes(BLOCK_SIZE, byteorder='big')
        z = prp_encrypt(k, counter_bytes)
        return xor_bytes(c_block, z[:len(c_block)])
        
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(process_block, i, block) for i, block in enumerate(blocks)]
        M = [f.result() for f in futures]
        
    return b''.join(M)

# -----------------------------------------------------------------------------
# PHASE 3: The Unified Interface
# -----------------------------------------------------------------------------

def Encrypt(mode: str, k: bytes, M: bytes) -> tuple[bytes, bytes]:
    """Unified Encryption interface."""
    mode = mode.upper()
    if mode == 'CBC':
        return cbc_encrypt(k, M)
    elif mode == 'OFB':
        iv = os.urandom(BLOCK_SIZE)
        return iv, ofb_crypt(k, iv, M)
    elif mode == 'CTR':
        return ctr_encrypt(k, M)
    else:
        raise ValueError(f"Unknown mode {mode}")

def Decrypt(mode: str, k: bytes, iv_or_nonce: bytes, C: bytes) -> bytes:
    """Unified Decryption interface."""
    mode = mode.upper()
    if mode == 'CBC':
        return cbc_decrypt(k, iv_or_nonce, C)
    elif mode == 'OFB':
        return ofb_crypt(k, iv_or_nonce, C)
    elif mode == 'CTR':
        return ctr_decrypt(k, iv_or_nonce, C)
    else:
        raise ValueError(f"Unknown mode {mode}")

# -----------------------------------------------------------------------------
# PHASE 4 & 5: Attack Demos and Correctness Tests
# -----------------------------------------------------------------------------

if __name__ == '__main__':
    import unittest

    print("=== PA#4 Modes of Operation ===")
    
    # ------------- ATTACK DEMONSTRATIONS -------------
    print("\n--- Running Attack Demos ---")
    
    attack_key = os.urandom(BLOCK_SIZE)
    M1 = b"Hello World! This is a secret message"
    M2 = b"Hello World! This is a TRAPPED message"
    
    # 1. CBC IV-Reuse Attack
    forced_iv = os.urandom(BLOCK_SIZE)
    
    # Manually implementing the CBC loop logic with the same IV for demo
    def cbc_encrypt_forced_iv(k, iv, M):
        padded_m = pkcs7_pad(M, BLOCK_SIZE)
        blocks = [padded_m[i:i+BLOCK_SIZE] for i in range(0, len(padded_m), BLOCK_SIZE)]
        C_out, prev_c = [], iv
        for mb in blocks:
            c_block = prp_encrypt(k, xor_bytes(prev_c, mb))
            C_out.append(c_block)
            prev_c = c_block
        return b''.join(C_out)

    print("\n1. CBC IV-Reuse Attack")
    C1_cbc = cbc_encrypt_forced_iv(attack_key, forced_iv, M1)
    C2_cbc = cbc_encrypt_forced_iv(attack_key, forced_iv, M2)
    print("M1:", M1)
    print("M2:", M2)
    print("C1 (hex):", C1_cbc.hex())
    print("C2 (hex):", C2_cbc.hex())
    print("Observe that the first 16 bytes (32 hex chars) match:")
    print("C1[:16]:", C1_cbc[:16].hex())
    print("C2[:16]:", C2_cbc[:16].hex())
    print("Matched? :", C1_cbc[:16] == C2_cbc[:16])

    # 2. OFB Keystream-Reuse Attack
    print("\n2. OFB Keystream-Reuse Attack")
    C1_ofb = ofb_crypt(attack_key, forced_iv, M1)
    C2_ofb = ofb_crypt(attack_key, forced_iv, M2)
    
    # XOR the ciphertexts together
    c_xor = xor_bytes(C1_ofb, C2_ofb)
    # XOR the plaintexts together
    m_xor = xor_bytes(M1, M2)
    
    print("C1^C2 (hex):", c_xor.hex())
    print("M1^M2 (hex):", m_xor.hex())
    print("Matched?   :", c_xor == m_xor)
    print("This perfectly recovers M1^M2 bypassing encryption out entirely")
    print("-" * 50)

    # 3. OFB Keystream Precomputation Demo
    print("\n3. OFB Keystream Precomputation Demo")
    stream = ofb_keystream(attack_key, forced_iv, 2)
    print("Pre-computed 2 blocks of keystream:", stream.hex())
    # Instant XOR without cipher ops
    instant_c = xor_bytes(M1[:32], stream[:32])
    print("Instant enc of M1[:32] using precomputed stream:", instant_c.hex())
    
    # 4. Bit-Flip Error Propagation Demo
    print("\n4. Bit-Flip Error Propagation Demo")
    multi_m = b"A"*16 + b"B"*16 + b"C"*16
    
    def flip_first_bit(cipher_bytes):
        ba = bytearray(cipher_bytes)
        ba[0] ^= 0x01 # flip LSB of first byte
        return bytes(ba)
        
    print(f"Original M: {multi_m}")
    
    # CBC
    iv_cbc, c_cbc = Encrypt('CBC', attack_key, multi_m)
    try:
        bad_m_cbc = Decrypt('CBC', attack_key, iv_cbc, flip_first_bit(c_cbc))
        print("CBC  Bad M:", bad_m_cbc)
    except Exception as e:
        print("CBC  Bad M: (Decryption failed due to padding error, which is expected!)", e)
        
    # OFB
    iv_ofb, c_ofb = Encrypt('OFB', attack_key, multi_m)
    bad_m_ofb = Decrypt('OFB', attack_key, iv_ofb, flip_first_bit(c_ofb))
    print("OFB  Bad M:", bad_m_ofb)
    
    # CTR
    r_ctr, c_ctr = Encrypt('CTR', attack_key, multi_m)
    bad_m_ctr = Decrypt('CTR', attack_key, r_ctr, flip_first_bit(c_ctr))
    print("CTR  Bad M:", bad_m_ctr)
    
    print("\nNotice: CBC corrupts the entire first block and flips 1 bit in the second block.")
    print("Notice: OFB and CTR only corrupt the exact same single bit that was flipped.\n")


    # ------------- CORRECTNESS TESTS -------------
    print("\n--- Running Unittests ---")
    class TestBlockCipherModes(unittest.TestCase):
        def setUp(self):
            self.key = os.urandom(16)
            self.short_msg = b"Hello"
            self.exact_msg = b"A" * 16
            self.multi_msg = b"This is a longer message that spans exactly multiple blocks!" # 60 bytes
            
        def test_cbc(self):
            for msg in [self.short_msg, self.exact_msg, self.multi_msg]:
                iv, c = Encrypt('CBC', self.key, msg)
                m = Decrypt('CBC', self.key, iv, c)
                self.assertEqual(m, msg)
                
        def test_ofb(self):
             for msg in [self.short_msg, self.exact_msg, self.multi_msg]:
                iv, c = Encrypt('OFB', self.key, msg)
                m = Decrypt('OFB', self.key, iv, c)
                self.assertEqual(m, msg)
                
        def test_ctr(self):
             for msg in [self.short_msg, self.exact_msg, self.multi_msg]:
                nonce, c = Encrypt('CTR', self.key, msg)
                m = Decrypt('CTR', self.key, nonce, c)
                self.assertEqual(m, msg)

    # Run tests
    import sys
    sys.argv = ['pa4.py']
    unittest.main()
