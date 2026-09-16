import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Image, Keyboard, AlertCircle, CheckCircle2, ArrowRight, Zap, Upload, RefreshCw, FolderOpen } from 'lucide-react';
import { db } from '../services/db';
import { InventoryItem } from '../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemFound: (item: InventoryItem) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onItemFound,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [sampleItems, setSampleItems] = useState<InventoryItem[]>([]);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerContainerId = 'qr-reader-container';

  // Fetch a few sample items for quick test clicks
  useEffect(() => {
    if (isOpen) {
      db.getItems({ pageSize: 5 }).then(({ items }) => setSampleItems(items));
    }
  }, [isOpen]);

  // Handle camera scanner lifecycle
  useEffect(() => {
    if (!isOpen || activeMode !== 'camera') {
      stopCamera();
      return;
    }

    let isMounted = true;
    const startScanner = async () => {
      setCameraError(null);
      setIsScanning(true);

      // Brief delay to ensure DOM element is ready
      await new Promise((r) => setTimeout(r, 150));
      if (!isMounted) return;

      try {
        const element = document.getElementById(scannerContainerId);
        if (!element) return;

        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch {
            // Ignore
          }
        }

        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            handleCodeDetected(decodedText);
          },
          () => {
            // Frame scan failure (benign, scanning continues)
          }
        );
      } catch (err: any) {
        console.warn('Camera start error:', err);
        if (isMounted) {
          setCameraError(
            'Kamera tidak dapat diakses (izin ditolak atau perangkat tidak mendukung). Anda dapat menggunakan opsi Unggah dari Galeri Foto atau Masukkan Kode Manual di bawah.'
          );
          setIsScanning(false);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, activeMode]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleCodeDetected = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    await stopCamera();

    // Look up item in database
    const item = await db.getItemByMaterialCode(code);
    if (item) {
      onItemFound(item);
      onClose();
    } else {
      // Check if it's formatted as JSON or URL
      let matchedCode = code;
      try {
        const parsed = JSON.parse(rawCode);
        if (parsed.material_code) matchedCode = parsed.material_code.toUpperCase();
      } catch {
        // Not JSON
      }

      const retryItem = await db.getItemByMaterialCode(matchedCode);
      if (retryItem) {
        onItemFound(retryItem);
        onClose();
      } else {
        setManualError(`Barang dengan kode '${rawCode}' tidak ditemukan di sistem.`);
        setActiveMode('manual');
        setManualCode(rawCode);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    setIsProcessingImage(true);

    // Create thumbnail preview
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // Small pause to allow preview render
      await new Promise((r) => setTimeout(r, 100));
      const html5QrCode = new Html5Qrcode('qr-temp-file-reader');
      const decodedText = await html5QrCode.scanFile(file, true);
      setIsProcessingImage(false);
      handleCodeDetected(decodedText);
    } catch (err) {
      console.error('File scan error:', err);
      setIsProcessingImage(false);
      setCameraError('QR Code tidak terdeteksi pada gambar yang diunggah. Pastikan pencahayaan cukup dan kode QR tidak terpotong.');
    } finally {
      // Reset input value to allow selecting same file again if needed
      if (e.target) e.target.value = '';
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setManualError(null);
    const item = await db.getItemByMaterialCode(manualCode.trim());
    if (item) {
      onItemFound(item);
      onClose();
    } else {
      setManualError(`Barang dengan kode '${manualCode.trim().toUpperCase()}' tidak ditemukan dalam inventaris.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">Scan QR Kartu Barang</h3>
              <p className="text-[11px] text-slate-400">Pindai kode fisik via kamera atau unggah dari galeri</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveMode('camera')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeMode === 'camera'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Kamera HP / Web
          </button>
          <button
            onClick={() => {
              stopCamera();
              setActiveMode('upload');
            }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeMode === 'upload'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Unggah dari Galeri
          </button>
          <button
            onClick={() => {
              stopCamera();
              setActiveMode('manual');
            }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeMode === 'manual'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Ketik Manual
          </button>
        </div>

        {/* Scanner Content Area */}
        <div className="p-5">
          {activeMode === 'camera' && (
            <div>
              {cameraError ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{cameraError}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-amber-200/60 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        stopCamera();
                        setActiveMode('upload');
                        setTimeout(() => fileInputRef.current?.click(), 100);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1"
                    >
                      <FolderOpen className="w-3 h-3" />
                      Pilih dari Galeri Foto
                    </button>
                    <button
                      onClick={() => setActiveMode('manual')}
                      className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                    >
                      Input Kode Manual
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center border-2 border-slate-700">
                    <div id={scannerContainerId} className="w-full h-full" />
                    
                    {/* Visual viewfinder overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-emerald-400/80 rounded-2xl relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br" />
                        <div className="w-full h-0.5 bg-emerald-400/80 absolute top-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>Arahkan ke QR Kartu Barang fisik.</span>
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setActiveMode('upload');
                        setTimeout(() => fileInputRef.current?.click(), 100);
                      }}
                      className="text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Unggah Foto Galeri
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMode === 'upload' && (
            <div className="space-y-4 text-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 cursor-pointer transition-all bg-slate-50 hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-2.5 group"
              >
                {uploadedImagePreview ? (
                  <div className="relative">
                    <img
                      src={uploadedImagePreview}
                      alt="Preview QR Code"
                      referrerPolicy="no-referrer"
                      className="w-32 h-32 object-contain rounded-xl border border-slate-200 shadow-sm bg-white"
                    />
                    {isProcessingImage && (
                      <div className="absolute inset-0 bg-slate-900/50 rounded-xl flex items-center justify-center text-white">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                    <FolderOpen className="w-7 h-7" />
                  </div>
                )}

                <div className="text-xs">
                  <span className="font-bold text-emerald-700 underline underline-offset-2">Pilih dari Galeri Foto HP/PC</span> atau seret file ke sini
                </div>
                <p className="text-[11px] text-slate-400">
                  Mendukung screenshot atau foto kamera: JPG, PNG, WEBP, GIF
                </p>

                <button
                  type="button"
                  className="mt-1 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Buka Galeri File</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Hidden container for file scan */}
              <div id="qr-temp-file-reader" className="hidden" />

              {cameraError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>
          )}

          {activeMode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Masukkan Nomor Kode Material:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: 031007000000000235"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono uppercase tracking-wider focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    <span>Cari</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {manualError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}
            </form>
          )}

          {/* Quick Simulator Test Chips */}
          <div className="mt-5 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                Uji Cepat (Klik Contoh Barang):
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sampleItems.slice(0, 4).map((it) => (
                <button
                  key={it.id}
                  onClick={() => {
                    onItemFound(it);
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-md text-xs font-mono transition-colors text-left"
                >
                  <span className="font-bold">{it.material_code}</span> - {it.name.slice(0, 16)}...
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
