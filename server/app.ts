import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { getServerEnv } from './config/env.js';
import { dealersRouter } from './routes/dealers.js';
import { marketIntelligenceRouter } from './routes/marketIntelligence.js';
import { worldRouter } from './routes/world.js';
import { aiRouter } from './routes/ai.js';

export function createApp() {
  // Ensure server environment variables are loaded
  getServerEnv();

  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  app.use('/api/market-intelligence', marketIntelligenceRouter);
  app.use('/api/world', worldRouter);
  app.use('/api/dealers', dealersRouter);
  app.use('/api/ai', aiRouter);

  // Explicit 404 JSON handler for unmatched /api/* routes so API requests never fall through to SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Express error handler (malformed JSON bodies, unexpected middleware errors)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }

    if (res.headersSent) {
      next(err);
      return;
    }

    console.error('[MANIFOLD Server] Unhandled API error on', req.method, req.originalUrl, err);
    res.status(err?.status || 500).json({ error: 'Internal server error.' });
  });

  return app;
}

export const app = createApp();
