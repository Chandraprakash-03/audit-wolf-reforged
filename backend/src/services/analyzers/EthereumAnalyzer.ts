import { BaseBlockchainAnalyzer } from "./BaseBlockchainAnalyzer";
import {
	ContractInput,
	AnalysisResult,
	ValidationResult,
	InstallationCheckResult,
	PlatformVulnerability,
} from "../../types/blockchain";
import { SlitherAnalyzer, SlitherVulnerability } from "../SlitherAnalyzer";
import { AIAnalyzer } from "../AIAnalyzer";
import { logger } from "../../utils/logger";

/**
 * Ethereum/EVM blockchain analyzer using Slither
 */
export class EthereumAnalyzer extends BaseBlockchainAnalyzer {
	private slitherAnalyzer: SlitherAnalyzer;
	private aiAnalyzer: AIAnalyzer;

	constructor(options: { timeout?: number; maxFileSize?: number } = {}) {
		super("ethereum", options);

		this.slitherAnalyzer = new SlitherAnalyzer({
			timeout: this.timeout,
			maxFileSize: this.maxFileSize,
			outputFormat: "json",
		});

		this.aiAnalyzer = new AIAnalyzer({
			timeout: this.timeout,
			maxTokens: 4000,
			temperature: 0.1,
			models: ["moonshotai/kimi-k2:free", "z-ai/glm-4.5-air:free"],
		});
	}

	/**
	 * Analyze Ethereum/Solidity contracts
	 */
	public async analyze(contracts: ContractInput[]): Promise<AnalysisResult> {
		const startTime = Date.now();
		this.logProgress("Starting Ethereum contract analysis", {
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

			// Run AI analysis with Ethereum-specific context
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

			// Merge results
			const mergedResult = this.mergeAnalysisResults([staticResult, aiResult]);

			const result: AnalysisResult = {
				...mergedResult,
				// Overall success if static analysis succeeded (AI is optional)
				success: staticResult.success,
				executionTime: Date.now() - startTime,
				platformSpecific: {
					slitherVersion: await this.getSlitherVersion(),
					contractsAnalyzed: contracts.length,
					totalLinesOfCode: contracts.reduce(
						(total, contract) => total + contract.code.split("\n").length,
						0
					),
				},
			};

			this.logProgress("Ethereum analysis completed", {
				success: result.success,
				vulnerabilities: result.vulnerabilities.length,
				executionTime: result.executionTime,
			});

			return result;
		} catch (error) {
			this.logError("Ethereum analysis failed", error);
			return {
				success: false,
				vulnerabilities: [],
				errors: [error instanceof Error ? error.message : "Unknown error"],
				warnings: [],
				executionTime: Date.now() - startTime,
			};
		}
	}

	/**
	 * Run AI analysis with Ethereum-specific context
	 */
	protected async runAIAnalysis(contracts: ContractInput[]): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
		executionTime: number;
	}> {
		const startTime = Date.now();
		const allVulnerabilities: PlatformVulnerability[] = [];
		const allErrors: string[] = [];
		const allWarnings: string[] = [];
		let overallSuccess = true;

		this.logProgress("Running Ethereum AI analysis");

		for (const contract of contracts) {
			try {
				const result = await this.createTimeoutPromise(
					this.aiAnalyzer.analyzePlatformContract(contract, {
						platform: "ethereum",
						includeRecommendations: true,
						includeQualityMetrics: true,
						focusAreas: [
							"reentrancy-vulnerabilities",
							"access-control-issues",
							"integer-overflow-underflow",
							"gas-optimization",
							"solidity-best-practices",
							"mev-risks",
							"front-running",
						],
					})
				);

				if (!result.success) {
					overallSuccess = false;
					allErrors.push(
						result.error || `AI analysis failed for ${contract.filename}`
					);
				} else if (result.result) {
					allVulnerabilities.push(...result.result.vulnerabilities);
					allWarnings.push(
						"AI analysis completed with Ethereum-specific context"
					);
				}
			} catch (error) {
				overallSuccess = false;
				const errorMessage = `AI analysis failed for ${contract.filename}: ${
					error instanceof Error ? error.message : "Unknown error"
				}`;
				allErrors.push(errorMessage);
				this.logError("AI analysis error", {
					filename: contract.filename,
					error,
				});
			}
		}

		return {
			success: overallSuccess || allVulnerabilities.length > 0, // Success if we have results or no errors
			vulnerabilities: allVulnerabilities,
			errors: allErrors,
			warnings: allWarnings,
			executionTime: Date.now() - startTime,
		};
	}

