from typing import Literal, Tuple, cast
import logging

from pa16 import Ciphertext, Enc, Dec, PublicKey, SecretKey, elgamal_keygen, Message
from pa11 import Group

OT_calls = 0 # Number of OT calls made
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

Bit = Literal[0, 1]

def OT_Receiver_Step1(b: Bit, G: Group) -> Tuple[Tuple[PublicKey, PublicKey], SecretKey]:
    pk0, sk0 = elgamal_keygen(G)
    pk1, sk1 = elgamal_keygen(G)
    logger.info(f"OT_Receiver_Step1: pk0={pk0}, pk1={pk1}")
    return (pk0, pk1), sk0 if b == 0 else sk1

def OT_Sender_Step(
        pk: Tuple[PublicKey, PublicKey],
        m: Tuple[Message, Message]
    ) -> Tuple[Ciphertext, Ciphertext]:
    c0 = Enc(pk[0], m[0])
    c1 = Enc(pk[1], m[1])
    logger.info(f"OT_Sender_Step: c0={c0}, c1={c1}")
    return (c0, c1)

def OT_Receiver_Step2(
        b: Bit,
        c: Tuple[Ciphertext, Ciphertext],
        sk: SecretKey
    ) -> Message:
    message = Dec(sk, c[b])
    logger.info(f"OT_Receiver_Step2: choice={b}, message={message}")
    return message

def OT(choice: Bit, m: Tuple[int, int]) -> Message:
    global OT_calls
    logger.info(f"OT #{OT_calls + 1}")
    OT_calls += 1
    G = Group.from_safe_prime(16)
    pk, sk = OT_Receiver_Step1(choice, G)
    c = OT_Sender_Step(pk, (G(m[0]), G(m[1])))
    return OT_Receiver_Step2(choice, c, sk)
    # return m[choice]
