import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { OutletMetric } from '../types/sales';
import { formatIDR } from '../utils/salesAnalytics';

interface WeakestOutletsSectionProps {
  weakestOutlets: OutletMetric[];
  allOutlets: OutletMetric[];
}

export function WeakestOutletsSection({
  weakestOutlets,
  allOutlets,
}: WeakestOutletsSectionProps) {
  const [showAllOutlets, setShowAllOutlets] = useState(false);

  const displayedOutlets = showAllOutlets ? allOutlets : weakestOutlets;

  return (
    <section
      id="outlet-terlemah"
      aria-labelledby="weakest-outlets-heading"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-700" aria-hidden="true" />
            <h2
              id="weakest-outlets-heading"
              className="text-base font-semibold text-slate-900"
            >
              5 Outlet Terlemah (Prioritas Tindak Lanjut)
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Peringkat berdasarkan penjualan bersih terendah pada cakupan filter aktif
          </p>
        </div>

        {allOutlets.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAllOutlets((prev) => !prev)}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span>
              {showAllOutlets
                ? 'Tampilkan Top 5 Terlemah Saja'
                : `Lihat Semua Outlet (${allOutlets.length})`}
            </span>
            {showAllOutlets ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {displayedOutlets.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          Tidak ada outlet yang cocok dengan kriteria filter saat ini.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th scope="col" className="px-5 py-3">
                  Peringkat
                </th>
                <th scope="col" className="px-4 py-3">
                  Outlet &amp; Lokasi
                </th>
                <th scope="col" className="px-4 py-3">
                  Salesman
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Invoice
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Karton
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Retur
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Penjualan Bersih
                </th>
                <th scope="col" className="px-5 py-3">
                  Catatan Kondisi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedOutlets.map((outlet, index) => {
                const isTopFiveWeakest = index < 5;
                return (
                  <tr
                    key={outlet.outletId}
                    data-testid={isTopFiveWeakest ? `weakest-outlet-row-${index + 1}` : undefined}
                    className={`transition-colors hover:bg-slate-50 ${
                      isTopFiveWeakest ? 'bg-rose-50/25' : ''
                    }`}
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold tabular-nums">
                      <span className={isTopFiveWeakest ? 'text-rose-700' : 'text-slate-500'}>
                        #{index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">{outlet.outletName}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        <span className="font-mono">{outlet.outletId}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{outlet.outletType}</span>
                        <span aria-hidden="true"> · </span>
                        <span>
                          {outlet.branch}, {outlet.region}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-700">
                      {outlet.primarySalesman}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {outlet.invoiceCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {outlet.qtyCarton.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      {outlet.returnNetIdr < 0 ? (
                        <span className="text-rose-700">
                          {formatIDR(outlet.returnNetIdr)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-mono text-sm font-semibold tabular-nums ${
                        isTopFiveWeakest ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {formatIDR(outlet.netSalesIdr)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {isTopFiveWeakest ? outlet.weaknessReason : 'Performa di atas 5 terbawah'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
