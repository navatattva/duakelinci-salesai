import { FileSpreadsheet, RotateCcw, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface CsvUploadModalProps {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmitCsv: (csvText: string, sourceLabel: string) => Promise<string | null>;
  onRestoreStarter: () => Promise<void>;
}

function decodeCsvFileBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let encoding: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8';

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'utf-16le';
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'utf-16be';
  } else if (bytes.length >= 4) {
    // Heuristic for BOM-less UTF-16 ASCII CSV exports (every other byte is 0x00)
    const sampleLimit = Math.min(bytes.length, 64);
    let oddZeroCount = 0;
    let evenZeroCount = 0;
    let pairs = 0;
    for (let i = 0; i + 1 < sampleLimit; i += 2) {
      pairs += 1;
      if (bytes[i] === 0) evenZeroCount += 1;
      if (bytes[i + 1] === 0) oddZeroCount += 1;
    }
    if (pairs >= 4 && oddZeroCount >= pairs * 0.75 && evenZeroCount === 0) {
      encoding = 'utf-16le';
    } else if (pairs >= 4 && evenZeroCount >= pairs * 0.75 && oddZeroCount === 0) {
      encoding = 'utf-16be';
    }
  }

  return new TextDecoder(encoding).decode(bytes).replace(/\u0000/g, '');
}

export function CsvUploadModal({
  isOpen,
  isSaving,
  onClose,
  onSubmitCsv,
  onRestoreStarter,
}: CsvUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  async function processFile(file: File) {
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const content = decodeCsvFileBuffer(buffer);
      const err = await onSubmitCsv(content, file.name);
      if (err) {
        setErrorMessage(err);
      } else {
        setErrorMessage(null);
        setPastedText('');
        onClose();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Gagal membaca file CSV. Pastikan file berformat CSV/teks yang valid.'
      );
    }
  }

  async function handlePasteSubmit() {
    if (!pastedText.trim()) {
      setErrorMessage('Tempelkan isi CSV (termasuk baris header) terlebih dahulu.');
      return;
    }
    setErrorMessage(null);
    try {
      const err = await onSubmitCsv(pastedText, 'Teks CSV Ditempel');
      if (err) {
        setErrorMessage(err);
      } else {
        setErrorMessage(null);
        setPastedText('');
        onClose();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal memproses teks CSV.');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-sky-700" aria-hidden="true" />
            <h2 id="upload-modal-title" className="text-base font-semibold text-slate-900">
              Muat &amp; Simpan Dataset ke SQLite (sales.csv)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Tutup jendela unggah CSV"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
            >
              {errorMessage}
            </div>
          )}

          {/* File Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) processFile(file);
            }}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              isDragging
                ? 'border-sky-600 bg-sky-50/70'
                : 'border-slate-300 bg-slate-50/70 hover:border-slate-400'
            }`}
          >
            <Upload className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-800">
              Tarik dan lepas file <span className="font-mono">sales.csv</span> ke sini
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Data akan otomatis diparsing, dibersihkan, dan disimpan permanen ke database SQLite
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Pilih file CSV"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              Pilih File CSV
            </button>
          </div>

          {/* Paste CSV Text */}
          <div>
            <label
              htmlFor="csv-paste-textarea"
              className="block text-xs font-semibold text-slate-700"
            >
              Atau tempel isi CSV secara langsung
            </label>
            <textarea
              id="csv-paste-textarea"
              rows={5}
              value={pastedText}
              disabled={isSaving}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="date,invoice_no,region,branch,outlet_id,outlet_name,outlet_type,salesman,brand,sku,qty_carton,price_per_carton_idr,gross_sales_idr,discount_idr,net_sales_idr&#10;2026-09-01,INV500001,..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={async () => {
              setErrorMessage(null);
              try {
                await onRestoreStarter();
                onClose();
              } catch (err) {
                setErrorMessage(
                  err instanceof Error ? err.message : 'Gagal mereset ke data awal.'
                );
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset ke Data Awal</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handlePasteSubmit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan ke SQLite...' : 'Proses Teks CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
