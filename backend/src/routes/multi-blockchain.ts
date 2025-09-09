import express, { Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { MultiChainAuditModel } from "../models/MultiChainAudit";
import { BlockchainPlatformModel } from "../models/BlockchainPlatform";
import { blockchainRegistry } from "../services/BlockchainRegistry";
import { MultiChainAnalysisOrchestrator } from "../services/MultiChainAnalysisOrchestrator";
import { WebSocketService } from "../services/WebSocketService";
import { logger } from "../utils/logger";

const router = express.Router();

// Apply authentication to all multi-blockchain routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/multi-blockchain/platforms:
 *   get:
 *     summary: Get all supported blockchain platforms
 *     tags: [Multi-Blockchain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active platforms only
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter platforms by supported language
 *     responses:
 *       200:
 *         description: List of supported blockchain platforms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BlockchainPlatform'
 */
router.get("/platforms", async (req: AuthenticatedRequest, res: Response) => {
	try {
		const { active, language } = req.query;

		let platforms;
		if (active === "true") {
			platforms = await BlockchainPlatformModel.findActive();
		} else {
			platforms = await BlockchainPlatformModel.findAll();
		}

		// Filter by language if specified
		if (language) {
			platforms = platforms.filter((platform) =>
				platform.supportsLanguage(language as string)
			);
		}

		// Add registry information
		const platformsWithCapabilities = platforms.map((platform) => {
			const registryPlatform = blockchainRegistry.getPlatform(platform.id);
			return {
				...platform.toJSON(),
				capabilities: registryPlatform
					? {
							detectionPatterns: registryPlatform.detectionPatterns.length,
							validationRules: registryPlatform.validationRules.length,
							documentation: registryPlatform.documentation,
							website: registryPlatform.website,
					  }
					: null,
			};
		});

		logger.info("Fetched blockchain platforms", {
			userId: req.user?.id,
			count: platforms.length,
			filters: { active, language },
		});

		res.json({
			success: true,
			data: platformsWithCapabilities,
		});
	} catch (error) {
		logger.error("Error fetching blockchain platforms", {
			error,
			userId: req.user?.id,
		});
		res.status(500).json({
			success: false,
			error: {
				code: "FETCH_PLATFORMS_ERROR",
				message: "Failed to fetch blockchain platforms",
				recovery: [
					"Try refreshing the page",
					"Check your internet connection",
					"Contact support if the issue persists",
				],
			},
		});
	}
});

/**
 * @swagger
 * /api/multi-blockchain/platforms/{id}:
 *   get:
 *     summary: Get specific blockchain platform details
 *     tags: [Multi-Blockchain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Platform ID
 *     responses:
 *       200:
 *         description: Platform details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BlockchainPlatform'
 */
router.get("/platforms/:id", async (req: AuthenticatedRequest, res) => {
	try {
		const { id } = req.params;

		const platform = await BlockchainPlatformModel.findById(id);
		if (!platform) {
			return res.status(404).json({
				success: false,
				error: {
					code: "PLATFORM_NOT_FOUND",
					message: "Blockchain platform not found",
					recovery: [
						"Check if the platform ID is correct",
						"The platform may not be supported yet",
						"Try listing all platforms to see available options",
					],
				},
			});
		}

		// Add registry information
		const registryPlatform = blockchainRegistry.getPlatform(platform.id);
		const platformWithCapabilities = {
			...platform.toJSON(),
			capabilities: registryPlatform
				? {
						detectionPatterns: registryPlatform.detectionPatterns,
						validationRules: registryPlatform.validationRules,
						documentation: registryPlatform.documentation,
						website: registryPlatform.website,
				  }
				: null,
		};

		logger.info("Fetched platform details", {
			platformId: id,
			userId: req.user?.id,
		});

		res.json({
			success: true,
			data: platformWithCapabilities,
		});
	} catch (error) {
		logger.error("Error fetching platform details", {
			error,
			platformId: req.params.id,
			userId: req.user?.id,
		});
		res.status(500).json({
			success: false,
			error: {
				code: "FETCH_PLATFORM_ERROR",
				message: "Failed to fetch platform details",
				recovery: [
					"Try refreshing the page",
					"Check your internet connection",
					"Contact support if the issue persists",
				],
			},
		});
	}
	return () => {};
});

/**
 * @swagger
 * /api/multi-blockchain/platforms/detect:
 *   post:
 *     summary: Detect blockchain platform from contract code
 *     tags: [Multi-Blockchain]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Contract source code
 *               filename:
 *                 type: string
 *                 description: Optional filename for better detection
 *     responses:
 *       200:
 *         description: Platform detection results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       platform:
 *                         $ref: '#/components/schemas/BlockchainPlatform'
 *                       confidence:
 *                         type: number
 *                       matchedPatterns:
 *                         type: array
 */
router.post(
	"/platforms/detect",
	[
		body("code")
			.trim()
			.isLength({ min: 1, max: 1000000 })
			.withMessage("Code must be between 1 and 1,000,000 characters"),
		body("filename")
			.optional()
			.trim()
			.isLength({ max: 255 })
			.withMessage("Filename must be less than 255 characters"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid input data",
						details: errors.array(),
						recovery: [
							"Check the required fields",
							"Ensure all data is in the correct format",
						],
					},
				});
			}

			const { code, filename } = req.body;

			const detectionResults = blockchainRegistry.detectPlatform(
				code,
				filename
			);

			logger.info("Platform detection completed", {
				userId: req.user?.id,
				resultsCount: detectionResults.length,
				topPlatform: detectionResults[0]?.platform.id,
				topConfidence: detectionResults[0]?.confidence,
			});

			res.json({
				success: true,
				data: detectionResults.map((result) => ({
					platform: {
						id: result.platform.id,
						name: result.platform.name,
						displayName: result.platform.displayName,
						supportedLanguages: result.platform.supportedLanguages,
						fileExtensions: result.platform.fileExtensions,
					},
					confidence: result.confidence,
					matchedPatterns: result.matchedPatterns.map((pattern) => ({
						type: pattern.type,
						description: pattern.description,
						weight: pattern.weight,
					})),
				})),
			});
		} catch (error) {
			logger.error("Error detecting platform", {
				error,
				userId: req.user?.id,
			});
			res.status(500).json({
				success: false,
				error: {
					code: "PLATFORM_DETECTION_ERROR",
					message: "Failed to detect blockchain platform",
					recovery: [
						"Try again with different code",
						"Check if the code is valid",
						"Contact support if the issue persists",
					],
				},
			});
		}
		return () => {};
	}
);

