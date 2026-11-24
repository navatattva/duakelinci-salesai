import type {
  CleanedSalesRow,
  DataQualityReport,
  ParsedSalesDataset,
} from '../types/sales.ts';

const EXPECTED_HEADERS = [
  'date',
  'invoice_no',
  'region',
  'branch',
  'outlet_id',
  'outlet_name',
  'outlet_type',
  'salesman',
  'brand',
  'sku',
  'qty_carton',
  'price_per_carton_idr',
  'gross_sales_idr',
  'discount_idr',
  'net_sales_idr',
] as const;

const REGION_ALIASES: Record<string, string> = {
  jabodetabek: 'Jabodetabek',
  jabar: 'Jawa Barat',
  'jawa barat': 'Jawa Barat',
  jateng: 'Jawa Tengah',
  'jawa tengah': 'Jawa Tengah',
  jatim: 'Jawa Timur',
  'jawa timur': 'Jawa Timur',
  sumatera: 'Sumatera',
  sumatra: 'Sumatera',
  kalimantan: 'Kalimantan',
  sulawesi: 'Sulawesi',
  bali: 'Bali',
  'bali & nusa tenggara': 'Bali & Nusa Tenggara',
  nusra: 'Bali & Nusa Tenggara',
};

function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizeRegionName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Tidak Diketahui';
  const key = cleaned.toLowerCase();
  return REGION_ALIASES[key] ?? toTitleCase(cleaned);
}

function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/**
 * Detects delimiter from the header row outside double quotes.
 */
