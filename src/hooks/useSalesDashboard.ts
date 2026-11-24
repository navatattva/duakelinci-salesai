import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STARTER_SALES_CSV } from '../data/starterCsv';
import {
  fetchPersistedSales,
  importCsvDataset,
  requestPythonHybridForecast,
  resetSalesDataset,
} from '../services/salesApi';
import type { ParsedSalesDataset, SalesFilters } from '../types/sales';
import { parseSalesCsv } from '../utils/csvParser';
import {
  computeDashboardSummary,
  computeDatasetDateBounds,
  computeFacetOptions,
  filterSalesRows,
} from '../utils/salesAnalytics';
import {
  generateSalesForecast,
  mergePythonForecastResult,
  type ForecastOptions,
  type PythonHybridForecastPayload,
} from '../utils/salesForecast';
import { buildSalesSankeyData, type SankeyFlowMode } from '../utils/sankeyBuilder';

export const DEFAULT_FILTERS: SalesFilters = {
  month: 'all',
  dateFrom: '',
  dateTo: '',
  region: 'all',
  province: 'all',
  branch: 'all',
  outletType: 'all',
  brand: 'all',
  searchQuery: '',
  deduplicateExact: true,
  includeReturns: true,
};

export function useSalesDashboard() {
  const [dataset, setDataset] = useState<ParsedSalesDataset>(() =>
    parseSalesCsv(STARTER_SALES_CSV)
  );
  const [sourceLabel, setSourceLabel] = useState<string>('Memuat dari SQLite...');
  const [datasetVersion, setDatasetVersion] = useState<number>(0);
  const [isSampleFallback, setIsSampleFallback] = useState<boolean>(true);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(true);
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);
  const [filters, setFilters] = useState<SalesFilters>(DEFAULT_FILTERS);
  const [forecastOptions, setForecastOptions] = useState<ForecastOptions>({
    horizonMonths: 2,
    method: 'linear',
  });
  const [pythonForecast, setPythonForecast] = useState<PythonHybridForecastPayload | null>(
    null
  );
  const [isLoadingPythonForecast, setIsLoadingPythonForecast] = useState<boolean>(false);
  const [pythonForecastError, setPythonForecastError] = useState<string | null>(null);
  const [pythonRefreshNonce, setPythonRefreshNonce] = useState<number>(0);
  const forceRefreshRef = useRef<boolean>(false);
  const [sankeyMode, setSankeyMode] = useState<SankeyFlowMode>('region-brand');

  useEffect(() => {
    let cancelled = false;

    async function loadInitialDataset() {
      try {
        const payload = await fetchPersistedSales();
        if (!cancelled) {
          setDataset(payload.dataset);
          setSourceLabel(payload.sourceLabel);
          setIsSampleFallback(payload.isSampleFallback);
          setDatasetVersion((v) => v + 1);
        }
      } catch {
        if (!cancelled) {
          setSourceLabel('Preview Awal (32 baris terverifikasi)');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDb(false);
        }
      }
    }

    loadInitialDataset();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (forecastOptions.method !== 'python-hybrid' || isLoadingDb) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const shouldForceRefresh = forceRefreshRef.current;
    forceRefreshRef.current = false;

    async function loadPythonForecast() {
      setIsLoadingPythonForecast(true);
      setPythonForecastError(null);
      try {
        const result = await requestPythonHybridForecast({
          horizonMonths: forecastOptions.horizonMonths,
          filters,
          forceRefresh: shouldForceRefresh,
          signal: controller.signal,
        });
        if (!cancelled) {
          setPythonForecast(result);
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
          setPythonForecastError(
            err instanceof Error ? err.message : 'Gagal menjalankan forecast Python CLI.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPythonForecast(false);
        }
      }
    }

    loadPythonForecast();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    forecastOptions.method,
    forecastOptions.horizonMonths,
    filters.region,
    filters.province,
    filters.branch,
    filters.outletType,
    filters.brand,
    filters.searchQuery,
    filters.deduplicateExact,
    filters.includeReturns,
    datasetVersion,
    isLoadingDb,
    pythonRefreshNonce,
  ]);

  const refreshPythonForecast = useCallback(() => {
    forceRefreshRef.current = true;
    setPythonRefreshNonce((n) => n + 1);
  }, []);

  const datasetDateBounds = useMemo(
    () => computeDatasetDateBounds(dataset.rows),
    [dataset.rows]
  );

  const facetOptions = useMemo(
    () => computeFacetOptions(dataset.rows, filters),
    [dataset.rows, filters]
  );

  const filteredRows = useMemo(
    () => filterSalesRows(dataset.rows, filters),
    [dataset.rows, filters]
  );

  const mapBaseRows = useMemo(() => {
    if ((filters.province ?? 'all') === 'all') {
      return filteredRows;
    }
    return filterSalesRows(dataset.rows, { ...filters, province: 'all' });
  }, [dataset.rows, filters, filteredRows]);

  const summary = useMemo(
    () => computeDashboardSummary(filteredRows),
    [filteredRows]
  );

  const trendSummary = useMemo(() => {
    if (filters.month === 'all' && !filters.dateFrom && !filters.dateTo) {
      return summary;
    }
    const allMonthRows = filterSalesRows(dataset.rows, {
      ...filters,
      month: 'all',
      dateFrom: '',
      dateTo: '',
    });
    return computeDashboardSummary(allMonthRows);
  }, [dataset.rows, filters, summary]);

  const salesForecast = useMemo(() => {
    if (forecastOptions.method === 'python-hybrid' && pythonForecast) {
      return mergePythonForecastResult(
        trendSummary.monthlyTrend,
        trendSummary.regions,
        pythonForecast,
        forecastOptions.horizonMonths
      );
    }
    return generateSalesForecast(
      trendSummary.monthlyTrend,
      trendSummary.regions,
      forecastOptions
    );
  }, [
    trendSummary.monthlyTrend,
    trendSummary.regions,
    forecastOptions,
    pythonForecast,
  ]);

  const sankeyData = useMemo(
    () => buildSalesSankeyData(filteredRows, sankeyMode),
    [filteredRows, sankeyMode]
  );

  const hasActiveFilter =
    filters.month !== 'all' ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    filters.region !== 'all' ||
    (filters.province ?? 'all') !== 'all' ||
    (filters.branch ?? 'all') !== 'all' ||
    (filters.outletType ?? 'all') !== 'all' ||
    filters.brand !== 'all' ||
    filters.searchQuery.trim() !== '' ||
    !filters.deduplicateExact ||
    !filters.includeReturns;

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  async function submitCsvText(csvText: string, label: string): Promise<string | null> {
    setIsSavingDb(true);
    try {
      parseSalesCsv(csvText);
      const payload = await importCsvDataset(csvText, label);
      setDataset(payload.dataset);
      setSourceLabel(payload.sourceLabel);
      setIsSampleFallback(payload.isSampleFallback);
      setPythonForecast(null);
      setDatasetVersion((v) => v + 1);
      setFilters(DEFAULT_FILTERS);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Gagal memproses file CSV.';
    } finally {
      setIsSavingDb(false);
    }
  }

  async function restoreStarterDataset(): Promise<void> {
    setIsSavingDb(true);
    try {
      const payload = await resetSalesDataset();
      setDataset(payload.dataset);
      setSourceLabel(payload.sourceLabel);
      setIsSampleFallback(payload.isSampleFallback);
      setPythonForecast(null);
      setDatasetVersion((v) => v + 1);
      setFilters(DEFAULT_FILTERS);
    } finally {
      setIsSavingDb(false);
    }
  }

  return {
    dataset,
    datasetDateBounds,
    availableBranches: facetOptions.branches,
    availableOutletTypes: facetOptions.outletTypes,
    sourceLabel,
    isSampleFallback,
    isLoadingDb,
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
  };
}
