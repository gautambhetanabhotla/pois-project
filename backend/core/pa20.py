from enum import Enum
from typing import List, Optional, cast

class GateType(Enum):
    """Supported gate types"""
    AND = "AND"
    XOR = "XOR"
    NOT = "NOT"

class Gate:
    def __init__(self, gate_type: GateType, *input_indices: int):
        """
        Initialize a gate.
        
        Args:
            gate_type: Type of gate (AND, XOR, or NOT)
            *input_indices: Wire indices that feed into this gate.
                          - AND/XOR gates require exactly 2 inputs
                          - NOT gate requires exactly 1 input
        """
        self.type = gate_type
        self.input_indices = list(input_indices)
        
        # Validate gate inputs
        if gate_type == GateType.NOT:
            if len(self.input_indices) != 1:
                raise ValueError(f"NOT gate requires exactly 1 input, got {len(self.input_indices)}")
        elif gate_type in (GateType.AND, GateType.XOR):
            if len(self.input_indices) != 2:
                raise ValueError(f"{gate_type.value} gate requires exactly 2 inputs, got {len(self.input_indices)}")
    
    def evaluate(self, wire_values: List[int]) -> int:
        """
        Evaluate this gate given the current wire values.
        
        Args:
            wire_values: List of current values on all wires (0 or 1)
            
        Returns:
            Output of this gate (0 or 1)
        """
        if self.type == GateType.NOT:
            return 1 - wire_values[self.input_indices[0]]
        elif self.type == GateType.AND:
            return wire_values[self.input_indices[0]] & wire_values[self.input_indices[1]]
        elif self.type == GateType.XOR:
            return wire_values[self.input_indices[0]] ^ wire_values[self.input_indices[1]]
        else:
            raise ValueError(f"Unsupported gate type: {self.type}")