export function detectCsvDelimiter(headerLine: string): ',' | ';' | '\t' {
  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t'];
  let bestDelimiter: ',' | ';' | '\t' = ',';
  let bestCount = -1;

  for (const delimiter of candidates) {
    const fields = parseCsvLine(headerLine, delimiter);
    if (fields.length > bestCount) {
      bestCount = fields.length;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

/**
 * Splits a single CSV line handling double-quoted fields, escaped quotes, and custom delimiters.
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseNumeric(raw: string | undefined): number {
  if (!raw) return Number.NaN;
  const cleaned = stripControlChars(raw).trim().replace(/,/g, '');
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
}

export function parseSalesCsv(csvText: string): ParsedSalesDataset {
  const normalizedText = stripControlChars(csvText.replace(/^\uFEFF/, '')).trim();
  if (!normalizedText) {
    throw new Error('File CSV kosong. Pastikan file berisi header dan baris transaksi.');
  }

  const rawLines = normalizedText
    .split(/\r?\n|\r/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (rawLines.length < 2) {
    throw new Error('File CSV harus memiliki baris header dan minimal 1 baris data.');
  }

  const delimiter = detectCsvDelimiter(rawLines[0]);
  const headerFields = parseCsvLine(rawLines[0], delimiter).map((h) =>
    stripControlChars(h).trim().toLowerCase()
  );
  const headerIndexMap = new Map<string, number>();
  headerFields.forEach((h, idx) => {
    headerIndexMap.set(h, idx);
  });

  const missingHeaders = EXPECTED_HEADERS.filter((h) => !headerIndexMap.has(h));
  if (missingHeaders.length > 0) {
    throw new Error(
      `Format kolom CSV tidak sesuai. Kolom yang tidak ditemukan: ${missingHeaders.join(', ')}`
    );
  }

  const getVal = (fields: string[], key: (typeof EXPECTED_HEADERS)[number]): string => {
    const idx = headerIndexMap.get(key) ?? -1;
    return idx >= 0 && idx < fields.length ? fields[idx] : '';
  };

  const rows: CleanedSalesRow[] = [];
  const seenSignatures = new Set<string>();
  const aliasCounter = new Map<string, { raw: string; normalized: string; count: number }>();
  const duplicateSamples: DataQualityReport['duplicateSamples'] = [];
  const returnInvoiceSet = new Set<string>();

  let skippedInvalidRows = 0;
  let exactDuplicateCount = 0;
  let normalizedRegionCount = 0;
  let trimmedWhitespaceCount = 0;
  let missingSalesmanCount = 0;
  let returnLineCount = 0;
  let totalReturnNetIdr = 0;

  for (let i = 1; i < rawLines.length; i += 1) {
    const line = rawLines[i];
    const fields = parseCsvLine(line, delimiter);
    if (fields.length < EXPECTED_HEADERS.length) {
      skippedInvalidRows += 1;
      continue;
    }

    const rawDate = getVal(fields, 'date');
    const rawInvoiceNo = getVal(fields, 'invoice_no');
    const rawRegion = getVal(fields, 'region');
    const rawBranch = getVal(fields, 'branch');
    const rawOutletId = getVal(fields, 'outlet_id');
    const rawOutletName = getVal(fields, 'outlet_name');
    const rawOutletType = getVal(fields, 'outlet_type');
    const rawSalesman = getVal(fields, 'salesman');
    const rawBrand = getVal(fields, 'brand');
    const rawSku = getVal(fields, 'sku');

    const date = rawDate.trim();
    const invoice_no = rawInvoiceNo.trim();
    const normalizedRegion = normalizeRegionName(rawRegion);
    const branch = rawBranch.trim();
    const outlet_id = rawOutletId.trim();
    const outlet_name = rawOutletName.trim().replace(/\s+/g, ' ');
    const outlet_type = rawOutletType.trim();
    const trimmedSalesman = rawSalesman.trim();
    const salesman = trimmedSalesman || 'Belum Tercatat';
    const brand = rawBrand.trim();
    const sku = rawSku.trim();

    const qty_carton = parseNumeric(getVal(fields, 'qty_carton'));
    const price_per_carton_idr = parseNumeric(getVal(fields, 'price_per_carton_idr'));
    const gross_sales_idr = parseNumeric(getVal(fields, 'gross_sales_idr'));
    const discount_idr = parseNumeric(getVal(fields, 'discount_idr'));
    const net_sales_idr = parseNumeric(getVal(fields, 'net_sales_idr'));

    if (
      !date ||
      !invoice_no ||
      !outlet_id ||
      Number.isNaN(qty_carton) ||
      Number.isNaN(net_sales_idr)
    ) {
      skippedInvalidRows += 1;
      continue;
    }

    const wasRegionNormalized = rawRegion.trim() !== normalizedRegion;
    if (wasRegionNormalized) {
      normalizedRegionCount += 1;
      const aliasKey = `${rawRegion.trim()}->${normalizedRegion}`;
      const existing = aliasCounter.get(aliasKey);
      if (existing) {
        existing.count += 1;
      } else {
        aliasCounter.set(aliasKey, {
          raw: rawRegion.trim(),
          normalized: normalizedRegion,
          count: 1,
        });
      }
    }

    const wasWhitespaceTrimmed =
      rawOutletName !== outlet_name ||
      rawRegion !== rawRegion.trim() ||
      rawBranch !== branch ||
      rawBrand !== brand ||
      rawSku !== sku;
    if (wasWhitespaceTrimmed) {
      trimmedWhitespaceCount += 1;
    }

    const hasMissingSalesman = trimmedSalesman.length === 0;
    if (hasMissingSalesman) {
      missingSalesmanCount += 1;
    }

    const isReturn =
      invoice_no.toUpperCase().startsWith('RTR') || qty_carton < 0 || net_sales_idr < 0;

    const signature = [
      date,
      invoice_no,
      outlet_id,
      brand,
      sku,
      qty_carton,
      gross_sales_idr,
      discount_idr,
      net_sales_idr,
    ].join('|');

    const isExactDuplicate = seenSignatures.has(signature);
    seenSignatures.add(signature);

    if (isExactDuplicate) {
      exactDuplicateCount += 1;
      if (duplicateSamples.length < 15) {
        duplicateSamples.push({
          rowNumber: i + 1,
          invoice_no,
          outlet_name,
          sku,
          net_sales_idr,
        });
      }
    } else if (isReturn) {
      returnLineCount += 1;
      returnInvoiceSet.add(invoice_no);
      totalReturnNetIdr += net_sales_idr;
    }

    const monthKey = date.slice(0, 7);

    rows.push({
      rowNumber: i + 1,
      date,
      invoice_no,
      region: normalizedRegion,
      rawRegion,
      branch,
      outlet_id,
      outlet_name,
      rawOutletName,
      outlet_type,
      salesman,
      brand,
      sku,
      qty_carton,
      price_per_carton_idr: Number.isNaN(price_per_carton_idr) ? 0 : price_per_carton_idr,
      gross_sales_idr: Number.isNaN(gross_sales_idr) ? net_sales_idr : gross_sales_idr,
      discount_idr: Number.isNaN(discount_idr) ? 0 : discount_idr,
      net_sales_idr,
      monthKey,
      isReturn,
      isExactDuplicate,
      hasMissingSalesman,
      wasRegionNormalized,
      wasWhitespaceTrimmed,
    });
  }

  if (rows.length === 0) {
    throw new Error(
      'Tidak ada baris transaksi valid yang dapat dibaca dari file CSV.'
    );
  }

  const availableMonths = Array.from(new Set(rows.map((r) => r.monthKey))).sort();
  const availableRegions = Array.from(new Set(rows.map((r) => r.region))).sort();
  const availableBrands = Array.from(new Set(rows.map((r) => r.brand))).sort();

  return {
    rows,
    quality: {
      totalRawRows: rawLines.length - 1,
      validRows: rows.length,
      skippedInvalidRows,
      exactDuplicateCount,
      duplicateSamples,
      normalizedRegionCount,
      regionAliases: Array.from(aliasCounter.values()).sort((a, b) => b.count - a.count),
      trimmedWhitespaceCount,
      missingSalesmanCount,
      returnLineCount,
      returnInvoiceCount: returnInvoiceSet.size,
      totalReturnNetIdr,
    },
    availableMonths,
    availableRegions,
    availableBrands,
  };
}
