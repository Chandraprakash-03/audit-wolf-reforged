import {
	BlockchainPlatform,
	DetectionPattern,
	PlatformDetectionResult,
	ValidationResult,
	ContractInput,
	PlatformConfiguration,
} from "../types/blockchain";
import { logger } from "../utils/logger";

/**
 * Registry for managing blockchain platforms and their configurations
 */
export class BlockchainRegistry {
	private platforms: Map<string, BlockchainPlatform> = new Map();
	private configurations: Map<string, PlatformConfiguration> = new Map();
	private static instance: BlockchainRegistry;

	private constructor() {
		this.initializeDefaultPlatforms();
	}

	/**
	 * Get singleton instance of BlockchainRegistry
	 */
	public static getInstance(): BlockchainRegistry {
		if (!BlockchainRegistry.instance) {
			BlockchainRegistry.instance = new BlockchainRegistry();
		}
		return BlockchainRegistry.instance;
	}

	/**
	 * Register a new blockchain platform
	 */
	public registerPlatform(platform: BlockchainPlatform): void {
		if (this.platforms.has(platform.id)) {
			logger.warn(
				`Platform ${platform.id} is already registered. Overwriting.`
			);
		}

		this.platforms.set(platform.id, platform);
		logger.info(
			`Registered blockchain platform: ${platform.name} (${platform.id})`
		);
	}

	/**
	 * Get a platform by ID
	 */
	public getPlatform(id: string): BlockchainPlatform | undefined {
		return this.platforms.get(id);
	}

	/**
	 * Get all registered platforms
	 */
	public getSupportedPlatforms(): BlockchainPlatform[] {
		return Array.from(this.platforms.values()).filter(
			(platform) => platform.isActive
		);
	}

	/**
	 * Get all platforms (including inactive ones)
	 */
	public getAllPlatforms(): BlockchainPlatform[] {
		return Array.from(this.platforms.values());
	}

	/**
	 * Detect blockchain platform(s) from contract code and filename
	 */
	public detectPlatform(
		code: string,
		filename?: string
	): PlatformDetectionResult[] {
		const results: PlatformDetectionResult[] = [];

		for (const platform of this.platforms.values()) {
			if (!platform.isActive) continue;

			const confidence = this.calculatePlatformConfidence(
				platform,
				code,
				filename
			);
			if (confidence > 0) {
				const matchedPatterns = this.getMatchedPatterns(
					platform,
					code,
					filename
				);
				results.push({
					platform,
					confidence,
					matchedPatterns,
				});
			}
		}

		// Sort by confidence (highest first)
		return results.sort((a, b) => b.confidence - a.confidence);
	}

	/**
	 * Detect the most likely platform for a contract
	 */
	public detectPrimaryPlatform(
		code: string,
		filename?: string
	): PlatformDetectionResult | null {
		const results = this.detectPlatform(code, filename);
		return results.length > 0 ? results[0] : null;
	}

