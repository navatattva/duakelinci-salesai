import 'dotenv/config';
import type { RequestHandler } from 'express';
import { createExpressApp } from './server/app.ts';
import { loadServerConfig } from './server/config.ts';
import { SalesSqliteStore } from './server/salesDb.ts';

async function startServer(): Promise<void> {
  const config = loadServerConfig();
  const store = new SalesSqliteStore({
    dbPath: config.sqliteDbPath,
    publicCsvPath: config.publicCsvPath,
  });

  let frontendMiddleware: RequestHandler | undefined;
  if (config.nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    frontendMiddleware = vite.middlewares;
  }

  const app = createExpressApp({ store, config, frontendMiddleware });
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `Sales Dashboard listening on http://0.0.0.0:${config.port} (SQLite: ${config.sqliteDbPath})`
    );
  });

  const shutdown = () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
