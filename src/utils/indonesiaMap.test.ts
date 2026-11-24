import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseSalesCsv } from './csvParser';
import {
  MAP_VIEWBOX,
  aggregateSalesByProvinceAndBranch,
  buildProjectedProvinces,
  getChoroplethFillColor,
  projectLonLat,
  type GeoJsonFeatureCollection,
} from './indonesiaMap';
import { resolveProvinceName } from './provinceMapping';

test('resolveProvinceName maps Jabodetabek and regional branches to official 38 GeoJSON provinces', () => {
  assert.equal(resolveProvinceName('Jakarta Barat', 'Jabodetabek'), 'DKI Jakarta');
  assert.equal(resolveProvinceName('Bekasi', 'Jabodetabek'), 'Jawa Barat');
  assert.equal(resolveProvinceName('Tangerang', 'Jabodetabek'), 'Banten');
  assert.equal(resolveProvinceName('Bandung', 'Jawa Barat'), 'Jawa Barat');
  assert.equal(resolveProvinceName('Cirebon', 'Jawa Barat'), 'Jawa Barat');
  assert.equal(resolveProvinceName('Semarang', 'Jawa Tengah'), 'Jawa Tengah');
  assert.equal(resolveProvinceName('Solo', 'Jawa Tengah'), 'Jawa Tengah');
  assert.equal(resolveProvinceName('Surabaya', 'Jawa Timur'), 'Jawa Timur');
  assert.equal(resolveProvinceName('Malang', 'Jawa Timur'), 'Jawa Timur');
  assert.equal(resolveProvinceName('Medan', 'Sumatera'), 'Sumatera Utara');
  assert.equal(resolveProvinceName('Palembang', 'Sumatera'), 'Sumatera Selatan');
  assert.equal(resolveProvinceName('Balikpapan', 'Kalimantan'), 'Kalimantan Timur');
  assert.equal(resolveProvinceName('Banjarmasin', 'Kalimantan'), 'Kalimantan Selatan');
});

test('projectLonLat orders west-east and north-south coordinates inside viewBox', () => {
  const [acehX, acehY] = projectLonLat(95.32, 5.55);
  const [jayapuraX, jayapuraY] = projectLonLat(140.72, -2.54);
  const [kupangX, kupangY] = projectLonLat(123.61, -10.17);

  assert.ok(acehX < kupangX && kupangX < jayapuraX);
  assert.ok(acehY < jayapuraY && jayapuraY < kupangY);
  assert.ok(acehX >= 0 && jayapuraX <= MAP_VIEWBOX.width);
  assert.ok(acehY >= 0 && kupangY <= MAP_VIEWBOX.height);
});

test('buildProjectedProvinces parses all 38 features from attached Indonesia GeoJSON cleanly', () => {
  const geoPath = path.resolve(
    process.cwd(),
    'public/assets/aistudio/38_Provinsi_Indonesia_-_Provinsi_1147408d.json'
  );
  const raw = JSON.parse(fs.readFileSync(geoPath, 'utf8')) as GeoJsonFeatureCollection;
  const projected = buildProjectedProvinces(raw);

  assert.equal(projected.length, 38);
  const names = new Set(projected.map((p) => p.province));
  assert.equal(names.size, 38);
  assert.ok(names.has('DKI Jakarta'));
  assert.ok(names.has('Jawa Barat'));
  assert.ok(names.has('Papua Barat Daya'));

  for (const item of projected) {
    assert.ok(item.pathData.startsWith('M'), `${item.province} path should start with M`);
    assert.ok(item.pathData.endsWith('Z'), `${item.province} path should close with Z`);
    const [cx, cy] = item.centroid;
    assert.ok(Number.isFinite(cx) && cx > 0 && cx < MAP_VIEWBOX.width);
    assert.ok(Number.isFinite(cy) && cy > 0 && cy < MAP_VIEWBOX.height);
  }
});

test('aggregateSalesByProvinceAndBranch maps all 1891 duakelinci rows with 0 unmapped rows', () => {
  const csvPath = path.resolve(
    process.cwd(),
    'public/assets/aistudio/duakelinci-fmt_9dc6b4cb.csv'
  );
  const parsed = parseSalesCsv(fs.readFileSync(csvPath, 'utf8'));
  const agg = aggregateSalesByProvinceAndBranch(parsed.rows);

  assert.equal(agg.unmappedRowCount, 0);
  assert.equal(agg.rankedProvinces.length, 9);
  assert.equal(agg.branchHubs.length, 13);

  const jabar = agg.byProvince.get('Jawa Barat');
  assert.ok(jabar);
  assert.deepEqual(jabar.branches, ['Bandung', 'Bekasi', 'Cirebon']);
  assert.ok(jabar.netSalesIdr > 0);
});

test('getChoroplethFillColor distinguishes empty/zero values and max values', () => {
  assert.equal(getChoroplethFillColor(0, 1_000_000), '#F1F5F9');
  assert.equal(getChoroplethFillColor(-500, 1_000_000), '#F1F5F9');
  assert.equal(getChoroplethFillColor(100_000, 1_000_000), '#BAE6FD');
  assert.equal(getChoroplethFillColor(950_000, 1_000_000), '#0369A1');
});
