
import os

file_path = 'pages/CandidateList.tsx'

def repair_line(line):
    try:
        # Try to reverse the double-encoding
        # If the line was UTF-8 bytes interpreted as CP1252, this will fix it
        fixed = line.encode('cp1252').decode('utf-8')
        return fixed
    except:
        # If the line contains characters that aren't in CP1252 (like valid Vietnamese Đ or other unicode),
        # then it wasn't corrupted in the specific CP1252 way (or it's mixed).
        # In this case, we return the original line.
        return line

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    fixed_lines = [repair_line(line) for line in lines]
    
    content = "".join(fixed_lines)
    
    # Check if repair worked on the title
    if "Danh sách ứng cử viên" in content:
        print("✅ Repair successful on header text!")
    else:
        print("⚠️ Header text still looks wrong or repair failed.")
        
    # Now ensure statistics section is there
    # We'll use a direct replacement of the description paragraph to insert stats
    
    stats_section = '''
             <div className="space-y-3">
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Danh sách ứng cử viên</h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quản lý và cập nhật thông tin ứng cử viên Hội đồng Nhân dân các cấp.</p>
                
                {/* Candidate Count Statistics */}
                <div className="flex items-center gap-3">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng số:</span>
                   <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-2">
                         <span className="material-symbols-outlined text-emerald-600 text-sm">how_to_vote</span>
                         <span className="text-xs font-black text-emerald-800">HĐND Phường: {candidates.filter(c => c.level === 'phuong').length}</span>
                      </div>
                      <div className="px-3 py-1.5 bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-2">
                         <span className="material-symbols-outlined text-indigo-600 text-sm">account_balance</span>
                         <span className="text-xs font-black text-indigo-800">Thành phố: {candidates.filter(c => c.level === 'thanh-pho').length}</span>
                      </div>
                      <div className="px-3 py-1.5 bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-2">
                         <span className="material-symbols-outlined text-amber-600 text-sm">flag</span>
                         <span className="text-xs font-black text-amber-800">Quốc hội: {candidates.filter(c => c.level === 'quoc-hoi').length}</span>
                      </div>
                   </div>
                </div>
             </div>'''

    # Look for the header block to replace
    # We look for the <p> tag line as an anchor
    p_tag = '<p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quản lý và cập nhật thông tin ứng cử viên Hội đồng Nhân dân các cấp.</p>'
    
    # We also check if we already added it (to avoid duplication)
    if "HĐND Phường: {candidates.filter" not in content:
        import re
        # Find the div that contains the description and replace it with our new block
        # The key is to match the structure we know exists now that we repaired it
        
        # Regex to match the header container div
        # <div className="space-y-1"> ... <h1>...</h1> ... <p>...</p> ... </div>
        # But we changed space-y-1 to space-y-3 in previous attempts maybe?
        
        # Let's simple replace the whole header text block which we know is unique
        old_block_snippet = 'Danh sách ứng cử viên</h1>'
        
        # Find where the title is
        if old_block_snippet in content:
            # We want to replace the whole surrounding div.
            # It's hard to regex match a multiline div reliably without recursive matching.
            # Instead, we will look for the specific lines we want to upgrade.
            
            # Construct the exact string block we expect to see after repair
            expected_block = '<div className="space-y-1">\n                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Danh sách ứng cử viên</h1>\n                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quản lý và cập nhật thông tin ứng cử viên Hội đồng Nhân dân các cấp.</p>\n             </div>'
            
            # Also try the version with space-y-3 if I partially applied it
            expected_block_v2 = expected_block.replace('space-y-1', 'space-y-3')
            
            if expected_block in content:
                content = content.replace(expected_block, stats_section)
                print("✅ Statistics section added (replaced v1 block).")
            elif expected_block_v2 in content:
                 # Check if it already has stats?
                 if "HĐND Phường" not in content:
                     content = content.replace(expected_block_v2, stats_section)
                     print("✅ Statistics section added (replaced v2 block).")
            else:
                # Fallback: try to replace lines based on p_tag
                if p_tag in content:
                    # Replace the p_tag with p_tag + stats div
                    # We need to be careful about the closing div of the parent container
                    # The original parent was <div className="space-y-1"> closing after p_tag
                    
                    # Let's try to regex replace the whole div context
                    pattern = r'<div className="space-y-[13]">\s*<h1.*?</h1>\s*<p.*?</p>\s*</div>'
                    content = re.sub(pattern, stats_section, content, flags=re.DOTALL)
                    print("✅ Statistics section added with regex.")
                else:
                    print("⚠️ Could not find exact location to insert statistics.")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

except Exception as e:
    print(f"Error: {e}")
