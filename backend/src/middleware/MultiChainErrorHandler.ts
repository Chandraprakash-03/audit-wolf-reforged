import { Request, Response, NextFunction } from "express";
import { ApplicationError, ErrorTypes, createError } from "./errorHandler";
import { logger } from "../utils/logger";
import * as Sentry from "@sentry/node";

/**
 * Platform-specific error types for multi-blockchain support
 */
export const PlatformErrorTypes = {
	// Ethereum/EVM specific errors
	ETHEREUM_COMPILATION_ERROR: {
		code: "ETHEREUM_COMPILATION_ERROR",
		status: 422,
	},
	SOLIDITY_SYNTAX_ERROR: { code: "SOLIDITY_SYNTAX_ERROR", status: 422 },
	SLITHER_ANALYSIS_FAILED: { code: "SLITHER_ANALYSIS_FAILED", status: 422 },
	EVM_BYTECODE_ERROR: { code: "EVM_BYTECODE_ERROR", status: 422 },

	// Solana specific errors
	SOLANA_COMPILATION_ERROR: { code: "SOLANA_COMPILATION_ERROR", status: 422 },
	RUST_SYNTAX_ERROR: { code: "RUST_SYNTAX_ERROR", status: 422 },
	ANCHOR_BUILD_FAILED: { code: "ANCHOR_BUILD_FAILED", status: 422 },
	CLIPPY_ANALYSIS_FAILED: { code: "CLIPPY_ANALYSIS_FAILED", status: 422 },
	SOLANA_PROGRAM_ERROR: { code: "SOLANA_PROGRAM_ERROR", status: 422 },
	PDA_VALIDATION_ERROR: { code: "PDA_VALIDATION_ERROR", status: 422 },

	// Cardano specific errors
	CARDANO_COMPILATION_ERROR: { code: "CARDANO_COMPILATION_ERROR", status: 422 },
	PLUTUS_SYNTAX_ERROR: { code: "PLUTUS_SYNTAX_ERROR", status: 422 },
	HASKELL_TYPE_ERROR: { code: "HASKELL_TYPE_ERROR", status: 422 },
	PLUTUS_CORE_ERROR: { code: "PLUTUS_CORE_ERROR", status: 422 },
	UTXO_VALIDATION_ERROR: { code: "UTXO_VALIDATION_ERROR", status: 422 },

	// Move specific errors
	MOVE_COMPILATION_ERROR: { code: "MOVE_COMPILATION_ERROR", status: 422 },
	MOVE_PROVER_ERROR: { code: "MOVE_PROVER_ERROR", status: 422 },
	RESOURCE_VALIDATION_ERROR: { code: "RESOURCE_VALIDATION_ERROR", status: 422 },

	// Multi-chain specific errors
	PLATFORM_NOT_SUPPORTED: { code: "PLATFORM_NOT_SUPPORTED", status: 400 },
	PLATFORM_DETECTION_FAILED: { code: "PLATFORM_DETECTION_FAILED", status: 422 },
	CROSS_CHAIN_ANALYSIS_FAILED: {
		code: "CROSS_CHAIN_ANALYSIS_FAILED",
		status: 422,
	},
	MULTI_PLATFORM_TIMEOUT: { code: "MULTI_PLATFORM_TIMEOUT", status: 504 },
	ANALYZER_UNAVAILABLE: { code: "ANALYZER_UNAVAILABLE", status: 503 },
	ANALYZER_HEALTH_CHECK_FAILED: {
		code: "ANALYZER_HEALTH_CHECK_FAILED",
		status: 503,
	},

	// Platform tool errors
	TOOL_INSTALLATION_MISSING: { code: "TOOL_INSTALLATION_MISSING", status: 503 },
	TOOL_VERSION_INCOMPATIBLE: { code: "TOOL_VERSION_INCOMPATIBLE", status: 503 },
	TOOL_EXECUTION_TIMEOUT: { code: "TOOL_EXECUTION_TIMEOUT", status: 504 },
	TOOL_EXECUTION_FAILED: { code: "TOOL_EXECUTION_FAILED", status: 422 },
};