class Circuit:
    """
    Represents a boolean function as a directed acyclic graph (DAG) of logic gates.
    
    The circuit maintains wires where:
    - Wires 0 to (num_inputs-1) are input wires
    - Wires num_inputs to (num_inputs + len(gates) - 1) are gate output wires
    - The last gate's output is the circuit output
    """
    
    def __init__(self, num_inputs: int):
        """
        Initialize a circuit with a specified number of inputs.
        
        Args:
            num_inputs: Number of input bits to the circuit
        """
        if num_inputs < 1:
            raise ValueError("Circuit must have at least 1 input")
        
        self.num_inputs = num_inputs
        self.gates: List[Gate] = []
        self.output_indices: List[int] = []
    
    def add_gate(self, gate_type: GateType, *input_indices: int, output: bool = False) -> int:
        """
        Add a gate to the circuit.
        
        Args:
            gate_type: Type of gate (AND, XOR, or NOT)
            *input_indices: Wire indices that feed into this gate
            
        Returns:
            The wire index of this gate's output
            
        Raises:
            ValueError: If input indices are out of range or invalid for the gate type
        """
        gate = Gate(gate_type, *input_indices)
        
        # Validate that input indices refer to valid wires
        num_available_wires = self.num_inputs + len(self.gates)
        for idx in input_indices:
            if not (0 <= idx < num_available_wires):
                raise ValueError(
                    f"Input index {idx} out of range. Available wires: 0 to {num_available_wires - 1}"
                )
        
        self.gates.append(gate)
        output_index = self.num_inputs + len(self.gates) - 1
        if output: 
            self.output_indices.append(output_index)
            print("adding output index", output_index)
        return output_index
    
    def evaluate(self, inputs: List[int]) -> List[int]:
        """
        Evaluate the circuit with the given inputs.
        
        Args:
            inputs: List of input bits (0 or 1) with length matching num_inputs
            
        Returns:
            List of output bits from all gates (or just the final output if requested)
            
        Raises:
            ValueError: If number of inputs doesn't match circuit's num_inputs,
                       or if input values are not 0 or 1
        """
        if len(inputs) != self.num_inputs:
            raise ValueError(
                f"Expected {self.num_inputs} inputs, got {len(inputs)}"
            )
        
        # Validate input values
        for i, val in enumerate(inputs):
            if val not in (0, 1):
                raise ValueError(f"Input {i} has value {val}, expected 0 or 1")
        
        # Initialize wire values with inputs
        wire_values = inputs.copy()
        
        # Evaluate each gate in sequence (DAG evaluation)
        for gate in self.gates:
            output = gate.evaluate(wire_values)
            wire_values.append(output)

        self.wire_values = wire_values
        return wire_values
    
    @property
    def outputs(self) -> List[int]:
        return [self.wire_values[idx] for idx in self.output_indices]
    
    def __repr__(self) -> str:
        """Return a string representation of the circuit."""
        return (
            f"Circuit(inputs={self.num_inputs}, gates={len(self.gates)}, "
            f"total_wires={self.num_inputs + len(self.gates)})"
        )
    
    def generate_graphviz_dot(self, name: str = "circuit") -> str:
        """
        Generate a Graphviz DOT representation of the circuit.
        
        Args:
            name: Name to use for the graph
            
        Returns:
            DOT string representation of the circuit
        """
        dot_lines = [
            "digraph {",
            '    rankdir=LR;',
            '    node [shape=box, style=filled];',
        ]
        
        # Define input nodes
        for i in range(self.num_inputs):
            dot_lines.append(f'    wire_{i} [label="Input {i}", fillcolor=lightblue];')
        
        # Define gate nodes and edges
        for gate_idx, gate in enumerate(self.gates):
            output_wire = self.num_inputs + gate_idx
            gate_id = f"gate_{gate_idx}"
            
            # Set fill color based on gate type
            color_map = {
                GateType.AND: "lightgreen",
                GateType.XOR: "lightyellow",
                GateType.NOT: "lightcoral",
            }
            color = color_map.get(gate.type, "lightgray")
            
            # Add gate node
            dot_lines.append(f'    {gate_id} [label="{gate.type.value}", fillcolor={color}];')
            
            # Add edges from inputs to this gate
            for input_idx in gate.input_indices:
                if input_idx < self.num_inputs:
                    source = f"wire_{input_idx}"
                else:
                    source = f"gate_{input_idx - self.num_inputs}"
                
                dot_lines.append(
                    f'    {source} -> {gate_id} [label="wire={input_idx}"];'
                )
            
            # Add output wire node (only for the final gate as the circuit output)
            if output_wire in self.output_indices:
                # print("Gate index", gate_idx)
                dot_lines.append(f'    wire_{output_wire} [label="Output {output_wire}", fillcolor=lightblue];')
                dot_lines.append(
                    f'    {gate_id} -> wire_{output_wire} [label="wire={output_wire}"];'
                )
        
        dot_lines.append("}")
        return "\n".join(dot_lines)
    
    def visualize(self, filename: str = "circuit", format: str = "png", 
                  directory: Optional[str] = None) -> Optional[str]:
        """
        Visualize the circuit as a graph using Graphviz and save to file.
        
        Args:
            filename: Base name for the output file (without extension)
            format: Output format ("png", "svg", "pdf", etc.)
            directory: Directory to save the file in (default: current directory)
            
        Returns:
            Path to the generated file, or None if graphviz is not available
            
        Raises:
            ImportError: If graphviz is not installed
        """
        
        dot_string = self.generate_graphviz_dot(name=filename)
        
        try:
            import graphviz
            g = graphviz.Source(dot_string, format=format)
            if directory:
                result = g.render(filename, directory=directory, cleanup=True)
            else:
                result = g.render(filename, cleanup=True)
            return result
        except Exception as e:
            raise RuntimeError(f"Failed to render circuit visualization: {e}")

# ============================================================================
# MANDATORY TEST CIRCUITS FOR SECURE COMPUTATION
# ============================================================================

