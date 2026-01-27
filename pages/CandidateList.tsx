import React, { useState, useEffect } from 'react';
import { AN_PHU_LOCATIONS } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';

type ElectionLevel = 'quoc-hoi' | 'thanh-pho' | 'phuong' | 'all';

interface Candidate {
   id: string;
   name: string;
   level: string;
   unitId: string;
   neighborhoodId: string;
   areas: string[];
   dob: string;
   gender: string;
   title: string;
   hometown: string;
   votes?: number;
   percentage?: number;
   rank?: number;
}

// --- DỮ LIỆU CẤP PHƯỜNG (CŨ) ---
const WARD_CANDIDATES = [
   // I. HỆ THỐNG CHÍNH TRỊ (40)
   { name: "NGUYỄN THANH HỘI", dob: "03/01/1978", gender: "Nam", title: "Trưởng Ban xây dựng Đảng", unitId: "unit_1" },
   { name: "NGUYỄN VĂN HƯNG", dob: "20/01/1974", gender: "Nam", title: "Chủ nhiệm UBKT Đảng ủy", unitId: "unit_2" },
   { name: "NGUYỄN THANH LIÊM", dob: "16/06/1994", gender: "Nam", title: "Phó Trưởng Ban xây dựng Đảng", unitId: "unit_3" },
   { name: "NGUYỄN THỊ NGỌC BÍCH", dob: "15/08/1982", gender: "Nữ", title: "Phó chủ tịch HĐND phường", unitId: "unit_4" },
   { name: "NGUYỄN THANH LUẬT", dob: "03/11/1990", gender: "Nam", title: "Phó Chủ tịch UBND phường", unitId: "unit_5" },
   { name: "NGUYỄN XUÂN KHÔI", dob: "21/12/1976", gender: "Nam", title: "Trưởng Phòng Kinh tế hạ tầng", unitId: "unit_6" },
   { name: "NGUYỄN THANH THẢO", dob: "27/10/1979", gender: "Nam", title: "Trưởng Phòng Văn hóa xã hội", unitId: "unit_7" },
   { name: "PHẠM NGỌC TRINH", dob: "08/04/1982", gender: "Nữ", title: "Chánh Văn phòng HĐND-UBND", unitId: "unit_8" },
   { name: "TRẦN NHO HỒNG QUÂN", dob: "26/08/1991", gender: "Nam", title: "Phó GĐ TT phục vụ hành chính công", unitId: "unit_9" },
   { name: "NGUYỄN HOÀNG PHƯƠNG", dob: "10/08/1995", gender: "Nam", title: "Phó Chủ tịch UBMTTQ VN phường", unitId: "unit_1" },
   { name: "LÊ THỊ THÚY KIỀU", dob: "16/11/1985", gender: "Nữ", title: "Chủ tịch Hội LHPN phường", unitId: "unit_2" },
   { name: "PHẠM QUANG MINH", dob: "06/10/1969", gender: "Nam", title: "Chủ tịch Hội CCB phường", unitId: "unit_3" },
   { name: "PHAN MINH TIẾN", dob: "19/04/1990", gender: "Nam", title: "Phó Chánh Văn phòng Đảng ủy", unitId: "unit_4" },
   { name: "NGUYỄN HOÀNG ANH", dob: "06/06/1989", gender: "Nam", title: "Phó Ban văn hoá – xã hội HĐND", unitId: "unit_5" },
   { name: "ĐỖ HUỲNH THƯƠNG", dob: "07/11/1982", gender: "Nữ", title: "Phó Ban kinh tế - ngân sách HĐND", unitId: "unit_6" },
   { name: "BỒ HỮU TUẤN", dob: "24/07/1983", gender: "Nam", title: "Phó Chánh Văn phòng HĐND-UBND", unitId: "unit_7" },
   { name: "TRẦN PHƯỚC TÚ UYÊN", dob: "21/11/1999", gender: "Nữ", title: "Chuyên viên UBMTTQVN phường", unitId: "unit_8" },
   { name: "NGUYỄN NGỌC AN", dob: "27/11/1989", gender: "Nữ", title: "Phó CT Hội LHPN phường", unitId: "unit_9" },
   { name: "TRẦN ĐÌNH MINH ĐỨC", dob: "27/01/1975", gender: "Nam", title: "Chuyên viên UBMTTQVN phường", unitId: "unit_1" },
   { name: "NGUYỄN PHI SƠN", dob: "09/02/1985", gender: "Nam", title: "Trưởng Công an phường", unitId: "unit_2" },
   { name: "LÊ XUÂN HÙNG", dob: "06/02/1984", gender: "Nam", title: "Chỉ huy trưởng Ban CHQS phường", unitId: "unit_3" },
   { name: "HỒ TẤN TÀI", dob: "24/09/1979", gender: "Nam", title: "Hiệu trưởng trường TH Tuy An", unitId: "unit_4" },
   { name: "NGUYỄN TRUNG TOÀN", dob: "04/09/1967", gender: "Nam", title: "Hiệu trưởng trường THCS Nguyễn Văn Trỗi", unitId: "unit_5" },
   { name: "HOÀNG THÚY HÀ", dob: "25/07/1986", gender: "Nữ", title: "Phó Hiệu trưởng trường TH An Phú 2", unitId: "unit_6" },
   { name: "NGUYỄN KIM PHƯƠNG", dob: "26/01/1974", gender: "Nữ", title: "Hiệu trưởng trường Mầm non Hoa Mai 5", unitId: "unit_7" },
   { name: "PHAN THANH NGỌC", dob: "08/05/1982", gender: "Nữ", title: "Trưởng Khoa dược Trạm Y Tế", unitId: "unit_8" },
   { name: "NGUYỄN ĐOÀN HOÀNG THIỆN", dob: "06/01/1982", gender: "Nam", title: "PGĐ Phụ trách TYT Phường", unitId: "unit_9" },
   { name: "HUỲNH VĂN TRUYỆN", dob: "20/04/1963", gender: "Nam", title: "Trưởng Ban Điều Hành Khu Phố 1A", unitId: "unit_1" },
   { name: "VÕ TRƯỜNG THUẬN", dob: "24/04/1982", gender: "Nam", title: "Đảng viên chi bộ khu phố 1A", unitId: "unit_1" },
   { name: "NGUYỄN VĂN THUẦN", dob: "19/05/1979", gender: "Nam", title: "Trưởng BĐH Khu Phố 1B", unitId: "unit_2" },
   { name: "PHAN THỊ KIỀU LOAN", dob: "08/08/1991", gender: "Nữ", title: "Phó ban công tác mặt trận KP 1B", unitId: "unit_2" },
   { name: "PHẠM THẢO HIỀN", dob: "03/04/1996", gender: "Nữ", title: "Đảng viên Chi bộ khu phố 1B", unitId: "unit_2" },
   { name: "NGUYỄN PHÚC LỢI", dob: "05/10/1979", gender: "Nam", title: "Đảng viên Chi bộ khu phố 1B", unitId: "unit_3" },
   { name: "PHẠM VĂN BÌNH", dob: "30/05/1969", gender: "Nam", title: "Bí Thư Chi Bộ Khu Phố 2", unitId: "unit_4" },
   { name: "TRẦN THỊ MỸ DUNG", dob: "25/11/1961", gender: "Nữ", title: "Trưởng Ban Điều Hành Khu Phố 3", unitId: "unit_4" },
   { name: "PHẠM VĂN XUÂN", dob: "15/07/1963", gender: "Nam", title: "Bí thư chi bộ khu phố 4", unitId: "unit_5" },
   { name: "NGUYỄN MINH KHẢI", dob: "28/01/1988", gender: "Nam", title: "Trưởng Ban Điều hành khu phố BP A", unitId: "unit_7" },
   { name: "TRẦN THỊ THU HƯƠNG", dob: "21/06/2000", gender: "Nữ", title: "Trưởng Ban CTMT khu phố BP A", unitId: "unit_7" },
   { name: "NGUYỄN THỊ DIỄM TRINH", dob: "10/12/1989", gender: "Nữ", title: "Bí thư chi bộ khu phố Bình Phước B", unitId: "unit_8" },
   { name: "MAI THÀNH NGHĨA", dob: "17/05/1999", gender: "Nam", title: "Trưởng Ban CTMT khu phố BP B", unitId: "unit_8" },

   // II. DIỆN BAN THƯỜNG VỤ THÀNH ỦY QUẢN LÝ (4)
   { name: "NGUYỄN THỊ HIỀN", dob: "21/05/1975", gender: "Nữ", title: "Bí thư Đảng ủy, Chủ tịch HĐND phường", unitId: "unit_1" },
   { name: "NGUYỄN THỊ HỒNG VÂN", dob: "24/05/1973", gender: "Nữ", title: "Phó Bí thư Thường trực Đảng ủy", unitId: "unit_1" },
   { name: "PHẠM PHÚ NAM", dob: "20/03/1980", gender: "Nam", title: "Chủ tịch UBND phường", unitId: "unit_1" },
   { name: "PHAN CÔNG VINH", dob: "06/08/1980", gender: "Nam", title: "Chủ tịch UBMTTQVN phường", unitId: "unit_1" },

   // III. NGƯỜI NGOÀI ĐẢNG (9)
   { name: "NGUYỄN CHÍ THIÊN", dob: "14/08/1974", gender: "Nam", title: "Phó nội vụ - BTV Giáo xứ An Phú", unitId: "unit_3" },
   { name: "THÍCH NỮ THẢO LẠC", dob: "08/08/1986", gender: "Nữ", title: "Tôn giáo - Tri thức", unitId: "unit_3" },
   { name: "NGUYỄN NGỌC TUYẾT", dob: "29/04/1965", gender: "Nữ", title: "Hội viên Hội Cựu giáo chức", unitId: "unit_4" },
   { name: "LƯƠNG THỊ NGỌC XUYẾN", dob: "12/07/1983", gender: "Nữ", title: "Phó Giám Đốc Cty TNHH Kim Thành A", unitId: "unit_5" },
   { name: "CHÂU ANH TUẤN", dob: "01/06/1974", gender: "Nam", title: "Kinh doanh nhà trọ", unitId: "unit_6" },
   { name: "KHỔNG THỊ KIM LIÊN", dob: "17/09/1974", gender: "Nữ", title: "Chi hội trưởng Chi hội Phụ nữ KP 1A", unitId: "unit_1" },
   { name: "NGUYỄN THỊ THU TUYỀN", dob: "03/02/2003", gender: "Nữ", title: "Bi Thư Chi Đoàn Khu Phố 2", unitId: "unit_4" },
   { name: "ĐĂNG VĂN MINH TIẾN", dob: "22/04/2001", gender: "Nam", title: "Bí Thư Đoàn Thanh Niên Khu Phố 3", unitId: "unit_4" },
   { name: "THÂN THỊ KIỀU HÒA", dob: "17/02/1991", gender: "Nữ", title: "Giáo viên trường Mầm non", unitId: "unit_5" },
];

