import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.NODE_ENV || "development",
	release: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",

	// Performance monitoring (reduced for edge runtime)
	tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0.5,

	// Minimal configuration for edge runtime
	beforeSend(event, hint) {
		// Filter out certain errors in production
		if (process.env.NODE_ENV === "production") {
			const error = hint.originalException;

			// Don't send validation errors
			if (error instanceof Error && error.name === "ValidationError") {
				return null;
			}
		}

		return event;
	},

	// Minimal configuration for edge runtime
	maxBreadcrumbs: 25,
	attachStacktrace: true,
	sendDefaultPii: false,

	// Tags for better organization
	initialScope: {
		tags: {
			component: "frontend-edge",
			service: "audit-wolf",
		},
	},

	// Debug mode in development
	debug: process.env.NODE_ENV === "development",
});
