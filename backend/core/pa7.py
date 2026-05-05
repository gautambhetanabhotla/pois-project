import os
import unittest

# -----------------------------------------------------------------------------
# PHASE 1: Merkle-Damgård Length Padding
# -----------------------------------------------------------------------------
def md_pad(message: bytes, block_size: int = 64) -> bytes:
    """
    Applies strict MD-compliant padding ensuring no two messages share identical padding limits.
    """
    # 1. Record original length in bits
    original_bit_len = len(message) * 8
    
    # 2. Append the '1' bit (b'\x80')
    padded = bytearray(message)
    padded.append(0x80)
    
    # 3. Append '0' bits until the length is 8 bytes short of a multiple of block_size
    # We want len(padded) % block_size == block_size - 8
    target_mod = block_size - 8
    pad_len = (target_mod - len(padded)) % block_size
    padded.extend(b'\x00' * pad_len)
    
    # 4. Attach original bit length as an 8-byte big-endian integer
    padded.extend(original_bit_len.to_bytes(8, byteorder='big'))
    
    return bytes(padded)

# -----------------------------------------------------------------------------
# PHASE 2: The Core Merkle-Damgård Loop
# -----------------------------------------------------------------------------
def merkle_damgard(message: bytes, iv: bytes, block_size: int, compress_func) -> bytes:
    """
    Core MD Loop executing the iterative state compression mapped securely over safe blocks boundaries.
    """
    padded_msg = md_pad(message, block_size)
    blocks = [padded_msg[i:i + block_size] for i in range(0, len(padded_msg), block_size)]
    
    state = iv
    for block in blocks:
        state = compress_func(state, block)
        
    return state

# -----------------------------------------------------------------------------
# PHASE 3: The Stub Compression Function
# -----------------------------------------------------------------------------
def dummy_compress(state: bytes, block: bytes) -> bytes:
    """
    A naive toy compression function that XORs the current state with the 
    corresponding bytes of the incoming block.
    Not cryptographically secure. Used strictly to validate PA#7 structural loops decoupled from PA#8.
    """
    # Simply XOR the state with the first len(state) bytes of the block
    xored = bytearray(state)
    for i in range(len(state)):
        # Safety bound execution guarantees
        if i < len(block):
            xored[i] ^= block[i]
    return bytes(xored)


# -----------------------------------------------------------------------------
# PHASE 3b: Convenience wrappers for use from main.py (PA5 length-extension demo)
# -----------------------------------------------------------------------------
BLOCK_SIZE = 16   # Our toy MD uses 16-byte blocks to match the PRP block size
_IV = b"\x00" * 8  # 8-byte zero IV

def md_hash(data: bytes) -> bytes:
    """Hash arbitrary-length data with the toy MD transform.
    Uses dummy_compress with 16-byte blocks and an 8-byte state (zero IV).
    Returns the 8-byte chaining value."""
    return merkle_damgard(data, _IV, BLOCK_SIZE, dummy_compress)

def md_hash_from_iv(iv: bytes, data: bytes) -> bytes:
    """Hash data starting from a given 8-byte IV.
    This is what an attacker does in a length-extension attack: they set the IV
    to the intercepted tag and hash only the suffix — producing a valid tag for
    the extended message without knowing the key."""
    return merkle_damgard(data, iv, BLOCK_SIZE, dummy_compress)



