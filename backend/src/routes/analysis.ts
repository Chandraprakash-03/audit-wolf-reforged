import { Router, Response } from "express";
import { AnalysisService } from "../services/AnalysisService";
import { AuditOrchestrator, JobPriority } from "../services/AuditOrchestrator";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { body, param, validationResult } from "express-validator";

const router = Router();
const analysisService = new AnalysisService();

// Validation middleware
const validateAnalysisRequest = [
	body("contractId").isUUID().withMessage("Invalid contract ID format"),
	body("analysisType")
		.isIn(["static", "ai", "full"])
		.withMessage("Analysis type must be 'static', 'ai', or 'full'"),
	body("platform")
		.optional()
		.isString()
		.withMessage("Platform must be a string"),
	body("priority")
		.optional()
		.isIn([1, 5, 10, 15])
		.withMessage(
			"Priority must be 1 (low), 5 (normal), 10 (high), or 15 (critical)"
		),
	body("options")
		.optional()
		.isObject()
		.withMessage("Options must be an object"),
];

const validateAuditId = [
	param("auditId").isUUID().withMessage("Invalid audit ID format"),
];

const validateContractValidation = [
	body("sourceCode")
		.trim()
		.isLength({ min: 1, max: 1000000 })
		.withMessage("Source code must be between 1 and 1,000,000 characters"),
];

/**
 * Start a new analysis
 * POST /api/analysis/start
 */
