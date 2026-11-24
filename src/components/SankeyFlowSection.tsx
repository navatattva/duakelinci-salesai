import {
  Layer,
  Rectangle,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  type SankeyLinkProps,
  type SankeyNodeProps,
} from 'recharts';
import { formatCompactIDR, formatIDR } from '../utils/salesAnalytics';
import type {
  SalesSankeyNode,
  SalesSankeyResult,
  SankeyFlowMode,
  SankeyNodeCategory,
} from '../utils/sankeyBuilder';

interface SankeyFlowSectionProps {
  sankeyData: SalesSankeyResult;
  mode: SankeyFlowMode;
  onChangeMode: (mode: SankeyFlowMode) => void;
}

const NODE_COLORS: Record<SankeyNodeCategory, string> = {
  region: '#0369A1', // Sky 700
  channel: '#475569', // Slate 600
  brand: '#0F766E', // Teal 700
};

function renderCustomNode(
  props: SankeyNodeProps,
  mode: SankeyFlowMode
) {
  const { x, y, width, height, index, payload } = props;
  const typedPayload = payload as unknown as SalesSankeyNode & { value?: number };
  const category = typedPayload.category ?? 'region';
  const fill = NODE_COLORS[category] ?? '#0369A1';
  const value = typedPayload.totalIdr ?? typedPayload.value ?? 0;

  // Determine label placement by stage: leftmost goes left, rightmost goes right, middle goes right with white stroke halo
  const isLeftmost = category === 'region';
  const isRightmost = category === 'brand';
  const labelX = isLeftmost ? x - 8 : x + width + 8;
  const textAnchor = isLeftmost ? 'end' : 'start';
  const isCompactNode = height < 20;

  return (
    <Layer key={`sankey-node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 3)}
        fill={fill}
        fillOpacity={0.92}
        rx={2}
        ry={2}
      />
      {isCompactNode ? (
        <text
          x={labelX}
          y={y + height / 2}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fontSize={11}
          fontWeight={600}
          fill="#0F172A"
          paintOrder="stroke"
          stroke={mode === 'region-channel-brand' && category === 'channel' ? '#FFFFFF' : undefined}
          strokeWidth={mode === 'region-channel-brand' && category === 'channel' ? 4 : undefined}
        >
          {typedPayload.name}{' '}
          <tspan fill="#475569" fontWeight={400} fontFamily="JetBrains Mono, monospace" fontSize={10}>
            ({formatCompactIDR(value)})
          </tspan>
        </text>
      ) : (
        <>
          <text
            x={labelX}
            y={y + height / 2 - 5}
            textAnchor={textAnchor}
            dominantBaseline="central"
            fontSize={12}
            fontWeight={600}
            fill="#0F172A"
            paintOrder="stroke"
            stroke={mode === 'region-channel-brand' && category === 'channel' ? '#FFFFFF' : undefined}
            strokeWidth={mode === 'region-channel-brand' && category === 'channel' ? 4 : undefined}
          >
            {typedPayload.name}
          </text>
          <text
            x={labelX}
            y={y + height / 2 + 10}
            textAnchor={textAnchor}
            dominantBaseline="central"
            fontSize={10}
            fontFamily="JetBrains Mono, monospace"
            fill="#475569"
            paintOrder="stroke"
            stroke={mode === 'region-channel-brand' && category === 'channel' ? '#FFFFFF' : undefined}
            strokeWidth={mode === 'region-channel-brand' && category === 'channel' ? 3 : undefined}
          >
            {formatCompactIDR(value)}
          </text>
        </>
      )}
    </Layer>
  );
}

function renderCustomLink(props: SankeyLinkProps) {
  const {
    sourceX,
    targetX,
    sourceY,
    targetY,
    sourceControlX,
    targetControlX,
    linkWidth,
    index,
    payload,
  } = props;

  const sourceNode = payload.source as unknown as SalesSankeyNode | undefined;
  const strokeColor =
    sourceNode?.category === 'channel' ? '#64748B' : '#0284C7';

  return (
    <path
      key={`sankey-link-${index}`}
      d={`
        M${sourceX},${sourceY}
        C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
      `}
      fill="none"
      stroke={strokeColor}
      strokeWidth={Math.max(linkWidth, 1)}
      strokeOpacity={0.22}
    />
  );
}

interface SankeyTooltipProps {
  active?: boolean;
  totalFlowIdr: number;
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: {
      source?: SalesSankeyNode;
      target?: SalesSankeyNode;
      name?: string;
      value?: number;
      totalIdr?: number;
      category?: SankeyNodeCategory;
    };
  }>;
}

function SankeyTooltipContent({ active, payload, totalFlowIdr }: SankeyTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const val = item.value ?? item.totalIdr ?? 0;
  const pct = totalFlowIdr > 0 ? (val / totalFlowIdr) * 100 : 0;

  // Link tooltip vs Node tooltip
  if (item.source && item.target) {
    return (
      <div className="min-w-[220px] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
        <p className="font-semibold text-slate-900">
          {item.source.name} → {item.target.name}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-4 tabular-nums">
          <span className="text-slate-500">Aliran Penjualan</span>
          <span className="font-mono font-semibold text-sky-700">{formatIDR(val)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-4 tabular-nums">
          <span className="text-slate-500">Porsi Total Aliran</span>
          <span className="font-mono text-slate-700">{pct.toFixed(1)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[200px] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
      <p className="font-semibold text-slate-900">{item.name ?? payload[0]?.name}</p>
      <div className="mt-1.5 flex items-center justify-between gap-4 tabular-nums">
        <span className="text-slate-500">Total Penjualan</span>
        <span className="font-mono font-semibold text-slate-900">{formatIDR(val)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4 tabular-nums">
        <span className="text-slate-500">Kontribusi</span>
        <span className="font-mono text-slate-700">{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function SankeyFlowSection({
  sankeyData,
  mode,
  onChangeMode,
}: SankeyFlowSectionProps) {
  const chartMargin = { top: 24, right: 205, bottom: 28, left: 135 };

  return (
    <section
      id="sankey-flow"
      aria-labelledby="sankey-flow-heading"
      data-testid="sankey-flow-section"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="sankey-flow-heading" className="text-base font-semibold text-slate-900">
            Diagram Alur Penjualan (Sankey)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Visualisasi aliran nilai penjualan bersih antar wilayah, saluran outlet, dan brand
          </p>
        </div>

        <div
          role="group"
          aria-label="Mode aliran Sankey"
          className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:self-auto"
        >
          <button
            type="button"
            onClick={() => onChangeMode('region-brand')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'region-brand'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Region → Brand
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('region-channel-brand')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'region-channel-brand'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Region → Tipe Outlet → Brand
          </button>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-5">
        {sankeyData.nodes.length === 0 || sankeyData.links.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">
            Tidak ada aliran penjualan positif yang dapat ditampilkan pada filter saat ini.
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-5 px-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-xs bg-sky-700" aria-hidden="true" />
                <span>Region</span>
              </span>
              {mode === 'region-channel-brand' && (
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-xs bg-slate-600" aria-hidden="true" />
                  <span>Tipe Outlet</span>
                </span>
              )}
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-xs bg-teal-700" aria-hidden="true" />
                <span>Brand</span>
              </span>
              {sankeyData.omittedNegativeCount > 0 && (
                <span className="text-slate-400">
                  · {sankeyData.omittedNegativeCount} jalur bernilai nol/negatif akibat retur tidak digambarkan
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="h-[400px] min-w-[660px] w-full" data-testid="sankey-chart">
                <ResponsiveContainer width="100%" height={400} minWidth={0}>
                  <Sankey
                    data={{
                      nodes: sankeyData.nodes,
                      links: sankeyData.links,
                    }}
                    nodeWidth={12}
                    nodePadding={24}
                    margin={chartMargin}
                    node={(props) => renderCustomNode(props, mode)}
                    link={renderCustomLink}
                  >
                    <Tooltip
                      content={
                        <SankeyTooltipContent totalFlowIdr={sankeyData.totalFlowIdr} />
                      }
                    />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
