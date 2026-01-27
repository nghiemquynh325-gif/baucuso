
import os

file_path = 'pages/CandidateList.tsx'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    modified = False
    
    # Define replacements (partial match -> full replacement pattern)
    # We use patterns that are unique enough
    
    for i in range(len(lines)):
        line = lines[i]
        
        # 1. Placeholder VÃ  Dá»¤
        if 'placeholder="VÃ  Dá»¤:' in line:
            lines[i] = line.replace('placeholder="VÃ  Dá»¤: NGUYá»„N VÄ‚N A"', 'placeholder="VÍ DỤ: NGUYỄN VĂN A"')
            modified = True
            print(f"Fixed line {i+1}: Placeholder")

        # 2. Chá»©c vá»¥
        if '>Chá»©c vá»¥ / Nghá»  nghiá»‡p</label>' in line:
            lines[i] = line.replace('>Chá»©c vá»¥ / Nghá»  nghiá»‡p</label>', '>Chức vụ / Nghề nghiệp</label>')
            modified = True
            print(f"Fixed line {i+1}: Label Title")

        # 3. PhÆ°á» ng, ThÃ nh phá»‘
        if "'PhÆ°á» ng'" in line and "'ThÃ nh phá»‘'" in line:
            # {l === 'phuong' ? 'PhÆ°á» ng' : l === 'thanh-pho' ? 'ThÃ nh phá»‘' : 'Quá»‘c há»™i'}
            # Be careful with quotes and spaces
            new_line = line.replace("'PhÆ°á» ng'", "'Phường'")
            new_line = new_line.replace("'ThÃ nh phá»‘'", "'Thành phố'")
            new_line = new_line.replace("'Quá»‘c há»™i'", "'Quốc hội'")
            lines[i] = new_line
            modified = True
            print(f"Fixed line {i+1}: Election Levels")

        # 4. -- Chá» n Ä‘Æ¡n vá»‹ --
        if '-- Chá» n Ä‘Æ¡n vá»‹ --' in line:
            lines[i] = line.replace('-- Chá» n Ä‘Æ¡n vá»‹ --', '-- Chọn đơn vị --')
            modified = True
            print(f"Fixed line {i+1}: Select Unit")

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("✅ Files updated successfully.")
    else:
        print("⚠️ No patterns matched. Please check the patterns.")
        # Debug: print the lines to see what they actually look like
        print("--- DEBUG ---")
        for i in [1034, 1059, 1083, 1096]: # Adjust for 0-index
            if i < len(lines):
                print(f"Line {i+1}: {lines[i].strip()}")

except Exception as e:
    print(f"Error: {e}")
