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
import { WebSocketService } from "./services/WebSocketService";
import { AuditOrchestrator } from "./services/AuditOrchestrator";

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

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
	res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API routes
app.get("/api", (req, res) => {
	res.json({ message: "Audit Wolf API Server", version: "1.0.0" });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Contract routes
app.use("/api/contracts", contractRoutes);

// Analysis routes
app.use("/api/analysis", analysisRoutes);

// Queue routes
app.use("/api/queue", queueRoutes);

// Report routes
app.use("/api/reports", reportRoutes);

// Error handling middleware
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
});
