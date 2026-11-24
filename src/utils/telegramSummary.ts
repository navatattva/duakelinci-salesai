import type { DashboardSummary, DataQualityReport, SalesFilters } from '../types/sales';
import { formatDateRangeLabel } from './dateRange';
import type { ForecastMonthSummary } from './salesForecast';
import { formatCompactIDR, formatIDR, formatMonthLabel } from './salesAnalytics';

export interface SummaryHighlightItem {
  id: string;
  label: string;
  value: string;
  shortDesc: string;
}

export interface WeakOutletSummaryItem {
  rank: number;
  outletId: string;
  outletName: string;
  branch: string;
  region: string;
  primarySalesman: string;
  netSalesText: string;
  shortDesc: string;
}

export interface TelegramSummaryData {
  title: string;
  shortDesc: string;
  highlights: SummaryHighlightItem[];
  weakestOutlets: WeakOutletSummaryItem[];
  formattedMessage: string;
  paragraph: string;
}

function describePeriod(filters: SalesFilters, summary: DashboardSummary): string {
  if (filters.month !== 'all') {
    return formatMonthLabel(filters.month);
  }
  if (filters.dateFrom || filters.dateTo) {
    return formatDateRangeLabel(
      filters.dateFrom || summary.dateRange.start,
      filters.dateTo || summary.dateRange.end
    );
  }
  const startMonth = summary.dateRange.start.slice(0, 7);
  const endMonth = summary.dateRange.end.slice(0, 7);
  if (startMonth && endMonth && startMonth !== endMonth) {
    const startName = formatMonthLabel(startMonth).split(' ')[0];
    const endLabel = formatMonthLabel(endMonth);
    return `${startName}–${endLabel}`;
  }
  if (startMonth && startMonth !== '-') {
    return formatMonthLabel(startMonth);
  }
  return 'Periode Berjalan';
}

