from typing import Literal, cast

from pa11 import Group
from pa18 import OT_Receiver_Step1, OT_Sender_Step, OT_Receiver_Step2

Bit = Literal[0, 1]

def SecureAND(a: Bit, b: Bit) -> Bit:
    """Return a AND b without revealing a or b."""
    G = Group.from_safe_prime(16)
    pk, sk = OT_Receiver_Step1(b, G)
    c = OT_Sender_Step(pk, (G(0), G(a)))
    return cast(Bit, OT_Receiver_Step2(b, c, sk).value)

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