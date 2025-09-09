import { Router, Response } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { param, validationResult } from "express-validator";
import { AuditOrchestrator } from "../services/AuditOrchestrator";

const router = Router();

// Validation middleware
const validateAuditId = [
	param("auditId").isUUID().withMessage("Invalid audit ID format"),
];

/**
 * Get queue statistics
 * GET /api/queue/stats
 */
router.get(
	"/stats",
	authenticateToken,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const auditOrchestrator = req.app.locals
				.auditOrchestrator as AuditOrchestrator;
			const stats = await auditOrchestrator.getQueueStats();

			return res.json({
				success: true,
				data: stats,
			});
		} catch (error) {
			console.error("Error getting queue stats:", error);
			return res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
	}
);

/**
 * Get audit progress
 * GET /api/queue/audit/:auditId/progress
 */
router.get(
	"/audit/:auditId/progress",
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

			const auditOrchestrator = req.app.locals
				.auditOrchestrator as AuditOrchestrator;
			const result = await auditOrchestrator.getAuditProgress(auditId, userId);

			if (result.success) {
				return res.json({
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

				return res.status(statusCode).json({
					success: false,
					error: result.error,
				});
			}
		} catch (error) {
			console.error("Error getting audit progress:", error);
			return res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

/**
 * Cancel an audit
 * POST /api/queue/audit/:auditId/cancel
 */
router.post(
	"/audit/:auditId/cancel",
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

			const auditOrchestrator = req.app.locals
				.auditOrchestrator as AuditOrchestrator;
			const result = await auditOrchestrator.cancelAudit(auditId, userId);

			if (result.success) {
				return res.json({
					success: true,
					message: "Audit cancelled successfully",
				});
			} else {
				const statusCode =
					result.error === "Access denied"
						? 403
						: result.error === "Audit not found"
						? 404
						: 400;

				return res.status(statusCode).json({
					success: false,
					error: result.error,
				});
			}
		} catch (error) {
			console.error("Error cancelling audit:", error);
			return res.status(500).json({
				success: false,
				error: "Internal server error",
			});
		}
		return () => {};
	}
);

export default router;
