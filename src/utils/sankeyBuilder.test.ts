import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSalesCsv } from './csvParser';
import { buildSalesSankeyData } from './sankeyBuilder';
import { STARTER_SALES_CSV } from '../data/starterCsv';

test('buildSalesSankeyData handles empty rows cleanly', () => {
  const res = buildSalesSankeyData([], 'region-brand');
  assert.equal(res.nodes.length, 0);
  assert.equal(res.links.length, 0);
  assert.equal(res.totalFlowIdr, 0);
});

test('buildSalesSankeyData builds 2-stage Region -> Brand graph from starter CSV', () => {
  const dataset = parseSalesCsv(STARTER_SALES_CSV);
  const res = buildSalesSankeyData(dataset.rows, 'region-brand');

  assert.ok(res.nodes.length > 0);
  assert.ok(res.links.length > 0);
  assert.equal(res.omittedNegativeCount, 0);
  assert.equal(res.totalFlowIdr, 33588700);

  // Verify Jabar was normalized to Jawa Barat so only canonical regions appear
  assert.equal(res.nodes.some((n) => n.name === 'Jabar'), false);
  assert.equal(res.nodes.some((n) => n.name === 'Jawa Barat' && n.category === 'region'), true);
  assert.equal(res.nodes.some((n) => n.name === 'Kacang Dua Kelinci' && n.category === 'brand'), true);
});

test('buildSalesSankeyData builds 3-stage Region -> Channel -> Brand and omits negative net edges', () => {
  const csv = `date,invoice_no,region,branch,outlet_id,outlet_name,outlet_type,salesman,brand,sku,qty_carton,price_per_carton_idr,gross_sales_idr,discount_idr,net_sales_idr
2026-09-01,INV1,Jabodetabek,Jakarta,OUT1,Grosir A,Grosir,Andi,Sukro,Sukro 100g,10,186000,1860000,0,1860000
2026-09-02,INV2,Jawa Barat,Bandung,OUT2,Warung B,Warung,Budi,Pilus,Pilus 95g,2,174000,348000,0,348000
2026-09-05,RTR1,Jawa Barat,Bandung,OUT2,Warung B,Warung,Budi,Pilus,Pilus 95g,-3,174000,-522000,0,-522000`;

  const dataset = parseSalesCsv(csv);
  const res = buildSalesSankeyData(dataset.rows, 'region-channel-brand');

  // Jawa Barat -> Warung and Warung -> Pilus have net -174000 so both are omitted (2 negative edges)
  assert.equal(res.omittedNegativeCount, 2);
  assert.equal(res.nodes.length, 3); // Jabodetabek, Grosir, Sukro
  assert.equal(res.links.length, 2); // Jabodetabek -> Grosir, Grosir -> Sukro
  assert.equal(res.totalFlowIdr, 1860000);
});
