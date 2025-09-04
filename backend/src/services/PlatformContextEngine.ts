import {
	BlockchainPlatform,
	ContractInput,
	PlatformVulnerability,
} from "../types/blockchain";
import { AIVulnerability, SecurityRecommendation } from "../types/database";
import { blockchainRegistry } from "./BlockchainRegistry";
import { logger } from "../utils/logger";

/**
 * Platform-specific context for AI analysis
 */
export interface PlatformContext {
	platform: string;
	contextPrompts: string[];
	vulnerabilityMappings: VulnerabilityMapping[];
	bestPractices: string[];
	securityPatterns: SecurityPattern[];
	analysisInstructions: string;
}

/**
 * Mapping between platform-specific findings and standardized format
 */
export interface VulnerabilityMapping {
	platformSpecificType: string;
	standardizedType:
		| "reentrancy"
		| "overflow"
		| "access_control"
		| "gas_optimization"
		| "best_practice"
		| "security";
	severityMapping: Record<
		string,
		"critical" | "high" | "medium" | "low" | "informational"
	>;
	descriptionTemplate: string;
	recommendationTemplate: string;
}

/**
 * Platform-specific security patterns
 */
export interface SecurityPattern {
	name: string;
	description: string;
	detectionPattern: string | RegExp;
	severity: "critical" | "high" | "medium" | "low" | "informational";
	recommendation: string;
}

/**
 * Enhanced AI analysis options with platform context
 */
export interface PlatformAIAnalysisOptions {
	platform: string;
	includeRecommendations?: boolean;
	includeQualityMetrics?: boolean;
	focusAreas?: string[];
	severityThreshold?: "low" | "medium" | "high" | "critical";
	customContext?: string[];
}

/**
 * Platform Context Engine for AI Analysis
 *
 * This engine provides blockchain-specific context to AI models for more accurate
 * and relevant security analysis. It includes platform-specific prompts, vulnerability
 * mappings, and best practices.
 */
export class PlatformContextEngine {
	private platformContexts: Map<string, PlatformContext> = new Map();
	private vulnerabilityMappings: Map<string, VulnerabilityMapping[]> =
		new Map();

	constructor() {
		this.initializePlatformContexts();
	}

	/**
	 * Get platform-specific context for AI analysis
	 */
	public getPlatformContext(platformId: string): PlatformContext | null {
		return this.platformContexts.get(platformId) || null;
	}

	/**
	 * Create enhanced analysis prompt with platform-specific context
	 */
	public createPlatformAnalysisPrompt(
		contract: ContractInput,
		options: PlatformAIAnalysisOptions = { platform: contract.platform }
	): string {
		const platform = blockchainRegistry.getPlatform(contract.platform);
		const context = this.getPlatformContext(contract.platform);

		if (!platform || !context) {
			logger.warn(
				`No platform context found for ${contract.platform}, using generic prompt`
			);
			return this.createGenericPrompt(contract, options);
		}

		const basePrompt = this.createBasePrompt(platform, contract, options);
		const contextPrompts = context.contextPrompts.join("\n\n");
		const securityPatterns = this.formatSecurityPatterns(
			context.securityPatterns
		);
		const bestPractices = this.formatBestPractices(context.bestPractices);
		const analysisInstructions = context.analysisInstructions;

		return `${basePrompt}

${contextPrompts}

PLATFORM-SPECIFIC SECURITY PATTERNS:
${securityPatterns}

BEST PRACTICES FOR ${platform.name.toUpperCase()}:
${bestPractices}

ANALYSIS INSTRUCTIONS:
${analysisInstructions}

CONTRACT CODE:
\`\`\`${this.getLanguageForPlatform(contract.platform)}
${contract.code}
\`\`\`

Focus Areas: ${
			options.focusAreas?.join(", ") || "comprehensive security analysis"
		}

IMPORTANT: Provide analysis in the following JSON format only:
{
  "vulnerabilities": [
    {
      "type": "platform_specific_type",
      "severity": "critical|high|medium|low|informational",
      "description": "Detailed description of the vulnerability",
      "location": {
        "file": "${contract.filename}",
        "line": 1,
        "column": 1,
        "length": 10
      },
      "confidence": 0.95
    }
  ],
  "recommendations": [
    {
      "category": "Security",
      "priority": "high|medium|low",
      "description": "Recommendation description",
      "implementation_guide": "Step-by-step implementation guide"
    }
  ],
  "qualityMetrics": {
    "code_quality_score": 85,
    "maintainability_index": 75,
    "test_coverage_estimate": 60
  },
  "confidence": 0.88
}`;
	}

