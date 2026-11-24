import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { STARTER_SALES_CSV } from '../src/data/starterCsv.ts';
import type { ParsedSalesDataset } from '../src/types/sales.ts';
import { parseSalesCsv } from '../src/utils/csvParser.ts';
import { resolveProvinceName } from '../src/utils/provinceMapping.ts';
import { hydrateParsedDataset } from './db/rowMapper.ts';
import { initSalesSchema, type DatasetRow, type DbSalesRow } from './db/schema.ts';

export interface PersistedSalesPayload {
  dataset: ParsedSalesDataset;
  sourceLabel: string;
  isSampleFallback: boolean;
  updatedAt: string;
}

export interface SalesStoreOptions {
  dbPath?: string;
  publicCsvPath?: string;
}

export class SalesSqliteStore {
  private readonly db: DatabaseSync;
  private readonly dbPath: string;
  private readonly publicCsvPath: string;

  constructor(options: SalesStoreOptions = {}) {
    const rawDbPath = options.dbPath ?? process.env.SQLITE_DB_PATH ?? 'data/sales.sqlite';
    this.dbPath =
      rawDbPath === ':memory:' ? ':memory:' : path.resolve(process.cwd(), rawDbPath);
    this.publicCsvPath = path.resolve(
      process.cwd(),
      options.publicCsvPath ?? process.env.PUBLIC_CSV_PATH ?? 'public/sales.csv'
    );

    if (this.dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);
    initSalesSchema(this.db);
    this.ensureSeeded();
  }

  private ensureSeeded(): void {
    const row = this.db.prepare('SELECT COUNT(*) AS cnt FROM datasets').get() as
      | { cnt: number }
      | undefined;
    if ((row?.cnt ?? 0) === 0) {
      this.resetToDefault();
    }
  }

  public resetToDefault(): PersistedSalesPayload {
    if (fs.existsSync(this.publicCsvPath)) {
      try {
        const fileText = fs.readFileSync(this.publicCsvPath, 'utf8');
        const parsed = parseSalesCsv(fileText);
        return this.saveParsedDataset(
          parsed,
          `public/sales.csv (${parsed.quality.validRows.toLocaleString('id-ID')} baris)`,
          false
        );
      } catch {
        // Fall back to verified starter preview if public/sales.csv is invalid
      }
    }

    const starterParsed = parseSalesCsv(STARTER_SALES_CSV);
    return this.saveParsedDataset(
      starterParsed,
      'Preview Awal (32 baris terverifikasi)',
      true
    );
  }

  public importCsv(csvText: string, sourceLabel: string): PersistedSalesPayload {
    const cleanLabel = sourceLabel.trim().slice(0, 120) || 'sales.csv';
    const parsed = parseSalesCsv(csvText);
    const formattedLabel = `${cleanLabel} (${parsed.quality.validRows.toLocaleString('id-ID')} baris)`;
    return this.saveParsedDataset(parsed, formattedLabel, false);
  }

