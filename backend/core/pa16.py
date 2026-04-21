from dataclasses import dataclass
from typing import Tuple

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

# class PublicKey:
#     def __init__(self, G: Group, q: int, g: GroupElement, h: GroupElement):
#         self.G = G
#         self.q = q
#         self.g = g
#         self.h = h

# class SecretKey:
#     def __init__(self, G: Group, g: GroupElement, x: int):
#         self.G = G
#         self.g = g
#         self.x = x

Ciphertext = Tuple[GroupElement, GroupElement]
Message = GroupElement

def elgamal_keygen(G: Group) -> Tuple[PublicKey, SecretKey]:
    pass

def Enc(pk: PublicKey, m: Message) -> Ciphertext:
    pass

def Dec(sk: SecretKey, c: Ciphertext) -> Message:
    pass