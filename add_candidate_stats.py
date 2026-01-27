import re

# Read the file
with open('pages/CandidateList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Change space-y-1 to space-y-3
content = content.replace('<div className="space-y-1">', '<div className="space-y-3">', 1)

# Step 2: Add the statistics section after the description paragraph
stats_section = '''
                
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
                </div>'''

# Find and replace the description paragraph
pattern = r'(<p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quản lý và cập nhật thông tin ứng cử viên Hội đồng Nhân dân các cấp\.</p>)'
content = re.sub(pattern, r'\1' + stats_section, content, count=1)

# Write back
with open('pages/CandidateList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Successfully added candidate count statistics!")
