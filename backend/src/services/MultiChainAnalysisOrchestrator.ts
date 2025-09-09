import { Job } from "bull";
import { auditQueue, JobPriority, redis } from "../config/queue";
import { AnalyzerFactory } from "./analyzers/AnalyzerFactory";
import { CrossChainAnalyzer } from "./analyzers/CrossChainAnalyzer";
import { DatabaseService } from "./database";
import { WebSocketService } from "./WebSocketService";
import { blockchainRegistry } from "./BlockchainRegistry";
import {
	MultiChainAnalysisRequest,
	MultiChainAnalysisResult,
	ContractInput,
	AnalysisResult,
	CrossChainAnalysisResult,
	AnalysisOptions,
	BlockchainAnalyzer,
} from "../types/blockchain";
import { MultiChainAuditModel } from "../models/MultiChainAudit";
import { logger } from "../utils/logger";
import {
	MultiChainErrorHandler,
	createPlatformError,
	handleCrossChainError,
	PlatformError,
} from "../middleware/MultiChainErrorHandler";
import {
	analyzerFallbackService,
	FallbackAnalysisResult,
} from "./AnalyzerFallbackService";
import { platformValidationService } from "./PlatformValidationService";

// Job types for multi-chain analysis
export enum MultiChainJobType {
	MULTI_CHAIN_ANALYSIS = "multi_chain_analysis",
	PLATFORM_ANALYSIS = "platform_analysis",
	CROSS_CHAIN_ANALYSIS = "cross_chain_analysis",
}

// Job data interfaces
export interface MultiChainAnalysisJobData {
	multiChainAuditId: string;
	userId: string;
	auditName: string;
	request: MultiChainAnalysisRequest;
}

export interface PlatformAnalysisJobData {
	multiChainAuditId: string;
	userId: string;
	platform: string;
	contracts: ContractInput[];
	analysisOptions: AnalysisOptions;
}

export interface CrossChainAnalysisJobData {
	multiChainAuditId: string;
	userId: string;
	platformResults: Map<string, AnalysisResult>;
}

// Progress tracking interface
export interface MultiChainAnalysisProgress {
	multiChainAuditId: string;
	status: "pending" | "analyzing" | "completed" | "failed";
	overallProgress: number; // 0-100
	platformProgress: Map<string, number>; // Platform-specific progress
	currentStep: string;
	completedPlatforms: string[];
	failedPlatforms: string[];
	estimatedTimeRemaining?: number;
	error?: string;
	recoverySuggestions?: string[];
}

/**
 * Orchestrates multi-chain analysis across different blockchain platforms
 */
export class MultiChainAnalysisOrchestrator {
	private wsService: WebSocketService;
	private crossChainAnalyzer: CrossChainAnalyzer;
	private progressCache: Map<string, MultiChainAnalysisProgress> = new Map();

	constructor(wsService: WebSocketService) {
		this.wsService = wsService;
		this.crossChainAnalyzer = new CrossChainAnalyzer();
		this.setupJobProcessors();
		this.setupProgressTracking();
	}

