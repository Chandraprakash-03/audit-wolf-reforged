import { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import slowDown from "express-slow-down";
import { body, param, query, validationResult } from "express-validator";
import DOMPurify from "isomorphic-dompurify";
import crypto from "crypto";

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		// Sanitize request body
		if (req.body && typeof req.body === "object") {
			req.body = sanitizeObject(req.body);
		}

		// Sanitize query parameters
		if (req.query && typeof req.query === "object") {
			req.query = sanitizeObject(req.query);
		}

		// Sanitize URL parameters
		if (req.params && typeof req.params === "object") {
			req.params = sanitizeObject(req.params);
		}

		next();
	} catch (error) {
		console.error("Input sanitization error:", error);
		res.status(400).json({
			error: "Invalid input data",
			code: "SANITIZATION_ERROR",
		});
	}
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj === "string") {
		// Remove potential XSS attacks
		let sanitized = DOMPurify.sanitize(obj, { ALLOWED_TAGS: [] });

		// Remove SQL injection patterns
		sanitized = sanitized.replace(
			/('|\\'|;|--|\||%|\*|\+|=|>|<|\(|\)|\[|\]|\{|\})/g,
			""
		);

		// Limit string length to prevent DoS
		if (sanitized.length > 10000) {
			sanitized = sanitized.substring(0, 10000);
		}

		return sanitized.trim();
	}

	if (typeof obj === "number") {
		// Validate number ranges
		if (
			!Number.isFinite(obj) ||
			obj > Number.MAX_SAFE_INTEGER ||
			obj < Number.MIN_SAFE_INTEGER
		) {
			return 0;
		}
		return obj;
	}

	if (Array.isArray(obj)) {
		// Limit array size to prevent DoS
		if (obj.length > 1000) {
			obj = obj.slice(0, 1000);
		}
		return obj.map(sanitizeObject);
	}

	if (typeof obj === "object") {
		const sanitized: any = {};
		let keyCount = 0;

		for (const key in obj) {
			// Limit object keys to prevent DoS
			if (keyCount >= 100) break;

			if (obj.hasOwnProperty(key)) {
				const sanitizedKey = sanitizeObject(key);
				sanitized[sanitizedKey] = sanitizeObject(obj[key]);
				keyCount++;
			}
		}
		return sanitized;
	}

	return obj;
}

/**
 * Rate limiting middleware for API endpoints
 */
export const createRateLimit = (options: {
	windowMs: number;
	max: number;
	message?: string;
	skipSuccessfulRequests?: boolean;
}) => {
	return rateLimit({
		windowMs: options.windowMs,
		max: options.max,
		message: {
			error: options.message || "Too many requests, please try again later",
			code: "RATE_LIMIT_EXCEEDED",
		},
		standardHeaders: true,
		legacyHeaders: false,
		skipSuccessfulRequests: options.skipSuccessfulRequests || false,
		keyGenerator: (req: any) => {
			// Use proper IPv6-safe IP key generator + user ID if authenticated
			const ipKey = ipKeyGenerator(req);
			const userId = req.user?.id || "";
			return `${ipKey}:${userId}`;
		},
	});
};

/**
 * Speed limiting middleware to slow down repeated requests
 */
export const createSpeedLimit = (options: {
	windowMs: number;
	delayAfter: number;
	delayMs: number;
}) => {
	return slowDown({
		windowMs: options.windowMs,
		delayAfter: options.delayAfter,
		delayMs: options.delayMs,
		maxDelayMs: 10000, // Maximum delay of 10 seconds
	});
};

/**
 * Validation middleware for contract operations
 */