# -----------------------------------------------------------------------------
if __name__ == '__main__':
    print("=== PA#7 Merkle-Damgård Transform ===")
    
    class TestMerkleDamgard(unittest.TestCase):
        def setUp(self):
            # Define an arbitrary 8-byte IV sequence for routing the deterministic testing.
            self.iv = b"init_vec"
            self.block_size = 64
            
        def test_md_pad_empty(self):
            empty_msg = b""
            padded = md_pad(empty_msg, self.block_size)
            
            # Guarantees boundary length alignment
            self.assertEqual(len(padded), self.block_size)
            # Guarantees boundary marker evaluation (`10000000`)
            self.assertEqual(padded[0], 0x80)
            # Zero padding verification
            self.assertEqual(padded[1:56], b'\x00' * 55)
            # The bit length payload must register exactly integer `0`
            self.assertEqual(padded[56:], (0).to_bytes(8, byteorder='big'))
            
        def test_md_pad_exact_block(self):
            # Validates that boundary conditions identical to block_size spill over safely into N+1 chunks implicitly
            exact_msg = os.urandom(self.block_size)
            padded = md_pad(exact_msg, self.block_size)
            
            self.assertEqual(len(padded), self.block_size * 2)
            self.assertEqual(padded[self.block_size], 0x80)
            self.assertEqual(padded[-8:], (self.block_size * 8).to_bytes(8, byteorder='big'))
        
        def test_merkle_damgard_determinism(self):
            msg = b"This is a strictly deterministic hash check mapping over identical sequence generators."
            hash1 = merkle_damgard(msg, self.iv, self.block_size, dummy_compress)
            hash2 = merkle_damgard(msg, self.iv, self.block_size, dummy_compress)
            self.assertEqual(hash1, hash2)
            
        def test_merkle_damgard_sensitivity(self):
            msg1 = b"Testing strict sensitivity mapping guarantees."
            msg2 = b"testing strict sensitivity mapping guarantees." # Subtly mutates capital 'T' -> 't' (1 bit flip basically)
            hash1 = merkle_damgard(msg1, self.iv, self.block_size, dummy_compress)
            hash2 = merkle_damgard(msg2, self.iv, self.block_size, dummy_compress)
            self.assertNotEqual(hash1, hash2)

    import sys
    sys.argv = ['pa7.py']
    
    print("\n--- Phase 4: Collision Propagation Demo ---")
    # To demonstrate propagation, we find a collision in `dummy_compress`.
    # dummy_compress is simply: state ^ block. 
    # Let IV = b"00000000". If we use block1="AAAAAAAA" and block2="BBBBBBBB"
    # We can create a collision manually. Wait, a better way: 
    # state1 = IV, block1 = b'\x00'*64 => output is b"init_vec"
    # If we alter both state and block appropriately, but wait, the MD loop fixes IV.
    # To collide MD(msg1) and MD(msg2):
    # If we append a block that perfectly un-does the states, we merge them.
    # Actually, the simplest proof: 
    # If h(z, M) == h(z, M'), then MD(H, M_suffix) == MD(H', M_suffix).
    # Since dummy_compress is XOR, M and M' will collide if we find M giving the same hash? 
    # Not needed, dummy_compress ignores bytes beyond len(state).
    # Any two messages that differ ONLY in bytes beyond len(state) (the 8th byte) 
    # will collide in dummy_compress, and thus in the whole MD transform!
    
    collide_msg_1 = b"collide!" + b"A"*10
    collide_msg_2 = b"collide!" + b"B"*10
    
    # They collide at the first block's compression because dummy_compress only looks at the first 8 bytes.
    z_1 = dummy_compress(b"init_vec", md_pad(collide_msg_1, 64)[:64])
    z_2 = dummy_compress(b"init_vec", md_pad(collide_msg_2, 64)[:64])
    print(f"Underlying compression collision achieved: {z_1.hex()} == {z_2.hex()}")
    
    # Therefore, they MUST collide in the full MD hash.
    full_md_1 = merkle_damgard(collide_msg_1, b"init_vec", 64, dummy_compress)
    full_md_2 = merkle_damgard(collide_msg_2, b"init_vec", 64, dummy_compress)
    print(f"Full Merkle-Damgrad hash matches: {full_md_1.hex()} == {full_md_2.hex()}")
    print("Proof Complete: A collision in the underlying 'h' forces a collision in the MD Transform 'H'!\n")
    
    print("--- Phase 4: Running Boundary & Determinism Tests ---")
    unittest.main()
