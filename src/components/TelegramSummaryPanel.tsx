import { Check, Copy, ListChecks, Send } from 'lucide-react';
import { useState } from 'react';
import type { DashboardSummary, DataQualityReport, SalesFilters } from '../types/sales';
import type { ForecastMonthSummary } from '../utils/salesForecast';
import { generateTelegramSummary } from '../utils/telegramSummary';

interface TelegramSummaryPanelProps {
  summary: DashboardSummary;
  filters: SalesFilters;
  quality: DataQualityReport;
  nextMonthForecast?: ForecastMonthSummary | null;
}

type SummaryViewMode = 'structured' | 'paragraph';

export function TelegramSummaryPanel({
  summary,
  filters,
  quality,
  nextMonthForecast,
}: TelegramSummaryPanelProps) {
  const [viewMode, setViewMode] = useState<SummaryViewMode>('structured');
  const [compactNumbers, setCompactNumbers] = useState(false);
  const [includeForecast, setIncludeForecast] = useState(false);
  const [copied, setCopied] = useState(false);

  const telegramSummary = generateTelegramSummary(summary, filters, quality, {
    compactNumbers,
    nextMonthForecast: includeForecast ? nextMonthForecast : null,
  });

  const textToCopy =
    viewMode === 'structured'
      ? telegramSummary.formattedMessage
      : telegramSummary.paragraph;

  async function handleCopy() {
    let success = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        success = true;
      } catch {
        success = false;
      }
    }

    if (!success) {
      try {
        const el = document.createElement('textarea');
        el.value = textToCopy;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.top = '0';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.focus();
        el.select();
        success = document.execCommand('copy');
        document.body.removeChild(el);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  }

  return (
    <section
      id="ringkasan"
      aria-labelledby="telegram-summary-heading"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
            <h2
              id="telegram-summary-heading"
              className="text-base font-semibold text-slate-900"
            >
              Ringkasan Eksekutif untuk Telegram
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Siap disalin dan dikirim langsung ke Sales Manager ·{' '}
            <span className="whitespace-nowrap font-mono tabular-nums">
              {textToCopy.length.toLocaleString('id-ID')} karakter
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          data-testid="copy-telegram-btn"
          className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>Salin Ringkasan Telegram</span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Tampilan ringkasan"
            className="inline-flex rounded-lg border border-slate-200 bg-slate-100/70 p-0.5"
          >
            <button
              type="button"
              onClick={() => setViewMode('structured')}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'structured'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              List &amp; Deskripsi
            </button>
            <button
              type="button"
              onClick={() => setViewMode('paragraph')}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'paragraph'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Satu Paragraf
            </button>
          </div>

          <div
            role="group"
            aria-label="Format angka ringkasan"
            className="inline-flex rounded-lg border border-slate-200 bg-slate-100/70 p-0.5"
          >
            <button
              type="button"
              onClick={() => setCompactNumbers(false)}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                !compactNumbers
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nominal Penuh
            </button>
            <button
              type="button"
              onClick={() => setCompactNumbers(true)}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                compactNumbers
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ringkas (Jt/M)
            </button>
          </div>
        </div>

        {nextMonthForecast && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={includeForecast}
              onChange={(e) => setIncludeForecast(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <span>Sertakan proyeksi {nextMonthForecast.monthLabel}</span>
          </label>
        )}
      </div>

      <div className="px-5 py-5">
        {viewMode === 'paragraph' ? (
          <p
            data-testid="telegram-paragraph"
            className="max-w-none text-[15px] leading-relaxed text-slate-800"
          >
            {telegramSummary.paragraph}
          </p>
        ) : (
          <div data-testid="telegram-structured" className="space-y-4">
            {/* Short Description Callout */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/75 px-4 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                {telegramSummary.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">
                {telegramSummary.shortDesc}
              </p>
            </div>

            {/* Structured Two-Column Lists */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Left: Performance Highlights List */}
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <ListChecks className="h-4 w-4 text-sky-700" aria-hidden="true" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Sorotan Performa
                  </h3>
                </div>
                <ul className="divide-y divide-slate-100">
                  {telegramSummary.highlights.map((item) => (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-600">
                          {item.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                          {item.value}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {item.shortDesc}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: Weakest 5 Outlets Priority List */}
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    {telegramSummary.weakestOutlets.length} Outlet Terlemah · Tindak Lanjut
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500">
                    Urutan net sales terendah
                  </span>
                </div>
                <ol className="divide-y divide-slate-100">
                  {telegramSummary.weakestOutlets.map((outlet) => (
                    <li
                      key={outlet.outletId}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
                        {outlet.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {outlet.outletName}
                          </span>
                          <span className="font-mono text-xs font-semibold text-rose-700 tabular-nums">
                            {outlet.netSalesText}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                          {outlet.shortDesc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