	/**
	 * Validate contract against platform-specific rules
	 */
	public validateContract(contract: ContractInput): ValidationResult {
		const platform = this.getPlatform(contract.platform);
		if (!platform) {
			return {
				isValid: false,
				errors: [`Unknown platform: ${contract.platform}`],
				warnings: [],
			};
		}

		const errors: string[] = [];
		const warnings: string[] = [];

		// Check file extension
		if (contract.filename) {
			const extension = this.getFileExtension(contract.filename);
			if (!platform.fileExtensions.includes(extension)) {
				warnings.push(
					`File extension '${extension}' is not typical for ${
						platform.name
					}. Expected: ${platform.fileExtensions.join(", ")}`
				);
			}
		}

		// Run platform-specific validation rules
		for (const rule of platform.validationRules) {
			try {
				const result = rule.validator(contract.code, contract.filename);
				errors.push(...result.errors);
				warnings.push(...result.warnings);
			} catch (error) {
				logger.error(`Validation rule ${rule.id} failed:`, error);
				warnings.push(`Validation rule '${rule.name}' encountered an error`);
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Get platform configuration
	 */
	public getPlatformConfiguration(
		platformId: string
	): PlatformConfiguration | undefined {
		return this.configurations.get(platformId);
	}

	/**
	 * Update platform configuration
	 */
	public updatePlatformConfiguration(
		platformId: string,
		config: PlatformConfiguration
	): void {
		this.configurations.set(platformId, config);
		logger.info(`Updated configuration for platform: ${platformId}`);
	}

	/**
	 * Check if a platform supports a specific language
	 */
	public platformSupportsLanguage(
		platformId: string,
		language: string
	): boolean {
		const platform = this.getPlatform(platformId);
		return platform
			? platform.supportedLanguages.includes(language.toLowerCase())
			: false;
	}

	/**
	 * Get platforms that support a specific language
	 */
	public getPlatformsByLanguage(language: string): BlockchainPlatform[] {
		return this.getSupportedPlatforms().filter((platform) =>
			platform.supportedLanguages.includes(language.toLowerCase())
		);
	}

	/**
	 * Deactivate a platform
	 */
	public deactivatePlatform(platformId: string): boolean {
		const platform = this.getPlatform(platformId);
		if (platform) {
			platform.isActive = false;
			logger.info(`Deactivated platform: ${platformId}`);
			return true;
		}
		return false;
	}

	/**
	 * Activate a platform
	 */
	public activatePlatform(platformId: string): boolean {
		const platform = this.getPlatform(platformId);
		if (platform) {
			platform.isActive = true;
			logger.info(`Activated platform: ${platformId}`);
			return true;
		}
		return false;
	}

	/**
	 * Calculate confidence score for platform detection
	 */
	private calculatePlatformConfidence(
		platform: BlockchainPlatform,
		code: string,
		filename?: string
	): number {
		let totalWeight = 0;
		let matchedWeight = 0;

		for (const pattern of platform.detectionPatterns) {
			totalWeight += pattern.weight;

			if (this.matchesPattern(pattern, code, filename)) {
				matchedWeight += pattern.weight;
			}
		}

		return totalWeight > 0 ? matchedWeight / totalWeight : 0;
	}

	/**
	 * Get patterns that matched for a platform
	 */
	private getMatchedPatterns(
		platform: BlockchainPlatform,
		code: string,
		filename?: string
	): DetectionPattern[] {
		return platform.detectionPatterns.filter((pattern) =>
			this.matchesPattern(pattern, code, filename)
		);
	}

	/**
	 * Check if a pattern matches the code or filename
	 */
	private matchesPattern(
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
	 * Get file extension from filename
	 */
	private getFileExtension(filename: string): string {
		const lastDot = filename.lastIndexOf(".");
		return lastDot !== -1 ? filename.substring(lastDot) : "";
	}

	/**
	 * Initialize default blockchain platforms
	 */
	private initializeDefaultPlatforms(): void {
		// Ethereum/EVM Platform
		this.registerPlatform({
			id: "ethereum",
			name: "Ethereum",
			displayName: "Ethereum & EVM Compatible",
			description:
				"Ethereum Virtual Machine compatible blockchains including Ethereum, BSC, Polygon, Avalanche",
			supportedLanguages: ["solidity", "vyper"],
			fileExtensions: [".sol", ".vy"],
			staticAnalyzers: [], // Will be populated by specific analyzer implementations
			aiModels: [], // Will be populated by AI service
			validationRules: [
				{
					id: "solidity-pragma",
					name: "Solidity Pragma Check",
					description: "Validates Solidity pragma directive",
					validator: (code: string) => {
						const errors: string[] = [];
						const warnings: string[] = [];

						if (code.includes("pragma solidity")) {
							const pragmaMatch = code.match(/pragma\s+solidity\s+([^;]+);/);
							if (!pragmaMatch) {
								errors.push("Invalid pragma solidity directive");
							}
						} else if (
							code.includes("contract ") ||
							code.includes("interface ") ||
							code.includes("library ")
						) {
							warnings.push("Missing pragma solidity directive");
						}

						return { isValid: errors.length === 0, errors, warnings };
					},
				},
				{
					id: "contract-definition",
					name: "Contract Definition Check",
					description: "Validates contract, interface, or library definition",
					validator: (code: string) => {
						const errors: string[] = [];
						const warnings: string[] = [];

						const hasContract = /\b(contract|interface|library)\s+\w+/.test(
							code
						);
						if (!hasContract && code.trim().length > 0) {
							warnings.push(
								"No contract, interface, or library definition found"
							);
						}

						return { isValid: true, errors, warnings };
					},
				},
			],
			detectionPatterns: [
				{
					type: "pragma",
					pattern: /pragma\s+solidity/i,
					weight: 0.9,
					description: "Solidity pragma directive",
				},
				{
					type: "keyword",
					pattern: /\b(contract|interface|library)\s+\w+/,
					weight: 0.8,
					description: "Solidity contract/interface/library definition",
				},
				{
					type: "keyword",
					pattern: /\b(function|modifier|event|struct|enum)\b/,
					weight: 0.6,
					description: "Solidity keywords",
				},
				{
					type: "filename",
					pattern: /\.sol$/i,
					weight: 0.7,
					description: "Solidity file extension",
				},
				{
					type: "import",
					pattern: /import\s+["'].*\.sol["']/,
					weight: 0.5,
					description: "Solidity import statement",
				},
			],
			isActive: true,
			version: "1.0.0",
			documentation: "https://docs.soliditylang.org/",
			website: "https://ethereum.org/",
		});

		// Solana Platform
		this.registerPlatform({
			id: "solana",
			name: "Solana",
			displayName: "Solana",
			description: "Solana blockchain with Rust/Anchor smart contracts",
			supportedLanguages: ["rust"],
			fileExtensions: [".rs"],
			staticAnalyzers: [],
			aiModels: [],
			validationRules: [
				{
					id: "anchor-program",
					name: "Anchor Program Check",
					description: "Validates Anchor program structure",
					validator: (code: string) => {
						const errors: string[] = [];
						const warnings: string[] = [];

						if (code.includes("use anchor_lang::prelude::*")) {
							if (!code.includes("#[program]")) {
								warnings.push(
									"Anchor imports found but no #[program] attribute"
								);
							}
						}

						return { isValid: errors.length === 0, errors, warnings };
					},
				},
			],
			detectionPatterns: [
				{
					type: "import",
					pattern: /use\s+anchor_lang::/,
					weight: 0.9,
					description: "Anchor framework import",
				},
				{
					type: "keyword",
					pattern: /#\[program\]/,
					weight: 0.8,
					description: "Anchor program attribute",
				},
				{
					type: "keyword",
					pattern: /#\[(account|derive|instruction)\]/,
					weight: 0.7,
					description: "Anchor attributes",
				},
				{
					type: "keyword",
					pattern: /\b(Pubkey|AccountInfo|ProgramResult)\b/,
					weight: 0.6,
					description: "Solana program types",
				},
				{
					type: "filename",
					pattern: /\.rs$/i,
					weight: 0.3,
					description: "Rust file extension",
				},
			],
			isActive: true,
			version: "1.0.0",
			documentation: "https://docs.solana.com/",
			website: "https://solana.com/",
		});

		// Cardano Platform
		this.registerPlatform({
			id: "cardano",
			name: "Cardano",
			displayName: "Cardano",
			description: "Cardano blockchain with Plutus smart contracts",
			supportedLanguages: ["haskell", "plutus"],
			fileExtensions: [".hs", ".plutus"],
			staticAnalyzers: [],
			aiModels: [],
			validationRules: [
				{
					id: "plutus-validator",
					name: "Plutus Validator Check",
					description: "Validates Plutus validator structure",
					validator: (code: string) => {
						const errors: string[] = [];
						const warnings: string[] = [];

						if (code.includes("Plutus.V") || code.includes("PlutusTx")) {
							if (!code.includes("validator")) {
								warnings.push("Plutus imports found but no validator function");
							}
						}

						return { isValid: errors.length === 0, errors, warnings };
					},
				},
			],
			detectionPatterns: [
				{
					type: "import",
					pattern: /import\s+Plutus\./,
					weight: 0.9,
					description: "Plutus import",
				},
				{
					type: "import",
					pattern: /import\s+PlutusTx/,
					weight: 0.8,
					description: "PlutusTx import",
				},
				{
					type: "keyword",
					pattern: /\bvalidator\b/,
					weight: 0.7,
					description: "Validator function",
				},
				{
					type: "keyword",
					pattern: /\b(BuiltinData|ScriptContext|TxInfo)\b/,
					weight: 0.6,
					description: "Plutus types",
				},
				{
					type: "filename",
					pattern: /\.(hs|plutus)$/i,
					weight: 0.4,
					description: "Haskell/Plutus file extension",
				},
			],
			isActive: true,
			version: "1.0.0",
			documentation: "https://docs.cardano.org/plutus/",
			website: "https://cardano.org/",
		});

		// BSC Platform (EVM-compatible)
		this.registerPlatform({
			id: "bsc",
			name: "Binance Smart Chain",
			displayName: "Binance Smart Chain",
			description:
				"EVM-compatible blockchain with lower fees and faster transactions than Ethereum",
			supportedLanguages: ["solidity"],
			fileExtensions: [".sol"],
			staticAnalyzers: [],
			aiModels: [],
			validationRules: [
				{
					id: "solidity-pragma",
					name: "Solidity Pragma Check",
					description: "Validates Solidity pragma directive",
					validator: (code: string) => {
						const errors: string[] = [];
						const warnings: string[] = [];

						if (code.includes("pragma solidity")) {
							const pragmaMatch = code.match(/pragma\s+solidity\s+([^;]+);/);
							if (!pragmaMatch) {
								errors.push("Invalid pragma solidity directive");
							}
						} else if (
							code.includes("contract ") ||
							code.includes("interface ") ||
							code.includes("library ")
						) {
							warnings.push("Missing pragma solidity directive");
						}

						return { isValid: errors.length === 0, errors, warnings };
					},
				},
			],
			detectionPatterns: [
				{
					type: "pragma",
					pattern: /pragma\s+solidity/i,
					weight: 0.9,
					description: "Solidity pragma directive",
				},
				{
					type: "keyword",
					pattern: /\b(contract|interface|library)\s+\w+/,
					weight: 0.8,
					description: "Solidity contract/interface/library definition",
				},
			],
			isActive: true,
			version: "1.0.0",
			documentation: "https://docs.bnbchain.org/",
			website: "https://www.bnbchain.org/",
		});

		// Polygon Platform (EVM-compatible)
		this.registerPlatform({
			id: "polygon",
			name: "Polygon",
			displayName: "Polygon",
			description:
				"Layer 2 scaling solution for Ethereum with EVM compatibility and lower gas fees",
			supportedLanguages: ["solidity"],
			fileExtensions: [".sol"],
			staticAnalyzers: [],
			aiModels: [],
			validationRules: [
				{
					id: "solidity-pragma",
					name: "Solidity Pragma Check",
					description: "Validates Solidity pragma directive",
					validator: (code: string) => {
						const errors: string[] = [];
						const warnings: string[] = [];

						if (code.includes("pragma solidity")) {
							const pragmaMatch = code.match(/pragma\s+solidity\s+([^;]+);/);
							if (!pragmaMatch) {
								errors.push("Invalid pragma solidity directive");
							}
						} else if (
							code.includes("contract ") ||
							code.includes("interface ") ||
							code.includes("library ")
						) {
							warnings.push("Missing pragma solidity directive");
						}

						return { isValid: errors.length === 0, errors, warnings };
					},
				},
			],
			detectionPatterns: [
				{
					type: "pragma",
					pattern: /pragma\s+solidity/i,
					weight: 0.9,
					description: "Solidity pragma directive",
				},
				{
					type: "keyword",
					pattern: /\b(contract|interface|library)\s+\w+/,
					weight: 0.8,
					description: "Solidity contract/interface/library definition",
				},
			],
			isActive: true,
			version: "1.0.0",
			documentation: "https://docs.polygon.technology/",
			website: "https://polygon.technology/",
		});

		// Aptos Platform (Move-based)
		this.registerPlatform({
			id: "aptos",
			name: "Aptos",
			displayName: "Aptos",
			description:
				"Move-based blockchain focused on safety, scalability, and user experience",
			supportedLanguages: ["move"],
			fileExtensions: [".move"],
			staticAnalyzers: [],
			aiModels: [],
			validationRules: [
				{
					id: "move-module",
					name: "Move Module Check",
					description: "Validates Move module structure",
					validator: (code: string) => {
						const errors: string[] = [];
						const warnings: string[] = [];

						if (!code.includes("module ")) {
							warnings.push("No Move module definition found");
						}

						return { isValid: errors.length === 0, errors, warnings };
					},
				},
			],
			detectionPatterns: [
				{
					type: "keyword",
					pattern: /module\s+[\w:]+::\w+/,
					weight: 0.9,
					description: "Move module definition",
				},
				{
					type: "keyword",
					pattern: /\bresource\b/,
					weight: 0.8,
					description: "Resource type definition",
				},
				{
					type: "import",
					pattern: /use\s+aptos_framework::/,
					weight: 0.7,
					description: "Aptos framework import",
				},
			],
			isActive: true,
			version: "1.0.0",
			documentation: "https://aptos.dev/",
			website: "https://aptos.dev/",
		});

		// Sui Platform (Move-based)
		this.registerPlatform({
			id: "sui",
			name: "Sui",
			displayName: "Sui",
			description:
				"Object-centric Move blockchain with parallel execution and innovative consensus",
			supportedLanguages: ["move"],
			fileExtensions: [".move"],
			staticAnalyzers: [],
			aiModels: [],
			validationRules: [
				{
					id: "move-module",
					name: "Move Module Check",
					description: "Validates Move module structure",
					validator: (code: string) => {
						const errors: string[] = [];
						const warnings: string[] = [];

						if (!code.includes("module ")) {
							warnings.push("No Move module definition found");
						}

						return { isValid: errors.length === 0, errors, warnings };
					},
				},
			],
			detectionPatterns: [
				{
					type: "import",
					pattern: /use\s+sui::/,
					weight: 0.9,
					description: "Sui framework import",
				},
				{
					type: "keyword",
					pattern: /module\s+[\w:]+::\w+/,
					weight: 0.8,
					description: "Move module definition",
				},
				{
					type: "keyword",
					pattern: /\bresource\b/,
					weight: 0.7,
					description: "Resource type definition",
				},
			],
			isActive: true,
			version: "1.0.0",
			documentation: "https://docs.sui.io/",
			website: "https://sui.io/",
		});

		logger.info("Initialized default blockchain platforms");
	}
}

// Export singleton instance
export const blockchainRegistry = BlockchainRegistry.getInstance();
