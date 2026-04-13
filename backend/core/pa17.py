from typing import Tuple, Any

from pa15 import Sign, Verify
from pa16 import Enc, Dec, elgamal_keygen, PublicKey, SecretKey, Message, Ciphertext

class SignatureInvalidError(Exception):
    def __init__(self):
        super().__init__("Invalid signature")

def CCA_PKC_Enc(pk_enc: PublicKey, sk_sign: SecretKey, m: Message) -> Tuple[Ciphertext, Any]:
    C_E = Enc(pk_enc, m)
    sigma = Sign(sk_sign, C_E)
    return (C_E, sigma)

def CCA_PKC_Dec(sk_enc: SecretKey, vk_sign: PublicKey, C_E: Ciphertext, sigma: Any) -> Message:
    if Verify(vk_sign, C_E, sigma):
        return Dec(sk_enc, C_E)
    else:
        raise SignatureInvalidError

def contrast_with_plain_ElGamal(m):
    pk_enc, sk_enc = elgamal_keygen()
    pk_sign, sk_sign = elgamal_keygen()

    C_E, sigma = CCA_PKC_Enc(pk_enc, sk_sign, m)
    m_dec = CCA_PKC_Dec(sk_enc, pk_sign, C_E, sigma)

    return m_dec == m