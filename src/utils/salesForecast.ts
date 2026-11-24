import type { MonthlySalesPoint, RegionMetric } from '../types/sales';
import { formatMonthLabel, formatShortMonthLabel } from './salesAnalytics';

export type ForecastMethod = 'linear' | 'moving-average' | 'python-hybrid';

export interface ForecastOptions {
  horizonMonths: 1 | 2 | 3;
  method: ForecastMethod;
}

export interface PythonDailyChartPoint {
  date: string;
  isForecast: boolean;
  actualNetSalesIdr: number | null;
  forecastNetSalesIdr: number | null;
  forecastRange: [number, number] | null;
  lowIdr: number | null;
  highIdr: number | null;
}

export interface PythonProjectedMonth {
  monthKey: string;
  projectedNetSalesIdr: number;
  lowIdr: number;
  highIdr: number;
  projectedCartons: number;
}

export interface PythonForecastDiagnostics {
  mapePct: number | null;
  peakWeekday: string;
  peakDeltaPct: number;
  lowWeekday: string;
  lowDeltaPct: number;
}

export interface PythonHybridForecastPayload {
  ok: true;
  engineUsed: string;
  engineLabel: string;
  availableEngines: {
    builtin: boolean;
    statsmodels: boolean;
    autogluon: boolean;
  };
  executionMs: number;
  fromCache?: boolean;
  sampleDays: number;
  diagnostics: PythonForecastDiagnostics | null;
  dailyPoints: PythonDailyChartPoint[];
  projectedMonths: PythonProjectedMonth[];
}

export interface FormattedDailyChartPoint extends PythonDailyChartPoint {
  dateLabel: string;
  fullDateLabel: string;
}

export interface ChartTrendPoint {
  monthKey: string;
  monthLabel: string;
  fullMonthLabel: string;
  isForecast: boolean;
  actualNetSalesIdr: number | null;
  actualGrossSalesIdr: number | null;
  forecastNetSalesIdr: number | null;
  forecastRange: [number, number] | null;
  forecastLowIdr: number | null;
  forecastHighIdr: number | null;
  qtyCarton: number;
  invoiceCount: number;
  momGrowthPct: number | null;
}

export interface ForecastMonthSummary {
  monthKey: string;
  monthLabel: string;
  fullMonthLabel: string;
  projectedNetSalesIdr: number;
  lowIdr: number;
  highIdr: number;
  projectedCartons: number;
  changeVsLastActualPct: number | null;
}

export interface RegionForecastPoint {
  region: string;
  currentSharePct: number;
  projectedNetSalesIdr: number;
}

export interface SalesForecastResult {
  chartData: ChartTrendPoint[];
  projectedMonths: ForecastMonthSummary[];
  nextMonth: ForecastMonthSummary | null;
  basisType: 'empty' | 'single-month-baseline' | 'two-month-trend' | 'multi-month-trend';
  methodUsed: ForecastMethod;
  regionForecasts: RegionForecastPoint[];
}

const SHORT_MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export function formatShortDateLabel(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const monthIdx = Number(parts[1]) - 1;
  const day = parts[2];
  return `${day} ${SHORT_MONTHS_ID[monthIdx] ?? parts[1]}`;
}

export function formatDailyChartPoints(
  points: PythonDailyChartPoint[]
): FormattedDailyChartPoint[] {
  return points.map((pt) => ({
    ...pt,
    dateLabel: formatShortDateLabel(pt.date),
    fullDateLabel: pt.isForecast
      ? `${formatShortDateLabel(pt.date)} ${pt.date.slice(0, 4)} (Forecast Python)`
      : `${formatShortDateLabel(pt.date)} ${pt.date.slice(0, 4)}`,
  }));
}

