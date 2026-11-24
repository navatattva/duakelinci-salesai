import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSalesCsv, normalizeRegionName } from './csvParser';
import {
  buildDateRangePresets,
  formatDateRangeLabel,
  shiftIsoDate,
} from './dateRange';
import { filterSelectOptions } from './filterOptions';
import {
  computeDashboardSummary,
  computeDatasetDateBounds,
  computeFacetOptions,
  filterSalesRows,
  formatIDR,
} from './salesAnalytics';
import { generateTelegramParagraph, generateTelegramSummary } from './telegramSummary';
import { STARTER_SALES_CSV } from '../data/starterCsv';

const DIRTY_FIXTURE_CSV = `date,invoice_no,region,branch,outlet_id,outlet_name,outlet_type,salesman,brand,sku,qty_carton,price_per_carton_idr,gross_sales_idr,discount_idr,net_sales_idr
2026-09-01,INV001,Jabar,Bandung,OUT101,Grosir Berkah ,Grosir,Andi,Sukro,Sukro Pedas 100g,10,186000,1860000,0,1860000
2026-09-02,INV002,JAWA BARAT,Bandung,OUT101,Grosir Berkah,Grosir,,Pilus,Pilus Rumput Laut,5,174000,870000,0,870000
2026-09-02,INV002,JAWA BARAT,Bandung,OUT101,Grosir Berkah,Grosir,,Pilus,Pilus Rumput Laut,5,174000,870000,0,870000
2026-09-03,INV003,JABODETABEK,Jakarta Barat,OUT102,Warung Maju,Warung,Budi,Kacang Dua Kelinci,Kacang Kulit 70g,4,198000,792000,0,792000
2026-09-05,INV004,Jawa Tengah,Semarang,OUT103,Toko Sinar,Toko Kelontong,Citra,Tos Tos,Tos Tos BBQ,3,264000,792000,42000,750000
2026-10-01,INV005,Jawa Timur,Malang,OUT104,Warung Mini,Warung,Dewi,Deka,Deka Cokelat,2,216000,432000,0,432000
2026-10-02,INV006,Sumatera,Medan,OUT105,Toko Harapan,Toko Kelontong,Eko,Roni,Roni Mie Goreng,2,120000,240000,0,240000
2026-10-04,INV007,Kalimantan,Balikpapan,OUT106,Warung Jaya,Warung,Fajar,Usagi,Usagi Puffs,3,144000,432000,0,432000
2026-10-10,RTR900001,Kalimantan,Balikpapan,OUT106,Warung Jaya,Warung,Fajar,Usagi,Usagi Puffs,-2,144000,-288000,0,-288000`;

test('normalizeRegionName merges aliases and casing consistently', () => {
  assert.equal(normalizeRegionName('Jabar'), 'Jawa Barat');
  assert.equal(normalizeRegionName('JAWA BARAT'), 'Jawa Barat');
  assert.equal(normalizeRegionName('  jabodetabek '), 'Jabodetabek');
  assert.equal(normalizeRegionName('sumatra'), 'Sumatera');
});

test('parseSalesCsv detects duplicates, missing salesman, whitespace, and returns', () => {
  const dataset = parseSalesCsv(DIRTY_FIXTURE_CSV);

  assert.equal(dataset.quality.totalRawRows, 9);
  assert.equal(dataset.quality.validRows, 9);
  assert.equal(dataset.quality.exactDuplicateCount, 1);
  assert.equal(dataset.quality.normalizedRegionCount, 4);
  assert.equal(dataset.quality.trimmedWhitespaceCount, 1);
  assert.equal(dataset.quality.missingSalesmanCount, 2);
  assert.equal(dataset.quality.returnLineCount, 1);
  assert.equal(dataset.quality.returnInvoiceCount, 1);
  assert.equal(dataset.quality.totalReturnNetIdr, -288000);
  assert.deepEqual(dataset.availableMonths, ['2026-09', '2026-10']);
});