// --- DỮ LIỆU CẤP CAO (MỚI) ---
const HIGH_LEVEL_CANDIDATES = [
   // QUỐC HỘI (5)
   { name: "NGUYỄN VĂN DÀNH", dob: "1966", gender: "Nam", title: "Chủ tịch UBMTTQ Việt Nam tỉnh Bình Dương", unitId: "unit_1", level: "quoc-hoi" },
   { name: "TRẦN THỊ HỒNG HẠNH", dob: "1980", gender: "Nữ", title: "Phó Trưởng Đoàn ĐBQH chuyên trách", unitId: "unit_2", level: "quoc-hoi" },
   { name: "LÊ VĂN KHẢM", dob: "1970", gender: "Nam", title: "Ủy viên thường trực UB Xã hội Quốc hội", unitId: "unit_3", level: "quoc-hoi" },
   { name: "NGUYỄN QUANG HUÂN", dob: "1975", gender: "Nam", title: "Chủ tịch HĐQT Công ty CP Halcom VN", unitId: "unit_4", level: "quoc-hoi" },
   { name: "VŨ HẢI QUÂN", dob: "1974", gender: "Nam", title: "Giám đốc Đại học Quốc gia TP.HCM", unitId: "unit_5", level: "quoc-hoi" },

   // HĐND THÀNH PHỐ (7)
   { name: "BÙI MINH THẠNH", dob: "1978", gender: "Nam", title: "Bí thư Thành ủy Thuận An", unitId: "unit_1", level: "thanh-pho" },
   { name: "NGUYỄN THANH TÂM", dob: "1980", gender: "Nam", title: "Chủ tịch UBND TP Thuận An", unitId: "unit_2", level: "thanh-pho" },
   { name: "HUỲNH THỊ THANH PHƯƠNG", dob: "1982", gender: "Nữ", title: "Phó Chủ tịch HĐND Thành phố", unitId: "unit_3", level: "thanh-pho" },
   { name: "TRẦN ĐÌNH TRỌNG", dob: "1985", gender: "Nam", title: "Trưởng Ban Dân vận Thành ủy", unitId: "unit_4", level: "thanh-pho" },
   { name: "LÊ THU HƯƠNG", dob: "1988", gender: "Nữ", title: "Bí thư Thành đoàn", unitId: "unit_5", level: "thanh-pho" },
   { name: "PHẠM VĂN BẢY", dob: "1972", gender: "Nam", title: "Phó Chủ tịch thường trực UBND TP", unitId: "unit_6", level: "thanh-pho" },
   { name: "ĐẶNG VĂN HÙNG", dob: "1976", gender: "Nam", title: "Chủ nhiệm UBKT Thành ủy", unitId: "unit_7", level: "thanh-pho" },
];

