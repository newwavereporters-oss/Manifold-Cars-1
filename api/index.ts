import type { IncomingMessage, ServerResponse } from 'http';
import { app } from './_server.mjs';

function normalizeVercelRequestUrl(req: IncomingMessage): void {
  const rawUrl = req.url || '/api';
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const routeParam = parsed.searchParams.get('__route');

    if (routeParam !== null) {
      parsed.searchParams.delete('__route');
      const query = parsed.searchParams.toString();
      if (
        parsed.pathname === '/api/index' ||
        parsed.pathname === '/api/index.ts' ||
        parsed.pathname === '/api/index.mjs' ||
        parsed.pathname === '/api' ||
        parsed.pathname === '/api/'
      ) {
        const cleanRoute = routeParam.replace(/^\/+/, '');
        req.url = `/api/${cleanRoute}${query ? `?${query}` : ''}`;
      } else {
        req.url = `${parsed.pathname}${query ? `?${query}` : ''}`;
      }
    }
  } catch {
    // Keep req.url unchanged if URL parsing fails
  }
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  normalizeVercelRequestUrl(req);
  return app(req as any, res as any);
}