	/**
	 * Map platform-specific vulnerabilities to standardized format
	 */
	public mapVulnerabilities(
		platformVulnerabilities: any[],
		platformId: string
	): PlatformVulnerability[] {
		const mappings = this.vulnerabilityMappings.get(platformId) || [];
		const standardizedVulns: PlatformVulnerability[] = [];

		for (const vuln of platformVulnerabilities) {
			const mapping = this.findVulnerabilityMapping(vuln.type, mappings);

			if (mapping) {
				const standardizedVuln: PlatformVulnerability = {
					type: mapping.standardizedType,
					severity: this.mapSeverity(vuln.severity, mapping.severityMapping),
					title: this.generateTitle(vuln, mapping),
					description: this.generateDescription(vuln, mapping),
					location: vuln.location,
					recommendation: this.generateRecommendation(vuln, mapping),
					confidence: vuln.confidence || 0.8,
					source: "ai",
					platform: platformId,
					platformSpecificData: {
						originalType: vuln.type,
						platformSpecific: true,
						mappingUsed: mapping.platformSpecificType,
					},
				};

				standardizedVulns.push(standardizedVuln);
			} else {
				// If no mapping found, use generic mapping
				const genericVuln: PlatformVulnerability = {
					type: this.inferStandardType(vuln.type),
					severity: vuln.severity || "medium",
					title: vuln.description?.substring(0, 100) || "Security Issue",
					description:
						vuln.description || "Platform-specific security issue detected",
					location: vuln.location,
					recommendation: this.getGenericRecommendation(vuln.type),
					confidence: vuln.confidence || 0.6,
					source: "ai",
					platform: platformId,
					platformSpecificData: {
						originalType: vuln.type,
						platformSpecific: true,
						mappingUsed: "generic",
					},
				};

				standardizedVulns.push(genericVuln);
			}
		}

		return standardizedVulns;
	}

	/**
	 * Get platform-specific best practices and recommendations
	 */
	public getPlatformRecommendations(
		vulnerabilities: PlatformVulnerability[],
		platformId: string
	): SecurityRecommendation[] {
		const context = this.getPlatformContext(platformId);
		if (!context) {
			return [];
		}

		const recommendations: SecurityRecommendation[] = [];
		const vulnTypes = new Set(vulnerabilities.map((v) => v.type));

		// Add general platform best practices
		for (const practice of context.bestPractices) {
			recommendations.push({
				category: `${
					platformId.charAt(0).toUpperCase() + platformId.slice(1)
				} Best Practices`,
				priority: "medium",
				description: practice,
				implementation_guide: `Follow ${platformId} documentation and community guidelines for implementing this best practice.`,
			});
		}

		// Add vulnerability-specific recommendations
		for (const vulnType of vulnTypes) {
			const specificRec = this.getVulnerabilitySpecificRecommendation(
				vulnType,
				platformId
			);
			if (specificRec) {
				recommendations.push(specificRec);
			}
		}

		return recommendations;
	}