/**
 * Platform-specific error interface
 */
export interface PlatformError extends ApplicationError {
	platform?: string;
	toolName?: string;
	toolVersion?: string;
	platformSpecificData?: Record<string, any>;
	retryable?: boolean;
	fallbackAvailable?: boolean;
}

/**
 * Multi-chain error handler extending the base error handling system
 */
export class MultiChainErrorHandler {
	private static retryAttempts: Map<string, number> = new Map();
	private static readonly MAX_RETRY_ATTEMPTS = 3;
	private static readonly RETRY_DELAY_MS = 1000;

	/**
	 * Handle platform-specific errors with appropriate recovery strategies
	 */
	static handlePlatformError(
		error: PlatformError,
		req: Request,
		res: Response,
		next: NextFunction
	): void {
		// Enhance error with platform context
		const enhancedError = this.enhanceErrorWithPlatformContext(error, req);

		// Log platform-specific error details
		this.logPlatformError(enhancedError, req);

		// Report to monitoring systems
		this.reportPlatformError(enhancedError, req);

		// Determine if error is retryable and handle accordingly
		if (this.shouldRetryError(enhancedError, req)) {
			this.handleRetryableError(enhancedError, req, res, next);
		} else {
			// Pass to standard error handler with enhanced context
			next(enhancedError);
		}
	}

	/**
	 * Create platform-specific error
	 */
	static createPlatformError(
		type: keyof typeof PlatformErrorTypes,
		message?: string,
		platform?: string,
		details?: any
	): PlatformError {
		const errorType = PlatformErrorTypes[type];
		const error = new ApplicationError(
			message || `${type.toLowerCase().replace(/_/g, " ")}`,
			errorType.status,
			errorType.code
		) as PlatformError;

		error.platform = platform;
		error.platformSpecificData = details;
		error.retryable = this.isRetryableErrorType(type);
		error.fallbackAvailable = this.hasFallbackStrategy(type, platform);

		return error;
	}

	/**
	 * Handle Ethereum/EVM specific errors
	 */
	static handleEthereumError(error: any, context?: any): PlatformError {
		if (error.message?.includes("compilation failed")) {
			return this.createPlatformError(
				"ETHEREUM_COMPILATION_ERROR",
				"Solidity compilation failed. Please check your contract syntax.",
				"ethereum",
				{
					originalError: error.message,
					suggestions: [
						"Verify Solidity version compatibility",
						"Check for syntax errors in your contract",
						"Ensure all imports are available",
						"Validate pragma directives",
					],
					context,
				}
			);
		}

		if (error.message?.includes("slither")) {
			return this.createPlatformError(
				"SLITHER_ANALYSIS_FAILED",
				"Slither static analysis encountered an error",
				"ethereum",
				{
					originalError: error.message,
					suggestions: [
						"Ensure Slither is properly installed",
						"Check if the contract compiles successfully",
						"Try with a simpler contract structure",
					],
					context,
				}
			);
		}

		if (error.message?.includes("syntax")) {
			return this.createPlatformError(
				"SOLIDITY_SYNTAX_ERROR",
				"Solidity syntax error detected",
				"ethereum",
				{
					originalError: error.message,
					suggestions: [
						"Review Solidity syntax documentation",
						"Check for missing semicolons or brackets",
						"Validate function and variable declarations",
					],
					context,
				}
			);
		}

		// Default Ethereum error
		return this.createPlatformError(
			"ETHEREUM_COMPILATION_ERROR",
			error.message || "Ethereum analysis failed",
			"ethereum",
			{ originalError: error, context }
		);
	}

