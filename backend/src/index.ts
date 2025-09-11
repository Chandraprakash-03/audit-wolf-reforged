import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { createServer } from "http";
import authRoutes from "./routes/auth";
import contractRoutes from "./routes/contracts";
import auditRoutes from "./routes/audits";
import analysisRoutes from "./routes/analysis";
import multiBlockchainRoutes from "./routes/multi-blockchain";
import queueRoutes from "./routes/queue";
import reportRoutes from "./routes/reports";
import notificationRoutes from "./routes/notifications";
import storageRoutes from "./routes/storage";
import adminRoutes from "./routes/admin";
import platformManagementRoutes from "./routes/platform-management";
import { WebSocketService } from "./services/WebSocketService";
import { AuditOrchestrator } from "./services/AuditOrchestrator";
import { dbOptimizationService } from "./services/DatabaseOptimizationService";
import { cdnService } from "./services/CDNService";
import { healthCheckService } from "./services/HealthCheckService";
import {
	sanitizeInput,
	createRateLimit,
	createSpeedLimit,
	securityHeaders,
	requestId,
	corsOptions,
} from "./middleware/security";
import {
	performanceTrackingMiddleware,
	errorTrackingMiddleware,
	cacheMiddleware,
	memoryTrackingMiddleware,
	rateLimitMiddleware,
} from "./middleware/performanceMiddleware";
import {
	globalErrorHandler,
	notFoundHandler,
	handleUnhandledRejection,
	handleUncaughtException,
} from "./middleware/errorHandler";
import {
	initializeSentry,
	sentryRequestHandler,
	sentryTracingHandler,
	sentryErrorHandler,
} from "./config/sentry";
import { logger, morganStream } from "./utils/logger";
import { setupSwagger } from "./docs/swagger";

// Load environment variables
dotenv.config();

// Initialize Sentry for error tracking
initializeSentry();

// Handle unhandled promise rejections and uncaught exceptions
process.on("unhandledRejection", handleUnhandledRejection);
process.on("uncaughtException", handleUncaughtException);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;
console.log(PORT)

// Initialize WebSocket service
const wsService = new WebSocketService(server);

// Initialize audit orchestrator
const auditOrchestrator = new AuditOrchestrator(wsService);

// Make services available to routes
app.locals.wsService = wsService;
app.locals.auditOrchestrator = auditOrchestrator;

// Trust proxy for rate limiting and IP detection
app.set("trust proxy", 1);

// Sentry request handling (must be first)
app.use(sentryRequestHandler);
app.use(sentryTracingHandler);

// Security middleware
app.use(requestId);
app.use(securityHeaders);
app.use(
	helmet({
		contentSecurityPolicy: false, // We set this manually in securityHeaders
		crossOriginEmbedderPolicy: false,
	})
);

// CORS with production configuration
if (process.env.NODE_ENV === "production") {
	app.use(cors(corsOptions));
} else {
	app.use(cors());
}

// Request logging with Winston
app.use(morgan("combined", { stream: morganStream }));

// Global rate limiting
app.use(
	createRateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 1000, // Limit each IP to 1000 requests per windowMs
		message: "Too many requests from this IP, please try again later",
	})
);

// Speed limiting for repeated requests
app.use(
	createSpeedLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		delayAfter: 100, // Allow 100 requests per windowMs without delay
		delayMs: 500, // Add 500ms delay per request after delayAfter
	})
);

// Body parsing with size limits and error handling
app.use(
	express.json({
		limit: "10mb",
		verify: (req, res, buf) => {
			// Store raw body for signature verification if needed
			(req as any).rawBody = buf;
		},
	})
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Handle JSON parsing errors
app.use((err: any, req: any, res: any, next: any) => {
	if (
		err instanceof SyntaxError &&
		(err as any).status === 400 &&
		"body" in err
	) {
		return res.status(400).json({
			success: false,
			error: {
				code: "INVALID_JSON",
				message: "Invalid JSON format",
				recovery: [
					"Please check the JSON syntax",
					"Ensure all quotes and brackets are properly closed",
					"Validate your JSON using a JSON validator",
				],
			},
		});
	}
	next(err);
});

// Input sanitization
app.use(sanitizeInput);

// Performance tracking middleware
app.use(performanceTrackingMiddleware);
app.use(memoryTrackingMiddleware);

// CDN static asset middleware
app.use(cdnService.staticAssetMiddleware());

// Initialize database optimizations on startup
dbOptimizationService.createOptimizedIndexes().catch(console.error);

// Health check endpoints
app.get(
	"/health",
	healthCheckService.healthCheckHandler.bind(healthCheckService)
);
app.get(
	"/health/live",
	healthCheckService.livenessProbe.bind(healthCheckService)
);
app.get(
	"/health/ready",
	healthCheckService.readinessProbe.bind(healthCheckService)
);

// Setup API documentation
setupSwagger(app);

// API routes
app.get("/api", (req, res) => {
	res.json({ message: "Audit Wolf API Server", version: "1.0.0" });
});

// Auth routes with stricter rate limiting
app.use(
	"/api/auth",
	createRateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 50, // Limit auth requests to 50 per 15 minutes
		message: "Too many authentication attempts, please try again later",
	}),
	authRoutes
);

