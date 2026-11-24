import type {
  BrandMetric,
  CleanedSalesRow,
  DashboardSummary,
  MonthlySalesPoint,
  OutletMetric,
  RegionMetric,
  SalesFilters,
  WeakOutletReason,
} from '../types/sales';
import {
  formatCompactIDR,
  formatIDR,
  formatMonthLabel,
  formatShortMonthLabel,
} from './formatters';
import { resolveProvinceName } from './provinceMapping';

export { formatCompactIDR, formatIDR, formatMonthLabel, formatShortMonthLabel };

export function computeDatasetDateBounds(rows: CleanedSalesRow[]): {
  min: string;
  max: string;
} {
  if (rows.length === 0) return { min: '', max: '' };
  let min = rows[0].date;
  let max = rows[0].date;
  for (const r of rows) {
    if (r.date < min) min = r.date;
    if (r.date > max) max = r.date;
  }
  return { min, max };
}

export function computeFacetOptions(
  rows: CleanedSalesRow[],
  filters: SalesFilters
): {
  branches: string[];
  outletTypes: string[];
} {
  const branches = new Set<string>();
  const outletTypes = new Set<string>();

  const provinceFilter = filters.province ?? 'all';

  for (const row of rows) {
    if (filters.deduplicateExact && row.isExactDuplicate) continue;
    if (!filters.includeReturns && row.isReturn) continue;
    if (filters.month !== 'all' && row.monthKey !== filters.month) continue;
    if (filters.dateFrom && row.date < filters.dateFrom) continue;
    if (filters.dateTo && row.date > filters.dateTo) continue;
    if (filters.region !== 'all' && row.region !== filters.region) continue;
    if (provinceFilter !== 'all' && resolveProvinceName(row.branch, row.region) !== provinceFilter) {
      continue;
    }

    if (row.branch) branches.add(row.branch);
    if (row.outlet_type) outletTypes.add(row.outlet_type);
  }

  return {
    branches: Array.from(branches).sort((a, b) => a.localeCompare(b, 'id')),
    outletTypes: Array.from(outletTypes).sort((a, b) => a.localeCompare(b, 'id')),
  };
}

