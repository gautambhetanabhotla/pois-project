from pa16 import Enc, Dec, elgamal_keygen

def OT_Receiver_Step1(b):
    pkb, skb = elgamal_keygen()
    pk = 