/**
 * @swagger
 * /api/multi-blockchain/audits:
 *   post:
 *     summary: Start a multi-blockchain audit
 *     tags: [Multi-Blockchain]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - auditName
 *               - platforms
 *               - contracts
 *             properties:
 *               auditName:
 *                 type: string
 *                 description: Name for the multi-chain audit
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of blockchain platform IDs
 *               contracts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                     filename:
 *                       type: string
 *                     platform:
 *                       type: string
 *               crossChainAnalysis:
 *                 type: boolean
 *                 description: Enable cross-chain analysis
 *               analysisOptions:
 *                 type: object
 *                 description: Analysis configuration options
 *     responses:
 *       202:
 *         description: Multi-chain audit started successfully
 */
router.post(
	"/audits",
	[
		body("auditName")
			.trim()
			.isLength({ min: 1, max: 100 })
			.withMessage("Audit name must be between 1 and 100 characters"),
		body("platforms")
			.isArray({ min: 1 })
			.withMessage("At least 1 platform must be specified"),
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
					error: {
						code: "VALIDATION_ERROR",
						message: "Invalid input data",
						details: errors.array(),
						recovery: [
							"Check the required fields",
							"Ensure all data is in the correct format",
						],
					},
				});
			}

			const {
				auditName,
				platforms,
				contracts,
				crossChainAnalysis = false,
				analysisOptions = {},
			} = req.body;
			const userId = req.user!.id;

			// Validate platforms exist
			for (const platformId of platforms) {
				const platform = await BlockchainPlatformModel.findById(platformId);
				if (!platform) {
					return res.status(400).json({
						success: false,
						error: {
							code: "INVALID_PLATFORM",
							message: `Platform '${platformId}' not found`,
							recovery: [
								"Check the platform ID",
								"Use /api/multi-blockchain/platforms to see available platforms",
							],
						},
					});
				}
			}

			// Create WebSocket service instance
			const wsService = req.app.locals.wsService as WebSocketService;
			const orchestrator = new MultiChainAnalysisOrchestrator(wsService);

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
				logger.info("Multi-chain audit started", {
					userId,
					auditName,
					platforms,
					contractCount: contracts.length,
					multiChainAuditId: result.multiChainAuditId,
				});

				res.status(202).json({
					success: true,
					message: "Multi-chain audit started successfully",
					data: {
						multiChainAuditId: result.multiChainAuditId,
						jobId: result.jobId,
						platforms,
						contractCount: contracts.length,
						crossChainAnalysis,
					},
				});
			} else {
				res.status(400).json({
					success: false,
					error: {
						code: "START_AUDIT_ERROR",
						message: result.error || "Failed to start multi-chain audit",
						recovery: [
							"Check your contract data",
							"Ensure platforms are valid",
							"Try again in a few moments",
						],
					},
				});
			}
		} catch (error) {
			logger.error("Error starting multi-chain audit", {
				error,
				userId: req.user?.id,
			});
			res.status(500).json({
				success: false,
				error: {
					code: "START_AUDIT_ERROR",
					message: "Failed to start multi-chain audit",
					recovery: [
						"Try again in a few moments",
						"Check your internet connection",
						"Contact support if the issue persists",
					],
				},
			});
		}
		return () => {};
	}
);

