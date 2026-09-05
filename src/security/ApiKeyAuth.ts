// ApiKeyAuth: a tiny API-key middleware factory. In development mode it can be
// disabled (SEED_AUTH=off). In production it expects X-API-Key to match a key in
// the allow-list.

import type { Request, Response, NextFunction } from 'express';

export interface ApiKeyAuthOptions {
  /** When false, every request is allowed (development mode). */
  enabled: boolean;
  /** Allowed keys; ignored when disabled. */
  validKeys: string[];
}

export function apiKeyAuth(opts: ApiKeyAuthOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!opts.enabled) {
      next();
      return;
    }
    const key = req.header('x-api-key');
    if (!key || !opts.validKeys.includes(key)) {
      res.status(401).json({ error: 'unauthorized', message: 'missing or invalid X-API-Key' });
      return;
    }
    next();
  };
}
