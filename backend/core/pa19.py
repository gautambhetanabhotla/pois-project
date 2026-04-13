from typing import Literal, cast

from pa11 import Group
from pa18 import OT_Receiver_Step1, OT_Sender_Step, OT_Receiver_Step2

def SecureAND(a: Literal[0, 1], b: Literal[0, 1]) -> Literal[0, 1]:
    """Return a AND b without revealing a or b."""
    G = Group.from_safe_prime(16)
    pk, sk = OT_Receiver_Step1(b, G)
    c = OT_Sender_Step(pk, (G(0), G(a)))
    return cast(Literal[0, 1], OT_Receiver_Step2(b, c, sk).value)

def SecureXOR(a: Literal[0, 1], b: Literal[0, 1]) -> Literal[0, 1]:
    """Return a XOR b without revealing a or b."""
    import random
    r = random.randint(0, 1)
    alice_share = a ^ r
    bob_share = b ^ r
    return cast(Literal[0, 1], alice_share ^ bob_share)

def SecureNOT(a: Literal[0, 1]) -> Literal[0, 1]:
    """Return NOT a without revealing a."""
    return cast(Literal[0, 1], a ^ 1)