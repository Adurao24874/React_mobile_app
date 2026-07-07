import wave
import os

path = r"c:\Users\adars\OneDrive\Desktop\Mobapp\grip\public\silent.wav"
with wave.open(path, 'w') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(44100)
    f.writeframes(b'\x00' * 44100 * 2)

print("Created silent.wav")
