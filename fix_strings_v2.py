
import os

file_path = 'pages/CandidateList.tsx'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    modified = False
    
    for i in range(len(lines)):
        line = lines[i]
        
        # 1. Placeholder
        # Match: placeholder="...NGUY...
        if 'placeholder="' in line and 'NGUY' in line:
            lines[i] = '                              placeholder="VÍ DỤ: NGUYỄN VĂN A"\n'
            modified = True
            print(f"Fixed line {i+1}: Placeholder")

        # 2. Label Title: <label ...>Ch... / Ng...</label>
        if '/ Ng' in line and '</label>' in line:
            # Preserve indentation? The line seems to be the label content line
            # From debug output: <label ...>Chá»©c vá»¥ / Nghá»  nghiá»‡p</label>
            # We can construct the whole line carefully or just replace the text part if we match robustly
            if 'text-[10px]' in line:
               lines[i] = '                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chức vụ / Nghề nghiệp</label>\n'
               modified = True
               print(f"Fixed line {i+1}: Label Title")

        # 3. Election Levels
        if "'phuong'" in line and "'thanh-pho'" in line:
            lines[i] = "                                    {l === 'phuong' ? 'Phường' : l === 'thanh-pho' ? 'Thành phố' : 'Quốc hội'}\n"
            modified = True
            print(f"Fixed line {i+1}: Election Levels")

        # 4. Select Unit
        if '<option value="">--' in line:
            lines[i] = '                              <option value="">-- Chọn đơn vị --</option>\n'
            modified = True
            print(f"Fixed line {i+1}: Select Unit")

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("✅ Files updated successfully.")
    else:
        print("⚠️ No patterns matched via loose matching either.")
        
except Exception as e:
    print(f"Error: {e}")
