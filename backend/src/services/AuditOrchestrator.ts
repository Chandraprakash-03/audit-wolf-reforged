import { Job } from "bull";
import {
	auditQueue,
	JobType,
	JobPriority,
	StaticAnalysisJobData,
	AIAnalysisJobData,
	FullAnalysisJobData,
} from "../config/queue";
import { SlitherAnalyzer } from "./SlitherAnalyzer";
import { AIAnalyzer, AIAnalysisOptions } from "./AIAnalyzer";
import { DatabaseService } from "./database";
import { WebSocketService } from "./WebSocketService";
import EmailService from "./EmailService";
import { Contract, Audit } from "../types/database";
import { AuditProgress, AuditRequest } from "../types/audit";
import { encryptionService } from "./EncryptionService";

// Re-export for backward compatibility
export { AuditProgress, AuditRequest, JobPriority };

export class AuditOrchestrator {
	private slitherAnalyzer: SlitherAnalyzer;
	private aiAnalyzer: AIAnalyzer;
	private wsService: WebSocketService;
	private emailService: EmailService;

	constructor(wsService: WebSocketService) {
		this.wsService = wsService;
		this.emailService = new EmailService();

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

		this.setupJobProcessors();
	}

	/**
	 * Sets up job processors for different analysis types
	 */
	private setupJobProcessors(): void {
		// Static analysis processor
		auditQueue.process(
			JobType.STATIC_ANALYSIS,
			2,
			async (job: Job<StaticAnalysisJobData>) => {
				return this.processStaticAnalysis(job);
			}
		);

		// AI analysis processor
		auditQueue.process(
			JobType.AI_ANALYSIS,
			1,
			async (job: Job<AIAnalysisJobData>) => {
				return this.processAIAnalysis(job);
			}
		);

		// Full analysis processor
		auditQueue.process(
			JobType.FULL_ANALYSIS,
			1,
			async (job: Job<FullAnalysisJobData>) => {
				return this.processFullAnalysis(job);
			}
		);
	}

