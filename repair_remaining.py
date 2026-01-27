
import os

file_path = 'pages/CandidateList.tsx'

def repair_line_robust(line):
    # Logic:
    # 1. Correct Vietnamese text contains characters like 'ư', 'ơ', 'đ', 'ệ', 'ấ'...
    #    These are NOT in the 'latin1' (ISO-8859-1) character set (which only goes up to 255).
    #    So, finding these characters means the line is likely ALREADY correct or at least not simple mojibake.
    #
    # 2. Mojibake text (UTF-8 interpreted as Latin1) consists ENTIRELY of characters in the 0-255 range.
    #    (e.g. 'Ã' is 195, '©' is 169).
    #
    # Therefore:
    # - If we can encode to 'latin1', it MIGHT be mojibake. We try to interpret those bytes as UTF-8.
    # - If we CANNOT encode to 'latin1', it definitely contains wide characters, so we leave it alone.
    
    try:
        # Check if it fits in latin1
        bytes_latin1 = line.encode('latin1')
        
        # If we get here, it fits in latin1. Now check if it's valid UTF-8 sequence.
        decoded = bytes_latin1.decode('utf-8')
        
        # If decode works, we check if it changed anything.
        # ASCII text will be identical (A -> A).
        # Mojibake will change (Ã© -> é).
        if decoded != line:
            return decoded
        return line
        
    except UnicodeEncodeError:
        # Contains characters > 255 (e.g. correct Vietnamese 'đ', 'ư').
        # Leave it alone.
        return line
    except UnicodeDecodeError:
        # Fits in latin1 but bytes are not valid utf-8.
        # Leave it alone.
        return line

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    fixed_lines = [repair_line_robust(line) for line in lines]
    
    content = "".join(fixed_lines)
    
    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("✅ Robust repair complete.")
    
    # Verification sample
    print("--- Sample Checked Lines ---")
    for line in fixed_lines:
        if "Tìm kiếm" in line or "TÃ¬m kiáº¿m" in line:
            print(f"Search placeholder: {line.strip()}")
        if "Đơn vị" in line or "Ä Æ¡n vá»‹" in line:
             if len(line.strip()) < 100:
                print(f"Unit label: {line.strip()}")

except Exception as e:
    print(f"Error: {e}")