	/**
	 * Handle Solana specific errors
	 */
	static handleSolanaError(error: any, context?: any): PlatformError {
		if (error.message?.includes("anchor build")) {
			return this.createPlatformError(
				"ANCHOR_BUILD_FAILED",
				"Anchor build failed. Please check your Anchor.toml configuration.",
				"solana",
				{
					originalError: error.message,
					suggestions: [
						"Verify Anchor version compatibility",
						"Check program dependencies in Cargo.toml",
						"Ensure proper account structure",
						"Validate Anchor.toml configuration",
					],
					context,
				}
			);
		}

		if (error.message?.includes("clippy")) {
			return this.createPlatformError(
				"CLIPPY_ANALYSIS_FAILED",
				"Clippy analysis failed",
				"solana",
				{
					originalError: error.message,
					suggestions: [
						"Ensure Rust and Clippy are properly installed",
						"Check for Rust compilation errors",
						"Verify Cargo.toml dependencies",
					],
					context,
				}
			);
		}

		if (
			error.message?.includes("PDA") ||
			error.message?.includes("program derived address")
		) {
			return this.createPlatformError(
				"PDA_VALIDATION_ERROR",
				"Program Derived Address validation failed",
				"solana",
				{
					originalError: error.message,
					suggestions: [
						"Verify PDA derivation logic",
						"Check bump seed usage",
						"Ensure proper account validation",
					],
					context,
				}
			);
		}

		if (error.message?.includes("rust") || error.message?.includes("cargo")) {
			return this.createPlatformError(
				"RUST_SYNTAX_ERROR",
				"Rust compilation error",
				"solana",
				{
					originalError: error.message,
					suggestions: [
						"Check Rust syntax and compilation errors",
						"Verify all dependencies are available",
						"Ensure proper use of Solana program types",
					],
					context,
				}
			);
		}

		// Default Solana error
		return this.createPlatformError(
			"SOLANA_PROGRAM_ERROR",
			error.message || "Solana analysis failed",
			"solana",
			{ originalError: error, context }
		);
	}

	/**
	 * Handle Cardano specific errors
	 */
	static handleCardanoError(error: any, context?: any): PlatformError {
		if (error.message?.includes("plutus")) {
			return this.createPlatformError(
				"PLUTUS_CORE_ERROR",
				"Plutus script compilation failed. Please check your Haskell syntax.",
				"cardano",
				{
					originalError: error.message,
					suggestions: [
						"Verify Plutus Core version compatibility",
						"Check Haskell type annotations",
						"Ensure proper UTXO handling",
						"Validate script context usage",
					],
					context,
				}
			);
		}

		if (error.message?.includes("haskell") || error.message?.includes("type")) {
			return this.createPlatformError(
				"HASKELL_TYPE_ERROR",
				"Haskell type checking failed",
				"cardano",
				{
					originalError: error.message,
					suggestions: [
						"Review Haskell type signatures",
						"Check for type mismatches",
						"Ensure proper import statements",
					],
					context,
				}
			);
		}

		if (error.message?.includes("UTXO") || error.message?.includes("utxo")) {
			return this.createPlatformError(
				"UTXO_VALIDATION_ERROR",
				"UTXO model validation failed",
				"cardano",
				{
					originalError: error.message,
					suggestions: [
						"Verify UTXO handling logic",
						"Check transaction input/output validation",
						"Ensure proper datum usage",
					],
					context,
				}
			);
		}

		// Default Cardano error
		return this.createPlatformError(
			"CARDANO_COMPILATION_ERROR",
			error.message || "Cardano analysis failed",
			"cardano",
			{ originalError: error, context }
		);
	}

