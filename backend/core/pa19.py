import os
import sys
from contextlib import contextmanager
from typing import Literal, cast

from pa18 import OT

Bit = Literal[0, 1]
PROJECT_ROOT = os.path.dirname(__file__)

@contextmanager
def trace_user_calls(root: str):
    depth = 0

    def profiler(frame, event, arg):
        nonlocal depth
        filename = os.path.abspath(frame.f_code.co_filename)

        if not filename.startswith(os.path.abspath(root)):
            return profiler

        if event == "call":
            print(f"{'  ' * depth}-> {frame.f_code.co_name} ({filename})")
            depth += 1
        elif event == "return":
            depth = max(depth - 1, 0)

        return profiler

    old_profiler = sys.getprofile()
    sys.setprofile(profiler)
    try:
        yield
    finally:
        sys.setprofile(old_profiler)

def SecureAND(a: Bit, b: Bit) -> Bit:
    return cast(Bit, int(OT(a, (0, b))))

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


# ===========================================================================
# Tests
# ===========================================================================

import unittest

class TestSecureAND(unittest.TestCase):
    """Truth-table tests for SecureAND."""

    def test_0_and_0(self):
        self.assertEqual(SecureAND(0, 0), 0)

    def test_0_and_1(self):
        self.assertEqual(SecureAND(0, 1), 0)

    def test_1_and_0(self):
        self.assertEqual(SecureAND(1, 0), 0)

    def test_1_and_1(self):
        self.assertEqual(SecureAND(1, 1), 1)

    def test_return_type_is_int(self):
        result = SecureAND(1, 1)
        self.assertIn(result, (0, 1))


class TestSecureXOR(unittest.TestCase):
    """Truth-table tests for SecureXOR."""

    def test_0_xor_0(self):
        self.assertEqual(SecureXOR(0, 0), 0)

    def test_0_xor_1(self):
        self.assertEqual(SecureXOR(0, 1), 1)

    def test_1_xor_0(self):
        self.assertEqual(SecureXOR(1, 0), 1)

    def test_1_xor_1(self):
        self.assertEqual(SecureXOR(1, 1), 0)

    def test_idempotent_with_itself(self):
        """a XOR a should always be 0."""
        self.assertEqual(SecureXOR(0, 0), 0)
        self.assertEqual(SecureXOR(1, 1), 0)

    def test_return_type_is_int(self):
        result = SecureXOR(0, 1)
        self.assertIn(result, (0, 1))


class TestSecureNOT(unittest.TestCase):
    """Tests for SecureNOT."""

    def test_not_0(self):
        self.assertEqual(SecureNOT(0), 1)

    def test_not_1(self):
        self.assertEqual(SecureNOT(1), 0)

    def test_double_negation(self):
        """NOT(NOT(a)) == a for both bits."""
        self.assertEqual(SecureNOT(SecureNOT(0)), 0)
        self.assertEqual(SecureNOT(SecureNOT(1)), 1)


class TestSecureGateCompositions(unittest.TestCase):
    """Tests for composed gate expressions."""

    def test_nand(self):
        """NAND(a, b) == NOT(AND(a, b))."""
        for a in (0, 1):
            for b in (0, 1):
                self.assertEqual(
                    SecureNOT(SecureAND(a, b)),
                    int(not (a and b)),
                )

    def test_xnor(self):
        """XNOR(a, b) == NOT(XOR(a, b))."""
        for a in (0, 1):
            for b in (0, 1):
                self.assertEqual(
                    SecureNOT(SecureXOR(a, b)),
                    int(not (a ^ b)),
                )

    def test_and_with_not(self):
        """a AND (NOT a) == 0 (contradiction)."""
        for a in (0, 1):
            self.assertEqual(SecureAND(a, SecureNOT(a)), 0)


if __name__ == "__main__":
    unittest.main()