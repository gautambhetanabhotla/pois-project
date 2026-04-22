from __future__ import annotations

import os
import sys
import unittest
from typing import Callable, Tuple

from pa2 import F, BLOCK_SIZE


# 1. CORE CPA-SECURE ENCRYPTION (CTR mode over PRF F)

def _xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))


def _keystream(k: bytes, r: bytes, n_blocks: int) -> bytes:
    """F_k(r) || F_k(r+1) || ... || F_k(r+n_blocks-1)."""
    r_int = int.from_bytes(r, "big")
    mod = 1 << (BLOCK_SIZE * 8)
    out = bytearray()
    for i in range(n_blocks):
        ctr_block = ((r_int + i) % mod).to_bytes(BLOCK_SIZE, "big")
        out.extend(F(k, ctr_block))
    return bytes(out)


def Enc(k: bytes, m: bytes) -> Tuple[bytes, bytes]:
    """
    CPA-secure encryption: returns (r, c) where r is a fresh random nonce.

    r is exposed as the first half of the ciphertext so that Dec can
    reconstruct the PRF inputs -- exactly the textbook (r, m XOR F_k(r))
    construction, generalised to multi-block messages via counter mode.
    """
    if len(k) != BLOCK_SIZE:
        raise ValueError(f"key must be {BLOCK_SIZE} bytes")
    r = os.urandom(BLOCK_SIZE)
    n_blocks = max(1, (len(m) + BLOCK_SIZE - 1) // BLOCK_SIZE)
    stream = _keystream(k, r, n_blocks)
    c = _xor_bytes(m, stream[: len(m)])
    return r, c


def Dec(k: bytes, r: bytes, c: bytes) -> bytes:
    """Inverse of Enc: recompute keystream and XOR back."""
    if len(k) != BLOCK_SIZE:
        raise ValueError(f"key must be {BLOCK_SIZE} bytes")
    if len(r) != BLOCK_SIZE:
        raise ValueError(f"nonce r must be {BLOCK_SIZE} bytes")
    n_blocks = max(1, (len(c) + BLOCK_SIZE - 1) // BLOCK_SIZE)
    stream = _keystream(k, r, n_blocks)
    return _xor_bytes(c, stream[: len(c)])


# 2. DELIBERATELY BROKEN: FIXED-NONCE ENCRYPTION
# This exists purely so the CPA-game demo can show the attack. Never use.

_BROKEN_FIXED_R = b"\x00" * BLOCK_SIZE


def Enc_broken(k: bytes, m: bytes) -> Tuple[bytes, bytes]:
    """Broken variant: reuses a fixed nonce. Breaks IND-CPA."""
    r = _BROKEN_FIXED_R
    n_blocks = max(1, (len(m) + BLOCK_SIZE - 1) // BLOCK_SIZE)
    stream = _keystream(k, r, n_blocks)
    return r, _xor_bytes(m, stream[: len(m)])


# 3. IND-CPA GAME SIMULATION
# Standard left-or-right game:
#   1. Key k sampled; adversary A is given an encryption oracle.
#   2. A submits a query history, then two equal-length challenge messages
#      (m0, m1); challenger picks b <- {0,1} and returns Enc(k, m_b).
#   3. A outputs b'; advantage = |Pr[b' = b] - 1/2|.
#
# Our adversary strategy: pick m0 = "A"*n and m1 = "B"*n, query the oracle
# once on m0 (getting (r_0, c_0)), then at challenge time look at whether
# the returned ciphertext equals the already-seen one (possible only if the
# nonce collided). For secure Enc this is noise; for Enc_broken the fixed
# nonce forces c_0 == c_challenge whenever m_challenge == m0, so guess
# trivially.

def cpa_game(enc_func: Callable[[bytes, bytes], Tuple[bytes, bytes]],
             rounds: int = 50, msg_len: int = 32) -> float:
    """Return the adversary's empirical advantage over `rounds` trials."""
    m0 = b"A" * msg_len
    m1 = b"B" * msg_len
    wins = 0

    for _ in range(rounds):
        k = os.urandom(BLOCK_SIZE)
        # Oracle query on m0 -- the adversary remembers the ciphertext.
        r_oracle, c_oracle = enc_func(k, m0)
        # Challenger flips b and encrypts m_b.
        b = os.urandom(1)[0] & 1
        _, c_challenge = enc_func(k, m0 if b == 0 else m1)
        # Adversary: if the challenge ciphertext equals c_oracle, guess b=0;
        # otherwise guess b=1. Works perfectly against fixed-nonce Enc.
        guess = 0 if c_challenge == c_oracle else 1
        if guess == b:
            wins += 1

    p_correct = wins / rounds
    return abs(p_correct - 0.5)


# 4. DEMOS AND UNIT TESTS

def _demo() -> None:
    print("=== PA #3 -- CPA-secure symmetric encryption ===\n")

    k = os.urandom(BLOCK_SIZE)

    print("--- (1) Enc / Dec roundtrip over varied message sizes ---")
    for msg in [b"hi", b"A" * BLOCK_SIZE, b"multi-block message of some length " * 2]:
        r, c = Enc(k, msg)
        back = Dec(k, r, c)
        print(f"|m|={len(msg):3d}  r={r.hex()[:12]}...  c={c[:8].hex()}...  "
              f"roundtrip_ok={back == msg}")

    print("\n--- (2) Fresh-nonce Enc: distinct ciphertexts for same plaintext ---")
    _, c1 = Enc(k, b"same plaintext")
    _, c2 = Enc(k, b"same plaintext")
    print(f"c1 == c2?  {c1 == c2}   (should be False -- fresh r each call)")

    print("\n--- (3) Broken fixed-nonce Enc: ciphertexts collide trivially ---")
    _, c1b = Enc_broken(k, b"same plaintext")
    _, c2b = Enc_broken(k, b"same plaintext")
    print(f"c1 == c2?  {c1b == c2b}  (True: attacker distinguishes instantly)")

    print("\n--- (4) IND-CPA game (50 rounds) ---")
    adv_secure = cpa_game(Enc, rounds=50)
    adv_broken = cpa_game(Enc_broken, rounds=50)
    print(f"Secure Enc  advantage: {adv_secure:.3f}  (expected ~0)")
    print(f"Broken Enc  advantage: {adv_broken:.3f}  (expected ~0.5)")


class TestPA3(unittest.TestCase):
    def setUp(self):
        self.k = os.urandom(BLOCK_SIZE)

    def test_roundtrip_short_message(self):
        m = b"hi"
        r, c = Enc(self.k, m)
        self.assertEqual(Dec(self.k, r, c), m)

    def test_roundtrip_exact_block(self):
        m = os.urandom(BLOCK_SIZE)
        r, c = Enc(self.k, m)
        self.assertEqual(Dec(self.k, r, c), m)

    def test_roundtrip_multi_block(self):
        m = os.urandom(5 * BLOCK_SIZE + 7)
        r, c = Enc(self.k, m)
        self.assertEqual(Dec(self.k, r, c), m)

    def test_ciphertext_length(self):
        for n in (1, 16, 33, 100):
            r, c = Enc(self.k, b"x" * n)
            self.assertEqual(len(r), BLOCK_SIZE)
            self.assertEqual(len(c), n)

    def test_fresh_nonce_prevents_equal_ciphertexts(self):
        m = b"same plaintext, different ciphertexts"
        _, c1 = Enc(self.k, m)
        _, c2 = Enc(self.k, m)
        self.assertNotEqual(c1, c2)

    def test_broken_enc_collides(self):
        _, c1 = Enc_broken(self.k, b"same")
        _, c2 = Enc_broken(self.k, b"same")
        self.assertEqual(c1, c2)

    def test_broken_roundtrip_still_works(self):
        m = b"broken but deterministic"
        r, c = Enc_broken(self.k, m)
        self.assertEqual(Dec(self.k, r, c), m)

    def test_cpa_game_secure_small_advantage(self):
        adv = cpa_game(Enc, rounds=40)
        # Fresh-nonce Enc: adversary ~ random guesser, |adv| < 0.25 on 40 rounds.
        self.assertLess(adv, 0.3)

    def test_cpa_game_broken_full_advantage(self):
        adv = cpa_game(Enc_broken, rounds=40)
        # Broken Enc: adversary wins every round ==> |adv| == 0.5.
        self.assertGreater(adv, 0.4)

    def test_wrong_key_gives_different_plaintext(self):
        m = b"A" * 32
        r, c = Enc(self.k, m)
        other_k = os.urandom(BLOCK_SIZE)
        self.assertNotEqual(Dec(other_k, r, c), m)


if __name__ == "__main__":
    _demo()
    print("\n--- Running unit tests ---")
    sys.argv = [sys.argv[0]]
    unittest.main(verbosity=2)
