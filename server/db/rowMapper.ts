import type {
  CleanedSalesRow,
  DataQualityReport,
  ParsedSalesDataset,
} from '../../src/types/sales.ts';
import type { DatasetRow, DbSalesRow } from './schema.ts';

export function hydrateParsedDataset(meta: DatasetRow, dbRows: DbSalesRow[]): ParsedSalesDataset {
  const rows: CleanedSalesRow[] = [];
  const aliasCounter = new Map<string, { raw: string; normalized: string; count: number }>();
  const duplicateSamples: DataQualityReport['duplicateSamples'] = [];

  for (const r of dbRows) {
    const row: CleanedSalesRow = {
      rowNumber: r.row_number,
      date: r.date,
      invoice_no: r.invoice_no,
      region: r.region,
      rawRegion: r.raw_region,
      branch: r.branch,
      outlet_id: r.outlet_id,
      outlet_name: r.outlet_name,
      rawOutletName: r.raw_outlet_name,
      outlet_type: r.outlet_type,
      salesman: r.salesman,
      brand: r.brand,
      sku: r.sku,
      qty_carton: r.qty_carton,
      price_per_carton_idr: r.price_per_carton_idr,
      gross_sales_idr: r.gross_sales_idr,
      discount_idr: r.discount_idr,
      net_sales_idr: r.net_sales_idr,
      monthKey: r.month_key,
      isReturn: r.is_return === 1,
      isExactDuplicate: r.is_exact_duplicate === 1,
      hasMissingSalesman: r.has_missing_salesman === 1,
      wasRegionNormalized: r.was_region_normalized === 1,
      wasWhitespaceTrimmed: r.was_whitespace_trimmed === 1,
    };
    rows.push(row);

    if (row.wasRegionNormalized) {
      const rawTrimmed = row.rawRegion.trim();
      const aliasKey = `${rawTrimmed}->${row.region}`;
      const existing = aliasCounter.get(aliasKey);
      if (existing) {
        existing.count += 1;
      } else {
        aliasCounter.set(aliasKey, {
          raw: rawTrimmed,
          normalized: row.region,
          count: 1,
        });
      }
    }

    if (row.isExactDuplicate && duplicateSamples.length < 15) {
      duplicateSamples.push({
        rowNumber: row.rowNumber,
        invoice_no: row.invoice_no,
        outlet_name: row.outlet_name,
        sku: row.sku,
        net_sales_idr: row.net_sales_idr,
      });
    }
  }

  return {
    rows,
    quality: {
      totalRawRows: meta.total_raw_rows,
      validRows: meta.valid_rows,
      skippedInvalidRows: meta.skipped_invalid_rows,
      exactDuplicateCount: meta.exact_duplicate_count,
      duplicateSamples,
      normalizedRegionCount: meta.normalized_region_count,
      regionAliases: Array.from(aliasCounter.values()).sort((a, b) => b.count - a.count),
      trimmedWhitespaceCount: meta.trimmed_whitespace_count,
      missingSalesmanCount: meta.missing_salesman_count,
      returnLineCount: meta.return_line_count,
      returnInvoiceCount: meta.return_invoice_count,
      totalReturnNetIdr: meta.total_return_net_idr,
    },
    availableMonths: Array.from(new Set(rows.map((r) => r.monthKey))).sort(),
    availableRegions: Array.from(new Set(rows.map((r) => r.region))).sort(),
    availableBrands: Array.from(new Set(rows.map((r) => r.brand))).sort(),
  };
}