  private saveParsedDataset(
    parsed: ParsedSalesDataset,
    sourceLabel: string,
    isSampleFallback: boolean
  ): PersistedSalesPayload {
    const updatedAt = new Date().toISOString();
    const q = parsed.quality;

    const deleteRowsStmt = this.db.prepare('DELETE FROM sales_rows');
    const deleteMetaStmt = this.db.prepare('DELETE FROM datasets');
    const deleteCacheStmt = this.db.prepare('DELETE FROM forecast_cache');
    const insertMetaStmt = this.db.prepare(`
      INSERT INTO datasets (
        id, source_label, is_sample_fallback,
        total_raw_rows, valid_rows, skipped_invalid_rows,
        exact_duplicate_count, normalized_region_count,
        trimmed_whitespace_count, missing_salesman_count,
        return_line_count, return_invoice_count,
        total_return_net_idr, updated_at
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const insertRowStmt = this.db.prepare(`
      INSERT INTO sales_rows (
        row_number, date, invoice_no, region, raw_region, branch,
        outlet_id, outlet_name, raw_outlet_name, outlet_type, salesman,
        brand, sku, qty_carton, price_per_carton_idr,
        gross_sales_idr, discount_idr, net_sales_idr,
        month_key, is_return, is_exact_duplicate,
        has_missing_salesman, was_region_normalized, was_whitespace_trimmed
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      deleteRowsStmt.run();
      deleteMetaStmt.run();
      deleteCacheStmt.run();

      insertMetaStmt.run(
        sourceLabel,
        isSampleFallback ? 1 : 0,
        q.totalRawRows,
        q.validRows,
        q.skippedInvalidRows,
        q.exactDuplicateCount,
        q.normalizedRegionCount,
        q.trimmedWhitespaceCount,
        q.missingSalesmanCount,
        q.returnLineCount,
        q.returnInvoiceCount,
        q.totalReturnNetIdr,
        updatedAt
      );

      for (const r of parsed.rows) {
        insertRowStmt.run(
          r.rowNumber,
          r.date,
          r.invoice_no,
          r.region,
          r.rawRegion,
          r.branch,
          r.outlet_id,
          r.outlet_name,
          r.rawOutletName,
          r.outlet_type,
          r.salesman,
          r.brand,
          r.sku,
          r.qty_carton,
          r.price_per_carton_idr,
          r.gross_sales_idr,
          r.discount_idr,
          r.net_sales_idr,
          r.monthKey,
          r.isReturn ? 1 : 0,
          r.isExactDuplicate ? 1 : 0,
          r.hasMissingSalesman ? 1 : 0,
          r.wasRegionNormalized ? 1 : 0,
          r.wasWhitespaceTrimmed ? 1 : 0
        );
      }

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return {
      dataset: parsed,
      sourceLabel,
      isSampleFallback,
      updatedAt,
    };
  }

  public getDatasetMeta(): { updatedAt: string; sourceLabel: string } {
    const meta = this.db
      .prepare('SELECT updated_at, source_label FROM datasets WHERE id = 1')
      .get() as { updated_at: string; source_label: string } | undefined;

    if (!meta) {
      const seeded = this.resetToDefault();
      return { updatedAt: seeded.updatedAt, sourceLabel: seeded.sourceLabel };
    }
    return { updatedAt: meta.updated_at, sourceLabel: meta.source_label };
  }

  public getDailySeriesForForecast(filters: {
    region: string;
    province?: string;
    branch: string;
    outletType: string;
    brand: string;
    searchQuery: string;
    deduplicateExact: boolean;
    includeReturns: boolean;
  }): Array<{
    date: string;
    netSalesIdr: number;
    qtyCarton: number;
    invoiceCount: number;
  }> {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (filters.region !== 'all') {
      clauses.push('region = ?');
      params.push(filters.region);
    }
    if (filters.branch !== 'all') {
      clauses.push('branch = ?');
      params.push(filters.branch);
    }
    if (filters.outletType !== 'all') {
      clauses.push('outlet_type = ?');
      params.push(filters.outletType);
    }
    if (filters.brand !== 'all') {
      clauses.push('brand = ?');
      params.push(filters.brand);
    }
    if (filters.deduplicateExact) {
      clauses.push('is_exact_duplicate = 0');
    }
    if (!filters.includeReturns) {
      clauses.push('is_return = 0');
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(
        `SELECT date, invoice_no, region, branch, outlet_name, outlet_id, sku, salesman, brand, qty_carton, net_sales_idr
         FROM sales_rows ${whereSql}
         ORDER BY date ASC`
      )
      .all(...params) as Array<{
      date: string;
      invoice_no: string;
      region: string;
      branch: string;
      outlet_name: string;
      outlet_id: string;
      sku: string;
      salesman: string;
      brand: string;
      qty_carton: number;
      net_sales_idr: number;
    }>;

    const query = filters.searchQuery.trim().toLowerCase();
    const provinceFilter = filters.province ?? 'all';
    const byDate = new Map<
      string,
      { netSalesIdr: number; qtyCarton: number; invoices: Set<string> }
    >();

    for (const row of rows) {
      if (
        provinceFilter !== 'all' &&
        resolveProvinceName(row.branch, row.region) !== provinceFilter
      ) {
        continue;
      }
      if (query) {
        const haystack = `${row.outlet_name} ${row.outlet_id} ${row.sku} ${row.salesman} ${row.invoice_no} ${row.branch} ${row.brand}`.toLowerCase();
        if (!haystack.includes(query)) continue;
      }

      let bucket = byDate.get(row.date);
      if (!bucket) {
        bucket = { netSalesIdr: 0, qtyCarton: 0, invoices: new Set<string>() };
        byDate.set(row.date, bucket);
      }
      bucket.netSalesIdr += row.net_sales_idr;
      bucket.qtyCarton += row.qty_carton;
      if (row.invoice_no) {
        bucket.invoices.add(row.invoice_no);
      }
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, agg]) => ({
        date,
        netSalesIdr: agg.netSalesIdr,
        qtyCarton: agg.qtyCarton,
        invoiceCount: agg.invoices.size,
      }));
  }

  public getCachedForecast(cacheKey: string): string | null {
    const row = this.db
      .prepare('SELECT payload_json FROM forecast_cache WHERE cache_key = ?')
      .get(cacheKey) as { payload_json: string } | undefined;
    return row?.payload_json ?? null;
  }

  public saveCachedForecast(cacheKey: string, engineUsed: string, payloadJson: string): void {
    this.db
      .prepare(
        `INSERT INTO forecast_cache (cache_key, engine_used, payload_json, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
           engine_used = excluded.engine_used,
           payload_json = excluded.payload_json,
           created_at = excluded.created_at`
      )
      .run(cacheKey, engineUsed, payloadJson, new Date().toISOString());
  }

  public getPersistedDataset(): PersistedSalesPayload {
    const meta = this.db
      .prepare('SELECT * FROM datasets WHERE id = 1')
      .get() as DatasetRow | undefined;

    if (!meta) {
      return this.resetToDefault();
    }

    const dbRows = this.db
      .prepare('SELECT * FROM sales_rows ORDER BY row_number ASC, id ASC')
      .all() as unknown as DbSalesRow[];

    return {
      dataset: hydrateParsedDataset(meta, dbRows),
      sourceLabel: meta.source_label,
      isSampleFallback: meta.is_sample_fallback === 1,
      updatedAt: meta.updated_at,
    };
  }

  public close(): void {
    this.db.close();
  }
}
