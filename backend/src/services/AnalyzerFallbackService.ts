import {
	ContractInput,
	AnalysisResult,
	PlatformVulnerability,
	BlockchainAnalyzer,
	AnalysisOptions,
} from "../types/blockchain";
import { logger } from "../utils/logger";
import {
	createPlatformError,
	handleAnalyzerFailure,
	retryAnalysis,
	PlatformError,
} from "../middleware/MultiChainErrorHandler";
import { platformValidationService } from "./PlatformValidationService";
import { AIAnalyzer } from "./AIAnalyzer";

/**
 * Fallback strategy types
 */
export type FallbackStrategy =
	| "ai-only"
	| "basic-validation"
	| "skip-platform"
	| "partial-analysis"
	| "cached-results"
	| "minimal"
	| "none";

/**
 * Fallback configuration for different scenarios
 */
export interface FallbackConfig {
	enableAIFallback: boolean;
	enableBasicValidation: boolean;
	enablePartialAnalysis: boolean;
	enableCachedResults: boolean;
	skipFailedPlatforms: boolean;
	maxRetryAttempts: number;
	retryDelayMs: number;
	timeoutMs: number;
}

/**
 * Analysis attempt result
 */
interface AnalysisAttempt {
	attempt: number;
	strategy: FallbackStrategy;
	success: boolean;
	result?: AnalysisResult;
	error?: PlatformError;
	executionTime: number;
	fallbackReason?: string;
}

/**
 * Fallback analysis result
 */
export interface FallbackAnalysisResult extends AnalysisResult {
	fallbackStrategy: FallbackStrategy;
	attempts: AnalysisAttempt[];
	originalError?: PlatformError;
	degradationLevel: "none" | "partial" | "significant" | "minimal";
	availableFeatures: string[];
	unavailableFeatures: string[];
}

/**
 * Service for handling analyzer failures with graceful degradation
 */
export class AnalyzerFallbackService {
	private static instance: AnalyzerFallbackService;
	private aiAnalyzer: AIAnalyzer;
	private resultCache: Map<string, AnalysisResult> = new Map();
	private readonly cacheTimeout = 10 * 60 * 1000; // 10 minutes

