import type { CleanedSalesRow } from '../types/sales';
import {
  resolveBranchCoordinate,
  resolveProvinceName,
  type IndonesiaProvinceName,
} from './provinceMapping';

export const INDONESIA_GEOJSON_URL =
  '/assets/aistudio/38_Provinsi_Indonesia_-_Provinsi_1147408d.json';

export const MAP_VIEWBOX = {
  width: 960,
  height: 390,
  padding: 16,
} as const;

export const INDONESIA_GEO_BOUNDS = {
  lonMin: 94.8,
  lonMax: 141.3,
  latMin: -11.2,
  latMax: 6.1,
} as const;

export type LonLatPair = [number, number];

export interface GeoJsonPolygonGeometry {
  type: 'Polygon';
  coordinates: LonLatPair[][];
}

export interface GeoJsonMultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: LonLatPair[][][];
}

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  properties: {
    KODE_PROV?: string;
    PROVINSI?: string;
    [key: string]: unknown;
  };
  geometry: GeoJsonPolygonGeometry | GeoJsonMultiPolygonGeometry;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface ProjectedProvinceFeature {
  province: string;
  kodeProv: string;
  pathData: string;
  centroid: [number, number];
}

export type MapMetricKey = 'netSalesIdr' | 'qtyCarton' | 'outletCount';

export interface ProvinceSalesMetric {
  province: IndonesiaProvinceName | string;
  netSalesIdr: number;
  grossSalesIdr: number;
  discountIdr: number;
  returnNetIdr: number;
  qtyCarton: number;
  invoiceCount: number;
  outletCount: number;
  branchCount: number;
  branches: string[];
  regions: string[];
  sharePct: number;
}

export interface BranchHubMetric {
  branch: string;
  province: string;
  region: string;
  lon: number;
  lat: number;
  x: number;
  y: number;
  netSalesIdr: number;
  qtyCarton: number;
  invoiceCount: number;
  outletCount: number;
  sharePct: number;
}

export interface IndonesiaMapAggregation {
  byProvince: Map<string, ProvinceSalesMetric>;
  rankedProvinces: ProvinceSalesMetric[];
  branchHubs: BranchHubMetric[];
  unmappedRowCount: number;
  totalNetSalesIdr: number;
}

function mercatorYDeg(latDeg: number): number {
  const clamped = Math.max(-85, Math.min(85, latDeg));
  const rad = (clamped * Math.PI) / 180;
  return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

const MERC_Y_MIN = mercatorYDeg(INDONESIA_GEO_BOUNDS.latMin);
const MERC_Y_MAX = mercatorYDeg(INDONESIA_GEO_BOUNDS.latMax);
const LON_SPAN = INDONESIA_GEO_BOUNDS.lonMax - INDONESIA_GEO_BOUNDS.lonMin;
const MERC_Y_SPAN = MERC_Y_MAX - MERC_Y_MIN;

function getProjectionTransform() {
  const innerWidth = MAP_VIEWBOX.width - MAP_VIEWBOX.padding * 2;
  const innerHeight = MAP_VIEWBOX.height - MAP_VIEWBOX.padding * 2;
  const scale = Math.min(innerWidth / LON_SPAN, innerHeight / MERC_Y_SPAN);
  const renderedWidth = LON_SPAN * scale;
  const renderedHeight = MERC_Y_SPAN * scale;
  const offsetX = MAP_VIEWBOX.padding + (innerWidth - renderedWidth) / 2;
  const offsetY = MAP_VIEWBOX.padding + (innerHeight - renderedHeight) / 2;

  return { scale, offsetX, offsetY };
}

const PROJ = getProjectionTransform();

export function projectLonLat(lon: number, lat: number): [number, number] {
  const x = PROJ.offsetX + (lon - INDONESIA_GEO_BOUNDS.lonMin) * PROJ.scale;
  const y = PROJ.offsetY + (MERC_Y_MAX - mercatorYDeg(lat)) * PROJ.scale;
  return [x, y];
}

function decimateProjectedRing(
  ring: LonLatPair[],
  minDeltaPx = 0.35
): Array<[number, number]> {
  if (ring.length === 0) return [];
  const pts: Array<[number, number]> = [];
  let lastX = Number.NaN;
  let lastY = Number.NaN;

  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const [x, y] = projectLonLat(lon, lat);

    if (
      pts.length === 0 ||
      i === ring.length - 1 ||
      Math.abs(x - lastX) + Math.abs(y - lastY) >= minDeltaPx
    ) {
      pts.push([x, y]);
      lastX = x;
      lastY = y;
    }
  }

  return pts.length >= 3 ? pts : [];
}

