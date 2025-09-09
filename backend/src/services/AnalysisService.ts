import {
	SlitherAnalyzer,
	SlitherAnalysisResult,
	SlitherVulnerability,
} from "./SlitherAnalyzer";
import { AIAnalyzer, AIAnalysisOptions } from "./AIAnalyzer";
import { DatabaseService } from "./database";
import { encryptionService } from "./EncryptionService";
import {
	Contract,
	Audit,
	Vulnerability,
	AIVulnerability,
} from "../types/database";

export interface AnalysisRequest {
	contractId: string;
	userId: string;
	analysisType: "static" | "ai" | "full";
}

export interface AnalysisProgress {
	auditId: string;
	status: "pending" | "analyzing" | "completed" | "failed";
	progress: number; // 0-100
	currentStep: string;
	estimatedTimeRemaining?: number;
}

export class AnalysisService {
	private slitherAnalyzer: SlitherAnalyzer;
	private aiAnalyzer: AIAnalyzer;

	constructor() {
		this.slitherAnalyzer = new SlitherAnalyzer({
			timeout: 120000, // 2 minutes
			maxFileSize: 10 * 1024 * 1024, // 10MB
			outputFormat: "json",
		});

		this.aiAnalyzer = new AIAnalyzer({
			timeout: 180000, // 3 minutes for AI analysis
			maxTokens: 4000,
			temperature: 0.1,
			models: [
				// "deepseek/deepseek-chat-v3.1:free",
				"moonshotai/kimi-k2:free",
				"z-ai/glm-4.5-air:free",
				// "openai/gpt-oss-20b:free",
			],
			ensembleThreshold: 0.6,
		});
	}

	/**
	 * Helper method to decrypt contract source code
	 */
	private decryptContractSourceCode(contract: Contract): string {
		try {
			// The source_code field contains encrypted data as JSON string
			const encryptedContract = JSON.parse(contract.source_code);
			return encryptionService.decryptContract(encryptedContract);
		} catch (error) {
			// If decryption fails, assume it's plain text (for backward compatibility)
			console.warn(
				"Failed to decrypt contract source code, assuming plain text:",
				error
			);
			return contract.source_code;
		}
	}

