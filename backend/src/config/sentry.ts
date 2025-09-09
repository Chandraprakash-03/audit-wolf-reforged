import * as Sentry from "@sentry/node";
import { logger } from "../utils/logger";

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initializeSentry(): void {
	if (!process.env.SENTRY_DSN) {
		logger.warn("Sentry DSN not configured, error tracking disabled");
		return;
	}

	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.NODE_ENV || "development",
		release: process.env.npm_package_version || "1.0.0",

		// Performance monitoring
		tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

		// Error filtering
		beforeSend(event, hint) {
			// Filter out certain errors in production
			if (process.env.NODE_ENV === "production") {
				const error = hint.originalException;

				// Don't send validation errors to Sentry
				if (error instanceof Error && error.name === "ValidationError") {
					return null;
				}

				// Don't send rate limit errors
				if (error instanceof Error && error.message.includes("rate limit")) {
					return null;
				}

				// Don't send 404 errors
				if (event.exception?.values?.[0]?.type === "NotFoundError") {
					return null;
				}
			}

			return event;
		},

		// Performance filtering
		beforeSendTransaction(event) {
			// Sample health check transactions less frequently
			if (event.transaction?.includes("/health")) {
				return Math.random() < 0.01 ? event : null;
			}

			return event;
		},

		// Additional configuration
		maxBreadcrumbs: 50,
		attachStacktrace: true,
		sendDefaultPii: false, // Don't send personally identifiable information

		// Tags for better organization
		initialScope: {
			tags: {
				component: "backend",
				service: "audit-wolf",
			},
		},
	});

	logger.info("Sentry initialized for error tracking", {
		environment: process.env.NODE_ENV,
		release: process.env.npm_package_version,
	});
}

/**
 * Sentry middleware for Express (simplified)
 */
export const sentryRequestHandler = (req: any, res: any, next: any) => {
	// Set user context if available
	if (req.user) {
		Sentry.setUser({
			id: req.user.id,
			email: req.user.email,
		});
	}
	next();
};

export const sentryTracingHandler = (req: any, res: any, next: any) => {
	// Simple tracing handler
	next();
};

export const sentryErrorHandler = (
	error: any,
	req: any,
	res: any,
	next: any
) => {
	// Only handle server errors (5xx)
	if (error.statusCode >= 500) {
		Sentry.captureException(error);
	}
	next(error);
};

/**
 * Helper functions for manual error reporting
 */
export const sentryHelpers = {
	/**
	 * Capture an exception with additional context
	 */
	captureException: (error: Error, context?: Record<string, any>) => {
		Sentry.withScope((scope) => {
			if (context) {
				Object.entries(context).forEach(([key, value]) => {
					scope.setExtra(key, value);
				});
			}
			Sentry.captureException(error);
		});
	},

	/**
	 * Capture a message with level and context
	 */
	captureMessage: (
		message: string,
		level: Sentry.SeverityLevel = "info",
		context?: Record<string, any>
	) => {
		Sentry.withScope((scope) => {
			scope.setLevel(level);
			if (context) {
				Object.entries(context).forEach(([key, value]) => {
					scope.setExtra(key, value);
				});
			}
			Sentry.captureMessage(message);
		});
	},

	/**
	 * Set user context for error tracking
	 */
	setUser: (user: { id: string; email?: string; role?: string }) => {
		Sentry.setUser(user);
	},

	/**
	 * Clear user context
	 */
	clearUser: () => {
		Sentry.setUser(null);
	},

	/**
	 * Add breadcrumb for debugging
	 */
	addBreadcrumb: (
		message: string,
		category: string,
		level: Sentry.SeverityLevel = "info",
		data?: Record<string, any>
	) => {
		Sentry.addBreadcrumb({
			message,
			category,
			level,
			data,
			timestamp: Date.now() / 1000,
		});
	},

	/**
	 * Measure function execution time (simplified)
	 */
	measureFunction: async <T>(
		name: string,
		fn: () => Promise<T>,
		tags?: Record<string, string>
	): Promise<T> => {
		const startTime = Date.now();

		try {
			const result = await fn();
			const duration = Date.now() - startTime;

			Sentry.addBreadcrumb({
				message: `Function ${name} completed`,
				category: "performance",
				level: "info",
				data: { duration, ...tags },
			});

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;

			Sentry.addBreadcrumb({
				message: `Function ${name} failed`,
				category: "performance",
				level: "error",
				data: {
					duration,
					error: error instanceof Error ? error.message : String(error),
					...tags,
				},
			});

			throw error;
		}
	},
};
