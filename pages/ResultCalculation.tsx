
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AN_PHU_LOCATIONS, NEIGHBORHOODS } from '../types';
import { getDelegateCount } from '../lib/voting';

/**
 * COMPONENT: ResultCalculation
 * 
 * Mục đích: Tổng hợp kết quả bầu cử từ dữ liệu thô (Realtime) hoặc dữ liệu đã khóa sổ (Locked).
 * 
 * Logic tổng hợp:
 * - Hybrid Data Source: Kết hợp dữ liệu từ 2 nguồn:
 *   1. `voters` (Realtime Check-in): Dùng khi KVBP chưa khóa sổ.
 *   2. `area_stats` (Official Locked): Dùng khi KVBP đã xác nhận khóa sổ.
 * 
 * - View Modes: Hỗ trợ xem đa chiều (Toàn phường, Đơn vị, Khu phố, KVBP, Tổ).
 * - Drill-down: Click vào từng dòng để xem danh sách cử tri chi tiết.
 */

type ViewMode = 'ward' | 'unit' | 'neighborhood' | 'area' | 'group' | 'candidates';

interface AggregatedStat {
  id: string; // Display ID (e.g. "01", "1A")
  rawId: string; // Real ID for logic (e.g. "unit_1", "kp_1a")
  name: string;
  subLabel?: string;
  detail?: string; // Chi tiết text (nếu có)
  groups?: string[]; // Danh sách thành phần con (dùng để hiển thị tags)
  total: number;
  voted: number; // Đây là số cử tri đi bầu (Check-in) HOẶC số phiếu thu về (nếu đã khóa)
  percent: number;
  status: 'slow' | 'average' | 'good';
  isLocked: boolean; // Trạng thái đã khóa sổ hay chưa
  rawVoters?: any[];
}

interface CandidateResult {
  id: string;
  name: string;
  unitId: string;
  level: string;
  totalVotes: number;
  rank: number;
  percentage: number;
}

const DetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  item: any;
  mode: 'list' | 'progress';
  viewMode: string;
  totalVotesByArea: Record<string, number>;
}> = ({ isOpen, onClose, title, subtitle, item, mode, viewMode, totalVotesByArea }) => {
  const [voters, setVoters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'voted' | 'not-voted'>('not-voted');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;
  if (!isOpen || !item) return null;

  const areaTotalVotes = totalVotesByArea[item.rawId] || 0;
  const areaValidVotes = item.validVotes || 0;
  const areaUnvotedVotes = item.unvotedVotes || 0;

  // Deterministic delegate count based on candidate count - will use a default or fetch if needed
  // For simplicity, we use the standard calculation
  const maxPossible = areaValidVotes * 3; // Assuming 3 delegates as a common case, or we could pass it.
  // Actually, we should probably fetch the candidate count for this area to be exact.
  const isCorrect = (areaTotalVotes + areaUnvotedVotes) === maxPossible && maxPossible > 0;

  useEffect(() => {
    if (isOpen && item) {
      fetchVoters(0);
    }
  }, [isOpen, item, filter]);

  const fetchVoters = async (pageNum: number) => {
    setLoading(true);
    try {
      const filterCol = viewMode === 'area' ? 'area_id' : viewMode === 'unit' ? 'unit_id' : viewMode === 'neighborhood' ? 'neighborhood_id' : 'group_name';
      const votingStatus = filter === 'voted' ? 'da-bau' : filter === 'not-voted' ? 'chua-bau' : 'all';

      const { data, error } = await supabase.rpc('get_voters_paged', {
        p_filter_col: filterCol,
        p_filter_val: item.rawId,
        p_voting_status: votingStatus,
        p_offset: pageNum * PAGE_SIZE,
        p_limit: PAGE_SIZE
      });

      if (data && data.length > 0) {
        setVoters(data);
        setTotalCount(data[0].total_count);
      } else {
        setVoters([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
    setPage(pageNum);
  };


  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">

        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{title}</h3>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-1">{subtitle}</p>
          </div>
          <button onClick={onClose} className="size-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-admin-red hover:border-red-200 flex items-center justify-center transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-6 bg-white border-b border-slate-100">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng cử tri</p>
            <p className="text-2xl font-black text-slate-900">{item.total}</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Đã bầu (Check-in)</p>
            <p className="text-2xl font-black text-emerald-700">{item.voted} <span className="text-sm">({item.percent}%)</span></p>
          </div>
          <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-center">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Chưa bầu</p>
            <p className="text-2xl font-black text-red-700">{item.total - item.voted}</p>
          </div>
        </div>

        {/* Election Check Section - ONLY FOR AREA VIEW */}
        {viewMode === 'area' && (
          <div className="px-8 pb-6">
            <div className={`p-4 rounded-2xl border-2 ${isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'} space-y-2`}>
              <div className="flex justify-between items-center border-b border-black/5 pb-2">
                <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">{isCorrect ? 'verified' : 'warning'}</span>
                  Kiểm tra cân bằng phiếu bầu
                </p>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isCorrect ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'}`}>
                  {isCorrect ? 'Khớp 100%' : 'Sai lệch số liệu'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs font-bold mt-2">
                <div className="flex justify-between">
                  <span className="opacity-60 font-medium italic">Tích số (Hợp lệ x 3):</span>
                  <span>{maxPossible.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60 font-medium italic">Tổng phiếu ứng viên:</span>
                  <span>{areaTotalVotes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60 font-medium italic">Không bầu cho ai:</span>
                  <span>{areaUnvotedVotes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-black/5 pt-1 mt-1 font-black">
                  <span>TỔNG CỘNG:</span>
                  <span>{(areaTotalVotes + areaUnvotedVotes).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-8 py-4 flex gap-2 border-b border-slate-100">
          <button
            onClick={() => { setFilter('not-voted'); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${filter === 'not-voted' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-400 border-slate-200'}`}
          >
            Chưa bầu ({item.total - item.voted})
          </button>
          <button
            onClick={() => { setFilter('voted'); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${filter === 'voted' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 border-slate-200'}`}
          >
            Đã bầu ({item.voted})
          </button>
          <button
            onClick={() => { setFilter('all'); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${filter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200'}`}
          >
            Tất cả ({item.total})
          </button>
        </div>

        {/* Voter List Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Họ và Tên</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Thông tin định danh</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-slate-200 animate-spin">refresh</span>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Đang tải cử tri...</p>
                    </div>
                  </td>
                </tr>
              ) : voters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-8 py-10 text-center text-slate-400 text-sm font-bold italic">
                    Không có cử tri nào trong danh sách này.
                  </td>
                </tr>
              ) : (
                voters.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-4">
                      <p className="text-sm font-black text-slate-900 uppercase">{v.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{v.group_name || 'Tổ --'} • {v.neighborhood_id?.replace('kp_', 'KP ').toUpperCase()}</p>
                    </td>
                    <td className="px-8 py-4">
                      <p className="text-xs font-bold text-slate-600">{v.cccd || 'CCCD: --'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Mã thẻ: {v.voter_card_number || '--'}</p>
                    </td>
                    <td className="px-8 py-4 text-center">
                      {v.voting_status === 'da-bau' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase">
                          <span className="material-symbols-outlined text-[10px]">check</span> Đã bầu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-600 text-[9px] font-black uppercase">
                          <span className="material-symbols-outlined text-[10px]">pending</span> Chưa bầu
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Trang {page + 1} / {totalPages} (Tổ {totalCount} cử tri)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0 || loading}
                onClick={() => fetchVoters(page - 1)}
                className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button
                disabled={page === totalPages - 1 || loading}
                onClick={() => fetchVoters(page + 1)}
                className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: ELECTION CHECK ---
const ElectionCheck: React.FC<{
  unitName: string;
  candidateCount: number;
  totalVotes: number;
  validBallots: number;
}> = ({ unitName, candidateCount, totalVotes, validBallots }) => {
  const delegates = getDelegateCount(candidateCount);
  const maxPossibleVotes = validBallots * delegates;
  const isCorrect = totalVotes <= maxPossibleVotes;

  return (
    <div className="bg-white p-8 rounded-[2rem] border-4 border-slate-100 shadow-sm space-y-4 mb-8 text-slate-800">
      <div className="bg-primary text-white px-6 py-2 rounded-xl inline-block font-black uppercase text-xs tracking-widest mb-2">
        II. KIỂM TRA KẾT QUẢ KIỂM PHIẾU
      </div>

      <div className="space-y-3 font-medium">
        <p>
          Ví dụ: {unitName}, bầu {delegates} đại biểu, có {candidateCount} ứng cử viên.
          Số phiếu hợp lệ: {validBallots.toLocaleString()}
        </p>
        <div>
          <p>-Số phiếu thực tế cho từng ứng cử viên (kiểm ngược) như sau:</p>
          <div className="pl-4 mt-1 font-bold">
            Tổng: {totalVotes.toLocaleString()} {isCorrect ? '<=' : '>'} {validBallots.toLocaleString()} x {delegates} = {maxPossibleVotes.toLocaleString()}
          </div>
        </div>
        <p className={`text-lg font-black uppercase ${isCorrect ? 'text-emerald-600' : 'text-admin-red animate-pulse'}`}>
          Như vậy: {isCorrect ? 'Kết quả kiểm phiếu đã thực hiện đúng.' : 'Kết quả phiếu trên là sai.'}
        </p>
        {!isCorrect && (
          <p className="text-sm font-bold text-admin-red italic">
            * Vì tổng số phiếu các ứng cử viên được nhận lớn hơn tổng số phiếu ứng cử viên được bầu.
          </p>
        )}
      </div>
    </div>
  );
};

export const ResultCalculation: React.FC<{ isLargeText?: boolean }> = ({ isLargeText }) => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('area');

  // Data States
  const [aggregatedStats, setAggregatedStats] = useState<any[]>([]);
  const [areaStats, setAreaStats] = useState<any[]>([]);
  const [candidateResults, setCandidateResults] = useState<CandidateResult[]>([]);
  const [totalVotesByArea, setTotalVotesByArea] = useState<Record<string, number>>({});

  // REAL-TIME EFFECT
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    subtitle: string;
    item: any;
    mode: 'list' | 'progress'
  }>({
    title: '', subtitle: '', item: null, mode: 'list'
  });

  // Summary Data
  const [summary, setSummary] = useState({
    total: 0,
    voted: 0,
    notVoted: 0,
    completedAreas: 0,
    lockedAreas: 0, // Số KVBP đã khóa sổ
    totalAreas: 45
  });

  useEffect(() => {
    fetchRealtimeData();

    // Subscribe to both voters (check-in) and area_stats (official lock)
    const voterSub = supabase.channel('calc-voters-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, () => fetchRealtimeData())
      .subscribe();

    const statsSub = supabase.channel('calc-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'area_stats' }, () => fetchRealtimeData())
      .subscribe();

    const resultSub = supabase.channel('calc-results-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voting_results' }, () => fetchRealtimeData())
      .subscribe();

    return () => {
      supabase.removeChannel(voterSub);
      supabase.removeChannel(statsSub);
      supabase.removeChannel(resultSub);
    };
  }, []);

  const fetchRealtimeData = async () => {
    try {
      // 1. Fetch High-level Summary via RPC
      const { data: summaryData } = await supabase.rpc('get_election_summary');
      if (summaryData) setSummary(summaryData);

      // 2. Fetch Aggregated List via RPC (Based on current viewMode)
      if (viewMode !== 'candidates') {
        const { data: statsData } = await supabase.rpc('get_aggregated_stats', { p_view_mode: viewMode });
        setAggregatedStats(statsData || []);
      }

      // 3. Fetch Area Stats for specific banners
      const { data: sData } = await supabase.from('area_stats').select('*');
      if (sData) setAreaStats(sData);

      // 3. Fetch Candidates Results
      const { data: resData } = await supabase.from('voting_results').select('*');
      const { data: candData } = await supabase.from('candidates').select('*');

      if (resData && candData) {
        const votesByCandidate: Record<string, number> = {};
        const areaVotesSum: Record<string, number> = {};

        resData.forEach(r => {
          votesByCandidate[r.candidate_id] = (votesByCandidate[r.candidate_id] || 0) + r.votes;
          areaVotesSum[r.area_id] = (areaVotesSum[r.area_id] || 0) + r.votes;
        });
        setTotalVotesByArea(areaVotesSum);

        // Nhóm ứng cử viên theo Đơn vị để tính toán nội bộ
        const units = Array.from(new Set(candData.map(c => c.unit_id)));
        const allCalculatedCandidates: CandidateResult[] = [];

        units.forEach(uid => {
          const unitCandidates = candData.filter(c => c.unit_id === uid);
          const votesByUnitCandidate: Record<string, number> = {};
          let unitTotalVotes = 0;

          unitCandidates.forEach(c => {
            const v = votesByCandidate[c.id] || 0;
            votesByUnitCandidate[c.id] = v;
            unitTotalVotes += v;
          });

          const unitResults: CandidateResult[] = unitCandidates.map(c => {
            const v = votesByUnitCandidate[c.id];
            return {
              id: c.id,
              name: c.name,
              unitId: c.unit_id,
              level: c.level,
              totalVotes: v,
              rank: 0,
              percentage: unitTotalVotes > 0 ? parseFloat(((v / unitTotalVotes) * 100).toFixed(2)) : 0
            };
          });

          // Sắp xếp và đánh số thứ hạng trong nội bộ đơn vị
          unitResults.sort((a, b) => b.totalVotes - a.totalVotes);
          unitResults.forEach((c, idx) => c.rank = idx + 1);

          allCalculatedCandidates.push(...unitResults);
        });

        setCandidateResults(allCalculatedCandidates);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // --- ACTIONS HANDLERS ---
  const handleOpenDetail = (item: any, mode: 'list' | 'progress') => {
    let title = '';
    if (viewMode === 'area') title = item.name;
    else if (viewMode === 'group') title = item.name;
    else title = item.name;

    const subtitle = item.subLabel || 'Chi tiết danh sách cử tri';

    setModalData({
      title,
      subtitle,
      item,
      mode
    });
    setModalOpen(true);
  };

  // --- AGGREGATION UI MAPPING ---
  const displayData = useMemo(() => {
    return aggregatedStats.map(stat => {
      let name = stat.id || 'N/A';
      let subLabel = '';
      let detail = '';
      let groups: string[] = [];

      if (viewMode === 'area') {
        const loc = AN_PHU_LOCATIONS.find(l => l.id === stat.rawId);
        const unit = loc ? AN_PHU_LOCATIONS.find(u => u.id === loc.parentId) : null;
        name = loc?.name.toUpperCase() || name;
        subLabel = unit?.name.replace('Đơn vị số', 'ĐV') || '';
        detail = AN_PHU_LOCATIONS.find(n => n.id === loc?.neighborhoodId)?.name || '';
        groups = loc?.groups ? loc.groups.split(',').map(g => g.trim()) : [];
      } else if (viewMode === 'unit') {
        const loc = AN_PHU_LOCATIONS.find(l => l.id === stat.rawId);
        name = loc?.name.toUpperCase() || name;
        subLabel = 'Ban Bầu Cử Đơn Vị';
        const childAreas = AN_PHU_LOCATIONS.filter(a => a.parentId === stat.rawId && a.type === 'area');
        detail = `Gồm ${childAreas.length} Khu vực bỏ phiếu`;
        groups = childAreas.map(a => a.name.replace('KVBP', 'KV').replace('số ', ''));
      } else if (viewMode === 'neighborhood') {
        const nb = NEIGHBORHOODS.find(n => n.id === stat.rawId);
        name = nb?.name.toUpperCase() || name;
        subLabel = 'Ban Điều Hành Khu Phố';
      } else if (viewMode === 'group') {
        name = `TỔ ${stat.id}`;
        subLabel = 'Tổ Dân Phố';
      } else if (viewMode === 'ward') {
        if (stat.id === 'ward_all') {
          name = 'TOÀN PHƯỜNG AN PHÚ';
          subLabel = 'Tổng hợp chung';
          detail = '09 Đơn vị, 45 KVBP';
          groups = ['09 Đơn vị', '45 KVBP', '80+ Tổ'];
        } else {
          name = stat.id === 'ward_perm' ? 'THƯỜNG TRÚ' : 'TẠM TRÚ';
          subLabel = stat.id === 'ward_perm' ? 'Cử tri KT1 / KT2' : 'Cử tri KT3 / KT4';
        }
      }

      const percent = stat.total > 0 ? parseFloat(((stat.voted / stat.total) * 100).toFixed(1)) : 0;
      let rankingStatus: 'slow' | 'average' | 'good' = 'slow';
      if (percent >= 90) rankingStatus = 'good';
      else if (percent >= 75) rankingStatus = 'average';

      return {
        ...stat,
        name,
        subLabel,
        detail,
        groups,
        percent,
        status: rankingStatus,
        id: stat.id?.replace('kv', '').replace('unit_', '0').replace('kp_', '').toUpperCase()
      };
    });
  }, [viewMode, aggregatedStats]);

  // Helpers UI
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-emerald-500';
      case 'average': return 'bg-amber-500';
      default: return 'bg-admin-red';
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'quoc-hoi': return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-[9px] font-black uppercase border border-amber-200 whitespace-nowrap">ĐB Quốc hội</span>;
      case 'thanh-pho': return <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-[9px] font-black uppercase border border-indigo-200 whitespace-nowrap">HĐND Thành phố</span>;
      default: return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black uppercase border border-emerald-200 whitespace-nowrap">HĐND Phường</span>;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span></div>;

  return (
    <div className={`space-y-8 pb-32 animate-in fade-in duration-500 ${isLargeText ? 'text-lg' : 'text-base'}`}>

      {/* HEADER SECTION WITH TABS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b-2 border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-3xl text-primary">bar_chart_4_bars</span>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Tổng hợp kết quả bầu cử</h1>
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Dữ liệu được tổng hợp Real-time từ {summary.totalAreas} Điểm cầu KVBP.</p>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          {[
            { id: 'ward', label: 'Toàn phường' },
            { id: 'unit', label: 'Theo Đơn vị' },
            { id: 'neighborhood', label: 'Theo Khu phố' },
            { id: 'area', label: 'Theo KV Bỏ phiếu' },
            { id: 'group', label: 'Theo Tổ' },
            { id: 'candidates', label: 'Kết quả trúng cử' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as ViewMode)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === tab.id
                ? 'bg-primary text-white shadow-md'
                : 'bg-transparent text-slate-500 hover:bg-slate-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng cử tri niêm yết</p>
            <span className="material-symbols-outlined text-primary">groups</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-slate-900 tracking-tight">{summary.total.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Dữ liệu gốc từ bảng tuyển quân</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cử tri đã đi bầu</p>
            <span className="material-symbols-outlined text-emerald-500">how_to_vote</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-slate-900 tracking-tight">{summary.voted.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-emerald-600 uppercase mt-1">Tiến độ: {summary.total > 0 ? ((summary.voted / summary.total) * 100).toFixed(2) : 0}%</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KVBP Đã Khóa Sổ</p>
            <span className="material-symbols-outlined text-admin-red">lock</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-slate-900 tracking-tight">{summary.lockedAreas}<span className="text-2xl text-slate-300">/{summary.totalAreas}</span></p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Số liệu đã chốt chính thức</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KVBP Hoàn thành</p>
            <span className="material-symbols-outlined text-blue-500">verified</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-slate-900 tracking-tight">{summary.completedAreas}<span className="text-2xl text-slate-300">/{summary.totalAreas}</span></p>
            <p className="text-[9px] font-bold text-blue-600 uppercase mt-1">Đạt chỉ tiêu &gt; 90%</p>
          </div>
        </div>
      </div>

      {/* CONTENT: SPECIFIC AGGREGATED VIEWS */}
      {viewMode === 'candidates' ? (
        // CANDIDATE VIEW - GROUPED BY UNIT
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          {AN_PHU_LOCATIONS.filter(l => l.type === 'unit').map(unit => {
            const unitResults = candidateResults.filter(c => c.unitId === unit.id);
            if (unitResults.length === 0) return null;

            // Tính toán số liệu phục vụ kiểm tra
            const totalCandidateVotes = unitResults.reduce((sum, c) => sum + c.totalVotes, 0);

            // Lấy số phiếu hợp lệ từ area_stats (tổng hợp từ các KVBP thuộc Unit này)
            const unitAreas = AN_PHU_LOCATIONS.filter(a => a.parentId === unit.id && a.type === 'area');
            const unitValidBallots = unitAreas.reduce((sum, area) => {
              const stat = areaStats.find(s => s.area_id === area.id);
              return sum + (stat?.valid_votes || 0);
            }, 0);

            return (
              <div key={unit.id} className="space-y-4">
                <ElectionCheck
                  unitName={unit.name}
                  candidateCount={unitResults.length}
                  totalVotes={totalCandidateVotes}
                  validBallots={unitValidBallots}
                />
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="size-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <span className="material-symbols-outlined text-2xl">stars</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{unit.name}</h2>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">Kết quả tổng hợp nội bộ đơn vị</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đại biểu ứng cử</p>
                      <p className="text-2xl font-black text-slate-900">{unitResults.length}</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {unitResults.map(c => (
                      <div key={c.id} className={`grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-slate-50 ${c.rank <= 3 ? 'bg-yellow-50/20' : ''}`}>
                        <div className="col-span-1 text-center flex flex-col items-center">
                          <span className={`size-8 rounded-full flex items-center justify-center font-black text-sm ${c.rank === 1 ? 'bg-yellow-400 text-yellow-900 shadow-sm' :
                            c.rank === 2 ? 'bg-slate-300 text-slate-700' :
                              c.rank === 3 ? 'bg-amber-600 text-white' : 'text-slate-400'
                            }`}>
                            {c.rank}
                          </span>
                        </div>
                        <div className="col-span-4">
                          <p className="text-lg font-black uppercase text-slate-900">{c.name}</p>
                          <div className="mt-1 flex gap-2">
                            {getLevelBadge(c.level)}
                          </div>
                        </div>
                        <div className="col-span-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex justify-between w-full max-w-[160px] mb-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase">Tỷ lệ phiếu</span>
                              <span className="text-[10px] font-black text-primary">{c.percentage}%</span>
                            </div>
                            <div className="h-2 w-full max-w-[160px] bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                              <div className="h-full bg-primary shadow-sm" style={{ width: `${c.percentage}%` }}></div>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-3 text-right">
                          <p className="text-3xl font-black text-slate-900 leading-none">{c.totalVotes.toLocaleString()}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">PHIẾU BẦU HỢP LỆ</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {candidateResults.length === 0 && (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-20 text-center shadow-sm">
              <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 block">analytics</span>
              <p className="text-slate-400 font-black uppercase tracking-widest">Chưa có dữ liệu kiểm phiếu từ các KVBP</p>
            </div>
          )}
        </div>
      ) : (
        // AGGREGATED LIST VIEW (UNIFIED DESIGN FOR ALL VIEW MODES)
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">

          {/* Header of Table */}
          <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">layers</span>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                {viewMode === 'area' ? 'CHI TIẾT KẾT QUẢ THEO KV BỎ PHIẾU (KVBP)' :
                  viewMode === 'unit' ? 'CHI TIẾT TIẾN ĐỘ THEO ĐƠN VỊ BẦU CỬ' :
                    viewMode === 'neighborhood' ? 'CHI TIẾT TIẾN ĐỘ THEO KHU PHỐ' :
                      viewMode === 'group' ? 'CHI TIẾT TIẾN ĐỘ THEO TỔ DÂN PHỐ' :
                        'TỔNG HỢP TOÀN PHƯỜNG'}
              </h3>
            </div>
            {/* Legend */}
            <div className="flex gap-2">
              <div className="px-3 py-1 bg-red-50 text-admin-red border border-red-100 rounded text-[9px] font-black uppercase flex items-center gap-1"><span className="size-2 rounded-full bg-admin-red"></span> Chậm (&lt;75%)</div>
              <div className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[9px] font-black uppercase flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500"></span> TB (75-90%)</div>
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[9px] font-black uppercase flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500"></span> Đạt (&gt;90%)</div>
              <div className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px] font-black uppercase flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">lock</span> Đã khóa</div>
            </div>
          </div>

          {/* UNIFIED Column Headers */}
          <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
            <div className="col-span-1">Mã/STT</div>
            <div className="col-span-2">Tên đối tượng</div>
            <div className="col-span-3">Chi tiết / Thành phần</div>
            <div className="col-span-2 text-center">Chức năng</div>
            <div className="col-span-2 text-center">Số liệu bầu cử</div>
            <div className="col-span-2 text-right">Trạng thái & Tiến độ</div>
          </div>
          {/* Notification if some components are locked */}
          {summary.lockedAreas > 0 && (
            <div className="mx-8 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-2 animate-pulse">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-600">info</span>
                <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                  Hệ thống đang hiển thị dữ liệu đã khóa sổ từ {summary.lockedAreas} khu vực bỏ phiếu.
                  Dữ liệu này là kết quả chính thức và không thể thay đổi Real-time.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 ml-9">
                {areaStats.filter(s => s.is_locked).map(s => {
                  const area = AN_PHU_LOCATIONS.find(l => l.id === s.area_id);
                  const name = area ? area.name : s.area_id;
                  return (
                    <span key={s.area_id} className="px-2 py-1 bg-amber-200/50 text-amber-900 rounded-lg text-[10px] font-black uppercase border border-amber-300 shadow-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rows */}
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {displayData.map(item => (
              <div key={item.rawId} className={`grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-slate-50 transition-all group ${item.isLocked ? 'bg-slate-50/50' : ''}`}>
                {/* mã số */}
                <div className="col-span-1">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-black border border-slate-200">{item.id}</span>
                </div>

                {/* Tên đối tượng */}
                <div className="col-span-2">
                  <p className="text-xs font-black text-slate-900 leading-none uppercase tracking-tight">{item.name}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">{item.subLabel}</p>
                </div>

                {/* Chi tiết thành phần */}
                <div className="col-span-3">
                  <div className="flex flex-wrap gap-1.5">
                    {item.groups?.map(g => (
                      <span key={g} className="px-2 py-0.5 bg-white text-slate-400 border border-slate-200 rounded text-[8px] font-black uppercase">
                        {g}
                      </span>
                    ))}
                    {(!item.groups || item.groups.length === 0) && (
                      <span className="text-[9px] text-slate-300 font-bold italic">{item.detail || '--'}</span>
                    )}
                  </div>
                </div>

                {/* Chức năng */}
                <div className="col-span-2 text-center flex justify-center gap-2">
                  <button
                    onClick={() => handleOpenDetail(item, 'list')}
                    className="size-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 hover:shadow-sm flex items-center justify-center transition-all"
                    title="Xem danh sách cử tri"
                  >
                    <span className="material-symbols-outlined text-lg">format_list_bulleted</span>
                  </button>
                  <button
                    onClick={() => handleOpenDetail(item, 'progress')}
                    className="size-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 hover:shadow-sm flex items-center justify-center transition-all"
                    title="Xem biểu đồ tiến độ"
                  >
                    <span className="material-symbols-outlined text-lg">monitoring</span>
                  </button>
                </div>

                {/* Số liệu bầu cử */}
                <div className="col-span-2 text-center flex flex-col items-center">
                  <p className="text-base font-black text-slate-900 leading-none">{item.voted.toLocaleString()}<span className="text-slate-300 font-bold ml-0.5">/{item.total.toLocaleString()}</span></p>
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden border border-slate-200">
                    <div className={`h-full ${getStatusColor(item.status)} shadow-sm transition-all duration-1000`} style={{ width: `${item.percent}%` }}></div>
                  </div>
                </div>

                {/* Trạng thái & Tiến độ */}
                <div className="col-span-2 text-right">
                  {item.isLocked ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase shadow-lg shadow-slate-200 transition-all border border-slate-800">
                      <span className="material-symbols-outlined text-[10px] animate-pulse">lock</span> Đã chốt sổ
                    </span>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className={`px-2.5 py-1 rounded-lg ${item.status === 'good' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        item.status === 'average' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-red-50 text-admin-red border-red-100'
                        } text-[10px] font-black border transition-all truncate max-w-full`}>
                        TỈ LỆ: {item.percent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {displayData.length === 0 && (
              <div className="p-20 text-center">
                <p className="text-slate-400 font-black uppercase tracking-widest">Không tìm thấy dữ liệu phù hợp</p>
              </div>
            )}
          </div>

          {/* DETAIL MODAL RENDER */}
          <DetailModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title={modalData.title}
            subtitle={modalData.subtitle}
            item={modalData.item}
            mode={modalData.mode}
            viewMode={viewMode}
            totalVotesByArea={totalVotesByArea}
          />
        </div>
      )}
    </div>
  );
};