	/**
	 * Initialize platform-specific contexts
	 */
	private initializePlatformContexts(): void {
		// Ethereum/EVM Context
		this.platformContexts.set("ethereum", {
			platform: "ethereum",
			contextPrompts: [
				"You are analyzing Ethereum/EVM smart contracts written in Solidity.",
				"Focus on EVM-specific vulnerabilities including reentrancy, gas optimization, and MEV risks.",
				"Consider Ethereum's account model, transaction ordering, and gas mechanics.",
				"Pay attention to common Solidity patterns and OpenZeppelin standards.",
			],
			vulnerabilityMappings: this.getEthereumVulnerabilityMappings(),
			bestPractices: [
				"Use ReentrancyGuard from OpenZeppelin for state-changing external calls",
				"Follow checks-effects-interactions pattern",
				"Use SafeMath or Solidity 0.8+ for arithmetic operations",
				"Implement proper access control with role-based permissions",
				"Validate all external inputs and use require statements",
				"Consider gas optimization for frequently called functions",
				"Use events for important state changes",
				"Implement emergency pause mechanisms for critical contracts",
			],
			securityPatterns: [
				{
					name: "Reentrancy Guard",
					description: "Prevent reentrancy attacks in state-changing functions",
					detectionPattern: /function\s+\w+.*external.*{[\s\S]*?\.call\(/,
					severity: "high",
					recommendation:
						"Use ReentrancyGuard modifier or checks-effects-interactions pattern",
				},
				{
					name: "Access Control",
					description: "Ensure proper access control on sensitive functions",
					detectionPattern: /function\s+\w+.*public.*{(?![\s\S]*require\()/,
					severity: "medium",
					recommendation:
						"Add appropriate access control modifiers or require statements",
				},
			],
			analysisInstructions: `
Analyze this Solidity contract for:
1. Reentrancy vulnerabilities (check for external calls before state changes)
2. Access control issues (missing onlyOwner, role checks)
3. Integer overflow/underflow (if not using Solidity 0.8+)
4. Gas optimization opportunities
5. Best practice violations
6. MEV (Maximal Extractable Value) risks
7. Front-running vulnerabilities
8. Timestamp dependence issues
9. Unhandled exceptions and failed calls
10. Proper event emission for state changes`,
		});

		// Solana Context
		this.platformContexts.set("solana", {
			platform: "solana",
			contextPrompts: [
				"You are analyzing Solana programs written in Rust, potentially using the Anchor framework.",
				"Focus on Solana's account model, PDA security, and compute unit optimization.",
				"Consider Solana-specific patterns like account validation, signer checks, and CPI security.",
				"Pay attention to Anchor constraints and proper account relationships.",
			],
			vulnerabilityMappings: this.getSolanaVulnerabilityMappings(),
			bestPractices: [
				"Always validate account ownership and signers",
				"Use canonical bump seeds for PDA derivation",
				"Implement proper account constraints in Anchor programs",
				"Validate all account relationships and data integrity",
				"Use checked arithmetic to prevent overflow/underflow",
				"Optimize compute unit usage to avoid transaction failures",
				"Ensure proper rent exemption handling",
				"Validate cross-program invocation (CPI) security",
				"Use proper error handling instead of panic!",
				"Implement comprehensive account validation",
			],
			securityPatterns: [
				{
					name: "PDA Security",
					description: "Ensure secure Program Derived Address usage",
					detectionPattern: /Pubkey::find_program_address/,
					severity: "high",
					recommendation: "Use canonical bump seeds and validate PDA ownership",
				},
				{
					name: "Account Validation",
					description: "Validate account ownership and signers",
					detectionPattern: /AccountInfo.*(?!.*is_signer)/,
					severity: "medium",
					recommendation: "Add proper account validation and signer checks",
				},
			],
			analysisInstructions: `
Analyze this Solana program for:
1. Account model security (ownership, signers, validation)
2. PDA (Program Derived Address) security and canonical bumps
3. Cross-program invocation (CPI) security
4. Compute unit optimization
5. Anchor framework compliance (if applicable)
6. Integer overflow/underflow protection
7. Proper error handling (avoid panic!)
8. Rent exemption handling
9. Account data validation and integrity
10. Signer verification and access control`,
		});

		// Cardano Context
		this.platformContexts.set("cardano", {
			platform: "cardano",
			contextPrompts: [
				"You are analyzing Cardano smart contracts written in Plutus/Haskell.",
				"Focus on UTXO model security, datum validation, and script efficiency.",
				"Consider Cardano's eUTXO model and proper validator implementation.",
				"Pay attention to Plutus Core optimization and resource usage.",
			],
			vulnerabilityMappings: this.getCardanoVulnerabilityMappings(),
			bestPractices: [
				"Validate all datums and redeemers thoroughly",
				"Implement proper UTXO handling and validation",
				"Optimize Plutus script execution costs",
				"Use proper type safety and validation",
				"Ensure deterministic script execution",
				"Validate script context and transaction info",
				"Implement proper error handling",
				"Consider script size and execution limits",
				"Use appropriate Plutus version features",
				"Validate all inputs and outputs",
			],
			securityPatterns: [
				{
					name: "UTXO Validation",
					description: "Proper UTXO model validation",
					detectionPattern: /TxInfo|ScriptContext/,
					severity: "high",
					recommendation: "Implement comprehensive UTXO validation logic",
				},
				{
					name: "Datum Validation",
					description: "Validate datum structure and content",
					detectionPattern: /BuiltinData/,
					severity: "medium",
					recommendation: "Add proper datum validation and type checking",
				},
			],
			analysisInstructions: `
Analyze this Plutus script for:
1. UTXO model security and validation
2. Datum and redeemer validation
3. Script context validation
4. Plutus script efficiency and optimization
5. Type safety and proper error handling
6. Deterministic execution
7. Resource usage and script limits
8. Transaction validation logic
9. Proper use of Plutus primitives
10. eUTXO model compliance`,
		});

		// Initialize vulnerability mappings
		this.initializeVulnerabilityMappings();

		logger.info("Platform contexts initialized for AI analysis");
	}

	/**
	 * Initialize vulnerability mappings for each platform
	 */
	private initializeVulnerabilityMappings(): void {
		this.vulnerabilityMappings.set(
			"ethereum",
			this.getEthereumVulnerabilityMappings()
		);
		this.vulnerabilityMappings.set(
			"solana",
			this.getSolanaVulnerabilityMappings()
		);
		this.vulnerabilityMappings.set(
			"cardano",
			this.getCardanoVulnerabilityMappings()
		);
	}

	/**
	 * Get Ethereum vulnerability mappings
	 */
	private getEthereumVulnerabilityMappings(): VulnerabilityMapping[] {
		return [
			{
				platformSpecificType: "reentrancy-eth",
				standardizedType: "reentrancy",
				severityMapping: {
					critical: "critical",
					high: "high",
					medium: "medium",
					low: "low",
				},
				descriptionTemplate:
					"Reentrancy vulnerability detected in Ethereum contract: {description}",
				recommendationTemplate:
					"Use ReentrancyGuard and follow checks-effects-interactions pattern",
			},
			{
				platformSpecificType: "access-control-missing",
				standardizedType: "access_control",
				severityMapping: {
					critical: "high",
					high: "high",
					medium: "medium",
					low: "low",
				},
				descriptionTemplate:
					"Access control issue in Ethereum contract: {description}",
				recommendationTemplate:
					"Implement proper access control using OpenZeppelin's AccessControl or Ownable",
			},
			{
				platformSpecificType: "integer-overflow",
				standardizedType: "overflow",
				severityMapping: {
					critical: "high",
					high: "high",
					medium: "medium",
					low: "low",
				},
				descriptionTemplate: "Integer overflow/underflow risk: {description}",
				recommendationTemplate:
					"Use SafeMath library or Solidity 0.8+ built-in overflow protection",
			},
			{
				platformSpecificType: "gas-optimization",
				standardizedType: "gas_optimization",
				severityMapping: {
					high: "medium",
					medium: "low",
					low: "informational",
				},
				descriptionTemplate: "Gas optimization opportunity: {description}",
				recommendationTemplate:
					"Optimize gas usage by implementing suggested improvements",
			},
			{
				platformSpecificType: "best-practice-violation",
				standardizedType: "best_practice",
				severityMapping: {
					high: "medium",
					medium: "low",
					low: "informational",
				},
				descriptionTemplate: "Solidity best practice violation: {description}",
				recommendationTemplate:
					"Follow Solidity style guide and best practices",
			},
		];
	}

	/**
	 * Get Solana vulnerability mappings
	 */
	private getSolanaVulnerabilityMappings(): VulnerabilityMapping[] {
		return [
			{
				platformSpecificType: "pda-security",
				standardizedType: "security",
				severityMapping: {
					critical: "critical",
					high: "high",
					medium: "medium",
					low: "low",
				},
				descriptionTemplate:
					"PDA security issue in Solana program: {description}",
				recommendationTemplate:
					"Use canonical bump seeds and validate PDA ownership properly",
			},
			{
				platformSpecificType: "account-validation",
				standardizedType: "access_control",
				severityMapping: {
					critical: "high",
					high: "high",
					medium: "medium",
					low: "low",
				},
				descriptionTemplate: "Account validation issue: {description}",
				recommendationTemplate:
					"Implement comprehensive account ownership and signer validation",
			},
			{
				platformSpecificType: "anchor-constraints",
				standardizedType: "best_practice",
				severityMapping: {
					high: "medium",
					medium: "low",
					low: "informational",
				},
				descriptionTemplate: "Anchor constraint issue: {description}",
				recommendationTemplate:
					"Use proper Anchor constraints to validate account relationships",
			},
			{
				platformSpecificType: "compute-optimization",
				standardizedType: "gas_optimization",
				severityMapping: {
					high: "medium",
					medium: "low",
					low: "informational",
				},
				descriptionTemplate:
					"Compute unit optimization opportunity: {description}",
				recommendationTemplate:
					"Optimize compute unit usage to prevent transaction failures",
			},
			{
				platformSpecificType: "cpi-security",
				standardizedType: "security",
				severityMapping: {
					critical: "high",
					high: "high",
					medium: "medium",
					low: "low",
				},
				descriptionTemplate:
					"Cross-program invocation security issue: {description}",
				recommendationTemplate:
					"Validate all accounts in cross-program invocations",
			},
		];
	}

	/**
	 * Get Cardano vulnerability mappings
	 */
	private getCardanoVulnerabilityMappings(): VulnerabilityMapping[] {
		return [
			{
				platformSpecificType: "utxo-validation",
				standardizedType: "security",
				severityMapping: {
					critical: "critical",
					high: "high",
					medium: "medium",
					low: "low",
				},
				descriptionTemplate:
					"UTXO validation issue in Plutus script: {description}",
				recommendationTemplate: "Implement proper UTXO validation logic",
			},
			{
				platformSpecificType: "datum-validation",
				standardizedType: "access_control",
				severityMapping: {
					critical: "high",
					high: "high",
					medium: "medium",
					low: "low",
				},
				descriptionTemplate: "Datum validation issue: {description}",
				recommendationTemplate:
					"Add comprehensive datum validation and type checking",
			},
			{
				platformSpecificType: "script-efficiency",
				standardizedType: "gas_optimization",
				severityMapping: {
					high: "medium",
					medium: "low",
					low: "informational",
				},
				descriptionTemplate: "Plutus script efficiency issue: {description}",
				recommendationTemplate:
					"Optimize script execution to reduce costs and improve performance",
			},
			{
				platformSpecificType: "plutus-best-practice",
				standardizedType: "best_practice",
				severityMapping: {
					high: "medium",
					medium: "low",
					low: "informational",
				},
				descriptionTemplate: "Plutus best practice violation: {description}",
				recommendationTemplate:
					"Follow Plutus development best practices and guidelines",
			},
		];
	}

	/**
	 * Create base prompt for platform analysis
	 */
	private createBasePrompt(
		platform: BlockchainPlatform,
		contract: ContractInput,
		options: PlatformAIAnalysisOptions
	): string {
		return `You are an expert ${
			platform.name
		} smart contract security auditor with deep knowledge of ${platform.supportedLanguages.join(
			", "
		)} and ${platform.name}-specific security patterns.

Contract: ${contract.filename}
Platform: ${platform.displayName}
Languages: ${platform.supportedLanguages.join(", ")}

Your task is to perform a comprehensive security analysis focusing on ${
			platform.name
		}-specific vulnerabilities and best practices.`;
	}

	/**
	 * Create generic prompt for unsupported platforms
	 */
	private createGenericPrompt(
		contract: ContractInput,
		options: PlatformAIAnalysisOptions
	): string {
		return `You are an expert smart contract security auditor. Analyze the following contract for security vulnerabilities and best practices.

Contract: ${contract.filename}
Platform: ${contract.platform}

CONTRACT CODE:
\`\`\`
${contract.code}
\`\`\`

Focus on general security patterns including:
1. Access control issues
2. Input validation
3. State management
4. Error handling
5. Best practice violations

Provide analysis in JSON format with vulnerabilities, recommendations, and quality metrics.`;
	}

	/**
	 * Format security patterns for prompt
	 */
	private formatSecurityPatterns(patterns: SecurityPattern[]): string {
		return patterns
			.map(
				(pattern) =>
					`- ${pattern.name}: ${pattern.description} (${pattern.severity} severity)`
			)
			.join("\n");
	}

	/**
	 * Format best practices for prompt
	 */
	private formatBestPractices(practices: string[]): string {
		return practices
			.map((practice, index) => `${index + 1}. ${practice}`)
			.join("\n");
	}

	/**
	 * Get programming language for platform
	 */
	private getLanguageForPlatform(platformId: string): string {
		const platform = blockchainRegistry.getPlatform(platformId);
		return platform?.supportedLanguages[0] || "text";
	}

	/**
	 * Find vulnerability mapping for a specific type
	 */
	private findVulnerabilityMapping(
		vulnType: string,
		mappings: VulnerabilityMapping[]
	): VulnerabilityMapping | null {
		return (
			mappings.find(
				(mapping) =>
					mapping.platformSpecificType === vulnType ||
					vulnType.includes(mapping.platformSpecificType)
			) || null
		);
	}

	/**
	 * Map severity using platform-specific mapping
	 */
	private mapSeverity(
		originalSeverity: string,
		severityMapping: Record<string, string>
	): "critical" | "high" | "medium" | "low" | "informational" {
		const mapped = severityMapping[originalSeverity.toLowerCase()];
		if (
			mapped &&
			["critical", "high", "medium", "low", "informational"].includes(mapped)
		) {
			return mapped as "critical" | "high" | "medium" | "low" | "informational";
		}
		return "medium"; // Default fallback
	}

	/**
	 * Generate title from vulnerability and mapping
	 */
	private generateTitle(vuln: any, mapping: VulnerabilityMapping): string {
		return (
			vuln.title ||
			vuln.description?.substring(0, 100) ||
			mapping.platformSpecificType
		);
	}

	/**
	 * Generate description from vulnerability and mapping
	 */
	private generateDescription(
		vuln: any,
		mapping: VulnerabilityMapping
	): string {
		return mapping.descriptionTemplate.replace(
			"{description}",
			vuln.description || "Security issue detected"
		);
	}

	/**
	 * Generate recommendation from vulnerability and mapping
	 */
	private generateRecommendation(
		vuln: any,
		mapping: VulnerabilityMapping
	): string {
		return vuln.recommendation || mapping.recommendationTemplate;
	}

	/**
	 * Infer standard type from platform-specific type
	 */
	private inferStandardType(
		platformType: string
	):
		| "reentrancy"
		| "overflow"
		| "access_control"
		| "gas_optimization"
		| "best_practice"
		| "security" {
		const type = platformType.toLowerCase();

		if (type.includes("reentrancy")) return "reentrancy";
		if (type.includes("overflow") || type.includes("underflow"))
			return "overflow";
		if (
			type.includes("access") ||
			type.includes("auth") ||
			type.includes("permission")
		)
			return "access_control";
		if (
			type.includes("gas") ||
			type.includes("optimization") ||
			type.includes("efficiency")
		)
			return "gas_optimization";
		if (
			type.includes("practice") ||
			type.includes("style") ||
			type.includes("convention")
		)
			return "best_practice";

		return "security"; // Default fallback
	}

	/**
	 * Get generic recommendation for unknown vulnerability types
	 */
	private getGenericRecommendation(vulnType: string): string {
		return `Review and address the ${vulnType} issue following platform-specific security best practices.`;
	}

	/**
	 * Get vulnerability-specific recommendation for platform
	 */
	private getVulnerabilitySpecificRecommendation(
		vulnType: string,
		platformId: string
	): SecurityRecommendation | null {
		const recommendations: Record<
			string,
			Record<string, SecurityRecommendation>
		> = {
			ethereum: {
				reentrancy: {
					category: "Ethereum Security",
					priority: "high",
					description:
						"Implement reentrancy protection for all state-changing functions",
					implementation_guide:
						"Use OpenZeppelin's ReentrancyGuard or implement checks-effects-interactions pattern",
				},
				access_control: {
					category: "Ethereum Security",
					priority: "high",
					description: "Implement proper access control mechanisms",
					implementation_guide:
						"Use OpenZeppelin's AccessControl, Ownable, or custom role-based permissions",
				},
			},
			solana: {
				security: {
					category: "Solana Security",
					priority: "high",
					description:
						"Implement comprehensive account validation and PDA security",
					implementation_guide:
						"Validate account ownership, use canonical bump seeds, and implement proper signer checks",
				},
				access_control: {
					category: "Solana Security",
					priority: "high",
					description: "Implement proper account-based access control",
					implementation_guide:
						"Use Anchor constraints or manual account validation to control access",
				},
			},
			cardano: {
				security: {
					category: "Cardano Security",
					priority: "high",
					description: "Implement proper UTXO validation and script security",
					implementation_guide:
						"Validate all UTXOs, datums, and script context thoroughly",
				},
			},
		};

		return recommendations[platformId]?.[vulnType] || null;
	}
}

// Export singleton instance
export const platformContextEngine = new PlatformContextEngine();
