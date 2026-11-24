import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  formatDailyChartPoints,
  generateSalesForecast,
  mergePythonForecastResult,
  type PythonHybridForecastPayload,
} from './salesForecast';
import type { MonthlySalesPoint, RegionMetric } from '../types/sales';

const SAMPLE_REGIONS: RegionMetric[] = [
  {
    region: 'Jabodetabek',
    netSalesIdr: 6000000,
    grossSalesIdr: 6200000,
    discountIdr: 200000,
    returnNetIdr: 0,
    qtyCarton: 30,
    invoiceCount: 5,
    outletCount: 4,
    sharePct: 60,
  },
  {
    region: 'Jawa Barat',
    netSalesIdr: 4000000,
    grossSalesIdr: 4100000,
    discountIdr: 100000,
    returnNetIdr: 0,
    qtyCarton: 20,
    invoiceCount: 4,
    outletCount: 3,
    sharePct: 40,
  },
];

test('addMonths advances across year boundary accurately', () => {
  assert.equal(addMonths('2026-10', 1), '2026-11');
  assert.equal(addMonths('2026-10', 2), '2026-12');
  assert.equal(addMonths('2026-10', 3), '2027-01');
});

test('generateSalesForecast handles empty data cleanly', () => {
  const res = generateSalesForecast([], []);
  assert.equal(res.basisType, 'empty');
  assert.equal(res.projectedMonths.length, 0);
  assert.equal(res.nextMonth, null);
});

test('generateSalesForecast handles single-month baseline honestly', () => {
  const single: MonthlySalesPoint[] = [
    {
      monthKey: '2026-09',
      monthLabel: 'Sep 2026',
      fullMonthLabel: 'September 2026',
      netSalesIdr: 10000000,
      grossSalesIdr: 10500000,
      discountIdr: 500000,
      returnNetIdr: 0,
      qtyCarton: 50,
      invoiceCount: 10,
      momGrowthPct: null,
    },
  ];
  const res = generateSalesForecast(single, SAMPLE_REGIONS, {
    horizonMonths: 2,
    method: 'linear',
  });
  assert.equal(res.basisType, 'single-month-baseline');
  assert.equal(res.projectedMonths.length, 2);
  assert.equal(res.projectedMonths[0].monthKey, '2026-10');
  assert.equal(res.projectedMonths[0].projectedNetSalesIdr, 10000000);
  assert.equal(res.projectedMonths[0].changeVsLastActualPct, 0);
  assert.equal(res.regionForecasts[0].projectedNetSalesIdr, 6000000);
});

test('generateSalesForecast projects exact linear growth across multi-month history', () => {
  const history: MonthlySalesPoint[] = [
    {
      monthKey: '2026-08',
      monthLabel: 'Agu 2026',
      fullMonthLabel: 'Agustus 2026',
      netSalesIdr: 1000000,
      grossSalesIdr: 1000000,
      discountIdr: 0,
      returnNetIdr: 0,
      qtyCarton: 10,
      invoiceCount: 2,
      momGrowthPct: null,
    },
    {
      monthKey: '2026-09',
      monthLabel: 'Sep 2026',
      fullMonthLabel: 'September 2026',
      netSalesIdr: 2000000,
      grossSalesIdr: 2000000,
      discountIdr: 0,
      returnNetIdr: 0,
      qtyCarton: 20,
      invoiceCount: 4,
      momGrowthPct: 100,
    },
    {
      monthKey: '2026-10',
      monthLabel: 'Okt 2026',
      fullMonthLabel: 'Oktober 2026',
      netSalesIdr: 3000000,
      grossSalesIdr: 3000000,
      discountIdr: 0,
      returnNetIdr: 0,
      qtyCarton: 30,
      invoiceCount: 6,
      momGrowthPct: 50,
    },
  ];

  const linearRes = generateSalesForecast(history, SAMPLE_REGIONS, {
    horizonMonths: 3,
    method: 'linear',
  });
  assert.equal(linearRes.basisType, 'multi-month-trend');
  assert.equal(linearRes.projectedMonths.length, 3);
  assert.equal(linearRes.projectedMonths[0].monthKey, '2026-11');
  assert.equal(linearRes.projectedMonths[0].projectedNetSalesIdr, 4000000);
  assert.equal(linearRes.projectedMonths[1].projectedNetSalesIdr, 5000000);
  assert.equal(linearRes.projectedMonths[2].monthKey, '2027-01');
  assert.equal(linearRes.projectedMonths[2].projectedNetSalesIdr, 6000000);
  // Chart data has 3 actual + 3 forecast points = 6 points, with anchor at Oct 2026
  assert.equal(linearRes.chartData.length, 6);
  assert.equal(linearRes.chartData[2].actualNetSalesIdr, 3000000);
  assert.equal(linearRes.chartData[2].forecastNetSalesIdr, 3000000);

  // Moving average should yield conservative weighted average: (1*1M + 2*2M + 3*3M)/6 = 2,333,333
  const maRes = generateSalesForecast(history, SAMPLE_REGIONS, {
    horizonMonths: 1,
    method: 'moving-average',
  });
  assert.equal(maRes.projectedMonths[0].projectedNetSalesIdr, 2333333);
});

