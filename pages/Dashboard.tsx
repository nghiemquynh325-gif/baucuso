
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AN_PHU_LOCATIONS } from '../types';
import {
   BarChart,
   Bar,
   XAxis,
   YAxis,
   CartesianGrid,
   Tooltip,
   ResponsiveContainer,
   Cell,
   AreaChart,
   Area
} from 'recharts';

/**
 * COMPONENT: Dashboard
 */

const UNIT_COLORS = [
   '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308', '#10b981', '#06b6d4', '#6366f1',
];

const AGE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC<{ isLargeText?: boolean }> = ({ isLargeText }) => {
   const [stats, setStats] = useState({
      total: 0,
      voted: 0,
      totalMale: 0,
      totalFemale: 0,
      maleVoted: 0,
      femaleVoted: 0
   });
   const [kvData, setKvData] = useState<any[]>([]);
   const [unitChartData, setUnitChartData] = useState<any[]>([]);
   const [ageData, setAgeData] = useState<any[]>([]);
   const [trendData, setTrendData] = useState<any[]>([]);
   const [currentTime, setCurrentTime] = useState(new Date());

   const [selectedKvId, setSelectedKvId] = useState<string | null>(null);
   const [selectedKvVoters, setSelectedKvVoters] = useState<any[]>([]); // New state for drill-down

   useEffect(() => {
      if (selectedKvId) {
         fetchKvVoters(selectedKvId);
      }
   }, [selectedKvId]);

   const fetchKvVoters = async (kvId: string) => {
      const { data } = await supabase.from('voters').select('*').eq('area_id', kvId);
      if (data) {
         setSelectedKvVoters(data.sort((a, b) => {
            if (a.voting_status === 'da-bau' && b.voting_status !== 'da-bau') return 1;
            if (a.voting_status !== 'da-bau' && b.voting_status === 'da-bau') return -1;
            return a.name.localeCompare(b.name);
         }));
      }
   };

   useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      fetchRealtimeStats();
      fetchVotingTrend();

      const channel = supabase
         .channel('dashboard-realtime')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, () => {
            fetchRealtimeStats();
         })
         .on('postgres_changes', { event: '*', schema: 'public', table: 'system_logs' }, () => {
            fetchVotingTrend();
         })
         .subscribe();

      return () => {
         clearInterval(timer);
         supabase.removeChannel(channel);
      };
   }, []);

   const fetchRealtimeStats = async () => {
      try {
         // 1. Fetch Summary via updated RPC
         const { data: summary, error: sErr } = await supabase.rpc('get_election_summary');
         if (sErr) {
            console.error("RPC get_election_summary error:", sErr);
            throw sErr;
         }

         if (summary) {
            setStats({
               total: summary.total,
               voted: summary.voted,
               totalMale: summary.totalMale || 0,
               totalFemale: summary.totalFemale || 0,
               maleVoted: summary.maleVoted || 0,
               femaleVoted: summary.femaleVoted || 0
            });

            setAgeData(Object.entries(summary.ageStats || {}).map(([name, value]) => ({ name, value })));
         }

         // 2. Fetch Aggregated Lists via RPC
         const { data: unitStats, error: uErr } = await supabase.rpc('get_aggregated_stats', { p_view_mode: 'unit' });
         if (uErr) console.error("RPC get_aggregated_stats (unit) error:", uErr);
         if (unitStats) {
            setUnitChartData(unitStats.map((u: any) => ({
               name: (AN_PHU_LOCATIONS.find(l => l.id === u.rawId)?.name || u.id).replace('Đơn vị số', 'ĐV'),
               full_name: AN_PHU_LOCATIONS.find(l => l.id === u.rawId)?.name || u.id,
               total: u.total,
               voted: u.voted,
               remain: u.total - u.voted,
               percentage: u.total > 0 ? parseFloat(((u.voted / u.total) * 100).toFixed(1)) : 0
            })));
         }

         const { data: areaStats, error: aErr } = await supabase.rpc('get_aggregated_stats', { p_view_mode: 'area' });
         if (aErr) console.error("RPC get_aggregated_stats (area) error:", aErr);
         if (areaStats) {
            // ĐẢM BẢO HIỂN THỊ ĐỦ 45 KVBP TỪ MASTER DATA
            const kvAreas = AN_PHU_LOCATIONS.filter(l => l.type === 'area');
            const mappedKV = kvAreas.map(loc => {
               const stat = areaStats.find((s: any) => s.rawId === loc.id);
               return {
                  id: loc.id,
                  name: loc.name,
                  total: stat?.total || 0,
                  voted: stat?.voted || 0,
                  remain: (stat?.total || 0) - (stat?.voted || 0),
                  percentage: stat?.total > 0 ? Math.round((stat.voted / stat.total) * 100) : 0
               };
            });
            setKvData(mappedKV);
         }
      } catch (err) {
         console.error("Dashboard error:", err);
      }
   };

   const fetchVotingTrend = async () => {
      try {
         const { data: logs } = await supabase
            .from('system_logs')
            .select('created_at')
            .eq('action', 'CẬP NHẬT TRẠNG THÁI BẦU')
            .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: true });

         if (logs) {
            const intervals: Record<string, number> = {};
            logs.forEach(log => {
               const k = new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }).slice(0, 4) + '0';
               intervals[k] = (intervals[k] || 0) + 1;
            });
            setTrendData(Object.entries(intervals).map(([time, value]) => ({ time, value })));
         }
      } catch (err) { /* silent */ }
   };

   const overallPercentage = stats.total > 0 ? ((stats.voted / stats.total) * 100).toFixed(2) : "0.00";

   const selectedKvInfo = useMemo(() => {
      if (!selectedKvId) return null;
      return AN_PHU_LOCATIONS.find(l => l.id === selectedKvId);
   }, [selectedKvId]);

   const CustomTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
         const data = payload[0].payload;
         return (
            <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl z-50">
               <p className="font-black text-slate-900 uppercase mb-2">{data.full_name}</p>
               <p className="text-xs font-bold text-emerald-600">Đã bầu: {data.voted.toLocaleString()}</p>
               <p className="text-xs font-bold text-slate-400">Chưa bầu: {data.remain.toLocaleString()}</p>
               <div className="w-full h-px bg-slate-100 my-2"></div>
               <p className="text-sm font-black text-primary">Tiến độ: {data.percentage}%</p>
            </div>
         );
      }
      return null;
   };

   return (
      <div className="space-y-8 pb-20 overflow-x-hidden animate-in fade-in duration-500 relative">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-primary pb-8">
            <div className="space-y-3">
               <div className="flex items-center gap-4">
                  <div className="px-5 py-2 bg-admin-red text-white text-[10px] font-black rounded-full shadow-xl flex items-center gap-2 uppercase tracking-widest animate-pulse">
                     <span className="w-2 h-2 bg-white rounded-full"></span> Live Data
                  </div>
                  <h1 className={`font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none ${isLargeText ? 'text-4xl' : 'text-3xl'}`}>Giám sát An Phú 2026</h1>
               </div>
               <p className="text-slate-600 font-bold text-lg flex items-center gap-2 uppercase tracking-wide">Dữ liệu thực tế từ Cơ sở dữ liệu Phường</p>
            </div>
            <div className="text-right">
               <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums tracking-tight">{currentTime.toLocaleTimeString('vi-VN')}</p>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border-2 border-slate-200 shadow-2xl relative overflow-hidden">
               <div className="flex justify-between items-end mb-6">
                  <div>
                     <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-2">TIẾN ĐỘ TỔNG THỂ TOÀN PHƯỜNG</p>
                     <h2 className={`font-black text-slate-900 dark:text-white tracking-tighter ${isLargeText ? 'text-8xl' : 'text-7xl'} leading-none`}>{overallPercentage}%</h2>
                  </div>
                  <div className="text-right">
                     <p className={`font-black text-emerald-700 uppercase ${isLargeText ? 'text-3xl' : 'text-2xl'}`}>{stats.voted.toLocaleString()} <span className="text-slate-300">/</span> {stats.total.toLocaleString()}</p>
                     <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cử tri đã đi bầu</p>
                  </div>
               </div>
               <div className="h-14 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border-4 border-slate-200 p-1.5 shadow-inner">
                  <div className="h-full bg-gradient-to-r from-admin-red via-primary to-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${overallPercentage}%` }} />
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border-2 border-slate-200 shadow-xl flex flex-col justify-center">
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Thống kê theo giới tính</p>
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                           <span className="material-symbols-outlined">man</span>
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase">Tổng cử tri Nam</p>
                           <p className="text-2xl font-black text-slate-900 leading-none">{stats.totalMale.toLocaleString()}</p>
                        </div>
                     </div>
                     <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Nam đã đi bầu</p>
                        <p className="text-xl font-black text-blue-700">{stats.maleVoted.toLocaleString()}</p>
                        <div className="h-1 bg-blue-200 rounded-full mt-2 overflow-hidden">
                           <div className="h-full bg-blue-600" style={{ width: `${stats.totalMale > 0 ? (stats.maleVoted / stats.totalMale * 100) : 0}%` }}></div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600">
                           <span className="material-symbols-outlined">woman</span>
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase">Tổng cử tri Nữ</p>
                           <p className="text-2xl font-black text-slate-900 leading-none">{stats.totalFemale.toLocaleString()}</p>
                        </div>
                     </div>
                     <div className="p-4 bg-pink-50/50 rounded-2xl border border-pink-100">
                        <p className="text-[10px] font-black text-pink-600 uppercase mb-1">Nữ đã đi bầu</p>
                        <p className="text-xl font-black text-pink-700">{stats.femaleVoted.toLocaleString()}</p>
                        <div className="h-1 bg-pink-200 rounded-full mt-2 overflow-hidden">
                           <div className="h-full bg-pink-600" style={{ width: `${stats.totalFemale > 0 ? (stats.femaleVoted / stats.totalFemale * 100) : 0}%` }}></div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 shadow-xl h-[450px] flex flex-col">
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-primary">bar_chart</span> Tiến độ theo Đơn vị
               </h3>
               <div className="flex-1 w-full min-h-[300px] relative">
                  <ResponsiveContainer width="100%" height={290} debounce={100}>
                     <BarChart data={unitChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="voted" stackId="a">
                           {unitChartData.map((e, i) => <Cell key={i} fill={UNIT_COLORS[i % UNIT_COLORS.length]} />)}
                        </Bar>
                        <Bar dataKey="remain" stackId="a" fill="#e2e8f0" />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 shadow-xl h-[450px] flex flex-col">
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-admin-red">timeline</span> Tốc độ bầu cử
               </h3>
               <div className="flex-1 w-full min-h-[300px] relative">
                  <ResponsiveContainer width="100%" height={290} debounce={100}>
                     <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fontWeight: 700 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={3} />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-200 shadow-xl min-h-[400px] flex flex-col">
               <h4 className="text-sm font-black text-slate-900 uppercase mb-8 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">analytics</span> Thống kê theo Độ tuổi cử tri đã bầu
               </h4>
               <div className="flex-1 w-full min-h-[300px] relative">
                  <ResponsiveContainer width="100%" height={300} debounce={100}>
                     <BarChart data={ageData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={60}>
                           {ageData.map((e, i) => <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />)}
                        </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <h3 className="text-xl font-black text-slate-900 uppercase flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-3xl">grid_view</span> Chi tiết 45 KVBP (Phường An Phú)
               </h3>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sắp xếp theo thứ tự niêm yết</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
               {kvData.map((kv) => (
                  <div key={kv.id} onClick={() => setSelectedKvId(kv.id)} className="group p-5 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 text-center shadow-sm hover:scale-105 hover:border-primary hover:shadow-xl transition-all cursor-pointer relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-[10px] text-primary">open_in_new</span>
                     </div>
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{kv.id.replace('kv', 'KV').toUpperCase()}</p>
                     <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 leading-none">{kv.percentage}%</p>
                     <div className="mt-4 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${kv.percentage >= 90 ? 'bg-emerald-500' : kv.percentage >= 50 ? 'bg-primary' : 'bg-admin-red'}`} style={{ width: `${kv.percentage}%` }} />
                     </div>
                     <p className="text-[8px] font-bold text-slate-400 mt-2">{kv.voted}/{kv.total}</p>
                  </div>
               ))}
            </div>
         </div>

         {selectedKvId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
               <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
                  <div className="px-8 py-6 bg-slate-50 border-b flex justify-between items-center">
                     <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">{selectedKvInfo?.name}</h3>
                        <p className="text-sm font-bold text-slate-500 uppercase mt-1">{selectedKvInfo?.locationDetail}</p>
                     </div>
                     <button onClick={() => setSelectedKvId(null)} className="size-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-red-500 hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                     </button>
                  </div>
                  <div className="grid grid-cols-3 border-b text-center divide-x">
                     <div className="p-4"><p className="text-[10px] uppercase font-black text-slate-400">Tổng</p><p className="text-2xl font-black">{selectedKvVoters.length}</p></div>
                     <div className="p-4 bg-emerald-50"><p className="text-[10px] uppercase font-black text-emerald-600">Đã bầu</p><p className="text-2xl font-black text-emerald-600">{selectedKvVoters.filter(v => v.voting_status === 'da-bau').length}</p></div>
                     <div className="p-4 bg-red-50"><p className="text-[10px] uppercase font-black text-red-600">Chưa bầu</p><p className="text-2xl font-black text-red-600">{selectedKvVoters.filter(v => v.voting_status !== 'da-bau').length}</p></div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 font-black text-[10px] uppercase text-slate-500">
                           <tr><th className="px-6 py-4">STT</th><th className="px-6 py-4">Họ tên</th><th className="px-6 py-4">Định danh</th><th className="px-6 py-4">Trạng thái</th></tr>
                        </thead>
                        <tbody>
                           {selectedKvVoters.map((v, i) => (
                              <tr key={v.id} className="border-b hover:bg-slate-50">
                                 <td className="px-6 py-4 text-xs font-bold text-slate-400">{i + 1}</td>
                                 <td className="px-6 py-4 font-black uppercase text-sm">{v.name}</td>
                                 <td className="px-6 py-4 text-xs font-mono">{v.cccd}</td>
                                 <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${v.voting_status === 'da-bau' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{v.voting_status === 'da-bau' ? 'Đã bầu' : 'Chưa bầu'}</span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
