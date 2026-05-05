from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/api/hello")
async def hello():
    return {"message": "Hello from API"}

@app.get("/api/pa20")
async def pa20(circuit: str, input0: int, input1: int):
    from core.pa20 import int_to_bits, Secure_Eval
    if circuit == "millionaire":
        from core.pa20 import millionaires_problem_circuit
        result = Secure_Eval(millionaires_problem_circuit(8), int_to_bits(input0, 16), int_to_bits(input1, 16))
        return {"result": result[0]}
    elif circuit == ""