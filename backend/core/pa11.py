from __future__ import annotations

class Group:
    """Represents the multiplicative group Zp*."""
    def __init__(self, p):
        self.p = p
        self.q = (p-1) // 2

    def __call__(self, value: int) -> GroupElement:
        """Helper to create elements: G(5) instead of GroupElement(5, G)."""
        return GroupElement(value % self.p, self)

    def __repr__(self):
        return f"Multiplicative Group Z_p* with p={self.p}, q={self.q}"

    def random(self):
        """Generate a random group element."""
        import random
        return self(random.randint(1, self.p - 1))

    def generator(self):
        """Return a a generator of the subgroup of order q."""
        while True:
            import random
            a = random.randint(2, self.p - 1)
            # Squaring an element in Zp* puts it in the subgroup of order q
            g_val = pow(a, 2, self.p)

            if g_val != 1:
                # Because q is prime, any element != 1 in the 
                # subgroup of squares is a generator.
                return GroupElement(g_val, self)
    
    @classmethod
    def from_safe_prime(cls, bits: int):
        """Generate a group with a safe prime of the given bit length."""
        p = generate_safe_prime(bits)
        return cls(p)


class GroupElement:
    def __init__(self, value: int, group: Group):
        self.group = group
        self.value = value % group.p

    def __mul__(self, other):
        if not isinstance(other, GroupElement):
            raise TypeError("Can only multiply with another GroupElement")
        if self.group != other.group:
            raise ValueError("Elements must belong to the same group")

        new_value = (self.value * other.value) % self.group.p
        return GroupElement(new_value, self.group)

    def __pow__(self, exponent):
        """Modular exponentiation: g^x mod p."""
        new_value = pow(self.value, exponent, self.group.p)
        return GroupElement(new_value, self.group)

    def __repr__(self):
        return f"{self.value} in {self.group}"

    def __eq__(self, other):
        return isinstance(other, GroupElement) and \
               self.value == other.value and \
               self.group == other.group

    def __int__(self):
        return self.value

    def inverse(self):
        """Return the multiplicative inverse of this element in its group."""
        inv_value = pow(self.value, -1, self.group.p)
        return GroupElement(inv_value, self.group)

def generate_safe_prime(bits: int) -> int:
    """Return a prime p of the form 2q+1 where q is also prime."""
    return 23


# =============================================================================
# Diffie-Hellman Key Exchange Functions
# =============================================================================

import random
from pa8 import dlp_hash


def keygen(G: Group, g: GroupElement | None = None) -> tuple:
    """
    Generate a Diffie-Hellman key pair.
    
    Process:
      1. Use provided generator g, or generate one from the group
      2. Generate random secret x in [1, G.q - 1]
      3. Compute public key h = g^x
      4. Return (g, h, x)
    
    Args:
        G: The Group instance
        g: Optional GroupElement generator (if None, one is generated)
        
    Returns:
        (g, h, x) tuple where:
        - g: GroupElement generator
        - h: GroupElement public key (h = g^x)
        - x: int secret exponent
    """
    if g is None:
        g = G.generator()
    x = random.randint(1, G.q - 1)
    h = g ** x
    return (g, h, x)


def compute_shared(their_public: GroupElement, my_secret: int) -> GroupElement:
    """
    Compute the shared secret given the other party's public key and our secret.
    
    Process:
      - shared = their_public^my_secret
    
    In a full key exchange:
      - Alice has (g, h_a, a) where h_a = g^a
      - Bob has (g, h_b, b) where h_b = g^b
      - Alice computes: h_b^a = (g^b)^a = g^(ab)
      - Bob computes: h_a^b = (g^a)^b = g^(ab)
      - Both get the same shared secret g^(ab)
    
    Args:
        their_public: GroupElement representing the other party's public key
        my_secret: int exponent (the secret exponent)
        
    Returns:
        GroupElement representing the shared secret
    """
    return their_public ** my_secret