	/**
	 * Starts a static analysis for a contract
	 */
	async startStaticAnalysis(request: AnalysisRequest): Promise<{
		success: boolean;
		auditId?: string;
		error?: string;
	}> {
		try {
			// Get contract from database
			const contract = await DatabaseService.getContractById(
				request.contractId
			);
			if (!contract) {
				return {
					success: false,
					error: "Contract not found",
				};
			}

			// Verify user owns the contract
			if (contract.user_id !== request.userId) {
				return {
					success: false,
					error: "Access denied",
				};
			}

			// Create audit record
			const audit = await DatabaseService.createAudit({
				contract_id: request.contractId,
				user_id: request.userId,
				status: "analyzing",
			});

			if (!audit) {
				return {
					success: false,
					error: "Failed to create audit record",
				};
			}

			// Start analysis in background
			this.performStaticAnalysis(audit.id, contract).catch((error) => {
				console.error("Static analysis failed:", error);
				this.updateAuditStatus(audit.id, "failed", {
					error: error.message,
				});
			});

			return {
				success: true,
				auditId: audit.id,
			};
		} catch (error) {
			console.error("Error starting static analysis:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Performs the actual static analysis
	 */
	private async performStaticAnalysis(
		auditId: string,
		contract: Contract
	): Promise<void> {
		try {
			// Update status to analyzing
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Running Slither analysis",
				progress: 10,
			});

			// Decrypt contract source code for analysis
			const decryptedSourceCode = this.decryptContractSourceCode(contract);

			// Run Slither analysis
			const slitherResult = await this.slitherAnalyzer.analyzeContract(
				decryptedSourceCode,
				contract.name
			);

			// Update progress
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Processing results",
				progress: 70,
			});

			// Store vulnerabilities in database
			if (slitherResult.success && slitherResult.vulnerabilities.length > 0) {
				await this.storeVulnerabilities(auditId, slitherResult.vulnerabilities);
			}

			// Update progress
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Finalizing report",
				progress: 90,
			});

			// Update audit with results
			await DatabaseService.updateAudit(auditId, {
				status: "completed",
				static_results: {
					slither_findings: slitherResult.vulnerabilities.map((v) => ({
						type: v.type,
						severity: v.severity,
						description: v.description,
						location: v.location,
						confidence: v.confidence,
					})),
					ast_analysis: [],
					gas_analysis: [],
					complexity: {
						cyclomatic_complexity: 1, // TODO: Calculate from AST
						lines_of_code: decryptedSourceCode.split("\n").length,
						function_count: (decryptedSourceCode.match(/function\s+\w+/g) || [])
							.length,
					},
					// Store additional metadata as any to allow extra properties
					executionTime: slitherResult.executionTime,
					errors: slitherResult.errors,
					warnings: slitherResult.warnings,
					summary: {
						totalVulnerabilities: slitherResult.vulnerabilities.length,
						criticalCount: slitherResult.vulnerabilities.filter(
							(v) => v.severity === "critical"
						).length,
						highCount: slitherResult.vulnerabilities.filter(
							(v) => v.severity === "high"
						).length,
						mediumCount: slitherResult.vulnerabilities.filter(
							(v) => v.severity === "medium"
						).length,
						lowCount: slitherResult.vulnerabilities.filter(
							(v) => v.severity === "low"
						).length,
						informationalCount: slitherResult.vulnerabilities.filter(
							(v) => v.severity === "informational"
						).length,
					},
				} as any, // Use any to allow additional properties beyond StaticAnalysisResult
				completed_at: new Date(),
			});

			console.log(`Static analysis completed for audit ${auditId}`);
		} catch (error) {
			console.error(`Static analysis failed for audit ${auditId}:`, error);
			await this.updateAuditStatus(auditId, "failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	/**
	 * Stores vulnerabilities in the database
	 */
	private async storeVulnerabilities(
		auditId: string,
		vulnerabilities: SlitherVulnerability[]
	): Promise<void> {
		for (const vuln of vulnerabilities) {
			try {
				await DatabaseService.createVulnerability({
					audit_id: auditId,
					type: this.mapVulnerabilityType(vuln.type),
					severity: vuln.severity,
					title: vuln.title,
					description: vuln.description,
					location: vuln.location,
					recommendation: vuln.recommendation,
					confidence: vuln.confidence,
					source: vuln.source,
				});
			} catch (error) {
				console.error("Failed to store vulnerability:", error);
				// Continue with other vulnerabilities
			}
		}
	}

	/**
	 * Maps Slither vulnerability types to database enum values
	 */
	private mapVulnerabilityType(
		slitherType: string
	):
		| "reentrancy"
		| "overflow"
		| "access_control"
		| "gas_optimization"
		| "best_practice" {
		const typeMapping: Record<
			string,
			| "reentrancy"
			| "overflow"
			| "access_control"
			| "gas_optimization"
			| "best_practice"
		> = {
			"reentrancy-eth": "reentrancy",
			"reentrancy-no-eth": "reentrancy",
			"reentrancy-unlimited-gas": "reentrancy",
			"reentrancy-benign": "reentrancy",
			"reentrancy-events": "reentrancy",
			"arbitrary-send": "access_control",
			"controlled-delegatecall": "access_control",
			"tx-origin": "access_control",
			"uninitialized-state": "best_practice",
			"uninitialized-storage": "best_practice",
			assembly: "best_practice",
			pragma: "best_practice",
			"solc-version": "best_practice",
			"naming-convention": "best_practice",
			"unused-state": "gas_optimization",
			"external-function": "gas_optimization",
			"constable-states": "gas_optimization",
			"costly-loop": "gas_optimization",
			"dead-code": "gas_optimization",
		};

		return typeMapping[slitherType] || "best_practice";
	}

	/**
	 * Updates audit status and progress
	 */
	private async updateAuditStatus(
		auditId: string,
		status: "pending" | "analyzing" | "completed" | "failed",
		details?: {
			currentStep?: string;
			progress?: number;
			error?: string;
		}
	): Promise<void> {
		try {
			const updates: any = { status };

			if (status === "completed") {
				updates.completed_at = new Date();
			}

			await DatabaseService.updateAudit(auditId, updates);

			// In a real implementation, you might also emit progress events
			// for real-time updates via WebSocket or Server-Sent Events
			if (details) {
				console.log(`Audit ${auditId} progress:`, {
					status,
					...details,
				});
			}
		} catch (error) {
			console.error("Failed to update audit status:", error);
		}
	}

	/**
	 * Gets analysis progress for an audit
	 */
	async getAnalysisProgress(
		auditId: string,
		userId: string
	): Promise<{
		success: boolean;
		progress?: AnalysisProgress;
		error?: string;
	}> {
		try {
			const audit = await DatabaseService.getAuditById(auditId);
			if (!audit) {
				return {
					success: false,
					error: "Audit not found",
				};
			}

			// Verify user owns the audit
			if (audit.user_id !== userId) {
				return {
					success: false,
					error: "Access denied",
				};
			}

			// Calculate progress based on status
			let progress = 0;
			let currentStep = "Initializing";

			switch (audit.status) {
				case "pending":
					progress = 0;
					currentStep = "Queued for analysis";
					break;
				case "analyzing":
					progress = 50;
					currentStep = "Running security analysis";
					break;
				case "completed":
					progress = 100;
					currentStep = "Analysis complete";
					break;
				case "failed":
					progress = 0;
					currentStep = "Analysis failed";
					break;
			}

			return {
				success: true,
				progress: {
					auditId,
					status: audit.status,
					progress,
					currentStep,
				},
			};
		} catch (error) {
			console.error("Error getting analysis progress:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Gets analysis results for a completed audit
	 */
	async getAnalysisResults(
		auditId: string,
		userId: string
	): Promise<{
		success: boolean;
		results?: {
			audit: Audit;
			vulnerabilities: Vulnerability[];
			summary: {
				totalVulnerabilities: number;
				severityBreakdown: Record<string, number>;
				executionTime: number;
			};
		};
		error?: string;
	}> {
		try {
			const audit = await DatabaseService.getAuditById(auditId);
			if (!audit) {
				return {
					success: false,
					error: "Audit not found",
				};
			}

			// Verify user owns the audit
			if (audit.user_id !== userId) {
				return {
					success: false,
					error: "Access denied",
				};
			}

			// Get vulnerabilities
			const vulnerabilities = await DatabaseService.getVulnerabilitiesByAuditId(
				auditId
			);

			// Calculate summary
			const severityBreakdown = vulnerabilities.reduce((acc, vuln) => {
				acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
				return acc;
			}, {} as Record<string, number>);

			const executionTime = (audit.static_results as any)?.executionTime || 0;

			return {
				success: true,
				results: {
					audit,
					vulnerabilities,
					summary: {
						totalVulnerabilities: vulnerabilities.length,
						severityBreakdown,
						executionTime,
					},
				},
			};
		} catch (error) {
			console.error("Error getting analysis results:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Starts an AI analysis for a contract
	 */
	async startAIAnalysis(request: AnalysisRequest): Promise<{
		success: boolean;
		auditId?: string;
		error?: string;
	}> {
		try {
			// Get contract from database
			const contract = await DatabaseService.getContractById(
				request.contractId
			);
			if (!contract) {
				return {
					success: false,
					error: "Contract not found",
				};
			}

			// Verify user owns the contract
			if (contract.user_id !== request.userId) {
				return {
					success: false,
					error: "Access denied",
				};
			}

			// Create audit record
			const audit = await DatabaseService.createAudit({
				contract_id: request.contractId,
				user_id: request.userId,
				status: "analyzing",
			});

			if (!audit) {
				return {
					success: false,
					error: "Failed to create audit record",
				};
			}

			// Start AI analysis in background
			this.performAIAnalysis(audit.id, contract).catch((error) => {
				console.error("AI analysis failed:", error);
				this.updateAuditStatus(audit.id, "failed", {
					error: error.message,
				});
			});

			return {
				success: true,
				auditId: audit.id,
			};
		} catch (error) {
			console.error("Error starting AI analysis:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Starts a full analysis (static + AI) for a contract
	 */
	async startFullAnalysis(request: AnalysisRequest): Promise<{
		success: boolean;
		auditId?: string;
		error?: string;
	}> {
		try {
			// Get contract from database
			const contract = await DatabaseService.getContractById(
				request.contractId
			);
			if (!contract) {
				return {
					success: false,
					error: "Contract not found",
				};
			}

			// Verify user owns the contract
			if (contract.user_id !== request.userId) {
				return {
					success: false,
					error: "Access denied",
				};
			}

			// Create audit record
			const audit = await DatabaseService.createAudit({
				contract_id: request.contractId,
				user_id: request.userId,
				status: "analyzing",
			});

			if (!audit) {
				return {
					success: false,
					error: "Failed to create audit record",
				};
			}

			// Start full analysis in background
			this.performFullAnalysis(audit.id, contract).catch((error) => {
				console.error("Full analysis failed:", error);
				this.updateAuditStatus(audit.id, "failed", {
					error: error.message,
				});
			});

			return {
				success: true,
				auditId: audit.id,
			};
		} catch (error) {
			console.error("Error starting full analysis:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Performs AI analysis on a contract
	 */
	private async performAIAnalysis(
		auditId: string,
		contract: Contract
	): Promise<void> {
		try {
			// Update status to analyzing
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Running AI security analysis",
				progress: 10,
			});

			// Decrypt contract source code for analysis
			const decryptedSourceCode = this.decryptContractSourceCode(contract);

			// Configure AI analysis options
			const aiOptions: AIAnalysisOptions = {
				includeRecommendations: true,
				includeQualityMetrics: true,
				focusAreas: [
					"reentrancy vulnerabilities",
					"access control issues",
					"integer overflow/underflow",
					"gas optimization",
					"best practices",
				],
				severityThreshold: "low",
			};

			// Run AI analysis
			const aiResult = await this.aiAnalyzer.analyzeContract(
				decryptedSourceCode,
				contract.name,
				aiOptions
			);

			if (!aiResult.success) {
				throw new Error(aiResult.error || "AI analysis failed");
			}

			// Update progress
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Processing AI results",
				progress: 70,
			});

			// Store AI vulnerabilities in database
			if (aiResult.result && aiResult.result.vulnerabilities.length > 0) {
				await this.storeAIVulnerabilities(
					auditId,
					aiResult.result.vulnerabilities
				);
			}

			// Update progress
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Finalizing AI report",
				progress: 90,
			});

			// Update audit with AI results
			await DatabaseService.updateAudit(auditId, {
				status: "completed",
				ai_results: aiResult.result,
				completed_at: new Date(),
			});

			console.log(`AI analysis completed for audit ${auditId}`);
		} catch (error) {
			console.error(`AI analysis failed for audit ${auditId}:`, error);
			await this.updateAuditStatus(auditId, "failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	/**
	 * Performs full analysis (static + AI) on a contract
	 */
	private async performFullAnalysis(
		auditId: string,
		contract: Contract
	): Promise<void> {
		try {
			// Update status to analyzing
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Starting comprehensive analysis",
				progress: 5,
			});

			// Decrypt contract source code for analysis
			const decryptedSourceCode = this.decryptContractSourceCode(contract);

			// Run static analysis first
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Running static analysis (Slither)",
				progress: 15,
			});

			const slitherResult = await this.slitherAnalyzer.analyzeContract(
				decryptedSourceCode,
				contract.name
			);

			// Run AI analysis in parallel with static analysis processing
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Running AI security analysis",
				progress: 40,
			});

			const aiOptions: AIAnalysisOptions = {
				includeRecommendations: true,
				includeQualityMetrics: true,
				focusAreas: [
					"reentrancy vulnerabilities",
					"access control issues",
					"integer overflow/underflow",
					"gas optimization",
					"best practices",
				],
				severityThreshold: "low",
			};

			const aiResult = await this.aiAnalyzer.analyzeContract(
				decryptedSourceCode,
				contract.name,
				aiOptions
			);

			// Update progress
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Combining analysis results",
				progress: 75,
			});

			// Store vulnerabilities from both analyses
			if (slitherResult.success && slitherResult.vulnerabilities.length > 0) {
				await this.storeVulnerabilities(auditId, slitherResult.vulnerabilities);
			}

			if (
				aiResult.success &&
				aiResult.result &&
				aiResult.result.vulnerabilities.length > 0
			) {
				await this.storeAIVulnerabilities(
					auditId,
					aiResult.result.vulnerabilities
				);
			}

			// Update progress
			await this.updateAuditStatus(auditId, "analyzing", {
				currentStep: "Generating comprehensive report",
				progress: 90,
			});

			// Prepare combined results
			const staticResults = slitherResult.success
				? {
						slither_findings: slitherResult.vulnerabilities.map((v) => ({
							type: v.type,
							severity: v.severity,
							description: v.description,
							location: v.location,
							confidence: v.confidence,
						})),
						ast_analysis: [],
						gas_analysis: [],
						complexity: {
							cyclomatic_complexity: 1,
							lines_of_code: decryptedSourceCode.split("\n").length,
							function_count: (
								decryptedSourceCode.match(/function\s+\w+/g) || []
							).length,
						},
						executionTime: slitherResult.executionTime,
						errors: slitherResult.errors,
						warnings: slitherResult.warnings,
						summary: {
							totalVulnerabilities: slitherResult.vulnerabilities.length,
							criticalCount: slitherResult.vulnerabilities.filter(
								(v) => v.severity === "critical"
							).length,
							highCount: slitherResult.vulnerabilities.filter(
								(v) => v.severity === "high"
							).length,
							mediumCount: slitherResult.vulnerabilities.filter(
								(v) => v.severity === "medium"
							).length,
							lowCount: slitherResult.vulnerabilities.filter(
								(v) => v.severity === "low"
							).length,
							informationalCount: slitherResult.vulnerabilities.filter(
								(v) => v.severity === "informational"
							).length,
						},
				  }
				: null;

			// Update audit with combined results
			await DatabaseService.updateAudit(auditId, {
				status: "completed",
				static_results: staticResults as any,
				ai_results: aiResult.success ? aiResult.result : null,
				completed_at: new Date(),
			});

			console.log(`Full analysis completed for audit ${auditId}`);
		} catch (error) {
			console.error(`Full analysis failed for audit ${auditId}:`, error);
			await this.updateAuditStatus(auditId, "failed", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	/**
	 * Stores AI vulnerabilities in the database
	 */
	private async storeAIVulnerabilities(
		auditId: string,
		vulnerabilities: AIVulnerability[]
	): Promise<void> {
		for (const vuln of vulnerabilities) {
			try {
				await DatabaseService.createVulnerability({
					audit_id: auditId,
					type: vuln.type,
					severity: vuln.severity,
					title: this.generateVulnerabilityTitle(vuln.type, vuln.severity),
					description: vuln.description,
					location: vuln.location,
					recommendation: this.generateRecommendation(vuln),
					confidence: vuln.confidence,
					source: "ai",
				});
			} catch (error) {
				console.error("Failed to store AI vulnerability:", error);
				// Continue with other vulnerabilities
			}
		}
	}

	/**
	 * Generates a title for a vulnerability based on type and severity
	 */
	private generateVulnerabilityTitle(type: string, severity: string): string {
		const titleMap: Record<string, string> = {
			reentrancy: "Reentrancy Vulnerability",
			overflow: "Integer Overflow/Underflow",
			access_control: "Access Control Issue",
			gas_optimization: "Gas Optimization Opportunity",
			best_practice: "Best Practice Violation",
		};

		const severityPrefix =
			severity === "critical"
				? "Critical "
				: severity === "high"
				? "High "
				: "";

		return `${severityPrefix}${titleMap[type] || "Security Issue"}`;
	}

	/**
	 * Generates a basic recommendation for a vulnerability
	 */
	private generateRecommendation(vuln: AIVulnerability): string {
		const recommendationMap: Record<string, string> = {
			reentrancy:
				"Implement the checks-effects-interactions pattern and consider using reentrancy guards.",
			overflow:
				"Use SafeMath library or Solidity 0.8+ built-in overflow protection.",
			access_control:
				"Implement proper access control mechanisms using modifiers and role-based permissions.",
			gas_optimization:
				"Optimize gas usage by reviewing the identified code patterns and implementing suggested improvements.",
			best_practice:
				"Follow Solidity best practices and coding standards to improve code quality and security.",
		};

		return (
			recommendationMap[vuln.type] ||
			"Review and address the identified security concern."
		);
	}

	/**
	 * Validates contract source code using Slither
	 */
	async validateContract(sourceCode: string): Promise<{
		success: boolean;
		isValid: boolean;
		errors: string[];
		warnings: string[];
		quickScan?: {
			potentialIssues: number;
			estimatedAnalysisTime: number;
		};
	}> {
		try {
			// Run a quick Slither check with minimal detectors
			const quickAnalyzer = new SlitherAnalyzer({
				timeout: 30000, // 30 seconds for validation
				maxFileSize: 10 * 1024 * 1024,
				outputFormat: "json",
				enabledDetectors: ["pragma", "solc-version", "naming-convention"], // Quick checks only
			});

			const result = await quickAnalyzer.analyzeContract(
				sourceCode,
				"ValidationContract"
			);

			return {
				success: true,
				isValid: result.success && result.errors.length === 0,
				errors: result.errors,
				warnings: result.warnings,
				quickScan: {
					potentialIssues: result.vulnerabilities.length,
					estimatedAnalysisTime: this.estimateAnalysisTime(sourceCode),
				},
			};
		} catch (error) {
			return {
				success: false,
				isValid: false,
				errors: [error instanceof Error ? error.message : "Validation failed"],
				warnings: [],
			};
		}
	}

	/**
	 * Estimates analysis time based on contract complexity
	 */
	private estimateAnalysisTime(sourceCode: string): number {
		const lines = sourceCode.split("\n").length;
		const functions = (sourceCode.match(/function\s+\w+/g) || []).length;
		const contracts = (sourceCode.match(/contract\s+\w+/g) || []).length;

		// Simple heuristic: base time + time per line + time per function
		const baseTime = 10; // 10 seconds base
		const timePerLine = 0.1; // 0.1 seconds per line
		const timePerFunction = 2; // 2 seconds per function
		const timePerContract = 5; // 5 seconds per contract

		return Math.round(
			baseTime +
				lines * timePerLine +
				functions * timePerFunction +
				contracts * timePerContract
		);
	}

	/**
	 * Checks if all analysis systems are properly installed and configured
	 */
	async checkSystemHealth(): Promise<{
		slitherInstalled: boolean;
		slitherVersion?: string;
		aiConfigured: boolean;
		availableModels: string[];
		systemReady: boolean;
		errors: string[];
	}> {
		const errors: string[] = [];

		// Check Slither installation
		const slitherCheck = await SlitherAnalyzer.checkSlitherInstallation();

		if (!slitherCheck.installed) {
			errors.push(`Slither not installed: ${slitherCheck.error}`);
		}

		// Check AI configuration
		const aiCheck = await AIAnalyzer.checkConfiguration();

		if (!aiCheck.configured) {
			errors.push(...aiCheck.errors);
		}

		// Additional system checks could go here
		// - Check Python version
		// - Check disk space
		// - Check memory availability

		return {
			slitherInstalled: slitherCheck.installed,
			slitherVersion: slitherCheck.version,
			aiConfigured: aiCheck.configured,
			availableModels: aiCheck.availableModels,
			systemReady: errors.length === 0,
			errors,
		};
	}
}
