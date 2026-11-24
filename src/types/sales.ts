export interface RawSalesRow {
  rowNumber: number;
  date: string;
  invoice_no: string;
  region: string;
  branch: string;
  outlet_id: string;
  outlet_name: string;
  outlet_type: string;
  salesman: string;
  brand: string;
  sku: string;
  qty_carton: number;
  price_per_carton_idr: number;
  gross_sales_idr: number;
  discount_idr: number;
  net_sales_idr: number;
}

export interface CleanedSalesRow extends RawSalesRow {
  rawRegion: string;
  rawOutletName: string;
  monthKey: string; // e.g. "2026-09"
  isReturn: boolean;
  isExactDuplicate: boolean;
  hasMissingSalesman: boolean;
  wasRegionNormalized: boolean;
  wasWhitespaceTrimmed: boolean;
}

export interface DataQualityReport {
  totalRawRows: number;
  validRows: number;
  skippedInvalidRows: number;
  exactDuplicateCount: number;
  duplicateSamples: Array<{
    rowNumber: number;
    invoice_no: string;
    outlet_name: string;
    sku: string;
    net_sales_idr: number;
  }>;
  normalizedRegionCount: number;
  regionAliases: Array<{ raw: string; normalized: string; count: number }>;
  trimmedWhitespaceCount: number;
  missingSalesmanCount: number;
  returnLineCount: number;
  returnInvoiceCount: number;
  totalReturnNetIdr: number;
}

export interface ParsedSalesDataset {
  rows: CleanedSalesRow[];
  quality: DataQualityReport;
  availableMonths: string[];
  availableRegions: string[];
  availableBrands: string[];
}

export interface SalesFilters {
  month: string; // 'all' or 'YYYY-MM'
  dateFrom?: string; // '' or 'YYYY-MM-DD'
  dateTo?: string; // '' or 'YYYY-MM-DD'
  region: string; // 'all' or normalized region name
  province?: string; // 'all' or official GeoJSON PROVINSI name
  branch?: string; // 'all' or branch name
  outletType?: string; // 'all' or outlet type
  brand: string; // 'all' or brand name
  searchQuery: string;
  deduplicateExact: boolean;
  includeReturns: boolean;
}

export interface RegionMetric {
  region: string;
  netSalesIdr: number;
  grossSalesIdr: number;
  discountIdr: number;
  returnNetIdr: number;
  qtyCarton: number;
  invoiceCount: number;
  outletCount: number;
  sharePct: number;
}

export interface BrandMetric {
  brand: string;
  netSalesIdr: number;
  grossSalesIdr: number;
  discountIdr: number;
  returnNetIdr: number;
  qtyCarton: number;
  skuCount: number;
  invoiceCount: number;
  avgPricePerCartonIdr: number;
  sharePct: number;
}

export type WeakOutletReason =
  | 'Terdampak retur penjualan'
  | 'Volume karton sangat rendah'
  | 'Frekuensi transaksi minim'
  | 'Nilai rata-rata invoice rendah';

export interface OutletMetric {
  outletId: string;
  outletName: string;
  outletType: string;
  region: string;
  branch: string;
  primarySalesman: string;
  netSalesIdr: number;
  grossSalesIdr: number;
  discountIdr: number;
  returnNetIdr: number;
  qtyCarton: number;
  invoiceCount: number;
  brandCount: number;
  avgOrderValueIdr: number;
  lastOrderDate: string;
  weaknessReason: WeakOutletReason;
}

export interface MonthlySalesPoint {
  monthKey: string;
  monthLabel: string;
  fullMonthLabel: string;
  netSalesIdr: number;
  grossSalesIdr: number;
  discountIdr: number;
  returnNetIdr: number;
  qtyCarton: number;
  invoiceCount: number;
  momGrowthPct: number | null;
}

export interface DashboardSummary {
  totalNetSalesIdr: number;
  totalGrossSalesIdr: number;
  totalDiscountIdr: number;
  totalReturnNetIdr: number;
  totalReturnCartons: number;
  totalCartons: number;
  netCartons: number;
  invoiceCount: number;
  returnInvoiceCount: number;
  outletCount: number;
  brandCount: number;
  regionCount: number;
  discountRatePct: number;
  dateRange: { start: string; end: string };
  monthlyTrend: MonthlySalesPoint[];
  regions: RegionMetric[];
  brands: BrandMetric[];
  weakestOutlets: OutletMetric[];
  allOutlets: OutletMetric[];
}
