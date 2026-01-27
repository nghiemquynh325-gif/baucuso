
import os

file_path = 'pages/CandidateList.tsx'

def repair_line_cp1252(line):
    # Strategy:
    # 1. Try encoding as CP1252 (Windows western). This handles '„' (U+201E) unlike Latin1.
    # 2. Decode as UTF-8.
    # 3. If valid and different, return fixed.
    
    try:
        # Encode to CP1252 bytes
        bytes_cp1252 = line.encode('cp1252')
        
        # Decode as UTF-8
        decoded = bytes_cp1252.decode('utf-8')
        
        if decoded != line:
            return decoded
        return line
        
    except UnicodeEncodeError:
        # Line contains characters NOT in CP1252 (e.g. correct Vietnamese 'Đ', 'Ư', 'Ễ').
        # This acts as a safety filter: if the line is already correct (unicode), we skip it.
        return line
    except UnicodeDecodeError:
        # Encoded to CP1252 but those bytes aren't valid UTF-8.
        # This means it wasn't a CP1252->UTF-8 mojibake case.
        return line

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    fixed_lines = []
    modified_count = 0
    
    for i, line in enumerate(lines):
        fixed = repair_line_cp1252(line)
        if fixed != line:
            modified_count += 1
            # print(f"Fixed line {i+1}: {fixed.strip()[:50]}...")
        fixed_lines.append(fixed)
    
    if modified_count > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(fixed_lines)
        print(f"✅ Fixed {modified_count} lines using CP1252 strategy.")
    else:
        print("⚠️ No lines modified.")

except Exception as e:
    print(f"Error: {e}")
