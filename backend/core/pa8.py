import os
import unittest
from pa7 import merkle_damgard

# -----------------------------------------------------------------------------
# PHASE 1: Cryptographic Group Setup
# -----------------------------------------------------------------------------
class DLPGroup:
    def __init__(self, p: int, g: int, h: int):
        self.p = p
        self.g = g
        self.h = h

def get_toy_group() -> DLPGroup:
    """
    Toy group for demonstrating Birthday attacks mapping collision vulnerabilities
    mathematically enforcing O(sqrt(n)) failures exactly near ~256 mappings.
    p = 65537 (a Fermat prime, purely for demonstration).
    """
    p = 65537
    g = 3
    # h = g^alpha. Let alpha = 12345
    alpha = 12345
    h = pow(g, alpha, p)
    return DLPGroup(p, g, h)

def get_prod_group() -> DLPGroup:
    """
    RFC 3526 1024-bit MODP Group (Group 2). 
    Cryptographically secure dimensions isolating strict computational collisions natively.
    """
    # 1024-bit safe prime 2^1024 - 2^960 - 1 + 2^64 * { [2^894 pi] + 129093 }
    p = int(
        "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1"
        "29024E088A67CC74020BBEA63B139B22514A08798E3404DD"
        "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245"
        "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"
        "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381"
        "FFFFFFFFFFFFFFFF", 16
    )
    g = 2
    
    # Generates a pseudo-random h out of a 'forgotten' alpha.
    # In a real setup, alpha is discarded forever to protect the hash.
    os_rand = os.urandom(128)
    alpha = int.from_bytes(os_rand, 'big') % p
    h = pow(g, alpha, p)
    return DLPGroup(p, g, h)

# -----------------------------------------------------------------------------
# PHASE 2: The Secure Compression Function
# -----------------------------------------------------------------------------
def dlp_compress(state_bytes: bytes, block_bytes: bytes, group: DLPGroup) -> bytes:
    # 1. Convert state to integer x
    x = int.from_bytes(state_bytes, 'big')
    # 2. Convert block to integer y
    y = int.from_bytes(block_bytes, 'big')
    
    # 3. Compute (g^x * h^y) % p
    res = (pow(group.g, x, group.p) * pow(group.h, y, group.p)) % group.p
    
    # 4. Convert back to byte array of exact size mapping explicitly over states safely
    expected_bytes = (group.p.bit_length() + 7) // 8
    
    # Use to_bytes to automatically zero-pad to exactly expected_bytes
    return res.to_bytes(expected_bytes, byteorder='big')

# -----------------------------------------------------------------------------
# PHASE 3: The Unified Hash Function
# -----------------------------------------------------------------------------

GLOBAL_PROD_GROUP = get_prod_group()
BLOCK_SIZE = 128 # 1024-bit alignment mapping natively

def dlp_hash(message: bytes) -> bytes:
    """
    Routinely injects the unified standard hashing capabilities via 1024 bit states.
    """
    # Derive absolute static IV matching state sequence constraints
    # (128 bytes to match the output payload bounds).
    expected_bytes = (GLOBAL_PROD_GROUP.p.bit_length() + 7) // 8
    iv = b'\x01' * expected_bytes
    
    return merkle_damgard(
        message=message,
        iv=iv,
        block_size=BLOCK_SIZE,
        compress_func=lambda s, b: dlp_compress(s, b, GLOBAL_PROD_GROUP)
    )

# -----------------------------------------------------------------------------
# PHASE 4: The Toy Collision Demo (Setting up PA #9)
# -----------------------------------------------------------------------------
def toy_collision_demo():
    print("Initializing Toy Group (p = 65537)...")
    toy_group = get_toy_group()
    
    seen_hashes = {}
    
    print("Launching uniform block generation and hunting for exact collisions...")
    iterations = 0
    # Expected collisions around sqrt(p) -> ~256
    while True:
        iterations += 1
        
        # Random input simulation (x, y) generated effectively uniformly 
        test_x = os.urandom(2) 
        test_y = os.urandom(2)
        
        digest = dlp_compress(test_x, test_y, toy_group)
        
        if digest in seen_hashes:
            orig_x, orig_y = seen_hashes[digest]
            
            # Make sure it isn't literally the exact same (x,y) randomly drawn
            if orig_x != test_x or orig_y != test_y:
                print(f"COLLISION FOUND at iteration {iterations}!")
                print("--- Collision Inputs ---")
                print(f"Input Pair 1 -> X: {orig_x.hex()}, Y: {orig_y.hex()}")
                print(f"Input Pair 2 -> X: {test_x.hex()}, Y: {test_y.hex()}")
                print(f"Shared Digest: {digest.hex()} (Int: {int.from_bytes(digest, 'big')})")
                
                # Math insight proof
                orig_y_int = int.from_bytes(orig_y, 'big')
                test_y_int = int.from_bytes(test_y, 'big')
                print("\nSince (g^X1 * h^Y1) = (g^X2 * h^Y2) mod p,")
                if orig_y_int != test_y_int:
                    print("An attacker can natively isolate alpha resolving the strict mathematical equivalence directly!")
                break
        else:
            seen_hashes[digest] = (test_x, test_y)

if __name__ == '__main__':
    print("=== PA#8 DLP-Based Collision-Resistant Hash Function ===")
    
    print("\n--- Phase 4: Toy Collision Demo (Birthday Paradox) ---")
    toy_collision_demo()
    print("-" * 50)
    
    print("\n--- Correctness Unittests ---")
    class TestDLPHash(unittest.TestCase):
        def test_determinism(self):
            m = b"Strict structural determinism testing"
            # It maps explicitly without random shifts evaluating identically across iterations
            self.assertEqual(dlp_hash(m), dlp_hash(m))
            
        def test_sensitivity(self):
            m1 = b"Testing structural divergence over bit offsets."
            m2 = b"Testing structural divergence over bit offsett."
            self.assertNotEqual(dlp_hash(m1), dlp_hash(m2))

        def test_distinct_messages(self):
            # "Hash at least five messages of different lengths... and confirm distinct inputs produce distinct digests."
            messages = [
                b"",
                b"Short",
                b"A slightly longer message targeting different boundaries",
                b"Exactly 16 bytes",
                os.urandom(200) # Crosses the 128 byte block size boundary
            ]
            digests = set()
            for m in messages:
                digest = dlp_hash(m)
                digests.add(digest)
            # Ensure all 5 are absolutely distinct 
            self.assertEqual(len(digests), 5)

    import sys
    sys.argv = ['pa8.py']
    unittest.main()