def derive_key(shared: GroupElement) -> bytes:
    """
    Derive a cryptographic key from the shared secret.
    
    Process:
      1. Convert shared.value (an integer) to bytes
      2. Hash using dlp_hash to get a derived key
    
    Args:
        shared: GroupElement representing the shared secret
        
    Returns:
        bytes representing the derived key
    """
    # Convert the shared secret value to bytes
    # Use byte length matching the group's prime size
    byte_length = (shared.group.p.bit_length() + 7) // 8
    shared_bytes = shared.value.to_bytes(byte_length, byteorder='big')
    
    # Hash to derive the final key
    key = dlp_hash(shared_bytes)
    
    return key


# =============================================================================
# Test/Demo: Two-party Diffie-Hellman Exchange
# =============================================================================

def test_diffie_hellman():
    """
    Demonstrate Diffie-Hellman key exchange between two parties.
    
    Steps:
      1. Create a group and agree on a generator
      2. Alice generates her key pair using the shared generator
      3. Bob generates his key pair using the shared generator
      4. Alice computes shared secret using Bob's public key
      5. Bob computes shared secret using Alice's public key
      6. Both should derive the same key
    """
    # Create a group (using the toy prime p=23 from generate_safe_prime)
    G = Group(23)
    
    print("=" * 70)
    print("DIFFIE-HELLMAN KEY EXCHANGE DEMO")
    print("=" * 70)
    print(f"Group: {G}\n")
    
    # Both parties agree on a generator
    print(">>> Parties agree on shared generator")
    g = G.generator()
    print(f"  Generator g: {g.value}\n")
    
    # Alice generates her key pair
    print(">>> Alice generates key pair using shared generator")
    g_alice, h_alice, x_alice = keygen(G, g)
    print(f"  Alice's secret x_a: {x_alice}")
    print(f"  Alice's public key h_a = g^x_a: {h_alice.value}\n")
    
    # Bob generates his key pair
    print(">>> Bob generates key pair using shared generator")
    g_bob, h_bob, x_bob = keygen(G, g)
    print(f"  Bob's secret x_b: {x_bob}")
    print(f"  Bob's public key h_b = g^x_b: {h_bob.value}\n")
    
    # Verify they're using the same generator
    assert g_alice == g_bob, "Generators should be the same!"
    print("✓ Both parties use the same generator\n")
    
    # Alice computes shared secret using Bob's public key
    print(">>> Alice computes shared secret: h_b^x_a")
    shared_alice = compute_shared(h_bob, x_alice)
    print(f"  Shared secret (Alice's view): {shared_alice.value}\n")
    
    # Bob computes shared secret using Alice's public key
    print(">>> Bob computes shared secret: h_a^x_b")
    shared_bob = compute_shared(h_alice, x_bob)
    print(f"  Shared secret (Bob's view): {shared_bob.value}\n")
    
    # Verify they match
    assert shared_alice == shared_bob, "Shared secrets should match!"
    print("✓ Both parties computed the SAME shared secret\n")
    print(f"✓ Verification: {shared_alice.value} == {shared_bob.value}")
    print(f"✓ Math check: g^(x_a * x_b) mod p = {pow(g.value, x_alice * x_bob, G.p)}\n")
    
    # Derive keys from the shared secret
    print(">>> Deriving cryptographic keys from shared secret")
    key_alice = derive_key(shared_alice)
    key_bob = derive_key(shared_bob)
    
    print(f"  Alice's derived key (first 16 bytes): {key_alice[:16].hex()}")
    print(f"  Bob's derived key (first 16 bytes):   {key_bob[:16].hex()}\n")
    
    # Verify derived keys match
    assert key_alice == key_bob, "Derived keys should match!"
    print("✓ Both parties derived the SAME cryptographic key")
    print("=" * 70)
    
    return True


if __name__ == "__main__":
    test_diffie_hellman()
    print("\n✓ Diffie-Hellman key exchange test PASSED")