export function addMonths(monthKey: string, offset: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (Number.isNaN(year) || Number.isNaN(month)) return monthKey;

  const totalMonths = year * 12 + (month - 1) + offset;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

function computeLinearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0] };

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - meanX;
    num += dx * (values[i] - meanY);
    den += dx * dx;
  }

  const slope = den > 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function computeWeightedMovingAverage(values: number[]): number {
  if (values.length === 0) return 0;
  // Recent months receive higher weight: 1, 2, 3, ...
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < values.length; i += 1) {
    const w = i + 1;
    weightedSum += values[i] * w;
    weightTotal += w;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

export function generateSalesForecast(
  monthlyTrend: MonthlySalesPoint[],
  regions: RegionMetric[],
  options: ForecastOptions = { horizonMonths: 2, method: 'linear' }
): SalesForecastResult {
  if (monthlyTrend.length === 0) {
    return {
      chartData: [],
      projectedMonths: [],
      nextMonth: null,
      basisType: 'empty',
      methodUsed: options.method,
      regionForecasts: [],
    };
  }

  const n = monthlyTrend.length;
  const lastActual = monthlyTrend[n - 1];
  const netValues = monthlyTrend.map((m) => m.netSalesIdr);
  const cartonValues = monthlyTrend.map((m) => m.qtyCarton);

  const basisType: SalesForecastResult['basisType'] =
    n === 1
      ? 'single-month-baseline'
      : n === 2
        ? 'two-month-trend'
        : 'multi-month-trend';

  const { slope, intercept } = computeLinearRegression(netValues);
  const { slope: cartonSlope, intercept: cartonIntercept } =
    computeLinearRegression(cartonValues);
  const wmaNet = computeWeightedMovingAverage(netValues);
  const wmaCarton = computeWeightedMovingAverage(cartonValues);

  // Estimate uncertainty band (tighter with 3+ months and low residual error, wider for 1-2 months)
  let baseRelativeError = n === 1 ? 0.15 : n === 2 ? 0.12 : 0.08;
  if (n >= 3) {
    const residuals = netValues.map((val, idx) =>
      Math.abs(val - (intercept + slope * idx))
    );
    const meanAbsVal =
      netValues.reduce((acc, v) => acc + Math.abs(v), 0) / Math.max(1, n);
    const meanResidual =
      residuals.reduce((acc, r) => acc + r, 0) / Math.max(1, n);
    const empiricalRate = meanAbsVal > 0 ? meanResidual / meanAbsVal : 0.08;
    baseRelativeError = Math.min(0.25, Math.max(0.06, empiricalRate * 1.25));
  }

  const chartData: ChartTrendPoint[] = monthlyTrend.map((m, idx) => {
    const isAnchor = idx === n - 1;
    return {
      monthKey: m.monthKey,
      monthLabel: m.monthLabel,
      fullMonthLabel: m.fullMonthLabel,
      isForecast: false,
      actualNetSalesIdr: m.netSalesIdr,
      actualGrossSalesIdr: m.grossSalesIdr,
      // Anchor the dashed forecast line on the final actual point for seamless visual continuity
      forecastNetSalesIdr: isAnchor ? m.netSalesIdr : null,
      forecastRange: isAnchor ? [m.netSalesIdr, m.netSalesIdr] : null,
      forecastLowIdr: isAnchor ? m.netSalesIdr : null,
      forecastHighIdr: isAnchor ? m.netSalesIdr : null,
      qtyCarton: m.qtyCarton,
      invoiceCount: m.invoiceCount,
      momGrowthPct: m.momGrowthPct,
    };
  });

  const projectedMonths: ForecastMonthSummary[] = [];

  for (let step = 1; step <= options.horizonMonths; step += 1) {
    const futureMonthKey = addMonths(lastActual.monthKey, step);
    const futureIdx = n - 1 + step;

    let rawProjectedNet: number;
    let rawProjectedCartons: number;

    if (n === 1) {
      rawProjectedNet = lastActual.netSalesIdr;
      rawProjectedCartons = lastActual.qtyCarton;
    } else if (options.method === 'linear') {
      rawProjectedNet = intercept + slope * futureIdx;
      rawProjectedCartons = cartonIntercept + cartonSlope * futureIdx;
    } else {
      // Moving average gently blends recent average run-rate
      rawProjectedNet = wmaNet;
      rawProjectedCartons = wmaCarton;
    }

    const projectedNetSalesIdr = Math.max(0, Math.round(rawProjectedNet));
    const projectedCartons = Math.max(0, Math.round(rawProjectedCartons));

    const marginRatio = baseRelativeError * Math.sqrt(step);
    const marginIdr = Math.round(projectedNetSalesIdr * marginRatio);
    const lowIdr = Math.max(0, projectedNetSalesIdr - marginIdr);
    const highIdr = projectedNetSalesIdr + marginIdr;

    const changeVsLastActualPct =
      lastActual.netSalesIdr > 0
        ? ((projectedNetSalesIdr - lastActual.netSalesIdr) / lastActual.netSalesIdr) * 100
        : null;

    const prevPointNet =
      step === 1
        ? lastActual.netSalesIdr
        : projectedMonths[projectedMonths.length - 1].projectedNetSalesIdr;
    const stepMomPct =
      prevPointNet > 0
        ? ((projectedNetSalesIdr - prevPointNet) / prevPointNet) * 100
        : null;

    const monthSummary: ForecastMonthSummary = {
      monthKey: futureMonthKey,
      monthLabel: formatShortMonthLabel(futureMonthKey),
      fullMonthLabel: formatMonthLabel(futureMonthKey),
      projectedNetSalesIdr,
      lowIdr,
      highIdr,
      projectedCartons,
      changeVsLastActualPct,
    };
    projectedMonths.push(monthSummary);

    chartData.push({
      monthKey: futureMonthKey,
      monthLabel: monthSummary.monthLabel,
      fullMonthLabel: `${monthSummary.fullMonthLabel} (Forecast)`,
      isForecast: true,
      actualNetSalesIdr: null,
      actualGrossSalesIdr: null,
      forecastNetSalesIdr: projectedNetSalesIdr,
      forecastRange: [lowIdr, highIdr],
      forecastLowIdr: lowIdr,
      forecastHighIdr: highIdr,
      qtyCarton: projectedCartons,
      invoiceCount: lastActual.invoiceCount,
      momGrowthPct: stepMomPct,
    });
  }

  const nextMonth = projectedMonths[0] ?? null;

  const regionForecasts: RegionForecastPoint[] =
    nextMonth && regions.length > 0
      ? regions.map((r) => ({
          region: r.region,
          currentSharePct: r.sharePct,
          projectedNetSalesIdr: Math.max(
            0,
            Math.round((nextMonth.projectedNetSalesIdr * r.sharePct) / 100)
          ),
        }))
      : [];

  return {
    chartData,
    projectedMonths,
    nextMonth,
    basisType,
    methodUsed: options.method,
    regionForecasts,
  };
}

export function mergePythonForecastResult(
  monthlyTrend: MonthlySalesPoint[],
  regions: RegionMetric[],
  pythonPayload: PythonHybridForecastPayload | null,
  horizonMonths: 1 | 2 | 3
): SalesForecastResult {
  if (
    !pythonPayload ||
    !pythonPayload.ok ||
    pythonPayload.projectedMonths.length === 0 ||
    monthlyTrend.length === 0
  ) {
    return generateSalesForecast(monthlyTrend, regions, {
      horizonMonths,
      method: 'linear',
    });
  }

  const n = monthlyTrend.length;
  const lastActual = monthlyTrend[n - 1];
  const basisType: SalesForecastResult['basisType'] =
    n === 1
      ? 'single-month-baseline'
      : n === 2
        ? 'two-month-trend'
        : 'multi-month-trend';

  const chartData: ChartTrendPoint[] = monthlyTrend.map((m, idx) => {
    const isAnchor = idx === n - 1;
    return {
      monthKey: m.monthKey,
      monthLabel: m.monthLabel,
      fullMonthLabel: m.fullMonthLabel,
      isForecast: false,
      actualNetSalesIdr: m.netSalesIdr,
      actualGrossSalesIdr: m.grossSalesIdr,
      forecastNetSalesIdr: isAnchor ? m.netSalesIdr : null,
      forecastRange: isAnchor ? [m.netSalesIdr, m.netSalesIdr] : null,
      forecastLowIdr: isAnchor ? m.netSalesIdr : null,
      forecastHighIdr: isAnchor ? m.netSalesIdr : null,
      qtyCarton: m.qtyCarton,
      invoiceCount: m.invoiceCount,
      momGrowthPct: m.momGrowthPct,
    };
  });

  const projectedMonths: ForecastMonthSummary[] = [];
  const sliced = pythonPayload.projectedMonths.slice(0, horizonMonths);

  for (const pm of sliced) {
    const prevPointNet =
      projectedMonths.length === 0
        ? lastActual.netSalesIdr
        : projectedMonths[projectedMonths.length - 1].projectedNetSalesIdr;
    const stepMomPct =
      prevPointNet > 0
        ? ((pm.projectedNetSalesIdr - prevPointNet) / prevPointNet) * 100
        : null;
    const changeVsLastActualPct =
      lastActual.netSalesIdr > 0
        ? ((pm.projectedNetSalesIdr - lastActual.netSalesIdr) / lastActual.netSalesIdr) * 100
        : null;

    const summary: ForecastMonthSummary = {
      monthKey: pm.monthKey,
      monthLabel: formatShortMonthLabel(pm.monthKey),
      fullMonthLabel: formatMonthLabel(pm.monthKey),
      projectedNetSalesIdr: pm.projectedNetSalesIdr,
      lowIdr: pm.lowIdr,
      highIdr: pm.highIdr,
      projectedCartons: pm.projectedCartons,
      changeVsLastActualPct,
    };
    projectedMonths.push(summary);

    chartData.push({
      monthKey: pm.monthKey,
      monthLabel: summary.monthLabel,
      fullMonthLabel: `${summary.fullMonthLabel} (Forecast Python)`,
      isForecast: true,
      actualNetSalesIdr: null,
      actualGrossSalesIdr: null,
      forecastNetSalesIdr: pm.projectedNetSalesIdr,
      forecastRange: [pm.lowIdr, pm.highIdr],
      forecastLowIdr: pm.lowIdr,
      forecastHighIdr: pm.highIdr,
      qtyCarton: pm.projectedCartons,
      invoiceCount: lastActual.invoiceCount,
      momGrowthPct: stepMomPct,
    });
  }

  const nextMonth = projectedMonths[0] ?? null;
  const regionForecasts: RegionForecastPoint[] =
    nextMonth && regions.length > 0
      ? regions.map((r) => ({
          region: r.region,
          currentSharePct: r.sharePct,
          projectedNetSalesIdr: Math.max(
            0,
            Math.round((nextMonth.projectedNetSalesIdr * r.sharePct) / 100)
          ),
        }))
      : [];

  return {
    chartData,
    projectedMonths,
    nextMonth,
    basisType,
    methodUsed: 'python-hybrid',
    regionForecasts,
  };
}