	/**
	 * Handle tool installation and availability errors
	 */
	static handleToolError(
		toolName: string,
		platform: string,
		error: any,
		context?: any
	): PlatformError {
		if (
			error.message?.includes("not found") ||
			error.message?.includes("command not found")
		) {
			return this.createPlatformError(
				"TOOL_INSTALLATION_MISSING",
				`${toolName} is not installed or not available in PATH`,
				platform,
				{
					toolName,
					originalError: error.message,
					suggestions: this.getToolInstallationSuggestions(toolName, platform),
					context,
				}
			);
		}

		if (
			error.message?.includes("version") ||
			error.message?.includes("incompatible")
		) {
			return this.createPlatformError(
				"TOOL_VERSION_INCOMPATIBLE",
				`${toolName} version is incompatible`,
				platform,
				{
					toolName,
					originalError: error.message,
					suggestions: this.getToolVersionSuggestions(toolName, platform),
					context,
				}
			);
		}

		if (error.message?.includes("timeout")) {
			return this.createPlatformError(
				"TOOL_EXECUTION_TIMEOUT",
				`${toolName} execution timed out`,
				platform,
				{
					toolName,
					originalError: error.message,
					suggestions: [
						"Try with a smaller contract",
						"Increase timeout configuration",
						"Check system resources",
					],
					context,
				}
			);
		}

		// Default tool error
		return this.createPlatformError(
			"TOOL_EXECUTION_FAILED",
			`${toolName} execution failed`,
			platform,
			{
				toolName,
				originalError: error.message,
				suggestions: [`Check ${toolName} installation and configuration`],
				context,
			}
		);
	}

	/**
	 * Handle cross-chain analysis errors
	 */
	static handleCrossChainError(
		error: any,
		platforms: string[],
		context?: any
	): PlatformError {
		return this.createPlatformError(
			"CROSS_CHAIN_ANALYSIS_FAILED",
			"Cross-chain analysis encountered an error",
			platforms.join(","),
			{
				platforms,
				originalError: error.message,
				suggestions: [
					"Verify all platform analyzers are available",
					"Check contract compatibility across platforms",
					"Try analyzing platforms individually first",
				],
				context,
			}
		);
	}

	/**
	 * Implement graceful degradation for failed analyzers
	 */
	static async handleAnalyzerFailure(
		platform: string,
		error: any,
		fallbackOptions: {
			enableAIFallback?: boolean;
			enableBasicValidation?: boolean;
			skipPlatform?: boolean;
		} = {}
	): Promise<{
		shouldContinue: boolean;
		fallbackStrategy: string;
		modifiedOptions?: any;
	}> {
		logger.warn(`Analyzer failure for platform ${platform}`, {
			error: error.message,
			fallbackOptions,
		});

		// Check if we have fallback strategies available
		if (fallbackOptions.enableAIFallback) {
			return {
				shouldContinue: true,
				fallbackStrategy: "ai-only",
				modifiedOptions: {
					includeStaticAnalysis: false,
					includeAIAnalysis: true,
				},
			};
		}

		if (fallbackOptions.enableBasicValidation) {
			return {
				shouldContinue: true,
				fallbackStrategy: "basic-validation",
				modifiedOptions: {
					includeStaticAnalysis: false,
					includeAIAnalysis: false,
					basicValidationOnly: true,
				},
			};
		}

		if (fallbackOptions.skipPlatform) {
			return {
				shouldContinue: true,
				fallbackStrategy: "skip-platform",
			};
		}

		// No fallback available
		return {
			shouldContinue: false,
			fallbackStrategy: "none",
		};
	}

