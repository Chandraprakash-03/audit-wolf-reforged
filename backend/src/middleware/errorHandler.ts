import { Request, Response, NextFunction } from "express";
import { ValidationError } from "express-validator";
import * as Sentry from "@sentry/node";
// import { logger } from "../utils/logger";
import { logger } from "../utils/logger";

export interface AppError extends Error {
	statusCode?: number;
	code?: string;
	isOperational?: boolean;
}

/**
 * Custom error class for application errors
 */
export class ApplicationError extends Error implements AppError {
	public statusCode: number;
	public code: string;
	public isOperational: boolean;

	constructor(
		message: string,
		statusCode: number = 500,
		code: string = "INTERNAL_ERROR",
		isOperational: boolean = true
	) {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
		this.isOperational = isOperational;
		this.name = "ApplicationError";

		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Error types for different scenarios
 */
export const ErrorTypes = {
	// Authentication & Authorization
	UNAUTHORIZED: { code: "UNAUTHORIZED", status: 401 },
	FORBIDDEN: { code: "FORBIDDEN", status: 403 },
	TOKEN_EXPIRED: { code: "TOKEN_EXPIRED", status: 401 },
	INVALID_CREDENTIALS: { code: "INVALID_CREDENTIALS", status: 401 },

	// Validation
	VALIDATION_ERROR: { code: "VALIDATION_ERROR", status: 400 },
	INVALID_INPUT: { code: "INVALID_INPUT", status: 400 },
	MISSING_REQUIRED_FIELD: { code: "MISSING_REQUIRED_FIELD", status: 400 },

	// Resource Management
	NOT_FOUND: { code: "NOT_FOUND", status: 404 },
	RESOURCE_EXISTS: { code: "RESOURCE_EXISTS", status: 409 },
	RESOURCE_LOCKED: { code: "RESOURCE_LOCKED", status: 423 },

	// Rate Limiting & Quotas
	RATE_LIMIT_EXCEEDED: { code: "RATE_LIMIT_EXCEEDED", status: 429 },
	QUOTA_EXCEEDED: { code: "QUOTA_EXCEEDED", status: 429 },
	CREDITS_INSUFFICIENT: { code: "CREDITS_INSUFFICIENT", status: 402 },

	// Analysis Errors
	ANALYSIS_FAILED: { code: "ANALYSIS_FAILED", status: 422 },
	SLITHER_ERROR: { code: "SLITHER_ERROR", status: 422 },
	AI_MODEL_ERROR: { code: "AI_MODEL_ERROR", status: 503 },
	COMPILATION_ERROR: { code: "COMPILATION_ERROR", status: 422 },

	// File & Upload Errors
	FILE_TOO_LARGE: { code: "FILE_TOO_LARGE", status: 413 },
	UNSUPPORTED_FILE_TYPE: { code: "UNSUPPORTED_FILE_TYPE", status: 415 },
	UPLOAD_FAILED: { code: "UPLOAD_FAILED", status: 500 },

	// External Service Errors
	EXTERNAL_SERVICE_ERROR: { code: "EXTERNAL_SERVICE_ERROR", status: 503 },
	DATABASE_ERROR: { code: "DATABASE_ERROR", status: 500 },
	QUEUE_ERROR: { code: "QUEUE_ERROR", status: 500 },
	EMAIL_DELIVERY_ERROR: { code: "EMAIL_DELIVERY_ERROR", status: 500 },

	// System Errors
	INTERNAL_ERROR: { code: "INTERNAL_ERROR", status: 500 },
	SERVICE_UNAVAILABLE: { code: "SERVICE_UNAVAILABLE", status: 503 },
	TIMEOUT: { code: "TIMEOUT", status: 504 },
	MAINTENANCE_MODE: { code: "MAINTENANCE_MODE", status: 503 },
};

/**
 * Create standardized error responses
 */
export function createError(
	type: keyof typeof ErrorTypes,
	message?: string,
	details?: any
): ApplicationError {
	const errorType = ErrorTypes[type];
	const error = new ApplicationError(
		message || `${type.toLowerCase().replace(/_/g, " ")}`,
		errorType.status,
		errorType.code
	);

	if (details) {
		(error as any).details = details;
	}

	return error;
}

/**
 * Global error handling middleware
 */
export const globalErrorHandler = (
	err: AppError,
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	// Set default error properties
	err.statusCode = err.statusCode || 500;
	err.code = err.code || "INTERNAL_ERROR";

	// Log error details
	const errorContext = {
		error: {
			name: err.name,
			message: err.message,
			code: err.code,
			stack: err.stack,
		},
		request: {
			id: req.headers["x-request-id"],
			method: req.method,
			url: req.originalUrl,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
			userId: (req as any).user?.id,
		},
		timestamp: new Date().toISOString(),
	};

	// Log based on severity
	if (err.statusCode >= 500) {
		logger.error("Server Error", errorContext);
		// Report to Sentry for server errors
		Sentry.captureException(err, {
			tags: {
				component: "error_handler",
				statusCode: err.statusCode.toString(),
				errorCode: err.code,
			},
			extra: errorContext,
		});
	} else if (err.statusCode >= 400) {
		logger.warn("Client Error", errorContext);
	} else {
		logger.info("Error Handled", errorContext);
	}

	// Prepare error response
	const errorResponse: any = {
		error: {
			message: err.message,
			code: err.code,
			timestamp: new Date().toISOString(),
			requestId: req.headers["x-request-id"],
		},
	};

	// Add details for client errors (4xx)
	if (err.statusCode < 500) {
		if ((err as any).details) {
			errorResponse.error.details = (err as any).details;
		}

		// Add validation errors if present
		if (err.name === "ValidationError" && (err as any).errors) {
			errorResponse.error.validation = (err as any).errors;
		}
	}

	// Add stack trace in development
	if (process.env.NODE_ENV === "development") {
		errorResponse.error.stack = err.stack;
	}

	// Add recovery suggestions
	errorResponse.error.recovery = getRecoverySuggestions(
		err.code || "INTERNAL_ERROR"
	);

	res.status(err.statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (
	fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (
	reason: any,
	promise: Promise<any>
) => {
	logger.error("Unhandled Promise Rejection", {
		reason: reason?.message || reason,
		stack: reason?.stack,
		promise: promise.toString(),
	});

	Sentry.captureException(reason, {
		tags: { component: "unhandled_rejection" },
	});

	// Graceful shutdown
	process.exit(1);
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (error: Error) => {
	logger.error("Uncaught Exception", {
		error: {
			name: error.name,
			message: error.message,
			stack: error.stack,
		},
	});

	Sentry.captureException(error, {
		tags: { component: "uncaught_exception" },
	});

	// Graceful shutdown
	process.exit(1);
};

/**
 * Get recovery suggestions for different error types
 */
function getRecoverySuggestions(errorCode: string): string[] {
	const suggestions: Record<string, string[]> = {
		UNAUTHORIZED: [
			"Please log in to access this resource",
			"Check if your session has expired",
			"Verify your authentication credentials",
		],
		FORBIDDEN: [
			"You don't have permission to access this resource",
			"Contact an administrator for access",
			"Check if you have the required subscription tier",
		],
		VALIDATION_ERROR: [
			"Please check the provided data format",
			"Ensure all required fields are filled",
			"Verify that values meet the specified constraints",
		],
		NOT_FOUND: [
			"Check if the resource ID is correct",
			"The resource may have been deleted",
			"Try refreshing the page",
		],
		RATE_LIMIT_EXCEEDED: [
			"Please wait before making more requests",
			"Consider upgrading your subscription for higher limits",
			"Implement request batching to reduce frequency",
		],
		ANALYSIS_FAILED: [
			"Check if your Solidity code is valid",
			"Ensure the contract compiles successfully",
			"Try simplifying complex contract structures",
		],
		FILE_TOO_LARGE: [
			"Reduce the file size to under 10MB",
			"Split large contracts into smaller modules",
			"Remove unnecessary comments or whitespace",
		],
		EXTERNAL_SERVICE_ERROR: [
			"The issue is temporary, please try again",
			"Check our status page for service updates",
			"Contact support if the problem persists",
		],
		INTERNAL_ERROR: [
			"This is a temporary issue on our end",
			"Please try again in a few moments",
			"Contact support if the problem continues",
		],
	};

	return (
		suggestions[errorCode] || [
			"Please try again",
			"Contact support if the issue persists",
			"Check our documentation for more information",
		]
	);
}

/**
 * Validation error handler
 */
export const handleValidationError = (
	errors: any[],
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const validationError = createError(
		"VALIDATION_ERROR",
		"Request validation failed",
		{
			fields: errors.map((error) => ({
				field: error.path || error.param,
				message: error.msg,
				value: error.value,
				location: error.location,
			})),
		}
	);

	next(validationError);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const error = createError(
		"NOT_FOUND",
		`Route ${req.method} ${req.originalUrl} not found`
	);
	next(error);
};