test('analytics deduplicates exact duplicates, applies returns, and ranks bottom 5 outlets', () => {
  const dataset = parseSalesCsv(DIRTY_FIXTURE_CSV);

  const dedupedRows = filterSalesRows(dataset.rows, {
    month: 'all',
    region: 'all',
    brand: 'all',
    searchQuery: '',
    deduplicateExact: true,
    includeReturns: true,
  });

  // 9 raw rows - 1 exact duplicate = 8 rows
  assert.equal(dedupedRows.length, 8);

  const summary = computeDashboardSummary(dedupedRows);
  // Net sales = 1,860,000 + 870,000 + 792,000 + 750,000 + 432,000 + 240,000 + 432,000 - 288,000 = 5,088,000
  assert.equal(summary.totalNetSalesIdr, 5088000);
  assert.equal(summary.outletCount, 6);
  assert.equal(summary.regions[0].region, 'Jawa Barat');
  assert.equal(summary.regions[0].netSalesIdr, 2730000);

  // Weakest outlet should be OUT106 (432,000 - 288,000 = 144,000) due to return impact
  assert.equal(summary.weakestOutlets.length, 5);
  assert.equal(summary.weakestOutlets[0].outletId, 'OUT106');
  assert.equal(summary.weakestOutlets[0].netSalesIdr, 144000);
  assert.equal(summary.weakestOutlets[0].weaknessReason, 'Terdampak retur penjualan');
  assert.equal(summary.weakestOutlets[1].outletId, 'OUT105');

  // If returns are excluded, OUT106 goes back to 432,000 and OUT105 becomes weakest
  const noReturnRows = filterSalesRows(dataset.rows, {
    month: 'all',
    region: 'all',
    brand: 'all',
    searchQuery: '',
    deduplicateExact: true,
    includeReturns: false,
  });
  const noReturnSummary = computeDashboardSummary(noReturnRows);
  assert.equal(noReturnSummary.totalNetSalesIdr, 5376000);
  assert.equal(noReturnSummary.weakestOutlets[0].outletId, 'OUT105');
});

test('generateTelegramParagraph outputs a single cohesive Indonesian paragraph', () => {
  const dataset = parseSalesCsv(DIRTY_FIXTURE_CSV);
  const filters = {
    month: 'all',
    region: 'all',
    brand: 'all',
    searchQuery: '',
    deduplicateExact: true,
    includeReturns: true,
  };
  const rows = filterSalesRows(dataset.rows, filters);
  const summary = computeDashboardSummary(rows);
  const paragraph = generateTelegramParagraph(summary, filters, dataset.quality);

  assert.equal(paragraph.includes('\n'), false);
  assert.ok(paragraph.includes('September–Oktober 2026'));
  assert.ok(paragraph.includes(formatIDR(summary.totalNetSalesIdr)));
  assert.ok(paragraph.includes('Jawa Barat'));
  assert.ok(paragraph.includes('5 outlet terlemah'));
  assert.ok(paragraph.includes('Warung Jaya'));
  assert.ok(paragraph.includes('1 baris duplikat identik telah dibersihkan'));
});

test('STARTER_SALES_CSV parses cleanly and normalizes Jabar into Jawa Barat', () => {
  const dataset = parseSalesCsv(STARTER_SALES_CSV);
  assert.equal(dataset.quality.totalRawRows, 32);
  assert.equal(dataset.quality.validRows, 32);
  assert.equal(dataset.quality.normalizedRegionCount, 1);

  const summary = computeDashboardSummary(dataset.rows);
  assert.equal(summary.weakestOutlets.length, 5);
  assert.equal(summary.regions.some((r) => r.region === 'Jabar'), false);
  assert.equal(summary.regions.some((r) => r.region === 'Jawa Barat'), true);
});

test('computeDashboardSummary produces chronological monthlyTrend with MoM growth', () => {
  const dataset = parseSalesCsv(DIRTY_FIXTURE_CSV);
  const rows = filterSalesRows(dataset.rows, {
    month: 'all',
    region: 'all',
    brand: 'all',
    searchQuery: '',
    deduplicateExact: true,
    includeReturns: true,
  });
  const summary = computeDashboardSummary(rows);

  assert.equal(summary.monthlyTrend.length, 2);
  const [sep, oct] = summary.monthlyTrend;

  // Sep 2026: 1,860,000 + 870,000 + 792,000 + 750,000 = 4,272,000
  assert.equal(sep.monthKey, '2026-09');
  assert.equal(sep.monthLabel, 'Sep 2026');
  assert.equal(sep.netSalesIdr, 4272000);
  assert.equal(sep.momGrowthPct, null);

  // Oct 2026: 432,000 + 240,000 + 432,000 - 288,000 = 816,000
  assert.equal(oct.monthKey, '2026-10');
  assert.equal(oct.monthLabel, 'Okt 2026');
  assert.equal(oct.netSalesIdr, 816000);
  assert.ok(oct.momGrowthPct !== null);
  // (816000 - 4272000) / 4272000 * 100 = -80.898876...
  assert.ok(Math.abs(oct.momGrowthPct - (-80.898876)) < 0.01);
});

test('parseSalesCsv handles UTF-8 BOM, NUL bytes at CRLF endings, and semicolon delimiters', () => {
  const nulCsv = `\uFEFF${DIRTY_FIXTURE_CSV.split('\n')
    .map((line) => `${line}\u0000`)
    .join('\r\n')}`;
  const nulDataset = parseSalesCsv(nulCsv);
  assert.equal(nulDataset.quality.totalRawRows, 9);
  assert.equal(nulDataset.quality.validRows, 9);
  assert.equal(nulDataset.quality.skippedInvalidRows, 0);
  assert.equal(nulDataset.rows[0].net_sales_idr, 1860000);

  const semicolonCsv = DIRTY_FIXTURE_CSV.replaceAll(',', ';');
  const semicolonDataset = parseSalesCsv(semicolonCsv);
  assert.equal(semicolonDataset.quality.validRows, 9);
  assert.equal(semicolonDataset.rows[0].net_sales_idr, 1860000);
});

