import {
	ContractInput,
	ValidationResult,
	BlockchainPlatform,
	ValidationRule,
} from "../types/blockchain";
import { blockchainRegistry } from "./BlockchainRegistry";
import { logger } from "../utils/logger";
import {
	createPlatformError,
	PlatformError,
	PlatformErrorTypes,
} from "../middleware/MultiChainErrorHandler";

/**
 * Enhanced validation result with platform-specific context
 */
export interface PlatformValidationResult extends ValidationResult {
	platform: string;
	detectedLanguage?: string;
	confidence?: number;
	platformSpecificData?: Record<string, any>;
	suggestions?: string[];
}

/**
 * Validation rule execution result
 */
interface ValidationRuleResult {
	ruleId: string;
	ruleName: string;
	passed: boolean;
	errors: string[];
	warnings: string[];
	executionTime: number;
	platformSpecificData?: Record<string, any>;
}

/**
 * Service for platform-specific contract validation with enhanced error handling
 */
export class PlatformValidationService {
	private static instance: PlatformValidationService;
	private validationCache: Map<string, PlatformValidationResult> = new Map();
	private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	public static getInstance(): PlatformValidationService {
		if (!PlatformValidationService.instance) {
			PlatformValidationService.instance = new PlatformValidationService();
		}
		return PlatformValidationService.instance;
	}

