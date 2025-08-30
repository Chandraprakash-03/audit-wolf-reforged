import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { createServer } from "http";
import authRoutes from "./routes/auth";
import contractRoutes from "./routes/contracts";
import analysisRoutes from "./routes/analysis";
import queueRoutes from "./routes/queue";
import reportRoutes from "./routes/reports";
import notificationRoutes from "./routes/notifications";
import storageRoutes from "./routes/storage";
import adminRoutes from "./routes/admin";
import { WebSocketService } from "./services/WebSocketService";
import { AuditOrchestrator } from "./services/AuditOrchestrator";
import { dbOptimizationService } from "./services/DatabaseOptimizationService";
import { cdnService } from "./services/CDNService";
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

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize WebSocket service
const wsService = new WebSocketService(server);

// Initialize audit orchestrator
const auditOrchestrator = new AuditOrchestrator(wsService);

// Make services available to routes
app.locals.wsService = wsService;
app.locals.auditOrchestrator = auditOrchestrator;

// Trust proxy for rate limiting and IP detection
app.set("trust proxy", 1);

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

// Request logging
app.use(morgan("combined"));

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

// Body parsing with size limits
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

// Input sanitization
app.use(sanitizeInput);

// Performance tracking middleware
app.use(performanceTrackingMiddleware);
app.use(memoryTrackingMiddleware);

// CDN static asset middleware
app.use(cdnService.staticAssetMiddleware());

// Initialize database optimizations on startup
dbOptimizationService.createOptimizedIndexes().catch(console.error);

// Health check endpoint
app.get("/health", (req, res) => {
	res.json({ status: "OK", timestamp: new Date().toISOString() });
});

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

// Error handling middleware
app.use(errorTrackingMiddleware);
app.use(
	(
		err: Error,
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		console.error(err.stack);
		res.status(500).json({ error: "Something went wrong!" });
	}
);

// 404 handler
app.use("*", (req, res) => {
	res.status(404).json({ error: "Route not found" });
});

server.listen(PORT, () => {
	console.log(`🚀 Audit Wolf Backend running on port ${PORT}`);
	console.log(`📡 WebSocket server ready for connections`);
	console.log(`⚡ Queue system initialized`);
	console.log(`📊 Performance monitoring enabled`);
	console.log(`🗄️ Database optimization enabled`);
	console.log(`🚀 CDN service initialized`);
});

// Export app for testing
export { app };