export function generateTelegramParagraph(
  summary: DashboardSummary,
  filters: SalesFilters,
  quality?: DataQualityReport,
  options: {
    compactNumbers?: boolean;
    nextMonthForecast?: ForecastMonthSummary | null;
  } = {}
): string {
  if (summary.outletCount === 0 || (summary.invoiceCount === 0 && summary.returnInvoiceCount === 0)) {
    return 'Belum ada transaksi penjualan yang sesuai filter saat ini, sehingga ringkasan performa region, brand, dan outlet belum dapat disusun.';
  }

  const fmt = options.compactNumbers ? formatCompactIDR : formatIDR;
  const periodLabel = describePeriod(filters, summary);
  const scopeLabel =
    filters.region !== 'all' ? `untuk region ${filters.region}` : `di ${summary.regionCount} region`;

  const topRegion = summary.regions[0];
  const secondRegion = summary.regions[1];
  const topBrand = summary.brands[0];
  const secondBrand = summary.brands[1];

  const weakestListText = summary.weakestOutlets
    .map((o, idx) => `${idx + 1}) ${o.outletName} (${o.branch}, ${fmt(o.netSalesIdr)})`)
    .join(', ');

  const regionPart = topRegion
    ? secondRegion
      ? `Kontribusi wilayah tertinggi berasal dari ${topRegion.region} (${fmt(topRegion.netSalesIdr)}; ${topRegion.sharePct.toFixed(1)}%) diikuti ${secondRegion.region} (${fmt(secondRegion.netSalesIdr)}; ${secondRegion.sharePct.toFixed(1)}%).`
      : `Penjualan ${topRegion.region} mencapai ${fmt(topRegion.netSalesIdr)} (${topRegion.sharePct.toFixed(1)}%).`
    : '';

  const brandPart = topBrand
    ? secondBrand
      ? `Dari sisi produk, ${topBrand.brand} memimpin dengan ${fmt(topBrand.netSalesIdr)} (${topBrand.sharePct.toFixed(1)}%), disusul ${secondBrand.brand} (${fmt(secondBrand.netSalesIdr)}; ${secondBrand.sharePct.toFixed(1)}%).`
      : `Brand ${topBrand.brand} membukukan ${fmt(topBrand.netSalesIdr)} (${topBrand.sharePct.toFixed(1)}%).`
    : '';

  const returnAndQualityNotes: string[] = [];
  if (summary.returnInvoiceCount > 0) {
    returnAndQualityNotes.push(
      `retur tercatat ${summary.returnInvoiceCount} dokumen senilai ${fmt(Math.abs(summary.totalReturnNetIdr))}`
    );
  }
  if (filters.deduplicateExact && quality && quality.exactDuplicateCount > 0) {
    returnAndQualityNotes.push(
      `${quality.exactDuplicateCount} baris duplikat identik telah dibersihkan`
    );
  }
  const tailNote =
    returnAndQualityNotes.length > 0
      ? ` Catatan operasional: ${returnAndQualityNotes.join(' dan ')}.`
      : '';

  const forecastNote = options.nextMonthForecast
    ? ` Proyeksi bulan ${options.nextMonthForecast.fullMonthLabel} diperkirakan mencapai ${fmt(options.nextMonthForecast.projectedNetSalesIdr)} (rentang ${fmt(options.nextMonthForecast.lowIdr)}–${fmt(options.nextMonthForecast.highIdr)}).`
    : '';

  return (
    `Rekap Penjualan ${periodLabel} ${scopeLabel}: total penjualan bersih tercatat ${fmt(summary.totalNetSalesIdr)} (${summary.netCartons.toLocaleString('id-ID')} karton dari ${summary.invoiceCount.toLocaleString('id-ID')} invoice aktif di ${summary.outletCount.toLocaleString('id-ID')} outlet, dengan rasio diskon ${summary.discountRatePct.toFixed(1)}%). ` +
    `${regionPart} ${brandPart} ` +
    `Perhatian khusus perlu diarahkan kepada ${summary.weakestOutlets.length} outlet terlemah untuk tindak lanjut tim lapangan, yaitu ${weakestListText}.${tailNote}${forecastNote}`
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateTelegramSummary(
  summary: DashboardSummary,
  filters: SalesFilters,
  quality?: DataQualityReport,
  options: {
    compactNumbers?: boolean;
    nextMonthForecast?: ForecastMonthSummary | null;
  } = {}
): TelegramSummaryData {
  const paragraph = generateTelegramParagraph(summary, filters, quality, options);

  if (summary.outletCount === 0 || (summary.invoiceCount === 0 && summary.returnInvoiceCount === 0)) {
    return {
      title: 'Ringkasan Penjualan',
      shortDesc: paragraph,
      highlights: [],
      weakestOutlets: [],
      formattedMessage: paragraph,
      paragraph,
    };
  }

  const fmt = options.compactNumbers ? formatCompactIDR : formatIDR;
  const periodLabel = describePeriod(filters, summary);
  const scopeBadge =
    filters.region !== 'all'
      ? `Region ${filters.region}`
      : `${summary.regionCount} Region`;

  const title = `Rekap Penjualan ${periodLabel} (${scopeBadge})`;

  const latestTrend = summary.monthlyTrend[summary.monthlyTrend.length - 1];
  const momSentence =
    latestTrend && latestTrend.momGrowthPct !== null
      ? ` Pertumbuhan bulanan tercatat ${latestTrend.momGrowthPct >= 0 ? '+' : ''}${latestTrend.momGrowthPct.toFixed(1)}% MoM pada ${latestTrend.fullMonthLabel}.`
      : '';

  const topRegion = summary.regions[0];
  const secondRegion = summary.regions[1];
  const topBrand = summary.brands[0];
  const secondBrand = summary.brands[1];

  const leaderSentence =
    topRegion && topBrand
      ? ` Kontributor utama dipimpin wilayah ${topRegion.region} (${topRegion.sharePct.toFixed(1)}%) dan brand ${topBrand.brand} (${topBrand.sharePct.toFixed(1)}%).`
      : '';

  const shortDesc = `Penjualan bersih mencapai ${fmt(summary.totalNetSalesIdr)} dari ${summary.netCartons.toLocaleString('id-ID')} karton dan ${summary.invoiceCount.toLocaleString('id-ID')} invoice aktif di ${summary.outletCount.toLocaleString('id-ID')} outlet.${momSentence}${leaderSentence}`.trim();

  const highlights: SummaryHighlightItem[] = [
    {
      id: 'total-sales',
      label: 'Total Penjualan Bersih',
      value: fmt(summary.totalNetSalesIdr),
      shortDesc: `Gross ${fmt(summary.totalGrossSalesIdr)} dengan diskon ${summary.discountRatePct.toFixed(1)}% (${summary.netCartons.toLocaleString('id-ID')} karton netto).`,
    },
  ];

  if (topRegion) {
    highlights.push({
      id: 'top-region',
      label: 'Wilayah Terkuat',
      value: `${topRegion.region} · ${fmt(topRegion.netSalesIdr)}`,
      shortDesc: secondRegion
        ? `Pangsa ${topRegion.sharePct.toFixed(1)}% (${topRegion.outletCount} outlet), diikuti ${secondRegion.region} (${fmt(secondRegion.netSalesIdr)}; ${secondRegion.sharePct.toFixed(1)}%).`
        : `Pangsa ${topRegion.sharePct.toFixed(1)}% dengan ${topRegion.outletCount} outlet dan ${topRegion.invoiceCount} invoice aktif.`,
    });
  }

  if (topBrand) {
    highlights.push({
      id: 'top-brand',
      label: 'Brand Terlaris',
      value: `${topBrand.brand} · ${fmt(topBrand.netSalesIdr)}`,
      shortDesc: secondBrand
        ? `Kontribusi ${topBrand.sharePct.toFixed(1)}% (${topBrand.qtyCarton.toLocaleString('id-ID')} ktn), disusul ${secondBrand.brand} (${fmt(secondBrand.netSalesIdr)}; ${secondBrand.sharePct.toFixed(1)}%).`
        : `Kontribusi ${topBrand.sharePct.toFixed(1)}% dengan volume ${topBrand.qtyCarton.toLocaleString('id-ID')} karton.`,
    });
  }

  if (options.nextMonthForecast) {
    const f = options.nextMonthForecast;
    highlights.push({
      id: 'forecast',
      label: `Proyeksi ${f.fullMonthLabel}`,
      value: fmt(f.projectedNetSalesIdr),
      shortDesc: `Rentang estimasi ${fmt(f.lowIdr)}–${fmt(f.highIdr)} berdasarkan tren historis.`,
    });
  }

  const operationalNotes: string[] = [];
  if (summary.returnInvoiceCount > 0) {
    operationalNotes.push(
      `${summary.returnInvoiceCount} dokumen retur memotong penjualan sebesar ${fmt(Math.abs(summary.totalReturnNetIdr))}`
    );
  }
  if (filters.deduplicateExact && quality && quality.exactDuplicateCount > 0) {
    operationalNotes.push(
      `${quality.exactDuplicateCount} baris duplikat identik otomatis dibersihkan`
    );
  }

  if (operationalNotes.length > 0) {
    highlights.push({
      id: 'operations',
      label: 'Operasional & Kualitas Data',
      value:
        summary.returnInvoiceCount > 0
          ? `Retur ${fmt(Math.abs(summary.totalReturnNetIdr))}`
          : `${quality?.exactDuplicateCount ?? 0} Duplikat Bersih`,
      shortDesc: `${operationalNotes.join('; ')}.`,
    });
  }

  const weakestOutlets: WeakOutletSummaryItem[] = summary.weakestOutlets.map((o, idx) => ({
    rank: idx + 1,
    outletId: o.outletId,
    outletName: o.outletName,
    branch: o.branch,
    region: o.region,
    primarySalesman: o.primarySalesman,
    netSalesText: fmt(o.netSalesIdr),
    shortDesc: `${o.branch} · Salesman ${o.primarySalesman} · ${o.invoiceCount} inv (${o.qtyCarton} ktn) — ${o.weaknessReason}`,
  }));

  const highlightLines = highlights.map(
    (item) => `- ${item.label}: ${item.value} (${item.shortDesc})`
  );
  const outletLines = weakestOutlets.map(
    (item) =>
      `${item.rank}. ${item.outletName} (${item.branch}) — ${item.netSalesText} | Salesman ${item.primarySalesman}, ${item.shortDesc.split(' — ')[1] ?? item.shortDesc}`
  );

  const formattedMessage = [
    title,
    shortDesc,
    '',
    'Sorotan Performa:',
    ...highlightLines,
    '',
    `${weakestOutlets.length} Outlet Terlemah (Prioritas Tindak Lanjut):`,
    ...outletLines,
  ].join('\n');

  return {
    title,
    shortDesc,
    highlights,
    weakestOutlets,
    formattedMessage,
    paragraph,
  };
}