	/**
	 * Starts a new audit by adding it to the queue
	 */
	async startAudit(request: AuditRequest): Promise<{
		success: boolean;
		auditId?: string;
		jobId?: string;
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
				status: "pending",
			});

			if (!audit) {
				return {
					success: false,
					error: "Failed to create audit record",
				};
			}

			// Decrypt the contract source code for analysis
			let decryptedSourceCode: string;
			try {
				// The source_code field contains encrypted data as JSON string
				const encryptedContract = JSON.parse(contract.source_code);
				decryptedSourceCode =
					encryptionService.decryptContract(encryptedContract);
			} catch (error) {
				// If decryption fails, assume it's plain text (for backward compatibility)
				console.warn(
					"Failed to decrypt contract source code, assuming plain text:",
					error
				);
				decryptedSourceCode = contract.source_code;
			}

			// Prepare job data
			const jobData = {
				auditId: audit.id,
				contractId: request.contractId,
				userId: request.userId,
				contractName: contract.name,
				sourceCode: decryptedSourceCode,
				options: request.options,
			};

			// Add job to queue based on analysis type
			let job;
			const priority = request.priority || JobPriority.NORMAL;

			switch (request.analysisType) {
				case "static":
					job = await auditQueue.add(JobType.STATIC_ANALYSIS, jobData, {
						priority,
						delay: 0,
					});
					break;
				case "ai":
					job = await auditQueue.add(JobType.AI_ANALYSIS, jobData, {
						priority,
						delay: 0,
					});
					break;
				case "full":
					job = await auditQueue.add(JobType.FULL_ANALYSIS, jobData, {
						priority,
						delay: 0,
					});
					break;
				default:
					return {
						success: false,
						error: "Invalid analysis type",
					};
			}

			// Update audit with job ID
			await DatabaseService.updateAudit(audit.id, {
				status: "pending",
			});

			// Notify user via WebSocket
			this.wsService.notifyAuditProgress(request.userId, {
				auditId: audit.id,
				status: "queued",
				progress: 0,
				currentStep: "Queued for analysis",
			});

			// Send audit started email notification
			try {
				const user = await DatabaseService.getUserById(request.userId);
				if (user?.email) {
					await this.emailService.sendAuditStartedEmail(
						user.email,
						contract.name,
						audit.id
					);
				}
			} catch (emailError) {
				console.warn("Failed to send audit started notification:", emailError);
			}

			return {
				success: true,
				auditId: audit.id,
				jobId: job.id.toString(),
			};
		} catch (error) {
			console.error("Error starting audit:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Processes static analysis job
	 */
	private async processStaticAnalysis(
		job: Job<StaticAnalysisJobData>
	): Promise<any> {
		const { auditId, contractName, sourceCode, userId } = job.data;

		try {
			// Update job progress and audit status
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				10,
				"Starting static analysis"
			);

			// Run Slither analysis
			const slitherResult = await this.slitherAnalyzer.analyzeContract(
				sourceCode,
				contractName
			);

			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				70,
				"Processing results"
			);

			// Store vulnerabilities in database
			if (slitherResult.success && slitherResult.vulnerabilities.length > 0) {
				await this.storeVulnerabilities(auditId, slitherResult.vulnerabilities);
			}

			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				90,
				"Finalizing report"
			);

			// Update audit with results
			const staticResults = {
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
					lines_of_code: sourceCode.split("\n").length,
					function_count: (sourceCode.match(/function\s+\w+/g) || []).length,
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
			};

			await DatabaseService.updateAudit(auditId, {
				status: "completed",
				static_results: staticResults as any,
				completed_at: new Date(),
			});

			// Generate audit report automatically
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				95,
				"Generating audit report"
			);

			let reportGenerated = false;
			let pdfBuffer: Buffer | null = null;

			try {
				const { AuditReportService } = await import("./AuditReportService");
				const reportResult = await AuditReportService.generateAuditReport({
					auditId,
					format: "both",
					reportType: "standard",
					includeSourceCode: false,
				});

				if (reportResult.pdf?.filePath) {
					const fs = await import("fs-extra");
					pdfBuffer = await fs.readFile(reportResult.pdf.filePath);
					reportGenerated = true;
				}
			} catch (reportError) {
				console.warn("Failed to generate audit report:", reportError);
			}

			// Send email notification
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				98,
				"Sending notification"
			);

			try {
				await this.sendAuditCompletionNotification(
					auditId,
					userId,
					contractName,
					staticResults.summary.totalVulnerabilities,
					0, // Gas optimizations count - could be enhanced later
					pdfBuffer
				);
			} catch (emailError) {
				console.warn("Failed to send email notification:", emailError);
			}

			await this.updateProgress(
				job,
				auditId,
				userId,
				"completed",
				100,
				"Analysis complete"
			);

			return {
				success: true,
				vulnerabilities: slitherResult.vulnerabilities.length,
				executionTime: slitherResult.executionTime,
			};
		} catch (error) {
			console.error(`Static analysis failed for audit ${auditId}:`, error);

			await DatabaseService.updateAudit(auditId, {
				status: "failed",
			});

			await this.updateProgress(
				job,
				auditId,
				userId,
				"failed",
				0,
				"Analysis failed",
				error instanceof Error ? error.message : "Unknown error"
			);

			throw error;
		}
	}

	/**
	 * Processes AI analysis job
	 */
	private async processAIAnalysis(job: Job<AIAnalysisJobData>): Promise<any> {
		const { auditId, contractName, sourceCode, userId, options } = job.data;

		try {
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				10,
				"Starting AI analysis"
			);

			// Configure AI analysis options
			const aiOptions: AIAnalysisOptions = {
				includeRecommendations: options?.includeRecommendations ?? true,
				includeQualityMetrics: options?.includeQualityMetrics ?? true,
				focusAreas: options?.focusAreas ?? [
					"reentrancy vulnerabilities",
					"access control issues",
					"integer overflow/underflow",
					"gas optimization",
					"best practices",
				],
				severityThreshold:
					(options?.severityThreshold as
						| "low"
						| "medium"
						| "high"
						| "critical") ?? "low",
			};

			// Run AI analysis
			const aiResult = await this.aiAnalyzer.analyzeContract(
				sourceCode,
				contractName,
				aiOptions
			);

			if (!aiResult.success) {
				throw new Error(aiResult.error || "AI analysis failed");
			}

			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				70,
				"Processing AI results"
			);

			// Store AI vulnerabilities in database
			if (aiResult.result && aiResult.result.vulnerabilities.length > 0) {
				await this.storeAIVulnerabilities(
					auditId,
					aiResult.result.vulnerabilities
				);
			}

			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				90,
				"Finalizing AI report"
			);

			// Update audit with AI results
			await DatabaseService.updateAudit(auditId, {
				status: "completed",
				ai_results: aiResult.result,
				completed_at: new Date(),
			});

			// Generate audit report automatically
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				95,
				"Generating audit report"
			);

			let pdfBuffer: Buffer | null = null;

			try {
				const { AuditReportService } = await import("./AuditReportService");
				const reportResult = await AuditReportService.generateAuditReport({
					auditId,
					format: "both",
					reportType: "standard",
					includeSourceCode: false,
				});

				if (reportResult.pdf?.filePath) {
					const fs = await import("fs-extra");
					pdfBuffer = await fs.readFile(reportResult.pdf.filePath);
				}
			} catch (reportError) {
				console.warn("Failed to generate audit report:", reportError);
			}

			// Send email notification
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				98,
				"Sending notification"
			);

			try {
				await this.sendAuditCompletionNotification(
					auditId,
					userId,
					contractName,
					aiResult.result?.vulnerabilities.length || 0,
					0, // Gas optimizations count
					pdfBuffer
				);
			} catch (emailError) {
				console.warn("Failed to send email notification:", emailError);
			}

			await this.updateProgress(
				job,
				auditId,
				userId,
				"completed",
				100,
				"AI analysis complete"
			);

			return {
				success: true,
				vulnerabilities: aiResult.result?.vulnerabilities.length || 0,
				confidence: aiResult.result?.confidence || 0,
			};
		} catch (error) {
			console.error(`AI analysis failed for audit ${auditId}:`, error);

			await DatabaseService.updateAudit(auditId, {
				status: "failed",
			});

			// Send failure notification
			try {
				await this.sendAuditFailureNotification(
					auditId,
					userId,
					contractName,
					error instanceof Error ? error.message : "Unknown error"
				);
			} catch (emailError) {
				console.warn("Failed to send failure email notification:", emailError);
			}

			await this.updateProgress(
				job,
				auditId,
				userId,
				"failed",
				0,
				"AI analysis failed",
				error instanceof Error ? error.message : "Unknown error"
			);

			throw error;
		}
	}

	/**
	 * Processes full analysis job (static + AI)
	 */
	private async processFullAnalysis(
		job: Job<FullAnalysisJobData>
	): Promise<any> {
		const { auditId, contractName, sourceCode, userId, options } = job.data;

		try {
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				5,
				"Starting comprehensive analysis"
			);

			// Run static analysis first
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				15,
				"Running static analysis"
			);

			const slitherResult = await this.slitherAnalyzer.analyzeContract(
				sourceCode,
				contractName
			);

			// Run AI analysis
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				40,
				"Running AI analysis"
			);

			const aiOptions: AIAnalysisOptions = {
				includeRecommendations: options?.includeRecommendations ?? true,
				includeQualityMetrics: options?.includeQualityMetrics ?? true,
				focusAreas: options?.focusAreas ?? [
					"reentrancy vulnerabilities",
					"access control issues",
					"integer overflow/underflow",
					"gas optimization",
					"best practices",
				],
				severityThreshold:
					(options?.severityThreshold as
						| "low"
						| "medium"
						| "high"
						| "critical") ?? "low",
			};

			const aiResult = await this.aiAnalyzer.analyzeContract(
				sourceCode,
				contractName,
				aiOptions
			);

			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				75,
				"Combining analysis results"
			);

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

			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				90,
				"Generating comprehensive report"
			);

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
							lines_of_code: sourceCode.split("\n").length,
							function_count: (sourceCode.match(/function\s+\w+/g) || [])
								.length,
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

			// Generate audit report automatically
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				95,
				"Generating audit report"
			);

			let pdfBuffer: Buffer | null = null;
			let reportPath: string | null = null;

			try {
				const { AuditReportService } = await import("./AuditReportService");
				const reportResult = await AuditReportService.generateAuditReport({
					auditId,
					format: "both", // Generate both HTML and PDF
					reportType: "standard",
					includeSourceCode: false,
				});

				if (reportResult.pdf?.filePath) {
					const fs = await import("fs-extra");
					pdfBuffer = await fs.readFile(reportResult.pdf.filePath);
					reportPath = reportResult.pdf.filePath;
				}

				// Store in decentralized storage if report was generated successfully
				if (reportPath) {
					await this.updateProgress(
						job,
						auditId,
						userId,
						"processing",
						97,
						"Storing in decentralized storage"
					);

					try {
						const DecentralizedStorageService = (
							await import("./DecentralizedStorageService")
						).default;
						const storageService = new DecentralizedStorageService();

						const storageData = {
							auditId,
							contractAddress: undefined, // Will be filled from audit data
							auditorAddress: userId,
							reportPath,
							auditData: {
								staticResults,
								aiResults: aiResult.success ? aiResult.result : null,
								contractName,
							},
							metadata: {
								name: `audit-${auditId}`,
								description: `Comprehensive audit report for ${contractName}`,
								timestamp: Date.now(),
							},
						};

						const storageResult = await storageService.storeAuditReport(
							storageData,
							{
								useIPFS: true,
								useBlockchain: process.env.NODE_ENV === "production", // Only use blockchain in production
								fallbackToDatabase: true,
							}
						);

						if (storageResult.success) {
							console.log(`Audit ${auditId} stored in decentralized storage:`, {
								ipfs: !!storageResult.ipfsHash,
								blockchain: !!storageResult.blockchainTxHash,
							});
						} else {
							console.warn(
								`Decentralized storage failed for audit ${auditId}:`,
								storageResult.errors
							);
						}
					} catch (storageError) {
						console.warn(
							"Failed to store in decentralized storage:",
							storageError
						);
						// Don't fail the entire audit if decentralized storage fails
					}
				}
			} catch (reportError) {
				console.warn("Failed to generate audit report:", reportError);
				// Don't fail the entire audit if report generation fails
			}

			// Send email notification
			await this.updateProgress(
				job,
				auditId,
				userId,
				"processing",
				98,
				"Sending notification"
			);

			const totalVulnerabilities =
				(slitherResult.vulnerabilities?.length || 0) +
				(aiResult.result?.vulnerabilities.length || 0);

			try {
				await this.sendAuditCompletionNotification(
					auditId,
					userId,
					contractName,
					totalVulnerabilities,
					0, // Gas optimizations count
					pdfBuffer
				);
			} catch (emailError) {
				console.warn("Failed to send email notification:", emailError);
			}

			await this.updateProgress(
				job,
				auditId,
				userId,
				"completed",
				100,
				"Comprehensive analysis complete"
			);

			return {
				success: true,
				staticVulnerabilities: slitherResult.vulnerabilities?.length || 0,
				aiVulnerabilities: aiResult.result?.vulnerabilities.length || 0,
				executionTime: slitherResult.executionTime || 0,
			};
		} catch (error) {
			console.error(`Full analysis failed for audit ${auditId}:`, error);

			await DatabaseService.updateAudit(auditId, {
				status: "failed",
			});

			// Send failure notification
			try {
				await this.sendAuditFailureNotification(
					auditId,
					userId,
					contractName,
					error instanceof Error ? error.message : "Unknown error"
				);
			} catch (emailError) {
				console.warn("Failed to send failure email notification:", emailError);
			}

			await this.updateProgress(
				job,
				auditId,
				userId,
				"failed",
				0,
				"Analysis failed",
				error instanceof Error ? error.message : "Unknown error"
			);

			throw error;
		}
	}

	/**
	 * Updates job progress and notifies via WebSocket
	 */
	private async updateProgress(
		job: Job,
		auditId: string,
		userId: string,
		status: "queued" | "processing" | "completed" | "failed" | "cancelled",
		progress: number,
		currentStep: string,
		error?: string
	): Promise<void> {
		// Update job progress
		await job.progress(progress);

		// Prepare progress data
		const progressData: AuditProgress = {
			auditId,
			status,
			progress,
			currentStep,
			error,
		};

		// Notify user via WebSocket
		this.wsService.notifyAuditProgress(userId, progressData);

		console.log(`Audit ${auditId} progress: ${progress}% - ${currentStep}`);
	}

	/**
	 * Stores static analysis vulnerabilities in the database
	 */
	private async storeVulnerabilities(
		auditId: string,
		vulnerabilities: any[]
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
			}
		}
	}

	/**
	 * Stores AI analysis vulnerabilities in the database
	 */
	private async storeAIVulnerabilities(
		auditId: string,
		vulnerabilities: any[]
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
			}
		}
	}

	/**
	 * Maps vulnerability types to database enum values
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
	 * Generates a title for a vulnerability
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
	private generateRecommendation(vuln: any): string {
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
	 * Cancels an ongoing audit
	 */
	async cancelAudit(
		auditId: string,
		userId: string
	): Promise<{
		success: boolean;
		error?: string;
	}> {
		try {
			// Get audit to verify ownership
			const audit = await DatabaseService.getAuditById(auditId);
			if (!audit) {
				return { success: false, error: "Audit not found" };
			}

			if (audit.user_id !== userId) {
				return { success: false, error: "Access denied" };
			}

			// Find and cancel the job
			const jobs = await auditQueue.getJobs(["waiting", "active", "delayed"]);
			const job = jobs.find((j) => (j.data as any).auditId === auditId);

			if (job) {
				await job.remove();
			}

			// Update audit status
			await DatabaseService.updateAudit(auditId, {
				status: "failed", // Using 'failed' as there's no 'cancelled' status in the enum
			});

			// Notify user via WebSocket
			this.wsService.notifyAuditProgress(userId, {
				auditId,
				status: "cancelled",
				progress: 0,
				currentStep: "Analysis cancelled",
			});

			return { success: true };
		} catch (error) {
			console.error("Error cancelling audit:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Gets queue statistics
	 */
	async getQueueStats(): Promise<{
		waiting: number;
		active: number;
		completed: number;
		failed: number;
		delayed: number;
	}> {
		const [waiting, active, completed, failed, delayed] = await Promise.all([
			auditQueue.getWaiting(),
			auditQueue.getActive(),
			auditQueue.getCompleted(),
			auditQueue.getFailed(),
			auditQueue.getDelayed(),
		]);

		return {
			waiting: waiting.length,
			active: active.length,
			completed: completed.length,
			failed: failed.length,
			delayed: delayed.length,
		};
	}

	/**
	 * Gets audit progress by audit ID
	 */
	async getAuditProgress(
		auditId: string,
		userId: string
	): Promise<{
		success: boolean;
		progress?: AuditProgress;
		error?: string;
	}> {
		try {
			const audit = await DatabaseService.getAuditById(auditId);
			if (!audit) {
				return { success: false, error: "Audit not found" };
			}

			if (audit.user_id !== userId) {
				return { success: false, error: "Access denied" };
			}

			// Find the job in the queue
			const jobs = await auditQueue.getJobs([
				"waiting",
				"active",
				"completed",
				"failed",
			]);
			const job = jobs.find((j) => (j.data as any).auditId === auditId);

			let progress = 0;
			let currentStep = "Initializing";
			let status:
				| "queued"
				| "processing"
				| "completed"
				| "failed"
				| "cancelled" = "queued";

			if (job) {
				progress = (job.progress() as number) || 0;

				switch (job.opts.jobId ? await job.getState() : "unknown") {
					case "waiting":
					case "delayed":
						status = "queued";
						currentStep = "Queued for analysis";
						break;
					case "active":
						status = "processing";
						currentStep = "Running analysis";
						break;
					case "completed":
						status = "completed";
						currentStep = "Analysis complete";
						progress = 100;
						break;
					case "failed":
						status = "failed";
						currentStep = "Analysis failed";
						break;
				}
			} else {
				// No job found, check audit status
				switch (audit.status) {
					case "completed":
						status = "completed";
						progress = 100;
						currentStep = "Analysis complete";
						break;
					case "failed":
						status = "failed";
						currentStep = "Analysis failed";
						break;
					default:
						status = "queued";
						currentStep = "Queued for analysis";
				}
			}

			return {
				success: true,
				progress: {
					auditId,
					status,
					progress,
					currentStep,
					startedAt: audit.created_at,
					completedAt: audit.completed_at || undefined,
				},
			};
		} catch (error) {
			console.error("Error getting audit progress:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Send audit completion notification email
	 */
	private async sendAuditCompletionNotification(
		auditId: string,
		userId: string,
		contractName: string,
		vulnerabilityCount: number,
		gasOptimizations: number,
		pdfBuffer: Buffer | null
	): Promise<void> {
		try {
			// Get user email from database
			const user = await DatabaseService.getUserById(userId);
			if (!user?.email) {
				console.warn(`No email found for user ${userId}`);
				return;
			}

			if (pdfBuffer) {
				await this.emailService.sendAuditCompletionEmail(
					user.email,
					contractName,
					auditId,
					pdfBuffer,
					vulnerabilityCount,
					gasOptimizations
				);
			} else {
				// Send notification without PDF if report generation failed
				await this.emailService.sendEmail({
					to: user.email,
					subject: `Audit Complete: ${contractName}`,
					html: `
						<h2>Audit Complete</h2>
						<p>Your smart contract audit for <strong>${contractName}</strong> has been completed.</p>
						<p>Vulnerabilities found: ${vulnerabilityCount}</p>
						<p>You can view the full report in your dashboard.</p>
						<p><a href="${
							process.env.FRONTEND_URL || "http://localhost:3000"
						}/dashboard">View Dashboard</a></p>
					`,
				});
			}
		} catch (error) {
			console.error("Failed to send audit completion notification:", error);
		}
	}

	/**
	 * Send audit failure notification email
	 */
	private async sendAuditFailureNotification(
		auditId: string,
		userId: string,
		contractName: string,
		errorMessage: string
	): Promise<void> {
		try {
			// Get user email from database
			const user = await DatabaseService.getUserById(userId);
			if (!user?.email) {
				console.warn(`No email found for user ${userId}`);
				return;
			}

			await this.emailService.sendAuditFailureEmail(
				user.email,
				contractName,
				auditId,
				errorMessage
			);
		} catch (error) {
			console.error("Failed to send audit failure notification:", error);
		}
	}
}
