class Group:
    """Represents the multiplicative group Zp*."""
    def __init__(self, p):
        self.p = p
        self.q = (p-1) // 2

    def __call__(self, value):
        """Helper to create elements: G(5) instead of GroupElement(5, G)."""
        return GroupElement(value % self.p, self)

    def __repr__(self):
        return f"Multiplicative Group Z_p* with p={self.p}, q={self.q}"

    def random(self):
        """Generate a random group element."""
        import random
        return self(random.randint(1, self.p - 1))

    def generator(self):
        """Return a a generator of the subgroup of order q."""
        while True:
            import random
            a = random.randint(2, self.p - 1)
            # Squaring an element in Zp* puts it in the subgroup of order q
            g_val = pow(a, 2, self.p)

            if g_val != 1:
                # Because q is prime, any element != 1 in the 
                # subgroup of squares is a generator.
                return GroupElement(g_val, self)


class GroupElement:
    def __init__(self, value: int, group: Group):
        self.group = group
        self.value = value % group.p

    def __mul__(self, other):
        if not isinstance(other, GroupElement):
            raise TypeError("Can only multiply with another GroupElement")
        if self.group != other.group:
            raise ValueError("Elements must belong to the same group")

        new_value = (self.value * other.value) % self.group.p
        return GroupElement(new_value, self.group)

    def __pow__(self, exponent):
        """Modular exponentiation: g^x mod p."""
        new_value = pow(self.value, exponent, self.group.p)
        return GroupElement(new_value, self.group)

    def __repr__(self):
        return f"{self.value} in {self.group}"

    def __eq__(self, other):
        return isinstance(other, GroupElement) and \
               self.value == other.value and \
               self.group == other.group

    def inverse(self):
        """Return the multiplicative inverse of this element in its group."""
        inv_value = pow(self.value, -1, self.group.p)
        return GroupElement(inv_value, self.group)

def generate_safe_prime(bits: int) -> int:
    """Return a prime p of the form 2q+1 where q is also prime."""
    return 23
