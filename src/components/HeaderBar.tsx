import { Menu, Upload } from 'lucide-react';

interface HeaderBarProps {
  activeViewLabel: string;
  onOpenMobileMenu: () => void;
  onOpenUpload: () => void;
}

export function HeaderBar({
  activeViewLabel,
  onOpenMobileMenu,
  onOpenUpload,
}: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Buka menu navigasi"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline whitespace-nowrap">
              Dashboard Penjualan
            </span>
            <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
              /
            </span>
            <span className="truncate font-semibold text-slate-900">
              {activeViewLabel}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:text-sm"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span>Unggah sales.csv</span>
        </button>
      </div>
    </header>
  );
}
