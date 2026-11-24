import path from 'node:path';

export interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  sqliteDbPath: string;
  publicCsvPath: string;
  distDir: string;
  jsonBodyLimit: string;
  pythonForecastBin: string;
  pythonForecastScriptPath: string;
  pythonForecastTimeoutMs: number;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const rawPort = Number(env.PORT || 3000);
  const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 3000;
  const nodeEnv =
    env.NODE_ENV === 'production'
      ? 'production'
      : env.NODE_ENV === 'test'
        ? 'test'
        : 'development';

  const rawDbPath = (env.SQLITE_DB_PATH || 'data/sales.sqlite').trim();
  const sqliteDbPath =
    rawDbPath === ':memory:' ? ':memory:' : path.resolve(process.cwd(), rawDbPath);

  const rawTimeout = Number(env.PYTHON_FORECAST_TIMEOUT_MS || 20000);
  const pythonForecastTimeoutMs =
    Number.isFinite(rawTimeout) && rawTimeout >= 2000 && rawTimeout <= 60000
      ? Math.round(rawTimeout)
      : 20000;

  return {
    port,
    nodeEnv,
    sqliteDbPath,
    publicCsvPath: path.resolve(process.cwd(), env.PUBLIC_CSV_PATH || 'public/sales.csv'),
    distDir: path.resolve(process.cwd(), 'dist'),
    jsonBodyLimit: '15mb',
    pythonForecastBin: (env.PYTHON_FORECAST_BIN || 'python3').trim() || 'python3',
    pythonForecastScriptPath: path.resolve(process.cwd(), 'scripts/forecast_worker.py'),
    pythonForecastTimeoutMs,
  };
}
