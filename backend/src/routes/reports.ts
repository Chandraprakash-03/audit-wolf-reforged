import express, { Request, Response } from "express";

interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		email: string;
	};
}
import { body, param, query, validationResult } from "express-validator";
import { authenticateToken } from "../middleware/auth";
import {
	AuditReportService,
	AuditReportRequest,
} from "../services/AuditReportService";
import { AuditModel } from "../models/Audit";
import * as fs from "fs-extra";
import * as path from "path";

const router = express.Router();

/**
 * Generate audit report
 * POST /api/reports/generate
 */
router.post(
	"/generate",
	authenticateToken,
	[
		body("auditId").isUUID().withMessage("Valid audit ID is required"),
		body("format")
			.isIn(["html", "pdf", "both"])
			.withMessage("Format must be html, pdf, or both"),
		body("reportType")
			.optional()
			.isIn(["standard", "executive", "detailed"])
			.withMessage("Invalid report type"),
		body("includeSourceCode")
			.optional()
			.isBoolean()
			.withMessage("includeSourceCode must be boolean"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			// Check validation errors
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
			}

			const { auditId, format, reportType, includeSourceCode, customOptions } =
				req.body;
			const userId = req.user?.id;

			// Verify audit belongs to user
			const audit = await AuditModel.findById(auditId);
			if (!audit) {
				return res.status(404).json({
					success: false,
					message: "Audit not found",
				});
			}

			if (audit.user_id !== userId) {
				return res.status(403).json({
					success: false,
					message: "Access denied",
				});
			}

			if (!audit.isCompleted()) {
				return res.status(400).json({
					success: false,
					message: "Audit is not completed yet",
				});
			}

			// Generate report
			const request: AuditReportRequest = {
				auditId,
				format,
				reportType: reportType || "standard",
				includeSourceCode: includeSourceCode || false,
				customOptions,
			};

			const result = await AuditReportService.generateAuditReport(request);

			// Return appropriate response based on format
			const response: any = {
				success: true,
				message: "Report generated successfully",
				data: {
					auditId: result.auditId,
					contractName: result.contractName,
					generatedAt: result.generatedAt,
					report: {
						totalVulnerabilities: result.report.report.total_vulnerabilities,
						severityCounts: {
							critical: result.report.report.critical_count,
							high: result.report.report.high_count,
							medium: result.report.report.medium_count,
							low: result.report.report.low_count,
							informational: result.report.report.informational_count,
						},
						gasOptimizations: result.report.report.gas_optimizations.length,
						recommendations: result.report.report.recommendations.length,
					},
				},
			};

			if (result.html) {
				response.data.html = {
					available: true,
					downloadUrl: `/api/reports/${auditId}/download/html`,
				};
			}

			if (result.pdf) {
				response.data.pdf = {
					available: true,
					downloadUrl: `/api/reports/${auditId}/download/pdf`,
					size: result.pdf.metadata.size,
					pages: result.pdf.metadata.pages,
				};
			}

			res.json(response);
		} catch (error) {
			console.error("Report generation error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to generate report",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
		return () => {};
	}
);

/**
 * Get existing report information
 * GET /api/reports/:auditId
 */
router.get(
	"/:auditId",
	authenticateToken,
	[param("auditId").isUUID().withMessage("Valid audit ID is required")],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
			}

			const { auditId } = req.params;
			const userId = req.user?.id;

			// Verify audit belongs to user
			const audit = await AuditModel.findById(auditId);
			if (!audit) {
				return res.status(404).json({
					success: false,
					message: "Audit not found",
				});
			}

			if (audit.user_id !== userId) {
				return res.status(403).json({
					success: false,
					message: "Access denied",
				});
			}

			// Get report statistics
			const stats = await AuditReportService.getReportStatistics(auditId);

			res.json({
				success: true,
				data: {
					auditId,
					hasReport: stats.hasReport,
					reportGeneratedAt: stats.reportGeneratedAt,
					files: {
						html: {
							available: stats.hasHTMLFile,
							size: stats.fileSizes.html,
							downloadUrl: stats.hasHTMLFile
								? `/api/reports/${auditId}/download/html`
								: null,
						},
						pdf: {
							available: stats.hasPDFFile,
							size: stats.fileSizes.pdf,
							downloadUrl: stats.hasPDFFile
								? `/api/reports/${auditId}/download/pdf`
								: null,
						},
					},
				},
			});
		} catch (error) {
			console.error("Get report error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to get report information",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
		return () => {};
	}
);

/**
 * Download report file
 * GET /api/reports/:auditId/download/:format
 */
