import express from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import EmailService from "../services/EmailService";
import { DatabaseService } from "../services/database";

const router = express.Router();
const emailService = new EmailService();

/**
 * Test email connectivity
 * POST /api/notifications/test-email
 */
router.post(
	"/test-email",
	authenticateToken,
	async (req: AuthenticatedRequest, res: express.Response) => {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			// Get user email
			const user = await DatabaseService.getUserById(userId);
			if (!user?.email) {
				return res.status(400).json({ error: "User email not found" });
			}

			// Check if email service is configured
			if (!emailService.isEmailConfigured()) {
				return res.status(503).json({
					error: "Email service not configured",
					message: "SMTP credentials are not properly set up",
				});
			}

			// Send test email
			const success = await emailService.sendEmail({
				to: user.email,
				subject: "Audit Wolf Email Test",
				html: `
					<h2>Email Service Test</h2>
					<p>Hello ${user.name || "User"},</p>
					<p>This is a test email from Audit Wolf to verify that email notifications are working correctly.</p>
					<p>If you receive this email, your notification settings are properly configured!</p>
					<p>Timestamp: ${new Date().toISOString()}</p>
				`,
			});

			if (success) {
				res.json({
					success: true,
					message: "Test email sent successfully",
				});
			} else {
				res.status(500).json({
					success: false,
					error: "Failed to send test email",
				});
			}
		} catch (error) {
			console.error("Test email error:", error);
			res.status(500).json({
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
		return () => {};
	}
);

/**
 * Get email service status
 * GET /api/notifications/status
 */
router.get(
	"/status",
	authenticateToken,
	async (req: AuthenticatedRequest, res: express.Response) => {
		try {
			const isConfigured = emailService.isEmailConfigured();

			res.json({
				emailService: {
					configured: isConfigured,
					status: isConfigured ? "ready" : "not_configured",
				},
				features: {
					auditCompletion: true,
					auditFailure: true,
					testEmail: true,
				},
			});
		} catch (error) {
			console.error("Status check error:", error);
			res.status(500).json({
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}
);

/**
 * Resend audit completion notification
 * POST /api/notifications/resend-audit/:auditId
 */
router.post(
	"/resend-audit/:auditId",
	authenticateToken,
	async (req: AuthenticatedRequest, res: express.Response) => {
		try {
			const userId = req.user?.id;
			const { auditId } = req.params;

			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			// Get audit and verify ownership
			const audit = await DatabaseService.getAuditById(auditId);
			if (!audit) {
				return res.status(404).json({ error: "Audit not found" });
			}

			if (audit.user_id !== userId) {
				return res.status(403).json({ error: "Access denied" });
			}

			if (audit.status !== "completed") {
				return res.status(400).json({
					error: "Audit not completed",
					message: "Can only resend notifications for completed audits",
				});
			}

			// Get user and contract information
			const user = await DatabaseService.getUserById(userId);
			const contract = await DatabaseService.getContractById(audit.contract_id);

			if (!user?.email || !contract) {
				return res.status(400).json({
					error: "Missing required data",
					message: "User email or contract information not found",
				});
			}

			// Get vulnerability count
			const vulnerabilities = await DatabaseService.getVulnerabilitiesByAuditId(
				auditId
			);
			const vulnerabilityCount = vulnerabilities.length;

			// Try to get PDF report
			let pdfBuffer: Buffer | null = null;
			try {
				const { AuditReportService } = await import(
					"../services/AuditReportService"
				);
				const reportResult = await AuditReportService.generateAuditReport({
					auditId,
					format: "pdf",
					reportType: "standard",
					includeSourceCode: false,
				});

				if (reportResult.pdf?.filePath) {
					const fs = await import("fs-extra");
					pdfBuffer = await fs.readFile(reportResult.pdf.filePath);
				}
			} catch (reportError) {
				console.warn("Failed to generate PDF for resend:", reportError);
			}

			// Send email notification
			const success = pdfBuffer
				? await emailService.sendAuditCompletionEmail(
						user.email,
						contract.name,
						auditId,
						pdfBuffer,
						vulnerabilityCount,
						0 // Gas optimizations - could be enhanced
				  )
				: await emailService.sendEmail({
						to: user.email,
						subject: `Audit Complete: ${contract.name}`,
						html: `
							<h2>Audit Complete</h2>
							<p>Your smart contract audit for <strong>${
								contract.name
							}</strong> has been completed.</p>
							<p>Vulnerabilities found: ${vulnerabilityCount}</p>
							<p>You can view the full report in your dashboard.</p>
							<p><a href="${
								process.env.FRONTEND_URL || "http://localhost:3000"
							}/dashboard">View Dashboard</a></p>
						`,
				  });

			if (success) {
				res.json({
					success: true,
					message: "Audit notification resent successfully",
				});
			} else {
				res.status(500).json({
					success: false,
					error: "Failed to resend notification",
				});
			}
		} catch (error) {
			console.error("Resend notification error:", error);
			res.status(500).json({
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
		return () => {};
	}
);

export default router;
