
import os

file_path = 'pages/CandidateList.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

line = lines[26] # Line 27 is index 26
print(f"Original Line 27: {line.strip()}")

# Inspect characters
print("Chars:")
for c in line:
    if ord(c) > 127:
        try:
            enc = c.encode('cp1252')
            print(f"  '{c}' (U+{ord(c):04X}) -> CP1252 {enc.hex()}")
        except Exception as e:
            print(f"  '{c}' (U+{ord(c):04X}) -> CP1252 ERROR: {e}")

try:
    encoded = line.encode('cp1252')
    print(f"Full Encode Success: {encoded.hex()[:50]}...")
    decoded = encoded.decode('utf-8')
    print(f"Decoded: {decoded.strip()}")
    if decoded != line:
        print("FIX DETECTED!")
    else:
        print("NO CHANGE DETECTED (decoded == original)")
except Exception as e:
    print(f"Full Encode/Decode Error: {e}")
