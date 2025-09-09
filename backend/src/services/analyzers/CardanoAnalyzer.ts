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
 * Cardano-specific vulnerability types
 */
export interface CardanoVulnerability {
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
 * Cardano analyzer using Plutus static analysis tools
 */
export class CardanoAnalyzer extends BaseBlockchainAnalyzer {
	private aiAnalyzer: AIAnalyzer;
	private tempDir: string;

	constructor(options: { timeout?: number; maxFileSize?: number } = {}) {
		super("cardano", options);

		this.aiAnalyzer = new AIAnalyzer({
			timeout: this.timeout,
			maxTokens: 4000,
			temperature: 0.1,
			models: ["moonshotai/kimi-k2:free", "z-ai/glm-4.5-air:free"],
		});

		this.tempDir = path.join(os.tmpdir(), "cardano-analysis");
	}

	/**
	 * Analyze Cardano/Plutus contracts
	 */
	public async analyze(contracts: ContractInput[]): Promise<AnalysisResult> {
		const startTime = Date.now();
		this.logProgress("Starting Cardano contract analysis", {
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

			// Run AI analysis with Cardano-specific context (optional)
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
					ghcVersion: await this.getGHCVersion(),
					cabalVersion: await this.getCabalVersion(),
					contractsAnalyzed: contracts.length,
					totalLinesOfCode: contracts.reduce(
						(total, contract) => total + contract.code.split("\n").length,
						0
					),
					analysisTools: ["hlint", "plutus-core", "cardano-security-checks"],
				},
			};

			this.logProgress("Cardano analysis completed", {
				success: result.success,
				vulnerabilities: result.vulnerabilities.length,
				executionTime: result.executionTime,
			});

			return result;
		} catch (error) {
			this.logError("Cardano analysis failed", error);
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
	 * Validate Cardano/Plutus contract
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
			// Check for Plutus/Haskell structure
			const isPlutus = this.isPlutusScript(contract.code);
			const isHaskell = this.isHaskellProgram(contract.code);

			if (!isPlutus && !isHaskell) {
				warnings.push(
					"Code does not appear to be a Cardano Plutus script or Haskell program"
				);
			}

			// Check for common Cardano patterns
			const cardanoChecks = this.checkCardanoPatterns(contract.code);
			errors.push(...cardanoChecks.errors);
			warnings.push(...cardanoChecks.warnings);

			// Basic Haskell syntax validation
			const haskellSyntax = this.checkHaskellSyntax(contract.code);
			errors.push(...haskellSyntax.errors);
			warnings.push(...haskellSyntax.warnings);
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
			const checks = await Promise.allSettled([
				this.checkGHCInstallation(),
				this.checkCabalInstallation(),
				this.checkHLintInstallation(),
			]);

			const ghcCheck = checks[0];
			const cabalCheck = checks[1];
			const hlintCheck = checks[2];

			if (ghcCheck.status === "rejected") {
				return {
					installed: false,
					error: `GHC not installed: ${ghcCheck.reason}`,
				};
			}

			if (cabalCheck.status === "rejected") {
				return {
					installed: false,
					error: `Cabal not installed: ${cabalCheck.reason}`,
				};
			}

			const versions = {
				ghc: ghcCheck.status === "fulfilled" ? ghcCheck.value : "unknown",
				cabal: cabalCheck.status === "fulfilled" ? cabalCheck.value : "unknown",
				hlint:
					hlintCheck.status === "fulfilled"
						? hlintCheck.value
						: "not installed",
			};

			return {
				installed: true,
				version: `GHC ${versions.ghc}, Cabal ${versions.cabal}, HLint ${versions.hlint}`,
			};
		} catch (error) {
			return {
				installed: false,
				error: error instanceof Error ? error.message : "Health check failed",
			};
		}
	}