router.post(
	"/start",
	authenticateToken,
	validateAnalysisRequest,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { contractId, analysisType, platform, priority, options } =
				req.body;
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			// Use the new orchestrator for queue-based processing
			const auditOrchestrator = req.app.locals
				.auditOrchestrator as AuditOrchestrator;

			const result = await auditOrchestrator.startAudit({
				contractId,
				userId,
				analysisType,
				platform,
				priority: priority || JobPriority.NORMAL,
				options,
			});

			if (result.success) {
				res.status(201).json({
					success: true,
					data: {
						auditId: result.auditId,
						jobId: result.jobId,
						message: "Analysis queued successfully",
					},
				});
			} else {
				res.status(400).json({
					success: false,
					error: result.error,
				});
			}
		} catch (error) {
			console.error("Error starting analysis:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

/**
 * Get analysis progress
 * GET /api/analysis/:auditId/progress
 */
router.get(
	"/:auditId/progress",
	authenticateToken,
	validateAuditId,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { auditId } = req.params;
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			// Use the orchestrator for real-time progress tracking
			const auditOrchestrator = req.app.locals
				.auditOrchestrator as AuditOrchestrator;
			const result = await auditOrchestrator.getAuditProgress(auditId, userId);

			if (result.success) {
				res.json({
					success: true,
					data: result.progress,
				});
			} else {
				const statusCode =
					result.error === "Access denied"
						? 403
						: result.error === "Audit not found"
						? 404
						: 400;
				res.status(statusCode).json({
					success: false,
					error: result.error,
				});
			}
		} catch (error) {
			console.error("Error getting analysis progress:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

/**
 * Get analysis results
 * GET /api/analysis/:auditId/results
 */
router.get(
	"/:auditId/results",
	authenticateToken,
	validateAuditId,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { auditId } = req.params;
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			const result = await analysisService.getAnalysisResults(auditId, userId);

			if (result.success) {
				res.json({
					success: true,
					data: result.results,
				});
			} else {
				const statusCode =
					result.error === "Access denied"
						? 403
						: result.error === "Audit not found"
						? 404
						: 400;
				res.status(statusCode).json({
					success: false,
					error: result.error,
				});
			}
		} catch (error) {
			console.error("Error getting analysis results:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

/**
 * Validate contract source code
 * POST /api/analysis/validate
 */
router.post(
	"/validate",
	authenticateToken,
	validateContractValidation,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { sourceCode } = req.body;

			const result = await analysisService.validateContract(sourceCode);

			res.json({
				success: true,
				data: result,
			});
		} catch (error) {
			console.error("Error validating contract:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

/**
 * Get system health status
 * GET /api/analysis/health
 */
router.get(
	"/health",
	authenticateToken,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const health = await analysisService.checkSystemHealth();

			res.json({
				success: true,
				data: health,
			});
		} catch (error) {
			console.error("Error checking system health:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

/**
 * Cancel an ongoing analysis
 * POST /api/analysis/:auditId/cancel
 */
router.post(
	"/:auditId/cancel",
	authenticateToken,
	validateAuditId,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { auditId } = req.params;
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: "User not authenticated",
				});
			}

			// For now, return not implemented
			// In a full implementation, this would cancel the running analysis
			res.status(501).json({
				success: false,
				error: "Analysis cancellation not yet implemented",
			});
		} catch (error) {
			console.error("Error cancelling analysis:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

/**
 * Start cross-chain analysis
 * POST /api/analysis/cross-chain/start
 */
router.post(
	"/cross-chain/start",
	authenticateToken,
	[
		body("auditName")
			.trim()
			.isLength({ min: 1, max: 100 })
			.withMessage("Audit name must be between 1 and 100 characters"),
		body("platforms")
			.isArray({ min: 2 })
			.withMessage(
				"At least 2 platforms must be specified for cross-chain analysis"
			),
		body("contracts")
			.isArray({ min: 1 })
			.withMessage("At least 1 contract must be provided"),
		body("crossChainAnalysis")
			.optional()
			.isBoolean()
			.withMessage("crossChainAnalysis must be a boolean"),
		body("analysisOptions")
			.optional()
			.isObject()
			.withMessage("analysisOptions must be an object"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const {
				auditName,
				platforms,
				contracts,
				crossChainAnalysis = true,
				analysisOptions = {},
			} = req.body;
			const userId = req.user!.id;

			// Import MultiChainAnalysisOrchestrator
			const { MultiChainAnalysisOrchestrator } = await import(
				"../services/MultiChainAnalysisOrchestrator"
			);
			const { WebSocketService } = await import("../services/WebSocketService");

			// Create a mock WebSocket service for now
			const mockWsService = {
				notifyMultiChainProgress: () => {},
				notifyAuditProgress: () => {},
				notifyAuditComplete: () => {},
				notifyError: () => {},
			} as any;

			const orchestrator = new MultiChainAnalysisOrchestrator(mockWsService);

			const result = await orchestrator.startMultiChainAnalysis({
				userId,
				auditName,
				analysisRequest: {
					contracts,
					platforms,
					analysisOptions: {
						includeStaticAnalysis:
							analysisOptions.includeStaticAnalysis ?? true,
						includeAIAnalysis: analysisOptions.includeAIAnalysis ?? false,
						severityThreshold: analysisOptions.severityThreshold ?? "low",
						enabledDetectors: analysisOptions.enabledDetectors ?? [],
						disabledDetectors: analysisOptions.disabledDetectors ?? [],
						timeout: analysisOptions.timeout ?? 300000, // 5 minutes
						maxFileSize: analysisOptions.maxFileSize ?? 10485760, // 10MB
					},
					crossChainAnalysis,
				},
			});

			if (result.success) {
				res.status(202).json({
					success: true,
					message: "Cross-chain analysis started successfully",
					data: {
						multiChainAuditId: result.multiChainAuditId,
						jobId: result.jobId,
					},
				});
			} else {
				res.status(400).json({
					success: false,
					error: result.error || "Failed to start cross-chain analysis",
				});
			}
		} catch (error) {
			console.error("Cross-chain analysis error:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}

		return () => {};
	}
);

/**
 * Get cross-chain analysis progress
 * GET /api/analysis/cross-chain/:multiChainAuditId/progress
 */
router.get(
	"/cross-chain/:multiChainAuditId/progress",
	authenticateToken,
	[
		param("multiChainAuditId")
			.isUUID()
			.withMessage("Invalid multi-chain audit ID format"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: "Validation failed",
					details: errors.array(),
				});
			}

			const { multiChainAuditId } = req.params;
			const userId = req.user!.id;

			// Import MultiChainAnalysisOrchestrator
			const { MultiChainAnalysisOrchestrator } = await import(
				"../services/MultiChainAnalysisOrchestrator"
			);

			// Create a mock WebSocket service for now
			const mockWsService = {
				notifyMultiChainProgress: () => {},
				notifyAuditProgress: () => {},
				notifyAuditComplete: () => {},
				notifyError: () => {},
			} as any;

			const orchestrator = new MultiChainAnalysisOrchestrator(mockWsService);

			const result = await orchestrator.getAnalysisProgress(
				multiChainAuditId,
				userId
			);

			if (result.success) {
				res.json({
					success: true,
					data: result.progress,
				});
			} else {
				res.status(404).json({
					success: false,
					error: result.error || "Progress not found",
				});
			}
		} catch (error) {
			console.error("Get cross-chain progress error:", error);
			res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

export default router;