	/**
	 * Start a multi-chain analysis
	 */
	async startMultiChainAnalysis(request: {
		userId: string;
		auditName: string;
		analysisRequest: MultiChainAnalysisRequest;
		priority?: JobPriority;
	}): Promise<{
		success: boolean;
		multiChainAuditId?: string;
		jobId?: string;
		error?: string;
	}> {
		try {
			// Validate the request
			const validation = this.validateMultiChainRequest(
				request.analysisRequest
			);
			if (!validation.isValid) {
				return {
					success: false,
					error: `Validation failed: ${validation.errors.join(", ")}`,
				};
			}

			// Create multi-chain audit record
			const multiChainAudit = await MultiChainAuditModel.create({
				user_id: request.userId,
				audit_name: request.auditName,
				platforms: request.analysisRequest.platforms,
				contracts: this.serializeContracts(request.analysisRequest.contracts),
				cross_chain_analysis: request.analysisRequest.crossChainAnalysis,
				status: "pending",
			});

			if (!multiChainAudit) {
				return {
					success: false,
					error: "Failed to create multi-chain audit record",
				};
			}

			// Initialize progress tracking
			this.initializeProgress(multiChainAudit.id, request.analysisRequest);

			// Add job to queue
			const jobData: MultiChainAnalysisJobData = {
				multiChainAuditId: multiChainAudit.id,
				userId: request.userId,
				auditName: request.auditName,
				request: request.analysisRequest,
			};

			const job = await auditQueue.add(
				MultiChainJobType.MULTI_CHAIN_ANALYSIS,
				jobData,
				{
					priority: request.priority || JobPriority.NORMAL,
					delay: 0,
				}
			);

			// Notify user via WebSocket
			this.notifyProgress(request.userId, multiChainAudit.id, {
				status: "pending",
				overallProgress: 0,
				currentStep: "Queued for multi-chain analysis",
			});

			logger.info(
				`Started multi-chain analysis for audit ${multiChainAudit.id} with job ${job.id}`
			);

			return {
				success: true,
				multiChainAuditId: multiChainAudit.id,
				jobId: job.id.toString(),
			};
		} catch (error) {
			logger.error("Error starting multi-chain analysis:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Get analysis progress for a multi-chain audit
	 */
	async getAnalysisProgress(
		multiChainAuditId: string,
		userId: string
	): Promise<{
		success: boolean;
		progress?: MultiChainAnalysisProgress;
		error?: string;
	}> {
		try {
			// Verify user owns the audit
			const audit = await MultiChainAuditModel.findById(multiChainAuditId);
			if (!audit) {
				return { success: false, error: "Multi-chain audit not found" };
			}

			if (audit.user_id !== userId) {
				return { success: false, error: "Access denied" };
			}

			// Get progress from cache or reconstruct from audit status
			let progress = this.progressCache.get(multiChainAuditId);

			if (!progress) {
				progress = await this.reconstructProgress(audit);
			}

			return {
				success: true,
				progress,
			};
		} catch (error) {
			logger.error("Error getting analysis progress:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Cancel a multi-chain analysis
	 */
	async cancelAnalysis(
		multiChainAuditId: string,
		userId: string
	): Promise<{
		success: boolean;
		error?: string;
	}> {
		try {
			// Verify user owns the audit
			const audit = await MultiChainAuditModel.findById(multiChainAuditId);
			if (!audit) {
				return { success: false, error: "Multi-chain audit not found" };
			}

			if (audit.user_id !== userId) {
				return { success: false, error: "Access denied" };
			}

			// Find and cancel related jobs
			const jobs = await auditQueue.getJobs(["waiting", "active", "delayed"]);
			const relatedJobs = jobs.filter((job) => {
				const data = job.data as any;
				return data.multiChainAuditId === multiChainAuditId;
			});

			// Cancel all related jobs
			for (const job of relatedJobs) {
				await job.remove();
			}

			// Update audit status
			await audit.updateStatus("failed"); // Using 'failed' as there's no 'cancelled' status

			// Update progress
			this.updateProgress(multiChainAuditId, {
				status: "failed",
				overallProgress: 0,
				currentStep: "Analysis cancelled",
				error: "Analysis was cancelled by user",
			});

			// Notify user
			this.notifyProgress(userId, multiChainAuditId, {
				status: "failed",
				overallProgress: 0,
				currentStep: "Analysis cancelled",
			});

			logger.info(`Cancelled multi-chain analysis: ${multiChainAuditId}`);

			return { success: true };
		} catch (error) {
			logger.error("Error cancelling analysis:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Get queue statistics for multi-chain analysis
	 */
	async getQueueStats(): Promise<{
		multiChainAnalysis: {
			waiting: number;
			active: number;
			completed: number;
			failed: number;
		};
		platformAnalysis: {
			waiting: number;
			active: number;
			completed: number;
			failed: number;
		};
		crossChainAnalysis: {
			waiting: number;
			active: number;
			completed: number;
			failed: number;
		};
	}> {
		const [waiting, active, completed, failed] = await Promise.all([
			auditQueue.getWaiting(),
			auditQueue.getActive(),
			auditQueue.getCompleted(),
			auditQueue.getFailed(),
		]);

		const filterByType = (jobs: Job[], type: string) =>
			jobs.filter((job) => job.name === type);

		return {
			multiChainAnalysis: {
				waiting: filterByType(waiting, MultiChainJobType.MULTI_CHAIN_ANALYSIS)
					.length,
				active: filterByType(active, MultiChainJobType.MULTI_CHAIN_ANALYSIS)
					.length,
				completed: filterByType(
					completed,
					MultiChainJobType.MULTI_CHAIN_ANALYSIS
				).length,
				failed: filterByType(failed, MultiChainJobType.MULTI_CHAIN_ANALYSIS)
					.length,
			},
			platformAnalysis: {
				waiting: filterByType(waiting, MultiChainJobType.PLATFORM_ANALYSIS)
					.length,
				active: filterByType(active, MultiChainJobType.PLATFORM_ANALYSIS)
					.length,
				completed: filterByType(completed, MultiChainJobType.PLATFORM_ANALYSIS)
					.length,
				failed: filterByType(failed, MultiChainJobType.PLATFORM_ANALYSIS)
					.length,
			},
			crossChainAnalysis: {
				waiting: filterByType(waiting, MultiChainJobType.CROSS_CHAIN_ANALYSIS)
					.length,
				active: filterByType(active, MultiChainJobType.CROSS_CHAIN_ANALYSIS)
					.length,
				completed: filterByType(
					completed,
					MultiChainJobType.CROSS_CHAIN_ANALYSIS
				).length,
				failed: filterByType(failed, MultiChainJobType.CROSS_CHAIN_ANALYSIS)
					.length,
			},
		};
	}

	/**
	 * Setup job processors for multi-chain analysis
	 */
	private setupJobProcessors(): void {
		// Main multi-chain analysis processor
		auditQueue.process(
			MultiChainJobType.MULTI_CHAIN_ANALYSIS,
			1, // Process one at a time to manage resources
			async (job: Job<MultiChainAnalysisJobData>) => {
				return this.processMultiChainAnalysis(job);
			}
		);

		// Platform-specific analysis processor
		auditQueue.process(
			MultiChainJobType.PLATFORM_ANALYSIS,
			3, // Allow parallel platform analysis
			async (job: Job<PlatformAnalysisJobData>) => {
				return this.processPlatformAnalysis(job);
			}
		);

		// Cross-chain analysis processor
		auditQueue.process(
			MultiChainJobType.CROSS_CHAIN_ANALYSIS,
			1, // Process one at a time
			async (job: Job<CrossChainAnalysisJobData>) => {
				return this.processCrossChainAnalysis(job);
			}
		);

		logger.info("Multi-chain analysis job processors initialized");
	}

	/**
	 * Setup progress tracking with Redis
	 */
	private setupProgressTracking(): void {
		// Set up periodic progress cleanup
		setInterval(() => {
			this.cleanupOldProgress();
		}, 5 * 60 * 1000); // Clean up every 5 minutes

		logger.info("Progress tracking initialized");
	}

	/**
	 * Process main multi-chain analysis job
	 */
	private async processMultiChainAnalysis(
		job: Job<MultiChainAnalysisJobData>
	): Promise<any> {
		const { multiChainAuditId, userId, request } = job.data;

		try {
			logger.info(`Starting multi-chain analysis: ${multiChainAuditId}`);

			// Update audit status
			const audit = await MultiChainAuditModel.findById(multiChainAuditId);
			if (!audit) {
				throw new Error("Multi-chain audit not found");
			}

			await audit.updateStatus("analyzing");

			// Update progress
			await this.updateJobProgress(job, 5);
			this.updateProgress(multiChainAuditId, {
				status: "analyzing",
				overallProgress: 5,
				currentStep: "Initializing multi-chain analysis",
			});

			// Group contracts by platform
			const contractsByPlatform = this.groupContractsByPlatform(
				request.contracts
			);

			// Create platform analysis jobs
			const platformJobs: Job[] = [];
			let jobIndex = 0;

			for (const [platform, contracts] of contractsByPlatform) {
				const platformJobData: PlatformAnalysisJobData = {
					multiChainAuditId,
					userId,
					platform,
					contracts,
					analysisOptions: request.analysisOptions,
				};

				const platformJob = await auditQueue.add(
					MultiChainJobType.PLATFORM_ANALYSIS,
					platformJobData,
					{
						priority: JobPriority.HIGH, // Higher priority for sub-jobs
						delay: jobIndex * 1000, // Stagger job starts by 1 second
					}
				);

				platformJobs.push(platformJob);
				jobIndex++;
			}

			// Update progress
			await this.updateJobProgress(job, 10);
			this.updateProgress(multiChainAuditId, {
				status: "analyzing",
				overallProgress: 10,
				currentStep: `Created ${platformJobs.length} platform analysis jobs`,
			});

			// Wait for all platform analyses to complete
			const platformResults = await this.waitForPlatformAnalyses(
				job,
				multiChainAuditId,
				platformJobs
			);

			// Update progress
			await this.updateJobProgress(job, 80);
			this.updateProgress(multiChainAuditId, {
				status: "analyzing",
				overallProgress: 80,
				currentStep: "Platform analyses completed, processing results",
			});

			// Store platform results
			await audit.updateResults(this.serializePlatformResults(platformResults));

			// Perform cross-chain analysis if requested
			let crossChainResults: CrossChainAnalysisResult | undefined;

			if (request.crossChainAnalysis && platformResults.size > 1) {
				await this.updateJobProgress(job, 85);
				this.updateProgress(multiChainAuditId, {
					status: "analyzing",
					overallProgress: 85,
					currentStep: "Starting cross-chain analysis",
				});

				const crossChainJobData: CrossChainAnalysisJobData = {
					multiChainAuditId,
					userId,
					platformResults,
				};

				const crossChainJob = await auditQueue.add(
					MultiChainJobType.CROSS_CHAIN_ANALYSIS,
					crossChainJobData,
					{
						priority: JobPriority.HIGH,
					}
				);

				crossChainResults = await this.waitForCrossChainAnalysis(crossChainJob);

				if (crossChainResults) {
					await audit.updateCrossChainResults(crossChainResults);
				}
			}

			// Update progress
			await this.updateJobProgress(job, 95);
			this.updateProgress(multiChainAuditId, {
				status: "analyzing",
				overallProgress: 95,
				currentStep: "Finalizing multi-chain analysis",
			});

			// Complete the audit
			await audit.updateStatus("completed");

			// Final progress update
			await this.updateJobProgress(job, 100);
			this.updateProgress(multiChainAuditId, {
				status: "completed",
				overallProgress: 100,
				currentStep: "Multi-chain analysis completed",
				completedPlatforms: Array.from(platformResults.keys()),
			});

			// Notify completion
			this.notifyProgress(userId, multiChainAuditId, {
				status: "completed",
				overallProgress: 100,
				currentStep: "Multi-chain analysis completed",
			});

			logger.info(`Completed multi-chain analysis: ${multiChainAuditId}`);

			return {
				success: true,
				platformResults: platformResults.size,
				crossChainAnalysis: !!crossChainResults,
				totalVulnerabilities: this.countTotalVulnerabilities(platformResults),
			};
		} catch (error) {
			logger.error(
				`Multi-chain analysis failed for ${multiChainAuditId}:`,
				error
			);

			// Handle the error with platform-specific context
			const platformError = this.handleMultiChainAnalysisError(
				error,
				request.platforms,
				multiChainAuditId
			);

			// Update audit status with error details
			const audit = await MultiChainAuditModel.findById(multiChainAuditId);
			if (audit) {
				await audit.updateStatus("failed");
				// Store error details for debugging
				await audit.updateResults({
					error: {
						code: platformError.code,
						message: platformError.message,
						platform: platformError.platform,
						retryable: platformError.retryable,
						fallbackAvailable: platformError.fallbackAvailable,
						platformSpecificData: platformError.platformSpecificData,
					},
				});
			}

			// Update progress with detailed error information
			this.updateProgress(multiChainAuditId, {
				status: "failed",
				overallProgress: 0,
				currentStep: "Multi-chain analysis failed",
				error: platformError.message,
				failedPlatforms: request.platforms,
			});

			// Notify failure with recovery suggestions
			this.notifyProgress(userId, multiChainAuditId, {
				status: "failed",
				overallProgress: 0,
				currentStep: "Multi-chain analysis failed",
				error: platformError.message,
				recoverySuggestions: this.getRecoverySuggestions(platformError),
			});

			throw platformError;
		}
	}
	/**
	 * Process platform-specific analysis job
	 */
	private async processPlatformAnalysis(
		job: Job<PlatformAnalysisJobData>
	): Promise<any> {
		const { multiChainAuditId, platform, contracts, analysisOptions } =
			job.data;

		try {
			logger.info(
				`Starting platform analysis for ${platform} in audit ${multiChainAuditId}`
			);

			// Get analyzer for the platform
			const analyzer = AnalyzerFactory.getAnalyzer(platform);
			if (!analyzer) {
				throw createPlatformError(
					"ANALYZER_UNAVAILABLE",
					`No analyzer available for platform: ${platform}`,
					platform,
					{ availablePlatforms: AnalyzerFactory.getAvailablePlatforms() }
				);
			}

			// Update progress
			await this.updateJobProgress(job, 10);
			this.updatePlatformProgress(multiChainAuditId, platform, 10);

			// Enhanced contract validation with platform-specific error handling
			for (const contract of contracts) {
				try {
					const validation = await platformValidationService.validateContract(
						contract,
						{ strictMode: false }
					);
					if (!validation.isValid) {
						throw createPlatformError(
							"PLATFORM_DETECTION_FAILED",
							`Contract validation failed for ${contract.filename}`,
							platform,
							{
								validationErrors: validation.errors,
								suggestions: validation.suggestions,
							}
						);
					}
				} catch (error) {
					if ((error as PlatformError).platform) {
						throw error; // Re-throw platform errors
					}
					throw createPlatformError(
						"PLATFORM_DETECTION_FAILED",
						`Validation error for ${contract.filename}: ${
							error instanceof Error ? error.message : "Unknown error"
						}`,
						platform,
						{ contract: contract.filename }
					);
				}
			}

			// Update progress
			await this.updateJobProgress(job, 30);
			this.updatePlatformProgress(multiChainAuditId, platform, 30);

			// Run analysis with fallback support
			let analysisResult: AnalysisResult;
			try {
				analysisResult = await analyzerFallbackService.analyzeWithFallback(
					analyzer,
					contracts,
					analysisOptions,
					{
						enableAIFallback: true,
						enableBasicValidation: true,
						maxRetryAttempts: 3,
					}
				);
			} catch (error) {
				throw this.handlePlatformAnalysisError(error, platform, contracts);
			}

			// Check if analysis succeeded or used fallback
			if (
				!analysisResult.success &&
				(analysisResult as FallbackAnalysisResult).degradationLevel ===
					"minimal"
			) {
				logger.warn(
					`Platform analysis for ${platform} completed with minimal functionality`,
					{
						fallbackStrategy: (analysisResult as FallbackAnalysisResult)
							.fallbackStrategy,
						availableFeatures: (analysisResult as FallbackAnalysisResult)
							.availableFeatures,
					}
				);
			}

			// Update progress
			await this.updateJobProgress(job, 90);
			this.updatePlatformProgress(multiChainAuditId, platform, 90);

			// Store platform-specific vulnerabilities
			await this.storePlatformVulnerabilities(
				multiChainAuditId,
				platform,
				analysisResult.vulnerabilities
			);

			// Complete platform analysis
			await this.updateJobProgress(job, 100);
			this.updatePlatformProgress(multiChainAuditId, platform, 100);
			this.markPlatformCompleted(multiChainAuditId, platform);

			logger.info(
				`Completed platform analysis for ${platform} in audit ${multiChainAuditId}`
			);

			return {
				success: true,
				platform,
				vulnerabilities: analysisResult.vulnerabilities.length,
				executionTime: analysisResult.executionTime,
			};
		} catch (error) {
			logger.error(
				`Platform analysis failed for ${platform} in audit ${multiChainAuditId}:`,
				error
			);

			// Handle platform-specific error
			const platformError = this.handlePlatformAnalysisError(
				error,
				platform,
				contracts
			);

			// Mark platform as failed with error details
			this.markPlatformFailed(multiChainAuditId, platform, platformError);

			// Check if we should continue with other platforms or fail completely
			const shouldContinue = await this.shouldContinueAfterPlatformFailure(
				multiChainAuditId,
				platform,
				platformError
			);

			if (!shouldContinue) {
				throw platformError;
			}

			// Return partial failure result to allow other platforms to continue
			return {
				success: false,
				platform,
				error: platformError.message,
				fallbackAvailable: platformError.fallbackAvailable,
				retryable: platformError.retryable,
			};
		}
	}

	/**
	 * Process cross-chain analysis job
	 */
	private async processCrossChainAnalysis(
		job: Job<CrossChainAnalysisJobData>
	): Promise<CrossChainAnalysisResult> {
		const { multiChainAuditId, platformResults } = job.data;

		try {
			logger.info(
				`Starting cross-chain analysis for audit ${multiChainAuditId}`
			);

			// Update progress
			await this.updateJobProgress(job, 10);

			// Use the CrossChainAnalyzer to perform comprehensive analysis
			const result = await this.crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);

			// Update progress
			await this.updateJobProgress(job, 80);

			// Store cross-chain analysis results in database
			await this.storeCrossChainAnalysisResults(multiChainAuditId, result);

			// Update progress
			await this.updateJobProgress(job, 100);

			logger.info(
				`Completed cross-chain analysis for audit ${multiChainAuditId}`
			);

			return result;
		} catch (error) {
			logger.error(
				`Cross-chain analysis failed for audit ${multiChainAuditId}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Wait for all platform analyses to complete
	 */
	private async waitForPlatformAnalyses(
		parentJob: Job,
		multiChainAuditId: string,
		platformJobs: Job[]
	): Promise<Map<string, AnalysisResult>> {
		const results = new Map<string, AnalysisResult>();
		const completedJobs = new Set<string>();
		let lastProgress = 10;

		return new Promise((resolve, reject) => {
			const checkInterval = setInterval(async () => {
				try {
					let completedCount = 0;
					let failedCount = 0;

					for (const job of platformJobs) {
						const state = await job.getState();
						const jobId = job.id.toString();

						if (state === "completed" && !completedJobs.has(jobId)) {
							completedJobs.add(jobId);
							const jobData = job.data as PlatformAnalysisJobData;
							const platform = jobData.platform;

							// Get the analysis result from the job return value
							const jobResult = job.returnvalue;
							if (jobResult && jobResult.success) {
								// Reconstruct the analysis result
								const analysisResult: AnalysisResult = {
									success: true,
									vulnerabilities: [], // Will be loaded from database
									errors: [],
									warnings: [],
									executionTime: jobResult.executionTime || 0,
								};

								results.set(platform, analysisResult);
							}

							completedCount++;
						} else if (state === "failed") {
							failedCount++;
						} else if (state === "completed") {
							completedCount++;
						}
					}

					// Update progress based on completed jobs
					const progress = Math.min(
						10 + Math.floor((completedCount / platformJobs.length) * 70),
						80
					);

					if (progress > lastProgress) {
						await this.updateJobProgress(parentJob, progress);
						this.updateProgress(multiChainAuditId, {
							status: "analyzing",
							overallProgress: progress,
							currentStep: `Platform analysis progress: ${completedCount}/${platformJobs.length} completed`,
						});
						lastProgress = progress;
					}

					// Check if all jobs are done
					if (completedCount + failedCount === platformJobs.length) {
						clearInterval(checkInterval);

						if (failedCount > 0 && completedCount === 0) {
							reject(
								new Error(
									`All platform analyses failed (${failedCount}/${platformJobs.length})`
								)
							);
						} else if (failedCount > 0) {
							logger.warn(
								`Some platform analyses failed (${failedCount}/${platformJobs.length}), continuing with successful ones`
							);
						}

						resolve(results);
					}
				} catch (error) {
					clearInterval(checkInterval);
					reject(error);
				}
			}, 2000); // Check every 2 seconds

			// Set timeout for the entire operation
			setTimeout(() => {
				clearInterval(checkInterval);
				reject(new Error("Platform analyses timed out"));
			}, 10 * 60 * 1000); // 10 minutes timeout
		});
	}

	/**
	 * Wait for cross-chain analysis to complete
	 */
	private async waitForCrossChainAnalysis(
		crossChainJob: Job
	): Promise<CrossChainAnalysisResult | undefined> {
		return new Promise((resolve, reject) => {
			const checkInterval = setInterval(async () => {
				try {
					const state = await crossChainJob.getState();

					if (state === "completed") {
						clearInterval(checkInterval);
						resolve(crossChainJob.returnvalue);
					} else if (state === "failed") {
						clearInterval(checkInterval);
						logger.warn("Cross-chain analysis failed, continuing without it");
						resolve(undefined);
					}
				} catch (error) {
					clearInterval(checkInterval);
					reject(error);
				}
			}, 1000); // Check every second

			// Set timeout
			setTimeout(() => {
				clearInterval(checkInterval);
				logger.warn("Cross-chain analysis timed out, continuing without it");
				resolve(undefined);
			}, 5 * 60 * 1000); // 5 minutes timeout
		});
	}

	/**
	 * Validate multi-chain analysis request
	 */
	private validateMultiChainRequest(request: MultiChainAnalysisRequest): {
		isValid: boolean;
		errors: string[];
		warnings: string[];
	} {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check if platforms are provided
		if (!request.platforms || request.platforms.length === 0) {
			errors.push("At least one platform must be specified");
		}

		// Check if contracts are provided
		if (!request.contracts || request.contracts.length === 0) {
			errors.push("At least one contract must be provided");
		}

		// Validate platforms
		for (const platformId of request.platforms) {
			const platform = blockchainRegistry.getPlatform(platformId);
			if (!platform) {
				errors.push(`Unknown platform: ${platformId}`);
			} else if (!platform.isActive) {
				errors.push(`Platform is not active: ${platformId}`);
			}
		}

		// Validate contracts
		for (const contract of request.contracts) {
			if (!contract.code || contract.code.trim().length === 0) {
				errors.push(`Contract code cannot be empty: ${contract.filename}`);
			}

			if (!request.platforms.includes(contract.platform)) {
				errors.push(
					`Contract platform '${contract.platform}' not in requested platforms`
				);
			}
		}

		// Check cross-chain analysis requirements
		if (request.crossChainAnalysis && request.platforms.length < 2) {
			warnings.push(
				"Cross-chain analysis requested but only one platform specified"
			);
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Group contracts by platform
	 */
	private groupContractsByPlatform(
		contracts: ContractInput[]
	): Map<string, ContractInput[]> {
		const grouped = new Map<string, ContractInput[]>();

		for (const contract of contracts) {
			if (!grouped.has(contract.platform)) {
				grouped.set(contract.platform, []);
			}
			grouped.get(contract.platform)!.push(contract);
		}

		return grouped;
	}

	/**
	 * Initialize progress tracking for a multi-chain audit
	 */
	private initializeProgress(
		multiChainAuditId: string,
		request: MultiChainAnalysisRequest
	): void {
		const progress: MultiChainAnalysisProgress = {
			multiChainAuditId,
			status: "pending",
			overallProgress: 0,
			platformProgress: new Map(),
			currentStep: "Initializing",
			completedPlatforms: [],
			failedPlatforms: [],
		};

		// Initialize platform progress
		for (const platform of request.platforms) {
			progress.platformProgress.set(platform, 0);
		}

		this.progressCache.set(multiChainAuditId, progress);
	}

	/**
	 * Update progress for a multi-chain audit
	 */
	private updateProgress(
		multiChainAuditId: string,
		updates: Partial<MultiChainAnalysisProgress>
	): void {
		const progress = this.progressCache.get(multiChainAuditId);
		if (progress) {
			Object.assign(progress, updates);
			this.progressCache.set(multiChainAuditId, progress);
		}
	}

	/**
	 * Update platform-specific progress
	 */
	private updatePlatformProgress(
		multiChainAuditId: string,
		platform: string,
		progress: number
	): void {
		const auditProgress = this.progressCache.get(multiChainAuditId);
		if (auditProgress) {
			auditProgress.platformProgress.set(platform, progress);
			this.progressCache.set(multiChainAuditId, auditProgress);
		}
	}

	/**
	 * Mark platform as completed
	 */
	private markPlatformCompleted(
		multiChainAuditId: string,
		platform: string
	): void {
		const progress = this.progressCache.get(multiChainAuditId);
		if (progress && !progress.completedPlatforms.includes(platform)) {
			progress.completedPlatforms.push(platform);
			this.progressCache.set(multiChainAuditId, progress);
		}
	}

	/**
	 * Notify progress via WebSocket
	 */
	private notifyProgress(
		userId: string,
		multiChainAuditId: string,
		updates: Partial<MultiChainAnalysisProgress>
	): void {
		const progress = this.progressCache.get(multiChainAuditId);
		if (progress) {
			Object.assign(progress, updates);
			this.wsService.notifyMultiChainProgress(userId, progress);
		}
	}

	/**
	 * Update job progress
	 */
	private async updateJobProgress(job: Job, progress: number): Promise<void> {
		await job.progress(progress);
	}

	/**
	 * Serialize contracts for database storage
	 */
	private serializeContracts(contracts: ContractInput[]): Record<string, any> {
		const serialized: Record<string, any> = {};

		contracts.forEach((contract, index) => {
			serialized[`contract_${index}`] = {
				code: contract.code,
				filename: contract.filename,
				platform: contract.platform,
				language: contract.language,
				dependencies: contract.dependencies || [],
			};
		});

		return serialized;
	}

	/**
	 * Serialize platform results for database storage
	 */
	private serializePlatformResults(
		results: Map<string, AnalysisResult>
	): Record<string, any> {
		const serialized: Record<string, any> = {};

		for (const [platform, result] of results) {
			serialized[platform] = {
				success: result.success,
				vulnerabilityCount: result.vulnerabilities.length,
				errors: result.errors,
				warnings: result.warnings,
				executionTime: result.executionTime,
				platformSpecific: result.platformSpecific,
			};
		}

		return serialized;
	}

	/**
	 * Store platform-specific vulnerabilities
	 */
	private async storePlatformVulnerabilities(
		multiChainAuditId: string,
		platform: string,
		vulnerabilities: any[]
	): Promise<void> {
		for (const vuln of vulnerabilities) {
			try {
				await DatabaseService.createPlatformVulnerability({
					multi_chain_audit_id: multiChainAuditId,
					platform,
					vulnerability_type: vuln.type,
					severity: vuln.severity,
					title: vuln.title,
					description: vuln.description,
					location: vuln.location,
					recommendation: vuln.recommendation,
					platform_specific_data: vuln.platformSpecificData || {},
					confidence: vuln.confidence,
					source: vuln.source,
				});
			} catch (error) {
				logger.error("Failed to store platform vulnerability:", error);
			}
		}
	}

	/**
	 * Count total vulnerabilities across all platforms
	 */
	private countTotalVulnerabilities(
		platformResults: Map<string, AnalysisResult>
	): number {
		let total = 0;
		for (const result of platformResults.values()) {
			total += result.vulnerabilities.length;
		}
		return total;
	}

	/**
	 * Reconstruct progress from audit status
	 */
	private async reconstructProgress(
		audit: MultiChainAuditModel
	): Promise<MultiChainAnalysisProgress> {
		const progress: MultiChainAnalysisProgress = {
			multiChainAuditId: audit.id,
			status: audit.status,
			overallProgress: audit.status === "completed" ? 100 : 0,
			platformProgress: new Map(),
			currentStep: this.getStepFromStatus(audit.status),
			completedPlatforms: [],
			failedPlatforms: [],
		};

		// Initialize platform progress based on audit status
		for (const platform of audit.platforms) {
			progress.platformProgress.set(
				platform,
				audit.status === "completed" ? 100 : 0
			);

			if (audit.status === "completed") {
				progress.completedPlatforms.push(platform);
			}
		}

		return progress;
	}

	/**
	 * Get step description from audit status
	 */
	private getStepFromStatus(
		status: "pending" | "analyzing" | "completed" | "failed"
	): string {
		switch (status) {
			case "pending":
				return "Queued for analysis";
			case "analyzing":
				return "Analysis in progress";
			case "completed":
				return "Analysis completed";
			case "failed":
				return "Analysis failed";
			default:
				return "Unknown status";
		}
	}

	/**
	 * Clean up old progress entries
	 */
	private cleanupOldProgress(): void {
		const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

		for (const [auditId, progress] of this.progressCache) {
			if (progress.status === "completed" || progress.status === "failed") {
				// Remove completed/failed audits after 24 hours
				this.progressCache.delete(auditId);
			}
		}

		logger.debug("Cleaned up old progress entries");
	}

	/**
	 * Store cross-chain analysis results in database
	 */
	private async storeCrossChainAnalysisResults(
		multiChainAuditId: string,
		result: CrossChainAnalysisResult
	): Promise<void> {
		try {
			await DatabaseService.createCrossChainAnalysis({
				multi_chain_audit_id: multiChainAuditId,
				bridge_security_assessment: result.bridgeSecurityAssessment,
				state_consistency_analysis: result.stateConsistencyAnalysis,
				interoperability_risks: { risks: result.interoperabilityRisks },
				recommendations: { items: result.crossChainRecommendations },
			});

			logger.info(
				`Stored cross-chain analysis results for audit ${multiChainAuditId}`
			);
		} catch (error) {
			logger.error(
				`Failed to store cross-chain analysis results for audit ${multiChainAuditId}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Handle multi-chain analysis errors with platform-specific context
	 */
	private handleMultiChainAnalysisError(
		error: any,
		platforms: string[],
		multiChainAuditId: string
	): PlatformError {
		if ((error as PlatformError).platform) {
			return error as PlatformError;
		}

		// Handle cross-chain specific errors
		if (platforms.length > 1) {
			return handleCrossChainError(error, platforms, {
				multiChainAuditId,
				analysisType: "multi-chain",
			});
		}

		// Handle single platform errors
		const platform = platforms[0] || "unknown";
		return createPlatformError(
			"MULTI_PLATFORM_TIMEOUT",
			error instanceof Error ? error.message : "Multi-chain analysis failed",
			platform,
			{
				multiChainAuditId,
				platforms,
				originalError: error,
			}
		);
	}

	/**
	 * Handle platform-specific analysis errors
	 */
	private handlePlatformAnalysisError(
		error: any,
		platform: string,
		contracts: ContractInput[]
	): PlatformError {
		if ((error as PlatformError).platform) {
			return error as PlatformError;
		}

		// Check for specific error patterns
		if (
			error.message?.includes("analyzer") ||
			error.message?.includes("not available")
		) {
			return createPlatformError(
				"ANALYZER_UNAVAILABLE",
				`Platform analyzer unavailable: ${error.message}`,
				platform,
				{
					contracts: contracts.map((c) => c.filename),
					originalError: error,
				}
			);
		}

		if (error.message?.includes("timeout")) {
			return createPlatformError(
				"MULTI_PLATFORM_TIMEOUT",
				`Platform analysis timed out: ${error.message}`,
				platform,
				{
					contracts: contracts.map((c) => c.filename),
					originalError: error,
				}
			);
		}

		if (error.message?.includes("validation")) {
			return createPlatformError(
				"PLATFORM_DETECTION_FAILED",
				`Platform validation failed: ${error.message}`,
				platform,
				{
					contracts: contracts.map((c) => c.filename),
					originalError: error,
				}
			);
		}

		// Generic platform analysis error
		return createPlatformError(
			"ANALYZER_UNAVAILABLE",
			error instanceof Error ? error.message : "Platform analysis failed",
			platform,
			{
				contracts: contracts.map((c) => c.filename),
				originalError: error,
			}
		);
	}

	/**
	 * Determine if analysis should continue after platform failure
	 */
	private async shouldContinueAfterPlatformFailure(
		multiChainAuditId: string,
		failedPlatform: string,
		error: PlatformError
	): Promise<boolean> {
		// Get current progress
		const progress = this.progressCache.get(multiChainAuditId);
		if (!progress) {
			return false;
		}

		// If this is a single-platform analysis, don't continue
		if (
			progress.completedPlatforms.length + progress.failedPlatforms.length ===
			1
		) {
			return false;
		}

		// Continue if error is retryable and we have fallback options
		if (error.retryable && error.fallbackAvailable) {
			logger.info(
				`Continuing multi-chain analysis despite ${failedPlatform} failure`,
				{
					multiChainAuditId,
					failedPlatform,
					retryable: error.retryable,
					fallbackAvailable: error.fallbackAvailable,
				}
			);
			return true;
		}

		// Continue if we have other platforms that might succeed
		const totalPlatforms =
			progress.completedPlatforms.length +
			progress.failedPlatforms.length +
			(progress.platformProgress?.size || 0);

		if (totalPlatforms > 1) {
			logger.info(`Continuing multi-chain analysis with remaining platforms`, {
				multiChainAuditId,
				failedPlatform,
				totalPlatforms,
			});
			return true;
		}

		return false;
	}

	/**
	 * Mark platform as failed with error details
	 */
	private markPlatformFailed(
		multiChainAuditId: string,
		platform: string,
		error?: PlatformError
	): void {
		const progress = this.progressCache.get(multiChainAuditId);
		if (progress) {
			progress.failedPlatforms.push(platform);
			progress.platformProgress?.set(platform, 0);

			if (error) {
				progress.error = `${platform}: ${error.message}`;
			}

			this.progressCache.set(multiChainAuditId, progress);

			// Notify about platform failure
			this.wsService.notifyMultiChainProgress(progress.multiChainAuditId, {
				...progress,
				error: `Platform ${platform} failed: ${error?.message}`,
			});
		}
	}

	/**
	 * Get recovery suggestions for platform errors
	 */
	private getRecoverySuggestions(error: PlatformError): string[] {
		const suggestions: string[] = [];

		if (error.retryable) {
			suggestions.push("This error is temporary - you can retry the analysis");
		}

		if (error.fallbackAvailable) {
			suggestions.push("Alternative analysis methods are available");
		}

		// Platform-specific suggestions
		switch (error.platform) {
			case "ethereum":
				suggestions.push("Ensure Slither is installed and accessible");
				suggestions.push("Check Solidity compiler version compatibility");
				break;
			case "solana":
				suggestions.push("Verify Rust and Anchor CLI installation");
				suggestions.push("Check Cargo.toml dependencies");
				break;
			case "cardano":
				suggestions.push("Ensure Plutus development environment is set up");
				suggestions.push("Check Haskell compiler installation");
				break;
		}

		// Tool-specific suggestions
		if (error.toolName) {
			suggestions.push(
				`Check ${error.toolName} installation and configuration`
			);
		}

		// Generic suggestions
		if (suggestions.length === 0) {
			suggestions.push("Check system requirements and tool installations");
			suggestions.push("Contact support if the issue persists");
		}

		return suggestions;
	}
}