export const validateContractInput = [
	body("name")
		.trim()
		.isLength({ min: 1, max: 100 })
		.withMessage("Contract name must be between 1 and 100 characters")
		.matches(/^[a-zA-Z0-9\s\-_\.]+$/)
		.withMessage("Contract name contains invalid characters"),

	body("sourceCode")
		.trim()
		.isLength({ min: 10, max: 1000000 })
		.withMessage("Source code must be between 10 and 1,000,000 characters")
		.custom((value, { req }) => {
			// Platform-aware validation
			const platform = req.body.platform || "ethereum";
			const language = req.body.language || "solidity";

			// Platform-specific validation
			if (
				language === "solidity" ||
				["ethereum", "bsc", "polygon"].includes(platform)
			) {
				// Solidity validation
				if (
					!value.includes("contract") &&
					!value.includes("library") &&
					!value.includes("interface")
				) {
					throw new Error(
						"Source code must contain a valid Solidity contract, library, or interface"
					);
				}
			} else if (language === "rust" || platform === "solana") {
				// Rust/Anchor validation
				if (
					!value.includes("fn") &&
					!value.includes("mod") &&
					!value.includes("use")
				) {
					throw new Error(
						"Source code must contain valid Rust/Anchor code with functions, modules, or imports"
					);
				}
			} else if (language === "haskell" || platform === "cardano") {
				// Haskell/Plutus validation
				if (
					!value.includes("module") &&
					!value.includes("import") &&
					!value.includes("data")
				) {
					throw new Error(
						"Source code must contain valid Haskell/Plutus code with modules, imports, or data types"
					);
				}
			} else if (language === "move" || ["aptos", "sui"].includes(platform)) {
				// Move validation
				if (
					!value.includes("module") &&
					!value.includes("fun") &&
					!value.includes("struct")
				) {
					throw new Error(
						"Source code must contain valid Move code with modules, functions, or structs"
					);
				}
			}

			// Check for potentially dangerous patterns (universal)
			const dangerousPatterns = [
				/eval\s*\(/i,
				/exec\s*\(/i,
				/system\s*\(/i,
				/require\s*\(\s*['"`]child_process['"`]/i,
				/require\s*\(\s*['"`]fs['"`]/i,
			];

			for (const pattern of dangerousPatterns) {
				if (pattern.test(value)) {
					throw new Error(
						"Source code contains potentially dangerous patterns"
					);
				}
			}

			return true;
		}),

	body("compilerVersion")
		.optional()
		.matches(/^\d+\.\d+(\.\d+)?$/)
		.withMessage("Invalid compiler version format"),

	body("platform")
		.optional()
		.isIn(["ethereum", "bsc", "polygon", "solana", "cardano", "aptos", "sui"])
		.withMessage("Invalid blockchain platform"),

	body("language")
		.optional()
		.isIn(["solidity", "rust", "haskell", "move"])
		.withMessage("Invalid programming language"),
];

/**
 * Validation middleware for user profile updates
 */
export const validateProfileUpdate = [
	body("name")
		.optional()
		.trim()
		.isLength({ min: 2, max: 50 })
		.withMessage("Name must be between 2 and 50 characters")
		.matches(/^[a-zA-Z\s\-'\.]+$/)
		.withMessage("Name contains invalid characters"),

	body("email")
		.optional()
		.isEmail()
		.normalizeEmail()
		.withMessage("Invalid email format"),
];

/**
 * Validation middleware for UUID parameters
 */
export const validateUUID = (paramName: string) => [
	param(paramName).isUUID().withMessage(`Invalid ${paramName} format`),
];

/**
 * Validation middleware for pagination
 */
export const validatePagination = [
	query("page")
		.optional()
		.isInt({ min: 1, max: 10000 })
		.withMessage("Page must be a positive integer between 1 and 10000"),

	query("limit")
		.optional()
		.isInt({ min: 1, max: 100 })
		.withMessage("Limit must be between 1 and 100"),

	query("sortBy")
		.optional()
		.isIn(["created_at", "updated_at", "name", "status"])
		.withMessage("Invalid sort field"),

	query("sortOrder")
		.optional()
		.isIn(["asc", "desc"])
		.withMessage("Sort order must be 'asc' or 'desc'"),
];

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400).json({
			error: "Validation failed",
			code: "VALIDATION_ERROR",
			details: errors.array().map((error) => ({
				field: error.type === "field" ? error.path : "unknown",
				message: error.msg,
				value: error.type === "field" ? error.value : undefined,
			})),
		});
		return; // important to stop execution
	}
	next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	// Content Security Policy
	res.setHeader(
		"Content-Security-Policy",
		"default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
			"style-src 'self' 'unsafe-inline'; " +
			"img-src 'self' data: https:; " +
			"font-src 'self' https:; " +
			"connect-src 'self' https:; " +
			"frame-ancestors 'none';"
	);

	// Prevent MIME type sniffing
	res.setHeader("X-Content-Type-Options", "nosniff");

	// Prevent clickjacking
	res.setHeader("X-Frame-Options", "DENY");

	// XSS Protection
	res.setHeader("X-XSS-Protection", "1; mode=block");

	// Referrer Policy
	res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

	// Permissions Policy
	res.setHeader(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), payment=()"
	);

	next();
};

/**
 * Request ID middleware for tracking
 */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
	const id = crypto.randomUUID();
	req.headers["x-request-id"] = id;
	res.setHeader("X-Request-ID", id);
	next();
};

/**
 * CORS configuration for production
 */
export const corsOptions = {
	origin: (
		origin: string | undefined,
		callback: (err: Error | null, allow?: boolean) => void
	) => {
		const allowedOrigins = [
			process.env.FRONTEND_URL || "http://localhost:3000",
			"https://audit-wolf.vercel.app",
			"https://www.audit-wolf.com",
		];

		// Allow requests with no origin (mobile apps, etc.)
		if (!origin) return callback(null, true);

		if (allowedOrigins.includes(origin)) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS"), false);
		}
	},
	credentials: true,
	optionsSuccessStatus: 200,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: [
		"Origin",
		"X-Requested-With",
		"Content-Type",
		"Accept",
		"Authorization",
		"X-Request-ID",
	],
};