	/**
	 * Validate Ethereum/Solidity contract
	 */
	public async validateContract(
		contract: ContractInput
	): Promise<ValidationResult> {
		const baseValidation = this.validateContractInput(contract);

		if (!baseValidation.isValid) {
			return baseValidation;
		}

		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Check for Solidity pragma
			if (!contract.code.includes("pragma solidity")) {
				warnings.push("Missing pragma solidity directive");
			}

			// Check for contract definition
			const hasContract = /\b(contract|interface|library)\s+\w+/.test(
				contract.code
			);
			if (!hasContract) {
				warnings.push("No contract, interface, or library definition found");
			}

			// Check for common syntax issues
			const syntaxIssues = this.checkSoliditySyntax(contract.code);
			errors.push(...syntaxIssues.errors);
			warnings.push(...syntaxIssues.warnings);

			// Run quick Slither validation (basic syntax check)
			try {
				const quickResult = await this.slitherAnalyzer.analyzeContract(
					contract.code,
					this.getContractName(contract.filename)
				);
				if (!quickResult.success) {
					errors.push(...quickResult.errors);
				}
				warnings.push(...quickResult.warnings);
			} catch (slitherError) {
				// If Slither fails, it's likely a syntax error
				errors.push("Contract may have syntax errors");
			}
		} catch (error) {
			warnings.push("Validation check encountered an error");
			this.logError("Contract validation error", error);
		}

