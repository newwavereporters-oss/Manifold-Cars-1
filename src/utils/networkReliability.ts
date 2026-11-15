// MANIFOLD WORLD — NETWORK RELIABILITY, TIMEOUTS, MUTEX LOCKS & BACKOFF HELPERS

export class RequestTimeoutError extends Error {
  public readonly isTimeout = true;
  constructor(label = 'Request', timeoutMs = 10000) {
    super(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * Wraps any PromiseLike (including Supabase PostgREST/RPC builders) with a deterministic timeout.
 * Always cleans up the timer once resolved or rejected.
 */
export async function withTimeout<T>(
  promiseOrBuilder: PromiseLike<T>,
  timeoutMs = 10000,
  label = 'Network request'
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = globalThis.setTimeout(() => {
        reject(new RequestTimeoutError(label, timeoutMs));
      }, timeoutMs);
    });
    return await Promise.race([Promise.resolve(promiseOrBuilder), timeoutPromise]);
  } finally {
    if (timerId !== undefined) {
      globalThis.clearTimeout(timerId);
    }
  }
}

/**
 * Retries transient failures with capped exponential backoff + jitter.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (err: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 450,
    maxDelayMs = 4000,
    shouldRetry = (err) => {
      if (err instanceof RequestTimeoutError) return true;
      const msg = String((err as any)?.message || err || '').toLowerCase();
      return (
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('timeout') ||
        msg.includes('temporarily') ||
        msg.includes('503') ||
        msg.includes('502')
      );
    },
  } = opts;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !shouldRetry(err)) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 160);
      const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1) + jitter);
      await new Promise((r) => globalThis.setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Prevents overlapping execution of periodic polling or heartbeat callbacks.
 */
export function createAsyncMutex() {
  let active = false;
  return {
    get isRunning() {
      return active;
    },
    async runIfIdle<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (active) return undefined;
      active = true;
      try {
        return await fn();
      } finally {
        active = false;
      }
    },
  };
}
