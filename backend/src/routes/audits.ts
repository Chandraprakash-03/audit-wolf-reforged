import express from "express";
import { AuditModel } from "../models/Audit";
import { ContractModel } from "../models/Contract";
import { VulnerabilityModel } from "../models/Vulnerability";
import { DatabaseService } from "../services/database";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { logger } from "../utils/logger";
import { body, validationResult } from "express-validator";

const router = express.Router();

// Apply authentication to all audit routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/audits:
 *   get:
 *     summary: Get user's audits with pagination and filtering
 *     tags: [Audits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, analyzing, completed, failed]
 *         description: Filter by audit status
 *       - in: query
 *         name: contractName
 *         schema:
 *           type: string
 *         description: Filter by contract name
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *         description: Filter by blockchain platform
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter audits from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter audits to this date
 *     responses:
 *       200:
 *         description: Paginated list of audits
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Audit'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 */
router.get("/", async (req: AuthenticatedRequest, res) => {
	try {
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "User not authenticated",
					recovery: [
						"Please log in to access this resource",
						"Check if your session has expired",
					],
				},
			});
		}

		const page = parseInt(req.query.page as string) || 1;
		const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
		const status = req.query.status as string;
		const contractName = req.query.contractName as string;
		const platform = req.query.platform as string;
		const dateFrom = req.query.dateFrom as string;
		const dateTo = req.query.dateTo as string;

		// Get all user audits first
		const allAudits = await DatabaseService.getAuditsByUserId(userId);

		// Apply filters
		let filteredAudits = allAudits;

		if (status) {
			filteredAudits = filteredAudits.filter(
				(audit) => audit.status === status
			);
		}

		if (contractName) {
			filteredAudits = filteredAudits.filter((audit) =>
				(audit as any).contracts?.name
					?.toLowerCase()
					.includes(contractName.toLowerCase())
			);
		}

		if (platform) {
			filteredAudits = filteredAudits.filter(
				(audit) => (audit as any).contracts?.blockchain_platform === platform
			);
		}

		if (dateFrom) {
			const fromDate = new Date(dateFrom);
			filteredAudits = filteredAudits.filter(
				(audit) => new Date(audit.created_at) >= fromDate
			);
		}

		if (dateTo) {
			const toDate = new Date(dateTo);
			filteredAudits = filteredAudits.filter(
				(audit) => new Date(audit.created_at) <= toDate
			);
		}

		// Calculate pagination
		const total = filteredAudits.length;
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;
		const paginatedAudits = filteredAudits.slice(startIndex, endIndex);
		const hasMore = endIndex < total;

		logger.info("Fetched user audits", {
			userId,
			total,
			page,
			limit,
			filters: { status, contractName, platform, dateFrom, dateTo },
		});

		res.json({
			success: true,
			data: {
				data: paginatedAudits,
				total,
				page,
				limit,
				hasMore,
			},
		});
	} catch (error) {
		logger.error("Error fetching user audits", { error, userId: req.user?.id });
		res.status(500).json({
			success: false,
			error: {
				code: "FETCH_AUDITS_ERROR",
				message: "Failed to fetch audits",
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
 * /api/audits/{id}:
 *   get:
 *     summary: Get a specific audit by ID
 *     tags: [Audits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Audit ID
 *     responses:
 *       200:
 *         description: Audit details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Audit'
 */
router.get("/:id", async (req: AuthenticatedRequest, res) => {
	try {
		const { id } = req.params;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({
				ccess: false,
				error: {
					code: "UNAUTHORIZED",
					message: "User not authenticated",
					recovery: [
						"Please log in to access this resource",
						"Check if your session has expired",
					],
				},
			});
		}

		const audit = await AuditModel.findById(id);

		if (!audit) {
			return res.status(404).json({
				success: false,
				error: {
					code: "AUDIT_NOT_FOUND",
					message: "Audit not found",
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

		logger.info("Fetched audit details", { auditId: id, userId });

		res.json({
			success: true,
			data: audit.toJSON(),
		});
	} catch (error) {
		logger.error("Error fetching audit", {
			error,
			auditId: req.params.id,
			userId: req.user?.id,
		});
		res.status(500).json({
			success: false,
			error: {
				code: "FETCH_AUDIT_ERROR",
				message: "Failed to fetch audit",
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
 * /api/audits:
 *   post:
 *     summary: Create a new audit
 *     tags: [Audits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractId
 *             properties:
 *               contractId:
 *                 type: string
 *                 description: ID of the contract to audit
 *     responses:
 *       201:
 *         description: Audit created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Audit'
 */
router.post(
	"/",
	body("contractId")
		.isString()
		.notEmpty()
		.withMessage("Contract ID is required"),
	async (req: AuthenticatedRequest, res) => {
		// Check validation errors
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
		try {
			const { contractId } = req.body;
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({
					success: false,
					error: {
						code: "UNAUTHORIZED",
						message: "User not authenticated",
						recovery: [
							"Please log in to access this resource",
							"Check if your session has expired",
						],
					},
				});
			}

			// Verify contract exists and belongs to user
			const contract = await ContractModel.findById(contractId);
			if (!contract) {
				return res.status(404).json({
					success: false,
					error: {
						code: "CONTRACT_NOT_FOUND",
						message: "Contract not found",
						recovery: [
							"Check if the contract ID is correct",
							"The contract may have been deleted",
							"Upload the contract first",
						],
					},
				});
			}

			if (contract.user_id !== userId) {
				return res.status(403).json({
					success: false,
					error: {
						code: "ACCESS_DENIED",
						message: "You don't have permission to audit this contract",
						recovery: [
							"Make sure you're logged in with the correct account",
							"Contact support if you believe this is an error",
						],
					},
				});
			}

			// Create the audit
			const audit = await AuditModel.create({
				contract_id: contractId,
				user_id: userId,
				status: "pending",
			});

			if (!audit) {
				return res.status(500).json({
					success: false,
					error: {
						code: "CREATE_AUDIT_ERROR",
						message: "Failed to create audit",
						recovery: [
							"Try again in a few moments",
							"Check your internet connection",
							"Contact support if the issue persists",
						],
					},
				});
			}

			logger.info("Created new audit", {
				auditId: audit.id,
				contractId,
				userId,
			});

			res.status(201).json({
				success: true,
				data: audit.toJSON(),
			});
		} catch (error) {
			logger.error("Error creating audit", { error, userId: req.user?.id });
			res.status(500).json({
				success: false,
				error: {
					code: "CREATE_AUDIT_ERROR",
					message: "Failed to create audit",
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
 * /api/audits/{id}/report:
 *   get:
 *     summary: Get audit report
 *     tags: [Audits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Audit ID
 *     responses:
 *       200:
 *         description: Audit report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AuditReport'
 */
router.get("/:id/report", async (req: AuthenticatedRequest, res) => {
	try {
		const { id } = req.params;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "User not authenticated",
					recovery: [
						"Please log in to access this resource",
						"Check if your session has expired",
					],
				},
			});
		}

		const audit = await AuditModel.findById(id);

		if (!audit) {
			return res.status(404).json({
				success: false,
				error: {
					code: "AUDIT_NOT_FOUND",
					message: "Audit not found",
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
					message: "You don't have permission to access this audit report",
					recovery: [
						"Make sure you're logged in with the correct account",
						"Contact support if you believe this is an error",
					],
				},
			});
		}

		// Check if audit has a report
		if (!audit.final_report) {
			return res.status(404).json({
				success: false,
				error: {
					code: "REPORT_NOT_READY",
					message: "Audit report is not ready yet",
					recovery: [
						"Wait for the audit to complete",
						"Try refreshing the page in a few minutes",
						"Check the audit status",
					],
				},
			});
		}

		// Fetch vulnerabilities separately to include in the report
		const vulnerabilities = await VulnerabilityModel.findByAuditId(id);

		logger.info("Fetched audit report", {
			auditId: id,
			userId,
			vulnerabilityCount: vulnerabilities.length,
		});

		// Include vulnerabilities in the report data
		const reportWithVulnerabilities = {
			...audit.final_report,
			vulnerabilities: vulnerabilities.map((vuln) => ({
				id: vuln.id,
				title: vuln.title,
				description: vuln.description,
				severity: vuln.severity,
				type: vuln.type,
				location: vuln.location,
				recommendation: vuln.recommendation,
				confidence: vuln.confidence,
				source: vuln.source,
			})),
		};

		res.json({
			success: true,
			data: reportWithVulnerabilities,
		});
	} catch (error) {
		logger.error("Error fetching audit report", {
			error,
			auditId: req.params.id,
			userId: req.user?.id,
		});
		res.status(500).json({
			success: false,
			error: {
				code: "FETCH_REPORT_ERROR",
				message: "Failed to fetch audit report",
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
 * /api/audits/{id}/report/download:
 *   get:
 *     summary: Download audit report
 *     tags: [Audits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Audit ID
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pdf, html]
 *         description: Report format
 *     responses:
 *       200:
 *         description: Report file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           text/html:
 *             schema:
 *               type: string
 */
router.get("/:id/report/download", async (req: AuthenticatedRequest, res) => {
	try {
		const { id } = req.params;
		const { format } = req.query;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "User not authenticated",
					recovery: [
						"Please log in to access this resource",
						"Check if your session has expired",
					],
				},
			});
		}

		// Validate format
		const formatStr = format as string;
		if (!formatStr || !["pdf", "html"].includes(formatStr)) {
			return res.status(400).json({
				success: false,
				error: {
					code: "INVALID_FORMAT",
					message: "Invalid format. Must be 'pdf' or 'html'",
					recovery: ["Use format=pdf or format=html in the query parameters"],
				},
			});
		}

		const audit = await AuditModel.findById(id);

		if (!audit) {
			return res.status(404).json({
				success: false,
				error: {
					code: "AUDIT_NOT_FOUND",
					message: "Audit not found",
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
					message: "You don't have permission to access this audit report",
					recovery: [
						"Make sure you're logged in with the correct account",
						"Contact support if you believe this is an error",
					],
				},
			});
		}

		// Check if audit has a report
		if (!audit.final_report) {
			return res.status(404).json({
				success: false,
				error: {
					code: "REPORT_NOT_READY",
					message: "Audit report is not ready yet",
					recovery: [
						"Wait for the audit to complete",
						"Try refreshing the page in a few minutes",
						"Check the audit status",
					],
				},
			});
		}

		// Import necessary services
		const { AuditReportService } = await import(
			"../services/AuditReportService"
		);
		const fs = await import("fs-extra");
		const path = await import("path");

		// Get contract for filename
		const contract = await ContractModel.findById(audit.contract_id);
		if (!contract) {
			return res.status(404).json({
				success: false,
				error: {
					code: "CONTRACT_NOT_FOUND",
					message: "Contract not found",
					recovery: [
						"The associated contract may have been deleted",
						"Contact support if you believe this is an error",
					],
				},
			});
		}

		// Get file paths
		const paths = AuditReportService.getReportPaths(id, contract.name);
		const filePath = formatStr === "html" ? paths.html : paths.pdf;

		// Check if file exists
		if (!(await fs.pathExists(filePath))) {
			return res.status(404).json({
				success: false,
				error: {
					code: "REPORT_FILE_NOT_FOUND",
					message: `${formatStr.toUpperCase()} report file not found`,
					recovery: [
						"The report may still be generating",
						"Try regenerating the report",
						"Contact support if the issue persists",
					],
				},
			});
		}

		// Set appropriate headers
		const fileName = path.basename(filePath);
		const mimeType = formatStr === "html" ? "text/html" : "application/pdf";

		res.setHeader("Content-Type", mimeType);
		res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

		logger.info("Serving audit report download", {
			auditId: id,
			userId,
			format: formatStr,
			fileName,
		});

		// Stream file
		const fileStream = fs.createReadStream(filePath);
		fileStream.pipe(res);

		fileStream.on("error", (error) => {
			logger.error("File stream error during download", { error, auditId: id });
			if (!res.headersSent) {
				res.status(500).json({
					success: false,
					error: {
						code: "FILE_STREAM_ERROR",
						message: "Failed to download file",
						recovery: [
							"Try downloading again",
							"Contact support if the issue persists",
						],
					},
				});
			}
		});
	} catch (error) {
		logger.error("Error handling audit report download", {
			error,
			auditId: req.params.id,
			userId: req.user?.id,
		});
		res.status(500).json({
			success: false,
			error: {
				code: "DOWNLOAD_ERROR",
				message: "Failed to download audit report",
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

export default router;
