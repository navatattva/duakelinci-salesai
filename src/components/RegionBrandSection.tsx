import type { BrandMetric, RegionMetric } from '../types/sales';
import { formatCompactIDR, formatIDR } from '../utils/salesAnalytics';

interface RegionBrandSectionProps {
  regions: RegionMetric[];
  brands: BrandMetric[];
  selectedRegion: string;
  selectedBrand: string;
  onSelectRegion: (region: string) => void;
  onSelectBrand: (brand: string) => void;
}

export function RegionBrandSection({
  regions,
  brands,
  selectedRegion,
  selectedBrand,
  onSelectRegion,
  onSelectBrand,
}: RegionBrandSectionProps) {
  const maxRegionSales = Math.max(...regions.map((r) => Math.max(r.netSalesIdr, 0)), 1);
  const maxBrandSales = Math.max(...brands.map((b) => Math.max(b.netSalesIdr, 0)), 1);

  return (
    <section
      id="region-brand"
      aria-label="Penjualan per Region dan Brand"
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2"
    >
      {/* Region Panel */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Penjualan per Region</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Klik baris region untuk memfilter seluruh dashboard
            </p>
          </div>
          {selectedRegion !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectRegion('all')}
              className="shrink-0 whitespace-nowrap text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
            >
              Tampilkan semua
            </button>
          )}
        </div>

        {regions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Tidak ada data region pada filter saat ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {regions.map((reg) => {
              const isSelected = selectedRegion === reg.region;
              const barPct = Math.max(
                4,
                Math.min(100, (Math.max(reg.netSalesIdr, 0) / maxRegionSales) * 100)
              );

              return (
                <button
                  key={reg.region}
                  type="button"
                  onClick={() => onSelectRegion(isSelected ? 'all' : reg.region)}
                  aria-pressed={isSelected}
                  className={`block w-full px-5 py-3.5 text-left transition-colors ${
                    isSelected ? 'bg-sky-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-900">
                        {reg.region}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 tabular-nums">
                        {reg.outletCount} outlet · {reg.qtyCarton.toLocaleString('id-ID')} ktn
                      </span>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {formatIDR(reg.netSalesIdr)}
                      </span>
                      <span className="ml-2 font-mono text-xs text-slate-500">
                        ({reg.sharePct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        isSelected ? 'bg-sky-700' : 'bg-sky-600/85'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>
                      Gross {formatCompactIDR(reg.grossSalesIdr)} · Diskon{' '}
                      {formatCompactIDR(reg.discountIdr)}
                    </span>
                    <span>{reg.invoiceCount.toLocaleString('id-ID')} invoice</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Brand Panel */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Penjualan per Brand</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Diurutkan berdasarkan penjualan bersih (net sales)
            </p>
          </div>
          {selectedBrand !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectBrand('all')}
              className="shrink-0 whitespace-nowrap text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
            >
              Tampilkan semua
            </button>
          )}
        </div>

        {brands.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Tidak ada data brand pada filter saat ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {brands.map((br) => {
              const isSelected = selectedBrand === br.brand;
              const barPct = Math.max(
                4,
                Math.min(100, (Math.max(br.netSalesIdr, 0) / maxBrandSales) * 100)
              );

              return (
                <button
                  key={br.brand}
                  type="button"
                  onClick={() => onSelectBrand(isSelected ? 'all' : br.brand)}
                  aria-pressed={isSelected}
                  className={`block w-full px-5 py-3.5 text-left transition-colors ${
                    isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-900">
                        {br.brand}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 tabular-nums">
                        {br.skuCount} SKU · {br.qtyCarton.toLocaleString('id-ID')} ktn
                      </span>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {formatIDR(br.netSalesIdr)}
                      </span>
                      <span className="ml-2 font-mono text-xs text-slate-500">
                        ({br.sharePct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        isSelected ? 'bg-teal-700' : 'bg-teal-600/85'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>
                      Rata-rata {formatIDR(br.avgPricePerCartonIdr)}/ktn
                    </span>
                    <span>{br.invoiceCount.toLocaleString('id-ID')} invoice</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
