import {
	ContractInput,
	PlatformDetectionResult,
	DetectionPattern,
	BlockchainPlatform,
} from "../types/blockchain";
import { blockchainRegistry } from "./BlockchainRegistry";
import { logger } from "../utils/logger";

/**
 * Service for detecting blockchain platforms from contract code
 */
export class PlatformDetectionService {
	private static readonly CONFIDENCE_THRESHOLD = 0.3;
	private static readonly HIGH_CONFIDENCE_THRESHOLD = 0.7;

	/**
	 * Detect platform for a single contract
	 */
	public static detectContractPlatform(
		code: string,
		filename?: string
	): PlatformDetectionResult | null {
		const results = blockchainRegistry.detectPlatform(code, filename);

		if (results.length === 0) {
			logger.warn("No platform detected for contract", { filename });
			return null;
		}

		const bestMatch = results[0];

		if (bestMatch.confidence < this.CONFIDENCE_THRESHOLD) {
			logger.warn("Low confidence platform detection", {
				filename,
				platform: bestMatch.platform.id,
				confidence: bestMatch.confidence,
			});
			return null;
		}

		logger.info("Platform detected", {
			filename,
			platform: bestMatch.platform.id,
			confidence: bestMatch.confidence,
		});

		return bestMatch;
	}

	/**
	 * Detect platforms for multiple contracts
	 */
	public static detectMultipleContractPlatforms(
		contracts: ContractInput[]
	): Map<string, PlatformDetectionResult> {
		const results = new Map<string, PlatformDetectionResult>();

		for (const contract of contracts) {
			const detection = this.detectContractPlatform(
				contract.code,
				contract.filename
			);
			if (detection) {
				results.set(contract.filename, detection);
			}
		}

		return results;
	}

	/**
	 * Auto-detect and assign platforms to contracts
	 */
	public static autoAssignPlatforms(
		contracts: ContractInput[]
	): ContractInput[] {
		return contracts.map((contract) => {
			if (contract.platform) {
				// Platform already specified
				return contract;
			}

			const detection = this.detectContractPlatform(
				contract.code,
				contract.filename
			);
			if (detection) {
				return {
					...contract,
					platform: detection.platform.id,
					language: this.detectLanguage(contract.code, detection.platform),
				};
			}

			// Default to Ethereum if no platform detected
			logger.warn("No platform detected, defaulting to Ethereum", {
				filename: contract.filename,
			});

			return {
				...contract,
				platform: "ethereum",
				language: "solidity",
			};
		});
	}

	/**
	 * Validate platform assignments for contracts
	 */
	public static validatePlatformAssignments(contracts: ContractInput[]): {
		valid: boolean;
		issues: string[];
	} {
		const issues: string[] = [];

		for (const contract of contracts) {
			const platform = blockchainRegistry.getPlatform(contract.platform);

			if (!platform) {
				issues.push(
					`Unknown platform '${contract.platform}' for contract ${contract.filename}`
				);
				continue;
			}

			if (!platform.isActive) {
				issues.push(
					`Platform '${contract.platform}' is not active for contract ${contract.filename}`
				);
				continue;
			}

			// Check if the detected platform matches the assigned platform
			const detection = this.detectContractPlatform(
				contract.code,
				contract.filename
			);
			if (detection && detection.confidence > this.HIGH_CONFIDENCE_THRESHOLD) {
				if (detection.platform.id !== contract.platform) {
					issues.push(
						`Platform mismatch for ${contract.filename}: assigned '${
							contract.platform
						}' but detected '${detection.platform.id}' with ${Math.round(
							detection.confidence * 100
						)}% confidence`
					);
				}
			}

			// Validate language support
			if (
				contract.language &&
				!platform.supportedLanguages.includes(contract.language)
			) {
				issues.push(
					`Language '${contract.language}' is not supported by platform '${contract.platform}' for contract ${contract.filename}`
				);
			}
		}

		return {
			valid: issues.length === 0,
			issues,
		};
	}

