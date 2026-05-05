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


# ===========================================================================
# Tests
# ===========================================================================

import unittest

class TestOTProtocolSteps(unittest.TestCase):
    """Tests for the individual OT protocol steps."""

    def setUp(self):
        self.G = Group.from_safe_prime(16)

    def test_receiver_step1_returns_two_public_keys_and_one_secret_key(self):
        (pk0, pk1), sk = OT_Receiver_Step1(0, self.G)
        self.assertIsInstance(pk0, PublicKey)
        self.assertIsInstance(pk1, PublicKey)
        self.assertIsInstance(sk, SecretKey)

    def test_receiver_step1_choice_0_returns_sk_for_pk0(self):
        """For choice=0 the receiver keeps sk0, so decrypting c0 should recover m0."""
        m0 = self.G(3)
        m1 = self.G(7)
        (pk0, pk1), sk = OT_Receiver_Step1(0, self.G)
        c = OT_Sender_Step((pk0, pk1), (m0, m1))
        result = OT_Receiver_Step2(0, c, sk)
        self.assertEqual(result, m0)

    def test_receiver_step1_choice_1_returns_sk_for_pk1(self):
        """For choice=1 the receiver keeps sk1, so decrypting c1 should recover m1."""
        m0 = self.G(3)
        m1 = self.G(7)
        (pk0, pk1), sk = OT_Receiver_Step1(1, self.G)
        c = OT_Sender_Step((pk0, pk1), (m0, m1))
        result = OT_Receiver_Step2(1, c, sk)
        self.assertEqual(result, m1)


class TestOTEndToEnd(unittest.TestCase):
    """Tests for the combined OT() convenience function."""

    def test_ot_choice_0_returns_m0(self):
        result = OT(0, (42, 99))
        self.assertEqual(result.value, 42)

    def test_ot_choice_1_returns_m1(self):
        result = OT(1, (42, 99))
        self.assertEqual(result.value, 99)

    def test_ot_does_not_reveal_unchosen_message(self):
        """The returned value must equal the chosen message only."""
        result0 = OT(0, (5, 10))
        self.assertEqual(result0.value, 5)
        self.assertNotEqual(result0.value, 10)

        result1 = OT(1, (5, 10))
        self.assertEqual(result1.value, 10)
        self.assertNotEqual(result1.value, 5)

    def test_ot_increments_call_counter(self):
        before = OT_calls
        OT(0, (1, 2))
        OT(1, (1, 2))
        self.assertEqual(OT_calls, before + 2)


if __name__ == "__main__":
    unittest.main()
