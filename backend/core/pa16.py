from __future__ import annotations
from dataclasses import dataclass
from typing import Tuple

import os
import sys
import unittest
import secrets

from pa11 import Group, GroupElement

@dataclass
class PublicKey:
    G: Group
    q: int
    g: GroupElement
    h: GroupElement

@dataclass
class SecretKey:
    G: Group
    g: GroupElement
    x: int

Ciphertext = Tuple[GroupElement, GroupElement]
Message = GroupElement

# -----------------------------------------------------------------------------
# PHASE 1: ElGamal Cryptosystem Functions
# -----------------------------------------------------------------------------

def elgamal_keygen(G: Group) -> Tuple[PublicKey, SecretKey]:
    """Generates the public and private keys using the specified cyclic Group."""
    x = secrets.randbelow(G.q - 1) + 1  # 1 to q-1
    g = G.generator()
    h = g ** x
    
    pk = PublicKey(G, G.q, g, h)
    sk = SecretKey(G, g, x)
    return pk, sk

def Enc(pk: PublicKey, m: Message) -> Ciphertext:
    """Implement ElGamal Encryption."""
    r = secrets.randbelow(pk.q - 1) + 1
    c1 = pk.g ** r
    c2 = m * (pk.h ** r)
    return c1, c2

def Dec(sk: SecretKey, c: Ciphertext) -> Message:
    """Implement ElGamal Decryption."""
    c1, c2 = c
    c1_x = c1 ** sk.x
    c1_x_inv = c1_x.inverse()
    return c2 * c1_x_inv

# -----------------------------------------------------------------------------
# PHASE 2: CCA Malleability Vulnerability
# -----------------------------------------------------------------------------

def malleability_attack(c: Ciphertext, factor: int = 2) -> Ciphertext:
    """
    Given ciphertext c for unknown m, construct ciphertext decrypting to factor * m.
    Shows the structural limits of CPA-secured cryptography.
    """
    c1, c2 = c
    factor_elem = GroupElement(factor, c2.group)
    c2_prime = c2 * factor_elem
    return c1, c2_prime

# -----------------------------------------------------------------------------
# PHASE 3: IND-CPA Distinguishing Strategy Simulation
# -----------------------------------------------------------------------------

def cpa_game(G: Group, rounds: int = 20) -> float:
    """
    IND-CPA game for ElGamal. Demonstrates structural indistinguishability properly.
    By brute-forcing against tiny groups we measure > 0 algorithmic distinguishing.
    """
    pk, sk = elgamal_keygen(G)
    wins = 0
    m0 = G(10)
    m1 = G(20)
    
    for _ in range(rounds):
        b = secrets.randbelow(2)
        m_b = m0 if b == 0 else m1
        c = Enc(pk, m_b)
        
        guess = 0
        if G.q < 10000:
            # Bruteforce distinguisher
            for possible_r in range(1, G.q):
                test_c1 = pk.g ** possible_r
                if test_c1 == c[0]:
                    test_c2_m0 = m0 * (pk.h ** possible_r)
                    if test_c2_m0 == c[1]:
                        guess = 0
                        break
                    else:
                        guess = 1
                        break
        else:
            guess = secrets.randbelow(2) # random guess for safe groups
            
        if guess == b:
            wins += 1
            
    p_correct = wins / rounds
    return abs(p_correct - 0.5)

# -----------------------------------------------------------------------------
# PHASE 4: Utility functions and Demos
# -----------------------------------------------------------------------------

def get_real_safe_prime(bits: int) -> int:
    import pa1
    while True:
        p = secrets.randbits(bits)
        p |= (1 << (bits - 1)) | 1
        if p % 2 == 0: continue
        # To be safe prime, q = (p-1)//2 must be prime
        q = (p - 1)//2
        if pa1.miller_rabin(q, rounds=10) and pa1.miller_rabin(p, rounds=10):
            return p

def _demo():
    print("=== PA #16 ElGamal Encryption ===\n")
    
    # Tiny group for attack demo
    tiny_group = Group(23)
    
    print("--- (1) Malleability Attack Demo ---")
    pk_tiny, sk_tiny = elgamal_keygen(tiny_group)
    m = tiny_group(5)
    c = Enc(pk_tiny, m)
    print(f"Original M: {m}")
    print(f"Original Ciphertext: {c}")
    
    # Attack step:
    c_forged = malleability_attack(c, factor=2)
    m_recovered = Dec(sk_tiny, c_forged)
    print(f"Forged Ciphertext : {c_forged}")
    print(f"Decrypted forged M: {m_recovered} (should be 2 * 5 mod p)")

    print("\n--- (2) IND-CPA Distinguishing Demo ---")
    print("Running IND-CPA game on TINY group (p=23)...")
    adv_tiny = cpa_game(tiny_group, rounds=30)
    print(f"Tiny group advantage (should be ~0.5): {adv_tiny:.2f}")

    print("\nRunning IND-CPA game on LARGE secure group (~256 bit)...")
    large_p = get_real_safe_prime(256)
    secure_group = Group(large_p)
    adv_secure = cpa_game(secure_group, rounds=30)
    print(f"Secure group advantage (should be ~0.0): {adv_secure:.2f}")


class TestPA16(unittest.TestCase):
    def setUp(self):
        self.G = Group(23)
        self.pk, self.sk = elgamal_keygen(self.G)

    def test_correctness(self):
        m = self.G(10)
        c = Enc(self.pk, m)
        self.assertEqual(Dec(self.sk, c), m)

    def test_malleability(self):
        m = self.G(7)
        c = Enc(self.pk, m)
        c_forged = malleability_attack(c, factor=2)
        expected_m = self.G(14)
        self.assertEqual(Dec(self.sk, c_forged), expected_m)

if __name__ == "__main__":
    _demo()
    print("\n--- Running unit tests ---")
    sys.argv = [sys.argv[0]]
    unittest.main()