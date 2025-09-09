import { BaseBlockchainAnalyzer } from "./BaseBlockchainAnalyzer";
import {
	ContractInput,
	AnalysisResult,
	ValidationResult,
	InstallationCheckResult,
	PlatformVulnerability,
} from "../../types/blockchain";
import { logger } from "../../utils/logger";
import { AIAnalyzer } from "../AIAnalyzer";
import { executePwsh } from "../../utils/shellUtils";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

/**
 * Move-specific vulnerability types
 */
export interface MoveVulnerability {
	type: string;
	severity: "critical" | "high" | "medium" | "low" | "informational";
	title: string;
	description: string;
	location: {
		file: string;
		line: number;
		column: number;
		length?: number;
	};
	recommendation: string;
	confidence: number;
	rawOutput?: any;
}

/**
 * Base Move analyzer for Move-based blockchains (Aptos, Sui)
 */
export abstract class MoveAnalyzer extends BaseBlockchainAnalyzer {
	protected aiAnalyzer: AIAnalyzer;
	protected tempDir: string;

	constructor(
		platform: string,
		options: { timeout?: number; maxFileSize?: number } = {}
	) {
		super(platform, options);

		this.aiAnalyzer = new AIAnalyzer({
			timeout: this.timeout,
			maxTokens: 4000,
			temperature: 0.1,
			models: ["moonshotai/kimi-k2:free", "z-ai/glm-4.5-air:free"],
		});

		this.tempDir = path.join(os.tmpdir(), `${platform}-analysis`);
	}

	/**
	 * Analyze Move contracts
	 */
	public async analyze(contracts: ContractInput[]): Promise<AnalysisResult> {
		const startTime = Date.now();
		this.logProgress(`Starting ${this.platform} contract analysis`, {
			contractCount: contracts.length,
		});

		try {
			// Validate all contracts first
			const validationResults = contracts.map((contract) =>
				this.validateContractInput(contract)
			);
			const hasErrors = validationResults.some((result) => !result.isValid);

			if (hasErrors) {
				const allErrors = validationResults.flatMap((result) => result.errors);
				return {
					success: false,
					vulnerabilities: [],
					errors: allErrors,
					warnings: [],
					executionTime: Date.now() - startTime,
				};
			}

			// Run static analysis
			const staticResult = await this.runStaticAnalysis(contracts);

			// Run AI analysis with Move-specific context (optional)
			let aiResult;
			try {
				aiResult = await this.runAIAnalysis(contracts);
			} catch (error) {
				// AI analysis is optional, continue with static analysis only
				this.logError(
					"AI analysis failed, continuing with static analysis only",
					error
				);
				aiResult = {
					success: true,
					vulnerabilities: [],
					errors: [],
					warnings: [
						"AI analysis unavailable - continuing with static analysis only",
					],
					executionTime: 0,
				};
			}

			// Combine results
			const combinedVulnerabilities = [
				...staticResult.vulnerabilities,
				...aiResult.vulnerabilities,
			];

			const combinedErrors = [...staticResult.errors, ...aiResult.errors];
			const combinedWarnings = [...staticResult.warnings, ...aiResult.warnings];

			return {
				success: combinedErrors.length === 0,
				vulnerabilities: combinedVulnerabilities,
				errors: combinedErrors,
				warnings: combinedWarnings,
				executionTime: Date.now() - startTime,
				platformSpecific: {
					moveVersion: await this.getMoveVersion(),
					contractsAnalyzed: contracts.length,
					totalLinesOfCode: contracts.reduce(
						(total, contract) => total + contract.code.split("\n").length,
						0
					),
				},
			};
		} catch (error) {
			this.logError(`${this.platform} analysis failed`, error);
			return {
				success: false,
				vulnerabilities: [],
				errors: [
					error instanceof Error ? error.message : "Unknown analysis error",
				],
				warnings: [],
				executionTime: Date.now() - startTime,
			};
		}
	}

