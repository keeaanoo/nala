import React, { useState, useEffect } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, CheckCircle2, AlertTriangle, User, FileText, Calendar, Hash, Lock } from 'lucide-react';
import { InventoryItem, TransactionType } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { formatUnit } from '../utils/units';

interface TransactionModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  initialType?: TransactionType;
  onClose: () => void;
  onSuccess: (updatedItem: InventoryItem) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  item,
  initialType = 'IN',
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>(initialType);
  const [quantity, setQuantity] = useState<number | ''>(0);
  const [picName, setPicName] = useState<string>('');
  const [docRef, setDocRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setType(initialType);
      setQuantity(0);
      // Auto-fill & Lock Nama berdasarkan user logged-in
      const currentUserName = user?.name
        ? `${user.name}${user.group ? ` (${user.group})` : ''}`
        : 'Petugas Logistik';
      setPicName(currentUserName);
      setDocRef('');
      setNotes('');
      setDate(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
      setErrorMessage(null);
    }
  }, [isOpen, item, initialType, user]);

  if (!isOpen || !item) return null;

  const numericQuantity = typeof quantity === 'number' ? quantity : 0;
  const currentStock = item.current_stock;
  const balanceAfter = type === 'IN' ? currentStock + numericQuantity : currentStock - numericQuantity;
  const isInsufficientStock = type === 'OUT' && numericQuantity > currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Mandatory/Required Field Validation (Nama, Nomor Dokumen, Tanggal)
    if (!picName.trim()) {
      setErrorMessage('Field Nama Petugas wajib terisi dan tidak boleh kosong.');
      return;
    }

    if (!docRef.trim()) {
      setErrorMessage('Field Nomor Dokumen (SJ / PO / SPK) wajib diisi.');
      return;
    }

    if (!date.trim()) {
      setErrorMessage('Field Tanggal dan Waktu Transaksi wajib diisi.');
      return;
    }

    if (numericQuantity <= 0) {
      setErrorMessage('Kuantitas mutasi harus lebih besar dari 0 untuk disimpan.');
      return;
    }

    if (isInsufficientStock) {
      setErrorMessage(`Stok tidak mencukupi! Stok saat ini hanya ${currentStock} ${formatUnit(item.unit)}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Instant execution with zero artificial delay
      const result = await db.recordTransaction({
        item_id: item.id,
        material_code: item.material_code,
        item_name: item.name,
        transaction_type: type,
        quantity: numericQuantity,
        pic_name: picName.trim(),
        operator_username: user?.username || 'user',
        notes: notes.trim() || (type === 'IN' ? 'Pemasukan barang reguler' : 'Pengeluaran barang reguler'),
        doc_ref: docRef.trim(),
        transaction_date: date ? new Date(date).toISOString() : new Date().toISOString(),
      });

      onSuccess(result.item);
      onClose();
    } catch (err: any) {
      console.error('Failed to submit transaction:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header with Type Indicator */}
        <div className={`px-6 py-4 flex items-center justify-between text-white ${
          type === 'IN' ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-rose-600 to-red-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
              {type === 'IN' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">
                {type === 'IN' ? 'Catat Barang Masuk (IN)' : 'Catat Barang Keluar (OUT)'}
              </h3>
              <p className="text-xs text-white/80">Mutasi otomatis memperbarui saldo stok Kartu Barang</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item Summary Pill */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded-sm border border-slate-200 mr-2">
              {item.material_code}
            </span>
            <span className="font-semibold text-slate-900">{item.name}</span>
          </div>
          <div className="text-slate-500">
            Lokasi: <span className="font-medium text-slate-700">{item.location}</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Transaction Type Segmented Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Jenis Mutasi Stok:
            </label>
            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setType('IN')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'IN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Pemasukan (IN)</span>
              </button>
              <button
                type="button"
                onClick={() => setType('OUT')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'OUT'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Pengeluaran (OUT)</span>
              </button>
            </div>
          </div>

          {/* Quantity & Stock Calculation Card */}
          <div className="rounded-xl p-4 bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                Jumlah Kuantitas ({formatUnit(item.unit)}):
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuantity(0)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 border border-slate-200 rounded text-slate-600 hover:bg-slate-200"
                  title="Reset kuantitas ke 0"
                >
                  Reset (0)
                </button>
                {[1, 5, 10, 25, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuantity((q) => (typeof q === 'number' ? q : 0) + val)}
                    className="px-2 py-0.5 text-[11px] font-semibold bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100"
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(0, (typeof q === 'number' ? q : 0) - 1))}
                className="w-10 h-10 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center text-lg active:scale-95"
                title="Kurangi kuantitas"
              >
                -
              </button>
              <input
                type="number"
                value={quantity === '' ? '' : quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setQuantity('');
                  } else {
                    const sanitized = val.replace(/^0+(?=\d)/, '');
                    const parsed = parseInt(sanitized, 10);
                    setQuantity(isNaN(parsed) ? 0 : Math.max(0, parsed));
                  }
                }}
                onFocus={(e) => {
                  e.target.select();
                }}
                onBlur={() => {
                  if (quantity === '' || isNaN(Number(quantity))) {
                    setQuantity(0);
                  }
                }}
                placeholder="0"
                className="flex-1 text-center font-bold text-xl py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                required
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => (typeof q === 'number' ? q : 0) + 1)}
                className="w-10 h-10 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center text-lg active:scale-95"
                title="Tambah kuantitas"
              >
                +
              </button>
            </div>

            {/* Live Stock Calculation Strip */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-3 text-center text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Stok Awal</span>
                <span className="font-bold text-slate-800">{currentStock} {formatUnit(item.unit)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Mutasi</span>
                <span className={`font-bold ${type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {type === 'IN' ? `+${numericQuantity}` : `-${numericQuantity}`} {formatUnit(item.unit)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Saldo Akhir</span>
                <span className={`font-bold text-sm ${isInsufficientStock ? 'text-rose-600 animate-pulse' : 'text-indigo-700'}`}>
                  {balanceAfter} {formatUnit(item.unit)}
                </span>
              </div>
            </div>

            {isInsufficientStock && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>Kuantitas melebihi stok yang ada ({currentStock} {formatUnit(item.unit)}). Stok tidak boleh negatif!</span>
              </div>
            )}
          </div>

          {/* PIC & Reference Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Nama Petugas (PIC) <span className="text-rose-500 font-bold">*</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  <Lock className="w-2.5 h-2.5 text-amber-600" />
                  Terkunci
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={picName}
                  readOnly
                  disabled
                  title="Field nama dikunci otomatis sesuai akun pengguna yang sedang login untuk mencegah manipulasi data"
                  className="w-full px-3 py-2 text-xs bg-slate-100/90 text-slate-800 font-semibold border border-slate-300 rounded-lg cursor-not-allowed select-none focus:outline-hidden"
                  required
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Otomatis terisi & terkunci dari sesi akun yang sedang aktif.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  No. Dokumen / Referensi <span className="text-rose-500 font-bold">*</span>
                </span>
                <span className="text-[10px] text-rose-500 font-medium">Wajib diisi</span>
              </label>
              <input
                type="text"
                value={docRef}
                onChange={(e) => setDocRef(e.target.value)}
                placeholder="Contoh: SJ-9912, PO-104, SPK-03"
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 ${
                  !docRef.trim() && errorMessage ? 'border-rose-400 ring-rose-200 ring-2' : 'border-slate-300 focus:ring-indigo-500'
                }`}
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">Nomor Surat Jalan, Purchase Order, atau SPK resmi.</p>
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Waktu Transaksi <span className="text-rose-500 font-bold">*</span>
              </span>
              <span className="text-[10px] text-rose-500 font-medium">Wajib diisi</span>
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">Waktu mutasi fisik barang dilakukan di gudang.</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Keterangan / Keperluan:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Penerimaan barang baru dari supplier PT Jaya Abadi / Pemakaian maintenance mesin bubut..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInsufficientStock}
              className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                type === 'IN'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : type === 'IN' ? 'Simpan Pemasukan (IN)' : 'Simpan Pengeluaran (OUT)'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
