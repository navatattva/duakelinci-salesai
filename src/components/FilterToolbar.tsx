import { Calendar, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { DataQualityReport, SalesFilters } from '../types/sales';
import {
  buildDateRangePresets,
  formatDateRangeLabel,
  type DateRangePreset,
} from '../utils/dateRange';
import { formatMonthLabel } from '../utils/salesAnalytics';
import { SearchableSelect } from './SearchableSelect';

interface FilterToolbarProps {
  filters: SalesFilters;
  datasetDateBounds: { min: string; max: string };
  availableMonths: string[];
  availableRegions: string[];
  availableBranches: string[];
  availableOutletTypes: string[];
  availableBrands: string[];
  quality: DataQualityReport;
  hasActiveFilter: boolean;
  onChangeFilters: (updater: (prev: SalesFilters) => SalesFilters) => void;
  onResetFilters: () => void;
}

export function FilterToolbar({
  filters,
  datasetDateBounds,
  availableMonths,
  availableRegions,
  availableBranches,
  availableOutletTypes,
  availableBrands,
  quality,
  hasActiveFilter,
  onChangeFilters,
  onResetFilters,
}: FilterToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.searchQuery);
  const debouncedSearchInput = useDebouncedValue(searchInput, 250);
  const lastDispatchedSearchRef = useRef(filters.searchQuery);

  useEffect(() => {
    if (debouncedSearchInput === lastDispatchedSearchRef.current) return;
    lastDispatchedSearchRef.current = debouncedSearchInput;
    onChangeFilters((f) =>
      f.searchQuery === debouncedSearchInput
        ? f
        : { ...f, searchQuery: debouncedSearchInput }
    );
  }, [debouncedSearchInput, onChangeFilters]);

  useEffect(() => {
    if (filters.searchQuery !== lastDispatchedSearchRef.current) {
      lastDispatchedSearchRef.current = filters.searchQuery;
      setSearchInput(filters.searchQuery);
    }
  }, [filters.searchQuery]);

  const dateFrom = filters.dateFrom ?? '';
  const dateTo = filters.dateTo ?? '';
  const province = filters.province ?? 'all';
  const branch = filters.branch ?? 'all';
  const outletType = filters.outletType ?? 'all';
  const hasDateFilter = Boolean(dateFrom || dateTo || filters.month !== 'all');

  const presets = buildDateRangePresets(
    datasetDateBounds.min,
    datasetDateBounds.max,
    availableMonths
  );

  function isPresetActive(preset: DateRangePreset): boolean {
    if (preset.id === 'all') {
      return !dateFrom && !dateTo && filters.month === 'all';
    }
    if (preset.month !== 'all' && filters.month === preset.month && !dateFrom && !dateTo) {
      return true;
    }
    return dateFrom === preset.dateFrom && dateTo === preset.dateTo && preset.dateFrom !== '';
  }

  function applyPreset(preset: DateRangePreset) {
    onChangeFilters((prev) => ({
      ...prev,
      month: 'all',
      dateFrom: preset.dateFrom,
      dateTo: preset.dateTo,
    }));
  }

  function handleDateFromChange(nextFrom: string) {
    onChangeFilters((prev) => {
      const currentTo = prev.dateTo ?? '';
      const resolvedTo = nextFrom && currentTo && nextFrom > currentTo ? nextFrom : currentTo;
      return {
        ...prev,
        month: 'all',
        dateFrom: nextFrom,
        dateTo: resolvedTo,
      };
    });
  }

  function handleDateToChange(nextTo: string) {
    onChangeFilters((prev) => {
      const currentFrom = prev.dateFrom ?? '';
      const resolvedFrom = nextTo && currentFrom && nextTo < currentFrom ? nextTo : currentFrom;
      return {
        ...prev,
        month: 'all',
        dateFrom: resolvedFrom,
        dateTo: nextTo,
      };
    });
  }

  const activeChips: Array<{ id: string; label: string; onClear: () => void }> = [];
  if (hasDateFilter) {
    const labelText =
      filters.month !== 'all'
        ? formatMonthLabel(filters.month)
        : formatDateRangeLabel(dateFrom, dateTo);
    activeChips.push({
      id: 'date',
      label: `Tanggal: ${labelText}`,
      onClear: () =>
        onChangeFilters((prev) => ({ ...prev, month: 'all', dateFrom: '', dateTo: '' })),
    });
  }
  if (filters.region !== 'all') {
    activeChips.push({
      id: 'region',
      label: `Region: ${filters.region}`,
      onClear: () =>
        onChangeFilters((prev) => ({ ...prev, region: 'all', branch: 'all' })),
    });
  }
  if (province !== 'all') {
    activeChips.push({
      id: 'province',
      label: `Provinsi: ${province}`,
      onClear: () =>
        onChangeFilters((prev) => ({ ...prev, province: 'all', branch: 'all' })),
    });
  }
  if (branch !== 'all') {
    activeChips.push({
      id: 'branch',
      label: `Cabang: ${branch}`,
      onClear: () => onChangeFilters((prev) => ({ ...prev, branch: 'all' })),
    });
  }
  if (outletType !== 'all') {
    activeChips.push({
      id: 'outletType',
      label: `Tipe: ${outletType}`,
      onClear: () => onChangeFilters((prev) => ({ ...prev, outletType: 'all' })),
    });
  }
  if (filters.brand !== 'all') {
    activeChips.push({
      id: 'brand',
      label: `Brand: ${filters.brand}`,
      onClear: () => onChangeFilters((prev) => ({ ...prev, brand: 'all' })),
    });
  }
  if (filters.searchQuery.trim() !== '') {
    activeChips.push({
      id: 'search',
      label: `Cari: "${filters.searchQuery.trim()}"`,
      onClear: () => onChangeFilters((prev) => ({ ...prev, searchQuery: '' })),
    });
  }

  return (
    <section
      aria-label="Filter dan kontrol data"
      className="rounded-xl border border-slate-200 bg-white"
    >
      {/* Row 1: Dynamic Date Range & Quick Presets */}
      <div className="flex flex-col gap-3 rounded-t-xl border-b border-slate-100 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-sky-700" aria-hidden="true" />
            <span>Rentang Tanggal</span>
          </div>

          <div
            className={`inline-flex flex-wrap items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 transition-colors ${
              dateFrom || dateTo
                ? 'border-sky-500 ring-2 ring-sky-500/15'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <input
              id="filter-date-from"
              type="date"
              aria-label="Tanggal mulai"
              min={datasetDateBounds.min || undefined}
              max={datasetDateBounds.max || undefined}
              value={dateFrom}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="bg-transparent font-mono text-xs text-slate-800 focus:outline-none"
            />
            <span className="px-1 text-xs text-slate-400" aria-hidden="true">
              →
            </span>
            <input
              id="filter-date-to"
              type="date"
              aria-label="Tanggal selesai"
              min={dateFrom || datasetDateBounds.min || undefined}
              max={datasetDateBounds.max || undefined}
              value={dateTo}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="bg-transparent font-mono text-xs text-slate-800 focus:outline-none"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() =>
                  onChangeFilters((prev) => ({
                    ...prev,
                    month: 'all',
                    dateFrom: '',
                    dateTo: '',
                  }))
                }
                aria-label="Hapus filter rentang tanggal"
                className="ml-1 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {presets.length > 1 && (
          <div
            role="group"
            aria-label="Preset rentang tanggal cepat"
            className="flex flex-wrap items-center gap-1.5"
          >
            {presets.map((preset) => {
              const active = isPresetActive(preset);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  aria-pressed={active}
                  className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-sky-700 bg-sky-700 text-white shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Row 2: Searchable Dropdown Filters & Debounced Search */}
      <div className="grid grid-cols-1 gap-3 px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SearchableSelect
          id="filter-region"
          label="Region"
          value={filters.region}
          allLabel="Semua Region"
          options={availableRegions}
          searchPlaceholder="Cari region..."
          onChange={(nextRegion) =>
            onChangeFilters((f) => ({
              ...f,
              region: nextRegion,
              province: 'all',
              branch: 'all',
            }))
          }
        />

        <SearchableSelect
          id="filter-branch"
          label={`Cabang${filters.region !== 'all' ? ` (${availableBranches.length})` : ''}`}
          value={branch}
          allLabel="Semua Cabang"
          options={availableBranches}
          searchPlaceholder="Cari cabang..."
          onChange={(nextBranch) =>
            onChangeFilters((f) => ({ ...f, branch: nextBranch }))
          }
        />

        <SearchableSelect
          id="filter-outlet-type"
          label="Tipe Outlet"
          value={outletType}
          allLabel="Semua Tipe Outlet"
          options={availableOutletTypes}
          searchPlaceholder="Cari tipe outlet..."
          onChange={(nextType) =>
            onChangeFilters((f) => ({ ...f, outletType: nextType }))
          }
        />

        <SearchableSelect
          id="filter-brand"
          label="Brand"
          value={filters.brand}
          allLabel="Semua Brand"
          options={availableBrands}
          searchPlaceholder="Cari brand..."
          onChange={(nextBrand) =>
            onChangeFilters((f) => ({ ...f, brand: nextBrand }))
          }
        />

        <div>
          <label htmlFor="filter-search" className="block text-xs font-medium text-slate-600">
            Cari Outlet / SKU / Salesman
          </label>
          <div className="relative mt-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="filter-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nama outlet, SKU, salesman..."
              className={`w-full rounded-lg border bg-white py-2 pr-8 pl-9 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-sky-600 focus:outline-none ${
                searchInput.trim()
                  ? 'border-sky-500 ring-1 ring-sky-500/20'
                  : 'border-slate-300'
              }`}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  lastDispatchedSearchRef.current = '';
                  setSearchInput('');
                  onChangeFilters((f) => ({ ...f, searchQuery: '' }));
                }}
                aria-label="Hapus kata kunci pencarian"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Data Quality Toggles, Active Filter Chips & Reset */}
      <div className="flex flex-col gap-2.5 border-t border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={filters.deduplicateExact}
              onChange={(e) =>
                onChangeFilters((f) => ({ ...f, deduplicateExact: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <span>Hapus duplikat identik ({quality.exactDuplicateCount})</span>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeReturns}
              onChange={(e) =>
                onChangeFilters((f) => ({ ...f, includeReturns: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <span>Sertakan retur RTR ({quality.returnInvoiceCount} dokumen)</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeChips.length > 0 && (
            <div
              aria-label="Filter aktif"
              className="flex flex-wrap items-center gap-1.5"
            >
              <SlidersHorizontal
                className="mr-0.5 h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
              {activeChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900 transition-colors hover:bg-sky-100"
                >
                  <span>{chip.label}</span>
                  <X className="h-3 w-3 text-sky-700" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Reset Semua</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
