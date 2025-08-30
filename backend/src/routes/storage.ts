import express, { Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import DecentralizedStorageService from "../services/DecentralizedStorageService";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();
const storageService = new DecentralizedStorageService();

interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		email: string;
	};
}

/**
 * @route GET /api/storage/stats
 * @desc Get storage statistics
 * @access Private
 */
router.get(
	"/stats",
	authenticateToken,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const stats = await storageService.getStorageStats();
			res.json({
				success: true,
				data: stats,
			});
		} catch (error) {
			console.error("Error getting storage stats:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get storage statistics",
			});
		}
	}
);

/**
 * @route POST /api/storage/migrate
 * @desc Migrate existing audits to decentralized storage
 * @access Private
 */
router.post(
	"/migrate",
	[
		authenticateToken,
		body("batchSize")
			.optional()
			.isInt({ min: 1, max: 50 })
			.withMessage("Batch size must be between 1 and 50"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					errors: errors.array(),
				});
			}

			const { batchSize = 10 } = req.body;
			const result = await storageService.migrateToDecentralizedStorage(
				batchSize
			);

			res.json({
				success: true,
				data: result,
			});
		} catch (error) {
			console.error("Error migrating to decentralized storage:", error);
			res.status(500).json({
				success: false,
				error: "Failed to migrate to decentralized storage",
			});
		}
		return () => {};
	}
);

/**
 * @route GET /api/storage/verify/:auditId
 * @desc Verify audit record integrity
 * @access Private
 */
router.get(
	"/verify/:auditId",
	[
		authenticateToken,
		param("auditId").isUUID().withMessage("Invalid audit ID"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					errors: errors.array(),
				});
			}

			const { auditId } = req.params;
			const verification = await storageService.verifyAuditIntegrity(auditId);

			res.json({
				success: true,
				data: verification,
			});
		} catch (error) {
			console.error("Error verifying audit integrity:", error);
			res.status(500).json({
				success: false,
				error: "Failed to verify audit integrity",
			});
		}
		return () => {};
	}
);

/**
 * @route GET /api/storage/retrieve/:auditId
 * @desc Retrieve audit report from decentralized storage
 * @access Private
 */
router.get(
	"/retrieve/:auditId",
	[
		authenticateToken,
		param("auditId").isUUID().withMessage("Invalid audit ID"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					errors: errors.array(),
				});
			}

			const { auditId } = req.params;
			const result = await storageService.retrieveAuditReport(auditId);

			if (!result) {
				return res.status(404).json({
					success: false,
					error: "Audit report not found",
				});
			}

			// Set appropriate headers for PDF download
			res.setHeader("Content-Type", "application/pdf");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="audit-${auditId}.pdf"`
			);
			res.setHeader("X-Storage-Source", result.source);

			if (result.metadata?.ipfsHash) {
				res.setHeader("X-IPFS-Hash", result.metadata.ipfsHash);
			}

			res.send(result.reportBuffer);
		} catch (error) {
			console.error("Error retrieving audit report:", error);
			res.status(500).json({
				success: false,
				error: "Failed to retrieve audit report",
			});
		}
		return () => {};
	}
);

/**
 * @route POST /api/storage/store/:auditId
 * @desc Store existing audit in decentralized storage
 * @access Private
 */
router.post(
	"/store/:auditId",
	[
		authenticateToken,
		param("auditId").isUUID().withMessage("Invalid audit ID"),
		body("useIPFS")
			.optional()
			.isBoolean()
			.withMessage("useIPFS must be a boolean"),
		body("useBlockchain")
			.optional()
			.isBoolean()
			.withMessage("useBlockchain must be a boolean"),
		body("fallbackToDatabase")
			.optional()
			.isBoolean()
			.withMessage("fallbackToDatabase must be a boolean"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					errors: errors.array(),
				});
			}

			const { auditId } = req.params;
			const {
				useIPFS = true,
				useBlockchain = true,
				fallbackToDatabase = true,
			} = req.body;

			// Get audit data from database
			const { supabase } = require("../config/supabase");
			const { data: audit, error } = await supabase
				.from("audits")
				.select("*")
				.eq("id", auditId)
				.single();

			if (error || !audit) {
				return res.status(404).json({
					success: false,
					error: "Audit not found",
				});
			}

			// Check if user owns this audit
			if (audit.user_id !== req.user?.id) {
				return res.status(403).json({
					success: false,
					error: "Access denied",
				});
			}

			const storageData = {
				auditId: audit.id,
				contractAddress: audit.contract_address,
				auditorAddress: req.user?.id || "",
				reportPath: audit.report_path,
				auditData: audit,
				metadata: {
					name: `audit-${audit.id}`,
					description: `Audit report for ${audit.contract_name || "contract"}`,
					timestamp: new Date(audit.created_at).getTime(),
				},
			};

			const result = await storageService.storeAuditReport(storageData, {
				useIPFS,
				useBlockchain,
				fallbackToDatabase,
			});

			res.json({
				success: result.success,
				data: result,
				message: result.success
					? "Audit stored in decentralized storage"
					: "Storage operation completed with errors",
			});
		} catch (error) {
			console.error("Error storing audit in decentralized storage:", error);
			res.status(500).json({
				success: false,
				error: "Failed to store audit in decentralized storage",
			});
		}
		return () => {};
	}
);

/**
 * @route GET /api/storage/ipfs/:hash
 * @desc Get IPFS content by hash
 * @access Private
 */
router.get(
	"/ipfs/:hash",
	[
		authenticateToken,
		param("hash")
			.isLength({ min: 46, max: 46 })
			.withMessage("Invalid IPFS hash"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					errors: errors.array(),
				});
			}

			const { hash } = req.params;

			// Verify user has access to this IPFS hash
			const { supabase } = require("../config/supabase");
			const { data: audit, error } = await supabase
				.from("audits")
				.select("user_id")
				.eq("ipfs_hash", hash)
				.single();

			if (error || !audit) {
				return res.status(404).json({
					success: false,
					error: "Content not found or access denied",
				});
			}

			if (audit.user_id !== req.user?.id) {
				return res.status(403).json({
					success: false,
					error: "Access denied",
				});
			}

			// Redirect to IPFS gateway
			const ipfsService = new (require("../services/IPFSService").default)();
			const url = ipfsService.getUrl(hash);

			res.redirect(url);
		} catch (error) {
			console.error("Error accessing IPFS content:", error);
			res.status(500).json({
				success: false,
				error: "Failed to access IPFS content",
			});
		}
		return () => {};
	}
);

export default router;
