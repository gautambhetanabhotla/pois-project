from dataclasses import dataclass
from typing import Tuple

from pa11 import Group, GroupElement

class PublicKey:
    def __init__(self, G: Group, q: int, g: GroupElement, h: GroupElement):
        self.G = G
        self.q = q
        self.g = g
        self.h = h

SecretKey = int
Ciphertext = Tuple[GroupElement, GroupElement]
Message = GroupElement

def elgamal_keygen() -> Tuple[PublicKey, SecretKey]:
    pass

def Enc(pk: PublicKey, m: Message) -> Ciphertext:
    pass

def Dec(sk: SecretKey, c: Ciphertext) -> Message:
    pass