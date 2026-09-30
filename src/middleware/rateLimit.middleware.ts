import { NextFunction, Request, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Limita requisicoes por IP numa janela fixa. O contador fica em memoria,
 * o que basta enquanto o backend roda em uma unica instancia.
 */
export function createRateLimiter({ windowMs, max, message }: RateLimitOptions) {
  const windows = new Map<string, Window>();

  function purgeExpired(now: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) {
        windows.delete(key);
      }
    }
  }

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    let window = windows.get(key);

    if (!window || window.resetAt <= now) {
      if (windows.size > 10_000) {
        purgeExpired(now);
      }
      window = { count: 0, resetAt: now + windowMs };
      windows.set(key, window);
    }

    window.count += 1;

    if (window.count > max) {
      res.setHeader('Retry-After', Math.ceil((window.resetAt - now) / 1000).toString());
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}
