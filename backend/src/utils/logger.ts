import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

// Define log levels
const levels = {
	error: 0,
	warn: 1,
	info: 2,
	http: 3,
	debug: 4,
};

// Define colors for each level
const colors = {
	error: "red",
	warn: "yellow",
	info: "green",
	http: "magenta",
	debug: "white",
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
	winston.format.errors({ stack: true }),
	winston.format.colorize({ all: true }),
	winston.format.printf((info) => {
		const { timestamp, level, message, ...meta } = info;
		let log = `${timestamp} [${level}]: ${message}`;

		// Add metadata if present
		if (Object.keys(meta).length > 0) {
			log += `\n${JSON.stringify(meta, null, 2)}`;
		}

		return log;
	})
);

// Define which transports the logger must use
const transports = [
	// Console transport for development
	new winston.transports.Console({
		level: process.env.NODE_ENV === "production" ? "warn" : "debug",
		format: winston.format.combine(
			winston.format.colorize(),
			winston.format.simple()
		),
	}),

	// File transport for errors
	new DailyRotateFile({
		filename: path.join(process.cwd(), "logs", "error-%DATE%.log"),
		datePattern: "YYYY-MM-DD",
		level: "error",
		handleExceptions: true,
		handleRejections: true,
		maxSize: "20m",
		maxFiles: "14d",
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.errors({ stack: true }),
			winston.format.json()
		),
	}),

	// File transport for all logs
	new DailyRotateFile({
		filename: path.join(process.cwd(), "logs", "combined-%DATE%.log"),
		datePattern: "YYYY-MM-DD",
		maxSize: "20m",
		maxFiles: "7d",
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.errors({ stack: true }),
			winston.format.json()
		),
	}),

	// File transport for HTTP requests
	new DailyRotateFile({
		filename: path.join(process.cwd(), "logs", "http-%DATE%.log"),
		datePattern: "YYYY-MM-DD",
		level: "http",
		maxSize: "20m",
		maxFiles: "3d",
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.json()
		),
	}),
];

// Create the logger
export const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || "info",
	levels,
	format,
	transports,
	exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
export const morganStream = {
	write: (message: string) => {
		logger.http(message.trim());
	},
};

// Helper functions for structured logging
export const loggers = {
	// Authentication events
	auth: {
		login: (userId: string, ip: string, success: boolean) => {
			logger.info("Authentication attempt", {
				event: "login",
				userId,
				ip,
				success,
				timestamp: new Date().toISOString(),
			});
		},
		logout: (userId: string, ip: string) => {
			logger.info("User logout", {
				event: "logout",
				userId,
				ip,
				timestamp: new Date().toISOString(),
			});
		},
		tokenRefresh: (userId: string, ip: string) => {
			logger.info("Token refresh", {
				event: "token_refresh",
				userId,
				ip,
				timestamp: new Date().toISOString(),
			});
		},
	},

	// Audit events
	audit: {
		started: (auditId: string, userId: string, contractId: string) => {
			logger.info("Audit started", {
				event: "audit_started",
				auditId,
				userId,
				contractId,
				timestamp: new Date().toISOString(),
			});
		},
		completed: (
			auditId: string,
			userId: string,
			duration: number,
			success: boolean
		) => {
			logger.info("Audit completed", {
				event: "audit_completed",
				auditId,
				userId,
				duration,
				success,
				timestamp: new Date().toISOString(),
			});
		},
		failed: (auditId: string, userId: string, error: string, stage: string) => {
			logger.error("Audit failed", {
				event: "audit_failed",
				auditId,
				userId,
				error,
				stage,
				timestamp: new Date().toISOString(),
			});
		},
	},

	// Security events
	security: {
		rateLimitExceeded: (ip: string, endpoint: string, userId?: string) => {
			logger.warn("Rate limit exceeded", {
				event: "rate_limit_exceeded",
				ip,
				endpoint,
				userId,
				timestamp: new Date().toISOString(),
			});
		},
		suspiciousActivity: (ip: string, activity: string, userId?: string) => {
			logger.warn("Suspicious activity detected", {
				event: "suspicious_activity",
				ip,
				activity,
				userId,
				timestamp: new Date().toISOString(),
			});
		},
		unauthorizedAccess: (ip: string, endpoint: string, userId?: string) => {
			logger.warn("Unauthorized access attempt", {
				event: "unauthorized_access",
				ip,
				endpoint,
				userId,
				timestamp: new Date().toISOString(),
			});
		},
	},

	// Performance events
	performance: {
		slowQuery: (query: string, duration: number, userId?: string) => {
			logger.warn("Slow database query", {
				event: "slow_query",
				query,
				duration,
				userId,
				timestamp: new Date().toISOString(),
			});
		},
		highMemoryUsage: (usage: number, threshold: number) => {
			logger.warn("High memory usage", {
				event: "high_memory_usage",
				usage,
				threshold,
				timestamp: new Date().toISOString(),
			});
		},
		analysisTimeout: (auditId: string, stage: string, duration: number) => {
			logger.error("Analysis timeout", {
				event: "analysis_timeout",
				auditId,
				stage,
				duration,
				timestamp: new Date().toISOString(),
			});
		},
	},

	// External service events
	external: {
		serviceDown: (service: string, error: string) => {
			logger.error("External service unavailable", {
				event: "service_down",
				service,
				error,
				timestamp: new Date().toISOString(),
			});
		},
		serviceRecovered: (service: string, downtime: number) => {
			logger.info("External service recovered", {
				event: "service_recovered",
				service,
				downtime,
				timestamp: new Date().toISOString(),
			});
		},
		apiQuotaExceeded: (service: string, userId?: string) => {
			logger.warn("API quota exceeded", {
				event: "api_quota_exceeded",
				service,
				userId,
				timestamp: new Date().toISOString(),
			});
		},
	},
};

// Ensure logs directory exists
import fs from "fs";
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
	fs.mkdirSync(logsDir, { recursive: true });
}
