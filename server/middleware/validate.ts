import type { NextFunction, Request, Response } from 'express';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateFetchUrlBody(req: Request, res: Response, next: NextFunction): void {
  if (!isPlainObject(req.body)) {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return;
  }

  const { url } = req.body;
  if (typeof url !== 'string' || !url.trim()) {
    res.status(400).json({ error: 'Valid URL is required.' });
    return;
  }

  const trimmed = url.trim();
  if (trimmed.length > 2048) {
    res.status(400).json({ error: 'URL exceeds maximum length of 2048 characters.' });
    return;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      res.status(400).json({ error: 'Only HTTP and HTTPS URLs are permitted.' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Invalid URL format.' });
    return;
  }

  req.body.url = trimmed;
  next();
}

export function validateExtractTextBody(req: Request, res: Response, next: NextFunction): void {
  if (!isPlainObject(req.body)) {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return;
  }

  const { text, sourceUrl, publisher } = req.body;
  if (typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'Text content is required for extraction.' });
    return;
  }

  const trimmedText = text.trim();
  if (trimmedText.length < 10) {
    res.status(400).json({ error: 'Text content must be at least 10 characters.' });
    return;
  }
  if (trimmedText.length > 60000) {
    res.status(400).json({ error: 'Text content exceeds maximum limit of 60,000 characters.' });
    return;
  }

  if (sourceUrl !== undefined && sourceUrl !== null && typeof sourceUrl !== 'string') {
    res.status(400).json({ error: 'sourceUrl must be a string if provided.' });
    return;
  }
  if (typeof sourceUrl === 'string' && sourceUrl.length > 2048) {
    res.status(400).json({ error: 'sourceUrl exceeds maximum length of 2048 characters.' });
    return;
  }

  if (publisher !== undefined && publisher !== null && typeof publisher !== 'string') {
    res.status(400).json({ error: 'publisher must be a string if provided.' });
    return;
  }
  if (typeof publisher === 'string' && publisher.length > 200) {
    res.status(400).json({ error: 'publisher exceeds maximum length of 200 characters.' });
    return;
  }

  req.body.text = trimmedText;
  next();
}

export function validateEmbedBody(req: Request, res: Response, next: NextFunction): void {
  if (!isPlainObject(req.body)) {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return;
  }

  const { text } = req.body;
  if (typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'Text is required for embedding generation.' });
    return;
  }

  const trimmed = text.trim();
  if (trimmed.length > 20000) {
    res.status(400).json({ error: 'Text exceeds maximum embedding input length of 20,000 characters.' });
    return;
  }

  req.body.text = trimmed;
  next();
}

export function validateSearchKnowledgeBody(req: Request, res: Response, next: NextFunction): void {
  if (!isPlainObject(req.body)) {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return;
  }

  const { query, limit } = req.body;
  if (typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'Search query is required.' });
    return;
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 300) {
    res.status(400).json({ error: 'Search query exceeds maximum length of 300 characters.' });
    return;
  }

  let parsedLimit = 5;
  if (limit !== undefined) {
    const num = Number(limit);
    if (!Number.isInteger(num) || num < 1 || num > 25) {
      res.status(400).json({ error: 'limit must be an integer between 1 and 25.' });
      return;
    }
    parsedLimit = num;
  }

  req.body.query = trimmedQuery;
  req.body.limit = parsedLimit;
  next();
}

export function validateModerateChatBody(req: Request, res: Response, next: NextFunction): void {
  if (!isPlainObject(req.body)) {
    res.status(400).json({
      allowed: false,
      severity: 'block',
      action: 'block',
      reason: 'Invalid request payload.',
    });
    return;
  }

  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    res.status(400).json({
      allowed: false,
      severity: 'block',
      action: 'block',
      reason: 'Empty message.',
    });
    return;
  }

  next();
}