	/**
	 * Run static analysis using HLint and Plutus Core validation
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

		this.logProgress("Running Cardano static analysis");

		try {
			// Ensure temp directory exists
			await this.ensureTempDirectory();

			for (const contract of contracts) {
				try {
					// Create temporary Haskell project for analysis
					const projectPath = await this.createTempHaskellProject(contract);

					// Run HLint analysis
					const hlintResult = await this.runHLint(projectPath, contract);
					if (!hlintResult.success) {
						overallSuccess = false;
						allErrors.push(...hlintResult.errors);
					}
					allWarnings.push(...hlintResult.warnings);
					allVulnerabilities.push(...hlintResult.vulnerabilities);

					// Run Plutus Core validation if it's a Plutus script
					if (this.isPlutusScript(contract.code)) {
						const plutusResult = await this.runPlutusValidation(
							projectPath,
							contract
						);
						if (!plutusResult.success) {
							allErrors.push(...plutusResult.errors);
						}
						allWarnings.push(...plutusResult.warnings);
						allVulnerabilities.push(...plutusResult.vulnerabilities);
					}

					// Run Cardano-specific security checks
					const securityResult = await this.runCardanoSecurityChecks(contract);
					allVulnerabilities.push(...securityResult.vulnerabilities);
					allWarnings.push(...securityResult.warnings);

					// Cleanup temp project
					await this.cleanupTempProject(projectPath);
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
		} catch (error) {
			overallSuccess = false;
			allErrors.push(
				`Static analysis setup failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
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
	 * Run AI analysis with Cardano-specific context
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

		this.logProgress("Running Cardano AI analysis");

		for (const contract of contracts) {
			try {
				const result = await this.createTimeoutPromise(
					this.aiAnalyzer.analyzePlatformContract(contract, {
						platform: "cardano",
						includeRecommendations: true,
						includeQualityMetrics: true,
						focusAreas: [
							"utxo-model-security",
							"plutus-validation",
							"datum-validation",
							"script-efficiency",
							"haskell-security",
							"cardano-best-practices",
							"eutxo-compliance",
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
						"AI analysis completed with Cardano-specific context"
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

		// For AI analysis, we're more forgiving - if we get any results, consider it a success
		// AI analysis is supplementary to static analysis
		const hasResults = allVulnerabilities.length > 0 || allWarnings.length > 0;

		return {
			success: hasResults || allErrors.length === 0, // Success if we have results or no errors
			vulnerabilities: allVulnerabilities,
			errors: allErrors,
			warnings: allWarnings,
			executionTime: Date.now() - startTime,
		};
	}

	/**
	 * Analyze Cardano contract with AI using platform-specific prompts
	 */
	private async analyzeCardanoContractWithAI(contract: ContractInput): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors?: string[];
		warnings?: string[];
	}> {
		try {
			const cardanoPrompt = this.createCardanoAnalysisPrompt(
				contract.code,
				contract.filename
			);

			// Use a custom AI analysis approach for Cardano
			const result = await this.aiAnalyzer.analyzeContract(
				cardanoPrompt,
				contract.filename,
				{
					includeRecommendations: true,
					includeQualityMetrics: true,
					focusAreas: [
						"cardano-security",
						"plutus-patterns",
						"haskell-security",
						"utxo-validation",
						"datum-handling",
						"script-efficiency",
					],
				}
			);

			if (!result.success) {
				return {
					success: false,
					vulnerabilities: [],
					errors: [result.error || "AI analysis failed"],
				};
			}

			// Convert AI vulnerabilities to platform vulnerabilities
			const platformVulns = result.result!.vulnerabilities.map((vuln) =>
				this.convertAIVulnerabilityToPlatform(vuln, contract.filename)
			);

			return {
				success: true,
				vulnerabilities: platformVulns,
				warnings: ["AI analysis completed with Cardano-specific context"],
			};
		} catch (error) {
			return {
				success: false,
				vulnerabilities: [],
				errors: [error instanceof Error ? error.message : "AI analysis failed"],
			};
		}
	}

	/**
	 * Create Cardano-specific analysis prompt
	 */
	private createCardanoAnalysisPrompt(code: string, filename: string): string {
		const isPlutus = this.isPlutusScript(code);

		return `You are an expert Cardano smart contract security auditor. Analyze the following ${
			isPlutus ? "Plutus" : "Haskell"
		} Cardano script for security vulnerabilities and best practices.

Contract: ${filename}

${
	isPlutus
		? `
PLUTUS SCRIPT ANALYSIS:
Focus on Plutus-specific security patterns:
- Validator function implementation
- Datum and redeemer validation
- Script context usage
- UTXO model compliance
- Script efficiency and size optimization
- Plutus Core compilation safety
`
		: `
HASKELL PROGRAM ANALYSIS:
Focus on Haskell program patterns:
- Type safety and correctness
- Function purity and side effects
- Error handling patterns
- Resource management
- Performance considerations
`
}

CARDANO-SPECIFIC SECURITY CHECKS:
1. **UTXO Model Security:**
   - Proper UTXO consumption and creation
   - Value preservation validation
   - Double spending prevention
   - UTXO locking mechanisms

2. **Datum and Redeemer Validation:**
   - Proper datum structure validation
   - Redeemer parameter checking
   - Type safety in data handling
   - Serialization/deserialization security

3. **Script Context Validation:**
   - Transaction info validation
   - Purpose-specific validation logic
   - Input/output validation
   - Fee and value calculations

4. **Script Efficiency:**
   - Execution unit optimization
   - Script size limitations
   - Memory usage patterns
   - CPU budget management

5. **Plutus Core Security:**
   - Safe compilation patterns
   - Avoiding infinite loops
   - Stack overflow prevention
   - Resource exhaustion protection

6. **Haskell-Specific Issues:**
   - Partial function usage
   - Lazy evaluation pitfalls
   - Exception handling
   - Type system exploitation

Contract Code:
\`\`\`haskell
${code}
\`\`\`

Provide detailed analysis focusing on Cardano-specific vulnerabilities and security patterns. Pay special attention to UTXO model compliance, datum validation, and Plutus script efficiency.`;
	}

	/**
	 * Convert AI vulnerability to platform vulnerability
	 */
	private convertAIVulnerabilityToPlatform(
		aiVuln: any,
		filename: string
	): PlatformVulnerability {
		const platformVuln: PlatformVulnerability = {
			type: aiVuln.type,
			severity: aiVuln.severity,
			title:
				aiVuln.description.substring(0, 100) +
				(aiVuln.description.length > 100 ? "..." : ""),
			description: aiVuln.description,
			location: {
				...aiVuln.location,
				file: filename,
			},
			recommendation: this.getCardanoRecommendation(
				aiVuln.type,
				aiVuln.description
			),
			confidence: aiVuln.confidence,
			source: "ai",
			platform: this.platform,
			platformSpecificData: {
				aiModel: "cardano-specialized",
				originalType: aiVuln.type,
			},
		};

		platformVuln.id = this.generateVulnerabilityId(platformVuln);
		return platformVuln;
	}

	/**
	 * Get Cardano-specific recommendation for vulnerability type
	 */
	private getCardanoRecommendation(type: string, description: string): string {
		const cardanoRecommendations: Record<string, string> = {
			"utxo-validation":
				"Ensure proper UTXO consumption and creation with value preservation",
			"datum-validation":
				"Implement comprehensive datum structure and content validation",
			"script-context":
				"Validate all relevant fields in the script context for security",
			"script-efficiency":
				"Optimize script execution units and memory usage for cost efficiency",
			"plutus-core":
				"Ensure safe Plutus Core compilation and avoid resource exhaustion",
			"partial-functions":
				"Replace partial functions with total functions or proper error handling",
			"lazy-evaluation":
				"Be cautious with lazy evaluation and potential space leaks",
			"type-safety":
				"Leverage Haskell's type system for compile-time safety guarantees",
			"resource-management":
				"Implement proper resource management and cleanup patterns",
		};

		// Try to match the type or description to get specific recommendation
		for (const [key, recommendation] of Object.entries(
			cardanoRecommendations
		)) {
			if (type.includes(key) || description.toLowerCase().includes(key)) {
				return recommendation;
			}
		}

		return "Review the identified issue and implement appropriate Cardano security best practices";
	}

	// Helper methods for Cardano-specific checks

	/**
	 * Check if code is a Plutus script
	 */
	private isPlutusScript(code: string): boolean {
		return (
			code.includes("import Plutus.") ||
			code.includes("import PlutusTx") ||
			code.includes("validator") ||
			code.includes("BuiltinData") ||
			code.includes("ScriptContext")
		);
	}

	/**
	 * Check if code is a Haskell program
	 */
	private isHaskellProgram(code: string): boolean {
		return (
			code.includes("module ") ||
			code.includes("import ") ||
			code.includes("data ") ||
			code.includes("type ") ||
			code.includes("newtype ") ||
			code.includes("class ") ||
			code.includes("instance ")
		);
	}

	/**
	 * Check Cardano-specific patterns
	 */
	private checkCardanoPatterns(code: string): {
		errors: string[];
		warnings: string[];
	} {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check for common Cardano security patterns
		if (code.includes("validator") && !code.includes("ScriptContext")) {
			warnings.push(
				"Validator function should use ScriptContext for validation"
			);
		}

		if (code.includes("BuiltinData") && !code.includes("fromBuiltinData")) {
			warnings.push("BuiltinData usage should include proper deserialization");
		}

		if (code.includes("TxInfo") && !code.includes("txInfoInputs")) {
			warnings.push("TxInfo usage should validate transaction inputs");
		}

		if (code.includes("Value") && !code.includes("valueOf")) {
			warnings.push(
				"Value operations should use safe value extraction functions"
			);
		}

		return { errors, warnings };
	}

	/**
	 * Basic Haskell syntax validation
	 */
	private checkHaskellSyntax(code: string): {
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

		// Check for potential partial functions
		const partialFunctions = ["head", "tail", "init", "last", "!!", "fromJust"];
		for (const func of partialFunctions) {
			if (code.includes(func)) {
				warnings.push(`Potential use of partial function '${func}' detected`);
			}
		}

		return { errors, warnings };
	}

	// Tool installation and version checks

	/**
	 * Check GHC installation
	 */
	private async checkGHCInstallation(): Promise<string> {
		try {
			const result = await executePwsh("ghc --version");
			if (result.exitCode === 0) {
				return result.stdout.trim();
			}
			throw new Error(result.stderr || "GHC not found");
		} catch (error) {
			throw new Error(`GHC installation check failed: ${error}`);
		}
	}

	/**
	 * Check Cabal installation
	 */
	private async checkCabalInstallation(): Promise<string> {
		try {
			const result = await executePwsh("cabal --version");
			if (result.exitCode === 0) {
				return result.stdout.trim();
			}
			throw new Error(result.stderr || "Cabal not found");
		} catch (error) {
			throw new Error(`Cabal installation check failed: ${error}`);
		}
	}

	/**
	 * Check HLint installation
	 */
	private async checkHLintInstallation(): Promise<string> {
		try {
			const result = await executePwsh("hlint --version");
			if (result.exitCode === 0) {
				return result.stdout.trim();
			}
			throw new Error("HLint not installed");
		} catch (error) {
			// HLint is optional, so we don't throw here
			return "not installed";
		}
	}

	/**
	 * Get GHC version
	 */
	private async getGHCVersion(): Promise<string | undefined> {
		try {
			return await this.checkGHCInstallation();
		} catch (error) {
			return undefined;
		}
	}

	/**
	 * Get Cabal version
	 */
	private async getCabalVersion(): Promise<string | undefined> {
		try {
			return await this.checkCabalInstallation();
		} catch (error) {
			return undefined;
		}
	}

	// Temporary project management for static analysis

	/**
	 * Ensure temp directory exists
	 */
	private async ensureTempDirectory(): Promise<void> {
		try {
			await fs.access(this.tempDir);
		} catch {
			await fs.mkdir(this.tempDir, { recursive: true });
		}
	}

	/**
	 * Create temporary Haskell project for analysis
	 */
	private async createTempHaskellProject(
		contract: ContractInput
	): Promise<string> {
		const projectName = `analysis_${Date.now()}_${Math.random()
			.toString(36)
			.substring(7)}`;
		const projectPath = path.join(this.tempDir, projectName);

		await fs.mkdir(projectPath, { recursive: true });

		// Create cabal.project file
		const cabalProject = this.createCabalProject(projectName);
		await fs.writeFile(
			path.join(projectPath, `${projectName}.cabal`),
			cabalProject
		);

		// Create src directory and Main.hs
		const srcPath = path.join(projectPath, "src");
		await fs.mkdir(srcPath);
		await fs.writeFile(path.join(srcPath, "Main.hs"), contract.code);

		return projectPath;
	}

	/**
	 * Create cabal project file
	 */
	private createCabalProject(projectName: string): string {
		return `cabal-version: 2.4
name: ${projectName}
version: 0.1.0.0
synopsis: Temporary project for Cardano analysis
license: MIT
author: Audit Wolf
maintainer: analysis@auditwolf.com

executable ${projectName}
  main-is: Main.hs
  hs-source-dirs: src
  build-depends:
    base ^>=4.14,
    plutus-core,
    plutus-ledger-api,
    plutus-tx,
    plutus-tx-plugin,
    cardano-api,
    bytestring,
    text,
    aeson
  default-language: Haskell2010
  ghc-options: -Wall -Wcompat -Wincomplete-record-updates -Wincomplete-uni-patterns -Wredundant-constraints
`;
	}

	/**
	 * Cleanup temporary project
	 */
	private async cleanupTempProject(projectPath: string): Promise<void> {
		try {
			await fs.rm(projectPath, { recursive: true, force: true });
		} catch (error) {
			this.logError("Failed to cleanup temp project", { projectPath, error });
		}
	}

	// Static analysis tool implementations

	/**
	 * Run HLint analysis
	 */
	private async runHLint(
		projectPath: string,
		contract: ContractInput
	): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
	}> {
		try {
			const result = await executePwsh("hlint --json src/", {
				cwd: projectPath,
			});

			const vulnerabilities: PlatformVulnerability[] = [];
			const errors: string[] = [];
			const warnings: string[] = [];

			// Parse HLint JSON output
			if (result.stdout) {
				try {
					const hlintResults = JSON.parse(result.stdout);
					for (const hint of hlintResults) {
						const vuln = this.parseHLintHint(hint, contract.filename);
						if (vuln) {
							vulnerabilities.push(vuln);
						}
					}
				} catch (parseError) {
					warnings.push("Failed to parse HLint output");
				}
			}

			if (result.stderr) {
				const stderrLines = result.stderr
					.split("\n")
					.filter((line) => line.trim());
				errors.push(...stderrLines);
			}

			return {
				success: result.exitCode === 0 || vulnerabilities.length > 0,
				vulnerabilities,
				errors,
				warnings,
			};
		} catch (error) {
			return {
				success: false,
				vulnerabilities: [],
				errors: [
					`HLint analysis failed: ${
						error instanceof Error ? error.message : "Unknown error"
					}`,
				],
				warnings: [],
			};
		}
	}

	/**
	 * Parse HLint hint to vulnerability
	 */
	private parseHLintHint(
		hint: any,
		filename: string
	): PlatformVulnerability | null {
		if (!hint.startLine || !hint.severity) {
			return null;
		}

		// Map HLint severity to our severity levels
		let severity: "critical" | "high" | "medium" | "low" | "informational";
		switch (hint.severity.toLowerCase()) {
			case "error":
				severity = "high";
				break;
			case "warning":
				severity = "medium";
				break;
			case "suggestion":
				severity = "low";
				break;
			default:
				severity = "informational";
		}

		const vuln: PlatformVulnerability = {
			type: hint.hint || "hlint-suggestion",
			severity,
			title: `HLint: ${hint.hint}`,
			description: hint.hint,
			location: {
				file: filename,
				line: hint.startLine || 1,
				column: hint.startColumn || 1,
				length: hint.endColumn ? hint.endColumn - hint.startColumn : undefined,
			},
			recommendation: this.getHLintRecommendation(hint.hint, hint.to),
			confidence: 0.8,
			source: "static",
			platform: this.platform,
			platformSpecificData: {
				hlintHint: hint.hint,
				hlintSeverity: hint.severity,
				from: hint.from,
				to: hint.to,
				rawHint: hint,
			},
		};

		vuln.id = this.generateVulnerabilityId(vuln);
		return vuln;
	}

	/**
	 * Get recommendation for HLint hint
	 */
	private getHLintRecommendation(hint?: string, suggestion?: string): string {
		if (suggestion) {
			return `Consider using: ${suggestion}`;
		}

		const hlintRecommendations: Record<string, string> = {
			"Use head":
				"Consider using pattern matching or safe alternatives to head",
			"Use tail":
				"Consider using pattern matching or safe alternatives to tail",
			"Use init":
				"Consider using pattern matching or safe alternatives to init",
			"Use last":
				"Consider using pattern matching or safe alternatives to last",
			"Avoid lambda": "Consider using point-free style or function composition",
			"Use map": "Consider using map instead of explicit recursion",
			"Use filter": "Consider using filter instead of explicit recursion",
			"Use foldr": "Consider using foldr for better performance and clarity",
		};

		// Try to match the hint to get specific recommendation
		for (const [key, recommendation] of Object.entries(hlintRecommendations)) {
			if (hint && hint.includes(key)) {
				return recommendation;
			}
		}

		return "Review and address the HLint suggestion for better code quality";
	}

	/**
	 * Run Plutus Core validation
	 */
	private async runPlutusValidation(
		projectPath: string,
		contract: ContractInput
	): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
	}> {
		try {
			// For now, we'll implement basic Plutus pattern checking
			// In a full implementation, this would use actual Plutus tooling
			const vulnerabilities = this.checkPlutusPatterns(contract);

			return {
				success: true,
				vulnerabilities,
				errors: [],
				warnings: ["Plutus validation completed (basic pattern checking)"],
			};
		} catch (error) {
			return {
				success: false,
				vulnerabilities: [],
				errors: [
					`Plutus validation failed: ${
						error instanceof Error ? error.message : "Unknown error"
					}`,
				],
				warnings: [],
			};
		}
	}

	/**
	 * Check Plutus-specific patterns
	 */
	private checkPlutusPatterns(
		contract: ContractInput
	): PlatformVulnerability[] {
		const vulnerabilities: PlatformVulnerability[] = [];
		const lines = contract.code.split("\n");

		// Track which issues we've already found to avoid duplicates
		const foundIssues = new Set<string>();

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			// Check for missing script context validation
			if (
				line.includes("validator") &&
				!contract.code.includes("ScriptContext") &&
				!foundIssues.has("missing-context")
			) {
				foundIssues.add("missing-context");
				vulnerabilities.push({
					type: "plutus-missing-context",
					severity: "high",
					title: "Missing Script Context Validation",
					description:
						"Validator function lacks proper script context validation",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: 1,
					},
					recommendation:
						"Include ScriptContext parameter and validate transaction context",
					confidence: 0.8,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						plutusPattern: "missing-context",
					},
					id: this.generateVulnerabilityId({
						type: "plutus-missing-context",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}

			// Check for unsafe datum handling
			if (
				line.includes("BuiltinData") &&
				!line.includes("fromBuiltinData") &&
				!foundIssues.has("unsafe-datum")
			) {
				foundIssues.add("unsafe-datum");
				vulnerabilities.push({
					type: "plutus-unsafe-datum",
					severity: "medium",
					title: "Unsafe Datum Handling",
					description: "BuiltinData usage without proper deserialization",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: 1,
					},
					recommendation:
						"Use fromBuiltinData for safe datum deserialization with error handling",
					confidence: 0.7,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						plutusPattern: "unsafe-datum",
					},
					id: this.generateVulnerabilityId({
						type: "plutus-unsafe-datum",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}

			// Check for missing value validation
			if (
				line.includes("Value") &&
				!contract.code.includes("valueOf") &&
				!foundIssues.has("missing-value-validation")
			) {
				foundIssues.add("missing-value-validation");
				vulnerabilities.push({
					type: "plutus-missing-value-validation",
					severity: "medium",
					title: "Missing Value Validation",
					description: "Value operations without proper validation",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: 1,
					},
					recommendation:
						"Use valueOf and other safe value functions for proper validation",
					confidence: 0.6,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						plutusPattern: "missing-value-validation",
					},
					id: this.generateVulnerabilityId({
						type: "plutus-missing-value-validation",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}
		}

		return vulnerabilities;
	}

	/**
	 * Run Cardano-specific security checks
	 */
	private async runCardanoSecurityChecks(contract: ContractInput): Promise<{
		vulnerabilities: PlatformVulnerability[];
		warnings: string[];
	}> {
		const vulnerabilities: PlatformVulnerability[] = [];
		const warnings: string[] = [];

		// UTXO model validation
		const utxoChecks = this.validateUTXOHandling(contract);
		vulnerabilities.push(...utxoChecks);

		// Datum validation checks
		const datumChecks = this.checkDatumUsage(contract);
		vulnerabilities.push(...datumChecks);

		// Script efficiency analysis
		const efficiencyChecks = this.analyzePlutusEfficiency(contract);
		vulnerabilities.push(...efficiencyChecks);

		// eUTXO compliance checks
		const eutxoChecks = this.checkEUTXOCompliance(contract);
		vulnerabilities.push(...eutxoChecks);

		warnings.push("Cardano security checks completed");

		return { vulnerabilities, warnings };
	}

	/**
	 * Validate UTXO handling patterns
	 */
	private validateUTXOHandling(
		contract: ContractInput
	): PlatformVulnerability[] {
		const vulnerabilities: PlatformVulnerability[] = [];
		const lines = contract.code.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			// Check for proper input validation
			if (
				line.includes("txInfoInputs") &&
				!contract.code.includes("txOutValue")
			) {
				vulnerabilities.push({
					type: "cardano-utxo-validation",
					severity: "medium",
					title: "Incomplete UTXO Input Validation",
					description: "Transaction inputs accessed without value validation",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: 1,
					},
					recommendation:
						"Validate both input existence and value preservation in UTXO operations",
					confidence: 0.7,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						cardanoPattern: "utxo-validation",
					},
					id: this.generateVulnerabilityId({
						type: "cardano-utxo-validation",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}
		}

		return vulnerabilities;
	}

	/**
	 * Check datum usage patterns
	 */
	private checkDatumUsage(contract: ContractInput): PlatformVulnerability[] {
		const vulnerabilities: PlatformVulnerability[] = [];
		const lines = contract.code.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			// Check for datum validation
			if (
				line.includes("datum") &&
				!contract.code.includes("fromBuiltinData")
			) {
				vulnerabilities.push({
					type: "cardano-datum-validation",
					severity: "medium",
					title: "Missing Datum Validation",
					description: "Datum usage without proper type validation",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: 1,
					},
					recommendation:
						"Use fromBuiltinData to safely deserialize and validate datum structure",
					confidence: 0.8,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						cardanoPattern: "datum-validation",
					},
					id: this.generateVulnerabilityId({
						type: "cardano-datum-validation",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}
		}

		return vulnerabilities;
	}

	/**
	 * Analyze Plutus script efficiency
	 */
	private analyzePlutusEfficiency(
		contract: ContractInput
	): PlatformVulnerability[] {
		const vulnerabilities: PlatformVulnerability[] = [];
		const lines = contract.code.split("\n");

		// Check for potential efficiency issues
		let hasRecursion = false;
		let hasLargeDataStructures = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			// Check for recursive patterns that might be expensive
			if (
				line.includes("foldr") ||
				line.includes("foldl") ||
				line.includes("map")
			) {
				hasRecursion = true;
			}

			// Check for large data structure operations
			if (line.includes("length") && line.includes("list")) {
				hasLargeDataStructures = true;
			}

			// Check for inefficient string operations
			if (
				line.includes("++") &&
				(line.includes("String") || line.includes('"'))
			) {
				vulnerabilities.push({
					type: "cardano-script-efficiency",
					severity: "low",
					title: "Inefficient String Concatenation",
					description:
						"String concatenation using ++ can be expensive in Plutus",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: 1,
					},
					recommendation:
						"Consider using more efficient string building methods or avoid string operations in validators",
					confidence: 0.6,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						cardanoPattern: "script-efficiency",
					},
					id: this.generateVulnerabilityId({
						type: "cardano-script-efficiency",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}
		}

		if (hasRecursion && hasLargeDataStructures) {
			vulnerabilities.push({
				type: "cardano-script-efficiency",
				severity: "medium",
				title: "Potential Script Efficiency Issues",
				description:
					"Script contains recursive operations on potentially large data structures",
				location: {
					file: contract.filename,
					line: 1,
					column: 1,
				},
				recommendation:
					"Review recursive operations and consider more efficient algorithms or data structures",
				confidence: 0.5,
				source: "static",
				platform: this.platform,
				platformSpecificData: {
					cardanoPattern: "script-efficiency",
				},
				id: this.generateVulnerabilityId({
					type: "cardano-script-efficiency",
					location: { file: contract.filename, line: 1, column: 1 },
				} as PlatformVulnerability),
			});
		}

		return vulnerabilities;
	}

	/**
	 * Check eUTXO compliance
	 */
	private checkEUTXOCompliance(
		contract: ContractInput
	): PlatformVulnerability[] {
		const vulnerabilities: PlatformVulnerability[] = [];

		// Check for proper eUTXO patterns
		if (
			contract.code.includes("validator") &&
			!contract.code.includes("TxInfo")
		) {
			vulnerabilities.push({
				type: "cardano-eutxo-compliance",
				severity: "high",
				title: "Missing eUTXO Transaction Info Validation",
				description:
					"Validator does not access transaction information for eUTXO compliance",
				location: {
					file: contract.filename,
					line: 1,
					column: 1,
				},
				recommendation:
					"Include TxInfo validation to ensure proper eUTXO model compliance",
				confidence: 0.8,
				source: "static",
				platform: this.platform,
				platformSpecificData: {
					cardanoPattern: "eutxo-compliance",
				},
				id: this.generateVulnerabilityId({
					type: "cardano-eutxo-compliance",
					location: { file: contract.filename, line: 1, column: 1 },
				} as PlatformVulnerability),
			});
		}

		return vulnerabilities;
	}

	/**
	 * Get Cardano-specific recommendation for vulnerability type (override from base class)
	 */
	protected getRecommendationForVulnerabilityType(type: string): string | null {
		const cardanoRecommendations: Record<string, string> = {
			"plutus-missing-context":
				"Include ScriptContext parameter in validator functions for proper validation",
			"plutus-unsafe-datum":
				"Use fromBuiltinData for safe datum deserialization with error handling",
			"cardano-utxo-validation":
				"Implement comprehensive UTXO input and output validation",
			"cardano-datum-validation":
				"Validate datum structure and content using proper type checking",
			"cardano-script-efficiency":
				"Optimize script execution units and memory usage for cost efficiency",
			"cardano-eutxo-compliance":
				"Ensure proper eUTXO model compliance with transaction info validation",
			"hlint-suggestion":
				"Follow HLint suggestions for better Haskell code quality and safety",
		};

		return cardanoRecommendations[type] || null;
	}
}
