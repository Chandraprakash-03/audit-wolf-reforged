import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.NODE_ENV || "development",
	release: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",

	// Performance monitoring
	tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

	// Integrations (simplified for compatibility)
	integrations: [],

	// Error filtering
	beforeSend(event, hint) {
		// Filter out certain errors in production
		if (process.env.NODE_ENV === "production") {
			const error = hint.originalException;

			// Don't send network errors that are likely user connectivity issues
			if (error instanceof Error) {
				if (
					error.message.includes("NetworkError") ||
					error.message.includes("Failed to fetch") ||
					error.message.includes("Load failed")
				) {
					return null;
				}

				// Don't send ResizeObserver errors (common browser quirk)
				if (error.message.includes("ResizeObserver")) {
					return null;
				}

				// Don't send non-Error objects
				if (typeof error !== "object" || !error.stack) {
					return null;
				}
			}

			// Filter out errors from browser extensions
			if (event.exception?.values?.[0]?.stacktrace?.frames) {
				const frames = event.exception.values[0].stacktrace.frames;
				const hasExtensionFrame = frames.some(
					(frame) =>
						frame.filename?.includes("extension://") ||
						frame.filename?.includes("moz-extension://") ||
						frame.filename?.includes("safari-extension://")
				);

				if (hasExtensionFrame) {
					return null;
				}
			}
		}

		return event;
	},

	// Performance filtering
	beforeSendTransaction(event) {
		// Sample navigation transactions less frequently
		if (
			event.transaction?.includes("pageload") ||
			event.transaction?.includes("navigation")
		) {
			return Math.random() < 0.1 ? event : null;
		}

		return event;
	},

	// Additional configuration
	maxBreadcrumbs: 50,
	attachStacktrace: true,
	sendDefaultPii: false,

	// Tags for better organization
	initialScope: {
		tags: {
			component: "frontend",
			service: "audit-wolf",
		},
	},

	// Debug mode in development
	debug: process.env.NODE_ENV === "development",
});
