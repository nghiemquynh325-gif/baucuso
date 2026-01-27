
import React, { useState, useEffect, useMemo } from 'react';
import { Voter, AN_PHU_LOCATIONS, NEIGHBORHOODS, VotingStatus, ResidenceStatus } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { createLog } from '../lib/logger';
import { QRScanner } from '../components/QRScanner';
import { useNotification } from '../contexts/NotificationContext';

interface VoterListProps {
    onImportClick?: () => void;
    isLargeText: boolean;
    setIsLargeText: (val: boolean) => void;
}

const ITEMS_PER_PAGE = 50;

export const VoterList: React.FC<VoterListProps> = ({ onImportClick, isLargeText, setIsLargeText }) => {
    const { profile } = useAuth();
    const { showNotification, showConfirm } = useNotification();

    // --- DATA STATES ---
    const [voters, setVoters] = useState<Voter[]>([]);
    const [loading, setLoading] = useState(true);

    // --- FILTER STATES ---
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false); // Toggle bộ lọc nâng cao
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Main Filters (Luôn hiển thị)
    const [filterVoting, setFilterVoting] = useState('all');
    const [filterArea, setFilterArea] = useState('all');
    const [filterCardNumber, setFilterCardNumber] = useState('');

    // Advanced Filters (Ẩn/Hiện)
    const [filterNeighborhood, setFilterNeighborhood] = useState('all');
    const [filterUnit, setFilterUnit] = useState('all');
    const [filterGroup, setFilterGroup] = useState('');
    const [filterResidence, setFilterResidence] = useState('all');

    // --- LOGIC: PERMISSION-BASED SCOPE ---
    const isRestricted = useMemo(() => {
        // NHAP_LIEU should have global view access
        return profile?.role === 'to_bau_cu';
    }, [profile]);

    useEffect(() => {
        if (isRestricted && profile) {
            if (profile.unitId) setFilterUnit(profile.unitId);
            if (profile.areaId) setFilterArea(profile.areaId);

            // Tìm neighborhood tương ứng với areaId
            const location = AN_PHU_LOCATIONS.find(l => l.id === profile.areaId);
            if (location?.neighborhoodId) setFilterNeighborhood(location.neighborhoodId);
        }
    }, [isRestricted, profile]);

    // Modal States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // --- LOGIC: RESET CASCADING FILTERS ---
    // Thứ tự: Đơn vị bỏ phiếu → KVBP → Tổ
    useEffect(() => {
        // Khi thay đổi Đơn vị, reset KVBP và Tổ
        setFilterArea('all');
        setFilterGroup('');
    }, [filterUnit]);

    useEffect(() => {
        // Khi thay đổi KVBP, reset Tổ và Số thẻ
        setFilterGroup('');
        setFilterCardNumber('');
    }, [filterArea]);

    // --- FILTER OPTIONS COMPUTATION ---
    const unitOptions = useMemo(() => {
        if (filterNeighborhood === 'all') return AN_PHU_LOCATIONS.filter(l => l.type === 'unit');
        const validUnitIds = new Set(
            AN_PHU_LOCATIONS
                .filter(l => l.type === 'area' && l.neighborhoodId === filterNeighborhood)
                .map(l => l.parentId)
                .filter(id => id !== undefined) as string[]
        );
        return AN_PHU_LOCATIONS.filter(l => l.type === 'unit' && validUnitIds.has(l.id));
    }, [filterNeighborhood]);

    const areaOptions = useMemo(() => {
        return AN_PHU_LOCATIONS.filter(l => {
            if (l.type !== 'area') return false;
            if (filterUnit !== 'all' && l.parentId !== filterUnit) return false;
            if (filterNeighborhood !== 'all' && l.neighborhoodId !== filterNeighborhood) return false;
            return true;
        });
    }, [filterNeighborhood, filterUnit]);


    // Lấy danh sách Tổ từ dữ liệu thực tế trong database
    const groupOptions = useMemo(() => {
        const groups = new Set<string>();

        // Lọc voters theo các filter hiện tại
        let filteredVoters = voters;
        if (filterNeighborhood !== 'all') {
            filteredVoters = filteredVoters.filter(v => v.neighborhoodId === filterNeighborhood);
        }
        if (filterUnit !== 'all') {
            filteredVoters = filteredVoters.filter(v => v.unitId === filterUnit);
        }
        if (filterArea !== 'all') {
            filteredVoters = filteredVoters.filter(v => v.areaId === filterArea);
        }

        // Lấy tất cả các tổ duy nhất từ dữ liệu
        filteredVoters.forEach(v => {
            if (v.group && v.group.trim()) {
                groups.add(v.group.trim());
            }
        });

        // Sắp xếp theo số tổ
        return Array.from(groups).sort((a, b) => {
            const na = parseInt(a.replace(/[^\d]/g, '')) || 0;
            const nb = parseInt(b.replace(/[^\d]/g, '')) || 0;
            return na - nb;
        });
    }, [voters, filterNeighborhood, filterUnit, filterArea]);


    // --- DATA FETCHING & REALTIME ---
    useEffect(() => {
        fetchVoters();
        const sub = supabase.channel('voter-list-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, (payload) => {
                // Optimistic UI update or Refetch
                fetchVoters();
            })
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [filterNeighborhood, filterUnit, filterArea, filterGroup, filterResidence, filterVoting]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterNeighborhood, filterUnit, filterArea, filterGroup, filterResidence, filterVoting, filterCardNumber]);

    const fetchVoters = async () => {
        setLoading(true);
        let query = supabase.from('voters').select('*');

        // Áp dụng filter server-side
        if (filterNeighborhood !== 'all') query = query.eq('neighborhood_id', filterNeighborhood);
        if (filterUnit !== 'all') query = query.eq('unit_id', filterUnit);
        if (filterArea !== 'all') query = query.eq('area_id', filterArea);
        if (filterGroup && filterGroup !== '') query = query.eq('group_name', filterGroup);
        if (filterResidence !== 'all') query = query.eq('residence_status', filterResidence);
        if (filterVoting !== 'all') query = query.eq('voting_status', filterVoting);

        const { data, error } = await query.order('name', { ascending: true });

        if (!error && data) {
            setVoters(data.map(v => ({
                id: v.id, name: v.name, dob: v.dob, gender: v.gender, cccd: v.cccd, ethnic: v.ethnic,
                voterCardNumber: v.voter_card_number, address: v.address, neighborhoodId: v.neighborhood_id,
                unitId: v.unit_id, areaId: v.area_id, group: v.group_name, residenceStatus: v.residence_status,
                votingStatus: v.voting_status, status: 'hop-le'
            })) as any);
        }
        setLoading(false);
    };

    // --- ACTIONS ---
    const handleUpdateVotingStatus = async (voterId: string, status: VotingStatus) => {
        // Optimistic Update
        setVoters(current => current.map(v => v.id === voterId ? { ...v, votingStatus: status } : v));

        const { error } = await supabase.from('voters').update({ voting_status: status }).eq('id', voterId);

        if (error) {
            console.error('Lỗi cập nhật:', error.message);
            fetchVoters(); // Revert on error
        } else {
            // LOGGING
            const voter = voters.find(v => v.id === voterId);
            createLog({
                userName: profile?.fullName || profile?.role,
                action: 'CẬP NHẬT TRẠNG THÁI BẦU',
                details: `Cử tri: ${voter?.name} (${voter?.cccd}) -> ${status === 'da-bau' ? 'Đã bầu' : 'Chưa bầu'}`,
                status: 'success'
            });
        }
    };

    const handleDeleteVoter = async (voterId: string, name: string, cccd: string) => {
        showConfirm(`Bạn có chắc chắn muốn XÓA cử tri ${name} (CCCD: ${cccd}) khỏi hệ thống?`, {
            onConfirm: async () => {
                const { error } = await supabase.from('voters').delete().eq('id', voterId);

                if (error) {
                    showNotification('Lỗi khi xóa: ' + error.message);
                } else {
                    createLog({
                        userName: profile?.fullName || profile?.role,
                        action: 'XÓA CỬ TRI',
                        details: `Xóa cử tri: ${name} (CCCD: ${cccd})`,
                        status: 'success'
                    });
                    fetchVoters();
                }
            }
        });
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        // Có thể thêm toast notification ở đây
    };

    const handleOpenEdit = (voter: Voter) => {
        setEditingVoter({ ...voter });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingVoter) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('voters').update({
                name: editingVoter.name,
                dob: editingVoter.dob,
                gender: editingVoter.gender,
                cccd: editingVoter.cccd,
                ethnic: editingVoter.ethnic,
                voter_card_number: editingVoter.voterCardNumber,
                address: editingVoter.address,
                neighborhood_id: editingVoter.neighborhoodId,
                unit_id: editingVoter.unitId,
                area_id: editingVoter.areaId,
                group_name: editingVoter.group,
                residence_status: editingVoter.residenceStatus
            }).eq('id', editingVoter.id);

            if (error) throw error;
            setIsEditModalOpen(false);
            setEditingVoter(null);
            fetchVoters();
        } catch (err: any) {
            showNotification('Lỗi: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleQRScan = (decodedText: string) => {
        // Parse CCCD QR Format: CCCD|OldID|Name|DOB|Gender|Address|Date
        // Example: 038096000000|123456789|NGUYEN VAN A|01011996|Nam|...
        const parts = decodedText.split('|');
        const scannedCccd = parts[0];

        if (scannedCccd) {
            setSearchTerm(scannedCccd);
            setIsScannerOpen(false);
            // Optionally: Auto-select or show a toast
            console.log("Scanned CCCD:", scannedCccd);
        }
    };

    // --- CLIENT-SIDE FILTERING (SEARCH) ---
    const filteredVoters = useMemo(() => {
        let result = voters;

        // Apply card number filter first
        if (filterCardNumber.trim()) {
            const cardSearch = filterCardNumber.toLowerCase().trim();
            result = result.filter(v => v.voterCardNumber?.toLowerCase().includes(cardSearch));
        }

        // Then apply search term
        const search = searchTerm.toLowerCase().trim();
        if (search) {
            result = result.filter(v => {
                if (v.name.toLowerCase().includes(search)) return true;
                if (v.cccd?.includes(search)) return true;
                if (v.voterCardNumber?.toLowerCase().includes(search)) return true;
                return false;
            });
        }

        return result;
    }, [voters, searchTerm, filterCardNumber]);

    const paginatedVoters = filteredVoters.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    const totalPages = Math.ceil(filteredVoters.length / ITEMS_PER_PAGE);

    // --- UI RENDER HELPERS ---
    const getResidenceBadge = (status: ResidenceStatus) => {
        const map = {
            'thuong-tru': { color: 'text-emerald-700 bg-emerald-50 border-emerald-100', label: 'Thường trú' },
            'tam-tru': { color: 'text-amber-700 bg-amber-50 border-amber-100', label: 'Tạm trú' },
            'tam-vang': { color: 'text-slate-500 bg-slate-50 border-slate-100', label: 'Tạm vắng' }
        };
        const conf = map[status] || map['thuong-tru'];
        return (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border whitespace-nowrap ${conf.color}`}>
                {conf.label}
            </span>
        );
    };

    return (
        <div className={`h-[calc(100vh-6rem)] flex flex-col bg-slate-50 -m-6 lg:-m-10 animate-in fade-in duration-300 ${isLargeText ? 'text-lg' : 'text-sm'}`}>

            {/* 1. TOP BAR: SEARCH & PRIMARY FILTERS (Fixed) */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 shadow-sm z-20 flex-shrink-0">
                <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">

                    {/* Title & Stats */}
                    <div className="flex items-center gap-4">
                        <div className="size-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                            <span className="material-symbols-outlined text-xl">groups</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-black uppercase text-slate-900 leading-none">Danh sách cử tri</h1>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Tổng: {filteredVoters.length.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Main Action Area */}
                    <div className="flex-1 w-full xl:w-auto flex flex-col md:flex-row gap-3">
                        {/* Search Bar */}
                        <div className="relative flex-1 min-w-[280px]">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Tìm nhanh: Tên, CCCD, Số thẻ..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>

                        {/* Primary Filters */}
                        <select value={filterVoting} onChange={e => setFilterVoting(e.target.value)} className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase cursor-pointer focus:border-primary outline-none">
                            <option value="all">-- Trạng thái bầu --</option>
                            <option value="chua-bau">Chưa bầu</option>
                            <option value="da-bau">Đã bầu</option>
                        </select>

                        <select
                            value={filterArea}
                            onChange={e => setFilterArea(e.target.value)}
                            className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase cursor-pointer focus:border-primary outline-none max-w-[150px]"
                        >
                            <option value="all">-- Tất cả KVBP --</option>
                            {AN_PHU_LOCATIONS.filter(l => l.type === 'area').map(a => <option key={a.id} value={a.id}>{a.id.toUpperCase()} - {a.locationDetail || a.name}</option>)}
                        </select>

                        {/* Card Number Filter - Appears after selecting area */}
                        {filterArea !== 'all' && (
                            <div className="relative animate-in slide-in-from-left-2 fade-in">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">badge</span>
                                <input
                                    type="text"
                                    placeholder="Lọc theo số thẻ..."
                                    value={filterCardNumber}
                                    onChange={e => setFilterCardNumber(e.target.value)}
                                    className="h-10 pl-9 pr-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-300 transition-all min-w-[140px]"
                                />
                            </div>
                        )}

                        {/* Advanced Filter Toggle */}
                        <button
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={`h-10 px-4 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all ${showAdvancedFilters ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <span className="material-symbols-outlined text-lg">filter_list</span>
                            Lọc thêm
                        </button>

                        {/* QR Scanner Toggle */}
                        <button
                            onClick={() => setIsScannerOpen(true)}
                            className="h-10 px-4 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
                            Quét CCCD
                        </button>

                        <button onClick={onImportClick} className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 text-primary rounded-xl hover:bg-primary hover:text-white transition-all" title="Nhập liệu">
                            <span className="material-symbols-outlined">upload_file</span>
                        </button>
                    </div>
                </div>

                {/* 2. ADVANCED FILTERS (Collapsible) */}
                {showAdvancedFilters && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                        <select
                            value={filterNeighborhood}
                            onChange={e => setFilterNeighborhood(e.target.value)}
                            className="h-9 px-3 bg-slate-50 border-none rounded-lg text-[10px] font-black uppercase"
                        >
                            <option value="all">Tất cả Khu phố</option>
                            {NEIGHBORHOODS.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                        </select>
                        <select
                            value={filterUnit}
                            onChange={e => setFilterUnit(e.target.value)}
                            className="h-9 px-3 bg-slate-50 border-none rounded-lg text-[10px] font-black uppercase"
                        >
                            <option value="all">Tất cả Đơn vị</option>
                            {unitOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="h-9 px-3 bg-slate-50 border-none rounded-lg text-[10px] font-black uppercase">
                            <option value="">Tất cả Tổ</option>
                            {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <select value={filterResidence} onChange={e => setFilterResidence(e.target.value)} className="h-9 px-3 bg-slate-50 border-none rounded-lg text-[10px] font-black uppercase">
                            <option value="all">Tất cả Cư trú</option>
                            <option value="thuong-tru">Thường trú</option>
                            <option value="tam-tru">Tạm trú</option>
                        </select>
                    </div>
                )}
            </div>

            {/* 3. TABLE AREA (Scrollable) */}
            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar pb-20">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            <tr>
                                <th className="px-1.5 py-3 text-center w-10">#</th>
                                <th className="px-1.5 py-3 min-w-[160px]">Cử tri</th>
                                <th className="px-1.5 py-3 min-w-[150px]">Địa chỉ thường trú</th>
                                <th className="px-1.5 py-3 min-w-[110px]">Định danh</th>
                                <th className="px-1.5 py-3 min-w-[140px]">Khu vực</th>
                                <th className="px-1.5 py-3 w-28 text-right">Trạng thái & Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? (
                                <tr><td colSpan={5} className="py-20 text-center"><span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span></td></tr>
                            ) : paginatedVoters.length === 0 ? (
                                <tr><td colSpan={5} className="py-20 text-center italic text-slate-400">Không tìm thấy cử tri</td></tr>
                            ) : paginatedVoters.map((v, idx) => {
                                const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                                const neighborhoodName = NEIGHBORHOODS.find(n => n.id === v.neighborhoodId)?.name.replace('Khu phố', 'KP');

                                return (
                                    <tr key={v.id} className="group hover:bg-slate-50 transition-colors">
                                        {/* COL 1: STT */}
                                        <td className="px-1.5 py-2.5 text-center font-bold text-slate-400 text-xs">
                                            {globalIndex}
                                        </td>

                                        {/* COL 2: CỬ TRI (Name + Details) */}
                                        <td className="px-1.5 py-2.5">
                                            <div>
                                                <p className="font-black text-slate-900 uppercase text-sm leading-tight">{v.name}</p>
                                                <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-slate-500 uppercase">
                                                    <span>{v.dob || 'NS: --'}</span>
                                                    <span className="w-0.5 h-0.5 rounded-full bg-slate-300"></span>
                                                    <span>{v.gender}</span>
                                                    <span className="w-0.5 h-0.5 rounded-full bg-slate-300"></span>
                                                    {getResidenceBadge(v.residenceStatus)}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-1.5 py-2.5">
                                            <p className="text-[11px] font-bold text-slate-600 line-clamp-2" title={v.address}>
                                                {v.address || '---'}
                                            </p>
                                        </td>

                                        {/* COL 3: ĐỊNH DANH (Copyable) */}
                                        <td className="px-1.5 py-2.5">
                                            <div className="flex flex-col gap-0.5 items-start">
                                                <button
                                                    onClick={() => handleCopy(v.cccd)}
                                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all group/btn"
                                                    title="Sao chép CCCD"
                                                >
                                                    <span className="text-[11px] font-mono font-bold text-slate-700">{v.cccd}</span>
                                                    <span className="material-symbols-outlined text-[10px] text-slate-300 group-hover/btn:text-primary">content_copy</span>
                                                </button>
                                                <div className="flex items-center gap-1 px-1.5">
                                                    <span className="text-[9px] font-black text-slate-400">THẺ:</span>
                                                    <span className="text-[10px] font-black text-primary">{v.voterCardNumber}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* COL 4: KHU VỰC */}
                                        <td className="px-1.5 py-2.5">
                                            <div className="flex flex-col items-start gap-0.5">
                                                <div className="flex gap-1">
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white text-[9px] font-black uppercase">
                                                        {v.areaId.toUpperCase().replace('KV', 'KV ')}
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-black uppercase border border-slate-200">
                                                        {v.unitId.replace('unit_', 'ĐV ')}
                                                    </span>
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-600 uppercase">
                                                    {v.group} - {neighborhoodName}
                                                </p>
                                            </div>
                                        </td>

                                        {/* COL 5: TRẠNG THÁI & THAO TÁC (Toggle + Edit) */}
                                        <td className="px-1.5 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Toggle Switch (ON/OFF) */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateVotingStatus(v.id, v.votingStatus === 'da-bau' ? 'chua-bau' : 'da-bau');
                                                    }}
                                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${v.votingStatus === 'da-bau'
                                                        ? 'bg-emerald-500 focus:ring-emerald-300'
                                                        : 'bg-slate-300 focus:ring-slate-200'
                                                        }`}
                                                    title={v.votingStatus === 'da-bau' ? 'Đã bỏ phiếu (Click để hủy)' : 'Chưa bỏ phiếu (Click để xác nhận)'}
                                                >
                                                    <span className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-200 flex items-center justify-center ${v.votingStatus === 'da-bau' ? 'translate-x-5' : 'translate-x-0'
                                                        }`}>
                                                        {v.votingStatus === 'da-bau' && (
                                                            <span className="material-symbols-outlined text-emerald-600 text-xs font-variation-fill">check</span>
                                                        )}
                                                    </span>
                                                </button>

                                                {/* Edit Button (Pen Icon) */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenEdit(v);
                                                    }}
                                                    className="size-8 rounded-lg bg-slate-50 text-slate-500 hover:bg-primary hover:text-white border border-slate-200 flex items-center justify-center transition-all group"
                                                    title="Chỉnh sửa thông tin cử tri"
                                                >
                                                    <span className="material-symbols-outlined text-base">edit</span>
                                                </button>

                                                {/* Delete Button (Trash Icon) - Available for all authenticated users */}
                                                {profile && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteVoter(v.id, v.name, v.cccd || '');
                                                        }}
                                                        className="size-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-600 hover:text-white border border-red-100 flex items-center justify-center transition-all"
                                                        title="Xóa cử tri"
                                                    >
                                                        <span className="material-symbols-outlined text-base">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Fixed Pagination Bar at Bottom */}
                <div className="absolute bottom-0 inset-x-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Trang {currentPage} / {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* EDIT MODAL (Giữ nguyên logic cũ, chỉ re-style nhẹ) */}
            {isEditModalOpen && editingVoter && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-black uppercase text-slate-900">Cập nhật hồ sơ cử tri</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="size-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:text-red-500"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400">Họ và tên</label>
                                <input type="text" value={editingVoter.name} onChange={e => setEditingVoter({ ...editingVoter, name: e.target.value.toUpperCase() })} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-bold uppercase focus:border-primary outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">CCCD</label>
                                    <input type="text" value={editingVoter.cccd} onChange={e => setEditingVoter({ ...editingVoter, cccd: e.target.value })} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-bold focus:border-primary outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Số thẻ</label>
                                    <input type="text" value={editingVoter.voterCardNumber} onChange={e => setEditingVoter({ ...editingVoter, voterCardNumber: e.target.value })} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-bold focus:border-primary outline-none" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400">Địa chỉ thường trú</label>
                                <textarea
                                    value={editingVoter.address}
                                    onChange={e => setEditingVoter({ ...editingVoter, address: e.target.value })}
                                    className="w-full h-16 p-3 border border-slate-200 rounded-lg text-sm font-bold focus:border-primary outline-none resize-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400">Trạng thái cư trú</label>
                                <select value={editingVoter.residenceStatus} onChange={e => setEditingVoter({ ...editingVoter, residenceStatus: e.target.value as any })} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-bold focus:border-primary outline-none">
                                    <option value="thuong-tru">Thường trú</option>
                                    <option value="tam-tru">Tạm trú</option>
                                    <option value="tam-vang">Tạm vắng</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold uppercase text-slate-500 hover:bg-slate-50">Hủy</button>
                            <button onClick={handleSaveEdit} disabled={isSaving} className="px-6 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase hover:bg-blue-800 shadow-lg shadow-primary/20">{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* QR SCANNER MODAL */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
                        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined">qr_code_scanner</span>
                                </div>
                                <h2 className="text-lg font-black uppercase text-slate-900 tracking-tight">Quét mã QR cử tri</h2>
                            </div>
                            <button onClick={() => setIsScannerOpen(false)} className="size-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-8">
                            <QRScanner
                                onScanSuccess={handleQRScan}
                                onScanError={(err) => console.log(err)}
                            />

                            <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                                <span className="material-symbols-outlined text-amber-500 mt-0.5">info</span>
                                <p className="text-xs font-bold text-amber-800 leading-relaxed">
                                    Đưa mã QR trên mặt TRƯỚC thẻ CCCD gắn chip vào khung hình để hệ thống tự động nhận diện và tra cứu thông tin cử tri.
                                </p>
                            </div>
                        </div>
                        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                            <button onClick={() => setIsScannerOpen(false)} className="px-8 py-3 bg-white border-2 border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">
                                Đóng lại
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