/**
 * @swagger
 * /api/multi-blockchain/audits:
 *   get:
 *     summary: Get user's multi-chain audits with pagination and filtering
 *     tags: [Multi-Blockchain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, analyzing, completed, failed]
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *         description: Filter by blockchain platform
 *       - in: query
 *         name: crossChain
 *         schema:
 *           type: boolean
 *         description: Filter by cross-chain analysis enabled
 *     responses:
 *       200:
 *         description: Paginated list of multi-chain audits
 */
router.get("/audits", async (req: AuthenticatedRequest, res: Response) => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "User not authenticated",
				},
			});
		}

		const page = parseInt(req.query.page as string) || 1;
		const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
		const status = req.query.status as string;
		const platform = req.query.platform as string;
		const crossChain = req.query.crossChain as string;

		// Get all user multi-chain audits
		let audits = await MultiChainAuditModel.findByUserId(userId);

		// Apply filters
		if (status) {
			audits = audits.filter((audit) => audit.status === status);
		}

		if (platform) {
			audits = audits.filter((audit) => audit.hasPlatform(platform));
		}

		if (crossChain !== undefined) {
			const crossChainFilter = crossChain === "true";
			audits = audits.filter(
				(audit) => audit.cross_chain_analysis === crossChainFilter
			);
		}

		// Calculate pagination
		const total = audits.length;
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;
		const paginatedAudits = audits.slice(startIndex, endIndex);
		const hasMore = endIndex < total;

		// Add summary statistics
		const auditSummaries = paginatedAudits.map((audit) => ({
			...audit.toJSON(),
			summary: {
				platformCount: audit.getPlatformCount(),
				contractCount: audit.getContractCount(),
				totalVulnerabilities: audit.getTotalVulnerabilityCount(),
				vulnerabilitiesByPlatform: audit.getVulnerabilityCountByPlatform(),
				highestSeverity: audit.getHighestSeverityAcrossPlatforms(),
				duration: audit.getDuration(),
			},
		}));

		logger.info("Fetched multi-chain audits", {
			userId,
			total,
			page,
			limit,
			filters: { status, platform, crossChain },
		});

		res.json({
			success: true,
			data: {
				data: auditSummaries,
				total,
				page,
				limit,
				hasMore,
			},
		});
	} catch (error) {
		logger.error("Error fetching multi-chain audits", {
			error,
			userId: req.user?.id,
		});
		res.status(500).json({
			success: false,
			error: {
				code: "FETCH_AUDITS_ERROR",
				message: "Failed to fetch multi-chain audits",
				recovery: [
					"Try refreshing the page",
					"Check your internet connection",
					"Contact support if the issue persists",
				],
			},
		});
	}
	return () => {};
});

/**
 * @swagger
 * /api/multi-blockchain/audits/{id}:
 *   get:
 *     summary: Get specific multi-chain audit details
 *     tags: [Multi-Blockchain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Multi-chain audit ID
 *     responses:
 *       200:
 *         description: Multi-chain audit details
 */
