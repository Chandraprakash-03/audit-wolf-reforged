import request from "supertest";
import express from "express";
import notificationRoutes from "../routes/notifications";
import EmailService from "../services/EmailService";
import { DatabaseService } from "../services/database";

// Mock dependencies
jest.mock("../services/EmailService");
jest.mock("../services/database");
jest.mock("../middleware/auth", () => ({
	authenticateToken: (req: any, res: any, next: any) => {
		req.user = { id: "test-user-id" };
		next();
	},
}));

const MockedEmailService = EmailService as jest.MockedClass<
	typeof EmailService
>;
const MockedDatabaseService = DatabaseService as jest.Mocked<
	typeof DatabaseService
>;

describe("Notification Routes", () => {
	let app: express.Application;
	let mockEmailService: jest.Mocked<EmailService>;

	beforeEach(() => {
		app = express();
		app.use(express.json());
		app.use("/api/notifications", notificationRoutes);

		// Reset mocks
		jest.clearAllMocks();

		// Setup email service mock
		mockEmailService = {
			isEmailConfigured: jest.fn(),
			sendEmail: jest.fn(),
			sendAuditCompletionEmail: jest.fn(),
			sendAuditFailureEmail: jest.fn(),
			sendWelcomeEmail: jest.fn(),
			sendAuditStartedEmail: jest.fn(),
			testConnection: jest.fn(),
		} as any;

		// Mock the constructor to return our mock instance
		(EmailService as jest.MockedClass<typeof EmailService>).mockImplementation(
			() => mockEmailService
		);
	});

	describe("POST /test-email", () => {
		it("should send test email successfully", async () => {
			const mockUser = {
				id: "test-user-id",
				email: "test@example.com",
				name: "Test User",
			};

			MockedDatabaseService.getUserById.mockResolvedValue(mockUser as any);
			mockEmailService.isEmailConfigured.mockReturnValue(true);
			mockEmailService.sendEmail.mockResolvedValue(true);

			const response = await request(app)
				.post("/api/notifications/test-email")
				.expect(200);

			expect(response.body).toEqual({
				success: true,
				message: "Test email sent successfully",
			});

			expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
				to: "test@example.com",
				subject: "Audit Wolf Email Test",
				html: expect.stringContaining("Test User"),
			});
		});

		it("should return error when email service not configured", async () => {
			const mockUser = {
				id: "test-user-id",
				email: "test@example.com",
				name: "Test User",
			};

			MockedDatabaseService.getUserById.mockResolvedValue(mockUser as any);
			mockEmailService.isEmailConfigured.mockReturnValue(false);

			const response = await request(app)
				.post("/api/notifications/test-email")
				.expect(503);

			expect(response.body).toEqual({
				error: "Email service not configured",
				message: "SMTP credentials are not properly set up",
			});
		});

		it("should return error when user email not found", async () => {
			MockedDatabaseService.getUserById.mockResolvedValue(null);

			const response = await request(app)
				.post("/api/notifications/test-email")
				.expect(400);

			expect(response.body).toEqual({
				error: "User email not found",
			});
		});

		it("should handle email sending failure", async () => {
			const mockUser = {
				id: "test-user-id",
				email: "test@example.com",
				name: "Test User",
			};

			MockedDatabaseService.getUserById.mockResolvedValue(mockUser as any);
			mockEmailService.isEmailConfigured.mockReturnValue(true);
			mockEmailService.sendEmail.mockResolvedValue(false);

			const response = await request(app)
				.post("/api/notifications/test-email")
				.expect(500);

			expect(response.body).toEqual({
				success: false,
				error: "Failed to send test email",
			});
		});
	});

	describe("GET /status", () => {
		it("should return email service status when configured", async () => {
			mockEmailService.isEmailConfigured.mockReturnValue(true);

			const response = await request(app)
				.get("/api/notifications/status")
				.expect(200);

			expect(response.body).toEqual({
				emailService: {
					configured: true,
					status: "ready",
				},
				features: {
					auditCompletion: true,
					auditFailure: true,
					testEmail: true,
				},
			});
		});

		it("should return email service status when not configured", async () => {
			mockEmailService.isEmailConfigured.mockReturnValue(false);

			const response = await request(app)
				.get("/api/notifications/status")
				.expect(200);

			expect(response.body).toEqual({
				emailService: {
					configured: false,
					status: "not_configured",
				},
				features: {
					auditCompletion: true,
					auditFailure: true,
					testEmail: true,
				},
			});
		});
	});

	describe("POST /resend-audit/:auditId", () => {
		const mockAudit = {
			id: "audit-123",
			user_id: "test-user-id",
			contract_id: "contract-123",
			status: "completed",
		};

		const mockUser = {
			id: "test-user-id",
			email: "test@example.com",
			name: "Test User",
		};

		const mockContract = {
			id: "contract-123",
			name: "TestContract",
			user_id: "test-user-id",
		};

		it("should resend audit notification successfully", async () => {
			MockedDatabaseService.getAuditById.mockResolvedValue(mockAudit as any);
			MockedDatabaseService.getUserById.mockResolvedValue(mockUser as any);
			MockedDatabaseService.getContractById.mockResolvedValue(
				mockContract as any
			);
			MockedDatabaseService.getVulnerabilitiesByAuditId.mockResolvedValue([]);
			mockEmailService.sendEmail.mockResolvedValue(true);

			const response = await request(app)
				.post("/api/notifications/resend-audit/audit-123")
				.expect(200);

			expect(response.body).toEqual({
				success: true,
				message: "Audit notification resent successfully",
			});

			expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
				to: "test@example.com",
				subject: "Audit Complete: TestContract",
				html: expect.stringContaining("TestContract"),
			});
		});

		it("should return error when audit not found", async () => {
			MockedDatabaseService.getAuditById.mockResolvedValue(null);

			const response = await request(app)
				.post("/api/notifications/resend-audit/nonexistent")
				.expect(404);

			expect(response.body).toEqual({
				error: "Audit not found",
			});
		});

		it("should return error when user doesn't own audit", async () => {
			const otherUserAudit = {
				...mockAudit,
				user_id: "other-user-id",
			};

			MockedDatabaseService.getAuditById.mockResolvedValue(
				otherUserAudit as any
			);

			const response = await request(app)
				.post("/api/notifications/resend-audit/audit-123")
				.expect(403);

			expect(response.body).toEqual({
				error: "Access denied",
			});
		});

		it("should return error when audit not completed", async () => {
			const pendingAudit = {
				...mockAudit,
				status: "pending",
			};

			MockedDatabaseService.getAuditById.mockResolvedValue(pendingAudit as any);

			const response = await request(app)
				.post("/api/notifications/resend-audit/audit-123")
				.expect(400);

			expect(response.body).toEqual({
				error: "Audit not completed",
				message: "Can only resend notifications for completed audits",
			});
		});

		it("should handle missing user email", async () => {
			const userWithoutEmail = {
				...mockUser,
				email: null,
			};

			MockedDatabaseService.getAuditById.mockResolvedValue(mockAudit as any);
			MockedDatabaseService.getUserById.mockResolvedValue(
				userWithoutEmail as any
			);

			const response = await request(app)
				.post("/api/notifications/resend-audit/audit-123")
				.expect(400);

			expect(response.body).toEqual({
				error: "Missing required data",
				message: "User email or contract information not found",
			});
		});

		it("should handle email sending failure", async () => {
			MockedDatabaseService.getAuditById.mockResolvedValue(mockAudit as any);
			MockedDatabaseService.getUserById.mockResolvedValue(mockUser as any);
			MockedDatabaseService.getContractById.mockResolvedValue(
				mockContract as any
			);
			MockedDatabaseService.getVulnerabilitiesByAuditId.mockResolvedValue([]);
			mockEmailService.sendEmail.mockResolvedValue(false);

			const response = await request(app)
				.post("/api/notifications/resend-audit/audit-123")
				.expect(500);

			expect(response.body).toEqual({
				success: false,
				error: "Failed to resend notification",
			});
		});
	});
});
