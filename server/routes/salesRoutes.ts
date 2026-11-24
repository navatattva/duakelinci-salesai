import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { loadServerConfig, type ServerConfig } from '../config.ts';
import type { SalesSqliteStore } from '../salesDb.ts';
import {
  runPythonForecastWorker,
  type PythonEngineChoice,
} from '../services/pythonForecastRunner.ts';

interface ImportCsvRequestBody {
  csvText: string;
  sourceLabel: string;
}

interface PythonForecastRequestBody {
  horizonMonths: 1 | 2 | 3;
  preferredEngine: PythonEngineChoice;
  forceRefresh: boolean;
  filters: {
    region: string;
    province?: string;
    branch: string;
    outletType: string;
    brand: string;
    searchQuery: string;
    deduplicateExact: boolean;
    includeReturns: boolean;
  };
}

function parseImportBody(
  raw: unknown
): { ok: true; data: ImportCsvRequestBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Payload permintaan tidak valid.' };
  }

  const record = raw as Record<string, unknown>;
  if (typeof record.csvText !== 'string' || record.csvText.trim().length === 0) {
    return { ok: false, error: 'Konten CSV tidak boleh kosong.' };
  }

  const rawLabel = typeof record.sourceLabel === 'string' ? record.sourceLabel.trim() : '';
  const sanitizedLabel = rawLabel.replace(/[\r\n\t]+/g, ' ').slice(0, 120) || 'sales.csv';

  return {
    ok: true,
    data: {
      csvText: record.csvText,
      sourceLabel: sanitizedLabel,
    },
  };
}

function sanitizeFilterString(value: unknown, fallback: string, maxLen = 120): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().slice(0, maxLen);
  return cleaned || fallback;
}

function parsePythonForecastBody(
  raw: unknown
): { ok: true; data: PythonForecastRequestBody } | { ok: false; error: string } {
  if (raw !== undefined && (typeof raw !== 'object' || raw === null || Array.isArray(raw))) {
    return { ok: false, error: 'Payload forecast Python tidak valid.' };
  }

  const record = (raw ?? {}) as Record<string, unknown>;
  const rawHorizon = record.horizonMonths ?? 2;
  if (rawHorizon !== 1 && rawHorizon !== 2 && rawHorizon !== 3) {
    return { ok: false, error: 'Horizon forecast harus bernilai 1, 2, atau 3 bulan.' };
  }

  const rawEngine = record.preferredEngine ?? 'auto';
  if (
    rawEngine !== 'auto' &&
    rawEngine !== 'statsmodels' &&
    rawEngine !== 'autogluon' &&
    rawEngine !== 'builtin'
  ) {
    return { ok: false, error: 'Pilihan engine forecast Python tidak dikenali.' };
  }

  const rawFilters =
    record.filters && typeof record.filters === 'object' && !Array.isArray(record.filters)
      ? (record.filters as Record<string, unknown>)
      : {};

  return {
    ok: true,
    data: {
      horizonMonths: rawHorizon,
      preferredEngine: rawEngine,
      forceRefresh: Boolean(record.forceRefresh),
      filters: {
        region: sanitizeFilterString(rawFilters.region, 'all'),
        province: sanitizeFilterString(rawFilters.province, 'all'),
        branch: sanitizeFilterString(rawFilters.branch, 'all'),
        outletType: sanitizeFilterString(rawFilters.outletType, 'all'),
        brand: sanitizeFilterString(rawFilters.brand, 'all'),
        searchQuery:
          typeof rawFilters.searchQuery === 'string'
            ? rawFilters.searchQuery.trim().slice(0, 120)
            : '',
        deduplicateExact:
          typeof rawFilters.deduplicateExact === 'boolean' ? rawFilters.deduplicateExact : true,
        includeReturns:
          typeof rawFilters.includeReturns === 'boolean' ? rawFilters.includeReturns : true,
      },
    },
  };
}

export function createSalesRouter(
  store: SalesSqliteStore,
  config: ServerConfig = loadServerConfig()
): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    try {
      const current = store.getPersistedDataset();
      res.json({
        status: 'ok',
        rowsCount: current.dataset.rows.length,
        sourceLabel: current.sourceLabel,
      });
    } catch {
      res.status(500).json({ status: 'error' });
    }
  });

  router.get('/sales', (_req: Request, res: Response) => {
    try {
      res.json(store.getPersistedDataset());
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal membaca data dari SQLite.',
      });
    }
  });

  router.post('/sales/import', (req: Request, res: Response) => {
    const validation = parseImportBody(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const payload = store.importCsv(validation.data.csvText, validation.data.sourceLabel);
      res.json(payload);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Format CSV tidak valid.',
      });
    }
  });

  router.post('/sales/reset', (_req: Request, res: Response) => {
    try {
      res.json(store.resetToDefault());
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mereset database SQLite.',
      });
    }
  });

  router.post('/forecast/python', async (req: Request, res: Response) => {
    const validation = parsePythonForecastBody(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    try {
      const { horizonMonths, preferredEngine, forceRefresh, filters } = validation.data;
      const meta = store.getDatasetMeta();
      const cacheKey = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            updatedAt: meta.updatedAt,
            horizonMonths,
            preferredEngine,
            filters,
          })
        )
        .digest('hex');

      if (!forceRefresh) {
        const cachedJson = store.getCachedForecast(cacheKey);
        if (cachedJson) {
          const cachedPayload = JSON.parse(cachedJson) as Record<string, unknown>;
          res.json({
            ...cachedPayload,
            fromCache: true,
          });
          return;
        }
      }

      const dailySeries = store.getDailySeriesForForecast(filters);
      const result = await runPythonForecastWorker({
        pythonBin: config.pythonForecastBin,
        scriptPath: config.pythonForecastScriptPath,
        timeoutMs: config.pythonForecastTimeoutMs,
        dailySeries,
        horizonMonths,
        preferredEngine,
      });

      store.saveCachedForecast(cacheKey, result.engineUsed, JSON.stringify(result));
      res.json({
        ...result,
        fromCache: false,
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Gagal menjalankan worker forecast Python CLI.',
      });
    }
  });

  return router;
}