router.get("/audits/:id", async (req: AuthenticatedRequest, res) => {
	try {
		const { id } = req.params;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "User not authenticated",
				},
			});
		}

		const audit = await MultiChainAuditModel.findById(id);
		if (!audit) {
			return res.status(404).json({
				success: false,
				error: {
					code: "AUDIT_NOT_FOUND",
					message: "Multi-chain audit not found",
					recovery: [
						"Check if the audit ID is correct",
						"The audit may have been deleted",
						"Try refreshing the page",
					],
				},
			});
		}

		// Check if user owns this audit
		if (audit.user_id !== userId) {
			return res.status(403).json({
				success: false,
				error: {
					code: "ACCESS_DENIED",
					message: "You don't have permission to access this audit",
					recovery: [
						"Make sure you're logged in with the correct account",
						"Contact support if you believe this is an error",
					],
				},
			});
		}

		// Add detailed summary
		const auditWithSummary = {
			...audit.toJSON(),
			summary: {
				platformCount: audit.getPlatformCount(),
				contractCount: audit.getContractCount(),
				totalVulnerabilities: audit.getTotalVulnerabilityCount(),
				vulnerabilitiesByPlatform: audit.getVulnerabilityCountByPlatform(),
				highestSeverity: audit.getHighestSeverityAcrossPlatforms(),
				duration: audit.getDuration(),
			},
		};

		logger.info("Fetched multi-chain audit details", {
			auditId: id,
			userId,
		});

		res.json({
			success: true,
			data: auditWithSummary,
		});
	} catch (error) {
		logger.error("Error fetching multi-chain audit", {
			error,
			auditId: req.params.id,
			userId: req.user?.id,
		});
		res.status(500).json({
			success: false,
			error: {
				code: "FETCH_AUDIT_ERROR",
				message: "Failed to fetch multi-chain audit",
				recovery: [
					"Try refreshing the page",
					"Check your internet connection",
					"Contact support if the issue persists",
				],
			},
		});
	}
	return () => {};
});

/**
 * @swagger
 * /api/multi-blockchain/audits/{id}/progress:
 *   get:
 *     summary: Get multi-chain audit progress
 *     tags: [Multi-Blockchain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Multi-chain audit ID
 *     responses:
 *       200:
 *         description: Audit progress information
 */
router.get("/audits/:id/progress", async (req: AuthenticatedRequest, res) => {
	try {
		const { id } = req.params;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "User not authenticated",
				},
			});
		}

		// Create WebSocket service instance
		const wsService = req.app.locals.wsService as WebSocketService;
		const orchestrator = new MultiChainAnalysisOrchestrator(wsService);

		const result = await orchestrator.getAnalysisProgress(id, userId);

		if (result.success) {
			res.json({
				success: true,
				data: result.progress,
			});
		} else {
			const statusCode =
				result.error === "Access denied"
					? 403
					: result.error === "Multi-chain audit not found"
					? 404
					: 400;

			res.status(statusCode).json({
				success: false,
				error: {
					code: "PROGRESS_ERROR",
					message: result.error || "Failed to get progress",
					recovery: [
						"Check if the audit ID is correct",
						"Try refreshing the page",
						"Contact support if the issue persists",
					],
				},
			});
		}
	} catch (error) {
		logger.error("Error getting multi-chain audit progress", {
			error,
			auditId: req.params.id,
			userId: req.user?.id,
		});
		res.status(500).json({
			success: false,
			error: {
				code: "PROGRESS_ERROR",
				message: "Failed to get audit progress",
				recovery: [
					"Try refreshing the page",
					"Check your internet connection",
					"Contact support if the issue persists",
				],
			},
		});
	}
	return () => {};
});

/**
 * @swagger
 * /api/multi-blockchain/audits/{id}/results:
 *   get:
 *     summary: Get multi-chain audit results
 *     tags: [Multi-Blockchain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Multi-chain audit ID
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *         description: Filter results by specific platform
 *       - in: query
 *         name: includeRaw
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include raw analysis data
 *     responses:
 *       200:
 *         description: Multi-chain audit results
 */