	/**
	 * Run static analysis on Move contracts
	 */
	protected async runStaticAnalysis(
		contracts: ContractInput[]
	): Promise<AnalysisResult> {
		const vulnerabilities: PlatformVulnerability[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		for (const contract of contracts) {
			try {
				// Basic Move syntax validation
				const syntaxResult = await this.validateMoveSyntax(contract);
				vulnerabilities.push(...syntaxResult.vulnerabilities);
				errors.push(...syntaxResult.errors);
				warnings.push(...syntaxResult.warnings);

				// Move-specific security checks
				const securityResult = await this.runMoveSecurityChecks(contract);
				vulnerabilities.push(...securityResult.vulnerabilities);
				warnings.push(...securityResult.warnings);
			} catch (error) {
				this.logError(`Static analysis failed for ${contract.filename}`, error);
				errors.push(
					`Static analysis failed for ${contract.filename}: ${
						error instanceof Error ? error.message : "Unknown error"
					}`
				);
			}
		}

		return {
			success: errors.length === 0,
			vulnerabilities,
			errors,
			warnings,
			executionTime: 0,
		};
	}

	/**
	 * Run AI analysis on Move contracts
	 */
	protected async runAIAnalysis(
		contracts: ContractInput[]
	): Promise<AnalysisResult> {
		const vulnerabilities: PlatformVulnerability[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		for (const contract of contracts) {
			try {
				const result = await this.createTimeoutPromise(
					this.aiAnalyzer.analyzePlatformContract(contract, {
						platform: this.platform,
						includeRecommendations: true,
						focusAreas: ["resource-safety", "move-patterns", "access-control"],
					}),
					this.timeout
				);

				if (result.success && result.result) {
					vulnerabilities.push(...result.result.vulnerabilities);
					// AI analyzer doesn't return warnings directly, so we'll add them as info
					if (result.result.recommendations) {
						result.result.recommendations.forEach((rec) => {
							warnings.push(
								`Recommendation (${rec.category}): ${rec.description}`
							);
						});
					}
				} else if (result.error) {
					errors.push(result.error);
				}
			} catch (error) {
				this.logError(`AI analysis failed for ${contract.filename}`, error);
				warnings.push(
					`AI analysis failed for ${contract.filename} - continuing with static analysis only`
				);
			}
		}

		return {
			success: errors.length === 0,
			vulnerabilities,
			errors,
			warnings,
			executionTime: 0,
		};
	}

	/**
	 * Validate Move contract input
	 */
	public validateContract(contract: ContractInput): Promise<ValidationResult> {
		return Promise.resolve(this.validateContractInput(contract));
	}

	/**
	 * Check if Move tools are installed
	 */
	public async checkHealth(): Promise<InstallationCheckResult> {
		try {
			const moveVersion = await this.getMoveVersion();
			return {
				installed: true,
				version: moveVersion,
			};
		} catch (error) {
			return {
				installed: false,
				error: `Move tools not found: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			};
		}
	}

	/**
	 * Validate Move syntax
	 */
	protected async validateMoveSyntax(contract: ContractInput): Promise<{
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
	}> {
		const vulnerabilities: PlatformVulnerability[] = [];
		const errors: string[] = [];
		const warnings: string[] = [];

		// Basic Move syntax checks
		if (!contract.code.includes("module ")) {
			warnings.push("No Move module definition found");
		}

		// Check for balanced braces
		const openBraces = (contract.code.match(/{/g) || []).length;
		const closeBraces = (contract.code.match(/}/g) || []).length;
		if (openBraces !== closeBraces) {
			errors.push("Unbalanced braces in Move code");
		}

		return { vulnerabilities, errors, warnings };
	}

	/**
	 * Run Move-specific security checks
	 */
	protected async runMoveSecurityChecks(contract: ContractInput): Promise<{
		vulnerabilities: PlatformVulnerability[];
		warnings: string[];
	}> {
		const vulnerabilities: PlatformVulnerability[] = [];
		const warnings: string[] = [];

		// Check for resource safety patterns
		if (
			contract.code.includes("resource") &&
			!contract.code.includes("has key")
		) {
			warnings.push(
				"Resource types should typically have 'key' ability for storage"
			);
		}

		// Check for proper access control
		if (
			contract.code.includes("public fun") &&
			!contract.code.includes("acquires")
		) {
			warnings.push(
				"Public functions accessing resources should declare 'acquires'"
			);
		}

		return { vulnerabilities, warnings };
	}

	/**
	 * Get Move version
	 */
	protected abstract getMoveVersion(): Promise<string>;

	/**
	 * Create timeout promise wrapper
	 */
	protected createTimeoutPromise<T>(
		promise: Promise<T>,
		timeoutMs: number
	): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) =>
				setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
			),
		]);
	}
}