def create_millionaires_problem_circuit(n: int) -> Circuit:
    """
    Millionaire's Problem: Securely compute x > y for n-bit integers.
    
    Alice has x (bits 0 to n-1), Bob has y (bits n to 2n-1).
    Circuit outputs 1 if x > y, 0 otherwise.
    
    Uses ripple comparison: from MSB to LSB, tracks whether we've already
    determined the result based on any bit position.
    
    Args:
        n: Number of bits in each integer
        
    Returns:
        Circuit with 2n inputs (n bits for x, n bits for y) and output wire indices
    """
    if n < 1:
        raise ValueError("n must be at least 1")
    
    circuit = Circuit(num_inputs=2 * n)
    
    # Wires 0 to n-1: bits of x (MSB at index n-1)
    # Wires n to 2n-1: bits of y (MSB at index 2n-1)
    
    # Start with MSB comparison: x[n-1] > y[n-1]
    x_msb = n - 1
    y_msb = 2 * n - 1
    
    # First bit: x[n-1] AND NOT y[n-1]
    not_y_msb = circuit.add_gate(GateType.NOT, y_msb)
    result = circuit.add_gate(GateType.AND, x_msb, not_y_msb)
    
    # Track whether all bits compared so far are equal
    # Initially: NOT(x[n-1] XOR y[n-1])
    xor_msb = circuit.add_gate(GateType.XOR, x_msb, y_msb)
    all_equal_so_far = circuit.add_gate(GateType.NOT, xor_msb)
    
    # For each lower bit position (from n-2 down to 0)
    for i in range(n - 2, -1, -1):
        x_bit = i
        y_bit = n + i
        
        # Current bit comparison: x[i] > y[i] <=> x[i] AND NOT y[i]
        not_y_bit = circuit.add_gate(GateType.NOT, y_bit)
        x_greater_at_i = circuit.add_gate(GateType.AND, x_bit, not_y_bit)
        
        # Condition to update result: all_equal_so_far AND x[i] > y[i]
        can_decide_at_i = circuit.add_gate(GateType.AND, all_equal_so_far, x_greater_at_i)
        
        # result = result OR can_decide_at_i
        # OR via XOR: a OR b = a XOR b XOR (a AND b)
        result_xor = circuit.add_gate(GateType.XOR, result, can_decide_at_i)
        result_and = circuit.add_gate(GateType.AND, result, can_decide_at_i)
        result = circuit.add_gate(GateType.XOR, result_xor, result_and)
        
        # Update all_equal_so_far for the next iteration
        # all_equal_so_far = all_equal_so_far AND NOT(x[i] XOR y[i])
        xor_bit = circuit.add_gate(GateType.XOR, x_bit, y_bit)
        not_xor_bit = circuit.add_gate(GateType.NOT, xor_bit)
        all_equal_so_far = circuit.add_gate(GateType.AND, all_equal_so_far, not_xor_bit, output=(i == 0))
    
    return circuit


def create_equality_test_circuit(n: int) -> Circuit:
    """
    Secure Equality Test: Securely compute x = y for n-bit integers.
    
    Alice has x (bits 0 to n-1), Bob has y (bits n to 2n-1).
    Circuit outputs 1 if x = y, 0 otherwise.
    
    Algorithm: Compute XNOR for each bit pair, then AND all results together.
    
    Args:
        n: Number of bits in each integer
        
    Returns:
        Circuit with 2n inputs (n bits for x, n bits for y) and output wire index
    """
    if n < 1:
        raise ValueError("n must be at least 1")
    
    circuit = Circuit(num_inputs=2 * n)
    
    # Wires 0 to n-1: bits of x
    # Wires n to 2n-1: bits of y
    
    # Compute XNOR (equality) for each bit: NOT(x[i] XOR y[i])
    all_equal = None
    
    for i in range(n):
        x_bit = i
        y_bit = n + i
        
        # Compute x[i] XOR y[i]
        xor_bit = circuit.add_gate(GateType.XOR, x_bit, y_bit)
        
        # Compute XNOR: NOT(x[i] XOR y[i])
        equal_bit = circuit.add_gate(GateType.NOT, xor_bit)
        
        # AND with accumulated result
        if all_equal is None:
            all_equal = equal_bit
        else:
            all_equal = circuit.add_gate(GateType.AND, all_equal, equal_bit, output=(i == n - 1))
    
    return circuit