function computePolygonCentroidAndArea(pts: Array<[number, number]>): {
  cx: number;
  cy: number;
  area: number;
} {
  if (pts.length < 3) {
    return { cx: MAP_VIEWBOX.width / 2, cy: MAP_VIEWBOX.height / 2, area: 0 };
  }

  let twiceArea = 0;
  let cxSum = 0;
  let cySum = 0;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cxSum += (x0 + x1) * cross;
    cySum += (y0 + y1) * cross;

    if (x0 < minX) minX = x0;
    if (x0 > maxX) maxX = x0;
    if (y0 < minY) minY = y0;
    if (y0 > maxY) maxY = y0;
  }

  const area = Math.abs(twiceArea) / 2;
  if (area < 0.01 || Math.abs(twiceArea) < 0.01) {
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      area,
    };
  }

  return {
    cx: cxSum / (3 * twiceArea),
    cy: cySum / (3 * twiceArea),
    area,
  };
}

export function buildProjectedProvinces(
  geoJson: GeoJsonFeatureCollection
): ProjectedProvinceFeature[] {
  const results: ProjectedProvinceFeature[] = [];

  for (const feature of geoJson.features) {
    const province = String(feature.properties?.PROVINSI ?? '').trim();
    if (!province) continue;
    const kodeProv = String(feature.properties?.KODE_PROV ?? '').trim();
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;

    const pathSegments: string[] = [];
    let bestCentroid: [number, number] = [MAP_VIEWBOX.width / 2, MAP_VIEWBOX.height / 2];
    let largestArea = -1;

    for (const polygon of polygons) {
      for (let ringIdx = 0; ringIdx < polygon.length; ringIdx++) {
        const projected = decimateProjectedRing(polygon[ringIdx]);
        if (projected.length < 3) continue;

        const cmds = projected
          .map(([px, py], idx) => `${idx === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`)
          .join('');
        pathSegments.push(`${cmds}Z`);

        if (ringIdx === 0) {
          const stats = computePolygonCentroidAndArea(projected);
          if (stats.area > largestArea) {
            largestArea = stats.area;
            bestCentroid = [Number(stats.cx.toFixed(1)), Number(stats.cy.toFixed(1))];
          }
        }
      }
    }

    if (pathSegments.length > 0) {
      results.push({
        province,
        kodeProv,
        pathData: pathSegments.join(' '),
        centroid: bestCentroid,
      });
    }
  }

  return results;
}

