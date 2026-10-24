import { createRateLimiter } from '#lib/server/rate-limit.js';

/** Charged one unit per upstream chunk, so a 2000-package request costs 20. */
export const batchLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export const detailsLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
