import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type PythonEngineChoice = 'auto' | 'statsmodels' | 'autogluon' | 'builtin';

export interface DailySeriesInputPoint {
  date: string;
  netSalesIdr: number;
  qtyCarton: number;
  invoiceCount: number;
}

export interface PythonDailyChartPoint {
  date: string;
  isForecast: boolean;
  actualNetSalesIdr: number | null;
  forecastNetSalesIdr: number | null;
  forecastRange: [number, number] | null;
  lowIdr: number | null;
  highIdr: number | null;
}

export interface PythonProjectedMonth {
  monthKey: string;
  projectedNetSalesIdr: number;
  lowIdr: number;
  highIdr: number;
  projectedCartons: number;
}

export interface PythonForecastDiagnostics {
  mapePct: number | null;
  peakWeekday: string;
  peakDeltaPct: number;
  lowWeekday: string;
  lowDeltaPct: number;
}

export interface PythonForecastWorkerResult {
  ok: true;
  engineUsed: string;
  engineLabel: string;
  availableEngines: {
    builtin: boolean;
    statsmodels: boolean;
    autogluon: boolean;
  };
  executionMs: number;
  sampleDays: number;
  diagnostics: PythonForecastDiagnostics | null;
  dailyPoints: PythonDailyChartPoint[];
  projectedMonths: PythonProjectedMonth[];
}

export interface RunPythonForecastOptions {
  pythonBin: string;
  scriptPath: string;
  timeoutMs: number;
  dailySeries: DailySeriesInputPoint[];
  horizonMonths: 1 | 2 | 3;
  preferredEngine: PythonEngineChoice;
}

const MAX_STDIO_BYTES = 2 * 1024 * 1024;

export async function runPythonForecastWorker(
  options: RunPythonForecastOptions
): Promise<PythonForecastWorkerResult> {
  const workspaceRoot = path.resolve(process.cwd());
  const resolvedScript = path.resolve(options.scriptPath);

  if (!resolvedScript.startsWith(workspaceRoot + path.sep)) {
    throw new Error('Lokasi script forecast Python tidak diizinkan.');
  }
  if (!fs.existsSync(resolvedScript)) {
    throw new Error('Script forecast Python tidak ditemukan di server.');
  }

  const inputJson = JSON.stringify({
    dailySeries: options.dailySeries,
    horizonMonths: options.horizonMonths,
    preferredEngine: options.preferredEngine,
  });

  return new Promise<PythonForecastWorkerResult>((resolve, reject) => {
    const child = spawn(options.pythonBin, [resolvedScript], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1',
      },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finishError = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finishError(new Error('Eksekusi forecast Python melebihi batas waktu.'));
    }, options.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length + chunk.length > MAX_STDIO_BYTES) {
        child.kill('SIGKILL');
        finishError(new Error('Output forecast Python terlalu besar.'));
        return;
      }
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length + chunk.length <= 16_384) {
        stderr += chunk.toString('utf8');
      }
    });

    child.on('error', (err) => {
      finishError(new Error(`Gagal menjalankan runtime Python CLI: ${err.message}`));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        const errHint = stderr.trim().slice(0, 180);
        reject(
          new Error(
            errHint
              ? `Output Python CLI tidak valid (exit ${code}): ${errHint}`
              : `Output Python CLI tidak valid (exit ${code}).`
          )
        );
        return;
      }

      if (!parsed || typeof parsed !== 'object' || !(parsed as { ok?: boolean }).ok) {
        const msg =
          typeof (parsed as { error?: unknown })?.error === 'string'
            ? (parsed as { error: string }).error
            : 'Worker Python gagal menghitung forecast.';
        reject(new Error(msg));
        return;
      }

      resolve(parsed as PythonForecastWorkerResult);
    });

    child.stdin.on('error', () => {
      // Handled via child close/error events
    });
    child.stdin.end(inputJson);
  });
}
