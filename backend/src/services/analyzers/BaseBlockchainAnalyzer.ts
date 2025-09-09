import {
	BlockchainAnalyzer,
	ContractInput,
	AnalysisResult,
	ValidationResult,
	InstallationCheckResult,
	PlatformVulnerability,
	AnalysisOptions,
} from "../../types/blockchain";
import { logger } from "../../utils/logger";
import {
	createPlatformError,
	handleToolError,
	PlatformError,
} from "../../middleware/MultiChainErrorHandler";
import { analyzerFallbackService } from "../AnalyzerFallbackService";

/**
 * Abstract base class for blockchain analyzers
 */
export abstract class BaseBlockchainAnalyzer implements BlockchainAnalyzer {
	public readonly platform: string;
	protected readonly timeout: number;
	protected readonly maxFileSize: number;

	constructor(
		platform: string,
		options: { timeout?: number; maxFileSize?: number } = {}
	) {
		this.platform = platform;
		this.timeout = options.timeout || 120000; // 2 minutes default
		this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
	}

	/**
	 * Analyze contracts for the specific blockchain platform
	 */
	public abstract analyze(contracts: ContractInput[]): Promise<AnalysisResult>;

	/**
	 * Analyze contracts with fallback support
	 */
	public async analyzeWithFallback(
		contracts: ContractInput[],
		options: Partial<AnalysisOptions> = {}
	): Promise<AnalysisResult> {
		try {
			return await analyzerFallbackService.analyzeWithFallback(
				this,
				contracts,
				this.validateAnalysisOptions(options),
				{
					enableAIFallback: true,
					enableBasicValidation: true,
					maxRetryAttempts: 3,
				}
			);
		} catch (error) {
			throw this.handleAnalysisError(error, contracts);
		}
	}

	/**
	 * Validate a single contract
	 */
	public abstract validateContract(
		contract: ContractInput
	): Promise<ValidationResult>;

	/**
	 * Check if the analyzer tools are properly installed and configured
	 */
	public abstract checkHealth(): Promise<InstallationCheckResult>;

