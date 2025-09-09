import EmailService from "../services/EmailService";

describe("EmailService", () => {
	let emailService: EmailService;

	beforeEach(() => {
		emailService = new EmailService();
	});

	describe("constructor", () => {
		it("should initialize without throwing when SMTP credentials are not configured", () => {
			expect(() => new EmailService()).not.toThrow();
		});

		it("should detect when email is not configured", () => {
			expect(emailService.isEmailConfigured()).toBe(false);
		});
	});

	describe("sendEmail", () => {
		it("should return false when email service is not configured", async () => {
			const result = await emailService.sendEmail({
				to: "test@example.com",
				subject: "Test Subject",
				text: "Test message",
			});

			expect(result).toBe(false);
		});

		it("should handle missing content gracefully", async () => {
			const result = await emailService.sendEmail({
				to: "test@example.com",
				subject: "Test Subject",
			});

			expect(result).toBe(false);
		});
	});

	describe("sendAuditCompletionEmail", () => {
		it("should return false when email service is not configured", async () => {
			const mockPdfBuffer = Buffer.from("mock pdf content");

			const result = await emailService.sendAuditCompletionEmail(
				"test@example.com",
				"TestContract",
				"audit-123",
				mockPdfBuffer,
				5,
				3
			);

			expect(result).toBe(false);
		});
	});

	describe("sendAuditFailureEmail", () => {
		it("should return false when email service is not configured", async () => {
			const result = await emailService.sendAuditFailureEmail(
				"test@example.com",
				"TestContract",
				"audit-123",
				"Test error message"
			);

			expect(result).toBe(false);
		});
	});

	describe("testConnection", () => {
		it("should return false when email service is not configured", async () => {
			const result = await emailService.testConnection();
			expect(result).toBe(false);
		});
	});

	describe("sendWelcomeEmail", () => {
		it("should return false when email service is not configured", async () => {
			const result = await emailService.sendWelcomeEmail(
				"test@example.com",
				"Test User"
			);

			expect(result).toBe(false);
		});
	});

	describe("sendAuditStartedEmail", () => {
		it("should return false when email service is not configured", async () => {
			const result = await emailService.sendAuditStartedEmail(
				"test@example.com",
				"TestContract",
				"audit-123"
			);

			expect(result).toBe(false);
		});
	});

	describe("HTML template generation", () => {
		it("should generate audit completion HTML with proper data", () => {
			const html = (emailService as any).generateAuditCompletionHTML({
				contractName: "TestContract",
				auditId: "audit-123",
				vulnerabilityCount: 5,
				gasOptimizations: 3,
			});

			expect(html).toContain("TestContract");
			expect(html).toContain("audit-123");
			expect(html).toContain("5");
			expect(html).toContain("3");
			expect(html).toContain("Audit Complete");
		});

		it("should generate audit failure HTML with proper data", () => {
			const html = (emailService as any).generateAuditFailureHTML({
				contractName: "TestContract",
				auditId: "audit-123",
				errorMessage: "Test error message",
			});

			expect(html).toContain("TestContract");
			expect(html).toContain("audit-123");
			expect(html).toContain("Test error message");
			expect(html).toContain("Audit Failed");
		});

		it("should generate welcome HTML with proper data", () => {
			const html = (emailService as any).generateWelcomeHTML({
				userName: "Test User",
			});

			expect(html).toContain("Test User");
			expect(html).toContain("Welcome to Audit Wolf");
			expect(html).toContain("Start Your First Audit");
		});

		it("should generate audit started HTML with proper data", () => {
			const html = (emailService as any).generateAuditStartedHTML({
				contractName: "TestContract",
				auditId: "audit-123",
				estimatedTime: "5-10 minutes",
			});

			expect(html).toContain("TestContract");
			expect(html).toContain("audit-123");
			expect(html).toContain("5-10 minutes");
			expect(html).toContain("Audit Started");
		});
	});
});
