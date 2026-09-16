import React, { useState, useEffect } from 'react';
import { useCloudSync } from '../hooks/useCloudSync';
import { 
  Boxes, 
  Package, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scan, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  ExternalLink, 
  Clock, 
  Printer, 
  Zap, 
  Sparkles, 
  CheckCircle2,
  Cloud,
  RefreshCw,
  Download,
  Shield,
  User as UserIcon,
  Check,
  ChevronDown,
  X,
  AlertCircle,
  ShieldCheck,
  ClipboardCheck,
  Users
} from 'lucide-react';
import { InventoryItem, Transaction, StockSummary, LowStockActionStatus } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { exportUserTransactionsToExcel, exportAllTransactionsToExcel } from '../utils/exportTransactions';
import { formatUnit } from '../utils/units';
import { formatStandardRoleName } from '../utils/roleFormat';

interface DashboardProps {
  onSelectItem: (item: InventoryItem) => void;
  onOpenScanner: () => void;
  onOpenAddItem: () => void;
  onOpenImportCsv: () => void;
  onGoToItemsTab: () => void;
  onOpenSyncGuide?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectItem,
  onOpenScanner,
  onOpenAddItem,
  onOpenImportCsv,
  onGoToItemsTab,
  onOpenSyncGuide,
}) => {
  const { user, isAdmin, isSupervisor, isEvaluator, canEditLowStockStatus } = useAuth();
  const syncInfo = useCloudSync();
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [criticalItems, setCriticalItems] = useState<InventoryItem[]>([]);
  const [quickSearch, setQuickSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating6k, setIsGenerating6k] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);
  const [userTxCount, setUserTxCount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      const stats = await db.getStockSummary();
      setSummary(stats);

      const recentTx = await db.getRecentTransactions(8);
      setRecentTransactions(recentTx);

      const { items: lowItems } = await db.getItems({ stockFilter: 'low', pageSize: 25 });
      setCriticalItems(lowItems);

      if (user) {
        const myTxs = await db.getUserTransactions(user.username, user.name);
        setUserTxCount(myTxs.length);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // Real-time automatic synchronization without manual refresh
    const unsubscribe = db.subscribe(() => {
      loadDashboardData();
    });
    return () => {
      unsubscribe();
    };
  }, [user]);

  // Quick search handler with immediate responsive debounce and error tolerance
  useEffect(() => {
    const q = quickSearch.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await db.getItems({ search: q, pageSize: 10 });
        setSearchResults(res.items);
      } catch (e) {
        console.error('Quick search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [quickSearch]);

  const handleGenerate6000 = async () => {
    setIsGenerating6k(true);
    try {
      await db.generateBulk6000Items((curr, tot) => {
        setGenProgress({ current: curr, total: tot });
      });
      await loadDashboardData();
      alert('Berhasil men-generate data inventaris hingga 6.000 item!');
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setIsGenerating6k(false);
      setGenProgress(null);
    }
  };

  const handleExportMyTransactions = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const myTxs = await db.getUserTransactions(user.username, user.name);
      if (myTxs.length === 0) {
        alert(`Belum ada riwayat transaksi yang tercatat atas nama akun '${user.name}'. Lakukan mutasi barang masuk/keluar untuk mencatat transaksi.`);
        return;
      }
      exportUserTransactionsToExcel(myTxs, user);
    } catch (err) {
      console.error('Failed to export user transactions:', err);
      alert('Terjadi kesalahan saat mengekspor riwayat transaksi.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateLowStockStatus = async (itemId: string, newStatus: LowStockActionStatus) => {
    if (!canEditLowStockStatus) {
      alert('Hanya akun dengan role Evaluator yang berwenang mengubah status pengadaan stok menipis.');
      return;
    }
    setUpdatingItemId(itemId);
    try {
      await db.updateLowStockStatus(itemId, newStatus, user?.name || 'Evaluator');
    } catch (err) {
      console.error('Update status error:', err);
      alert('Gagal memperbarui status pengadaan stok.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Welcome & Warehouse Operational Bar */}
      <div className="hero-card bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-lg relative isolate">
        {/* Subtle grid pattern background contained in isolated absolute wrapper to prevent WebKit clipping */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none -z-10">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-xs">
                SISTEM GUDANG AKTIF
              </span>
              <button
                onClick={onOpenSyncGuide}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-900/80 text-indigo-200 border border-indigo-400/60 hover:bg-indigo-800 transition-colors shadow-xs cursor-pointer"
                title="Status Sinkronisasi Cloud Multi-Perangkat"
              >
                <Cloud className="w-3.5 h-3.5 text-indigo-300" />
                <span>Cloud Firestore: {syncInfo.status === 'synced' ? 'Tersinkron' : syncInfo.status === 'syncing' ? 'Menyinkron...' : 'Aktif'}</span>
              </button>
            </div>
            <h1 className="hero-title text-2xl sm:text-3xl font-black tracking-tight text-white">
              Pusat Manajemen Inventaris Gudang
            </h1>
            <p className="hero-description text-xs sm:text-sm text-slate-100 max-w-xl font-normal leading-relaxed">
              Kelola hingga 6.000+ item fisik dengan QR Code Scanner, mutasi keluar-masuk akurat, dan pembukuan kartu barang digital real-time.
            </p>
          </div>

          {/* Quick Trigger Buttons - Crisp solid backgrounds without WebKit blur artifacts */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md border border-emerald-400/40 transition-all cursor-pointer"
            >
              <Scan className="w-4 h-4 animate-pulse text-white" />
              <span className="text-white font-bold">Pindai QR Barang</span>
            </button>

            {(isSupervisor || isAdmin) && (
              <>
                <button
                  onClick={onOpenAddItem}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xs font-bold rounded-xl border border-slate-600 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span className="text-white font-bold">Tambah Barang</span>
                </button>
                <button
                  onClick={onOpenImportCsv}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xs font-bold rounded-xl border border-slate-600 shadow-sm transition-all cursor-pointer"
                  title="Import data massal via berkas Excel (.xlsx) atau CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-bold">Import Excel / CSV</span>
                </button>
              </>
            )}

            {/* Scale Testing Trigger: 6000 items */}
            {summary && summary.totalItems < 6000 && (
              <button
                onClick={handleGenerate6000}
                disabled={isGenerating6k}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-950/80 hover:bg-amber-900 active:scale-95 text-amber-200 border border-amber-500/60 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                title="Generate 6.000 item untuk uji kinerja sistem"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-amber-200 font-bold">
                  {isGenerating6k
                    ? `Generating (${genProgress?.current || 0}/${genProgress?.total || 6000})...`
                    : 'Generate 6.000 Data'}
                </span>
              </button>
            )}

            {onOpenSyncGuide && (
              <button
                onClick={onOpenSyncGuide}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-950/80 hover:bg-indigo-900 active:scale-95 text-indigo-100 border border-indigo-400/60 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                title="Panduan Akses HP/Tablet & Sinkronisasi Multi-Perangkat"
              >
                <Boxes className="w-4 h-4 text-indigo-300" />
                <span className="text-indigo-100 font-bold">Multi-Perangkat</span>
              </button>
            )}
          </div>
        </div>

        {/* Integrated Quick Search Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 relative">
          <div className="relative max-w-xl">
            <Search className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuickSearch('');
                  setSearchResults([]);
                }
              }}
              placeholder="Cari kode material (contoh: 031007000000000235), nama barang, atau lokasi BIN..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-600 text-white placeholder-slate-400 text-xs rounded-xl focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
            />
            {quickSearch.trim() ? (
              <button
                type="button"
                onClick={() => {
                  setQuickSearch('');
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                title="Hapus pencarian (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : isSearching ? (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                Mencari...
              </span>
            ) : null}
          </div>

          {/* Search Results Dropdown Overlay - Not clipped because container is not overflow-hidden */}
          {quickSearch.trim().length > 0 && (
            <div className="absolute top-full left-0 mt-2 max-w-xl w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 text-slate-900 divide-y divide-slate-100">
              <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                <span>
                  {isSearching ? 'Sedang mencari...' : `Hasil Pencarian (${searchResults.length})`}
                </span>
                <span className="text-indigo-600 text-[10px]">
                  Klik item untuk membuka Kartu Barang
                </span>
              </div>

              {searchResults.length > 0 ? (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectItem(item);
                        setQuickSearch('');
                        setSearchResults([]);
                      }}
                      className="p-3 hover:bg-indigo-50/80 cursor-pointer flex items-center justify-between transition-colors text-xs group"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[11px]">
                            {item.material_code}
                          </span>
                          <span className="font-semibold text-slate-900 group-hover:text-indigo-900 truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {item.category}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">
                            Lokasi BIN: <strong className="text-indigo-700">{item.location}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 text-sm">
                          {item.current_stock} <span className="text-xs font-normal text-slate-600">{item.unit}</span>
                        </span>
                        <span className="text-[10px] block text-slate-400">Stok saat ini</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isSearching ? (
                <div className="p-5 text-center text-slate-500">
                  <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                  <p className="font-semibold text-slate-800 text-xs">Barang tidak ditemukan</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Tidak ada barang dengan kode material, nama, atau lokasi BIN yang cocok dengan "{quickSearch}".
                  </p>
                </div>
              ) : null}

              <div className="bg-slate-50 p-2 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onGoToItemsTab();
                    setQuickSearch('');
                    setSearchResults([]);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  Buka Modul Manajemen Barang &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Session & Transaction Export Bar */}
      {user && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shadow-xs shrink-0 ${
              isEvaluator
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : isSupervisor
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{user.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isEvaluator
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : isSupervisor
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {user.role === 'evaluator' ? 'Evaluator Pengadaan' :
                   user.role === 'supervisor' ? 'Supervisor Gudang' :
                   user.role === 'staff' ? `Staff Gudang (${user.group || 'Group A'})` : 'Supervisor'}
                </span>
                {user.group && (
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    Group {user.group}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {user.department} • Terdaftar {userTxCount} catatan transaksi atas nama akun ini
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportMyTransactions}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-600/20 transition-all disabled:opacity-50"
              title="Unduh laporan riwayat transaksi khusus akun Anda dalam format Spreadsheet Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>{isExporting ? 'Membuat Excel...' : 'Download Riwayat Transaksi (.xlsx)'}</span>
              <span className="bg-emerald-700/80 px-1.5 py-0.5 rounded text-[10px]">
                {userTxCount}
              </span>
            </button>

            {(isAdmin || isSupervisor) && recentTransactions.length > 0 && (
              <button
                onClick={() => exportAllTransactionsToExcel(recentTransactions)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
                title="Unduh seluruh riwayat transaksi gudang"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export Semua (.xlsx)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Kategori/Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Item Barang</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {summary ? summary.totalItems.toLocaleString('id-ID') : '...'}
            </span>
            <span className="text-xs text-slate-500 font-medium">SKU</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Kapasitas sistem teruji 6.000+ item</p>
        </div>

        {/* Total Fisik Stok */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Stok Fisik</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {summary ? summary.totalStock.toLocaleString('id-ID') : '...'}
            </span>
            <span className="text-xs text-slate-500 font-medium">unit</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Akumulasi seluruh persediaan</p>
        </div>

        {/* Barang Menipis / Kritis */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stok Kritis / Habis</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
              {summary ? (summary.lowStockCount + summary.outOfStockCount).toLocaleString('id-ID') : '...'}
            </span>
            <span className="text-xs text-slate-500 font-medium">item</span>
          </div>
          <p className="text-[11px] text-amber-700/80 mt-1 font-medium">
            {summary?.outOfStockCount || 0} habis, {summary?.lowStockCount || 0} di bawah minimum
          </p>
        </div>

        {/* Mutasi Hari Ini */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mutasi Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              <span className="text-xl font-bold text-emerald-700">+{summary?.totalInToday || 0}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <ArrowUpRight className="w-4 h-4 text-rose-600" />
              <span className="text-xl font-bold text-rose-700">-{summary?.totalOutToday || 0}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total {summary?.totalTransactionsCount || 0} catatan mutasi</p>
        </div>

      </div>

      {/* Evaluator Feature: Tracking Status Stock Menipis Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Tabel Tracking Status Stock Barang Menipis
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                {criticalItems.length} Perlu Evaluasi
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemantauan pengadaan stok di bawah batas minimum. Kolom status hanya dapat diperbarui oleh akun <strong>Evaluator</strong>.
            </p>
          </div>

          {/* Color-Coded Legend */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              🔴 Merah: Batas Minimum (Stok Menipis)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              🟢 Hijau: Sudah Diproses (Restock Ditindaklanjuti)
            </span>
          </div>
        </div>

        {criticalItems.length === 0 ? (
          <div className="p-8 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <span className="font-semibold block text-sm">Seluruh stok barang dalam kondisi aman!</span>
            <span className="text-emerald-700 text-xs">Tidak ada persediaan barang yang berada di bawah stok minimum.</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/90">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Kode Material</th>
                  <th className="py-3 px-3">Nama Barang & Lokasi</th>
                  <th className="py-3 px-3 text-center">Stok Fisik</th>
                  <th className="py-3 px-3 text-center">Stok Min</th>
                  <th className="py-3 px-3">Status Pengadaan (Evaluator)</th>
                  <th className="py-3 px-3">Terakhir Diperbarui</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {criticalItems.map((item) => {
                  const status = item.low_stock_status || 'MINIMUM';
                  const isProcessed = status === 'PROCESSED' || status === 'PR_PROCESSED' || status === 'ARRIVED';
                  const isUpdating = updatingItemId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {item.material_code}
                        </span>
                      </td>
                      <td className="py-3 px-3 min-w-[140px]">
                        <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-500">Rak BIN: {item.location} • {item.category}</div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`font-mono font-bold text-sm ${
                          item.current_stock === 0 ? 'text-rose-700 font-extrabold' : 'text-amber-600'
                        }`}>
                          {item.current_stock} {formatUnit(item.unit)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-slate-500">
                        {item.min_stock} {formatUnit(item.unit)}
                      </td>
                      <td className="py-3 px-3">
                        {canEditLowStockStatus ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={isProcessed ? 'PROCESSED' : 'MINIMUM'}
                              disabled={isUpdating}
                              onChange={(e) => handleUpdateLowStockStatus(item.id, e.target.value as LowStockActionStatus)}
                              className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border shadow-2xs transition-all cursor-pointer focus:outline-hidden ${
                                isProcessed
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                            >
                              <option value="MINIMUM">🔴 Merah: Batas Minimum</option>
                              <option value="PROCESSED">🟢 Hijau: Sudah Diproses</option>
                            </select>
                            {isUpdating && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                              isProcessed
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${
                                isProcessed ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                              }`} />
                              {isProcessed ? 'Sudah Diproses' : 'Batas Minimum'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {item.low_stock_updated_at ? (
                          <div>
                            <span className="font-medium text-slate-700">{item.low_stock_updated_by || 'Evaluator'}</span>
                            <div className="text-[10px] text-slate-400">
                              {new Date(item.low_stock_updated_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">- Belum ada update -</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => onSelectItem(item)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg border border-indigo-200 transition-colors text-[11px]"
                        >
                          Buka Kartu
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Transactions Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Transaksi Keluar - Masuk Terbaru (Real-Time)
            </h3>
            <p className="text-xs text-slate-500">Mutasi barang otomatis tersinkronisasi langsung tanpa delay</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportMyTransactions}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Download Riwayat (.xlsx)</span>
            </button>
            <button
              onClick={onGoToItemsTab}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Semua Barang</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
            Belum ada transaksi tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Kode & Nama Barang</th>
                  <th className="py-2.5 px-3 text-center">Jenis</th>
                  <th className="py-2.5 px-3 text-right">Jumlah</th>
                  <th className="py-2.5 px-3">No. Dokumen</th>
                  <th className="py-2.5 px-3">Petugas (PIC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentTransactions.map((tx) => {
                  const isIn = tx.transaction_type === 'IN';
                  const timeStr = new Date(tx.transaction_date).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const dateStr = new Date(tx.transaction_date).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                        <span className="font-semibold text-slate-700">{dateStr}</span> {timeStr}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-slate-800 mr-2">{tx.material_code}</span>
                        <span className="text-slate-900 font-medium truncate inline-block max-w-[140px] sm:max-w-[240px] align-bottom">
                          {tx.item_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold text-xs ${
                        isIn ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isIn ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {tx.doc_ref || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[100px] sm:max-w-[140px]">
                        {tx.pic_name}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