test('mergePythonForecastResult maps Python CLI monthly & daily payload accurately', () => {
  const actuals: MonthlySalesPoint[] = [
    {
      monthKey: '2026-09',
      monthLabel: 'Sep 2026',
      fullMonthLabel: 'September 2026',
      netSalesIdr: 800000000,
      grossSalesIdr: 815000000,
      discountIdr: 15000000,
      returnNetIdr: 0,
      qtyCarton: 4100,
      invoiceCount: 400,
      momGrowthPct: null,
    },
    {
      monthKey: '2026-10',
      monthLabel: 'Okt 2026',
      fullMonthLabel: 'Oktober 2026',
      netSalesIdr: 850000000,
      grossSalesIdr: 865000000,
      discountIdr: 15000000,
      returnNetIdr: 0,
      qtyCarton: 4300,
      invoiceCount: 420,
      momGrowthPct: 6.25,
    },
  ];

  const pyPayload: PythonHybridForecastPayload = {
    ok: true,
    engineUsed: 'python-seasonal-cli',
    engineLabel: 'Python CLI · Damped Holt + Musiman Mingguan',
    availableEngines: { builtin: true, statsmodels: false, autogluon: false },
    executionMs: 14.2,
    sampleDays: 61,
    diagnostics: {
      mapePct: 16.5,
      peakWeekday: 'Jumat',
      peakDeltaPct: 24.0,
      lowWeekday: 'Minggu',
      lowDeltaPct: -42.0,
    },
    dailyPoints: [
      {
        date: '2026-10-31',
        isForecast: false,
        actualNetSalesIdr: 25000000,
        forecastNetSalesIdr: 25000000,
        forecastRange: [25000000, 25000000],
        lowIdr: 25000000,
        highIdr: 25000000,
      },
      {
        date: '2026-11-01',
        isForecast: true,
        actualNetSalesIdr: null,
        forecastNetSalesIdr: 18000000,
        forecastRange: [15000000, 21000000],
        lowIdr: 15000000,
        highIdr: 21000000,
      },
    ],
    projectedMonths: [
      {
        monthKey: '2026-11',
        projectedNetSalesIdr: 880000000,
        lowIdr: 800000000,
        highIdr: 960000000,
        projectedCartons: 4450,
      },
      {
        monthKey: '2026-12',
        projectedNetSalesIdr: 910000000,
        lowIdr: 810000000,
        highIdr: 1010000000,
        projectedCartons: 4600,
      },
    ],
  };

  const merged = mergePythonForecastResult(actuals, SAMPLE_REGIONS, pyPayload, 2);
  assert.equal(merged.methodUsed, 'python-hybrid');
  assert.equal(merged.projectedMonths.length, 2);
  assert.equal(merged.projectedMonths[0].monthKey, '2026-11');
  assert.equal(merged.projectedMonths[0].projectedNetSalesIdr, 880000000);
  assert.equal(merged.chartData.length, 4);
  assert.equal(merged.chartData[1].forecastNetSalesIdr, 850000000);

  const formattedDaily = formatDailyChartPoints(pyPayload.dailyPoints);
  assert.equal(formattedDaily[0].dateLabel, '31 Okt');
  assert.equal(formattedDaily[1].dateLabel, '01 Nov');
  assert.match(formattedDaily[1].fullDateLabel, /Forecast Python/);
});