	/**
	 * Run static analysis on contracts
	 */
	protected abstract runStaticAnalysis(contracts: ContractInput[]): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
		executionTime: number;
	}>;

	/**
	 * Run AI analysis on contracts (optional, can be overridden)
	 */
	protected async runAIAnalysis(contracts: ContractInput[]): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
		executionTime: number;
	}> {
		// Default implementation - no AI analysis
		return {
			success: true,
			vulnerabilities: [],
			errors: [],
			warnings: ["AI analysis not implemented for this platform"],
			executionTime: 0,
		};
	}

	/**
	 * Validate contract input
	 */
	protected validateContractInput(contract: ContractInput): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check if contract code is provided
		if (!contract.code || contract.code.trim().length === 0) {
			errors.push("Contract code cannot be empty");
		}

		// Check file size
		if (Buffer.byteLength(contract.code, "utf8") > this.maxFileSize) {
			errors.push(
				`Contract size exceeds maximum limit of ${this.maxFileSize} bytes`
			);
		}

		// Check platform match
		if (contract.platform !== this.platform) {
			warnings.push(
				`Contract platform '${contract.platform}' does not match analyzer platform '${this.platform}'`
			);
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Merge multiple analysis results
	 */
	protected mergeAnalysisResults(
		results: Array<{
			success: boolean;
			vulnerabilities: PlatformVulnerability[];
			errors: string[];
			warnings: string[];
			executionTime: number;
		}>
	): AnalysisResult {
		const mergedResult: AnalysisResult = {
			success: results.every((r) => r.success),
			vulnerabilities: [],
			errors: [],
			warnings: [],
			executionTime: 0,
		};

		for (const result of results) {
			mergedResult.vulnerabilities.push(...result.vulnerabilities);
			mergedResult.errors.push(...result.errors);
			mergedResult.warnings.push(...result.warnings);
			mergedResult.executionTime += result.executionTime;
		}

		// Remove duplicate vulnerabilities
		mergedResult.vulnerabilities = this.deduplicateVulnerabilities(
			mergedResult.vulnerabilities
		);

		return mergedResult;
	}

	/**
	 * Remove duplicate vulnerabilities based on location and type
	 */
	protected deduplicateVulnerabilities(
		vulnerabilities: PlatformVulnerability[]
	): PlatformVulnerability[] {
		const seen = new Set<string>();
		const deduplicated: PlatformVulnerability[] = [];

		for (const vuln of vulnerabilities) {
			const key = `${vuln.type}-${vuln.location.file}-${vuln.location.line}-${vuln.location.column}`;

			if (!seen.has(key)) {
				seen.add(key);
				deduplicated.push(vuln);
			}
		}

		return deduplicated;
	}

	/**
	 * Map severity levels to standardized format
	 */
	protected mapSeverity(
		severity: string
	): "critical" | "high" | "medium" | "low" | "informational" {
		const normalizedSeverity = severity.toLowerCase();

		switch (normalizedSeverity) {
			case "critical":
			case "error":
				return "critical";
			case "high":
			case "warning":
				return "high";
			case "medium":
			case "moderate":
				return "medium";
			case "low":
			case "minor":
				return "low";
			case "info":
			case "informational":
			case "note":
				return "informational";
			default:
				return "medium";
		}
	}

	/**
	 * Generate a standardized vulnerability ID
	 */
	protected generateVulnerabilityId(vuln: PlatformVulnerability): string {
		const hash = this.simpleHash(
			`${vuln.type}-${vuln.location.file}-${vuln.location.line}-${vuln.description}`
		);
		return `${this.platform}-${hash}`;
	}

	/**
	 * Simple hash function for generating IDs
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(16);
	}

	/**
	 * Log analysis progress
	 */
	protected logProgress(step: string, details?: any): void {
		logger.info(`[${this.platform}] ${step}`, details);
	}

	/**
	 * Log analysis error
	 */
	protected logError(message: string, error?: any): void {
		logger.error(`[${this.platform}] ${message}`, error);
	}

	/**
	 * Create a timeout promise
	 */
	protected createTimeoutPromise<T>(
		promise: Promise<T>,
		timeoutMs: number = this.timeout
	): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Operation timed out after ${timeoutMs}ms`));
				}, timeoutMs);
			}),
		]);
	}

	/**
	 * Validate analysis options
	 */
	protected validateAnalysisOptions(
		options: Partial<AnalysisOptions>
	): AnalysisOptions {
		return {
			includeStaticAnalysis: options.includeStaticAnalysis ?? true,
			includeAIAnalysis: options.includeAIAnalysis ?? false,
			severityThreshold: options.severityThreshold || "low",
			enabledDetectors: options.enabledDetectors || [],
			disabledDetectors: options.disabledDetectors || [],
			timeout: options.timeout || this.timeout,
			maxFileSize: options.maxFileSize || this.maxFileSize,
		};
	}

	/**
	 * Filter vulnerabilities by severity threshold
	 */
	protected filterVulnerabilitiesBySeverity(
		vulnerabilities: PlatformVulnerability[],
		threshold: "critical" | "high" | "medium" | "low" | "informational"
	): PlatformVulnerability[] {
		const severityOrder = [
			"informational",
			"low",
			"medium",
			"high",
			"critical",
		];
		const thresholdIndex = severityOrder.indexOf(threshold);

		if (thresholdIndex === -1) {
			return vulnerabilities;
		}

		return vulnerabilities.filter((vuln) => {
			const vulnIndex = severityOrder.indexOf(vuln.severity);
			return vulnIndex >= thresholdIndex;
		});
	}

	/**
	 * Get platform-specific recommendations
	 */
	protected getPlatformRecommendations(
		vulnerabilities: PlatformVulnerability[]
	): string[] {
		const recommendations: string[] = [];
		const vulnTypes = new Set(vulnerabilities.map((v) => v.type));

		// Add platform-specific recommendations based on vulnerability types
		for (const type of vulnTypes) {
			const recommendation = this.getRecommendationForVulnerabilityType(type);
			if (recommendation && !recommendations.includes(recommendation)) {
				recommendations.push(recommendation);
			}
		}

		return recommendations;
	}

	/**
	 * Get recommendation for a specific vulnerability type (to be overridden by subclasses)
	 */
	protected getRecommendationForVulnerabilityType(type: string): string | null {
		// Default recommendations
		const defaultRecommendations: Record<string, string> = {
			reentrancy:
				"Implement checks-effects-interactions pattern and use reentrancy guards",
			access_control:
				"Implement proper access control mechanisms and role-based permissions",
			overflow: "Use safe math libraries or built-in overflow protection",
			gas_optimization:
				"Review gas usage patterns and optimize contract efficiency",
			best_practice:
				"Follow platform-specific coding standards and best practices",
		};

		return defaultRecommendations[type] || null;
	}

	/**
	 * Handle analysis errors with platform-specific context
	 */
	protected handleAnalysisError(
		error: any,
		contracts: ContractInput[]
	): PlatformError {
		if ((error as PlatformError).platform) {
			return error as PlatformError;
		}

		// Check for tool-specific errors
		if (
			error.message?.includes("not found") ||
			error.message?.includes("command not found")
		) {
			return handleToolError("analyzer", this.platform, error, {
				contracts: contracts.map((c) => c.filename),
			});
		}

		// Check for timeout errors
		if (
			error.message?.includes("timeout") ||
			error.message?.includes("timed out")
		) {
			return createPlatformError(
				"TOOL_EXECUTION_TIMEOUT",
				`Analysis timed out after ${this.timeout}ms`,
				this.platform,
				{
					timeout: this.timeout,
					contracts: contracts.map((c) => c.filename),
				}
			);
		}

		// Generic analysis error
		return createPlatformError(
			"ANALYZER_UNAVAILABLE",
			error instanceof Error ? error.message : "Analysis failed",
			this.platform,
			{
				originalError: error,
				contracts: contracts.map((c) => c.filename),
			}
		);
	}

	/**
	 * Execute with timeout and error handling
	 */
	protected async executeWithErrorHandling<T>(
		operation: () => Promise<T>,
		operationName: string,
		context?: any
	): Promise<T> {
		try {
			return await this.createTimeoutPromise(operation());
		} catch (error) {
			this.logError(`${operationName} failed`, { error, context });

			// Handle specific error types
			if (error instanceof Error) {
				if (error.message.includes("timeout")) {
					throw createPlatformError(
						"TOOL_EXECUTION_TIMEOUT",
						`${operationName} timed out`,
						this.platform,
						{ operation: operationName, context }
					);
				}

				if (error.message.includes("not found")) {
					throw createPlatformError(
						"TOOL_INSTALLATION_MISSING",
						`Required tool not found for ${operationName}`,
						this.platform,
						{ operation: operationName, context }
					);
				}
			}

			throw createPlatformError(
				"TOOL_EXECUTION_FAILED",
				`${operationName} failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				this.platform,
				{ operation: operationName, context, originalError: error }
			);
		}
	}
}