export function filterSalesRows(
  rows: CleanedSalesRow[],
  filters: SalesFilters
): CleanedSalesRow[] {
  const query = filters.searchQuery.trim().toLowerCase();
  const dateFrom = filters.dateFrom?.trim() ?? '';
  const dateTo = filters.dateTo?.trim() ?? '';
  const province = filters.province ?? 'all';
  const branch = filters.branch ?? 'all';
  const outletType = filters.outletType ?? 'all';

  const normalizedFrom = dateFrom && dateTo && dateFrom > dateTo ? dateTo : dateFrom;
  const normalizedTo = dateFrom && dateTo && dateFrom > dateTo ? dateFrom : dateTo;

  return rows.filter((row) => {
    if (filters.deduplicateExact && row.isExactDuplicate) return false;
    if (!filters.includeReturns && row.isReturn) return false;
    if (filters.month !== 'all' && row.monthKey !== filters.month) return false;
    if (normalizedFrom && row.date < normalizedFrom) return false;
    if (normalizedTo && row.date > normalizedTo) return false;
    if (filters.region !== 'all' && row.region !== filters.region) return false;
    if (province !== 'all' && resolveProvinceName(row.branch, row.region) !== province) return false;
    if (branch !== 'all' && row.branch !== branch) return false;
    if (outletType !== 'all' && row.outlet_type !== outletType) return false;
    if (filters.brand !== 'all' && row.brand !== filters.brand) return false;

    if (query) {
      const hay = [
        row.outlet_name,
        row.outlet_id,
        row.branch,
        row.region,
        row.brand,
        row.sku,
        row.salesman,
        row.invoice_no,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }

    return true;
  });
}

function classifyWeaknessReason(params: {
  returnNetIdr: number;
  grossSalesIdr: number;
  invoiceCount: number;
  qtyCarton: number;
  avgOrderValueIdr: number;
}): WeakOutletReason {
  if (params.returnNetIdr < 0 && Math.abs(params.returnNetIdr) >= params.grossSalesIdr * 0.15) {
    return 'Terdampak retur penjualan';
  }
  if (params.invoiceCount <= 1) {
    return 'Frekuensi transaksi minim';
  }
  if (params.qtyCarton <= 5) {
    return 'Volume karton sangat rendah';
  }
  return 'Nilai rata-rata invoice rendah';
}

export function computeDashboardSummary(rows: CleanedSalesRow[]): DashboardSummary {
  if (rows.length === 0) {
    return {
      totalNetSalesIdr: 0,
      totalGrossSalesIdr: 0,
      totalDiscountIdr: 0,
      totalReturnNetIdr: 0,
      totalReturnCartons: 0,
      totalCartons: 0,
      netCartons: 0,
      invoiceCount: 0,
      returnInvoiceCount: 0,
      outletCount: 0,
      brandCount: 0,
      regionCount: 0,
      discountRatePct: 0,
      dateRange: { start: '-', end: '-' },
      monthlyTrend: [],
      regions: [],
      brands: [],
      weakestOutlets: [],
      allOutlets: [],
    };
  }

  let totalNetSalesIdr = 0;
  let totalGrossSalesIdr = 0;
  let totalDiscountIdr = 0;
  let totalReturnNetIdr = 0;
  let totalReturnCartons = 0;
  let totalCartons = 0;
  let netCartons = 0;

  let minDate = rows[0].date;
  let maxDate = rows[0].date;

  const salesInvoices = new Set<string>();
  const returnInvoices = new Set<string>();
  const allOutletsSet = new Set<string>();
  const allBrandsSet = new Set<string>();
  const allRegionsSet = new Set<string>();

  const monthAcc = new Map<
    string,
    {
      netSalesIdr: number;
      grossSalesIdr: number;
      discountIdr: number;
      returnNetIdr: number;
      qtyCarton: number;
      invoices: Set<string>;
    }
  >();

  const regionAcc = new Map<
    string,
    {
      netSalesIdr: number;
      grossSalesIdr: number;
      discountIdr: number;
      returnNetIdr: number;
      qtyCarton: number;
      invoices: Set<string>;
      outlets: Set<string>;
    }
  >();

  const brandAcc = new Map<
    string,
    {
      netSalesIdr: number;
      grossSalesIdr: number;
      discountIdr: number;
      returnNetIdr: number;
      qtyCarton: number;
      skus: Set<string>;
      invoices: Set<string>;
    }
  >();

  const outletAcc = new Map<
    string,
    {
      outletId: string;
      outletName: string;
      outletType: string;
      region: string;
      branch: string;
      salesmanCounts: Map<string, number>;
      netSalesIdr: number;
      grossSalesIdr: number;
      discountIdr: number;
      returnNetIdr: number;
      qtyCarton: number;
      invoices: Set<string>;
      brands: Set<string>;
      lastOrderDate: string;
    }
  >();

  for (const r of rows) {
    if (r.date < minDate) minDate = r.date;
    if (r.date > maxDate) maxDate = r.date;

    totalNetSalesIdr += r.net_sales_idr;
    netCartons += r.qty_carton;

    if (r.isReturn) {
      totalReturnNetIdr += r.net_sales_idr;
      totalReturnCartons += Math.abs(r.qty_carton);
      returnInvoices.add(r.invoice_no);
    } else {
      totalGrossSalesIdr += r.gross_sales_idr;
      totalDiscountIdr += r.discount_idr;
      totalCartons += r.qty_carton;
      salesInvoices.add(r.invoice_no);
    }

    allOutletsSet.add(r.outlet_id);
    allBrandsSet.add(r.brand);
    allRegionsSet.add(r.region);

    // Monthly accumulator
    let mo = monthAcc.get(r.monthKey);
    if (!mo) {
      mo = {
        netSalesIdr: 0,
        grossSalesIdr: 0,
        discountIdr: 0,
        returnNetIdr: 0,
        qtyCarton: 0,
        invoices: new Set(),
      };
      monthAcc.set(r.monthKey, mo);
    }
    mo.netSalesIdr += r.net_sales_idr;
    mo.qtyCarton += r.qty_carton;
    if (r.isReturn) {
      mo.returnNetIdr += r.net_sales_idr;
    } else {
      mo.grossSalesIdr += r.gross_sales_idr;
      mo.discountIdr += r.discount_idr;
      mo.invoices.add(r.invoice_no);
    }

    // Region accumulator
    let reg = regionAcc.get(r.region);
    if (!reg) {
      reg = {
        netSalesIdr: 0,
        grossSalesIdr: 0,
        discountIdr: 0,
        returnNetIdr: 0,
        qtyCarton: 0,
        invoices: new Set(),
        outlets: new Set(),
      };
      regionAcc.set(r.region, reg);
    }
    reg.netSalesIdr += r.net_sales_idr;
    reg.qtyCarton += r.qty_carton;
    reg.outlets.add(r.outlet_id);
    if (r.isReturn) {
      reg.returnNetIdr += r.net_sales_idr;
    } else {
      reg.grossSalesIdr += r.gross_sales_idr;
      reg.discountIdr += r.discount_idr;
      reg.invoices.add(r.invoice_no);
    }

    // Brand accumulator
    let br = brandAcc.get(r.brand);
    if (!br) {
      br = {
        netSalesIdr: 0,
        grossSalesIdr: 0,
        discountIdr: 0,
        returnNetIdr: 0,
        qtyCarton: 0,
        skus: new Set(),
        invoices: new Set(),
      };
      brandAcc.set(r.brand, br);
    }
    br.netSalesIdr += r.net_sales_idr;
    br.qtyCarton += r.qty_carton;
    br.skus.add(r.sku);
    if (r.isReturn) {
      br.returnNetIdr += r.net_sales_idr;
    } else {
      br.grossSalesIdr += r.gross_sales_idr;
      br.discountIdr += r.discount_idr;
      br.invoices.add(r.invoice_no);
    }

    // Outlet accumulator
    let out = outletAcc.get(r.outlet_id);
    if (!out) {
      out = {
        outletId: r.outlet_id,
        outletName: r.outlet_name,
        outletType: r.outlet_type,
        region: r.region,
        branch: r.branch,
        salesmanCounts: new Map(),
        netSalesIdr: 0,
        grossSalesIdr: 0,
        discountIdr: 0,
        returnNetIdr: 0,
        qtyCarton: 0,
        invoices: new Set(),
        brands: new Set(),
        lastOrderDate: r.date,
      };
      outletAcc.set(r.outlet_id, out);
    }
    out.netSalesIdr += r.net_sales_idr;
    out.qtyCarton += r.qty_carton;
    out.brands.add(r.brand);
    if (r.date > out.lastOrderDate) out.lastOrderDate = r.date;
    if (r.salesman && r.salesman !== 'Belum Tercatat') {
      out.salesmanCounts.set(r.salesman, (out.salesmanCounts.get(r.salesman) ?? 0) + 1);
    }
    if (r.isReturn) {
      out.returnNetIdr += r.net_sales_idr;
    } else {
      out.grossSalesIdr += r.gross_sales_idr;
      out.discountIdr += r.discount_idr;
      out.invoices.add(r.invoice_no);
    }
  }

  const denominatorNet = totalNetSalesIdr > 0 ? totalNetSalesIdr : 1;

  const regions: RegionMetric[] = Array.from(regionAcc.entries())
    .map(([region, v]) => ({
      region,
      netSalesIdr: v.netSalesIdr,
      grossSalesIdr: v.grossSalesIdr,
      discountIdr: v.discountIdr,
      returnNetIdr: v.returnNetIdr,
      qtyCarton: v.qtyCarton,
      invoiceCount: v.invoices.size,
      outletCount: v.outlets.size,
      sharePct: (v.netSalesIdr / denominatorNet) * 100,
    }))
    .sort((a, b) => b.netSalesIdr - a.netSalesIdr);

  const brands: BrandMetric[] = Array.from(brandAcc.entries())
    .map(([brand, v]) => ({
      brand,
      netSalesIdr: v.netSalesIdr,
      grossSalesIdr: v.grossSalesIdr,
      discountIdr: v.discountIdr,
      returnNetIdr: v.returnNetIdr,
      qtyCarton: v.qtyCarton,
      skuCount: v.skus.size,
      invoiceCount: v.invoices.size,
      avgPricePerCartonIdr: v.qtyCarton > 0 ? Math.round(v.netSalesIdr / v.qtyCarton) : 0,
      sharePct: (v.netSalesIdr / denominatorNet) * 100,
    }))
    .sort((a, b) => b.netSalesIdr - a.netSalesIdr);

  const allOutlets: OutletMetric[] = Array.from(outletAcc.values())
    .map((v) => {
      let primarySalesman = 'Belum Tercatat';
      let topCount = 0;
      for (const [name, cnt] of v.salesmanCounts.entries()) {
        if (cnt > topCount) {
          topCount = cnt;
          primarySalesman = name;
        }
      }
      const invoiceCount = v.invoices.size;
      const avgOrderValueIdr = invoiceCount > 0 ? Math.round(v.netSalesIdr / invoiceCount) : v.netSalesIdr;
      return {
        outletId: v.outletId,
        outletName: v.outletName,
        outletType: v.outletType,
        region: v.region,
        branch: v.branch,
        primarySalesman,
        netSalesIdr: v.netSalesIdr,
        grossSalesIdr: v.grossSalesIdr,
        discountIdr: v.discountIdr,
        returnNetIdr: v.returnNetIdr,
        qtyCarton: v.qtyCarton,
        invoiceCount,
        brandCount: v.brands.size,
        avgOrderValueIdr,
        lastOrderDate: v.lastOrderDate,
        weaknessReason: classifyWeaknessReason({
          returnNetIdr: v.returnNetIdr,
          grossSalesIdr: v.grossSalesIdr,
          invoiceCount,
          qtyCarton: v.qtyCarton,
          avgOrderValueIdr,
        }),
      };
    })
    .sort((a, b) => a.netSalesIdr - b.netSalesIdr || a.qtyCarton - b.qtyCarton);

  const weakestOutlets = allOutlets.slice(0, 5);

  const discountRatePct =
    totalGrossSalesIdr > 0 ? (totalDiscountIdr / totalGrossSalesIdr) * 100 : 0;

  const sortedMonths = Array.from(monthAcc.entries()).sort(([a], [b]) => a.localeCompare(b));
  const monthlyTrend: MonthlySalesPoint[] = sortedMonths.map(([monthKey, v], idx) => {
    const prev = idx > 0 ? sortedMonths[idx - 1][1] : null;
    const momGrowthPct =
      prev && prev.netSalesIdr > 0
        ? ((v.netSalesIdr - prev.netSalesIdr) / prev.netSalesIdr) * 100
        : null;

    return {
      monthKey,
      monthLabel: formatShortMonthLabel(monthKey),
      fullMonthLabel: formatMonthLabel(monthKey),
      netSalesIdr: v.netSalesIdr,
      grossSalesIdr: v.grossSalesIdr,
      discountIdr: v.discountIdr,
      returnNetIdr: v.returnNetIdr,
      qtyCarton: v.qtyCarton,
      invoiceCount: v.invoices.size,
      momGrowthPct,
    };
  });

  return {
    totalNetSalesIdr,
    totalGrossSalesIdr,
    totalDiscountIdr,
    totalReturnNetIdr,
    totalReturnCartons,
    totalCartons,
    netCartons,
    invoiceCount: salesInvoices.size,
    returnInvoiceCount: returnInvoices.size,
    outletCount: allOutletsSet.size,
    brandCount: allBrandsSet.size,
    regionCount: allRegionsSet.size,
    discountRatePct,
    dateRange: { start: minDate, end: maxDate },
    monthlyTrend,
    regions,
    brands,
    weakestOutlets,
    allOutlets,
  };
}