	/**
	 * Implement retry logic for transient failures
	 */
	static async retryAnalysis<T>(
		operation: () => Promise<T>,
		platform: string,
		maxAttempts: number = this.MAX_RETRY_ATTEMPTS
	): Promise<T> {
		let lastError: any;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				const result = await operation();

				// Clear retry count on success
				this.retryAttempts.delete(platform);

				return result;
			} catch (error) {
				lastError = error;

				logger.warn(`Analysis attempt ${attempt} failed for ${platform}`, {
					error: error instanceof Error ? error.message : error,
					attempt,
					maxAttempts,
				});

				// Don't retry on the last attempt
				if (attempt === maxAttempts) {
					break;
				}

				// Check if error is retryable
				if (!this.isRetryableError(error)) {
					break;
				}

				// Wait before retry with exponential backoff
				const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
				await this.sleep(delay);
			}
		}

		// Track failed retries
		this.retryAttempts.set(platform, maxAttempts);

		throw lastError;
	}

	/**
	 * Enhanced error context with platform information
	 */
	private static enhanceErrorWithPlatformContext(
		error: PlatformError,
		req: Request
	): PlatformError {
		const enhancedError = { ...error };

		// Add request context
		enhancedError.platformSpecificData = {
			...enhancedError.platformSpecificData,
			requestId: req.headers["x-request-id"],
			userAgent: req.get("User-Agent"),
			timestamp: new Date().toISOString(),
			endpoint: req.originalUrl,
			method: req.method,
		};

		// Add retry information if available
		if (enhancedError.platform) {
			const retryCount = this.retryAttempts.get(enhancedError.platform) || 0;
			enhancedError.platformSpecificData.retryCount = retryCount;
		}

		return enhancedError;
	}

	/**
	 * Log platform-specific errors with detailed context
	 */
	private static logPlatformError(error: PlatformError, req: Request): void {
		const logContext = {
			error: {
				name: error.name,
				message: error.message,
				code: error.code,
				platform: error.platform,
				toolName: error.toolName,
				retryable: error.retryable,
				fallbackAvailable: error.fallbackAvailable,
			},
			request: {
				id: req.headers["x-request-id"],
				method: req.method,
				url: req.originalUrl,
				userAgent: req.get("User-Agent"),
			},
			platformData: error.platformSpecificData,
		};

		if (error.statusCode && error.statusCode >= 500) {
			logger.error(`Platform Error [${error.platform}]`, logContext);
		} else {
			logger.warn(`Platform Warning [${error.platform}]`, logContext);
		}
	}

	/**
	 * Report platform errors to monitoring systems
	 */
	private static reportPlatformError(error: PlatformError, req: Request): void {
		// Only report server errors to Sentry
		if (error.statusCode && error.statusCode >= 500) {
			Sentry.captureException(error, {
				tags: {
					component: "multi_chain_error_handler",
					platform: error.platform || "unknown",
					errorCode: error.code,
					toolName: error.toolName,
				},
				extra: {
					platformSpecificData: error.platformSpecificData,
					retryable: error.retryable,
					fallbackAvailable: error.fallbackAvailable,
				},
				contexts: {
					request: {
						method: req.method,
						url: req.originalUrl,
						headers: req.headers,
					},
				},
			});
		}
	}

	/**
	 * Determine if an error should be retried
	 */
	private static shouldRetryError(error: PlatformError, req: Request): boolean {
		// Don't retry if we've already exceeded max attempts
		if (error.platform) {
			const currentAttempts = this.retryAttempts.get(error.platform) || 0;
			if (currentAttempts >= this.MAX_RETRY_ATTEMPTS) {
				return false;
			}
		}

		return error.retryable === true && this.isRetryableError(error);
	}

	/**
	 * Handle retryable errors
	 */
	private static handleRetryableError(
		error: PlatformError,
		req: Request,
		res: Response,
		next: NextFunction
	): void {
		// For now, we'll pass retryable errors to the standard handler
		// In a full implementation, this could trigger async retry mechanisms
		const retryError = { ...error };
		retryError.platformSpecificData = {
			...retryError.platformSpecificData,
			retryScheduled: true,
			retryDelay: this.RETRY_DELAY_MS,
		};

		next(retryError);
	}

	/**
	 * Check if error type is retryable
	 */
	private static isRetryableErrorType(
		type: keyof typeof PlatformErrorTypes
	): boolean {
		const retryableTypes = [
			"TOOL_EXECUTION_TIMEOUT",
			"ANALYZER_UNAVAILABLE",
			"ANALYZER_HEALTH_CHECK_FAILED",
			"MULTI_PLATFORM_TIMEOUT",
		];

		return retryableTypes.includes(type);
	}

	/**
	 * Check if error instance is retryable
	 */
	private static isRetryableError(error: any): boolean {
		// Network-related errors
		if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
			return true;
		}

		// Timeout errors
		if (
			error.message?.includes("timeout") ||
			error.message?.includes("timed out")
		) {
			return true;
		}

		// Temporary service unavailable
		if (
			error.message?.includes("service unavailable") ||
			error.message?.includes("temporarily unavailable")
		) {
			return true;
		}

		return false;
	}

	/**
	 * Check if fallback strategy is available
	 */
	private static hasFallbackStrategy(
		type: keyof typeof PlatformErrorTypes,
		platform?: string
	): boolean {
		// Most analysis errors have AI fallback
		const fallbackAvailableTypes = [
			"ETHEREUM_COMPILATION_ERROR",
			"SOLANA_COMPILATION_ERROR",
			"CARDANO_COMPILATION_ERROR",
			"SLITHER_ANALYSIS_FAILED",
			"CLIPPY_ANALYSIS_FAILED",
			"TOOL_EXECUTION_FAILED",
		];

		return fallbackAvailableTypes.includes(type);
	}

	/**
	 * Get tool installation suggestions
	 */
	private static getToolInstallationSuggestions(
		toolName: string,
		platform: string
	): string[] {
		const suggestions: Record<string, string[]> = {
			slither: [
				"Install Slither: pip install slither-analyzer",
				"Ensure Python and pip are installed",
				"Add Slither to your PATH",
			],
			clippy: [
				"Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
				"Install Clippy: rustup component add clippy",
				"Ensure Rust toolchain is up to date",
			],
			anchor: [
				"Install Anchor CLI: cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked",
				"Ensure Rust and Cargo are installed",
				"Add Cargo bin directory to PATH",
			],
			rustc: [
				"Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
				"Restart your terminal after installation",
				"Verify installation with: rustc --version",
			],
		};

		return (
			suggestions[toolName.toLowerCase()] || [
				`Install ${toolName} according to ${platform} documentation`,
				"Check system PATH configuration",
				"Verify tool permissions and accessibility",
			]
		);
	}

	/**
	 * Get tool version suggestions
	 */
	private static getToolVersionSuggestions(
		toolName: string,
		platform: string
	): string[] {
		const suggestions: Record<string, string[]> = {
			slither: [
				"Update Slither: pip install --upgrade slither-analyzer",
				"Check supported Solidity versions",
				"Consider using a specific Slither version",
			],
			clippy: [
				"Update Rust toolchain: rustup update",
				"Update Clippy: rustup component add clippy --force",
				"Check Rust version compatibility",
			],
			anchor: [
				"Update Anchor CLI: cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force",
				"Check Anchor version compatibility with your project",
				"Update Anchor.toml version specification",
			],
		};

		return (
			suggestions[toolName.toLowerCase()] || [
				`Update ${toolName} to a compatible version`,
				`Check ${platform} documentation for version requirements`,
				"Consider using a specific tool version",
			]
		);
	}

	/**
	 * Sleep utility for retry delays
	 */
	private static sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Middleware function for handling multi-chain errors
 */
export const multiChainErrorHandler = (
	err: any,
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	// Check if this is a platform-specific error
	if (
		err.platform ||
		err.toolName ||
		Object.values(PlatformErrorTypes).some((type) => type.code === err.code)
	) {
		MultiChainErrorHandler.handlePlatformError(err, req, res, next);
	} else {
		// Pass to standard error handler
		next(err);
	}
};

/**
 * Utility functions for creating platform-specific errors
 */
export const createPlatformError = MultiChainErrorHandler.createPlatformError;
export const handleEthereumError = MultiChainErrorHandler.handleEthereumError;
export const handleSolanaError = MultiChainErrorHandler.handleSolanaError;
export const handleCardanoError = MultiChainErrorHandler.handleCardanoError;
export const handleToolError = MultiChainErrorHandler.handleToolError;
export const handleCrossChainError =
	MultiChainErrorHandler.handleCrossChainError;
export const retryAnalysis = MultiChainErrorHandler.retryAnalysis;
export const handleAnalyzerFailure =
	MultiChainErrorHandler.handleAnalyzerFailure;
