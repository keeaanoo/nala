import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  FileSpreadsheet, 
  Printer, 
  QrCode, 
  Edit3, 
  Trash2, 
  Eye, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  CheckSquare, 
  Square, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Sparkles, 
  Zap, 
  RefreshCw, 
  MapPin, 
  Layers,
  ClipboardCheck
} from 'lucide-react';
import { InventoryItem } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { StockTakeModal } from './StockTakeModal';
import { formatUnit } from '../utils/units';
import { exportInventoryItemsToExcel } from '../utils/exportTransactions';

interface ItemManagementProps {
  onOpenBinCard: (item: InventoryItem) => void;
  onOpenAddItem: () => void;
  onOpenEditItem: (item: InventoryItem) => void;
  onOpenImportCsv: () => void;
  onOpenBatchPrint: (items: InventoryItem[]) => void;
  onRecordTransaction: (item: InventoryItem, type: 'IN' | 'OUT') => void;
  refreshTrigger?: number;
}

export const ItemManagement: React.FC<ItemManagementProps> = ({
  onOpenBinCard,
  onOpenAddItem,
  onOpenEditItem,
  onOpenImportCsv,
  onOpenBatchPrint,
  onRecordTransaction,
  refreshTrigger,
}) => {
  const { isAdmin, isSupervisor } = useAuth();
  const [stoItem, setStoItem] = useState<InventoryItem | null>(null);
  const [localRefresh, setLocalRefresh] = useState<number>(0);
  
  // Query States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'normal' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'stock' | 'updated'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Pagination States (Optimized for 6000+ items)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [jumpPage, setJumpPage] = useState('');
  const [totalItems, setTotalItems] = useState(0);

  // Data & Selection States
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating6k, setIsGenerating6k] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);

  // Load Categories on mount
  useEffect(() => {
    db.getCategories().then(setCategories);
  }, [refreshTrigger]);

  const fetchCurrentItems = useCallback(async () => {
    try {
      const result = await db.getItems({
        search: search.trim(),
        category: selectedCategory,
        stockFilter,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });
      setItems(result.items);
      setTotalItems(result.total);
      const cats = await db.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to reload items:', err);
    }
  }, [search, selectedCategory, stockFilter, sortBy, sortOrder, page, pageSize]);

  // Real-time listener: Subscribe to Firestore and local database mutations
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      fetchCurrentItems();
    });
    return () => {
      unsubscribe();
    };
  }, [fetchCurrentItems]);

  // Load Items with Debounced Search & Pagination
  useEffect(() => {
    let isCancelled = false;
    const loadItems = async () => {
      setIsLoading(true);
      try {
        const result = await db.getItems({
          search: search.trim(),
          category: selectedCategory,
          stockFilter,
          sortBy,
          sortOrder,
          page,
          pageSize,
        });

        if (!isCancelled) {
          setItems(result.items);
          setTotalItems(result.total);
        }
      } catch (err) {
        console.error('Failed to load items:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(loadItems, 150);
    return () => {
      isCancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [search, selectedCategory, stockFilter, sortBy, sortOrder, page, pageSize, refreshTrigger, localRefresh]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, stockFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Selection handlers for Batch Print
  const handleToggleSelectAllOnPage = () => {
    const next = new Set(selectedIds);
    const allSelected = items.every((it) => next.has(it.id));
    if (allSelected) {
      items.forEach((it) => next.delete(it.id));
    } else {
      items.forEach((it) => next.add(it.id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleTriggerBatchPrint = async () => {
    if (selectedIds.size === 0) return;
    const selectedList: InventoryItem[] = [];
    for (const id of selectedIds) {
      const it = await db.getItemById(id);
      if (it) selectedList.push(it);
    }
    onOpenBatchPrint(selectedList);
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Hapus data barang '${item.name}' (${item.material_code}) beserta seluruh riwayat transaksinya? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    try {
      await db.deleteItem(item.id);
      // Reload current view
      const result = await db.getItems({
        search: search.trim(),
        category: selectedCategory,
        stockFilter,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });
      setItems(result.items);
      setTotalItems(result.total);
      // Remove from selection if was selected
      if (selectedIds.has(item.id)) {
        const next = new Set(selectedIds);
        next.delete(item.id);
        setSelectedIds(next);
      }
    } catch (err: any) {
      alert(`Gagal menghapus barang: ${err.message}`);
    }
  };

  const handleExportItems = async () => {
    try {
      setIsLoading(true);
      const allData = await db.getItems({
        search: search.trim(),
        category: selectedCategory,
        stockFilter,
        sortBy,
        sortOrder,
        page: 1,
        pageSize: 100000,
      });
      const res = exportInventoryItemsToExcel(allData.items);
      alert(`Berhasil mengekspor ${res.count} data barang ke file ${res.filename}`);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Gagal mengekspor data barang: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate6000 = async () => {
    setIsGenerating6k(true);
    try {
      await db.generateBulk6000Items((curr, tot) => {
        setGenProgress({ current: curr, total: tot });
      });
      const cats = await db.getCategories();
      setCategories(cats);
      const res = await db.getItems({ page: 1, pageSize });
      setItems(res.items);
      setTotalItems(res.total);
      alert('Berhasil membuat 6.000 data inventaris! Anda dapat menguji performa pencarian dan paginasi sekarang.');
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setIsGenerating6k(false);
      setGenProgress(null);
    }
  };

  const isAllCurrentPageSelected = items.length > 0 && items.every((it) => selectedIds.has(it.id));

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      
      {/* Control Toolbar Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        
        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Daftar Barang & Inventaris Fisik
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {totalItems.toLocaleString('id-ID')} Total Barang
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Cari nomor material, cetak stiker label QR, dan kelola mutasi stok
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* RBAC: Admin and Supervisor can Tambah Barang and Import CSV */}
            {(isAdmin || isSupervisor) && (
              <>
                <button
                  onClick={onOpenAddItem}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-200 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Barang</span>
                </button>

                <button
                  onClick={onOpenImportCsv}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-300 transition-all"
                  title="Import data massal menggunakan file format Excel (.xlsx) atau CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Import Excel / CSV</span>
                </button>
              </>
            )}

            {/* Export Master Barang to Excel */}
            <button
              onClick={handleExportItems}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-all"
              title="Ekspor seluruh data barang ke format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>

            {/* Bulk Print Trigger (Enabled when items are selected) */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleTriggerBatchPrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-lg shadow-sm shadow-emerald-200 transition-all animate-pulse"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Label QR ({selectedIds.size})</span>
              </button>
            )}

            {/* 6000 Dummy Data Generator button for scale testing */}
            {totalItems < 6000 && (
              <button
                onClick={handleGenerate6000}
                disabled={isGenerating6k}
                className="flex items-center gap-1 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold rounded-lg transition-colors"
                title="Populate 6.000 items untuk menguji performa paginasi"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {isGenerating6k
                    ? `Proses (${genProgress?.current || 0}/${genProgress?.total || 6000})...`
                    : 'Generate 6.000 Data'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode 18 digit (031007...), nama, atau lokasi BIN (TN 1...)..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Kategori ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Stock Level Filter */}
          <div>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Status Stok: Semua</option>
              <option value="normal">Stok Aman (&gt; min)</option>
              <option value="low">Stok Kritis (≤ min)</option>
              <option value="out">Stok Habis (= 0)</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="code">Urutkan: Kode Material</option>
              <option value="name">Urutkan: Nama Barang</option>
              <option value="stock">Urutkan: Kuantitas Stok</option>
              <option value="updated">Urutkan: Terakhir Update</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-700 transition-colors"
              title={`Urutan: ${sortOrder === 'asc' ? 'Menaik (A-Z)' : 'Menurun (Z-A)'}`}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Floating Selection Banner for Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-900 text-white px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>{selectedIds.size} barang</strong> dipilih untuk cetak label
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearSelection}
              className="px-2.5 py-1 text-slate-300 hover:text-white text-xs underline"
            >
              Batalkan Pilihan
            </button>
            <button
              onClick={handleTriggerBatchPrint}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Items Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {isLoading && (
          <div className="h-1 bg-indigo-600 animate-pulse" />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={handleToggleSelectAllOnPage}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title="Pilih semua di halaman ini"
                  />
                </th>
                <th className="py-3 px-3 w-32 sm:w-44 whitespace-nowrap">Kode Material (18 Digit)</th>
                <th className="py-3 px-4 min-w-[150px] sm:min-w-[200px]">Nama Barang & Spesifikasi</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Lokasi BIN</th>
                <th className="py-3 px-3 text-right">Stok Fisik</th>
                <th className="py-3 px-4 text-center">Aksi & Kartu Barang</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-xs text-slate-700">Tidak ada barang yang cocok</p>
                    <p className="text-[11px] mt-1">Coba sesuaikan kata kunci pencarian atau filter kategori.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isOut = item.current_stock <= 0;
                  const isLow = item.current_stock > 0 && item.current_stock <= item.min_stock;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(item.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Material Code */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          onClick={() => onOpenBinCard(item)}
                          className="font-mono font-bold text-xs text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1"
                          title="Buka Kartu Barang Digital (Bin Card)"
                        >
                          <span>{item.material_code}</span>
                        </button>
                      </td>

                      {/* Name & Description */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => onOpenBinCard(item)}
                          className="font-semibold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
                        >
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <Layers className="w-3 h-3 text-slate-400" />
                          {item.category}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded">
                          <MapPin className="w-3 h-3 text-amber-500" />
                          {item.location}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className={`font-extrabold font-mono text-sm ${
                          isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                        }`}>
                          {item.current_stock}{' '}
                          <span className="text-[10px] font-normal text-slate-500">{formatUnit(item.unit)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Min: {item.min_stock} {formatUnit(item.unit)}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          
                          {/* Bin Card Button */}
                          <button
                            onClick={() => onOpenBinCard(item)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-md text-[11px] flex items-center gap-1 transition-colors"
                            title="Buka Kartu Barang Digital"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Bin Card</span>
                          </button>

                          {/* Quick STO Button */}
                          <button
                            onClick={() => setStoItem(item)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-md text-[11px] flex items-center gap-1 transition-colors"
                            title="Stock Take / STO (Opname Fisik Barang)"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            <span>STO</span>
                          </button>

                          {/* Tombol Edit Barang (Semua rincian barang dapat diedit langsung) */}
                          <button
                            onClick={() => onOpenEditItem(item)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold rounded-md text-[11px] flex items-center gap-1 transition-colors shadow-2xs"
                            title="Edit Barang (Ubah rincian informasi seperti nama, Bin Location, satuan, dll.)"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>Edit</span>
                          </button>

                          {/* Quick In/Out buttons for field staff and admin */}
                          <button
                            onClick={() => onRecordTransaction(item, 'IN')}
                            className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                            title="Catat Pemasukan (IN)"
                          >
                            <ArrowDownLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onRecordTransaction(item, 'OUT')}
                            disabled={isOut}
                            className="p-1 text-rose-700 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-40"
                            title="Catat Pengeluaran (OUT)"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>

                          {/* Single QR Print/View */}
                          <button
                            onClick={() => onOpenBatchPrint([item])}
                            className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                            title="Cetak Label QR Barang Ini"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          {/* Hapus Barang (Hanya Admin / Supervisor) */}
                          {(isAdmin || isSupervisor) && (
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Hapus Barang"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* High Performance Pagination Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-3">
            <span className="text-slate-600">
              Menampilkan{' '}
              <strong>
                {totalItems === 0 ? 0 : (page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, totalItems)}
              </strong>{' '}
              dari <strong>{totalItems.toLocaleString('id-ID')}</strong> barang
            </span>

            <div className="flex items-center gap-1">
              <span className="text-slate-500">Per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-medium text-slate-700">
              Hal. <strong>{page}</strong> dari <strong>{totalPages}</strong>
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Jump to Page input (Crucial for 6,000+ items navigation!) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const p = parseInt(jumpPage, 10);
                if (!isNaN(p) && p >= 1 && p <= totalPages) {
                  setPage(p);
                  setJumpPage('');
                }
              }}
              className="flex items-center gap-1 ml-2"
            >
              <input
                type="number"
                min="1"
                max={totalPages}
                placeholder="Ke hal..."
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-center"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-[11px] font-semibold"
              >
                Go
              </button>
            </form>
          </div>

        </div>

      </div>

      {/* Stock Take / STO Modal */}
      {stoItem && (
        <StockTakeModal
          isOpen={!!stoItem}
          item={stoItem}
          onClose={() => setStoItem(null)}
          onSuccess={() => {
            setStoItem(null);
            setLocalRefresh((r) => r + 1);
          }}
        />
      )}

    </div>
  );
};
