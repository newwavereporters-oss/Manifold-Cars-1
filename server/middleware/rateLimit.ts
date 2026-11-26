import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from './auth.js';

/**
 * In-memory sliding/fixed-window rate limiter for Express + Vercel serverless.
 * NOTE (Serverless Limitation): In distributed serverless environments (Vercel),
 * Map counters isolate per warm runtime instance rather than globally across all
 * edge/lambda containers. For strict cross-region burst enforcement at high scale,
 * swap this store adapter to Redis/Upstash while keeping the same middleware API.
 */

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

const MAX_TRACKED_KEYS = 5000;

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, BucketEntry>();

  const pruneExpired = (now: number) => {
    if (store.size < MAX_TRACKED_KEYS) return;
    for (const [k, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(k);
      }
    }
    if (store.size >= MAX_TRACKED_KEYS) {
      const oldestKey = store.keys().next().value;
      if (oldestKey) store.delete(oldestKey);
    }
  };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const now = Date.now();
    pruneExpired(now);

    const identity = req.auth?.user?.id
      ? `user:${req.auth.user.id}`
      : `ip:${getClientIp(req)}`;
    const bucketKey = `${options.keyPrefix}:${identity}`;

    let entry = store.get(bucketKey);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      store.set(bucketKey, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, options.maxRequests - entry.count);
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.maxRequests) {
      res.setHeader('Retry-After', String(resetSeconds));
      res.status(429).json({
        error:
          options.message ||
          'Too many requests. Please wait a moment before trying again.',
        code: 'RATE_LIMITED',
        retryAfterSeconds: resetSeconds,
      });
      return;
    }

    next();
  };
}

export const aiIngestionLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  keyPrefix: 'ai-ingest',
  message: 'AI extraction rate limit exceeded. Please wait before submitting more requests.',
});

export const chatModerationLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 45,
  keyPrefix: 'chat-mod',
  message: 'Chat rate limit reached. Please slow down briefly.',
});

export const standardApiLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: 'api-std',
});

export const aiHealthLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  keyPrefix: 'ai-health',
  message: 'Too many AI health or connection checks. Please wait briefly.',
});

export const dealerListingAiLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 25,
  keyPrefix: 'ai-listing',
  message: 'Listing generation rate limit reached. Please wait a moment.',
});

export const aiSearchLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 35,
  keyPrefix: 'ai-search',
  message: 'Vehicle search rate limit reached. Please wait before searching again.',
});

export const aiVoiceLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 12,
  keyPrefix: 'ai-voice',
  message: 'Voice transcription rate limit reached. Please try again or type your search.',
});

export const aiPricingLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  keyPrefix: 'ai-pricing',
  message: 'Price intelligence rate limit reached. Please try again shortly.',
});

export const aiAssistantLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 25,
  keyPrefix: 'ai-assistant',
  message: 'Automotive assistant rate limit reached. Please pause briefly.',
});

export const vehicleImageUploadLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  keyPrefix: 'vehicle-image-upload',
  message: 'Too many image upload requests. Please wait a moment before uploading again.',
});

