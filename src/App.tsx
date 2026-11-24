import { Upload } from 'lucide-react';
import { useState } from 'react';
import { CsvUploadModal } from './components/CsvUploadModal';
import { DataQualitySection } from './components/DataQualitySection';
import { FilterToolbar } from './components/FilterToolbar';
import { HeaderBar } from './components/HeaderBar';
import { IndonesiaMapChart } from './components/IndonesiaMapChart';
import { KpiStrip } from './components/KpiStrip';
import { MonthlySalesTrendChart } from './components/MonthlySalesTrendChart';
import { RegionBrandSection } from './components/RegionBrandSection';
import { SankeyFlowSection } from './components/SankeyFlowSection';
import {
  SIDEBAR_NAV_ITEMS,
  SidebarNav,
  type DashboardViewId,
} from './components/SidebarNav';
import { TelegramSummaryPanel } from './components/TelegramSummaryPanel';
import { WeakestOutletsSection } from './components/WeakestOutletsSection';
import { useSalesDashboard } from './hooks/useSalesDashboard';

export default function App() {
  const {
    dataset,
    datasetDateBounds,
    availableBranches,
    availableOutletTypes,
    sourceLabel,
    isSampleFallback,
    isSavingDb,
    filters,
    setFilters,
    resetFilters,
    hasActiveFilter,
    forecastOptions,
    setForecastOptions,
    pythonForecast,
    isLoadingPythonForecast,
    pythonForecastError,
    refreshPythonForecast,
    sankeyMode,
    setSankeyMode,
    filteredRows,
    mapBaseRows,
    summary,
    trendSummary,
    salesForecast,
    sankeyData,
    submitCsvText,
    restoreStarterDataset,
  } = useSalesDashboard();

  const [activeView, setActiveView] = useState<DashboardViewId>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const activeViewMeta =
    SIDEBAR_NAV_ITEMS.find((item) => item.id === activeView) ?? SIDEBAR_NAV_ITEMS[0];

  const showForecastAndTelegram = activeView === 'overview' || activeView === 'forecast';
  const showFlowAndRegion = activeView === 'overview' || activeView === 'flow';
  const showOutlets = activeView === 'overview' || activeView === 'outlets';
  const showQuality = activeView === 'overview' || activeView === 'quality';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SidebarNav
        activeView={activeView}
        onSelectView={setActiveView}
        sourceLabel={sourceLabel}
        activeRowCount={filteredRows.length}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenUpload={() => setIsUploadModalOpen(true)}
      />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <HeaderBar
          activeViewLabel={activeViewMeta.label}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenUpload={() => setIsUploadModalOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1280px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {activeView === 'overview'
                  ? 'Dashboard Penjualan & Outlet'
                  : activeViewMeta.label}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Sumber data: <span className="font-medium text-slate-900">{sourceLabel}</span>
                <span aria-hidden="true"> · </span>
                Rentang tanggal:{' '}
                <span className="font-mono text-xs text-slate-700 tabular-nums">
                  {summary.dateRange.start} s/d {summary.dateRange.end}
                </span>
                <span aria-hidden="true"> · </span>
                <span className="font-mono text-xs text-slate-700 tabular-nums">
                  {filteredRows.length.toLocaleString('id-ID')} baris aktif
                </span>
              </p>
            </div>
          </div>

          {/* Starter Preview Notice */}
          {isSampleFallback && (
            <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs leading-relaxed text-slate-700 sm:text-sm">
                Saat ini dashboard menampilkan <strong>32 baris contoh awal</strong> agar langsung siap diuji. Untuk menganalisis seluruh 1.891 baris <span className="font-mono">sales.csv</span> Anda, unggah file lewat tombol di samping atau simpan file ke folder <span className="font-mono">public/sales.csv</span>.
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-lg border border-sky-300 bg-white px-3.5 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100/60 sm:self-center"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Muat sales.csv Lengkap</span>
              </button>
            </div>
          )}

          {/* Filter & Data Quality Controls */}
          <FilterToolbar
            filters={filters}
            datasetDateBounds={datasetDateBounds}
            availableMonths={dataset.availableMonths}
            availableRegions={dataset.availableRegions}
            availableBranches={availableBranches}
            availableOutletTypes={availableOutletTypes}
            availableBrands={dataset.availableBrands}
            quality={dataset.quality}
            hasActiveFilter={hasActiveFilter}
            onChangeFilters={setFilters}
            onResetFilters={resetFilters}
          />

          {/* KPI Strip */}
          <KpiStrip summary={summary} />

          {/* Empty Filter State or Active View Sections */}
          {filteredRows.length === 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
              <h2 className="text-base font-semibold text-slate-900">
                Tidak ada transaksi yang cocok dengan filter
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Coba ubah kata kunci pencarian atau reset filter untuk melihat seluruh data penjualan.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Reset Semua Filter
              </button>
            </section>
          ) : (
            <>
              {showForecastAndTelegram && (
                <>
                  <TelegramSummaryPanel
                    summary={summary}
                    filters={filters}
                    quality={dataset.quality}
                    nextMonthForecast={salesForecast.nextMonth}
                  />

                  <MonthlySalesTrendChart
                    monthlyTrend={trendSummary.monthlyTrend}
                    forecast={salesForecast}
                    forecastOptions={forecastOptions}
                    onChangeForecastOptions={setForecastOptions}
                    selectedMonth={filters.month}
                    pythonForecast={pythonForecast}
                    isLoadingPythonForecast={isLoadingPythonForecast}
                    pythonForecastError={pythonForecastError}
                    onRefreshPythonForecast={refreshPythonForecast}
                  />
                </>
              )}

              {showFlowAndRegion && (
                <>
                  <IndonesiaMapChart
                    rows={mapBaseRows}
                    selectedProvince={filters.province ?? 'all'}
                    onSelectProvince={(province) =>
                      setFilters((f) => ({
                        ...f,
                        region: 'all',
                        province,
                        branch: 'all',
                      }))
                    }
                  />

                  <SankeyFlowSection
                    sankeyData={sankeyData}
                    mode={sankeyMode}
                    onChangeMode={setSankeyMode}
                  />

                  <RegionBrandSection
                    regions={summary.regions}
                    brands={summary.brands}
                    selectedRegion={filters.region}
                    selectedBrand={filters.brand}
                    onSelectRegion={(region) =>
                      setFilters((f) => ({
                        ...f,
                        region,
                        province: 'all',
                        branch: 'all',
                      }))
                    }
                    onSelectBrand={(brand) => setFilters((f) => ({ ...f, brand }))}
                  />
                </>
              )}

              {showOutlets && (
                <WeakestOutletsSection
                  weakestOutlets={summary.weakestOutlets}
                  allOutlets={summary.allOutlets}
                />
              )}

              {showQuality && (
                <DataQualitySection
                  quality={dataset.quality}
                  deduplicateExact={filters.deduplicateExact}
                  includeReturns={filters.includeReturns}
                />
              )}
            </>
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white py-5">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <span>Rekap Penjualan Distributor · Analitik Region, Brand &amp; Outlet</span>
            <span>Letakkan sales.csv di folder public/ atau unggah langsung melalui browser</span>
          </div>
        </footer>
      </div>

      <CsvUploadModal
        isOpen={isUploadModalOpen}
        isSaving={isSavingDb}
        onClose={() => setIsUploadModalOpen(false)}
        onSubmitCsv={submitCsvText}
        onRestoreStarter={restoreStarterDataset}
      />
    </div>
  );
}
