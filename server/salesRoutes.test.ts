import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createExpressApp } from './app.ts';
import { loadServerConfig } from './config.ts';
import { SalesSqliteStore } from './salesDb.ts';

test('Sales API routes serve health, persist CSV imports, reject invalid input, and reset cleanly', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-routes-test-'));
  const dbPath = path.join(tmpDir, 'sales.sqlite');
  const store = new SalesSqliteStore({
    dbPath,
    publicCsvPath: path.join(tmpDir, 'nonexistent.csv'),
  });
  const config = loadServerConfig({
    NODE_ENV: 'test',
    SQLITE_DB_PATH: dbPath,
  });

  const app = createExpressApp({ store, config });
  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { status: string; rowsCount: number };
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.rowsCount, 32);

    // 2. Reject empty CSV import
    const badRes = await fetch(`${baseUrl}/api/sales/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText: '   ', sourceLabel: 'empty.csv' }),
    });
    assert.equal(badRes.status, 400);

    // 3. Valid CSV import persists in SQLite
    const csvText = `date,invoice_no,region,branch,outlet_id,outlet_name,outlet_type,salesman,brand,sku,qty_carton,price_per_carton_idr,gross_sales_idr,discount_idr,net_sales_idr
2026-09-01,INV777,Jabar,Bandung,OUT777,Grosir Route Test,Grosir,Budi,Sukro,Sukro 100g,12,186000,2232000,0,2232000`;

    const importRes = await fetch(`${baseUrl}/api/sales/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText, sourceLabel: 'route-test.csv' }),
    });
    assert.equal(importRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/sales`);
    assert.equal(getRes.status, 200);
    const getJson = (await getRes.json()) as {
      isSampleFallback: boolean;
      dataset: { rows: Array<{ region: string; outlet_name: string }> };
    };
    assert.equal(getJson.isSampleFallback, false);
    assert.equal(getJson.dataset.rows.length, 1);
    assert.equal(getJson.dataset.rows[0].region, 'Jawa Barat');
    assert.equal(getJson.dataset.rows[0].outlet_name, 'Grosir Route Test');

    // 4. Reset restores starter rows
    const resetRes = await fetch(`${baseUrl}/api/sales/reset`, { method: 'POST' });
    assert.equal(resetRes.status, 200);
    const resetJson = (await resetRes.json()) as {
      isSampleFallback: boolean;
      dataset: { rows: unknown[] };
    };
    assert.equal(resetJson.isSampleFallback, true);
    assert.equal(resetJson.dataset.rows.length, 32);

    // 5. Reject invalid horizon on /api/forecast/python
    const badForecastRes = await fetch(`${baseUrl}/api/forecast/python`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horizonMonths: 9 }),
    });
    assert.equal(badForecastRes.status, 400);

    // 6. Execute real Python CLI forecast and hit SQLite cache on repeat request
    const forecastPayload = {
      horizonMonths: 2,
      preferredEngine: 'auto',
      filters: {
        region: 'all',
        branch: 'all',
        outletType: 'all',
        brand: 'all',
        searchQuery: '',
        deduplicateExact: true,
        includeReturns: true,
      },
    };
    const pyFirstRes = await fetch(`${baseUrl}/api/forecast/python`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forecastPayload),
    });
    assert.equal(pyFirstRes.status, 200);
    const pyFirstJson = (await pyFirstRes.json()) as {
      ok: boolean;
      fromCache: boolean;
      engineUsed: string;
      projectedMonths: Array<{ monthKey: string; projectedNetSalesIdr: number }>;
      dailyPoints: unknown[];
    };
    assert.equal(pyFirstJson.ok, true);
    assert.equal(pyFirstJson.fromCache, false);
    assert.equal(pyFirstJson.projectedMonths.length, 2);
    assert.ok(pyFirstJson.dailyPoints.length > 10);

    const pyCachedRes = await fetch(`${baseUrl}/api/forecast/python`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forecastPayload),
    });
    assert.equal(pyCachedRes.status, 200);
    const pyCachedJson = (await pyCachedRes.json()) as { fromCache: boolean };
    assert.equal(pyCachedJson.fromCache, true);

    const pyRefreshRes = await fetch(`${baseUrl}/api/forecast/python`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...forecastPayload, forceRefresh: true }),
    });
    assert.equal(pyRefreshRes.status, 200);
    const pyRefreshJson = (await pyRefreshRes.json()) as { fromCache: boolean };
    assert.equal(pyRefreshJson.fromCache, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
