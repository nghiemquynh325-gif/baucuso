
import os

file_path = 'pages/CandidateList.tsx'

# Manual map for CP1252 characters in 0x80-0x9F range that might fail or be tricky
# We map Unicode Char -> Byte Value
CP1252_MAP = {
    '\u20AC': 0x80, # €
    '\u201A': 0x82, # ‚
    '\u0192': 0x83, # ƒ
    '\u201E': 0x84, # „
    '\u2026': 0x85, # …
    '\u2020': 0x86, # †
    '\u2021': 0x87, # ‡
    '\u02C6': 0x88, # ˆ
    '\u2030': 0x89, # ‰
    '\u0160': 0x8A, # Š
    '\u2039': 0x8B, # ‹
    '\u0152': 0x8C, # Œ
    '\u017D': 0x8E, # Ž
    '\u2018': 0x91, # ‘
    '\u2019': 0x92, # ’
    '\u201C': 0x93, # “
    '\u201D': 0x94, # ”
    '\u2022': 0x95, # •
    '\u2013': 0x96, # –
    '\u2014': 0x97, # —
    '\u02DC': 0x98, # ˜
    '\u2122': 0x99, # ™
    '\u0161': 0x9A, # š
    '\u203A': 0x9B, # ›
    '\u0153': 0x9C, # œ
    '\u017E': 0x9E, # ž
    '\u0178': 0x9F, # Ÿ
}

def repair_line_ultimate(line):
    try:
        # First, try standard Latin1. This handles 0x00-0xFF 1-to-1.
        # It handles 'á' (0xE1), '»' (0xBB) etc perfectly.
        # It fails on '„' (U+201E) because that char is > 255.
        
        # We manually convert the "high" chars to bytes using our map
        byte_array = bytearray()
        for char in line:
            if ord(char) < 256:
                byte_array.append(ord(char))
            elif char in CP1252_MAP:
                byte_array.append(CP1252_MAP[char])
            else:
                # Cannot convert this char to a single byte in our scheme.
                # Use a specific fallback or raise error
                raise UnicodeEncodeError('custom', char, 0, 1, 'unknown char')

        # Now we have bytes that represent the CP1252 byte stream
        # Decode as UTF-8
        decoded = byte_array.decode('utf-8')
        
        # If successfully decoded and result is different, use it.
        if decoded != line:
            return decoded
        return line
        
    except UnicodeEncodeError:
        # Line has real unicode chars (like correct Vietnamese) that aren't in our map
        return line
    except UnicodeDecodeError:
        # Bytes aren't valid UTF-8
        return line

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    fixed_lines = []
    modified_count = 0
    
    for i, line in enumerate(lines):
        fixed = repair_line_ultimate(line)
        if fixed != line:
            modified_count += 1
            # print(f"Fixed line {i+1}")
        fixed_lines.append(fixed)
        
    if modified_count > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(fixed_lines)
        print(f"✅ FINAL REPAIR: Fixed {modified_count} lines.")
        
        # Verify static data 
        for line in fixed_lines:
            if "NGUYỄN THANH" in line:
                 print(f"Verified: {line.strip()}")
    else:
        print("⚠️ No lines modified.")

except Exception as e:
    print(f"Error: {e}")