// Contract routes with rate limiting
app.use(
	"/api/contracts",
	createRateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 200, // Limit contract operations to 200 per 15 minutes
		message: "Too many contract operations, please try again later",
	}),
	contractRoutes
);

// Audit routes with rate limiting
app.use(
	"/api/audits",
	createRateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 100, // Limit audit operations to 100 per 15 minutes
		message: "Too many audit operations, please try again later",
	}),
	auditRoutes
);

// Analysis routes with stricter rate limiting (resource intensive)
app.use(
	"/api/analysis",
	createRateLimit({
		windowMs: 60 * 60 * 1000, // 1 hour
		max: 50, // Limit analysis requests to 50 per hour
		message: "Too many analysis requests, please try again later",
	}),
	analysisRoutes
);

// Multi-blockchain routes with rate limiting
app.use(
	"/api/multi-blockchain",
	createRateLimit({
		windowMs: 60 * 60 * 1000, // 1 hour
		max: 30, // Limit multi-blockchain requests to 30 per hour
		message: "Too many multi-blockchain requests, please try again later",
	}),
	multiBlockchainRoutes
);

// Queue routes
app.use("/api/queue", queueRoutes);

// Report routes
app.use("/api/reports", reportRoutes);

// Notification routes
app.use("/api/notifications", notificationRoutes);

// Storage routes
app.use("/api/storage", storageRoutes);

// Admin routes with caching
app.use(
	"/api/admin",
	cacheMiddleware(60), // Cache admin responses for 1 minute
	adminRoutes
);

// Platform management routes with caching
app.use(
	"/api/admin/platform-management",
	cacheMiddleware(30), // Cache platform management responses for 30 seconds
	platformManagementRoutes
);

// Error handling middleware (must be after all routes)
app.use(errorTrackingMiddleware);
app.use(sentryErrorHandler);
app.use(notFoundHandler);
app.use(globalErrorHandler);

// if (process.env.NODE_ENV !== "test") {
	const port = parseInt(process.env.PORT || '3001', 10);
	const host = '0.0.0.0';
	
	console.log(`Attempting to start server on ${host}:${port}`);
	
	server.listen(10000, host, () => {
		const actualAddress = server.address();
		console.log('Server actually listening on:', actualAddress);
		
		logger.info("Audit Wolf Backend started", {
			port: port,
			host: host,
			actualAddress: actualAddress,
			environment: process.env.NODE_ENV,
			version: process.env.npm_package_version || "1.0.0",
			features: {
				websocket: true,
				queue: true,
				performance_monitoring: true,
				database_optimization: true,
				cdn: true,
				error_tracking: !!process.env.SENTRY_DSN,
			},
		});

		console.log(`🚀 Audit Wolf Backend running on ${host}:${port}`);
		console.log(`📡 WebSocket server ready for connections`);
		console.log(`⚡ Queue system initialized`);
		console.log(`📊 Performance monitoring enabled`);
		console.log(`🗄️ Database optimization enabled`);
		console.log(`🚀 CDN service initialized`);
		console.log(
			`🔍 Error tracking ${process.env.SENTRY_DSN ? "enabled" : "disabled"}`
		);
		console.log(`📝 Logging to files enabled`);
	});

	server.on('error', (error: any) => {
		console.error('❌ Server failed to start:', error);
		logger.error('Server startup failed', { 
			error: error.message, 
			stack: error.stack,
			port: port,
			host: host
		});
		process.exit(1);
	});
// }

// Export app for testing
export { app };
