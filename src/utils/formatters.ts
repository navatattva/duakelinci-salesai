export function formatIDR(amount: number): string {
  const isNegative = amount < 0;
  const formatted = Math.round(Math.abs(amount)).toLocaleString('id-ID');
  return `${isNegative ? '-Rp ' : 'Rp '}${formatted}`;
}

export function formatCompactIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
  }
  return formatIDR(amount);
}

const FULL_MONTH_NAMES: Record<string, string> = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
};

const SHORT_MONTH_NAMES: Record<string, string> = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'Mei',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Agu',
  '09': 'Sep',
  '10': 'Okt',
  '11': 'Nov',
  '12': 'Des',
};

export function formatMonthLabel(monthKey: string): string {
  if (monthKey === 'all') return 'Semua Periode';
  const [year, month] = monthKey.split('-');
  return `${FULL_MONTH_NAMES[month] ?? month} ${year}`;
}

export function formatShortMonthLabel(monthKey: string): string {
  if (monthKey === 'all') return 'Semua';
  const [year, month] = monthKey.split('-');
  return `${SHORT_MONTH_NAMES[month] ?? month} ${year}`;
}
