import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  ExternalLink,
  Download,
  ClipboardCheck,
} from 'lucide-react';
import { Transaction } from '../types';
import { db } from '../services/db';
import { formatStandardRoleName } from '../utils/roleFormat';

interface TransactionHistoryViewProps {
  onSelectItemByCode: (code: string) => void;
  refreshTrigger?: number;
}

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  onSelectItemByCode,
  refreshTrigger,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT' | 'STO'>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  const loadTransactions = async (silent = false) => {
    if (!silent) setIsLoading(true);

    try {
      const txs = await db.getRecentTransactions(300);
      setTransactions(txs);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Real-time listener: loads on mount and live-syncs automatically whenever Firestore emits onSnapshot
  useEffect(() => {
    loadTransactions();

    const unsubscribe = db.subscribe(() => {
      loadTransactions(true);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshTrigger]);

  const filtered = transactions.filter((t) => {
    if (typeFilter !== 'ALL' && t.transaction_type !== typeFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();

      return (
        t.material_code.toLowerCase().includes(q) ||
        t.item_name.toLowerCase().includes(q) ||
        t.pic_name.toLowerCase().includes(q) ||
        (t.doc_ref && t.doc_ref.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    return true;
  });

  const handleExportCsv = () => {
    if (filtered.length === 0) return;

    const headers = [
      'ID,Tanggal,Kode_Material,Nama_Barang,Jenis,Kuantitas,Saldo_Akhir,No_Dokumen,Petugas,Catatan',
    ];

    const rows = filtered.map((t) =>
      [
        t.id,
        t.transaction_date,
        t.material_code,
        `"${t.item_name.replace(/"/g, '""')}"`,
        t.transaction_type,
        t.quantity,
        t.balance_after,
        `"${(t.doc_ref || '').replace(/"/g, '""')}"`,
        `"${t.pic_name.replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ].join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `riwayat_mutasi_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
              Riwayat Mutasi Keluar - Masuk Barang
            </h2>

            <p className="text-xs text-slate-500">
              Audit jejak transaksi mutasi fisik barang dan pengisian kartu persediaan
            </p>
          </div>

          <button
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Ekspor CSV</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode material, nama, surat jalan, atau nama petugas..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 rounded-md transition-colors ${
                typeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Mutasi
            </button>

            <button
              onClick={() => setTypeFilter('IN')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                typeFilter === 'IN'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              Masuk (IN)
            </button>

            <button
              onClick={() => setTypeFilter('OUT')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                typeFilter === 'OUT'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
              Keluar (OUT)
            </button>

            <button
              onClick={() => setTypeFilter('STO')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                typeFilter === 'STO'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600" />
              Stock Opname (STO)
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-200/60 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Waktu Transaksi</th>
                <th className="py-3 px-3">Kode Material</th>
                <th className="py-3 px-4 min-w-[200px]">Nama Barang</th>
                <th className="py-3 px-3 text-center">Jenis</th>
                <th className="py-3 px-3 text-right">Kuantitas</th>
                <th className="py-3 px-3 text-right">Saldo Sesudah</th>
                <th className="py-3 px-3">No. Dokumen</th>
                <th className="py-3 px-3">Petugas (PIC)</th>
                <th className="py-3 px-4">Keterangan</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Memuat riwayat transaksi...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Tidak ada catatan mutasi yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const isIn = tx.transaction_type === 'IN';
                  const isSto =
                    tx.transaction_type === 'STO' ||
                    tx.notes?.includes('[Stock Opname / STO]');

                  const dateFormatted = new Date(tx.transaction_date).toLocaleString(
                    'id-ID',
                    {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  );

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium text-[11px]">
                        {dateFormatted}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          onClick={() => onSelectItemByCode(tx.material_code)}
                          className="font-mono font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1"
                          title="Buka Kartu Barang Digital"
                        >
                          <span>{tx.material_code}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {tx.item_name}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isSto ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"
                            title="Verifikasi Stock Opname"
                          >
                            <ClipboardCheck className="w-3 h-3 text-indigo-600" />
                            STO
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isIn
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isIn ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {tx.transaction_type}
                          </span>
                        )}
                      </td>

                      <td
                        className={`py-3 px-3 text-right font-mono font-bold text-xs whitespace-nowrap ${
                          isSto
                            ? 'text-indigo-700'
                            : isIn
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                        }`}
                      >
                        {isSto
                          ? `${tx.quantity} (Fisik)`
                          : isIn
                            ? `+${tx.quantity}`
                            : `-${tx.quantity}`}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        {tx.balance_after}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {tx.doc_ref || '-'}
                      </td>

                      <td className="py-3 px-3 text-slate-700 font-semibold whitespace-nowrap">
                        {formatStandardRoleName(tx.pic_name)}
                      </td>

                      <td
                        className="py-3 px-4 text-slate-500 max-w-xs truncate"
                        title={tx.notes}
                      >
                        {tx.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