def create_bit_addition_circuit(n: int) -> Circuit:
    """
    Secure Bit-Addition: Securely compute x + y (mod 2^n) for n-bit integers.
    
    Alice has x (bits 0 to n-1), Bob has y (bits n to 2n-1).
    Circuit outputs sum bits: sum[0], sum[1], ..., sum[n-1] (LSB first).
    The final carry is discarded (modulo 2^n).
    
    Uses standard ripple carry adder:
    sum[i] = x[i] XOR y[i] XOR carry[i-1]
    carry[i] = (x[i] AND y[i]) OR (carry[i-1] AND (x[i] XOR y[i]))
    
    Args:
        n: Number of bits in each integer
        
    Returns:
        Circuit with 2n inputs and n output wires (sum bits in order)
    """
    if n < 1:
        raise ValueError("n must be at least 1")
    
    circuit = Circuit(num_inputs=2 * n)
    
    # Wires 0 to n-1: bits of x (LSB at index 0)
    # Wires n to 2n-1: bits of y (LSB at index n)
    carry = 0
    
    for i in range(n):
        x_bit = i
        y_bit = n + i
        
        # XOR of x[i] and y[i]
        x_xor_y = circuit.add_gate(GateType.XOR, x_bit, y_bit, output=(i == 0))
        
        if i == 0:
            # First bit: no carry in
            # sum[0] = x[0] XOR y[0]
            # carry[0] = x[0] AND y[0]
            carry = circuit.add_gate(GateType.AND, x_bit, y_bit)
        else:
            # sum[i] = x[i] XOR y[i] XOR carry[i-1]
            circuit.add_gate(GateType.XOR, x_xor_y, carry, output=True)
            
            # carry[i] = (x[i] AND y[i]) OR (carry[i-1] AND (x[i] XOR y[i]))
            # = (x[i] AND y[i]) OR (carry[i-1] AND x_xor_y)
            x_and_y = circuit.add_gate(GateType.AND, x_bit, y_bit)
            carry_and_xor = circuit.add_gate(GateType.AND, carry, x_xor_y)
            
            # OR via XOR: a OR b = a XOR b XOR (a AND b)
            carry_xor = circuit.add_gate(GateType.XOR, x_and_y, carry_and_xor)
            carry_and = circuit.add_gate(GateType.AND, x_and_y, carry_and_xor)
            carry = circuit.add_gate(GateType.XOR, carry_xor, carry_and)
    
    return circuit