	/**
	 * Get platform recommendations for a contract
	 */
	public static getPlatformRecommendations(
		code: string,
		filename?: string
	): PlatformDetectionResult[] {
		const results = blockchainRegistry.detectPlatform(code, filename);

		return results.filter(
			(result) => result.confidence >= this.CONFIDENCE_THRESHOLD
		);
	}

	/**
	 * Detect the primary language of a contract
	 */
	public static detectLanguage(
		code: string,
		platform?: BlockchainPlatform
	): string {
		if (!platform) {
			// Try to detect language from code patterns
			if (/pragma\s+solidity/i.test(code)) return "solidity";
			if (/use\s+anchor_lang/i.test(code)) return "rust";
			if (/import\s+Plutus/i.test(code)) return "haskell";
			return "unknown";
		}

		// Use platform's primary language
		return platform.supportedLanguages[0] || "unknown";
	}

	/**
	 * Analyze detection patterns for debugging
	 */
	public static analyzeDetectionPatterns(
		code: string,
		filename?: string
	): {
		platform: string;
		patterns: { pattern: DetectionPattern; matched: boolean }[];
	}[] {
		const platforms = blockchainRegistry.getAllPlatforms();
		const analysis: {
			platform: string;
			patterns: { pattern: DetectionPattern; matched: boolean }[];
		}[] = [];

		for (const platform of platforms) {
			const patterns = platform.detectionPatterns.map((pattern) => ({
				pattern,
				matched: this.matchesPattern(pattern, code, filename),
			}));

			analysis.push({
				platform: platform.id,
				patterns,
			});
		}

		return analysis;
	}

	/**
	 * Get detection statistics
	 */
	public static getDetectionStatistics(): {
		totalPlatforms: number;
		activePlatforms: number;
		totalPatterns: number;
		patternsByType: Record<string, number>;
	} {
		const platforms = blockchainRegistry.getAllPlatforms();
		const activePlatforms = platforms.filter((p) => p.isActive);

		let totalPatterns = 0;
		const patternsByType: Record<string, number> = {};

		for (const platform of platforms) {
			totalPatterns += platform.detectionPatterns.length;

			for (const pattern of platform.detectionPatterns) {
				patternsByType[pattern.type] = (patternsByType[pattern.type] || 0) + 1;
			}
		}

		return {
			totalPlatforms: platforms.length,
			activePlatforms: activePlatforms.length,
			totalPatterns,
			patternsByType,
		};
	}

	/**
	 * Check if a pattern matches the code or filename
	 */
	private static matchesPattern(
		pattern: DetectionPattern,
		code: string,
		filename?: string
	): boolean {
		const target = pattern.type === "filename" ? filename || "" : code;

		if (pattern.pattern instanceof RegExp) {
			return pattern.pattern.test(target);
		} else {
			return target.includes(pattern.pattern);
		}
	}

	/**
	 * Suggest platform based on file extension
	 */
	public static suggestPlatformByExtension(
		filename: string
	): BlockchainPlatform[] {
		const extension = this.getFileExtension(filename);
		const platforms = blockchainRegistry.getSupportedPlatforms();

		return platforms.filter((platform) =>
			platform.fileExtensions.includes(extension)
		);
	}

	/**
	 * Get file extension from filename
	 */
	private static getFileExtension(filename: string): string {
		const lastDot = filename.lastIndexOf(".");
		return lastDot !== -1 ? filename.substring(lastDot) : "";
	}

	/**
	 * Batch process multiple files for platform detection
	 */
	public static batchDetectPlatforms(
		files: { filename: string; code: string }[]
	): Map<string, PlatformDetectionResult | null> {
		const results = new Map<string, PlatformDetectionResult | null>();

		for (const file of files) {
			const detection = this.detectContractPlatform(file.code, file.filename);
			results.set(file.filename, detection);
		}

		return results;
	}

	/**
	 * Get confidence threshold recommendations
	 */
	public static getConfidenceThresholds(): {
		minimum: number;
		recommended: number;
		high: number;
	} {
		return {
			minimum: this.CONFIDENCE_THRESHOLD,
			recommended: 0.5,
			high: this.HIGH_CONFIDENCE_THRESHOLD,
		};
	}
}
