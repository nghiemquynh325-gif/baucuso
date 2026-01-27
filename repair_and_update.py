
import os

file_path = 'pages/CandidateList.tsx'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Try latin1 strategy (maps 1-1 for all bytes)
    # This recovers the original bytes if they were interpreted as latin1
    try: 
        fixed_content = content.encode('latin1').decode('utf-8')
        print("Repair successful with latin1!")
        
        # Verify if it looks like Vietnamese
        if "Danh sách ứng cử viên" in fixed_content:
             print("Verified Vietnamese text presence.")
             
             # Now add the statistics section
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
             
             # Look for the corrupted version of the header to replace
             # Since we just fixed the content, we should look for the CLEAN version to replace
             # Because we want to insert the stats
             
             header_pattern = '<div className="space-y-1">'
             if header_pattern in fixed_content:
                  # This find the div start. We need to replace the whole header block to be safe or use precise replacement
                  # Let's target the exact block we see in the clean file
                  target = '<div className="space-y-1">\n                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Danh sách ứng cử viên</h1>\n                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quản lý và cập nhật thông tin ứng cử viên Hội đồng Nhân dân các cấp.</p>\n             </div>'
                  
                  # We might need to be flexible with whitespace
                  import re
                  # This regex captures the header div and its content
                  regex = r'<div className="space-y-1">\s*<h1[^>]*>Danh sách ứng cử viên</h1>\s*<p[^>]*>Quản lý và cập nhật thông tin ứng cử viên Hội đồng Nhân dân các cấp\.</p>\s*</div>'
                  
                  fixed_content = re.sub(regex, stats_section, fixed_content)
                  print("Statistics section added.")
             
             with open(file_path, 'w', encoding='utf-8') as f:
                 f.write(fixed_content)
                 
        else:
             print("Repair technically worked but didn't result in expected Vietnamese text.")
             print(fixed_content[:500])
             
    except UnicodeEncodeError as e:
        print(f"Latin1 encode error: {e}")
    except UnicodeDecodeError as e:
        print(f"UTF-8 decode error: {e}")

except Exception as e:
    print(f"Error: {e}")
