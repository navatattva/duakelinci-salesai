import { formatMonthLabel, formatShortMonthLabel } from './formatters';

export interface DateRangePreset {
  id: string;
  label: string;
  dateFrom: string;
  dateTo: string;
  month: string;
}

const SHORT_MONTHS: Record<string, string> = {
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

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function clampIsoDate(value: string, min: string, max: string): string {
  if (!value) return value;
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

export function formatIndonesianDateShort(isoDate: string): string {
  if (!isoDate || isoDate === '-') return '-';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${Number(day)} ${SHORT_MONTHS[month] ?? month} ${year}`;
}

export function formatDateRangeLabel(dateFrom: string, dateTo: string): string {
  if (!dateFrom && !dateTo) return 'Semua Tanggal';
  if (dateFrom && dateTo) {
    if (dateFrom === dateTo) return formatIndonesianDateShort(dateFrom);
    const [y1, m1, d1] = dateFrom.split('-');
    const [y2, m2, d2] = dateTo.split('-');
    if (y1 === y2 && m1 === m2) {
      return `${Number(d1)}–${Number(d2)} ${SHORT_MONTHS[m2] ?? m2} ${y2}`;
    }
    if (y1 === y2) {
      return `${Number(d1)} ${SHORT_MONTHS[m1] ?? m1}–${Number(d2)} ${SHORT_MONTHS[m2] ?? m2} ${y2}`;
    }
    return `${formatIndonesianDateShort(dateFrom)}–${formatIndonesianDateShort(dateTo)}`;
  }
  if (dateFrom) return `Mulai ${formatIndonesianDateShort(dateFrom)}`;
  return `S/d ${formatIndonesianDateShort(dateTo)}`;
}

export function getMonthDateBounds(
  monthKey: string,
  minDate: string,
  maxDate: string
): { from: string; to: string } {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-${String(lastDayOfMonth).padStart(2, '0')}`;

  return {
    from: minDate && monthStart < minDate ? minDate : monthStart,
    to: maxDate && monthEnd > maxDate ? maxDate : monthEnd,
  };
}

export function buildDateRangePresets(
  minDate: string,
  maxDate: string,
  availableMonths: string[]
): DateRangePreset[] {
  if (!minDate || !maxDate || minDate === '-' || maxDate === '-') {
    return [];
  }

  const presets: DateRangePreset[] = [
    {
      id: 'all',
      label: 'Semua Tanggal',
      dateFrom: '',
      dateTo: '',
      month: 'all',
    },
  ];

  // Relative rolling presets anchored at the dataset's latest date
  if (minDate !== maxDate) {
    const last7Start = clampIsoDate(shiftIsoDate(maxDate, -6), minDate, maxDate);
    if (last7Start > minDate) {
      presets.push({
        id: 'last-7d',
        label: '7 Hari Terakhir',
        dateFrom: last7Start,
        dateTo: maxDate,
        month: 'all',
      });
    }

    const last14Start = clampIsoDate(shiftIsoDate(maxDate, -13), minDate, maxDate);
    if (last14Start > minDate) {
      presets.push({
        id: 'last-14d',
        label: '14 Hari Terakhir',
        dateFrom: last14Start,
        dateTo: maxDate,
        month: 'all',
      });
    }

    const last30Start = clampIsoDate(shiftIsoDate(maxDate, -29), minDate, maxDate);
    if (last30Start > minDate) {
      presets.push({
        id: 'last-30d',
        label: '30 Hari Terakhir',
        dateFrom: last30Start,
        dateTo: maxDate,
        month: 'all',
      });
    }
  }

  if (availableMonths.length > 1) {
    for (const monthKey of availableMonths) {
      const bounds = getMonthDateBounds(monthKey, minDate, maxDate);
      presets.push({
        id: `month-${monthKey}`,
        label: formatShortMonthLabel(monthKey),
        dateFrom: bounds.from,
        dateTo: bounds.to,
        month: monthKey,
      });
    }
  } else if (availableMonths.length === 1) {
    const onlyMonth = availableMonths[0];
    const bounds = getMonthDateBounds(onlyMonth, minDate, maxDate);
    if (bounds.from !== minDate || bounds.to !== maxDate) {
      presets.push({
        id: `month-${onlyMonth}`,
        label: formatMonthLabel(onlyMonth),
        dateFrom: bounds.from,
        dateTo: bounds.to,
        month: onlyMonth,
      });
    }
  }

  return presets;
}
