import express, { type Express, type RequestHandler } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { ServerConfig } from './config.ts';
import { createSalesRouter } from './routes/salesRoutes.ts';
import type { SalesSqliteStore } from './salesDb.ts';

export interface CreateAppOptions {
  store: SalesSqliteStore;
  config: ServerConfig;
  frontendMiddleware?: RequestHandler;
}

export function createExpressApp({
  store,
  config,
  frontendMiddleware,
}: CreateAppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use('/api', createSalesRouter(store, config));

  if (frontendMiddleware) {
    app.use(frontendMiddleware);
  } else if (config.nodeEnv === 'production') {
    const resolvedDist = path.resolve(config.distDir);
    app.use(express.static(resolvedDist));
    app.get('/{*splat}', (_req, res) => {
      const indexHtml = path.resolve(resolvedDist, 'index.html');
      if (indexHtml.startsWith(resolvedDist + path.sep) && fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  return app;
}