export function aggregateSalesByProvinceAndBranch(
  rows: CleanedSalesRow[]
): IndonesiaMapAggregation {
  const provAcc = new Map<
    string,
    {
      netSalesIdr: number;
      grossSalesIdr: number;
      discountIdr: number;
      returnNetIdr: number;
      qtyCarton: number;
      invoices: Set<string>;
      outlets: Set<string>;
      branches: Set<string>;
      regions: Set<string>;
    }
  >();

  const branchAcc = new Map<
    string,
    {
      branch: string;
      province: string;
      regionCounts: Map<string, number>;
      netSalesIdr: number;
      qtyCarton: number;
      invoices: Set<string>;
      outlets: Set<string>;
    }
  >();

  let totalNetSalesIdr = 0;
  let unmappedRowCount = 0;

  for (const row of rows) {
    totalNetSalesIdr += row.net_sales_idr;
    const province = resolveProvinceName(row.branch, row.region);
    if (!province) {
      unmappedRowCount += 1;
      continue;
    }

    let provBucket = provAcc.get(province);
    if (!provBucket) {
      provBucket = {
        netSalesIdr: 0,
        grossSalesIdr: 0,
        discountIdr: 0,
        returnNetIdr: 0,
        qtyCarton: 0,
        invoices: new Set<string>(),
        outlets: new Set<string>(),
        branches: new Set<string>(),
        regions: new Set<string>(),
      };
      provAcc.set(province, provBucket);
    }

    provBucket.netSalesIdr += row.net_sales_idr;
    provBucket.qtyCarton += row.qty_carton;
    provBucket.outlets.add(row.outlet_id);
    if (row.branch) provBucket.branches.add(row.branch);
    if (row.region) provBucket.regions.add(row.region);
    if (row.isReturn) {
      provBucket.returnNetIdr += row.net_sales_idr;
    } else {
      provBucket.grossSalesIdr += row.gross_sales_idr;
      provBucket.discountIdr += row.discount_idr;
      provBucket.invoices.add(row.invoice_no);
    }

    if (row.branch) {
      let brBucket = branchAcc.get(row.branch);
      if (!brBucket) {
        brBucket = {
          branch: row.branch,
          province,
          regionCounts: new Map<string, number>(),
          netSalesIdr: 0,
          qtyCarton: 0,
          invoices: new Set<string>(),
          outlets: new Set<string>(),
        };
        branchAcc.set(row.branch, brBucket);
      }
      brBucket.netSalesIdr += row.net_sales_idr;
      brBucket.qtyCarton += row.qty_carton;
      brBucket.outlets.add(row.outlet_id);
      if (!row.isReturn) {
        brBucket.invoices.add(row.invoice_no);
      }
      if (row.region) {
        brBucket.regionCounts.set(
          row.region,
          (brBucket.regionCounts.get(row.region) ?? 0) + 1
        );
      }
    }
  }

  const denominator = totalNetSalesIdr > 0 ? totalNetSalesIdr : 1;

  const rankedProvinces: ProvinceSalesMetric[] = Array.from(provAcc.entries())
    .map(([province, v]) => ({
      province,
      netSalesIdr: v.netSalesIdr,
      grossSalesIdr: v.grossSalesIdr,
      discountIdr: v.discountIdr,
      returnNetIdr: v.returnNetIdr,
      qtyCarton: v.qtyCarton,
      invoiceCount: v.invoices.size,
      outletCount: v.outlets.size,
      branchCount: v.branches.size,
      branches: Array.from(v.branches).sort((a, b) => a.localeCompare(b, 'id')),
      regions: Array.from(v.regions).sort((a, b) => a.localeCompare(b, 'id')),
      sharePct: (v.netSalesIdr / denominator) * 100,
    }))
    .sort((a, b) => b.netSalesIdr - a.netSalesIdr);

  const byProvince = new Map<string, ProvinceSalesMetric>(
    rankedProvinces.map((item) => [item.province, item])
  );

  const branchHubs: BranchHubMetric[] = [];
  for (const br of branchAcc.values()) {
    const coord = resolveBranchCoordinate(br.branch);
    if (!coord) continue;
    const [x, y] = projectLonLat(coord.lon, coord.lat);
    let primaryRegion = '';
    let maxCount = 0;
    for (const [regName, count] of br.regionCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        primaryRegion = regName;
      }
    }

    branchHubs.push({
      branch: br.branch,
      province: br.province,
      region: primaryRegion,
      lon: coord.lon,
      lat: coord.lat,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      netSalesIdr: br.netSalesIdr,
      qtyCarton: br.qtyCarton,
      invoiceCount: br.invoices.size,
      outletCount: br.outlets.size,
      sharePct: (br.netSalesIdr / denominator) * 100,
    });
  }
  branchHubs.sort((a, b) => b.netSalesIdr - a.netSalesIdr);

  return {
    byProvince,
    rankedProvinces,
    branchHubs,
    unmappedRowCount,
    totalNetSalesIdr,
  };
}

export const CHOROPLETH_SCALE_COLORS = [
  '#BAE6FD', // sky-200
  '#7DD3FC', // sky-300
  '#38BDF8', // sky-400
  '#0284C7', // sky-600
  '#0369A1', // sky-700
] as const;

export const CHOROPLETH_EMPTY_FILL = '#F1F5F9'; // slate-100

export function getMetricValue(
  metric: ProvinceSalesMetric | undefined,
  key: MapMetricKey
): number {
  if (!metric) return 0;
  return metric[key];
}

export function getChoroplethFillColor(value: number, maxValue: number): string {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maxValue) || maxValue <= 0) {
    return CHOROPLETH_EMPTY_FILL;
  }

  const ratio = Math.min(1, Math.max(0, value / maxValue));
  if (ratio <= 0.2) return CHOROPLETH_SCALE_COLORS[0];
  if (ratio <= 0.4) return CHOROPLETH_SCALE_COLORS[1];
  if (ratio <= 0.6) return CHOROPLETH_SCALE_COLORS[2];
  if (ratio <= 0.8) return CHOROPLETH_SCALE_COLORS[3];
  return CHOROPLETH_SCALE_COLORS[4];
}
