import type { ParsedSalesDataset, SalesFilters } from '../types/sales';
import type { PythonHybridForecastPayload } from '../utils/salesForecast';

export interface PersistedSalesPayload {
  dataset: ParsedSalesDataset;
  sourceLabel: string;
  isSampleFallback: boolean;
  updatedAt?: string;
}

export async function fetchPersistedSales(): Promise<PersistedSalesPayload> {
  const res = await fetch('/api/sales', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('SQLite API unavailable');
  }
  const payload = (await res.json()) as PersistedSalesPayload;
  if (!payload?.dataset?.rows) {
    throw new Error('Respons dataset tidak valid');
  }
  return payload;
}

export async function importCsvDataset(
  csvText: string,
  sourceLabel: string
): Promise<PersistedSalesPayload> {
  const res = await fetch('/api/sales/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvText, sourceLabel }),
  });

  const payload = (await res.json()) as Partial<PersistedSalesPayload> & { error?: string };
  if (!res.ok || !payload.dataset) {
    throw new Error(payload.error ?? 'Gagal menyimpan dataset ke SQLite.');
  }

  return {
    dataset: payload.dataset,
    sourceLabel: payload.sourceLabel ?? sourceLabel,
    isSampleFallback: Boolean(payload.isSampleFallback),
    updatedAt: payload.updatedAt,
  };
}

export async function resetSalesDataset(): Promise<PersistedSalesPayload> {
  const res = await fetch('/api/sales/reset', { method: 'POST' });
  const payload = (await res.json()) as Partial<PersistedSalesPayload> & { error?: string };
  if (!res.ok || !payload.dataset) {
    throw new Error(payload.error ?? 'Gagal mereset database SQLite.');
  }
  return payload as PersistedSalesPayload;
}

export async function requestPythonHybridForecast(params: {
  horizonMonths: 1 | 2 | 3;
  filters: SalesFilters;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}): Promise<PythonHybridForecastPayload> {
  const res = await fetch('/api/forecast/python', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      horizonMonths: params.horizonMonths,
      preferredEngine: 'auto',
      forceRefresh: Boolean(params.forceRefresh),
      filters: {
        region: params.filters.region,
        province: params.filters.province ?? 'all',
        branch: params.filters.branch ?? 'all',
        outletType: params.filters.outletType ?? 'all',
        brand: params.filters.brand,
        searchQuery: params.filters.searchQuery,
        deduplicateExact: params.filters.deduplicateExact,
        includeReturns: params.filters.includeReturns,
      },
    }),
  });

  const payload = (await res.json()) as Partial<PythonHybridForecastPayload> & { error?: string };
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error ?? 'Gagal menjalankan forecast Python CLI.');
  }
  return payload as PythonHybridForecastPayload;
}