		return {
			isValid: errors.length === 0,
			errors: [...baseValidation.errors, ...errors],
			warnings: [...baseValidation.warnings, ...warnings],
		};
	}

	/**
	 * Check analyzer health and installation
	 */
	public async checkHealth(): Promise<InstallationCheckResult> {
		try {
			const slitherCheck = await SlitherAnalyzer.checkSlitherInstallation();

			if (!slitherCheck.installed) {
				return {
					installed: false,
					error: `Slither not installed: ${slitherCheck.error}`,
				};
			}

			return {
				installed: true,
				version: slitherCheck.version,
			};
		} catch (error) {
			return {
				installed: false,
				error: error instanceof Error ? error.message : "Health check failed",
			};
		}
	}

	/**
	 * Run static analysis using Slither
	 */
	protected async runStaticAnalysis(contracts: ContractInput[]): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
		executionTime: number;
	}> {
		const startTime = Date.now();
		const allVulnerabilities: PlatformVulnerability[] = [];
		const allErrors: string[] = [];
		const allWarnings: string[] = [];
		let overallSuccess = true;

		this.logProgress("Running Slither static analysis");

		for (const contract of contracts) {
			try {
				const result = await this.createTimeoutPromise(
					this.slitherAnalyzer.analyzeContract(
						contract.code,
						this.getContractName(contract.filename)
					)
				);

				if (!result.success) {
					overallSuccess = false;
					allErrors.push(...result.errors);
				}

				allWarnings.push(...result.warnings);

				// Convert Slither vulnerabilities to platform vulnerabilities
				const platformVulns = result.vulnerabilities.map((vuln) =>
					this.convertSlitherVulnerability(vuln, contract.filename)
				);

				allVulnerabilities.push(...platformVulns);
			} catch (error) {
				overallSuccess = false;
				const errorMessage = `Analysis failed for ${contract.filename}: ${
					error instanceof Error ? error.message : "Unknown error"
				}`;
				allErrors.push(errorMessage);
				this.logError("Contract analysis error", {
					filename: contract.filename,
					error,
				});
			}
		}

		return {
			success: overallSuccess,
			vulnerabilities: this.deduplicateVulnerabilities(allVulnerabilities),
			errors: allErrors,
			warnings: allWarnings,
			executionTime: Date.now() - startTime,
		};
	}

	/**
	 * Convert Slither vulnerability to platform vulnerability
	 */
	private convertSlitherVulnerability(
		slitherVuln: SlitherVulnerability,
		filename: string
	): PlatformVulnerability {
		const platformVuln: PlatformVulnerability = {
			type: slitherVuln.type,
			severity: slitherVuln.severity,
			title: slitherVuln.title,
			description: slitherVuln.description,
			location: {
				...slitherVuln.location,
				file: filename,
			},
			recommendation: slitherVuln.recommendation,
			confidence: slitherVuln.confidence,
			source: "static",
			platform: this.platform,
			platformSpecificData: {
				slitherDetector: slitherVuln.type,
				rawOutput: slitherVuln.rawOutput,
			},
			rawOutput: slitherVuln.rawOutput,
		};

		platformVuln.id = this.generateVulnerabilityId(platformVuln);
		return platformVuln;
	}

	/**
	 * Check Solidity syntax for common issues
	 */
	private checkSoliditySyntax(code: string): {
		errors: string[];
		warnings: string[];
	} {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check for unmatched braces
		const openBraces = (code.match(/{/g) || []).length;
		const closeBraces = (code.match(/}/g) || []).length;
		if (openBraces !== closeBraces) {
			errors.push("Unmatched braces detected");
		}

		// Check for unmatched parentheses
		const openParens = (code.match(/\(/g) || []).length;
		const closeParens = (code.match(/\)/g) || []).length;
		if (openParens !== closeParens) {
			errors.push("Unmatched parentheses detected");
		}

		// Check for missing semicolons (basic check)
		const lines = code.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (
				line.length > 0 &&
				!line.endsWith(";") &&
				!line.endsWith("{") &&
				!line.endsWith("}") &&
				!line.startsWith("//") &&
				!line.startsWith("/*") &&
				!line.startsWith("*") &&
				!line.includes("pragma") &&
				!line.includes("import")
			) {
				// This is a very basic check - Slither will catch real syntax errors
				warnings.push(`Line ${i + 1} might be missing a semicolon`);
			}
		}

		return { errors, warnings };
	}

	/**
	 * Extract contract name from filename
	 */
	private getContractName(filename: string): string {
		const baseName = filename.split("/").pop() || filename;
		return baseName.replace(/\.[^/.]+$/, "") || "Contract";
	}

	/**
	 * Get Slither version
	 */
	private async getSlitherVersion(): Promise<string | undefined> {
		try {
			const check = await SlitherAnalyzer.checkSlitherInstallation();
			return check.version;
		} catch (error) {
			return undefined;
		}
	}

	/**
	 * Get Ethereum-specific recommendations
	 */
	protected getRecommendationForVulnerabilityType(type: string): string | null {
		const ethereumRecommendations: Record<string, string> = {
			"reentrancy-eth":
				"Use ReentrancyGuard from OpenZeppelin and follow checks-effects-interactions pattern",
			"reentrancy-no-eth": "Ensure state changes occur before external calls",
			"reentrancy-unlimited-gas": "Limit gas forwarded to external calls",
			"arbitrary-send":
				"Validate recipient addresses and use pull payment patterns",
			"controlled-delegatecall":
				"Avoid delegatecall with user-controlled data or implement strict validation",
			"tx-origin":
				"Use msg.sender instead of tx.origin for authorization checks",
			timestamp:
				"Avoid using block.timestamp for critical logic; use block numbers or oracles",
			"locked-ether":
				"Implement withdrawal functions to prevent permanently locked funds",
			"uninitialized-state":
				"Initialize all state variables explicitly in constructor or declaration",
			"uninitialized-storage": "Initialize storage pointers before use",
			pragma:
				"Use specific compiler version pragma (e.g., pragma solidity 0.8.19;)",
			"solc-version":
				"Use recent, stable Solidity compiler version (0.8.x recommended)",
			"naming-convention":
				"Follow Solidity naming conventions (camelCase for functions, PascalCase for contracts)",
			"unused-state": "Remove unused state variables to save deployment gas",
			"external-function":
				"Mark functions as external if they are not called internally",
			"constable-states":
				"Mark state variables as constant or immutable when possible",
			"costly-loop":
				"Avoid loops with unbounded iterations; consider pagination patterns",
			assembly:
				"Use inline assembly carefully and document low-level operations",
		};

		return (
			ethereumRecommendations[type] ||
			super.getRecommendationForVulnerabilityType(type)
		);
	}
}
