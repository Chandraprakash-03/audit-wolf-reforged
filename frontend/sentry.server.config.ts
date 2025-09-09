import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
	environment: process.env.NODE_ENV || "development",
	release: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",

	// Performance monitoring
	tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

	// Server-specific integrations
	integrations: [],

	// Error filtering for server-side
	beforeSend(event, hint) {
		// Filter out certain errors in production
		if (process.env.NODE_ENV === "production") {
			const error = hint.originalException;

			// Don't send validation errors
			if (error instanceof Error && error.name === "ValidationError") {
				return null;
			}

			// Don't send 404 errors
			if (event.exception?.values?.[0]?.type === "NotFoundError") {
				return null;
			}
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
			component: "frontend-server",
			service: "audit-wolf",
		},
	},

	// Debug mode in development
	debug: process.env.NODE_ENV === "development",
});
