from typing import Literal, cast

from pa11 import Group
from pa18 import OT

Bit = Literal[0, 1]

def SecureAND(a: Bit, b: Bit) -> Bit:
    """Return a AND b without revealing a or b."""
    return cast(Bit, OT(a, (0, b)))

def SecureXOR(a: Bit, b: Bit) -> Bit:
    """Return a XOR b without revealing a or b."""
    import random
    r = random.randint(0, 1)
    alice_share = a ^ r
    bob_share = b ^ r
    return cast(Bit, alice_share ^ bob_share)

def SecureNOT(a: Bit) -> Bit:
    """Return NOT a without revealing a."""
    return cast(Bit, a ^ 1)