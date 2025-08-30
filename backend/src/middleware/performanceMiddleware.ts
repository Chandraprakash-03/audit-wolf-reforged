import { Request, Response, NextFunction } from "express";
import { performanceMonitoringService } from "../services/PerformanceMonitoringService";
import { cacheService } from "../services/CacheService";
import { redis } from "../config/queue";

export interface PerformanceRequest extends Request {
	startTime?: number;
	cacheHit?: boolean;
	user?: {
		id: string;
		email: string;
		role?: string;
	};
}

/**
 * Middleware to track API performance metrics
 */
export const performanceTrackingMiddleware = (
	req: PerformanceRequest,
	res: Response,
	next: NextFunction
): void => {
	req.startTime = Date.now();

	// Override res.end to capture response time
	const originalEnd = res.end;
	res.end = function (chunk?: any, encoding?: any): Response {
		const responseTime = Date.now() - (req.startTime || Date.now());
		const endpoint = `${req.method} ${req.route?.path || req.path}`;

		// Record response time
		performanceMonitoringService.recordResponseTime(responseTime, endpoint);

		// Record cache hit/miss if applicable
		if (req.cacheHit !== undefined) {
			if (req.cacheHit) {
				cacheService.trackCacheHit();
			} else {
				cacheService.trackCacheMiss();
			}
		}

		// Record status code metrics
		performanceMonitoringService.recordMetric(
			"api.status_code",
			res.statusCode,
			{ endpoint, status: res.statusCode.toString() }
		);

		return originalEnd.call(this, chunk, encoding);
	};

	next();
};

/**
 * Middleware to handle errors and track error metrics
 */
export const errorTrackingMiddleware = (
	error: Error,
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const endpoint = `${req.method} ${req.route?.path || req.path}`;

	// Record error
	performanceMonitoringService.recordError(error, endpoint);

	// Log error details
	console.error(`Error in ${endpoint}:`, {
		message: error.message,
		stack: error.stack,
		timestamp: new Date().toISOString(),
	});

	// Send error response
	res.status(500).json({
		error: "Internal Server Error",
		message:
			process.env.NODE_ENV === "development"
				? error.message
				: "Something went wrong",
	});
};

/**
 * Middleware to implement caching for GET requests
 */
export const cacheMiddleware = (ttl: number = 300) => {
	return async (
		req: PerformanceRequest,
		res: Response,
		next: NextFunction
	): Promise<void> => {
		// Only cache GET requests
		if (req.method !== "GET") {
			return next();
		}

		const cacheKey = `api:${req.originalUrl}:${req.user?.id || "anonymous"}`;

		try {
			// Try to get from cache
			const cached = await redis.get(cacheKey);

			if (cached) {
				req.cacheHit = true;
				const cachedData = JSON.parse(cached);

				// Set cache headers
				res.set("X-Cache", "HIT");
				res.set("Cache-Control", `public, max-age=${ttl}`);

				res.json(cachedData);
				return;
			}

			req.cacheHit = false;

			// Override res.json to cache the response
			const originalJson = res.json;
			res.json = function (data: any): Response {
				// Cache successful responses
				if (res.statusCode >= 200 && res.statusCode < 300) {
					redis
						.setex(cacheKey, ttl, JSON.stringify(data))
						.catch((error: any) =>
							console.error("Error caching response:", error)
						);
				}

				// Set cache headers
				res.set("X-Cache", "MISS");
				res.set("Cache-Control", `public, max-age=${ttl}`);

				return originalJson.call(this, data);
			};

			next();
		} catch (error) {
			console.error("Error in cache middleware:", error);
			req.cacheHit = false;
			next();
		}
	};
};

/**
 * Middleware to track memory usage for specific endpoints
 */
export const memoryTrackingMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const initialMemory = process.memoryUsage();

	// Override res.end to capture memory usage
	const originalEnd = res.end;
	res.end = function (chunk?: any, encoding?: any): Response {
		const finalMemory = process.memoryUsage();
		const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
		const endpoint = `${req.method} ${req.route?.path || req.path}`;

		// Record memory usage delta
		performanceMonitoringService.recordMetric(
			"api.memory_delta",
			memoryDelta,
			{ endpoint },
			"bytes"
		);

		return originalEnd.call(this, chunk, encoding);
	};

	next();
};

/**
 * Middleware to implement rate limiting with performance tracking
 */
export const rateLimitMiddleware = (
	maxRequests: number = 100,
	windowMs: number = 60000
) => {
	const requestCounts = new Map<string, { count: number; resetTime: number }>();

	return (req: Request, res: Response, next: NextFunction): void => {
		const clientId = req.ip || "unknown";
		const now = Date.now();
		const windowStart = now - windowMs;

		// Clean up old entries
		for (const [key, data] of requestCounts.entries()) {
			if (data.resetTime < windowStart) {
				requestCounts.delete(key);
			}
		}

		// Get or create client data
		let clientData = requestCounts.get(clientId);
		if (!clientData || clientData.resetTime < windowStart) {
			clientData = { count: 0, resetTime: now + windowMs };
			requestCounts.set(clientId, clientData);
		}

		clientData.count++;

		// Check rate limit
		if (clientData.count > maxRequests) {
			performanceMonitoringService.recordMetric("api.rate_limit_exceeded", 1, {
				client_id: clientId,
			});

			res.status(429).json({
				error: "Too Many Requests",
				message: `Rate limit exceeded. Max ${maxRequests} requests per ${
					windowMs / 1000
				} seconds.`,
				retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
			});
			return;
		}

		// Add rate limit headers
		res.set({
			"X-RateLimit-Limit": maxRequests.toString(),
			"X-RateLimit-Remaining": (maxRequests - clientData.count).toString(),
			"X-RateLimit-Reset": Math.ceil(clientData.resetTime / 1000).toString(),
		});

		next();
	};
};

/**
 * Middleware to compress responses for better performance
 */
export const compressionMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	// Check if client accepts compression
	const acceptEncoding = req.headers["accept-encoding"] || "";

	if (acceptEncoding.includes("gzip")) {
		res.set("Content-Encoding", "gzip");

		// Override res.json to track compression savings
		const originalJson = res.json;
		res.json = function (data: any): Response {
			const originalSize = JSON.stringify(data).length;

			performanceMonitoringService.recordMetric(
				"api.response_size",
				originalSize,
				{ endpoint: `${req.method} ${req.path}`, compressed: "true" },
				"bytes"
			);

			return originalJson.call(this, data);
		};
	}

	next();
};
