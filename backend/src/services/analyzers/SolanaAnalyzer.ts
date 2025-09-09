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
 * Solana-specific vulnerability types
 */
export interface SolanaVulnerability {
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
 * Solana analyzer using Rust/Anchor static analysis tools
 */
export class SolanaAnalyzer extends BaseBlockchainAnalyzer {
	private aiAnalyzer: AIAnalyzer;
	private tempDir: string;

	constructor(options: { timeout?: number; maxFileSize?: number } = {}) {
		super("solana", options);

		this.aiAnalyzer = new AIAnalyzer({
			timeout: this.timeout,
			maxTokens: 4000,
			temperature: 0.1,
			models: ["moonshotai/kimi-k2:free", "z-ai/glm-4.5-air:free"],
		});

		this.tempDir = path.join(os.tmpdir(), "solana-analysis");
	}

	/**
	 * Analyze Solana/Rust contracts
	 */
	public async analyze(contracts: ContractInput[]): Promise<AnalysisResult> {
		const startTime = Date.now();
		this.logProgress("Starting Solana contract analysis", {
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

			// Run AI analysis with Solana-specific context (optional)
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
					rustcVersion: await this.getRustVersion(),
					anchorVersion: await this.getAnchorVersion(),
					contractsAnalyzed: contracts.length,
					totalLinesOfCode: contracts.reduce(
						(total, contract) => total + contract.code.split("\n").length,
						0
					),
					analysisTools: ["clippy", "anchor-lint", "solana-security-checks"],
				},
			};

			this.logProgress("Solana analysis completed", {
				success: result.success,
				vulnerabilities: result.vulnerabilities.length,
				executionTime: result.executionTime,
			});

			return result;
		} catch (error) {
			this.logError("Solana analysis failed", error);
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
	 * Validate Solana/Rust contract
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
			// Check for Rust/Anchor structure
			const isAnchor = this.isAnchorProgram(contract.code);
			const isRustProgram = this.isSolanaRustProgram(contract.code);

			if (!isAnchor && !isRustProgram) {
				warnings.push(
					"Code does not appear to be a Solana program (Anchor or native Rust)"
				);
			}

			// Check for common Solana patterns
			const solanaChecks = this.checkSolanaPatterns(contract.code);
			errors.push(...solanaChecks.errors);
			warnings.push(...solanaChecks.warnings);

			// Basic Rust syntax validation
			const rustSyntax = this.checkRustSyntax(contract.code);
			errors.push(...rustSyntax.errors);
			warnings.push(...rustSyntax.warnings);
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
				this.checkRustInstallation(),
				this.checkCargoInstallation(),
				this.checkAnchorInstallation(),
			]);

			const rustCheck = checks[0];
			const cargoCheck = checks[1];
			const anchorCheck = checks[2];

			if (rustCheck.status === "rejected") {
				return {
					installed: false,
					error: `Rust not installed: ${rustCheck.reason}`,
				};
			}

			if (cargoCheck.status === "rejected") {
				return {
					installed: false,
					error: `Cargo not installed: ${cargoCheck.reason}`,
				};
			}

			const versions = {
				rust: rustCheck.status === "fulfilled" ? rustCheck.value : "unknown",
				cargo: cargoCheck.status === "fulfilled" ? cargoCheck.value : "unknown",
				anchor:
					anchorCheck.status === "fulfilled"
						? anchorCheck.value
						: "not installed",
			};

