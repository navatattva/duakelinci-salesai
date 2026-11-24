import { Cpu, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlySalesPoint } from '../types/sales';
import {
  formatDailyChartPoints,
  type ChartTrendPoint,
  type ForecastMethod,
  type ForecastOptions,
  type FormattedDailyChartPoint,
  type PythonHybridForecastPayload,
  type SalesForecastResult,
} from '../utils/salesForecast';
import { formatCompactIDR, formatIDR } from '../utils/salesAnalytics';

interface MonthlySalesTrendChartProps {
  monthlyTrend: MonthlySalesPoint[];
  forecast: SalesForecastResult;
  forecastOptions: ForecastOptions;
  onChangeForecastOptions: (next: ForecastOptions) => void;
  selectedMonth: string;
  pythonForecast: PythonHybridForecastPayload | null;
  isLoadingPythonForecast: boolean;
  pythonForecastError: string | null;
  onRefreshPythonForecast: () => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartTrendPoint;
  }>;
}

interface DailyTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: FormattedDailyChartPoint;
  }>;
}

function TrendTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="min-w-[235px] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
      <p className="font-semibold text-slate-900">{point.fullMonthLabel}</p>
      <div className="mt-2 space-y-1 tabular-nums">
        {point.actualNetSalesIdr !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Penjualan Bersih (Aktual)</span>
            <span className="font-mono font-semibold text-sky-700">
              {formatIDR(point.actualNetSalesIdr)}
            </span>
          </div>
        )}
        {point.actualGrossSalesIdr !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Penjualan Kotor</span>
            <span className="font-mono text-slate-700">
              {formatIDR(point.actualGrossSalesIdr)}
            </span>
          </div>
        )}
        {point.isForecast && point.forecastNetSalesIdr !== null && (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Proyeksi Penjualan</span>
              <span className="font-mono font-semibold text-amber-700">
                {formatIDR(point.forecastNetSalesIdr)}
              </span>
            </div>
            {point.forecastLowIdr !== null && point.forecastHighIdr !== null && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Rentang Estimasi</span>
                <span className="font-mono text-slate-700">
                  {formatCompactIDR(point.forecastLowIdr)} –{' '}
                  {formatCompactIDR(point.forecastHighIdr)}
                </span>
              </div>
            )}
          </>
        )}
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Estimasi Volume</span>
          <span className="font-mono text-slate-700">
            {point.qtyCarton.toLocaleString('id-ID')} ktn
            {!point.isForecast ? ` · ${point.invoiceCount} inv` : ''}
          </span>
        </div>
        {point.momGrowthPct !== null && (
          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1">
            <span className="text-slate-500">Perubahan MoM</span>
            <span
              className={`font-mono font-semibold ${
                point.momGrowthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {point.momGrowthPct >= 0 ? '+' : ''}
              {point.momGrowthPct.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function DailyTrendTooltip({ active, payload }: DailyTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="min-w-[235px] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm">
      <p className="font-semibold text-slate-900">{point.fullDateLabel}</p>
      <div className="mt-2 space-y-1 tabular-nums">
        {point.actualNetSalesIdr !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Aktual Harian</span>
            <span className="font-mono font-semibold text-sky-700">
              {formatIDR(point.actualNetSalesIdr)}
            </span>
          </div>
        )}
        {point.isForecast && point.forecastNetSalesIdr !== null && (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Proyeksi Python</span>
              <span className="font-mono font-semibold text-amber-700">
                {formatIDR(point.forecastNetSalesIdr)}
              </span>
            </div>
            {point.lowIdr !== null && point.highIdr !== null && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Rentang 80% CI</span>
                <span className="font-mono text-slate-700">
                  {formatCompactIDR(point.lowIdr)} – {formatCompactIDR(point.highIdr)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function MonthlySalesTrendChart({
  monthlyTrend,
  forecast,
  forecastOptions,
  onChangeForecastOptions,
  selectedMonth,
  pythonForecast,
  isLoadingPythonForecast,
  pythonForecastError,
  onRefreshPythonForecast,
}: MonthlySalesTrendChartProps) {
  const [showGrossLine, setShowGrossLine] = useState(false);
  const [showForecast, setShowForecast] = useState(true);
  const [chartGranularity, setChartGranularity] = useState<'monthly' | 'daily'>('monthly');

  const isPythonMode = forecastOptions.method === 'python-hybrid';
  const showDailyPythonView =
    isPythonMode &&
    showForecast &&
    chartGranularity === 'daily' &&
    Boolean(pythonForecast && pythonForecast.dailyPoints.length > 0);

  const chartData = showForecast
    ? forecast.chartData
    : forecast.chartData.filter((pt) => !pt.isForecast);

  const dailyChartData = showDailyPythonView && pythonForecast
    ? formatDailyChartPoints(pythonForecast.dailyPoints)
    : [];

  const latestActual = monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1] : null;
  const latestGrowth = latestActual?.momGrowthPct ?? null;

  const basisDescription =
    isPythonMode && pythonForecast
      ? `${pythonForecast.engineLabel} · Basis ${pythonForecast.sampleDays} hari historis`
      : forecast.basisType === 'single-month-baseline'
        ? `Basis 1 bulan (${latestActual?.fullMonthLabel ?? '-'}) memakai run-rate bulan berjalan · Muat data multi-bulan untuk tren regresi`
        : forecast.basisType === 'two-month-trend'
          ? `Basis 2 bulan aktual (${monthlyTrend[0]?.monthLabel} – ${latestActual?.monthLabel}) dengan proyeksi ${
              forecastOptions.method === 'linear' ? 'tren linear' : 'rata-rata tertimbang'
            }`
          : forecast.basisType === 'multi-month-trend'
            ? `Basis ${monthlyTrend.length} bulan aktual (${monthlyTrend[0]?.monthLabel} – ${latestActual?.monthLabel}) dengan proyeksi ${
                forecastOptions.method === 'linear' ? 'tren linear' : 'rata-rata tertimbang'
              }`
            : 'Belum ada data bulanan';

  return (
    <section
      aria-labelledby="monthly-trend-heading"
      data-testid="monthly-trend-section"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="monthly-trend-heading" className="text-base font-semibold text-slate-900">
              Tren &amp; Forecast Penjualan Bulanan (IDR)
            </h2>
            {latestGrowth !== null && (
              <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                {latestGrowth >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-rose-700" aria-hidden="true" />
                )}
                <span
                  data-testid="mom-growth-indicator"
                  className={`font-mono font-semibold ${
                    latestGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {latestGrowth >= 0 ? '+' : ''}
                  {latestGrowth.toFixed(1)}% MoM
                </span>
                <span className="text-slate-500">({latestActual?.monthLabel})</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {basisDescription}
            {selectedMonth !== 'all' ? ' · Bulan filter disorot' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {showForecast && (
            <>
              <div
                role="group"
                aria-label="Horizon forecast"
                className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
              >
                {([1, 2, 3] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() =>
                      onChangeForecastOptions({ ...forecastOptions, horizonMonths: h })
                    }
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      forecastOptions.horizonMonths === h
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    +{h} Bln
                  </button>
                ))}
              </div>

              <div
                role="group"
                aria-label="Metode forecast"
                className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
              >
                {(
                  [
                    { id: 'linear', label: 'Tren Linear' },
                    { id: 'moving-average', label: 'Rata-rata' },
                    { id: 'python-hybrid', label: 'Hybrid Python' },
                  ] as Array<{ id: ForecastMethod; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onChangeForecastOptions({ ...forecastOptions, method: m.id })
                    }
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      forecastOptions.method === m.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowForecast((prev) => !prev)}
            aria-pressed={showForecast}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              showForecast
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {showForecast ? 'Forecast Aktif' : 'Tampilkan Forecast'}
          </button>

          {!showDailyPythonView && (
            <button
              type="button"
              onClick={() => setShowGrossLine((prev) => !prev)}
              aria-pressed={showGrossLine}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                showGrossLine
                  ? 'border-slate-300 bg-slate-100 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {showGrossLine ? 'Sembunyikan Gross' : '+ Gross Sales'}
            </button>
          )}
        </div>
      </div>

      {/* Hybrid Python CLI Bar */}
      {isPythonMode && showForecast && (
        <div
          data-testid="python-hybrid-bar"
          className="flex flex-col gap-2.5 border-b border-slate-200 bg-slate-50/75 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
              <Cpu className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
              <span>
                {isLoadingPythonForecast
                  ? 'Menjalankan worker Python CLI...'
                  : pythonForecast?.engineLabel ?? 'Menyiapkan Python CLI...'}
              </span>
            </span>

            {pythonForecast && !isLoadingPythonForecast && (
              <>
                <span className="font-mono text-[11px] text-slate-500">
                  {pythonForecast.fromCache
                    ? 'Cache SQLite'
                    : `CLI ${pythonForecast.executionMs} ms`}
                </span>
                {pythonForecast.diagnostics && (
                  <>
                    <span>
                      Puncak:{' '}
                      <strong className="font-medium text-emerald-700">
                        {pythonForecast.diagnostics.peakWeekday} (
                        {pythonForecast.diagnostics.peakDeltaPct >= 0 ? '+' : ''}
                        {pythonForecast.diagnostics.peakDeltaPct}%)
                      </strong>
                    </span>
                    <span>
                      Terendah:{' '}
                      <strong className="font-medium text-rose-700">
                        {pythonForecast.diagnostics.lowWeekday} (
                        {pythonForecast.diagnostics.lowDeltaPct >= 0 ? '+' : ''}
                        {pythonForecast.diagnostics.lowDeltaPct}%)
                      </strong>
                    </span>
                  </>
                )}
              </>
            )}

            {pythonForecastError && (
              <span className="font-medium text-amber-800">
                Fallback ke tren linear ({pythonForecastError})
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pythonForecast && pythonForecast.dailyPoints.length > 0 && (
              <div
                role="group"
                aria-label="Granularitas grafik Python"
                className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setChartGranularity('monthly')}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    chartGranularity === 'monthly'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setChartGranularity('daily')}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    chartGranularity === 'daily'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Harian (Python)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onRefreshPythonForecast}
              disabled={isLoadingPythonForecast}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingPythonForecast ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Hitung Ulang</span>
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-5 sm:px-5">
        {chartData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
            Belum ada data bulanan pada filter saat ini.
          </div>
        ) : (
          <>
            {/* Legend row */}
            <div className="mb-3 flex flex-wrap items-center gap-5 px-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-4 bg-sky-700" aria-hidden="true" />
                <span>
                  {showDailyPythonView
                    ? 'Penjualan Harian Aktual'
                    : 'Penjualan Bersih Aktual'}
                </span>
              </span>
              {showForecast && (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-0.5 w-4 border-t-2 border-dashed border-amber-600"
                    aria-hidden="true"
                  />
                  <span>
                    {showDailyPythonView
                      ? 'Proyeksi Harian Python (80% CI)'
                      : 'Proyeksi Forecast (Rentang Estimasi)'}
                  </span>
                </span>
              )}
              {!showDailyPythonView && showGrossLine && (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-0.5 w-4 border-t-2 border-dotted border-slate-500"
                    aria-hidden="true"
                  />
                  <span>Penjualan Kotor (Gross)</span>
                </span>
              )}
            </div>

            <div className="h-[265px] w-full" data-testid="monthly-trend-chart">
              <ResponsiveContainer width="100%" height={265} minWidth={0}>
                {showDailyPythonView ? (
                  <ComposedChart
                    data={dailyChartData}
                    margin={{ top: 12, right: 20, left: 12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fill: '#475569', fontSize: 11 }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                      minTickGap={24}
                      padding={{ left: 12, right: 12 }}
                    />
                    <YAxis
                      tickFormatter={(val: number) => formatCompactIDR(val)}
                      tick={{ fill: '#475569', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={84}
                    />
                    <Tooltip content={<DailyTrendTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="forecastRange"
                      stroke="none"
                      fill="#FEF3C7"
                      fillOpacity={0.75}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actualNetSalesIdr"
                      name="Aktual Harian"
                      stroke="#0369A1"
                      strokeWidth={2}
                      connectNulls={false}
                      dot={false}
                      activeDot={{ r: 5, fill: '#0284C7', stroke: '#FFFFFF', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecastNetSalesIdr"
                      name="Proyeksi Harian Python"
                      stroke="#D97706"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      connectNulls={false}
                      dot={false}
                      activeDot={{ r: 5, fill: '#B45309', stroke: '#FFFFFF', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                ) : (
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 12, right: 20, left: 12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                      padding={{ left: 24, right: 24 }}
                    />
                    <YAxis
                      tickFormatter={(val: number) => formatCompactIDR(val)}
                      tick={{ fill: '#475569', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={84}
                    />
                    <Tooltip content={<TrendTooltip />} />

                    {showForecast && (
                      <Area
                        type="monotone"
                        dataKey="forecastRange"
                        stroke="none"
                        fill="#FEF3C7"
                        fillOpacity={0.75}
                        isAnimationActive={false}
                      />
                    )}

                    <Line
                      type="monotone"
                      dataKey="actualNetSalesIdr"
                      name="Penjualan Bersih"
                      stroke="#0369A1"
                      strokeWidth={2.5}
                      connectNulls={false}
                      dot={{ r: 5, fill: '#0369A1', stroke: '#FFFFFF', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#0284C7', stroke: '#FFFFFF', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />

                    {showForecast && (
                      <Line
                        type="monotone"
                        dataKey="forecastNetSalesIdr"
                        name="Proyeksi Forecast"
                        stroke="#D97706"
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        connectNulls={false}
                        dot={{ r: 5, fill: '#D97706', stroke: '#FFFFFF', strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: '#B45309', stroke: '#FFFFFF', strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    )}

                    {showGrossLine && (
                      <Line
                        type="monotone"
                        dataKey="actualGrossSalesIdr"
                        name="Penjualan Kotor"
                        stroke="#64748B"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        connectNulls={false}
                        dot={{ r: 4, fill: '#64748B', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                        activeDot={{ r: 6 }}
                        isAnimationActive={false}
                      />
                    )}
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Forecast & Actual Monthly Readout Strip */}
            <div className="mt-4 grid grid-cols-1 divide-y divide-slate-100 border-t border-slate-100 pt-3 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {monthlyTrend.map((pt) => {
                const isSelected = selectedMonth === pt.monthKey;
                return (
                  <div
                    key={pt.monthKey}
                    className={`flex items-baseline justify-between gap-2 px-3 py-2 text-xs ${
                      isSelected ? 'bg-sky-50/70' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800">{pt.fullMonthLabel}</span>
                      <span className="ml-1.5 text-[11px] text-slate-400">Aktual</span>
                    </div>
                    <div className="shrink-0 text-right font-mono tabular-nums">
                      <span className="whitespace-nowrap font-semibold text-slate-900">
                        {formatIDR(pt.netSalesIdr)}
                      </span>
                      {pt.momGrowthPct !== null && (
                        <div
                          className={`text-[11px] ${
                            pt.momGrowthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {pt.momGrowthPct >= 0 ? '+' : ''}
                          {pt.momGrowthPct.toFixed(1)}% MoM
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {showForecast &&
                forecast.projectedMonths.map((fp) => (
                  <div
                    key={fp.monthKey}
                    data-testid={`forecast-month-${fp.monthKey}`}
                    className="flex items-baseline justify-between gap-2 bg-amber-50/35 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800">{fp.fullMonthLabel}</span>
                      <span className="ml-1.5 text-[11px] text-amber-700">
                        {isPythonMode ? 'Python' : 'Forecast'}
                      </span>
                    </div>
                    <div className="shrink-0 text-right font-mono tabular-nums">
                      <span className="whitespace-nowrap font-semibold text-amber-800">
                        {formatIDR(fp.projectedNetSalesIdr)}
                      </span>
                      <div className="whitespace-nowrap text-[11px] text-slate-500">
                        {formatCompactIDR(fp.lowIdr)}–{formatCompactIDR(fp.highIdr)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {showForecast && forecast.nextMonth && forecast.regionForecasts.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 px-3 pt-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">
                  Target Proyeksi {forecast.nextMonth.monthLabel} per Region:
                </span>
                {forecast.regionForecasts.map((rf) => (
                  <span key={rf.region} className="tabular-nums">
                    <span className="text-slate-700">{rf.region}</span>{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCompactIDR(rf.projectedNetSalesIdr)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
