import { ShieldCheck } from 'lucide-react';
import type { DataQualityReport } from '../types/sales';
import { formatIDR } from '../utils/salesAnalytics';

interface DataQualitySectionProps {
  quality: DataQualityReport;
  deduplicateExact: boolean;
  includeReturns: boolean;
}

export function DataQualitySection({
  quality,
  deduplicateExact,
  includeReturns,
}: DataQualitySectionProps) {
  return (
    <section
      id="kualitas-data"
      aria-labelledby="data-quality-heading"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
          <h2 id="data-quality-heading" className="text-base font-semibold text-slate-900">
            Audit Kualitas &amp; Pembersihan Data CSV
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Normalisasi nama wilayah, pembersihan spasi berlebih, deteksi duplikat identik, dan pencatatan dokumen retur.
        </p>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Normalisasi Region</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {quality.normalizedRegionCount.toLocaleString('id-ID')} baris
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {quality.regionAliases.length > 0
              ? quality.regionAliases
                  .slice(0, 3)
                  .map((a) => `${a.raw} → ${a.normalized} (${a.count})`)
                  .join(', ')
              : 'Semua penulisan region sudah standar'}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Baris Duplikat Identik</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {quality.exactDuplicateCount.toLocaleString('id-ID')} baris
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Status:{' '}
            {quality.exactDuplicateCount === 0
              ? 'Tidak ditemukan duplikat'
              : deduplicateExact
                ? 'Otomatis dikecualikan dari agregasi'
                : 'Sedang disertakan dalam hitungan'}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Spasi &amp; Salesman Kosong</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {(quality.trimmedWhitespaceCount + quality.missingSalesmanCount).toLocaleString(
              'id-ID'
            )}{' '}
            baris
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {quality.trimmedWhitespaceCount} spasi dirapikan · {quality.missingSalesmanCount}{' '}
            salesman kosong
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Dokumen Retur (RTR)</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {quality.returnInvoiceCount.toLocaleString('id-ID')} dokumen
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {quality.returnLineCount} baris ({formatIDR(quality.totalReturnNetIdr)}) ·{' '}
            {includeReturns ? 'Memotong net sales' : 'Dikecualikan'}
          </p>
        </div>
      </div>

      {quality.duplicateSamples.length > 0 && (
        <div className="border-t border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold text-slate-700">
            Contoh Baris Duplikat Terdeteksi ({quality.duplicateSamples.length} ditampilkan)
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Baris CSV</th>
                  <th className="py-2 pr-4 font-medium">No. Invoice</th>
                  <th className="py-2 pr-4 font-medium">Outlet</th>
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 text-right font-medium">Net Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quality.duplicateSamples.map((dup) => (
                  <tr key={`${dup.rowNumber}-${dup.invoice_no}-${dup.sku}`}>
                    <td className="py-2 pr-4 font-mono text-slate-500 tabular-nums">
                      #{dup.rowNumber}
                    </td>
                    <td className="py-2 pr-4 font-mono text-slate-800">{dup.invoice_no}</td>
                    <td className="py-2 pr-4 text-slate-700">{dup.outlet_name}</td>
                    <td className="py-2 pr-4 text-slate-600">{dup.sku}</td>
                    <td className="py-2 text-right font-mono text-slate-800 tabular-nums">
                      {formatIDR(dup.net_sales_idr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