			return {
				installed: true,
				version: `Rust ${versions.rust}, Cargo ${versions.cargo}, Anchor ${versions.anchor}`,
			};
		} catch (error) {
			return {
				installed: false,
				error: error instanceof Error ? error.message : "Health check failed",
			};
		}
	}

	/**
	 * Run static analysis using Clippy and Anchor lint
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

		this.logProgress("Running Solana static analysis");

		try {
			// Ensure temp directory exists
			await this.ensureTempDirectory();

			for (const contract of contracts) {
				try {
					// Create temporary Rust project for analysis
					const projectPath = await this.createTempRustProject(contract);

					// Run Clippy analysis
					const clippyResult = await this.runClippy(projectPath, contract);
					if (!clippyResult.success) {
						overallSuccess = false;
						allErrors.push(...clippyResult.errors);
					}
					allWarnings.push(...clippyResult.warnings);
					allVulnerabilities.push(...clippyResult.vulnerabilities);

					// Run Anchor lint if it's an Anchor program
					if (this.isAnchorProgram(contract.code)) {
						const anchorResult = await this.runAnchorLint(
							projectPath,
							contract
						);
						if (!anchorResult.success) {
							allErrors.push(...anchorResult.errors);
						}
						allWarnings.push(...anchorResult.warnings);
						allVulnerabilities.push(...anchorResult.vulnerabilities);
					}

					// Run Solana-specific security checks
					const securityResult = await this.runSolanaSecurityChecks(contract);
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
	 * Run AI analysis with Solana-specific context
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

		this.logProgress("Running Solana AI analysis");

		for (const contract of contracts) {
			try {
				const result = await this.createTimeoutPromise(
					this.aiAnalyzer.analyzePlatformContract(contract, {
						platform: "solana",
						includeRecommendations: true,
						includeQualityMetrics: true,
						focusAreas: [
							"solana-security",
							"anchor-patterns",
							"rust-security",
							"pda-validation",
							"account-model",
							"compute-optimization",
							"cpi-security",
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
						"AI analysis completed with Solana-specific context"
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
	 * Analyze Solana contract with AI using platform-specific prompts
	 */
	private async analyzeSolanaContractWithAI(contract: ContractInput): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors?: string[];
		warnings?: string[];
	}> {
		try {
			const solanaPrompt = this.createSolanaAnalysisPrompt(
				contract.code,
				contract.filename
			);

			// Use a custom AI analysis approach for Solana
			const result = await this.aiAnalyzer.analyzeContract(
				solanaPrompt,
				contract.filename,
				{
					includeRecommendations: true,
					includeQualityMetrics: true,
					focusAreas: [
						"solana-security",
						"anchor-patterns",
						"rust-security",
						"pda-validation",
						"account-model",
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
				warnings: ["AI analysis completed with Solana-specific context"],
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
	 * Create Solana-specific analysis prompt
	 */
	private createSolanaAnalysisPrompt(code: string, filename: string): string {
		const isAnchor = this.isAnchorProgram(code);

		return `You are an expert Solana smart contract security auditor. Analyze the following ${
			isAnchor ? "Anchor" : "native Rust"
		} Solana program for security vulnerabilities and best practices.

Contract: ${filename}

${
	isAnchor
		? `
ANCHOR PROGRAM ANALYSIS:
Focus on Anchor-specific security patterns:
- Account validation and constraints
- Proper use of #[account] attributes
- PDA (Program Derived Address) security
- Signer validation
- Account ownership checks
- Cross-program invocation (CPI) security
- Anchor framework best practices
`
		: `
NATIVE SOLANA PROGRAM ANALYSIS:
Focus on native Solana program patterns:
- Account validation and ownership
- Instruction data parsing
- PDA derivation and validation
- Cross-program invocation security
- Rent exemption handling
- Program state management
`
}

SOLANA-SPECIFIC SECURITY CHECKS:
1. **Account Model Security:**
   - Proper account ownership validation
   - Signer verification
   - Account data validation
   - Missing account checks

2. **PDA (Program Derived Address) Security:**
   - Secure PDA derivation
   - Bump seed validation
   - PDA ownership verification
   - Canonical bump usage

3. **Compute Unit Optimization:**
   - Efficient instruction processing
   - Avoiding unnecessary computations
   - Stack and heap usage optimization

4. **Cross-Program Invocation (CPI):**
   - Proper CPI security
   - Account passing validation
   - Program ID verification

5. **Solana Runtime Security:**
   - Rent exemption handling
   - Account size validation
   - Lamport handling
   - System program interactions

6. **Rust-Specific Issues:**
   - Integer overflow/underflow
   - Panic conditions
   - Unsafe code usage
   - Memory safety

Contract Code:
\`\`\`rust
${code}
\`\`\`

Provide detailed analysis focusing on Solana-specific vulnerabilities and security patterns. Pay special attention to account validation, PDA security, and proper use of the Solana runtime.`;
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
			recommendation: this.getSolanaRecommendation(
				aiVuln.type,
				aiVuln.description
			),
			confidence: aiVuln.confidence,
			source: "ai",
			platform: this.platform,
			platformSpecificData: {
				aiModel: "solana-specialized",
				originalType: aiVuln.type,
			},
		};

		platformVuln.id = this.generateVulnerabilityId(platformVuln);
		return platformVuln;
	}

	/**
	 * Get Solana-specific recommendation for vulnerability type
	 */
	private getSolanaRecommendation(type: string, description: string): string {
		const solanaRecommendations: Record<string, string> = {
			"pda-security":
				"Ensure PDA derivation uses canonical bump seeds and proper validation",
			"account-validation":
				"Implement comprehensive account ownership and signer validation",
			"anchor-constraints":
				"Use Anchor constraints to validate account relationships and data",
			"cpi-security":
				"Validate all accounts passed in cross-program invocations",
			"compute-optimization":
				"Optimize compute unit usage to avoid transaction failures",
			"rent-exemption":
				"Ensure accounts maintain rent exemption or handle rent collection",
			"integer-overflow":
				"Use checked arithmetic operations to prevent overflow/underflow",
			"access-control":
				"Implement proper access control using account ownership and signer checks",
			"state-validation":
				"Validate program state transitions and account data integrity",
		};

		// Try to match the type or description to get specific recommendation
		for (const [key, recommendation] of Object.entries(solanaRecommendations)) {
			if (type.includes(key) || description.toLowerCase().includes(key)) {
				return recommendation;
			}
		}

		return "Review the identified issue and implement appropriate Solana security best practices";
	}

	// Helper methods for Solana-specific checks

	/**
	 * Check if code is an Anchor program
	 */
	private isAnchorProgram(code: string): boolean {
		return (
			code.includes("use anchor_lang::prelude::*") ||
			code.includes("#[program]") ||
			code.includes("anchor_lang::")
		);
	}

	/**
	 * Check if code is a Solana Rust program
	 */
	private isSolanaRustProgram(code: string): boolean {
		return (
			code.includes("solana_program::") ||
			code.includes("use solana_program") ||
			code.includes("ProgramResult") ||
			code.includes("AccountInfo")
		);
	}

	/**
	 * Check Solana-specific patterns
	 */
	private checkSolanaPatterns(code: string): {
		errors: string[];
		warnings: string[];
	} {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check for common Solana security patterns
		if (code.includes("AccountInfo") && !code.includes("is_signer")) {
			warnings.push("Consider validating account signers where appropriate");
		}

		if (
			code.includes("Pubkey::find_program_address") &&
			!code.includes("bump")
		) {
			warnings.push("PDA derivation should use canonical bump seeds");
		}

		if (code.includes("invoke") && !code.includes("AccountMeta")) {
			warnings.push(
				"Cross-program invocations should properly validate account metadata"
			);
		}

		return { errors, warnings };
	}

	/**
	 * Basic Rust syntax validation
	 */
	private checkRustSyntax(code: string): {
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

		return { errors, warnings };
	}

	// Tool installation and version checks

	/**
	 * Check Rust installation
	 */
	private async checkRustInstallation(): Promise<string> {
		try {
			const result = await executePwsh("rustc --version");
			if (result.exitCode === 0) {
				return result.stdout.trim();
			}
			throw new Error(result.stderr || "Rust not found");
		} catch (error) {
			throw new Error(`Rust installation check failed: ${error}`);
		}
	}

	/**
	 * Check Cargo installation
	 */
	private async checkCargoInstallation(): Promise<string> {
		try {
			const result = await executePwsh("cargo --version");
			if (result.exitCode === 0) {
				return result.stdout.trim();
			}
			throw new Error(result.stderr || "Cargo not found");
		} catch (error) {
			throw new Error(`Cargo installation check failed: ${error}`);
		}
	}

	/**
	 * Check Anchor installation
	 */
	private async checkAnchorInstallation(): Promise<string> {
		try {
			const result = await executePwsh("anchor --version");
			if (result.exitCode === 0) {
				return result.stdout.trim();
			}
			throw new Error("Anchor CLI not installed");
		} catch (error) {
			// Anchor is optional, so we don't throw here
			return "not installed";
		}
	}

	/**
	 * Get Rust version
	 */
	private async getRustVersion(): Promise<string | undefined> {
		try {
			return await this.checkRustInstallation();
		} catch (error) {
			return undefined;
		}
	}

	/**
	 * Get Anchor version
	 */
	private async getAnchorVersion(): Promise<string | undefined> {
		try {
			const version = await this.checkAnchorInstallation();
			return version !== "not installed" ? version : undefined;
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
	 * Create temporary Rust project for analysis
	 */
	private async createTempRustProject(
		contract: ContractInput
	): Promise<string> {
		const projectName = `analysis_${Date.now()}_${Math.random()
			.toString(36)
			.substring(7)}`;
		const projectPath = path.join(this.tempDir, projectName);

		await fs.mkdir(projectPath, { recursive: true });

		// Create Cargo.toml
		const cargoToml = this.isAnchorProgram(contract.code)
			? this.createAnchorCargoToml(projectName)
			: this.createRustCargoToml(projectName);

		await fs.writeFile(path.join(projectPath, "Cargo.toml"), cargoToml);

		// Create src directory and lib.rs
		const srcPath = path.join(projectPath, "src");
		await fs.mkdir(srcPath);
		await fs.writeFile(path.join(srcPath, "lib.rs"), contract.code);

		return projectPath;
	}

	/**
	 * Create Cargo.toml for Anchor project
	 */
	private createAnchorCargoToml(projectName: string): string {
		return `[package]
name = "${projectName}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]

[dependencies]
anchor-lang = "0.29.0"
anchor-spl = "0.29.0"
solana-program = "1.17.0"

[features]
default = []
`;
	}

	/**
	 * Create Cargo.toml for native Rust project
	 */
	private createRustCargoToml(projectName: string): string {
		return `[package]
name = "${projectName}"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]

[dependencies]
solana-program = "1.17.0"
thiserror = "1.0"
spl-token = "4.0"

[features]
default = []
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
	 * Run Clippy analysis
	 */
	private async runClippy(
		projectPath: string,
		contract: ContractInput
	): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
	}> {
		try {
			const result = await executePwsh(
				"cargo clippy --message-format=json -- -W clippy::all",
				{ cwd: projectPath }
			);

			const vulnerabilities: PlatformVulnerability[] = [];
			const errors: string[] = [];
			const warnings: string[] = [];

			// Parse Clippy JSON output
			if (result.stdout) {
				const lines = result.stdout.split("\n").filter((line) => line.trim());
				for (const line of lines) {
					try {
						const message = JSON.parse(line);
						if (message.message && message.message.spans) {
							const vuln = this.parseClippyMessage(message, contract.filename);
							if (vuln) {
								vulnerabilities.push(vuln);
							}
						}
					} catch {
						// Skip non-JSON lines
					}
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
					`Clippy analysis failed: ${
						error instanceof Error ? error.message : "Unknown error"
					}`,
				],
				warnings: [],
			};
		}
	}

	/**
	 * Parse Clippy message to vulnerability
	 */
	private parseClippyMessage(
		message: any,
		filename: string
	): PlatformVulnerability | null {
		if (
			!message.message ||
			!message.message.spans ||
			message.message.spans.length === 0
		) {
			return null;
		}

		const span = message.message.spans[0];
		const level = message.message.level;

		// Map Clippy levels to our severity levels
		let severity: "critical" | "high" | "medium" | "low" | "informational";
		switch (level) {
			case "error":
				severity = "high";
				break;
			case "warning":
				severity = "medium";
				break;
			case "note":
			case "help":
				severity = "low";
				break;
			default:
				severity = "informational";
		}

		const vuln: PlatformVulnerability = {
			type: message.message.code?.code || "clippy-warning",
			severity,
			title: `Clippy: ${message.message.message}`,
			description: message.message.message,
			location: {
				file: filename,
				line: span.line_start || 1,
				column: span.column_start || 1,
				length: span.column_end
					? span.column_end - span.column_start
					: undefined,
			},
			recommendation: this.getClippyRecommendation(message.message.code?.code),
			confidence: 0.8,
			source: "static",
			platform: this.platform,
			platformSpecificData: {
				clippyCode: message.message.code?.code,
				clippyLevel: level,
				rawMessage: message,
			},
		};

		vuln.id = this.generateVulnerabilityId(vuln);
		return vuln;
	}

	/**
	 * Get recommendation for Clippy warning
	 */
	private getClippyRecommendation(code?: string): string {
		const clippyRecommendations: Record<string, string> = {
			"clippy::integer_arithmetic":
				"Use checked arithmetic operations to prevent overflow",
			"clippy::panic":
				"Avoid panic! in production code, use proper error handling",
			"clippy::unwrap_used":
				"Avoid unwrap(), use proper error handling with match or if let",
			"clippy::expect_used":
				"Consider using proper error handling instead of expect()",
			"clippy::indexing_slicing":
				"Use safe indexing methods like get() instead of direct indexing",
			"clippy::cast_lossless": "Use From/Into traits for lossless conversions",
			"clippy::cast_possible_truncation":
				"Validate numeric conversions to prevent data loss",
		};

		return (
			clippyRecommendations[code || ""] ||
			"Review and address the Clippy warning"
		);
	}

	/**
	 * Run Anchor lint analysis
	 */
	private async runAnchorLint(
		projectPath: string,
		contract: ContractInput
	): Promise<{
		success: boolean;
		vulnerabilities: PlatformVulnerability[];
		errors: string[];
		warnings: string[];
	}> {
		try {
			// For now, we'll implement basic Anchor pattern checking
			// In a full implementation, this would use actual Anchor tooling
			const vulnerabilities = this.checkAnchorPatterns(contract);

			return {
				success: true,
				vulnerabilities,
				errors: [],
				warnings: ["Anchor lint analysis completed (basic pattern checking)"],
			};
		} catch (error) {
			return {
				success: false,
				vulnerabilities: [],
				errors: [
					`Anchor lint failed: ${
						error instanceof Error ? error.message : "Unknown error"
					}`,
				],
				warnings: [],
			};
		}
	}

	/**
	 * Check Anchor-specific patterns
	 */
	private checkAnchorPatterns(
		contract: ContractInput
	): PlatformVulnerability[] {
		const vulnerabilities: PlatformVulnerability[] = [];
		const lines = contract.code.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			// Check for missing account constraints
			if (line.includes("#[account(") && !line.includes("constraint")) {
				vulnerabilities.push({
					type: "anchor-missing-constraints",
					severity: "medium",
					title: "Missing Anchor Account Constraints",
					description: "Account definition lacks validation constraints",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: 1,
					},
					recommendation:
						"Add appropriate constraints to validate account relationships and data",
					confidence: 0.7,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						anchorPattern: "missing-constraints",
					},
					id: this.generateVulnerabilityId({
						type: "anchor-missing-constraints",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}

			// Check for missing signer validation
			if (line.includes("Context<") && !contract.code.includes("Signer")) {
				vulnerabilities.push({
					type: "anchor-missing-signer",
					severity: "high",
					title: "Missing Signer Validation",
					description: "Instruction context may lack proper signer validation",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: 1,
					},
					recommendation:
						"Ensure proper signer validation in instruction contexts",
					confidence: 0.6,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						anchorPattern: "missing-signer",
					},
					id: this.generateVulnerabilityId({
						type: "anchor-missing-signer",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}
		}

		return vulnerabilities;
	}

	/**
	 * Run Solana-specific security checks
	 */
	private async runSolanaSecurityChecks(contract: ContractInput): Promise<{
		vulnerabilities: PlatformVulnerability[];
		warnings: string[];
	}> {
		const vulnerabilities: PlatformVulnerability[] = [];
		const warnings: string[] = [];

		// PDA validation checks
		const pdaVulns = this.checkPDAValidation(contract);
		vulnerabilities.push(...pdaVulns);

		// Account model checks
		const accountVulns = this.checkAccountModel(contract);
		vulnerabilities.push(...accountVulns);

		// Compute unit checks
		const computeVulns = this.checkComputeUnits(contract);
		vulnerabilities.push(...computeVulns);

		warnings.push("Solana-specific security checks completed");

		return { vulnerabilities, warnings };
	}

	/**
	 * Check PDA validation patterns
	 */
	private checkPDAValidation(contract: ContractInput): PlatformVulnerability[] {
		const vulnerabilities: PlatformVulnerability[] = [];
		const lines = contract.code.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			// Check for insecure PDA derivation - look for predictable seeds
			if (
				line.includes("find_program_address") &&
				(line.includes("user.key()") || line.includes(".as_ref()"))
			) {
				vulnerabilities.push({
					type: "insecure-pda-derivation",
					severity: "high",
					title: "Insecure PDA Derivation",
					description:
						"PDA derivation uses predictable seeds that could lead to security issues",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: line.indexOf("find_program_address"),
					},
					recommendation:
						"Use unpredictable or validated seeds for PDA derivation",
					confidence: 0.8,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						securityCheck: "pda-validation",
					},
					id: this.generateVulnerabilityId({
						type: "insecure-pda-derivation",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}
		}

		return vulnerabilities;
	}

	/**
	 * Check account model security
	 */
	private checkAccountModel(contract: ContractInput): PlatformVulnerability[] {
		const vulnerabilities: PlatformVulnerability[] = [];
		const lines = contract.code.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			// Check for missing owner validation
			if (line.includes("AccountInfo") && !contract.code.includes("owner")) {
				vulnerabilities.push({
					type: "missing-owner-validation",
					severity: "medium",
					title: "Missing Account Owner Validation",
					description: "Account usage without proper owner validation",
					location: {
						file: contract.filename,
						line: lineNumber,
						column: 1,
					},
					recommendation: "Validate account ownership before processing",
					confidence: 0.6,
					source: "static",
					platform: this.platform,
					platformSpecificData: {
						securityCheck: "account-model",
					},
					id: this.generateVulnerabilityId({
						type: "missing-owner-validation",
						location: { file: contract.filename, line: lineNumber, column: 1 },
					} as PlatformVulnerability),
				});
			}
		}

		return vulnerabilities;
	}

	/**
	 * Check compute unit optimization
	 */
	private checkComputeUnits(contract: ContractInput): PlatformVulnerability[] {
		const vulnerabilities: PlatformVulnerability[] = [];
		const lines = contract.code.split("\n");

		// Check for potential compute unit issues
		let hasLoops = false;
		let hasRecursion = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			if (
				line.includes("for ") ||
				line.includes("while ") ||
				line.includes("loop ")
			) {
				hasLoops = true;
			}

			if (
				line.includes("fn ") &&
				contract.code.includes(line.match(/fn\s+(\w+)/)?.[1] || "")
			) {
				hasRecursion = true;
			}
		}

		if (hasLoops) {
			vulnerabilities.push({
				type: "compute-unit-risk",
				severity: "low",
				title: "Potential Compute Unit Risk",
				description:
					"Code contains loops that may consume excessive compute units",
				location: {
					file: contract.filename,
					line: 1,
					column: 1,
				},
				recommendation: "Review loop bounds and consider compute unit limits",
				confidence: 0.5,
				source: "static",
				platform: this.platform,
				platformSpecificData: {
					securityCheck: "compute-units",
					hasLoops,
					hasRecursion,
				},
				id: this.generateVulnerabilityId({
					type: "compute-unit-risk",
					location: { file: contract.filename, line: 1, column: 1 },
				} as PlatformVulnerability),
			});
		}

		return vulnerabilities;
	}

	/**
	 * Get Solana-specific recommendations for vulnerability types
	 */
	protected getRecommendationForVulnerabilityType(type: string): string | null {
		const solanaRecommendations: Record<string, string> = {
			"insecure-pda-derivation":
				"Use canonical bump seeds and validate PDA derivation parameters",
			"missing-owner-validation":
				"Always validate account ownership before processing account data",
			"anchor-missing-constraints":
				"Add appropriate Anchor constraints to validate account relationships",
			"anchor-missing-signer":
				"Ensure proper signer validation in all instruction contexts",
			"compute-unit-risk":
				"Optimize code to stay within Solana's compute unit limits",
			"missing-rent-exemption":
				"Ensure accounts maintain rent exemption or handle rent collection properly",
			"cpi-security":
				"Validate all accounts and parameters in cross-program invocations",
			"integer-overflow":
				"Use checked arithmetic operations to prevent overflow in Solana programs",
		};

		return (
			solanaRecommendations[type] ||
			super.getRecommendationForVulnerabilityType(type)
		);
	}
}
