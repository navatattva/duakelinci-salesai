import { LocateFixed, MapPin, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { CleanedSalesRow } from '../types/sales';
import {
  CHOROPLETH_EMPTY_FILL,
  CHOROPLETH_SCALE_COLORS,
  INDONESIA_GEOJSON_URL,
  MAP_VIEWBOX,
  aggregateSalesByProvinceAndBranch,
  buildProjectedProvinces,
  getChoroplethFillColor,
  getMetricValue,
  projectLonLat,
  type BranchHubMetric,
  type GeoJsonFeatureCollection,
  type MapMetricKey,
  type ProjectedProvinceFeature,
  type ProvinceSalesMetric,
} from '../utils/indonesiaMap';
import { formatProvinceShortName } from '../utils/provinceMapping';
import { formatCompactIDR, formatIDR } from '../utils/salesAnalytics';

interface IndonesiaMapChartProps {
  rows: CleanedSalesRow[];
  selectedProvince: string;
  onSelectProvince: (province: string) => void;
}

interface HoverTarget {
  kind: 'province' | 'branch';
  province: string;
  branch?: BranchHubMetric;
  clientX: number;
  clientY: number;
}

const METRIC_OPTIONS: Array<{ id: MapMetricKey; label: string }> = [
  { id: 'netSalesIdr', label: 'Net Sales' },
  { id: 'qtyCarton', label: 'Karton' },
  { id: 'outletCount', label: 'Outlet' },
];

let cachedProjectedProvinces: ProjectedProvinceFeature[] | null = null;
let inflightGeoPromise: Promise<ProjectedProvinceFeature[]> | null = null;

async function loadProjectedProvinces(): Promise<ProjectedProvinceFeature[]> {
  if (cachedProjectedProvinces) {
    return cachedProjectedProvinces;
  }
  if (!inflightGeoPromise) {
    inflightGeoPromise = fetch(INDONESIA_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Gagal memuat GeoJSON Indonesia (${res.status})`);
        }
        return res.json() as Promise<GeoJsonFeatureCollection>;
      })
      .then((geoJson) => {
        const projected = buildProjectedProvinces(geoJson);
        cachedProjectedProvinces = projected;
        return projected;
      })
      .catch((err) => {
        inflightGeoPromise = null;
        throw err;
      });
  }
  return inflightGeoPromise;
}

function formatMetricValue(value: number, metric: MapMetricKey, compact = false): string {
  if (metric === 'netSalesIdr') {
    return compact ? formatCompactIDR(value) : formatIDR(value);
  }
  if (metric === 'qtyCarton') {
    return `${value.toLocaleString('id-ID')} ktn`;
  }
  return `${value.toLocaleString('id-ID')} outlet`;
}

const JAVA_FOCUS_CENTER = projectLonLat(109.8, -7.15);

type LabelDirection = 'top' | 'bottom' | 'left' | 'right' | 'top-right';

const BRANCH_LABEL_DIRECTIONS: Record<string, LabelDirection> = {
  tangerang: 'left',
  'tangerang selatan': 'bottom',
  'jakarta barat': 'top',
  'jakarta pusat': 'top',
  'jakarta selatan': 'bottom',
  bekasi: 'top-right',
  cikarang: 'right',
  depok: 'bottom',
  bogor: 'left',
  bandung: 'bottom',
  cirebon: 'right',
};

function getBranchLabelProps(branch: string, radius: number, zoom: number) {
  const dir = BRANCH_LABEL_DIRECTIONS[branch.trim().toLowerCase()] ?? 'right';
  const pad = 2.5 / zoom;
  switch (dir) {
    case 'left':
      return { dx: -(radius + pad), dy: 1 / zoom, textAnchor: 'end' as const };
    case 'top':
      return { dx: 0, dy: -(radius + pad + 1 / zoom), textAnchor: 'middle' as const };
    case 'bottom':
      return { dx: 0, dy: radius + pad + 6.5 / zoom, textAnchor: 'middle' as const };
    case 'top-right':
      return { dx: radius + pad, dy: -(radius + 1 / zoom), textAnchor: 'start' as const };
    case 'right':
    default:
      return { dx: radius + pad, dy: 1.5 / zoom, textAnchor: 'start' as const };
  }
}

export function IndonesiaMapChart({
  rows,
  selectedProvince,
  onSelectProvince,
}: IndonesiaMapChartProps) {
  const [provinces, setProvinces] = useState<ProjectedProvinceFeature[]>(
    () => cachedProjectedProvinces ?? []
  );
  const [isLoadingGeo, setIsLoadingGeo] = useState<boolean>(() => !cachedProjectedProvinces);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState<number>(0);

  const [metricKey, setMetricKey] = useState<MapMetricKey>('netSalesIdr');
  const [showBranchPins, setShowBranchPins] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);

  const mapBoxRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    if (cachedProjectedProvinces) {
      setProvinces(cachedProjectedProvinces);
      setIsLoadingGeo(false);
      setGeoError(null);
      return;
    }

    setIsLoadingGeo(true);
    setGeoError(null);
    loadProjectedProvinces()
      .then((loaded) => {
        if (!cancelled) {
          setProvinces(loaded);
          setIsLoadingGeo(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setGeoError(
            err instanceof Error ? err.message : 'Gagal memuat peta GeoJSON Indonesia.'
          );
          setIsLoadingGeo(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  const aggregation = useMemo(() => aggregateSalesByProvinceAndBranch(rows), [rows]);

  const maxMetricValue = useMemo(() => {
    let maxVal = 0;
    for (const item of aggregation.rankedProvinces) {
      const val = getMetricValue(item, metricKey);
      if (val > maxVal) maxVal = val;
    }
    return maxVal;
  }, [aggregation.rankedProvinces, metricKey]);

  const rankedByMetric = useMemo(() => {
    return [...aggregation.rankedProvinces].sort(
      (a, b) => getMetricValue(b, metricKey) - getMetricValue(a, metricKey)
    );
  }, [aggregation.rankedProvinces, metricKey]);

  const totalMetricValue = useMemo(() => {
    let sum = 0;
    for (const item of aggregation.rankedProvinces) {
      sum += getMetricValue(item, metricKey);
    }
    return sum > 0 ? sum : 1;
  }, [aggregation.rankedProvinces, metricKey]);

  const maxBranchSales = useMemo(() => {
    return Math.max(
      ...aggregation.branchHubs.map((hub) => Math.max(hub.netSalesIdr, 0)),
      1
    );
  }, [aggregation.branchHubs]);

  const equatorY = useMemo(() => projectLonLat(118, 0)[1], []);

  const clampPan = useCallback((nextX: number, nextY: number, targetZoom: number) => {
    if (targetZoom <= 1.01) return { x: 0, y: 0 };
    const maxOffsetX = (MAP_VIEWBOX.width * (targetZoom - 1)) / 2 + 40;
    const maxOffsetY = (MAP_VIEWBOX.height * (targetZoom - 1)) / 2 + 30;
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextY)),
    };
  }, []);

  const applyZoom = useCallback(
    (nextZoomRaw: number) => {
      const nextZoom = Math.max(1, Math.min(5, Number(nextZoomRaw.toFixed(2))));
      setZoom(nextZoom);
      setPan((prev) => clampPan(prev.x, prev.y, nextZoom));
    },
    [clampPan]
  );

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleFocusJava = useCallback(() => {
    const targetZoom = 3.1;
    const centerX = MAP_VIEWBOX.width / 2;
    const centerY = MAP_VIEWBOX.height / 2;
    const targetPanX = (centerX - JAVA_FOCUS_CENTER[0]) * targetZoom;
    const targetPanY = (centerY - JAVA_FOCUS_CENTER[1]) * targetZoom;
    setZoom(targetZoom);
    setPan(clampPan(targetPanX, targetPanY, targetZoom));
  }, [clampPan]);

  const handleProvinceClick = useCallback(
    (province: string, hasSales: boolean) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }
      if (!hasSales && selectedProvince !== province) return;
      onSelectProvince(selectedProvince === province ? 'all' : province);
    },
    [onSelectProvince, selectedProvince]
  );

  const handleProvinceKeyDown = useCallback(
    (e: ReactKeyboardEvent<SVGPathElement>, province: string, hasSales: boolean) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleProvinceClick(province, hasSales);
      }
    },
    [handleProvinceClick]
  );

  const handleSvgMouseDown = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (zoom <= 1 || e.button !== 0) return;
    dragOriginRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    setIsDragging(true);
  };

  const handleSvgMouseMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    const drag = dragOriginRef.current;
    if (!drag || !mapBoxRef.current) return;

    const rect = mapBoxRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const scaleX = MAP_VIEWBOX.width / rect.width;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      drag.moved = true;
    }
    setPan(clampPan(drag.panX + dx * scaleX, drag.panY + dy * scaleX, zoom));
  };

  const finishDragging = () => {
    if (dragOriginRef.current?.moved) {
      suppressNextClickRef.current = true;
    }
    dragOriginRef.current = null;
    setIsDragging(false);
  };

  const mapCenterX = MAP_VIEWBOX.width / 2;
  const mapCenterY = MAP_VIEWBOX.height / 2;
  const svgTransform = `translate(${mapCenterX + pan.x}, ${mapCenterY + pan.y}) scale(${zoom}) translate(${-mapCenterX}, ${-mapCenterY})`;

  const hoveredProvinceMetric: ProvinceSalesMetric | undefined = hoverTarget
    ? aggregation.byProvince.get(hoverTarget.province)
    : undefined;

  const tooltipCoords = useMemo(() => {
    if (!hoverTarget || !mapBoxRef.current) return null;
    const rect = mapBoxRef.current.getBoundingClientRect();
    const relX = hoverTarget.clientX - rect.left;
    const relY = hoverTarget.clientY - rect.top;
    const placeLeft = relX > rect.width * 0.62;
    const placeAbove = relY > rect.height * 0.58;
    return {
      left: placeLeft ? undefined : Math.max(12, Math.min(rect.width - 250, relX + 14)),
      right: placeLeft ? Math.max(12, rect.width - relX + 14) : undefined,
      top: placeAbove ? undefined : Math.max(12, relY + 12),
      bottom: placeAbove ? Math.max(12, rect.height - relY + 12) : undefined,
    };
  }, [hoverTarget]);

  return (
    <section
      id="indonesia-map"
      aria-labelledby="indonesia-map-heading"
      data-testid="indonesia-map-section"
      className="rounded-xl border border-slate-200 bg-white"
    >
      {/* Header Controls */}
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="indonesia-map-heading" className="text-base font-semibold text-slate-900">
            Peta Sebaran Penjualan Indonesia
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Choropleth 38 provinsi berbasis GeoJSON · klik provinsi aktif untuk memfilter seluruh dashboard
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedProvince !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectProvince('all')}
              className="whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-100"
            >
              Reset Provinsi ({formatProvinceShortName(selectedProvince)})
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowBranchPins((prev) => !prev)}
            aria-pressed={showBranchPins}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              showBranchPins
                ? 'border-sky-200 bg-sky-50 text-sky-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Titik Cabang</span>
          </button>

          <div
            role="group"
            aria-label="Metrik pewarnaan peta"
            className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
          >
            {METRIC_OPTIONS.map((opt) => {
              const active = metricKey === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMetricKey(opt.id)}
                  aria-pressed={active}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Map + Province Ranking Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Interactive SVG Choropleth */}
        <div className="flex flex-col lg:col-span-8">
          <div
            ref={mapBoxRef}
            className="relative aspect-[960/390] w-full overflow-hidden bg-slate-50/75 select-none lg:aspect-auto lg:min-h-[360px] lg:flex-1"
          >
            {isLoadingGeo ? (
              <div
                data-testid="indonesia-map-loading"
                className="flex h-[320px] items-center justify-center px-6 sm:h-[380px]"
              >
                <div className="w-full max-w-md space-y-3 text-center">
                  <div className="mx-auto h-36 w-full animate-pulse rounded-lg bg-slate-200/80" />
                  <p className="text-xs font-medium text-slate-500">
                    Memuat geometri 38 provinsi Indonesia...
                  </p>
                </div>
              </div>
            ) : geoError ? (
              <div className="flex h-[320px] flex-col items-center justify-center gap-3 px-6 text-center sm:h-[380px]">
                <p className="text-sm font-medium text-slate-700">{geoError}</p>
                <button
                  type="button"
                  onClick={() => setRetryNonce((n) => n + 1)}
                  className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Muat Ulang Peta
                </button>
              </div>
            ) : (
              <>
                {/* Floating Zoom & Focus Controls */}
                <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-2xs backdrop-blur-xs">
                  <button
                    type="button"
                    onClick={handleFocusJava}
                    title="Fokus ke Pulau Jawa & Jabodetabek"
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <LocateFixed className="h-3 w-3 text-sky-700" aria-hidden="true" />
                    <span>Fokus Jawa</span>
                  </button>
                  <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => applyZoom(zoom - 0.6)}
                    disabled={zoom <= 1}
                    aria-label="Perkecil peta"
                    className="rounded-md p-1 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="min-w-[36px] text-center font-mono text-[11px] font-medium text-slate-600 tabular-nums">
                    {zoom.toFixed(1)}x
                  </span>
                  <button
                    type="button"
                    onClick={() => applyZoom(zoom + 0.6)}
                    disabled={zoom >= 5}
                    aria-label="Perbesar peta"
                    className="rounded-md p-1 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {(zoom > 1 || pan.x !== 0 || pan.y !== 0) && (
                    <button
                      type="button"
                      onClick={handleResetView}
                      aria-label="Reset posisi dan zoom peta"
                      title="Reset tampilan peta"
                      className="rounded-md p-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <svg
                  data-testid="indonesia-map-svg"
                  viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
                  role="img"
                  aria-label="Peta interaktif 38 provinsi Indonesia"
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={finishDragging}
                  onMouseLeave={() => {
                    finishDragging();
                    setHoverTarget(null);
                  }}
                  className={`block h-full w-full ${
                    zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
                  }`}
                >
                  <g transform={svgTransform}>
                    {/* Equator subtle reference line */}
                    <line
                      x1={0}
                      x2={MAP_VIEWBOX.width}
                      y1={equatorY}
                      y2={equatorY}
                      stroke="#CBD5E1"
                      strokeWidth={0.75}
                      strokeDasharray="4 4"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* 38 Province Polygons */}
                    {provinces.map((prov) => {
                      const metric = aggregation.byProvince.get(prov.province);
                      const val = getMetricValue(metric, metricKey);
                      const hasSales = Boolean(metric);
                      const isSelected = selectedProvince === prov.province;
                      const isHovered = hoverTarget?.province === prov.province;
                      const fill = getChoroplethFillColor(val, maxMetricValue);

                      return (
                        <path
                          key={prov.province}
                          d={prov.pathData}
                          fill={fill}
                          fillRule="evenodd"
                          fillOpacity={
                            selectedProvince !== 'all' && !isSelected && hasSales
                              ? 0.48
                              : 1
                          }
                          stroke={
                            isSelected
                              ? '#0F172A'
                              : isHovered
                                ? '#0369A1'
                                : hasSales
                                  ? '#FFFFFF'
                                  : '#CBD5E1'
                          }
                          strokeWidth={isSelected ? 1.8 : isHovered ? 1.3 : 0.75}
                          vectorEffect="non-scaling-stroke"
                          tabIndex={hasSales ? 0 : -1}
                          role={hasSales ? 'button' : undefined}
                          aria-pressed={hasSales ? isSelected : undefined}
                          aria-label={
                            metric
                              ? `${prov.province}: ${formatMetricValue(val, metricKey)}`
                              : `${prov.province}: belum ada transaksi`
                          }
                          data-province={prov.province}
                          data-has-sales={hasSales ? 'true' : 'false'}
                          onClick={() => handleProvinceClick(prov.province, hasSales)}
                          onKeyDown={(e) => handleProvinceKeyDown(e, prov.province, hasSales)}
                          onMouseEnter={(e) =>
                            setHoverTarget({
                              kind: 'province',
                              province: prov.province,
                              clientX: e.clientX,
                              clientY: e.clientY,
                            })
                          }
                          onMouseMove={(e) =>
                            setHoverTarget((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    clientX: e.clientX,
                                    clientY: e.clientY,
                                  }
                                : null
                            )
                          }
                          className={`outline-none transition-[fill,fill-opacity,stroke] duration-150 ${
                            hasSales ? 'cursor-pointer' : 'cursor-default'
                          }`}
                        />
                      );
                    })}

                    {/* City Branch Hub Markers */}
                    {showBranchPins &&
                      aggregation.branchHubs.map((hub) => {
                        const isSelectedProv = selectedProvince === hub.province;
                        const sizeFactor =
                          Math.sqrt(Math.max(hub.netSalesIdr, 0) / maxBranchSales);
                        const radius = (3.1 + sizeFactor * 3.2) / Math.pow(zoom, 0.55);

                        return (
                          <g key={hub.branch}>
                            <circle
                              cx={hub.x}
                              cy={hub.y}
                              r={radius}
                              fill={isSelectedProv ? '#0F172A' : '#0284C7'}
                              stroke="#FFFFFF"
                              strokeWidth={1.3 / Math.pow(zoom, 0.55)}
                              data-branch-pin={hub.branch}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProvinceClick(hub.province, true);
                              }}
                              onMouseEnter={(e) =>
                                setHoverTarget({
                                  kind: 'branch',
                                  province: hub.province,
                                  branch: hub,
                                  clientX: e.clientX,
                                  clientY: e.clientY,
                                })
                              }
                              onMouseMove={(e) =>
                                setHoverTarget((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        clientX: e.clientX,
                                        clientY: e.clientY,
                                      }
                                    : null
                                )
                              }
                              className="cursor-pointer transition-transform duration-150"
                            />
                            {zoom >= 2.2 && (() => {
                              const lbl = getBranchLabelProps(hub.branch, radius, zoom);
                              return (
                                <text
                                  x={hub.x + lbl.dx}
                                  y={hub.y + lbl.dy}
                                  textAnchor={lbl.textAnchor}
                                  fontSize={9 / zoom}
                                  fontWeight={600}
                                  fill="#0F172A"
                                  paintOrder="stroke"
                                  stroke="#FFFFFF"
                                  strokeWidth={2.5 / zoom}
                                  className="pointer-events-none select-none"
                                >
                                  {hub.branch}
                                </text>
                              );
                            })()}
                          </g>
                        );
                      })}
                  </g>
                </svg>

                {/* Hover Tooltip */}
                {hoverTarget && tooltipCoords && (
                  <div
                    role="status"
                    data-testid="indonesia-map-tooltip"
                    style={{
                      left: tooltipCoords.left,
                      right: tooltipCoords.right,
                      top: tooltipCoords.top,
                      bottom: tooltipCoords.bottom,
                    }}
                    className="pointer-events-none absolute z-20 w-[236px] rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-md backdrop-blur-xs"
                  >
                    {hoverTarget.kind === 'branch' && hoverTarget.branch ? (
                      <>
                        <p className="font-semibold text-slate-900">
                          Cabang {hoverTarget.branch.branch}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {hoverTarget.branch.province} · {hoverTarget.branch.region}
                        </p>
                        <div className="mt-2 space-y-1 tabular-nums">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Net Sales</span>
                            <span className="font-mono font-semibold text-sky-700">
                              {formatIDR(hoverTarget.branch.netSalesIdr)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Porsi Nasional</span>
                            <span className="font-mono text-slate-700">
                              {hoverTarget.branch.sharePct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Volume · Outlet</span>
                            <span className="font-mono text-slate-700">
                              {hoverTarget.branch.qtyCarton.toLocaleString('id-ID')} ktn ·{' '}
                              {hoverTarget.branch.outletCount}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : hoveredProvinceMetric ? (
                      <>
                        <p className="font-semibold text-slate-900">
                          {hoveredProvinceMetric.province}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          Cabang: {hoveredProvinceMetric.branches.join(', ')}
                        </p>
                        <div className="mt-2 space-y-1 tabular-nums">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Net Sales</span>
                            <span className="font-mono font-semibold text-sky-700">
                              {formatIDR(hoveredProvinceMetric.netSalesIdr)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Kontribusi</span>
                            <span className="font-mono text-slate-700">
                              {hoveredProvinceMetric.sharePct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">Volume · Outlet</span>
                            <span className="font-mono text-slate-700">
                              {hoveredProvinceMetric.qtyCarton.toLocaleString('id-ID')} ktn ·{' '}
                              {hoveredProvinceMetric.outletCount}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-900">{hoverTarget.province}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Belum ada transaksi cabang pada filter saat ini.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Choropleth Legend Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-3.5 rounded-xs border border-slate-300"
                  style={{ backgroundColor: CHOROPLETH_EMPTY_FILL }}
                  aria-hidden="true"
                />
                <span>Kosong</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-slate-500">Rendah</span>
                <span className="inline-flex overflow-hidden rounded-xs border border-slate-200">
                  {CHOROPLETH_SCALE_COLORS.map((hex) => (
                    <span
                      key={hex}
                      className="h-2.5 w-4"
                      style={{ backgroundColor: hex }}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className="font-mono text-slate-700 tabular-nums">
                  {formatMetricValue(maxMetricValue, metricKey, true)}
                </span>
              </span>
            </div>

            <div className="font-mono text-slate-500 tabular-nums">
              {aggregation.rankedProvinces.length} dari {provinces.length || 38} provinsi aktif ·{' '}
              {aggregation.branchHubs.length} titik cabang
            </div>
          </div>
        </div>

        {/* Right: Ranked Active Provinces */}
        <div className="flex flex-col border-t border-slate-200 lg:col-span-4 lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Peringkat Provinsi ({rankedByMetric.length})
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Klik baris untuk memfilter cabang di provinsi tersebut
              </p>
            </div>
          </div>

          {rankedByMetric.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-xs text-slate-500">
              Tidak ada provinsi yang terpetakan pada filter aktif.
            </div>
          ) : (
            <div className="max-h-[370px] flex-1 divide-y divide-slate-100 overflow-y-auto">
              {rankedByMetric.map((item, idx) => {
                const isSelected = selectedProvince === item.province;
                const val = getMetricValue(item, metricKey);
                const barPct =
                  maxMetricValue > 0
                    ? Math.max(4, Math.min(100, (Math.max(val, 0) / maxMetricValue) * 100))
                    : 0;

                return (
                  <button
                    key={item.province}
                    type="button"
                    onClick={() =>
                      onSelectProvince(isSelected ? 'all' : item.province)
                    }
                    aria-pressed={isSelected}
                    className={`block w-full px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-sky-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-slate-900">
                        <span className="mr-1.5 font-mono text-[11px] text-slate-400 tabular-nums">
                          {idx + 1}.
                        </span>
                        {formatProvinceShortName(item.province)}
                      </span>
                      <span className="shrink-0 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        {formatMetricValue(val, metricKey, metricKey === 'netSalesIdr')}
                      </span>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          isSelected ? 'bg-sky-700' : 'bg-sky-600/85'
                        }`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                      <span className="truncate">{item.branches.join(', ')}</span>
                      <span className="shrink-0 font-mono">
                        {((val / totalMetricValue) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {aggregation.unmappedRowCount > 0 && (
            <div className="border-t border-slate-100 bg-amber-50/70 px-4 py-2 text-[11px] text-amber-800">
              {aggregation.unmappedRowCount.toLocaleString('id-ID')} baris cabang belum dikenali provinsinya.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
