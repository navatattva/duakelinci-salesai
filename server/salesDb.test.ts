import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SalesSqliteStore } from './salesDb.ts';

function createTempDbPath(): { dir: string; dbPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-sqlite-test-'));
  return { dir, dbPath: path.join(dir, 'sales.sqlite') };
}

test('SalesSqliteStore seeds initial dataset and persists imported CSV across restarts', () => {
  const { dir, dbPath } = createTempDbPath();

  try {
    const store1 = new SalesSqliteStore({
      dbPath,
      publicCsvPath: path.join(dir, 'nonexistent.csv'),
    });
    const initial = store1.getPersistedDataset();
    assert.equal(initial.isSampleFallback, true);
    assert.equal(initial.dataset.rows.length, 32);

    const customCsv = `date,invoice_no,region,branch,outlet_id,outlet_name,outlet_type,salesman,brand,sku,qty_carton,price_per_carton_idr,gross_sales_idr,discount_idr,net_sales_idr
2026-09-01,INV901,Jabar,Bandung,OUT901,Grosir Uji,Grosir,Andi,Sukro,Sukro 100g,10,186000,1860000,0,1860000
2026-10-05,INV902,Jabodetabek,Jakarta,OUT902,Toko Uji,Toko Kelontong,,Pilus,Pilus 95g,5,174000,870000,0,870000`;

    const imported = store1.importCsv(customCsv, 'custom.csv');
    assert.equal(imported.isSampleFallback, false);
    assert.equal(imported.dataset.rows.length, 2);
    store1.close();

    // Reopen fresh instance pointing to same SQLite file to verify persistence
    const store2 = new SalesSqliteStore({
      dbPath,
      publicCsvPath: path.join(dir, 'nonexistent.csv'),
    });
    const persisted = store2.getPersistedDataset();
    assert.equal(persisted.isSampleFallback, false);
    assert.equal(persisted.dataset.rows.length, 2);
    assert.equal(persisted.dataset.rows[0].region, 'Jawa Barat');
    assert.equal(persisted.dataset.quality.missingSalesmanCount, 1);

    // Invalid CSV import must fail without wiping persisted data
    assert.throws(() => store2.importCsv('bad,header\n1,2', 'broken.csv'));
    const afterFailedImport = store2.getPersistedDataset();
    assert.equal(afterFailedImport.dataset.rows.length, 2);

    // Reset restores starter fallback
    const afterReset = store2.resetToDefault();
    assert.equal(afterReset.isSampleFallback, true);
    assert.equal(afterReset.dataset.rows.length, 32);
    store2.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SalesSqliteStore imports and persists full 1,891-row duakelinci-fmt CSV attachment', () => {
  const attachmentPath = path.resolve(
    process.cwd(),
    'public/assets/aistudio/duakelinci-fmt_9dc6b4cb.csv'
  );
  if (!fs.existsSync(attachmentPath)) return;

  const { dir, dbPath } = createTempDbPath();
  try {
    const csvText = fs.readFileSync(attachmentPath, 'utf8');
    const store1 = new SalesSqliteStore({
      dbPath,
      publicCsvPath: path.join(dir, 'nonexistent.csv'),
    });
    const imported = store1.importCsv(csvText, 'duakelinci-fmt.csv');
    assert.equal(imported.dataset.rows.length, 1891);
    assert.equal(imported.dataset.quality.skippedInvalidRows, 0);
    store1.close();

    const store2 = new SalesSqliteStore({
      dbPath,
      publicCsvPath: path.join(dir, 'nonexistent.csv'),
    });
    const persisted = store2.getPersistedDataset();
    assert.equal(persisted.isSampleFallback, false);
    assert.equal(persisted.dataset.rows.length, 1891);
    assert.deepEqual(persisted.dataset.availableMonths, ['2026-09', '2026-10']);
    store2.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SalesSqliteStore aggregates filtered daily series and invalidates forecast_cache on import', () => {
  const { dir, dbPath } = createTempDbPath();
  try {
    const store = new SalesSqliteStore({
      dbPath,
      publicCsvPath: path.join(dir, 'nonexistent.csv'),
    });

    const dailyAll = store.getDailySeriesForForecast({
      region: 'all',
      branch: 'all',
      outletType: 'all',
      brand: 'all',
      searchQuery: '',
      deduplicateExact: true,
      includeReturns: true,
    });
    assert.ok(dailyAll.length >= 1);

    store.saveCachedForecast('test-key', 'python-seasonal-cli', JSON.stringify({ ok: true }));
    assert.equal(store.getCachedForecast('test-key'), '{"ok":true}');

    const customCsv = `date,invoice_no,region,branch,outlet_id,outlet_name,outlet_type,salesman,brand,sku,qty_carton,price_per_carton_idr,gross_sales_idr,discount_idr,net_sales_idr
2026-09-01,INV901,Jabar,Bandung,OUT901,Grosir Uji,Grosir,Andi,Sukro,Sukro 100g,10,186000,1860000,0,1860000`;
    store.importCsv(customCsv, 'cache-reset.csv');

    assert.equal(store.getCachedForecast('test-key'), null);
    store.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

