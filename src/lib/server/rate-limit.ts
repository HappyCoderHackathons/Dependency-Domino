export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RateLimiterOptions {
	/** Units allowed per key in each window */
	limit: number;
	windowMs: number;
	/** Keys tracked at once; expired and then oldest entries are dropped beyond this */
	maxKeys?: number;
}

/** Fixed-window limiter kept in memory. On serverless hosts each instance has its own counts. */
export function createRateLimiter({ limit, windowMs, maxKeys = 10_000 }: RateLimiterOptions) {
	const windows = new Map<string, { used: number; resetAt: number }>();

	function prune(now: number) {
		for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
		for (const key of windows.keys()) {
			if (windows.size <= maxKeys) break;
			windows.delete(key);
		}
	}

	return {
		check(key: string, cost = 1, now = Date.now()): RateLimitResult {
			let entry = windows.get(key);
			if (!entry || entry.resetAt <= now) {
				entry = { used: 0, resetAt: now + windowMs };
				windows.delete(key);
				windows.set(key, entry);
				if (windows.size > maxKeys) prune(now);
			}

			if (entry.used + cost > limit) {
				return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
			}
			entry.used += cost;
			return { ok: true };
		},
		clear() {
			windows.clear();
		},
		get size() {
			return windows.size;
		}
	};
}

export function tooManyRequests(retryAfterSeconds: number): Response {
	return Response.json(
		{ error: 'Too many requests. Try again shortly.' },
		{ status: 429, headers: { 'retry-after': String(retryAfterSeconds) } }
	);
}