router.get(
	"/:auditId/download/:format",
	authenticateToken,
	[
		param("auditId").isUUID().withMessage("Valid audit ID is required"),
		param("format")
			.isIn(["html", "pdf"])
			.withMessage("Format must be html or pdf"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
			}

			const { auditId, format } = req.params;
			const userId = req.user?.id;

			// Verify audit belongs to user
			const audit = await AuditModel.findById(auditId);
			if (!audit) {
				return res.status(404).json({
					success: false,
					message: "Audit not found",
				});
			}

			if (audit.user_id !== userId) {
				return res.status(403).json({
					success: false,
					message: "Access denied",
				});
			}

			// Get contract for filename
			const { ContractModel } = await import("../models/Contract");
			const contract = await ContractModel.findById(audit.contract_id);
			if (!contract) {
				return res.status(404).json({
					success: false,
					message: "Contract not found",
				});
			}

			// Get file paths
			const paths = AuditReportService.getReportPaths(auditId, contract.name);
			const filePath = format === "html" ? paths.html : paths.pdf;

			// Check if file exists
			if (!(await fs.pathExists(filePath))) {
				return res.status(404).json({
					success: false,
					message: `${format.toUpperCase()} report not found`,
				});
			}

			// Set appropriate headers
			const fileName = path.basename(filePath);
			const mimeType = format === "html" ? "text/html" : "application/pdf";

			res.setHeader("Content-Type", mimeType);
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="${fileName}"`
			);

			// Stream file
			const fileStream = fs.createReadStream(filePath);
			fileStream.pipe(res);

			fileStream.on("error", (error) => {
				console.error("File stream error:", error);
				if (!res.headersSent) {
					res.status(500).json({
						success: false,
						message: "Failed to download file",
					});
				}
			});
		} catch (error) {
			console.error("Download error:", error);
			if (!res.headersSent) {
				res.status(500).json({
					success: false,
					message: "Failed to download report",
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}
		return () => {};
	}
);

/**
 * Regenerate report with new options
 * PUT /api/reports/:auditId/regenerate
 */
router.put(
	"/:auditId/regenerate",
	authenticateToken,
	[
		param("auditId").isUUID().withMessage("Valid audit ID is required"),
		body("format")
			.optional()
			.isIn(["html", "pdf", "both"])
			.withMessage("Format must be html, pdf, or both"),
		body("reportType")
			.optional()
			.isIn(["standard", "executive", "detailed"])
			.withMessage("Invalid report type"),
		body("includeSourceCode")
			.optional()
			.isBoolean()
			.withMessage("includeSourceCode must be boolean"),
	],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
			}

			const { auditId } = req.params;
			const userId = req.user?.id;

			// Verify audit belongs to user
			const audit = await AuditModel.findById(auditId);
			if (!audit) {
				return res.status(404).json({
					success: false,
					message: "Audit not found",
				});
			}

			if (audit.user_id !== userId) {
				return res.status(403).json({
					success: false,
					message: "Access denied",
				});
			}

			// Regenerate report
			const result = await AuditReportService.regenerateReport(
				auditId,
				req.body
			);

			res.json({
				success: true,
				message: "Report regenerated successfully",
				data: {
					auditId: result.auditId,
					contractName: result.contractName,
					generatedAt: result.generatedAt,
					html: result.html
						? {
								available: true,
								downloadUrl: `/api/reports/${auditId}/download/html`,
						  }
						: undefined,
					pdf: result.pdf
						? {
								available: true,
								downloadUrl: `/api/reports/${auditId}/download/pdf`,
								size: result.pdf.metadata.size,
								pages: result.pdf.metadata.pages,
						  }
						: undefined,
				},
			});
		} catch (error) {
			console.error("Report regeneration error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to regenerate report",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
		return () => {};
	}
);

/**
 * Delete report files
 * DELETE /api/reports/:auditId
 */
router.delete(
	"/:auditId",
	authenticateToken,
	[param("auditId").isUUID().withMessage("Valid audit ID is required")],
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
			}

			const { auditId } = req.params;
			const userId = req.user?.id;

			// Verify audit belongs to user
			const audit = await AuditModel.findById(auditId);
			if (!audit) {
				return res.status(404).json({
					success: false,
					message: "Audit not found",
				});
			}

			if (audit.user_id !== userId) {
				return res.status(403).json({
					success: false,
					message: "Access denied",
				});
			}

			// Get contract for filename
			const { ContractModel } = await import("../models/Contract");
			const contract = await ContractModel.findById(audit.contract_id);
			if (!contract) {
				return res.status(404).json({
					success: false,
					message: "Contract not found",
				});
			}

			// Delete report files
			await AuditReportService.deleteReportFiles(auditId, contract.name);

			res.json({
				success: true,
				message: "Report files deleted successfully",
			});
		} catch (error) {
			console.error("Delete report error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to delete report files",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
		return () => {};
	}
);

export default router;
