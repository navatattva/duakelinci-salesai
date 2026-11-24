import {
  AlertTriangle,
  GitFork,
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type DashboardViewId =
  | 'overview'
  | 'forecast'
  | 'flow'
  | 'outlets'
  | 'quality';

export interface SidebarNavItem {
  id: DashboardViewId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    id: 'overview',
    label: 'Dasbor Lengkap',
    description: 'Seluruh ringkasan & grafik',
    icon: LayoutDashboard,
  },
  {
    id: 'forecast',
    label: 'Tren & Forecast',
    description: 'Telegram & proyeksi bulanan',
    icon: TrendingUp,
  },
  {
    id: 'flow',
    label: 'Peta, Sankey & Region',
    description: 'Peta Indonesia, aliran & brand',
    icon: GitFork,
  },
  {
    id: 'outlets',
    label: '5 Outlet Terlemah',
    description: 'Prioritas tindak lanjut',
    icon: AlertTriangle,
  },
  {
    id: 'quality',
    label: 'Audit Kualitas Data',
    description: 'Normalisasi & duplikat CSV',
    icon: ShieldCheck,
  },
];

interface SidebarNavProps {
  activeView: DashboardViewId;
  onSelectView: (view: DashboardViewId) => void;
  sourceLabel: string;
  activeRowCount: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenUpload: () => void;
}

export function SidebarNav({
  activeView,
  onSelectView,
  sourceLabel,
  activeRowCount,
  isMobileOpen,
  onCloseMobile,
  onOpenUpload,
}: SidebarNavProps) {
  function handleSelect(view: DashboardViewId) {
    onSelectView(view);
    onCloseMobile();
  }

  const navContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
        <button
          type="button"
          onClick={() => handleSelect('overview')}
          className="text-left text-base font-bold tracking-tight text-slate-900 whitespace-nowrap"
        >
          Rekap Penjualan
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Tutup menu navigasi"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Menu utama dashboard" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {SIDEBAR_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? 'bg-sky-50 text-sky-900'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  isActive ? 'text-sky-700' : 'text-slate-400'
                }`}
                aria-hidden={true}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">
                  {item.label}
                </span>
                <span
                  className={`mt-0.5 block truncate text-[11px] ${
                    isActive ? 'text-sky-700/80' : 'text-slate-500'
                  }`}
                >
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-800">Dataset Aktif</p>
        <p className="mt-1 truncate text-xs text-slate-600" title={sourceLabel}>
          {sourceLabel}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
          {activeRowCount.toLocaleString('id-ID')} baris terfilter
        </p>

        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenUpload();
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Ganti / Unggah CSV</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200">
        {navContent}
      </aside>

      {/* Mobile slide-over sidebar */}
      {isMobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigasi dashboard"
          className="fixed inset-0 z-50 flex lg:hidden"
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] border-r border-slate-200 shadow-xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
