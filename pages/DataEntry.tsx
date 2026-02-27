import React, { useState, useMemo, useEffect } from 'react';
import { AN_PHU_LOCATIONS } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { createLog } from '../lib/logger';
import { getDelegateCount } from '../lib/voting';

export const DataEntry: React.FC<{ isLargeText?: boolean }> = ({ isLargeText }) => {
  const { profile } = useAuth();
  const [selection, setSelection] = useState({ unit: '', area: '' });
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [generalData, setGeneralData] = useState({
    totalVoters: 0,
    issuedVotes: 0,
    receivedVotes: 0,
    validVotes: 0,
    invalidVotes: 0,
    unvotedVotes: 0
  });
  const [candidateVotes, setCandidateVotes] = useState<Record<string, number>>({});
  const [scratchedVotes, setScratchedVotes] = useState<Record<string, number>>({});
  const [isLocked, setIsLocked] = useState(false);

  // --- LOGIC: PERMISSION-BASED SCOPE ---
  const isRestricted = useMemo(() => {
    return profile?.role === 'to_bau_cu' || profile?.role === 'nhap_lieu';
  }, [profile]);

  useEffect(() => {
    if (isRestricted && profile) {
      setSelection({
        unit: profile.unitId || '',
        area: profile.areaId || ''
      });
    }
  }, [isRestricted, profile]);

  useEffect(() => {
    if (selection.unit) fetchCandidates();
  }, [selection.unit]);

  useEffect(() => {
    if (selection.area) fetchAreaData();
  }, [selection.area]);

  const fetchCandidates = async () => {
    // Candidates now have 'level' field
    const { data } = await supabase.from('candidates').select('*').eq('unit_id', selection.unit).order('level', { ascending: false }).order('name');
    setCandidates(data || []);
  };

  const fetchAreaData = async () => {
    setLoading(true);
    // 1. Lấy stats chung
    const { data: stats } = await supabase.from('area_stats').select('*').eq('area_id', selection.area).single();

    if (stats) {
      setGeneralData({
        totalVoters: stats.total_voters || 0,
        issuedVotes: stats.issued_votes || 0,
        receivedVotes: stats.received_votes || 0,
        validVotes: stats.valid_votes || 0,
        invalidVotes: stats.invalid_votes || 0,
        unvotedVotes: stats.unvoted_votes || 0
      });
      setIsLocked(stats.is_locked);
    } else {
      // Nếu chưa có, đếm số cử tri trong bảng voters
      const { count } = await supabase.from('voters').select('*', { count: 'exact', head: true }).eq('area_id', selection.area);
      setGeneralData({ totalVoters: count || 0, issuedVotes: 0, receivedVotes: 0, validVotes: 0, invalidVotes: 0, unvotedVotes: 0 });
      setIsLocked(false);
    }

    // 2. Lấy kết quả bầu cử ứng viên
    const { data: results } = await supabase.from('voting_results').select('*').eq('area_id', selection.area);
    if (results) {
      const voteMap: Record<string, number> = {};
      const scratchMap: Record<string, number> = {};
      results.forEach(r => {
        voteMap[r.candidate_id] = r.votes;
        scratchMap[r.candidate_id] = r.scratched_votes || 0;
      });
      setCandidateVotes(voteMap);
      setScratchedVotes(scratchMap);
    } else {
      setCandidateVotes({});
      setScratchedVotes({});
    }
    setLoading(false);
  };

  // Hàm Lưu Bản Nháp (Không khóa)
  const handleSaveDraft = async () => {
    if (isLocked) {
      alert('Dữ liệu đã bị khóa. Vui lòng mở khóa trước khi chỉnh sửa bản nháp.');
      return;
    }
    await processSave(false);
  };

  // Hàm Khóa Sổ Liệu (Chốt)
  const handleLockData = async () => {
    if (!window.confirm('CẢNH BÁO QUAN TRỌNG:\n\nBạn có chắc chắn muốn KHÓA SỔ LIỆU này?\n- Kết quả sẽ được chuyển sang trạng thái "Chính thức".\n- Dữ liệu sẽ được tổng hợp ngay lập tức.\n- Bạn không thể chỉnh sửa trừ khi mở khóa lại.')) return;
    await processSave(true);
  };

  // Logic lưu chung vào DB
  const processSave = async (lockStatus: boolean) => {
    // Validate cơ bản
    if (generalData.receivedVotes > generalData.issuedVotes) {
      alert('Cảnh báo dữ liệu: Số phiếu thu về không được lớn hơn số phiếu phát ra!');
      return;
    }

    setLoading(true);

    try {
      const timestamp = new Date().toISOString();

      // 1. Lưu area_stats (Bao gồm cả total_voters để snapshot)
      const { error: statsError } = await supabase.from('area_stats').upsert({
        area_id: selection.area,
        total_voters: generalData.totalVoters,
        issued_votes: generalData.issuedVotes,
        received_votes: generalData.receivedVotes,
        valid_votes: generalData.validVotes,
        invalid_votes: generalData.invalidVotes,
        unvoted_votes: generalData.unvotedVotes,
        is_locked: lockStatus,
        updated_at: timestamp
      });
      if (statsError) throw new Error(`Lỗi lưu thống kê chung: ${statsError.message}`);

      // 2. Lưu voting_results
      // QUAN TRỌNG: Duyệt qua danh sách candidates gốc để đảm bảo lưu đủ (kể cả 0 phiếu)
      const resultsPayload = candidates.map(c => ({
        area_id: selection.area,
        candidate_id: c.id,
        votes: candidateVotes[c.id] || 0,
        scratched_votes: scratchedVotes[c.id] || 0,
        is_locked: lockStatus,
        updated_at: timestamp
      }));

      if (resultsPayload.length > 0) {
        const { error: resultsError } = await supabase.from('voting_results').upsert(resultsPayload, { onConflict: 'area_id,candidate_id' });
        if (resultsError) throw new Error(`Lỗi lưu chi tiết phiếu bầu: ${resultsError.message}`);
      }

      setIsLocked(lockStatus);

      if (lockStatus) {
        alert('ĐÃ KHÓA SỔ THÀNH CÔNG!\nDữ liệu đã được bảo vệ và gửi đi tổng hợp.');
      } else {
        alert('Đã lưu bản nháp thành công.');
      }

      // LOGGING
      createLog({
        userName: profile?.fullName || profile?.role,
        action: lockStatus ? 'KHÓA SỔ LIỆU' : 'LƯU BẢN NHÁP',
        details: `${lockStatus ? 'Khóa' : 'Lưu'} kết quả tại ${selection.area}. Cử tri đi bầu: ${generalData.receivedVotes}`,
        status: 'success'
      });

    } catch (err: any) {
      console.error(err);
      alert('CÓ LỖI XẢY RA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Hàm Mở Khóa (Sửa lại số liệu)
  const handleUnlock = async () => {
    if (!window.confirm('YÊU CẦU XÁC NHẬN:\n\nBạn muốn MỞ KHÓA để sửa lại số liệu?\nHành động này sẽ chuyển trạng thái về "Bản nháp" và tạm thời gỡ bỏ khỏi báo cáo chính thức.')) return;

    setLoading(true);
    try {
      // Cập nhật trạng thái is_locked = false cho cả stats và results
      const { error: statsError } = await supabase.from('area_stats').update({ is_locked: false }).eq('area_id', selection.area);
      if (statsError) throw new Error(`Lỗi mở khóa thống kê: ${statsError.message}`);

      const { error: resultsError } = await supabase.from('voting_results').update({ is_locked: false }).eq('area_id', selection.area);
      if (resultsError) throw new Error(`Lỗi mở khóa chi tiết: ${resultsError.message}`);

      setIsLocked(false);
      alert('Đã mở khóa thành công. Bạn có thể chỉnh sửa lại số liệu.');

      // LOGGING
      createLog({
        userName: profile?.fullName || profile?.role,
        action: 'MỞ KHÓA SỐ LIỆU',
        details: `Mở khóa để sửa lại tại ${selection.area}`,
        status: 'success'
      });
    } catch (err: any) {
      alert('Lỗi khi mở khóa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // HANDLER: Khi nhập phiếu bầu (Thuận)
  const handleVoteChange = (candidateId: string, value: number) => {
    setCandidateVotes(prev => ({ ...prev, [candidateId]: value }));
    // Tính ngược: Bị gạch = Hợp lệ - Bầu
    const scratch = Math.max(0, generalData.validVotes - value);
    setScratchedVotes(prev => ({ ...prev, [candidateId]: scratch }));
  };

  // HANDLER: Khi nhập phiếu bị gạch (Nghịch)
  const handleScratchedChange = (candidateId: string, value: number) => {
    setScratchedVotes(prev => ({ ...prev, [candidateId]: value }));
    // Tính thuận: Bầu = Hợp lệ - Bị gạch
    const votes = Math.max(0, generalData.validVotes - value);
    setCandidateVotes(prev => ({ ...prev, [candidateId]: votes }));
  };

  const totalEnteredVotes = useMemo(() => {
    return Object.values(candidateVotes).reduce((sum: number, v: number) => sum + v, 0);
  }, [candidateVotes]);

  const delegates = useMemo(() => {
    return getDelegateCount(candidates.length);
  }, [candidates.length]);

  const maxPossibleVotes = useMemo(() => {
    return generalData.validVotes * delegates;
  }, [generalData.validVotes, delegates]);

  const isVotesError = useMemo(() => {
    if (generalData.validVotes === 0) return false;
    // Cân bằng: Tổng phiếu bầu cho ứng viên + Số phiếu không bầu cho ai = Số phiếu hợp lệ * Số đại biểu
    return (totalEnteredVotes + generalData.unvotedVotes) !== maxPossibleVotes;
  }, [totalEnteredVotes, generalData.unvotedVotes, maxPossibleVotes]);

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'quoc-hoi': return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-[9px] font-black uppercase border border-amber-200 whitespace-nowrap">ĐB Quốc hội</span>;
      case 'thanh-pho': return <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-[9px] font-black uppercase border border-indigo-200 whitespace-nowrap">HĐND Thành phố</span>;
      default: return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black uppercase border border-emerald-200 whitespace-nowrap">HĐND Phường</span>;
    }
  };

  return (
    <div className="space-y-10 pb-40 animate-in fade-in duration-500">
      <div className="border-b-4 border-primary pb-6">
        <h1 className="text-3xl font-black uppercase text-slate-900">Nhập liệu kết quả bầu cử</h1>
        <p className="text-xs font-bold text-slate-500 uppercase mt-2">Xác nhận kết quả thực tế cho 45 KVBP</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chọn Đơn vị bầu cử</label>
          <select
            value={selection.unit}
            onChange={e => setSelection({ ...selection, unit: e.target.value, area: '' })}
            className="w-full h-14 border-2 rounded-2xl px-4 font-black uppercase focus:border-primary outline-none transition-all"
          >
            <option value="">-- Chọn đơn vị --</option>
            {AN_PHU_LOCATIONS.filter(l => l.type === 'unit').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chọn Khu vực bỏ phiếu (KVBP)</label>
          <select
            value={selection.area}
            onChange={e => setSelection({ ...selection, area: e.target.value })}
            className="w-full h-14 border-2 rounded-2xl px-4 font-black uppercase focus:border-primary outline-none transition-all"
            disabled={!selection.unit}
          >
            <option value="">-- Chọn KVBP --</option>
            {AN_PHU_LOCATIONS
              .filter(l => l.parentId === selection.unit && l.type === 'area')
              .map(a => (
                <option key={a.id} value={a.id}>
                  {a.name.toUpperCase()} - {a.locationDetail || 'Địa điểm chưa cập nhật'}
                </option>
              ))
            }
          </select>
        </div>
      </div>

      {selection.area && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">

          <div className="bg-primary/5 p-6 rounded-3xl border border-primary/20 flex items-center gap-4">
            <div className="size-12 bg-white text-primary rounded-xl flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-2xl">location_on</span>
            </div>
            <div>
              <h3 className="text-lg font-black uppercase text-slate-900">
                {AN_PHU_LOCATIONS.find(a => a.id === selection.area)?.name}
              </h3>
              <p className="text-sm font-bold text-slate-600">
                {AN_PHU_LOCATIONS.find(a => a.id === selection.area)?.locationDetail}
              </p>
              <p className="text-xs font-bold text-slate-400 mt-1">
                Tổng cử tri: {generalData.totalVoters.toLocaleString()}
              </p>
            </div>
          </div>

          <div className={`bg-white p-8 rounded-[2.5rem] border-2 shadow-sm space-y-6 relative overflow-hidden ${isLocked ? 'border-admin-red/30' : 'border-slate-100'}`}>
            {isLocked && (
              <div className="absolute top-0 right-0 p-4">
                <span className="material-symbols-outlined text-9xl text-admin-red opacity-5 rotate-12 select-none pointer-events-none">lock</span>
              </div>
            )}

            <h2 className="text-lg font-black uppercase border-b pb-4 flex items-center gap-2">
              Phần II: Số liệu kiểm phiếu
              {isLocked && <span className="px-2 py-0.5 bg-admin-red text-white text-[9px] rounded-full">ĐÃ KHÓA</span>}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
              {[
                { label: 'Phát ra', key: 'issuedVotes' },
                { label: 'Thu về', key: 'receivedVotes' },
                { label: 'Hợp lệ', key: 'validVotes' },
                { label: 'K.Hợp lệ', key: 'invalidVotes' },
                { label: 'Phiếu không bầu cho ai', key: 'unvotedVotes' }
              ].map(item => (
                <div key={item.key} className={item.key === 'unvotedVotes' ? 'md:col-span-2' : ''}>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">{item.label}</label>
                  <input
                    type="number"
                    disabled={isLocked || loading}
                    placeholder="0"
                    value={(generalData as any)[item.key] || ''}
                    onChange={e => setGeneralData({ ...generalData, [item.key]: parseInt(e.target.value) || 0 })}
                    className={`w-full h-12 border-2 rounded-xl px-4 font-bold focus:border-primary outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={`bg-white p-8 rounded-[2.5rem] border-2 shadow-sm relative ${isLocked ? 'border-admin-red/30' : 'border-slate-100'}`}>
            {isVotesError && (
              <div className="absolute inset-0 bg-red-600/5 backdrop-blur-[1px] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-300 z-20">
                <div className="bg-white p-8 rounded-[2rem] border-4 border-admin-red shadow-2xl max-w-lg space-y-4">
                  <span className="material-symbols-outlined text-6xl text-admin-red animate-bounce">warning</span>
                  <h3 className="text-2xl font-black uppercase text-admin-red tracking-tight">Cảnh báo: Sai số liệu kiểm phiếu!</h3>
                  <div className="space-y-2 text-slate-700 font-bold">
                    <p>Tổng phiếu bầu ứng viên (+ Không bầu): <span className="text-admin-red text-xl">{(totalEnteredVotes + generalData.unvotedVotes).toLocaleString()}</span></p>
                    <p>Giới hạn phải đạt: {generalData.validVotes.toLocaleString()} (hợp lệ) x {delegates} (đại biểu) = <span className="text-blue-600 text-xl">{maxPossibleVotes.toLocaleString()}</span></p>
                    <p className="text-sm italic font-medium text-slate-500 mt-4 leading-relaxed tracking-normal bg-slate-50 p-4 rounded-xl">
                      * Nguyên tắc cân bằng: (Tổng phiếu các ứng viên) + (Số phiếu không bầu cho ai) = (Số phiếu hợp lệ) x (Số đại biểu được bầu).
                    </p>
                  </div>
                </div>
              </div>
            )}
            <h2 className="text-lg font-black uppercase border-b pb-4 mb-6 flex items-center gap-2">
              Phần III: Kết quả ứng viên
              {isLocked && <span className="px-2 py-0.5 bg-admin-red text-white text-[9px] rounded-full">READ-ONLY</span>}
              {!isLocked && isVotesError && <span className="px-2 py-0.5 bg-admin-red text-white text-[9px] rounded-full animate-pulse ml-auto">PHÁT HIỆN SAI SỐ LIỆU</span>}
            </h2>
            {candidates.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-bold italic">Chưa có danh sách ứng cử viên cho đơn vị này.</div>
            ) : (
              <table className="w-full relative z-10">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase text-slate-400">
                    <th className="py-4">Ứng cử viên</th>
                    <th className="py-4 text-center">Loại hình</th>
                    <th className="py-4 text-right">Số phiếu bầu</th>
                    <th className="py-4 text-right pr-4">Số phiếu BỊ GẠCH</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {candidates.map(c => (
                    <tr key={c.id}>
                      <td className="py-4 font-black uppercase text-slate-800 text-xs">{c.name}</td>
                      <td className="py-4 text-center">{getLevelBadge(c.level)}</td>
                      <td className="py-4">
                        <input
                          type="number"
                          disabled={isLocked || loading}
                          value={candidateVotes[c.id] !== undefined ? candidateVotes[c.id] : ''}
                          onChange={e => handleVoteChange(c.id, parseInt(e.target.value) || 0)}
                          className={`w-28 h-10 border-2 rounded-lg text-right px-3 font-bold ml-auto block focus:border-indigo-500 outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-4">
                        <input
                          type="number"
                          disabled={isLocked || loading}
                          value={scratchedVotes[c.id] !== undefined ? scratchedVotes[c.id] : ''}
                          onChange={e => handleScratchedChange(c.id, parseInt(e.target.value) || 0)}
                          className={`w-28 h-10 border-2 rounded-lg text-right px-3 font-bold ml-auto block focus:border-red-500 outline-none transition-all ${isLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-red-50 border-red-100 text-red-700'}`}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!isLocked ? (
            <div className="flex justify-end gap-4 pb-10">
              <button
                onClick={handleSaveDraft}
                disabled={loading}
                className="px-8 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black uppercase text-xs text-slate-600 hover:border-primary hover:text-primary transition-all disabled:opacity-50 shadow-sm"
              >
                Lưu bản nháp (Chưa khóa)
              </button>
              <button
                onClick={handleLockData}
                disabled={loading}
                className="px-10 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-primary/30 hover:bg-blue-800 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : <span className="material-symbols-outlined text-lg">lock</span>}
                Khóa số liệu & Tổng hợp
              </button>
            </div>
          ) : (
            <div className="p-6 bg-red-50 text-red-600 border-2 border-red-100 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in zoom-in-95">
              <div className="flex items-center gap-4">
                <div className="size-14 bg-white rounded-2xl flex items-center justify-center text-admin-red shadow-sm">
                  <span className="material-symbols-outlined text-3xl">lock_clock</span>
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-lg">Dữ liệu đã khóa sổ</h3>
                  <p className="text-xs font-bold text-red-400 mt-1">Kết quả đã được tính vào tổng hợp chung.</p>
                </div>
              </div>
              <button
                onClick={handleUnlock}
                disabled={loading}
                className="px-8 py-4 bg-white border-2 border-red-200 text-red-600 rounded-2xl font-black text-xs uppercase hover:bg-red-50 transition-all shadow-sm flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">lock_open</span>
                Mở khóa & Sửa lại
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};