test('parseSalesCsv parses full 1,891-row duakelinci-fmt attachment with zero skipped invalid rows', () => {
  const attachmentPath = path.resolve(
    process.cwd(),
    'public/assets/aistudio/duakelinci-fmt_9dc6b4cb.csv'
  );
  if (!fs.existsSync(attachmentPath)) return;

  const rawText = fs.readFileSync(attachmentPath, 'utf8');
  const dataset = parseSalesCsv(rawText);

  assert.equal(dataset.quality.totalRawRows, 1891);
  assert.equal(dataset.quality.validRows, 1891);
  assert.equal(dataset.quality.skippedInvalidRows, 0);
  assert.deepEqual(dataset.availableMonths, ['2026-09', '2026-10']);
});

test('generateTelegramSummary builds structured list items, short descriptions, and Telegram message', () => {
  const dataset = parseSalesCsv(DIRTY_FIXTURE_CSV);
  const filters = {
    month: 'all',
    region: 'all',
    brand: 'all',
    searchQuery: '',
    deduplicateExact: true,
    includeReturns: true,
  };
  const rows = filterSalesRows(dataset.rows, filters);
  const summary = computeDashboardSummary(rows);
  const structured = generateTelegramSummary(summary, filters, dataset.quality, {
    compactNumbers: false,
  });

  assert.ok(structured.title.includes('September–Oktober 2026'));
  assert.ok(structured.shortDesc.includes(formatIDR(summary.totalNetSalesIdr)));
  assert.ok(structured.shortDesc.includes('MoM'));
  assert.ok(structured.highlights.length >= 4);
  assert.equal(structured.weakestOutlets.length, 5);
  assert.equal(structured.weakestOutlets[0].rank, 1);
  assert.equal(structured.weakestOutlets[0].outletId, 'OUT106');
  assert.ok(structured.weakestOutlets[0].shortDesc.includes('Terdampak retur penjualan'));
  assert.ok(structured.formattedMessage.includes('Sorotan Performa:'));
  assert.ok(structured.formattedMessage.includes('1. Warung Jaya'));
  assert.equal(structured.paragraph.includes('\n'), false);
});

test('filterSalesRows filters dynamically by dateFrom/dateTo, branch, and outletType', () => {
  const dataset = parseSalesCsv(DIRTY_FIXTURE_CSV);
  const bounds = computeDatasetDateBounds(dataset.rows);
  assert.deepEqual(bounds, { min: '2026-09-01', max: '2026-10-10' });

  const presets = buildDateRangePresets(bounds.min, bounds.max, dataset.availableMonths);
  assert.ok(presets.some((p) => p.id === 'last-7d' && p.dateFrom === '2026-10-04' && p.dateTo === '2026-10-10'));
  assert.equal(formatDateRangeLabel('2026-09-01', '2026-09-15'), '1–15 Sep 2026');
  assert.equal(shiftIsoDate('2026-10-02', -2), '2026-09-30');

  // Date range across Sep 2–Sep 5 only (2026-09-02 has 1 duplicate so 2 active rows + Sep 3 + Sep 5 = 3 rows)
  const ranged = filterSalesRows(dataset.rows, {
    month: 'all',
    dateFrom: '2026-09-02',
    dateTo: '2026-09-05',
    region: 'all',
    branch: 'all',
    outletType: 'all',
    brand: 'all',
    searchQuery: '',
    deduplicateExact: true,
    includeReturns: true,
  });
  assert.equal(ranged.length, 3);

  // Cascading facet options narrow branches by active region
  const jabarFacets = computeFacetOptions(dataset.rows, {
    month: 'all',
    region: 'Jawa Barat',
    brand: 'all',
    searchQuery: '',
    deduplicateExact: true,
    includeReturns: true,
  });
  assert.deepEqual(jabarFacets.branches, ['Bandung']);

  // Branch & outlet type filtering
  const warungFiltered = filterSalesRows(dataset.rows, {
    month: 'all',
    region: 'all',
    branch: 'Malang',
    outletType: 'Warung',
    brand: 'all',
    searchQuery: '',
    deduplicateExact: true,
    includeReturns: true,
  });
  assert.equal(warungFiltered.length, 1);
  assert.equal(warungFiltered[0].outlet_id, 'OUT104');
});

test('filterSelectOptions filters dropdown option labels case-insensitively', () => {
  const branches = ['Bandung', 'Bekasi', 'Jakarta Barat', 'Jakarta Selatan', 'Tangerang'];
  assert.deepEqual(filterSelectOptions(branches, ''), branches);
  assert.deepEqual(filterSelectOptions(branches, '  jakarta '), [
    'Jakarta Barat',
    'Jakarta Selatan',
  ]);
  assert.deepEqual(filterSelectOptions(branches, 'surabaya'), []);
});