	/**
	 * Validate contract with comprehensive platform-specific checks
	 */
	public async validateContract(
		contract: ContractInput,
		options: {
			skipCache?: boolean;
			strictMode?: boolean;
			enablePlatformDetection?: boolean;
		} = {}
	): Promise<PlatformValidationResult> {
		const startTime = Date.now();

		try {
			// Check cache first
			if (!options.skipCache) {
				const cached = this.getCachedValidation(contract);
				if (cached) {
					logger.debug("Using cached validation result", {
						platform: contract.platform,
						filename: contract.filename,
					});
					return cached;
				}
			}

			// Detect platform if not specified or if detection is enabled
			let targetPlatform = contract.platform;
			let detectedLanguage: string | undefined;
			let confidence: number | undefined;

			if (!targetPlatform || options.enablePlatformDetection) {
				const detectionResult = await this.detectPlatform(contract);
				if (detectionResult) {
					targetPlatform = detectionResult.platform;
					detectedLanguage = detectionResult.language;
					confidence = detectionResult.confidence;
				}
			}

			if (!targetPlatform) {
				throw createPlatformError(
					"PLATFORM_DETECTION_FAILED",
					"Unable to detect blockchain platform for contract",
					undefined,
					{
						filename: contract.filename,
						codeLength: contract.code.length,
					}
				);
			}

			// Get platform configuration
			const platform = blockchainRegistry.getPlatform(targetPlatform);
			if (!platform) {
				throw createPlatformError(
					"PLATFORM_NOT_SUPPORTED",
					`Platform '${targetPlatform}' is not supported`,
					targetPlatform,
					{
						availablePlatforms: blockchainRegistry
							.getSupportedPlatforms()
							.map((p) => p.id),
					}
				);
			}

			// Perform validation
			const validationResult = await this.performPlatformValidation(
				contract,
				platform,
				options.strictMode || false
			);

			// Enhance result with platform context
			const enhancedResult: PlatformValidationResult = {
				...validationResult,
				platform: targetPlatform,
				detectedLanguage,
				confidence,
				platformSpecificData: {
					...validationResult.platformSpecificData,
					executionTime: Date.now() - startTime,
					validationRulesExecuted: platform.validationRules.length,
					cacheKey: this.generateCacheKey(contract),
				},
				suggestions: this.generateValidationSuggestions(
					validationResult,
					platform
				),
			};

			// Cache the result
			this.cacheValidationResult(contract, enhancedResult);

			logger.info("Contract validation completed", {
				platform: targetPlatform,
				filename: contract.filename,
				isValid: enhancedResult.isValid,
				errorCount: enhancedResult.errors.length,
				warningCount: enhancedResult.warnings.length,
				executionTime: Date.now() - startTime,
			});

			return enhancedResult;
		} catch (error) {
			logger.error("Contract validation failed", {
				platform: contract.platform,
				filename: contract.filename,
				error: error instanceof Error ? error.message : error,
				executionTime: Date.now() - startTime,
			});

			// Handle validation errors gracefully
			if (error instanceof Error && (error as PlatformError).platform) {
				throw error; // Re-throw platform errors as-is
			}

			// Convert generic errors to platform errors
			throw createPlatformError(
				"PLATFORM_DETECTION_FAILED",
				`Validation failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
				contract.platform,
				{
					originalError: error,
					filename: contract.filename,
				}
			);
		}
	}

	/**
	 * Validate multiple contracts with batch processing
	 */
	public async validateContracts(
		contracts: ContractInput[],
		options: {
			skipCache?: boolean;
			strictMode?: boolean;
			enablePlatformDetection?: boolean;
			continueOnError?: boolean;
		} = {}
	): Promise<{
		results: PlatformValidationResult[];
		errors: PlatformError[];
		summary: {
			total: number;
			valid: number;
			invalid: number;
			errors: number;
		};
	}> {
		const results: PlatformValidationResult[] = [];
		const errors: PlatformError[] = [];

		logger.info("Starting batch contract validation", {
			contractCount: contracts.length,
			options,
		});

		for (const contract of contracts) {
			try {
				const result = await this.validateContract(contract, options);
				results.push(result);
			} catch (error) {
				const platformError = error as PlatformError;
				errors.push(platformError);

				if (!options.continueOnError) {
					break;
				}

				// Add a failed validation result for tracking
				results.push({
					isValid: false,
					errors: [platformError.message],
					warnings: [],
					platform: contract.platform || "unknown",
					suggestions: ["Fix validation errors and try again"],
				});
			}
		}

		const summary = {
			total: contracts.length,
			valid: results.filter((r) => r.isValid).length,
			invalid: results.filter((r) => !r.isValid).length,
			errors: errors.length,
		};

		logger.info("Batch validation completed", summary);

		return { results, errors, summary };
	}

	/**
	 * Detect platform from contract code
	 */
	private async detectPlatform(contract: ContractInput): Promise<{
		platform: string;
		language: string;
		confidence: number;
	} | null> {
		try {
			const detectionResults = blockchainRegistry.detectPlatform(
				contract.code,
				contract.filename
			);

			if (detectionResults.length === 0) {
				return null;
			}

			const bestMatch = detectionResults[0];
			const language = this.detectLanguage(contract.code, bestMatch.platform);

			return {
				platform: bestMatch.platform.id,
				language,
				confidence: bestMatch.confidence,
			};
		} catch (error) {
			logger.warn("Platform detection failed", {
				filename: contract.filename,
				error: error instanceof Error ? error.message : error,
			});
			return null;
		}
	}

	/**
	 * Detect programming language from code
	 */
	private detectLanguage(code: string, platform: BlockchainPlatform): string {
		// Check for language-specific patterns
		if (code.includes("pragma solidity") || code.includes("contract ")) {
			return "solidity";
		}

		if (code.includes("use anchor_lang") || code.includes("#[program]")) {
			return "rust";
		}

		if (code.includes("import Plutus") || code.includes("validator")) {
			return "haskell";
		}

		if (code.includes("module ") && code.includes("public fun")) {
			return "move";
		}

		// Fallback to platform's primary language
		return platform.supportedLanguages[0] || "unknown";
	}

	/**
	 * Perform platform-specific validation
	 */
	private async performPlatformValidation(
		contract: ContractInput,
		platform: BlockchainPlatform,
		strictMode: boolean
	): Promise<
		ValidationResult & { platformSpecificData?: Record<string, any> }
	> {
		const errors: string[] = [];
		const warnings: string[] = [];
		const ruleResults: ValidationRuleResult[] = [];
		const platformSpecificData: Record<string, any> = {};

		// Basic contract validation
		const basicValidation = this.performBasicValidation(contract);
		errors.push(...basicValidation.errors);
		warnings.push(...basicValidation.warnings);

		// Execute platform-specific validation rules
		for (const rule of platform.validationRules) {
			try {
				const ruleResult = await this.executeValidationRule(
					rule,
					contract,
					strictMode
				);
				ruleResults.push(ruleResult);

				if (!ruleResult.passed) {
					errors.push(...ruleResult.errors);
					warnings.push(...ruleResult.warnings);
				}

				// Collect platform-specific data
				if (ruleResult.platformSpecificData) {
					platformSpecificData[rule.id] = ruleResult.platformSpecificData;
				}
			} catch (error) {
				const errorMessage = `Validation rule '${rule.name}' failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`;

				if (strictMode) {
					errors.push(errorMessage);
				} else {
					warnings.push(errorMessage);
				}

				logger.warn("Validation rule execution failed", {
					ruleId: rule.id,
					ruleName: rule.name,
					platform: platform.id,
					error: error instanceof Error ? error.message : error,
				});
			}
		}

		// Add execution summary to platform data
		platformSpecificData.executionSummary = {
			rulesExecuted: ruleResults.length,
			rulesPassed: ruleResults.filter((r) => r.passed).length,
			rulesFailed: ruleResults.filter((r) => !r.passed).length,
			totalExecutionTime: ruleResults.reduce(
				(sum, r) => sum + r.executionTime,
				0
			),
		};

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			platformSpecificData,
		};
	}

	/**
	 * Perform basic contract validation
	 */
	private performBasicValidation(contract: ContractInput): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check if contract code is provided
		if (!contract.code || contract.code.trim().length === 0) {
			errors.push("Contract code cannot be empty");
		}

		// Check file size (10MB limit)
		const maxSize = 10 * 1024 * 1024;
		if (Buffer.byteLength(contract.code, "utf8") > maxSize) {
			errors.push(`Contract size exceeds maximum limit of ${maxSize} bytes`);
		}

		// Check for suspicious patterns
		if (contract.code.includes("eval(") || contract.code.includes("exec(")) {
			warnings.push(
				"Contract contains potentially dangerous code execution patterns"
			);
		}

		// Check for very long lines (potential minified code)
		const lines = contract.code.split("\n");
		const longLines = lines.filter((line) => line.length > 500);
		if (longLines.length > 0) {
			warnings.push(
				`Contract contains ${longLines.length} very long lines (>500 chars)`
			);
		}

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Execute a single validation rule
	 */
	private async executeValidationRule(
		rule: ValidationRule,
		contract: ContractInput,
		strictMode: boolean
	): Promise<ValidationRuleResult> {
		const startTime = Date.now();

		try {
			const result = rule.validator(contract.code, contract.filename);

			return {
				ruleId: rule.id,
				ruleName: rule.name,
				passed: result.isValid,
				errors: result.errors,
				warnings: result.warnings,
				executionTime: Date.now() - startTime,
				platformSpecificData: {
					ruleDescription: rule.description,
					pattern: rule.pattern,
				},
			};
		} catch (error) {
			return {
				ruleId: rule.id,
				ruleName: rule.name,
				passed: false,
				errors: strictMode
					? [
							`Rule execution failed: ${
								error instanceof Error ? error.message : "Unknown error"
							}`,
					  ]
					: [],
				warnings: !strictMode
					? [
							`Rule execution failed: ${
								error instanceof Error ? error.message : "Unknown error"
							}`,
					  ]
					: [],
				executionTime: Date.now() - startTime,
			};
		}
	}

	/**
	 * Generate validation suggestions based on results
	 */
	private generateValidationSuggestions(
		result: ValidationResult,
		platform: BlockchainPlatform
	): string[] {
		const suggestions: string[] = [];

		if (!result.isValid) {
			suggestions.push(
				`Review and fix ${result.errors.length} validation error(s)`
			);
		}

		if (result.warnings.length > 0) {
			suggestions.push(
				`Consider addressing ${result.warnings.length} warning(s) for better code quality`
			);
		}

		// Platform-specific suggestions
		switch (platform.id) {
			case "ethereum":
				suggestions.push("Ensure Solidity version compatibility");
				suggestions.push("Validate all contract dependencies");
				break;
			case "solana":
				suggestions.push("Check Anchor framework usage and constraints");
				suggestions.push("Validate account model and PDA usage");
				break;
			case "cardano":
				suggestions.push("Verify Plutus script structure and types");
				suggestions.push("Check UTXO model implementation");
				break;
		}

		if (suggestions.length === 0) {
			suggestions.push("Contract validation passed successfully");
		}

		return suggestions;
	}

	/**
	 * Cache validation result
	 */
	private cacheValidationResult(
		contract: ContractInput,
		result: PlatformValidationResult
	): void {
		const cacheKey = this.generateCacheKey(contract);
		const cacheEntry = {
			...result,
			cachedAt: Date.now(),
		};

		this.validationCache.set(cacheKey, cacheEntry);

		// Clean up old cache entries
		this.cleanupCache();
	}

	/**
	 * Get cached validation result
	 */
	private getCachedValidation(
		contract: ContractInput
	): PlatformValidationResult | null {
		const cacheKey = this.generateCacheKey(contract);
		const cached = this.validationCache.get(cacheKey);

		if (!cached) {
			return null;
		}

		// Check if cache entry is still valid
		const now = Date.now();
		const cacheAge = now - (cached as any).cachedAt;

		if (cacheAge > this.cacheTimeout) {
			this.validationCache.delete(cacheKey);
			return null;
		}

		return cached;
	}

	/**
	 * Generate cache key for contract
	 */
	private generateCacheKey(contract: ContractInput): string {
		const content = `${contract.platform}-${contract.filename}-${contract.code}`;
		return this.simpleHash(content);
	}

	/**
	 * Simple hash function for cache keys
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
	 * Clean up expired cache entries
	 */
	private cleanupCache(): void {
		const now = Date.now();
		const keysToDelete: string[] = [];

		for (const [key, entry] of this.validationCache.entries()) {
			const cacheAge = now - (entry as any).cachedAt;
			if (cacheAge > this.cacheTimeout) {
				keysToDelete.push(key);
			}
		}

		for (const key of keysToDelete) {
			this.validationCache.delete(key);
		}

		if (keysToDelete.length > 0) {
			logger.debug(`Cleaned up ${keysToDelete.length} expired cache entries`);
		}
	}

	/**
	 * Clear validation cache
	 */
	public clearCache(): void {
		this.validationCache.clear();
		logger.info("Validation cache cleared");
	}

	/**
	 * Get cache statistics
	 */
	public getCacheStats(): {
		size: number;
		hitRate: number;
		oldestEntry: number;
	} {
		const now = Date.now();
		let oldestEntry = now;

		for (const entry of this.validationCache.values()) {
			const entryAge = (entry as any).cachedAt;
			if (entryAge < oldestEntry) {
				oldestEntry = entryAge;
			}
		}

		return {
			size: this.validationCache.size,
			hitRate: 0, // Would need to track hits/misses for accurate calculation
			oldestEntry: now - oldestEntry,
		};
	}
}

// Export singleton instance
export const platformValidationService =
	PlatformValidationService.getInstance();
