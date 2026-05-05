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