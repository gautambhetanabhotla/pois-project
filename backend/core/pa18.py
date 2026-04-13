from typing import Literal, List, Any, Tuple

from pa16 import Ciphertext, Enc, Dec, PublicKey, SecretKey, elgamal_keygen, Message
from pa11 import Group, GroupElement, generate_safe_prime

p = generate_safe_prime(16)
group = Group(p)

def OT_Receiver_Step1(b: Literal[0, 1]) -> Tuple[Tuple[PublicKey, PublicKey], SecretKey]:
    pk0, sk0 = elgamal_keygen()
    pk1, sk1 = elgamal_keygen()
    return (pk0, pk1), sk0 if b == 0 else sk1

def OT_Sender_Step(pk: Tuple[PublicKey, PublicKey], m: Tuple[Message, Message]) -> Tuple[Ciphertext, Ciphertext]:
    c0 = Enc(pk[0], m[0])
    c1 = Enc(pk[1], m[1])
    return (c0, c1)

def OT_Receiver_Step2(
        b: Literal[0, 1],
        c: Tuple[Ciphertext, Ciphertext],
        sk: SecretKey
    ) -> Message:
    return Dec(sk, c[b])