router.get("/audits/:id/results", async (req: AuthenticatedRequest, res) => {
	try {
		const { id } = req.params;
		const { platform, includeRaw } = req.query;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "User not authenticated",
				},
			});
		}

		const audit = await MultiChainAuditModel.findById(id);
		if (!audit) {
			return res.status(404).json({
				success: false,
				error: {
					code: "AUDIT_NOT_FOUND",
					message: "Multi-chain audit not found",
				},
			});
		}

		// Check if user owns this audit
		if (audit.user_id !== userId) {
			return res.status(403).json({
				success: false,
				error: {
					code: "ACCESS_DENIED",
					message: "You don't have permission to access this audit",
				},
			});
		}

		// Check if audit is completed
		if (!audit.isCompleted()) {
			return res.status(400).json({
				success: false,
				error: {
					code: "AUDIT_NOT_COMPLETED",
					message: "Audit is not completed yet",
					recovery: [
						"Wait for the audit to complete",
						"Check the audit progress",
						"Try again in a few minutes",
					],
				},
			});
		}

		let results = audit.results || {};
		let crossChainResults = audit.cross_chain_results;

		// Filter by platform if specified
		if (platform && typeof platform === "string") {
			if (results[platform]) {
				results = { [platform]: results[platform] };
			} else {
				results = {};
			}
		}

		// Remove raw data if not requested
		if (includeRaw !== "true") {
			Object.keys(results).forEach((platformId) => {
				if (results[platformId] && results[platformId].rawData) {
					delete results[platformId].rawData;
				}
			});

			if (crossChainResults && crossChainResults.rawData) {
				delete crossChainResults.rawData;
			}
		}

		const responseData = {
			auditId: audit.id,
			auditName: audit.audit_name,
			platforms: audit.platforms,
			status: audit.status,
			results,
			crossChainResults,
			summary: {
				platformCount: audit.getPlatformCount(),
				contractCount: audit.getContractCount(),
				totalVulnerabilities: audit.getTotalVulnerabilityCount(),
				vulnerabilitiesByPlatform: audit.getVulnerabilityCountByPlatform(),
				highestSeverity: audit.getHighestSeverityAcrossPlatforms(),
				duration: audit.getDuration(),
			},
			completedAt: audit.completed_at,
		};

		logger.info("Fetched multi-chain audit results", {
			auditId: id,
			userId,
			platformFilter: platform,
			includeRaw: includeRaw === "true",
		});

		res.json({
			success: true,
			data: responseData,
		});
	} catch (error) {
		logger.error("Error fetching multi-chain audit results", {
			error,
			auditId: req.params.id,
			userId: req.user?.id,
		});
		res.status(500).json({
			success: false,
			error: {
				code: "FETCH_RESULTS_ERROR",
				message: "Failed to fetch audit results",
				recovery: [
					"Try refreshing the page",
					"Check your internet connection",
					"Contact support if the issue persists",
				],
			},
		});
	}
	return () => {};
});

/**
 * @swagger
 * /api/multi-blockchain/audits/{id}/cross-chain:
 *   get:
 *     summary: Get cross-chain analysis results
 *     tags: [Multi-Blockchain]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Multi-chain audit ID
 *     responses:
 *       200:
 *         description: Cross-chain analysis results
 */
router.get(
	"/audits/:id/cross-chain",
	async (req: AuthenticatedRequest, res) => {
		try {
			const { id } = req.params;
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: {
						code: "UNAUTHORIZED",
						message: "User not authenticated",
					},
				});
			}

			const audit = await MultiChainAuditModel.findById(id);
			if (!audit) {
				return res.status(404).json({
					success: false,
					error: {
						code: "AUDIT_NOT_FOUND",
						message: "Multi-chain audit not found",
					},
				});
			}

			// Check if user owns this audit
			if (audit.user_id !== userId) {
				return res.status(403).json({
					success: false,
					error: {
						code: "ACCESS_DENIED",
						message: "You don't have permission to access this audit",
					},
				});
			}

			// Check if cross-chain analysis was enabled
			if (!audit.cross_chain_analysis) {
				return res.status(400).json({
					success: false,
					error: {
						code: "CROSS_CHAIN_NOT_ENABLED",
						message: "Cross-chain analysis was not enabled for this audit",
						recovery: [
							"Create a new audit with cross-chain analysis enabled",
							"Check the audit configuration",
						],
					},
				});
			}

			// Check if audit is completed
			if (!audit.isCompleted()) {
				return res.status(400).json({
					success: false,
					error: {
						code: "AUDIT_NOT_COMPLETED",
						message: "Audit is not completed yet",
						recovery: [
							"Wait for the audit to complete",
							"Check the audit progress",
						],
					},
				});
			}

			logger.info("Fetched cross-chain analysis results", {
				auditId: id,
				userId,
			});

			res.json({
				success: true,
				data: {
					auditId: audit.id,
					auditName: audit.audit_name,
					platforms: audit.platforms,
					crossChainResults: audit.cross_chain_results,
					completedAt: audit.completed_at,
				},
			});
		} catch (error) {
			logger.error("Error fetching cross-chain results", {
				error,
				auditId: req.params.id,
				userId: req.user?.id,
			});
			res.status(500).json({
				success: false,
				error: {
					code: "FETCH_CROSS_CHAIN_ERROR",
					message: "Failed to fetch cross-chain results",
					recovery: [
						"Try refreshing the page",
						"Check your internet connection",
						"Contact support if the issue persists",
					],
				},
			});
		}
		return () => {};
	}
);

export default router;