	private constructor() {
		this.aiAnalyzer = new AIAnalyzer({
			timeout: 60000,
			maxTokens: 4000,
			temperature: 0.1,
		});
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(): AnalyzerFallbackService {
		if (!AnalyzerFallbackService.instance) {
			AnalyzerFallbackService.instance = new AnalyzerFallbackService();
		}
		return AnalyzerFallbackService.instance;
	}

	/**
	 * Analyze contracts with fallback mechanisms
	 */
	public async analyzeWithFallback(
		analyzer: BlockchainAnalyzer,
		contracts: ContractInput[],
		options: AnalysisOptions,
		fallbackConfig: Partial<FallbackConfig> = {}
	): Promise<FallbackAnalysisResult> {
		const config = this.mergeConfig(fallbackConfig);
		const attempts: AnalysisAttempt[] = [];
		const startTime = Date.now();

		logger.info("Starting analysis with fallback support", {
			platform: analyzer.platform,
			contractCount: contracts.length,
			config,
		});

		// Attempt 1: Primary analysis with retry
		const primaryResult = await this.attemptPrimaryAnalysis(
			analyzer,
			contracts,
			options,
			config
		);
		attempts.push(primaryResult);

		if (primaryResult.success && primaryResult.result) {
			return this.createFallbackResult(
				primaryResult.result,
				"none",
				attempts,
				Date.now() - startTime
			);
		}

		// Attempt 2: AI-only fallback
		if (config.enableAIFallback) {
			const aiResult = await this.attemptAIFallback(
				analyzer.platform,
				contracts,
				options,
				primaryResult.error
			);
			attempts.push(aiResult);

			if (aiResult.success && aiResult.result) {
				return this.createFallbackResult(
					aiResult.result,
					"partial",
					attempts,
					Date.now() - startTime,
					primaryResult.error
				);
			}
		}

		// Attempt 3: Basic validation fallback
		if (config.enableBasicValidation) {
			const validationResult = await this.attemptBasicValidationFallback(
				analyzer.platform,
				contracts,
				primaryResult.error
			);
			attempts.push(validationResult);

			if (validationResult.success && validationResult.result) {
				return this.createFallbackResult(
					validationResult.result,
					"significant",
					attempts,
					Date.now() - startTime,
					primaryResult.error
				);
			}
		}

		// Attempt 4: Cached results fallback
		if (config.enableCachedResults) {
			const cachedResult = await this.attemptCachedResultsFallback(
				analyzer.platform,
				contracts,
				primaryResult.error
			);
			attempts.push(cachedResult);

			if (cachedResult.success && cachedResult.result) {
				return this.createFallbackResult(
					cachedResult.result,
					"partial",
					attempts,
					Date.now() - startTime,
					primaryResult.error
				);
			}
		}

		// Attempt 5: Minimal analysis (always succeeds)
		const minimalResult = await this.attemptMinimalAnalysis(
			analyzer.platform,
			contracts,
			primaryResult.error
		);
		attempts.push(minimalResult);

		return this.createFallbackResult(
			minimalResult.result!,
			"minimal",
			attempts,
			Date.now() - startTime,
			primaryResult.error
		);
	}

	/**
	 * Attempt primary analysis with retry logic
	 */
	private async attemptPrimaryAnalysis(
		analyzer: BlockchainAnalyzer,
		contracts: ContractInput[],
		options: AnalysisOptions,
		config: FallbackConfig
	): Promise<AnalysisAttempt> {
		const startTime = Date.now();

		try {
			const result = await retryAnalysis(
				() => analyzer.analyze(contracts),
				analyzer.platform,
				config.maxRetryAttempts
			);

			return {
				attempt: 1,
				strategy: "none",
				success: true,
				result,
				executionTime: Date.now() - startTime,
			};
		} catch (error) {
			const platformError = this.convertToPlatformError(
				error,
				analyzer.platform
			);

			return {
				attempt: 1,
				strategy: "none",
				success: false,
				error: platformError,
				executionTime: Date.now() - startTime,
				fallbackReason: "Primary analysis failed",
			};
		}
	}

	/**
	 * Attempt AI-only analysis as fallback
	 */
	private async attemptAIFallback(
		platform: string,
		contracts: ContractInput[],
		options: AnalysisOptions,
		originalError?: PlatformError
	): Promise<AnalysisAttempt> {
		const startTime = Date.now();

		try {
			logger.info("Attempting AI-only fallback", { platform });

			const vulnerabilities: PlatformVulnerability[] = [];
			const errors: string[] = [];
			const warnings: string[] = ["Analysis performed using AI-only fallback"];

			for (const contract of contracts) {
				try {
					const aiResult = await this.aiAnalyzer.analyzePlatformContract(
						contract,
						{
							platform,
							includeRecommendations: true,
							includeQualityMetrics: true,
							focusAreas: this.getPlatformFocusAreas(platform),
						}
					);

					if (aiResult.success && aiResult.result) {
						vulnerabilities.push(...aiResult.result.vulnerabilities);
					} else {
						errors.push(
							aiResult.error || `AI analysis failed for ${contract.filename}`
						);
					}
				} catch (error) {
					errors.push(
						`AI analysis error for ${contract.filename}: ${
							error instanceof Error ? error.message : "Unknown error"
						}`
					);
				}
			}

			const result: AnalysisResult = {
				success: vulnerabilities.length > 0 || errors.length === 0,
				vulnerabilities,
				errors,
				warnings,
				executionTime: Date.now() - startTime,
				platformSpecific: {
					fallbackStrategy: "ai-only",
					originalError: originalError?.message,
					analysisMethod: "AI-based security analysis",
					limitations: [
						"Static analysis tools unavailable",
						"Results based on AI pattern recognition only",
						"May miss tool-specific vulnerabilities",
					],
				},
			};

			return {
				attempt: 2,
				strategy: "ai-only",
				success: result.success,
				result,
				executionTime: Date.now() - startTime,
				fallbackReason: "Static analysis tools unavailable",
			};
		} catch (error) {
			return {
				attempt: 2,
				strategy: "ai-only",
				success: false,
				error: this.convertToPlatformError(error, platform),
				executionTime: Date.now() - startTime,
				fallbackReason: "AI fallback failed",
			};
		}
	}

	/**
	 * Attempt basic validation as fallback
	 */
	private async attemptBasicValidationFallback(
		platform: string,
		contracts: ContractInput[],
		originalError?: PlatformError
	): Promise<AnalysisAttempt> {
		const startTime = Date.now();

		try {
			logger.info("Attempting basic validation fallback", { platform });

			const vulnerabilities: PlatformVulnerability[] = [];
			const errors: string[] = [];
			const warnings: string[] = [
				"Analysis performed using basic validation only",
			];

			for (const contract of contracts) {
				try {
					const validationResult =
						await platformValidationService.validateContract(contract, {
							strictMode: false,
						});

					// Convert validation errors to vulnerabilities
					for (const error of validationResult.errors) {
						vulnerabilities.push({
							type: "validation-error",
							severity: "medium",
							title: "Validation Error",
							description: error,
							location: {
								file: contract.filename,
								line: 1,
								column: 1,
							},
							recommendation:
								"Fix validation errors to ensure contract correctness",
							confidence: 0.9,
							source: "static",
							platform,
						});
					}

					// Add warnings as low-severity vulnerabilities
					for (const warning of validationResult.warnings) {
						vulnerabilities.push({
							type: "validation-warning",
							severity: "low",
							title: "Validation Warning",
							description: warning,
							location: {
								file: contract.filename,
								line: 1,
								column: 1,
							},
							recommendation:
								"Consider addressing this warning for better code quality",
							confidence: 0.7,
							source: "static",
							platform,
						});
					}
				} catch (error) {
					errors.push(
						`Validation failed for ${contract.filename}: ${
							error instanceof Error ? error.message : "Unknown error"
						}`
					);
				}
			}

			const result: AnalysisResult = {
				success: true, // Basic validation always succeeds
				vulnerabilities,
				errors,
				warnings,
				executionTime: Date.now() - startTime,
				platformSpecific: {
					fallbackStrategy: "basic-validation",
					originalError: originalError?.message,
					analysisMethod: "Basic contract validation",
					limitations: [
						"No static analysis performed",
						"No AI-based vulnerability detection",
						"Limited to syntax and structure validation",
					],
				},
			};

			return {
				attempt: 3,
				strategy: "basic-validation",
				success: true,
				result,
				executionTime: Date.now() - startTime,
				fallbackReason: "Full analysis unavailable",
			};
		} catch (error) {
			return {
				attempt: 3,
				strategy: "basic-validation",
				success: false,
				error: this.convertToPlatformError(error, platform),
				executionTime: Date.now() - startTime,
				fallbackReason: "Basic validation failed",
			};
		}
	}

	/**
	 * Attempt to use cached results as fallback
	 */
	private async attemptCachedResultsFallback(
		platform: string,
		contracts: ContractInput[],
		originalError?: PlatformError
	): Promise<AnalysisAttempt> {
		const startTime = Date.now();

		try {
			logger.info("Attempting cached results fallback", { platform });

			const cachedResults: AnalysisResult[] = [];
			const errors: string[] = [];

			for (const contract of contracts) {
				const cacheKey = this.generateCacheKey(contract);
				const cached = this.resultCache.get(cacheKey);

				if (cached && this.isCacheValid(cached)) {
					cachedResults.push(cached);
				} else {
					errors.push(`No valid cached results for ${contract.filename}`);
				}
			}

			if (cachedResults.length === 0) {
				throw new Error("No cached results available");
			}

			// Merge cached results
			const mergedResult = this.mergeCachedResults(
				cachedResults,
				platform,
				originalError
			);

			return {
				attempt: 4,
				strategy: "cached-results",
				success: true,
				result: mergedResult,
				executionTime: Date.now() - startTime,
				fallbackReason: "Using previously cached analysis results",
			};
		} catch (error) {
			return {
				attempt: 4,
				strategy: "cached-results",
				success: false,
				error: this.convertToPlatformError(error, platform),
				executionTime: Date.now() - startTime,
				fallbackReason: "No valid cached results available",
			};
		}
	}

	/**
	 * Attempt minimal analysis (always succeeds)
	 */
	private async attemptMinimalAnalysis(
		platform: string,
		contracts: ContractInput[],
		originalError?: PlatformError
	): Promise<AnalysisAttempt> {
		const startTime = Date.now();

		// Minimal analysis always succeeds with basic information
		const result: AnalysisResult = {
			success: true,
			vulnerabilities: [],
			errors: [],
			warnings: [
				"Analysis completed with minimal functionality",
				"Full security analysis unavailable",
				"Manual review recommended",
			],
			executionTime: Date.now() - startTime,
			platformSpecific: {
				fallbackStrategy: "minimal",
				originalError: originalError?.message,
				analysisMethod: "Minimal contract information extraction",
				contractsProcessed: contracts.length,
				totalLinesOfCode: contracts.reduce(
					(total, contract) => total + contract.code.split("\n").length,
					0
				),
				limitations: [
					"No vulnerability detection performed",
					"No static analysis available",
					"No AI analysis available",
					"Manual security review required",
				],
				recommendations: [
					"Resolve analyzer installation issues",
					"Perform manual security review",
					"Use alternative analysis tools",
					"Contact support for assistance",
				],
			},
		};

		return {
			attempt: 5,
			strategy: "minimal",
			success: true,
			result,
			executionTime: Date.now() - startTime,
			fallbackReason: "All other analysis methods failed",
		};
	}

	/**
	 * Create fallback analysis result
	 */
	private createFallbackResult(
		result: AnalysisResult,
		degradationLevel: "none" | "partial" | "significant" | "minimal",
		attempts: AnalysisAttempt[],
		totalExecutionTime: number,
		originalError?: PlatformError
	): FallbackAnalysisResult {
		const successfulAttempt = attempts.find((a) => a.success);
		const fallbackStrategy = successfulAttempt?.strategy || "none";

		return {
			...result,
			fallbackStrategy,
			attempts,
			originalError,
			degradationLevel,
			availableFeatures: this.getAvailableFeatures(fallbackStrategy),
			unavailableFeatures: this.getUnavailableFeatures(fallbackStrategy),
			executionTime: totalExecutionTime,
			platformSpecific: {
				...result.platformSpecific,
				fallbackAnalysis: {
					totalAttempts: attempts.length,
					successfulStrategy: fallbackStrategy,
					degradationLevel,
					originalFailure: originalError?.message,
				},
			},
		};
	}

	/**
	 * Get available features for fallback strategy
	 */
	private getAvailableFeatures(strategy: FallbackStrategy): string[] {
		switch (strategy) {
			case "none":
				return [
					"Static Analysis",
					"AI Analysis",
					"Vulnerability Detection",
					"Best Practices",
				];
			case "ai-only":
				return [
					"AI Analysis",
					"Pattern Recognition",
					"Basic Vulnerability Detection",
				];
			case "basic-validation":
				return [
					"Syntax Validation",
					"Structure Validation",
					"Basic Error Detection",
				];
			case "cached-results":
				return ["Previous Analysis Results", "Historical Vulnerability Data"];
			case "minimal":
				return ["Basic Contract Information", "File Structure Analysis"];
			default:
				return [];
		}
	}

	/**
	 * Get unavailable features for fallback strategy
	 */
	private getUnavailableFeatures(strategy: FallbackStrategy): string[] {
		switch (strategy) {
			case "none":
				return [];
			case "ai-only":
				return ["Static Analysis Tools", "Platform-Specific Analyzers"];
			case "basic-validation":
				return [
					"Static Analysis",
					"AI Analysis",
					"Advanced Vulnerability Detection",
				];
			case "cached-results":
				return ["Real-time Analysis", "Current Code Analysis"];
			case "minimal":
				return [
					"Vulnerability Detection",
					"Security Analysis",
					"Code Quality Assessment",
				];
			default:
				return ["All Analysis Features"];
		}
	}

	/**
	 * Get platform-specific focus areas for AI analysis
	 */
	private getPlatformFocusAreas(platform: string): string[] {
		const focusAreas: Record<string, string[]> = {
			ethereum: [
				"solidity-security",
				"evm-patterns",
				"gas-optimization",
				"reentrancy",
			],
			solana: [
				"rust-security",
				"anchor-patterns",
				"pda-validation",
				"account-model",
			],
			cardano: [
				"haskell-security",
				"plutus-patterns",
				"utxo-model",
				"datum-validation",
			],
			move: ["move-security", "resource-patterns", "capability-security"],
		};

		return focusAreas[platform] || ["general-security", "best-practices"];
	}

	/**
	 * Merge default configuration with provided config
	 */
	private mergeConfig(config: Partial<FallbackConfig>): FallbackConfig {
		return {
			enableAIFallback: config.enableAIFallback ?? true,
			enableBasicValidation: config.enableBasicValidation ?? true,
			enablePartialAnalysis: config.enablePartialAnalysis ?? true,
			enableCachedResults: config.enableCachedResults ?? true,
			skipFailedPlatforms: config.skipFailedPlatforms ?? false,
			maxRetryAttempts: config.maxRetryAttempts ?? 3,
			retryDelayMs: config.retryDelayMs ?? 1000,
			timeoutMs: config.timeoutMs ?? 120000,
		};
	}

	/**
	 * Convert generic error to platform error
	 */
	private convertToPlatformError(error: any, platform: string): PlatformError {
		if ((error as PlatformError).platform) {
			return error as PlatformError;
		}

		return createPlatformError(
			"ANALYZER_UNAVAILABLE",
			error instanceof Error ? error.message : "Analysis failed",
			platform,
			{ originalError: error }
		);
	}

	/**
	 * Generate cache key for contract
	 */
	private generateCacheKey(contract: ContractInput): string {
		const content = `${contract.platform}-${contract.filename}-${contract.code}`;
		return this.simpleHash(content);
	}

	/**
	 * Check if cached result is still valid
	 */
	private isCacheValid(result: AnalysisResult): boolean {
		const cachedAt = (result as any).cachedAt;
		if (!cachedAt) return false;

		const age = Date.now() - cachedAt;
		return age < this.cacheTimeout;
	}

	/**
	 * Merge multiple cached results
	 */
	private mergeCachedResults(
		results: AnalysisResult[],
		platform: string,
		originalError?: PlatformError
	): AnalysisResult {
		const mergedVulnerabilities: PlatformVulnerability[] = [];
		const mergedErrors: string[] = [];
		const mergedWarnings: string[] = ["Using cached analysis results"];

		for (const result of results) {
			mergedVulnerabilities.push(...result.vulnerabilities);
			mergedErrors.push(...result.errors);
			mergedWarnings.push(...result.warnings);
		}

		return {
			success: true,
			vulnerabilities: mergedVulnerabilities,
			errors: mergedErrors,
			warnings: mergedWarnings,
			executionTime: 0,
			platformSpecific: {
				fallbackStrategy: "cached-results",
				originalError: originalError?.message,
				cachedResultsUsed: results.length,
				analysisMethod: "Previously cached analysis results",
			},
		};
	}

	/**
	 * Simple hash function
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(16);
	}

	/**
	 * Cache analysis result
	 */
	public cacheResult(contract: ContractInput, result: AnalysisResult): void {
		const cacheKey = this.generateCacheKey(contract);
		const cacheEntry = {
			...result,
			cachedAt: Date.now(),
		};
		this.resultCache.set(cacheKey, cacheEntry);
	}

	/**
	 * Clear result cache
	 */
	public clearCache(): void {
		this.resultCache.clear();
		logger.info("Analyzer fallback cache cleared");
	}
}

// Export singleton instance
export const analyzerFallbackService = AnalyzerFallbackService.getInstance();
