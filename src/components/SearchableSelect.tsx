import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { filterSelectOptions } from '../utils/filterOptions';

interface SearchableSelectProps {
  id: string;
  label: string;
  value: string;
  allLabel: string;
  options: string[];
  searchPlaceholder?: string;
  debounceMs?: number;
  onChange: (value: string) => void;
}

export function SearchableSelect({
  id,
  label,
  value,
  allLabel,
  options,
  searchPlaceholder = 'Cari item...',
  debounceMs = 150,
  onChange,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const labelId = useId();
  const listboxId = useId();

  const debouncedSearch = useDebouncedValue(searchTerm, debounceMs);

  const visibleItems = useMemo(() => {
    const matched = filterSelectOptions(options, debouncedSearch);
    const normalizedQuery = debouncedSearch.trim().toLowerCase();
    const showAllItem =
      !normalizedQuery || allLabel.toLowerCase().includes(normalizedQuery);

    const list: Array<{ value: string; label: string }> = [];
    if (showAllItem) {
      list.push({ value: 'all', label: allLabel });
    }
    for (const opt of matched) {
      list.push({ value: opt, label: opt });
    }
    return list;
  }, [options, debouncedSearch, allLabel]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedSearch, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    function handleOutsidePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, [isOpen]);

  function selectOption(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        visibleItems.length > 0 ? (prev + 1) % visibleItems.length : 0
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        visibleItems.length > 0
          ? (prev - 1 + visibleItems.length) % visibleItems.length
          : 0
      );
      return;
    }

    if (event.key === 'Enter' && visibleItems.length > 0) {
      event.preventDefault();
      const chosen = visibleItems[highlightedIndex] ?? visibleItems[0];
      if (chosen) selectOption(chosen.value);
    }
  }

  const isFiltered = value !== 'all';
  const displayLabel = isFiltered ? value : allLabel;

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <label
        id={labelId}
        htmlFor={id}
        className="block text-xs font-medium text-slate-600"
      >
        {label}
      </label>

      <div className="relative mt-1">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white py-2 pl-3 text-left text-sm transition-colors focus:border-sky-600 focus:outline-none ${
            isFiltered
              ? 'border-sky-500 pr-14 font-medium text-slate-900 ring-1 ring-sky-500/20'
              : 'border-slate-300 pr-8 text-slate-800 hover:border-slate-400'
          }`}
        >
          <span className="truncate">{displayLabel}</span>
        </button>

        {isFiltered && (
          <button
            type="button"
            aria-label={`Hapus filter ${label}`}
            onClick={() => onChange('all')}
            className="absolute top-1/2 right-7 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}

        <ChevronDown
          className={`pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180 text-sky-700' : ''
          }`}
          aria-hidden="true"
        />

        {isOpen && (
          <div className="absolute right-0 left-0 z-40 mt-1.5 min-w-[220px] rounded-xl border border-slate-200 bg-white shadow-lg">
            {/* Search box inside dropdown */}
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-7 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Bersihkan pencarian dropdown"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Filtered options list */}
            <ul
              id={listboxId}
              role="listbox"
              aria-labelledby={labelId}
              className="max-h-56 overflow-y-auto py-1"
            >
              {visibleItems.length === 0 ? (
                <li className="px-3 py-3 text-center text-xs text-slate-500">
                  Tidak ada opsi yang cocok
                </li>
              ) : (
                visibleItems.map((item, idx) => {
                  const selected = item.value === value;
                  const highlighted = idx === highlightedIndex;
                  return (
                    <li
                      key={item.value}
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => selectOption(item.value)}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs transition-colors ${
                        selected
                          ? 'bg-sky-50 font-semibold text-sky-900'
                          : highlighted
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {selected && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-sky-700"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
