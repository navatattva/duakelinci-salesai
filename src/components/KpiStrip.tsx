import type { DashboardSummary } from '../types/sales';
import { formatCompactIDR, formatIDR } from '../utils/salesAnalytics';

interface KpiStripProps {
  summary: DashboardSummary;
}

export function KpiStrip({ summary }: KpiStripProps) {
  const hasReturns = summary.returnInvoiceCount > 0;

  return (
    <section aria-label="Ringkasan metrik utama" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-medium text-slate-500">Penjualan Bersih (Net Sales)</p>
        <p
          data-testid="kpi-net-sales"
          className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums"
        >
          {formatIDR(summary.totalNetSalesIdr)}
        </p>
        <p className="mt-2 text-xs text-slate-500 tabular-nums">
          Gross {formatCompactIDR(summary.totalGrossSalesIdr)}
          <span aria-hidden="true"> · </span>
          Diskon {summary.discountRatePct.toFixed(1)}%
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-medium text-slate-500">Volume Terkirim (Netto)</p>
        <p
          data-testid="kpi-net-cartons"
          className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums"
        >
          {summary.netCartons.toLocaleString('id-ID')} <span className="font-sans text-sm font-medium text-slate-500">karton</span>
        </p>
        <p className="mt-2 text-xs text-slate-500 tabular-nums">
          {summary.totalCartons.toLocaleString('id-ID')} terjual
          <span aria-hidden="true"> · </span>
          {summary.totalReturnCartons.toLocaleString('id-ID')} retur
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-medium text-slate-500">Cakupan Outlet &amp; Invoice</p>
        <p
          data-testid="kpi-outlets"
          className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums"
        >
          {summary.outletCount.toLocaleString('id-ID')} <span className="font-sans text-sm font-medium text-slate-500">outlet</span>
        </p>
        <p className="mt-2 text-xs text-slate-500 tabular-nums">
          {summary.invoiceCount.toLocaleString('id-ID')} invoice aktif
          <span aria-hidden="true"> · </span>
          {summary.regionCount} region
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-medium text-slate-500">Nilai Retur Penjualan</p>
        <p
          data-testid="kpi-returns"
          className={`mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums ${
            hasReturns ? 'text-rose-700' : 'text-slate-900'
          }`}
        >
          {hasReturns ? formatIDR(Math.abs(summary.totalReturnNetIdr)) : 'Rp 0'}
        </p>
        <p className="mt-2 text-xs text-slate-500 tabular-nums">
          {summary.returnInvoiceCount.toLocaleString('id-ID')} dokumen retur
          <span aria-hidden="true"> · </span>
          {summary.brandCount} brand aktif
        </p>
      </div>
    </section>
  );
}