export const CandidateList: React.FC<{ isLargeText?: boolean }> = ({ isLargeText }) => {
   const { showNotification, showConfirm } = useNotification();
   const [candidates, setCandidates] = useState<Candidate[]>([]);
   const [loading, setLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);

   // Filter States
   const [selectedLevelFilter, setSelectedLevelFilter] = useState<ElectionLevel>('all');
   const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
   const [searchTerm, setSearchTerm] = useState('');

   // Modal States
   const [isAdding, setIsAdding] = useState(false);
   const [editingId, setEditingId] = useState<string | null>(null);
   const [deleteId, setDeleteId] = useState<string | null>(null);
   const [formData, setFormData] = useState<Partial<Candidate>>({
      name: '', level: 'phuong', gender: 'Nam', areas: [], unitId: '', neighborhoodId: '', dob: '', title: '', hometown: ''
   });

   // View Modes and Collapsible States
   const [viewMode, setViewMode] = useState<'grid' | 'compact' | 'results'>('compact');
   const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(new Set());

   // Upload Modal States
   const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
   const [uploadStep, setUploadStep] = useState(1); // 1: Select, 2: Processing, 3: Preview
   const [previewData, setPreviewData] = useState<any[]>([]);

   useEffect(() => {
      fetchCandidates();
   }, []);

   const toggleUnitCollapse = (unitId: string) => {
      const newCollapsed = new Set(collapsedUnits);
      if (newCollapsed.has(unitId)) {
         newCollapsed.delete(unitId);
      } else {
         newCollapsed.add(unitId);
      }
      setCollapsedUnits(newCollapsed);
   };

   const globalNormalizeSpelling = (text: string) => {
      if (!text) return text;
      let s = text.trim().toUpperCase();

      const corrections = [
         { from: /\bNGUYÊN\b/g, to: 'NGUYỄN' },
         { from: /\bHIÊN\b/g, to: 'HIỀN' },
         { from: /\bHÔNG\b/g, to: 'HỒNG' },
         { from: /\bĐÀNG ỦY\b/g, to: 'ĐẢNG ỦY' },
         { from: /\bĐÀNG\b/g, to: 'ĐẢNG' },
         { from: /\bPHUONG\b/g, to: 'PHƯƠNG' },
         { from: /\bTHUAN\b/g, to: 'THUẬN' },
         { from: /\bHUUN\b/g, to: 'HÙNG' },
         { from: /\bQUYÊN\b/g, to: 'QUYỀN' },
      ];

      corrections.forEach(c => {
         s = s.replace(c.from, c.to);
      });

      return s;
   };

   const normalizeDatabase = async () => {
      showConfirm(
         <div className="space-y-3">
            <p className="font-bold">Hệ thống sẽ chuẩn hóa chính tả cho toàn bộ ứng viên:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
               <li>ĐÀNG ỦY → ĐẢNG ỦY</li>
               <li>NGUYÊn → NGUYỄN</li>
               <li>Các lỗi trích xuất khác...</li>
            </ul>
            <p>Bạn có chắc chắn muốn thực hiện?</p>
         </div>,
         {
            title: 'localhost:3000 cho biết',
            onConfirm: async () => {
               setLoading(true);
               try {
                  const { data, error } = await supabase.from('candidates').select('*');
                  if (error) throw error;

                  let fixCount = 0;
                  for (const c of data) {
                     const newName = globalNormalizeSpelling(c.name);
                     const newTitle = globalNormalizeSpelling(c.title || '');

                     if (newName !== c.name || newTitle !== (c.title || '')) {
                        await supabase.from('candidates').update({
                           name: newName,
                           title: newTitle
                        }).eq('id', c.id);
                        fixCount++;
                     }
                  }

                  showNotification(`Đã chuẩn hóa thành công ${fixCount} ứng viên.`);
                  fetchCandidates();
               } catch (error) {
                  console.error('Normalization error:', error);
                  showNotification('Lỗi khi chuẩn hóa dữ liệu.');
               } finally {
                  setLoading(false);
               }
            }
         }
      );
   };

   const fetchCandidates = async () => {
      setLoading(true);
      try {
         const { data: cData, error: cError } = await supabase.from('candidates').select('*').order('name');
         if (cError) throw cError;

         const { data: resData } = await supabase.from('voting_results').select('candidate_id, votes');

         const votesMap: Record<string, number> = {};
         resData?.forEach(r => {
            votesMap[r.candidate_id] = (votesMap[r.candidate_id] || 0) + r.votes;
         });

         const unitTotals: Record<string, number> = {};
         cData?.forEach(c => {
            const v = votesMap[c.id] || 0;
            unitTotals[c.unit_id] = (unitTotals[c.unit_id] || 0) + v;
         });

         const processed: Candidate[] = (cData || []).map(c => {
            const v = votesMap[c.id] || 0;
            const total = unitTotals[c.unit_id] || 0;
            return {
               id: c.id,
               name: c.name,
               level: c.level,
               unitId: c.unit_id,
               neighborhoodId: c.neighborhood_id || '',
               areas: c.areas || [],
               dob: c.dob || '',
               gender: c.gender || 'Nam',
               title: c.title || '',
               hometown: c.hometown || '',
               votes: v,
               percentage: total > 0 ? parseFloat(((v / total) * 100).toFixed(1)) : 0
            };
         });

         // Assign ranks within units
         const units = Array.from(new Set(processed.map(p => p.unitId)));
         units.forEach(uid => {
            const unitCands = processed.filter(p => p.unitId === uid);
            unitCands.sort((a, b) => (b.votes || 0) - (a.votes || 0));
            unitCands.forEach((c, idx) => c.rank = idx + 1);
         });

         setCandidates(processed);
      } catch (err) {
         console.error('Error fetching candidates:', err);
      }
      setLoading(false);
   };

   const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploadStep(2);
      // Simulate Parsing Delay
      setTimeout(() => {
         // Merge simulated data from different levels
         const wardData = WARD_CANDIDATES.map(c => ({ ...c, level: 'phuong' }));
         const highLevelData = HIGH_LEVEL_CANDIDATES;
         setPreviewData([...highLevelData, ...wardData]);
         setUploadStep(3);
      }, 1500);
   };

   const confirmImport = async () => {
      setIsSaving(true);
      try {
         const { data: currentCandidates, error: fetchError } = await supabase.from('candidates').select('id, name');
         if (fetchError) throw fetchError;

         // Normalize Helper (Shared Logic)
         const normalize = (str: string) => globalNormalizeSpelling(str);

         const dbMap = new Map<string, string>(); // Name -> ID
         currentCandidates?.forEach(c => {
            if (c.name) dbMap.set(normalize(c.name), c.id);
         });

         const toUpsertWithId: any[] = [];
         const toInsertNew: any[] = [];

         previewData.forEach(pdfCand => {
            const normName = normalize(pdfCand.name);
            const existingId = dbMap.get(normName);

            const candidateData = {
               name: pdfCand.name.trim(),
               dob: pdfCand.dob,
               gender: pdfCand.gender,
               title: pdfCand.title,
               unit_id: pdfCand.unitId,
               level: pdfCand.level,
            };

            if (existingId) {
               toUpsertWithId.push({ id: existingId, ...candidateData });
            } else {
               toInsertNew.push({ ...candidateData, neighborhood_id: null, areas: [], hometown: '' });
            }
         });

         if (toUpsertWithId.length > 0) await supabase.from('candidates').upsert(toUpsertWithId);
         if (toInsertNew.length > 0) await supabase.from('candidates').insert(toInsertNew);

         showNotification(`Đã nhập liệu thành công!\n- Cập nhật: ${toUpsertWithId.length}\n- Thêm mới: ${toInsertNew.length}`);
         await fetchCandidates();
         setIsUploadModalOpen(false);
         setPreviewData([]);
         setUploadStep(1);

      } catch (err: any) {
         console.error('Import Error:', err);
         showNotification('Lỗi: ' + (err.message));
      } finally {
         setIsSaving(false);
      }
   };

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.unitId) {
         showNotification('Vui lòng nhập Họ tên và chọn Đơn vị bầu cử.');
         return;
      }

      setIsSaving(true);

      try {
         const payload = {
            name: globalNormalizeSpelling(formData.name),
            level: formData.level,
            unit_id: formData.unitId,
            neighborhood_id: formData.neighborhoodId ? formData.neighborhoodId : null,
            dob: formData.dob,
            gender: formData.gender,
            title: formData.title ? globalNormalizeSpelling(formData.title) : '',
            hometown: formData.hometown,
            areas: formData.areas || []
         };

         if (editingId) {
            const { error } = await supabase.from('candidates').update(payload).eq('id', editingId);
            if (error) throw error;
         } else {
            const { error } = await supabase.from('candidates').insert([payload]);
            if (error) throw error;
         }

         closeModal();
         await fetchCandidates();
      } catch (err: any) {
         console.error('Save error:', err);
         showNotification('Lỗi khi lưu dữ liệu: ' + (err.message || err));
      } finally {
         setIsSaving(false);
      }
   };

   const handleDelete = async () => {
      if (!deleteId) return;
      try {
         const { error } = await supabase.from('candidates').delete().eq('id', deleteId);
         if (error) throw error;
         setDeleteId(null);
         await fetchCandidates();
      } catch (err: any) {
         console.error('Delete error:', err);
         showNotification('Lỗi khi xóa: ' + err.message);
      }
   };

   const closeModal = () => {
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: '', level: 'phuong', gender: 'Nam', areas: [], unitId: '', neighborhoodId: '', dob: '', title: '', hometown: '' });
   };

   const filteredCandidates = candidates.filter(c => {
      const matchesLevel = selectedLevelFilter === 'all' || c.level === selectedLevelFilter;
      const matchesUnit = selectedUnitFilter === 'all' || c.unitId === selectedUnitFilter;
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesLevel && matchesSearch && matchesUnit;
   });

   // UI Helpers
   const getInitials = (name: string) => {
      const parts = name.trim().split(' ');
      if (parts.length === 0) return 'UC';
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
   };

   const getLevelConfig = (level: string) => {
      switch (level) {
         case 'quoc-hoi': return { label: 'ĐB Quốc hội', bg: 'bg-amber-600', gradient: 'from-amber-100 to-amber-200 text-amber-800' };
         case 'thanh-pho': return { label: 'HĐND Thành phố', bg: 'bg-indigo-600', gradient: 'from-indigo-100 to-indigo-200 text-indigo-800' };
         default: return { label: 'HĐND Phường', bg: 'bg-emerald-600', gradient: 'from-emerald-100 to-emerald-200 text-emerald-800' };
      }
   };

   const getGradientByInitials = (initials: string) => {
      const charCode = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
      const gradients = [
         'bg-gradient-to-br from-blue-200 to-cyan-200 text-blue-900',
         'bg-gradient-to-br from-purple-200 to-pink-200 text-purple-900',
         'bg-gradient-to-br from-emerald-200 to-teal-200 text-emerald-900',
         'bg-gradient-to-br from-orange-200 to-amber-200 text-orange-900',
         'bg-gradient-to-br from-slate-200 to-gray-300 text-slate-900',
         'bg-gradient-to-br from-rose-200 to-red-200 text-rose-900',
      ];
      return gradients[charCode % gradients.length];
   };

   const getUnitName = (unitId: string) => {
      const unit = AN_PHU_LOCATIONS.find(u => u.id === unitId);
      return unit ? unit.name.replace('Đơn vị số', 'Số') : 'Chưa phân';
   };

   const getNeighborhoodName = (neighborhoodId: string) => {
      return neighborhoodId.replace('kp_', 'Khu phố ').toUpperCase().replace('1A', '1A').replace('1B', '1B');
   };

   return (
      <div className={`space-y-8 pb-32 animate-in fade-in duration-500 ${isLargeText ? 'text-lg' : 'text-base'}`}>

         {/* HEADER SECTION */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

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
            </div>
            <div className="flex gap-3">
               <div className="flex p-1 bg-slate-100 rounded-xl mr-2">
                  <button
                     onClick={() => setViewMode('grid')}
                     className={`size-10 rounded-lg flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     title="Xem dạng lưới"
                  >
                     <span className="material-symbols-outlined">grid_view</span>
                  </button>
                  <button
                     onClick={() => setViewMode('compact')}
                     className={`size-10 rounded-lg flex items-center justify-center transition-all ${viewMode === 'compact' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     title="Xem danh sách thu gọn"
                  >
                     <span className="material-symbols-outlined">format_list_bulleted</span>
                  </button>
                  <button
                     onClick={() => setViewMode('results')}
                     className={`size-10 rounded-lg flex items-center justify-center transition-all ${viewMode === 'results' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     title="Xem kết quả bầu cử"
                  >
                     <span className="material-symbols-outlined">analytics</span>
                  </button>
               </div>
               <button
                  onClick={normalizeDatabase}
                  className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:border-amber-500 hover:text-amber-500 transition-all flex items-center gap-2"
                  title="Chuẩn hóa chính tả"
               >
                  <span className="material-symbols-outlined text-xl">spellcheck</span>
                  Fix Spelling
               </button>
               <button
                  onClick={() => { setIsUploadModalOpen(true); setUploadStep(1); }}
                  className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:border-primary hover:text-primary transition-all flex items-center gap-2"
                  title="Tải lên danh sách từ PDF"
               >
                  <span className="material-symbols-outlined text-xl">upload_file</span>
                  Import PDF
               </button>
               <button
                  onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ name: '', level: 'phuong', gender: 'Nam', areas: [], unitId: '', neighborhoodId: '', dob: '', title: '', hometown: '' }); }}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-105 transition-all flex items-center gap-2"
               >
                  <span className="material-symbols-outlined text-xl">add</span> Thêm mới
               </button>
            </div>
         </div>

         {/* FILTER BAR */}
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">

            {/* Search */}
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Tìm kiếm</label>
               <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input
                     type="text"
                     placeholder="Họ và tên, mã số..."
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                     className="w-full h-12 pl-12 pr-4 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                  />
               </div>
            </div>

            {/* Unit Filter */}
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Đơn vị bầu cử</label>
               <div className="relative">
                  <select
                     value={selectedUnitFilter}
                     onChange={e => setSelectedUnitFilter(e.target.value)}
                     className="w-full h-12 px-4 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/10 transition-all outline-none appearance-none cursor-pointer"
                  >
                     <option value="all">Tất cả các đơn vị</option>
                     {AN_PHU_LOCATIONS.filter(l => l.type === 'unit').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                     ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
               </div>
            </div>

            {/* Level Filter */}
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Loại hình bầu cử</label>
               <div className="relative">
                  <select
                     value={selectedLevelFilter}
                     onChange={e => setSelectedLevelFilter(e.target.value as any)}
                     className="w-full h-12 px-4 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/10 transition-all outline-none appearance-none cursor-pointer"
                  >
                     <option value="all">Tất cả loại hình</option>
                     <option value="phuong">HĐND Phường</option>
                     <option value="thanh-pho">HĐND Thành phố</option>
                     <option value="quoc-hoi">ĐB Quốc hội</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
               </div>
            </div>
         </div>

         {/* CANDIDATE GRID - Grouped by Unit */}
         {loading ? (
            <div className="py-20 text-center animate-pulse">
               <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">sync</span>
               <p className="text-slate-400 font-bold uppercase text-xs mt-2">Đang tải dữ liệu...</p>
            </div>
         ) : filteredCandidates.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
               <span className="material-symbols-outlined text-4xl text-slate-300">person_off</span>
               <p className="text-slate-400 font-bold uppercase text-xs mt-2">Không tìm thấy ứng viên phù hợp</p>
            </div>
         ) : (
            <div className="space-y-16">
               {AN_PHU_LOCATIONS.filter(l => l.type === 'unit').map(unit => {
                  const unitMatches = filteredCandidates.filter(c => c.unitId === unit.id);
                  if (unitMatches.length === 0) return null;

                  return (
                     <div key={unit.id} className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                        {/* Section header */}
                        <div
                           className="flex items-center gap-6 cursor-pointer group/header"
                           onClick={() => toggleUnitCollapse(unit.id)}
                        >
                           <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                           <div className="flex flex-col items-center">
                              <div className="flex items-center gap-3 px-8 py-2.5 bg-white rounded-full border border-slate-200 shadow-sm relative z-10 hover:border-primary transition-colors">
                                 <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">
                                    {unit.name.toUpperCase()}
                                 </h2>
                                 <span className={`material-symbols-outlined text-slate-300 group-hover/header:text-primary transition-all ${collapsedUnits.has(unit.id) ? '' : 'rotate-180'}`}>
                                    expand_more
                                 </span>
                              </div>
                              <div className="text-[10px] font-bold text-primary uppercase tracking-widest mt-2">{unitMatches.length} ỨNG CỬ VIÊN</div>
                           </div>
                           <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                        </div>

                        {!collapsedUnits.has(unit.id) && (
                           viewMode === 'grid' ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                 {unitMatches.map(c => {
                                    const initials = getInitials(c.name);
                                    const levelConfig = getLevelConfig(c.level);
                                    const gradientClass = getGradientByInitials(initials);
                                    const unitName = getUnitName(c.unitId);
                                    const neighborhoodName = getNeighborhoodName(c.neighborhoodId);

                                    return (
                                       <div key={c.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col">

                                          {/* Card Header (Gradient + Initials) */}
                                          <div className={`h-48 relative flex items-center justify-center overflow-hidden ${gradientClass}`}>
                                             {/* Badge */}
                                             <div className={`absolute top-4 left-4 px-2.5 py-1 rounded-md text-[9px] font-black text-white uppercase tracking-wider shadow-sm ${levelConfig.bg}`}>
                                                {levelConfig.label}
                                             </div>

                                             {/* Action Buttons */}
                                             <div className="absolute top-4 right-4 flex gap-2">
                                                <button
                                                   onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEditingId(c.id);
                                                      setFormData(c);
                                                      setIsAdding(true);
                                                   }}
                                                   className="size-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-600 hover:text-primary hover:scale-110 transition-all shadow-sm z-10"
                                                   title="Chỉnh sửa"
                                                >
                                                   <span className="material-symbols-outlined text-sm">edit</span>
                                                </button>
                                                <button
                                                   onClick={(e) => {
                                                      e.stopPropagation();
                                                      setDeleteId(c.id);
                                                   }}
                                                   className="size-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-600 hover:text-red-500 hover:scale-110 transition-all shadow-sm z-10"
                                                   title="Xóa"
                                                >
                                                   <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                             </div>

                                             {/* Initials Big Text */}
                                             <h2 className="text-9xl font-black uppercase opacity-20 select-none scale-150 transform translate-y-4">
                                                {initials}
                                             </h2>
                                             <h2 className="absolute text-7xl font-black uppercase drop-shadow-sm">
                                                {initials}
                                             </h2>
                                          </div>

                                          {/* Card Body */}
                                          <div className="p-5 flex-1 flex flex-col">
                                             <div className="mb-4">
                                                <h3 className="text-xl font-black text-slate-900 leading-tight line-clamp-2" title={c.name}>
                                                   {c.name}
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wide line-clamp-2">
                                                   {c.title || 'Ứng cử viên đại biểu'}
                                                </p>
                                             </div>

                                             <div className="w-full h-px bg-slate-100 mb-4"></div>

                                             <div className="space-y-2 mt-auto">
                                                <div className="flex items-center gap-3 text-slate-600">
                                                   <span className="material-symbols-outlined text-lg text-slate-400">calendar_month</span>
                                                   <p className="text-xs font-bold">{c.dob || 'Chưa cập nhật'}</p>
                                                </div>
                                                <div className="flex items-start gap-3 text-slate-600">
                                                   <span className="material-symbols-outlined text-lg text-slate-400 mt-0.5">location_on</span>
                                                   <div>
                                                      <p className="text-xs font-bold">Đơn vị: {unitName}</p>
                                                      {c.neighborhoodId && <p className="text-[10px] text-slate-400 uppercase mt-0.5">({neighborhoodName})</p>}
                                                   </div>
                                                </div>
                                             </div>
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           ) : viewMode === 'compact' ? (
                              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                 <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                       <thead className="bg-slate-50 border-b border-slate-100">
                                          <tr>
                                             <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ứng cử viên</th>
                                             <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Năm sinh / Giới tính</th>
                                             <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cấp bầu cử</th>
                                             <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                                          </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-50">
                                          {unitMatches.map(c => {
                                             const levelConfig = getLevelConfig(c.level);
                                             return (
                                                <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                                   <td className="px-6 py-4">
                                                      <div className="flex items-center gap-4">
                                                         <div className={`size-10 rounded-xl flex items-center justify-center font-black text-xs ${getGradientByInitials(getInitials(c.name))}`}>
                                                            {getInitials(c.name)}
                                                         </div>
                                                         <div>
                                                            <div className="font-black text-slate-900 uppercase text-xs">{c.name}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{c.title || 'Ứng cử viên'}</div>
                                                         </div>
                                                      </div>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                      <div className="text-xs font-bold text-slate-600">{c.dob || 'N/A'}</div>
                                                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{c.gender}</div>
                                                   </td>
                                                   <td className="px-6 py-4 text-center">
                                                      <span className={`px-2.5 py-1 rounded-md text-[9px] font-black text-white uppercase tracking-wider ${levelConfig.bg}`}>
                                                         {levelConfig.label}
                                                      </span>
                                                   </td>
                                                   <td className="px-6 py-4 text-right">
                                                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                         <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setFormData(c); setIsAdding(true); }}
                                                            className="size-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all"
                                                         >
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                         </button>
                                                         <button
                                                            onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                                                            className="size-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                         >
                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                         </button>
                                                      </div>
                                                   </td>
                                                </tr>
                                             );
                                          })}
                                       </tbody>
                                    </table>
                                 </div>
                              </div>
                           ) : (
                              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100">
                                 {unitMatches.sort((a, b) => (b.votes || 0) - (a.votes || 0)).map((c) => {
                                    const levelConfig = getLevelConfig(c.level);
                                    return (
                                       <div key={c.id} className={`grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-slate-50 transition-all ${c.rank && c.rank <= 3 ? 'bg-amber-50/10' : ''}`}>
                                          <div className="col-span-1 text-center">
                                             <span className={`size-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm border ${c.rank === 1 ? 'bg-yellow-400 text-yellow-900 border-yellow-500' :
                                                c.rank === 2 ? 'bg-slate-100 text-slate-600 border-slate-300' :
                                                   c.rank === 3 ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-white text-slate-400 border-slate-200'
                                                }`}>
                                                {c.rank}
                                             </span>
                                          </div>
                                          <div className="col-span-4">
                                             <p className="text-lg font-black uppercase text-slate-900 leading-tight">{c.name}</p>
                                             <div className="mt-1 flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${levelConfig.bg} text-white`}>
                                                   {levelConfig.label}
                                                </span>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">{c.title || 'Ứng cử viên'}</p>
                                             </div>
                                          </div>
                                          <div className="col-span-4">
                                             <div className="flex flex-col items-center gap-2">
                                                <div className="flex justify-between w-full max-w-[180px]">
                                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tỷ lệ phiếu</span>
                                                   <span className="text-[10px] font-black text-primary">{c.percentage}%</span>
                                                </div>
                                                <div className="h-2.5 w-full max-w-[180px] bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                                   <div
                                                      className="h-full bg-gradient-to-r from-primary to-blue-400 shadow-sm transition-all duration-1000"
                                                      style={{ width: `${c.percentage}%` }}
                                                   ></div>
                                                </div>
                                             </div>
                                          </div>
                                          <div className="col-span-3 text-right">
                                             <p className="text-3xl font-black text-slate-900 leading-none">{(c.votes || 0).toLocaleString()}</p>
                                             <p className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-widest">PHIẾU BẦU HỢP LỆ</p>
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           )
                        )}
                     </div>
                  );
               })}

               {/* Unassigned Candidates */}
               {(() => {
                  const assignedUnitIds = AN_PHU_LOCATIONS.filter(l => l.type === 'unit').map(u => u.id);
                  const unassigned = filteredCandidates.filter(c => !assignedUnitIds.includes(c.unitId));
                  if (unassigned.length === 0) return null;

                  return (
                     <div className="space-y-8 pt-10 animate-in slide-in-from-bottom-4 duration-500">
                        <div
                           className="flex items-center gap-6 cursor-pointer group/header"
                           onClick={() => toggleUnitCollapse('unassigned')}
                        >
                           <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                           <div className="flex items-center gap-3 px-8 py-2.5 bg-slate-50 rounded-full border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
                              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] ">
                                 CHƯA PHÂN ĐƠN VỊ
                              </h2>
                              <span className={`material-symbols-outlined text-slate-300 group-hover/header:text-slate-400 transition-all ${collapsedUnits.has('unassigned') ? '' : 'rotate-180'}`}>
                                 expand_more
                              </span>
                           </div>
                           <div className="h-0.5 flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                        </div>

                        {!collapsedUnits.has('unassigned') && (
                           viewMode === 'grid' ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                 {unassigned.map(c => {
                                    const initials = getInitials(c.name);
                                    const gradientClass = getGradientByInitials(initials);
                                    return (
                                       <div key={c.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col opacity-80 hover:opacity-100">
                                          <div className={`h-32 relative flex items-center justify-center overflow-hidden ${gradientClass}`}>
                                             <h2 className="text-4xl font-black uppercase opacity-40">{initials}</h2>
                                             <div className="absolute top-3 right-3 flex gap-2">
                                                <button onClick={() => { setEditingId(c.id); setFormData(c); setIsAdding(true); }} className="size-7 bg-white/90 rounded-full flex items-center justify-center text-slate-500 hover:text-primary transition-all shadow-sm">
                                                   <span className="material-symbols-outlined text-xs">edit</span>
                                                </button>
                                             </div>
                                          </div>
                                          <div className="p-4">
                                             <h3 className="font-bold text-slate-900 uppercase text-xs truncate">{c.name}</h3>
                                             <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{c.title || 'Ứng cử viên'}</p>
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           ) : (
                              <div className="bg-slate-50/50 rounded-3xl border border-slate-100 overflow-hidden">
                                 <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                       <tbody className="divide-y divide-slate-100">
                                          {unassigned.map(c => (
                                             <tr key={c.id} className="hover:bg-white transition-colors group">
                                                <td className="px-6 py-3">
                                                   <div className="flex items-center gap-4">
                                                      <div className="font-black text-slate-700 uppercase text-[10px]">{c.name}</div>
                                                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{c.title || 'Ứng cử viên'}</div>
                                                   </div>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                   <button onClick={() => { setEditingId(c.id); setFormData(c); setIsAdding(true); }} className="text-slate-300 hover:text-primary transition-colors">
                                                      <span className="material-symbols-outlined text-sm">edit</span>
                                                   </button>
                                                </td>
                                             </tr>
                                          ))}
                                       </tbody>
                                    </table>
                                 </div>
                              </div>
                           )
                        )}
                     </div>
                  );
               })()}
            </div>
         )
         }

         {/* UPLOAD MODAL */}
         {isUploadModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-300">
               <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl border-4 border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">

                  {/* Modal Header */}
                  <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="size-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                           <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                        </div>
                        <div>
                           <h2 className="text-xl font-black uppercase tracking-tight">Nhập liệu từ File PDF</h2>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Hỗ trợ trích xuất: Quốc Hội, Thành Phố, Phường</p>
                        </div>
                     </div>
                     <button onClick={() => setIsUploadModalOpen(false)} className="size-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center">
                        <span className="material-symbols-outlined">close</span>
                     </button>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-10">

                     {/* Step 1: Upload */}
                     {uploadStep === 1 && (
                        <div className="h-full flex flex-col items-center justify-center space-y-6 text-center py-10">
                           <div className="w-full max-w-lg p-10 border-4 border-dashed border-slate-200 rounded-[2rem] bg-slate-50 hover:bg-slate-100 transition-colors relative group cursor-pointer">
                              <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                              <span className="material-symbols-outlined text-6xl text-slate-300 group-hover:text-primary transition-colors mb-4">description</span>
                              <h3 className="text-lg font-black text-slate-700 uppercase">Kéo thả file PDF vào đây</h3>
                              <p className="text-xs font-bold text-slate-400 mt-2">Hoặc bấm để chọn file từ máy tính</p>
                           </div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-xs leading-relaxed">
                              Hệ thống sẽ tự động quét và phân loại danh sách ứng cử viên theo từng cấp bầu cử.
                           </p>
                        </div>
                     )}

                     {/* Step 2: Processing */}
                     {uploadStep === 2 && (
                        <div className="h-full flex flex-col items-center justify-center py-20 space-y-6">
                           <div className="relative size-24">
                              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                 <span className="material-symbols-outlined text-3xl text-primary">smart_toy</span>
                              </div>
                           </div>
                           <div className="text-center">
                              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight animate-pulse">Đang phân tích dữ liệu...</h3>
                              <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Vui lòng không tắt cửa sổ này</p>
                           </div>
                        </div>
                     )}

                     {/* Step 3: Preview */}
                     {uploadStep === 3 && (
                        <div className="space-y-6">
                           <div className="flex items-center justify-between">
                              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 border-primary pl-3">Kết quả trích xuất ({previewData.length})</h3>
                              <div className="flex gap-2">
                                 <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded text-[10px] font-black uppercase">Quốc hội: {previewData.filter(c => c.level === 'quoc-hoi').length}</span>
                                 <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded text-[10px] font-black uppercase">Thành phố: {previewData.filter(c => c.level === 'thanh-pho').length}</span>
                                 <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded text-[10px] font-black uppercase">Phường: {previewData.filter(c => c.level === 'phuong').length}</span>
                              </div>
                           </div>

                           <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                              <table className="w-full text-left">
                                 <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <tr>
                                       <th className="px-4 py-3">Họ tên</th>
                                       <th className="px-4 py-3">Cấp bầu cử</th>
                                       <th className="px-4 py-3">Đơn vị</th>
                                       <th className="px-4 py-3">Chức vụ</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {previewData.map((c, idx) => (
                                       <tr key={idx} className="hover:bg-slate-50">
                                          <td className="px-4 py-2 font-bold text-xs text-slate-900 uppercase">{c.name}</td>
                                          <td className="px-4 py-2">
                                             <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${c.level === 'quoc-hoi' ? 'bg-amber-100 text-amber-700' : c.level === 'thanh-pho' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {c.level === 'quoc-hoi' ? 'Quốc hội' : c.level === 'thanh-pho' ? 'Thành phố' : 'Phường'}
                                             </span>
                                          </td>
                                          <td className="px-4 py-2 text-xs font-bold text-slate-500">{AN_PHU_LOCATIONS.find(u => u.id === c.unitId)?.name}</td>
                                          <td className="px-4 py-2 text-[10px] text-slate-400 font-bold truncate max-w-[150px]">{c.title}</td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                     )}
                  </div>

                  {/* Modal Footer */}
                  {uploadStep === 3 && (
                     <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                        <button
                           onClick={() => setUploadStep(1)}
                           className="px-6 py-3 border border-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-white transition-all"
                        >
                           Quét lại
                        </button>
                        <button
                           onClick={confirmImport}
                           disabled={isSaving}
                           className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-blue-800 transition-all flex items-center gap-2"
                        >
                           {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save_alt</span>}
                           Xác nhận nhập liệu
                        </button>
                     </div>
                  )}
               </div>
            </div>
         )}

         {/* ADD/EDIT MODAL */}
         {isAdding && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
               <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
                  <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                     <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingId ? 'Cập nhật hồ sơ' : 'Thêm ứng cử viên mới'}</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Thông tin niêm yết chính thức</p>
                     </div>
                     <button onClick={closeModal} className="size-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 transition-all">
                        <span className="material-symbols-outlined">close</span>
                     </button>
                  </div>

                  <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 md:col-span-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ và Tên khai sinh <span className="text-red-500">*</span></label>
                           <input
                              required
                              type="text"
                              value={formData.name}
                              onChange={e => setFormData({ ...formData, name: e.target.value })}
                              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all"
                              placeholder="VÍ DỤ: NGUYỄN VĂN A"
                           />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày sinh</label>
                           <input
                              type="text"
                              value={formData.dob}
                              onChange={e => setFormData({ ...formData, dob: e.target.value })}
                              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-primary outline-none transition-all"
                              placeholder="DD/MM/YYYY"
                           />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Giới tính</label>
                           <select
                              value={formData.gender}
                              onChange={e => setFormData({ ...formData, gender: e.target.value })}
                              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-primary outline-none transition-all"
                           >
                              <option value="Nam">Nam</option>
                              <option value="Nữ">Nữ</option>
                           </select>
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chức vụ / Nghề nghiệp</label>
                           <input
                              type="text"
                              value={formData.title}
                              onChange={e => setFormData({ ...formData, title: e.target.value })}
                              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-primary outline-none transition-all"
                              placeholder="Ví dụ: Bí thư Chi bộ, Tổ trưởng dân phố..."
                           />
                        </div>
                     </div>

                     <div className="h-px bg-slate-100 w-full"></div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 md:col-span-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cấp ứng cử</label>
                           <div className="grid grid-cols-3 gap-3">
                              {['phuong', 'thanh-pho', 'quoc-hoi'].map(l => (
                                 <button
                                    key={l}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, level: l })}
                                    className={`h-12 rounded-xl text-xs font-black uppercase border-2 transition-all ${formData.level === l ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                                 >
                                    {l === 'phuong' ? 'Phường' : l === 'thanh-pho' ? 'Thành phố' : 'Quốc hội'}
                                 </button>
                              ))}
                           </div>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thuộc đơn vị bầu cử <span className="text-red-500">*</span></label>
                           <select
                              required
                              value={formData.unitId}
                              onChange={e => setFormData({ ...formData, unitId: e.target.value })}
                              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-primary outline-none transition-all"
                           >
                              <option value="">-- Chọn đơn vị --</option>
                              {AN_PHU_LOCATIONS.filter(l => l.type === 'unit').map(u => (
                                 <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                           </select>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thuộc khu phố (Cư trú)</label>
                           <input
                              type="text"
                              value={formData.neighborhoodId}
                              onChange={e => setFormData({ ...formData, neighborhoodId: e.target.value })}
                              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-primary outline-none transition-all"
                              placeholder="Mã KP (VD: kp_1a)"
                           />
                        </div>
                     </div>
                  </form>

                  <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                     <button
                        type="button"
                        onClick={closeModal}
                        className="flex-1 h-12 border border-slate-200 bg-white rounded-xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                     >
                        Hủy bỏ
                     </button>
                     <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 h-12 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-blue-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                     >
                        {isSaving && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                        {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* DELETE CONFIRMATION */}
         {deleteId && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
               <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl animate-in zoom-in-95">
                  <div className="size-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                     <span className="material-symbols-outlined text-3xl">warning</span>
                  </div>
                  <h3 className="text-lg font-black uppercase text-slate-900 mb-2">Xác nhận xóa?</h3>
                  <p className="text-sm font-medium text-slate-500 mb-6">Hành động này không thể hoàn tác. Ứng cử viên sẽ bị xóa khỏi hệ thống.</p>
                  <div className="flex gap-3">
                     <button onClick={() => setDeleteId(null)} className="flex-1 h-10 border border-slate-200 rounded-xl font-bold text-xs uppercase text-slate-500 hover:bg-slate-50">Hủy</button>
                     <button onClick={handleDelete} className="flex-1 h-10 bg-red-500 text-white rounded-xl font-bold text-xs uppercase hover:bg-red-600 shadow-lg shadow-red-500/30">Xóa vĩnh viễn</button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

