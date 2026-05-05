from typing import Tuple, Any

from pa11 import Group
from pa16 import Enc, Dec, elgamal_keygen, PublicKey, SecretKey, Message, Ciphertext, Sign, Verify, Signature

class SignatureInvalidError(Exception):
    def __init__(self):
        super().__init__("Invalid signature")

def _serialize_ciphertext(c: Ciphertext) -> bytes:
    length = (c[0].group.p.bit_length() + 7) // 8
    return c[0].value.to_bytes(length, 'big') + c[1].value.to_bytes(length, 'big')

def CCA_PKC_Enc(pk_enc: PublicKey, sk_sign: SecretKey, m: Message) -> Tuple[Ciphertext, Signature]:
    C_E = Enc(pk_enc, m)
    C_E_bytes = _serialize_ciphertext(C_E)
    sigma = Sign(pk_enc, sk_sign, C_E_bytes) # pk_enc isn't the right key for signing, we need pk_sign!
    return (C_E, sigma)

def CCA_PKC_Dec(sk_enc: SecretKey, vk_sign: PublicKey, C_E: Ciphertext, sigma: Signature) -> Message:
    C_E_bytes = _serialize_ciphertext(C_E)
    if Verify(vk_sign, C_E_bytes, sigma):
        return Dec(sk_enc, C_E)
    else:
        raise SignatureInvalidError

def contrast_with_plain_ElGamal(m: Message, G: Group):
    pk_enc, sk_enc = elgamal_keygen(G)
    pk_sign, sk_sign = elgamal_keygen(G)

    # Need to pass pk_sign to CCA_PKC_Enc since Sign needs the public key to compute p etc.
    C_E, sigma = _CCA_PKC_Enc_fixed(pk_enc, pk_sign, sk_sign, m)
    m_dec = CCA_PKC_Dec(sk_enc, pk_sign, C_E, sigma)

    return m_dec == m

def _CCA_PKC_Enc_fixed(pk_enc: PublicKey, pk_sign: PublicKey, sk_sign: SecretKey, m: Message) -> Tuple[Ciphertext, Signature]:
    C_E = Enc(pk_enc, m)
    C_E_bytes = _serialize_ciphertext(C_E)
    sigma = Sign(pk_sign, sk_sign, C_E_bytes)
    return (C_E, sigma)