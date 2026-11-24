import type { DatabaseSync } from 'node:sqlite';

export interface DatasetRow {
  source_label: string;
  is_sample_fallback: number;
  total_raw_rows: number;
  valid_rows: number;
  skipped_invalid_rows: number;
  exact_duplicate_count: number;
  normalized_region_count: number;
  trimmed_whitespace_count: number;
  missing_salesman_count: number;
  return_line_count: number;
  return_invoice_count: number;
  total_return_net_idr: number;
  updated_at: string;
}

export interface DbSalesRow {
  row_number: number;
  date: string;
  invoice_no: string;
  region: string;
  raw_region: string;
  branch: string;
  outlet_id: string;
  outlet_name: string;
  raw_outlet_name: string;
  outlet_type: string;
  salesman: string;
  brand: string;
  sku: string;
  qty_carton: number;
  price_per_carton_idr: number;
  gross_sales_idr: number;
  discount_idr: number;
  net_sales_idr: number;
  month_key: string;
  is_return: number;
  is_exact_duplicate: number;
  has_missing_salesman: number;
  was_region_normalized: number;
  was_whitespace_trimmed: number;
}

export function initSalesSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS datasets (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      source_label TEXT NOT NULL,
      is_sample_fallback INTEGER NOT NULL DEFAULT 0,
      total_raw_rows INTEGER NOT NULL,
      valid_rows INTEGER NOT NULL,
      skipped_invalid_rows INTEGER NOT NULL,
      exact_duplicate_count INTEGER NOT NULL,
      normalized_region_count INTEGER NOT NULL,
      trimmed_whitespace_count INTEGER NOT NULL,
      missing_salesman_count INTEGER NOT NULL,
      return_line_count INTEGER NOT NULL,
      return_invoice_count INTEGER NOT NULL,
      total_return_net_idr REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      row_number INTEGER NOT NULL,
      date TEXT NOT NULL,
      invoice_no TEXT NOT NULL,
      region TEXT NOT NULL,
      raw_region TEXT NOT NULL,
      branch TEXT NOT NULL,
      outlet_id TEXT NOT NULL,
      outlet_name TEXT NOT NULL,
      raw_outlet_name TEXT NOT NULL,
      outlet_type TEXT NOT NULL,
      salesman TEXT NOT NULL,
      brand TEXT NOT NULL,
      sku TEXT NOT NULL,
      qty_carton INTEGER NOT NULL,
      price_per_carton_idr REAL NOT NULL,
      gross_sales_idr REAL NOT NULL,
      discount_idr REAL NOT NULL,
      net_sales_idr REAL NOT NULL,
      month_key TEXT NOT NULL,
      is_return INTEGER NOT NULL,
      is_exact_duplicate INTEGER NOT NULL,
      has_missing_salesman INTEGER NOT NULL,
      was_region_normalized INTEGER NOT NULL,
      was_whitespace_trimmed INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sales_rows_month ON sales_rows(month_key);
    CREATE INDEX IF NOT EXISTS idx_sales_rows_region ON sales_rows(region);
    CREATE INDEX IF NOT EXISTS idx_sales_rows_brand ON sales_rows(brand);
    CREATE INDEX IF NOT EXISTS idx_sales_rows_outlet ON sales_rows(outlet_id);

    CREATE TABLE IF NOT EXISTS forecast_cache (
      cache_key TEXT PRIMARY KEY,
      engine_used TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}