# Example usage and test cases
if __name__ == "__main__":
    print("=" * 70)
    print("SECURE COMPUTATION CIRCUITS")
    print("=" * 70)
    print()
    
    # Test 1: Millionaire's Problem (x > y)
    print("TEST 1: MILLIONAIRE'S PROBLEM (x > y)")
    print("-" * 70)
    n = 2  # 2-bit numbers
    circuit = create_millionaires_problem_circuit(n)
    circuit.visualize("millionaires_problem_circuit", format="svg")
    print(f"Circuit for {n}-bit comparison:")
    print(f"  Total inputs: {circuit.num_inputs} (2n={2*n})")
    print(f"  Total gates: {len(circuit.gates)}")
    print()
    
    # Test cases: x = [x1, x0] (MSB first conceptually, but LSB at index 0)
    # Wires 0,1 = x bits; Wires 2,3 = y bits
    # x=3 (binary 11), y=1 (binary 01): 3 > 1? YES
    # Inputs: [1, 1, 1, 0] means x[0]=1, x[1]=1, y[0]=1, y[1]=0 -> x=0b11=3, y=0b01=1
    test_cases = [
        ([1, 1, 1, 0], 1, "x=3 > y=1"),  # 3 > 1 = True
        ([0, 1, 1, 1], 0, "x=2 > y=3"),  # 2 > 3 = False
        ([1, 0, 1, 0], 1, "x=1 > y=1"),  # 1 > 1 = False... wait this should be 0
    ]
    # Let me recalculate: LSB at index 0
    # x[0]=1, x[1]=1 => x = 1*2^0 + 1*2^1 = 3
    # y[0]=1, y[1]=0 => y = 1*2^0 + 0*2^1 = 1
    # So [1,1,1,0] gives 3 > 1 = True ✓
    # y[0]=1, y[1]=1 => y = 1*2^0 + 1*2^1 = 3
    # So [1,0,1,1] gives 2 > 3 = False ✓
    # x[0]=1, x[1]=0 => x = 1*2^0 + 0*2^1 = 1
    # y[0]=1, y[1]=0 => y = 1*2^0 + 0*2^1 = 1
    # So [1,0,1,0] gives 1 > 1 = False ✓
    test_cases = [
        ([1, 1, 1, 0], 1, "x=3 > y=1"),
        ([0, 1, 1, 1], 0, "x=2 > y=3"),
        ([1, 0, 1, 0], 0, "x=1 > y=1"),
        ([0, 1, 0, 0], 1, "x=2 > y=0"),
    ]
    
    for inputs, expected, description in test_cases:
        circuit.evaluate(inputs)
        output = circuit.outputs
        status = "✓" if output == expected else "✗"
        print(f"  {status} {description}: output={output} (expected {expected})")
    print()
    
    # Test 2: Equality Test (x = y)
    print("TEST 2: EQUALITY TEST (x = y)")
    print("-" * 70)
    circuit = create_equality_test_circuit(n)
    circuit.visualize("equality_test_circuit", format="svg")
    print(f"Circuit for {n}-bit equality test:")
    print(f"  Total inputs: {circuit.num_inputs} (2n={2*n})")
    print(f"  Total gates: {len(circuit.gates)}")
    print()
    
    test_cases = [
        ([1, 1, 1, 1], 1, "x=3 = y=3"),
        ([1, 0, 0, 1], 0, "x=1 ≠ y=2"),
        ([0, 0, 0, 0], 1, "x=0 = y=0"),
        ([1, 0, 1, 0], 1, "x=1 = y=1"),
    ]
    
    for inputs, expected, description in test_cases:
        circuit.evaluate(inputs)
        output = circuit.outputs
        status = "✓" if output == expected else "✗"
        print(f"  {status} {description}: output={output} (expected {expected})")
    print()
    
    # Test 3: Bit-Addition (x + y mod 2^n)
    print("TEST 3: BIT-ADDITION (x + y mod 2^n)")
    print("-" * 70)
    circuit = create_bit_addition_circuit(n)
    circuit.visualize("bit_addition_circuit", format="svg")
    print(f"Circuit for {n}-bit addition:")
    print(f"  Total inputs: {circuit.num_inputs} (2n={2*n})")
    print(f"  Total gates: {len(circuit.gates)}")
    print()
    
    # For addition, we need to extract the sum outputs
    # Sum bits are at indices 2n to 2n+n-1 in the wire_values
    test_cases = [
        ([1, 0, 1, 0], [0, 1], "1 + 1 = 2"),
        ([1, 1, 1, 0], [0, 0], "3 + 1 = 4 (mod 4) = 0"),
        ([0, 0, 0, 0], [0, 0], "0 + 0 = 0"),
        ([1, 0, 0, 1], [1, 1], "1 + 2 = 3"),
    ]
    
    for inputs, expected_sum, description in test_cases:
        circuit.evaluate(inputs)
        # Extract the n sum bits (starting at index 2n)
        sum_bits = circuit.outputs
        status = "✓" if sum_bits == expected_sum else "✗"
        print(f"  {status} {description}: sum={sum_bits} (expected {expected_sum})")
    print()
