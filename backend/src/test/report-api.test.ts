import request from "supertest";
import express from "express";
import reportRoutes from "../routes/reports";
import { authenticateToken } from "../middleware/auth";
import { AuditReportService } from "../services/AuditReportService";
import { AuditModel } from "../models/Audit";
import { ContractModel } from "../models/Contract";
import * as fs from "fs-extra";

// Mock dependencies
jest.mock("../services/AuditReportService");
jest.mock("../models/Audit");
jest.mock("../models/Contract");
jest.mock("../middleware/auth");
jest.mock("fs-extra");

describe("Report API Routes", () => {
	let app: express.Application;
	let mockUser: any;
	let mockAudit: any;
	let mockContract: any;

	beforeEach(() => {
		// Setup Express app with routes
		app = express();
		app.use(express.json());
		app.use("/api/reports", reportRoutes);

		// Mock user
		mockUser = {
			id: "user-123",
			email: "test@example.com",
		};

		// Mock audit
		mockAudit = {
			id: "audit-456",
			user_id: "user-123",
			contract_id: "contract-789",
			status: "completed",
			isCompleted: jest.fn().mockReturnValue(true),
		};

		// Mock contract
		mockContract = {
			id: "contract-789",
			name: "TestContract",
			user_id: "user-123",
		};

		// Mock authentication middleware
		(authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
			req.user = mockUser;
			next();
		});

		// Mock model methods
		(AuditModel.findById as jest.Mock).mockResolvedValue(mockAudit);
		(ContractModel.findById as jest.Mock).mockResolvedValue(mockContract);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("POST /api/reports/generate", () => {
		it("should generate report successfully", async () => {
			const mockReportResult = {
				auditId: "audit-456",
				contractName: "TestContract",
				generatedAt: new Date(),
				html: {
					content: "<html>Mock HTML</html>",
					filePath: "/path/to/report.html",
				},
				pdf: {
					buffer: Buffer.from("mock pdf"),
					filePath: "/path/to/report.pdf",
					metadata: {
						size: 1024,
						pages: 5,
						generatedAt: new Date(),
					},
				},
				report: {
					report: {
						total_vulnerabilities: 3,
						critical_count: 1,
						high_count: 1,
						medium_count: 1,
						low_count: 0,
						informational_count: 0,
						gas_optimizations: [
							{
								type: "test",
								description: "test",
								location: { file: "test", line: 1, column: 1 },
								estimated_savings: 100,
							},
						],
						recommendations: [
							{
								category: "test",
								priority: "high",
								description: "test",
								implementation_guide: "test",
							},
						],
						executive_summary: "Test summary",
						generated_at: new Date(),
					},
					htmlContent: "<html>Mock HTML</html>",
					metadata: {
						auditId: "audit-456",
						contractName: "TestContract",
						generatedAt: new Date(),
						totalPages: 5,
					},
				},
			};

			(AuditReportService.generateAuditReport as jest.Mock).mockResolvedValue(
				mockReportResult
			);

			const response = await request(app).post("/api/reports/generate").send({
				auditId: "audit-456",
				format: "both",
				reportType: "standard",
			});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.auditId).toBe("audit-456");
			expect(response.body.data.html.available).toBe(true);
			expect(response.body.data.pdf.available).toBe(true);
			expect(response.body.data.pdf.size).toBe(1024);
			expect(response.body.data.pdf.pages).toBe(5);
		});

		it("should return 400 for invalid audit ID", async () => {
			const response = await request(app).post("/api/reports/generate").send({
				auditId: "invalid-id",
				format: "html",
			});

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe("Validation failed");
		});

		it("should return 404 for non-existent audit", async () => {
			(AuditModel.findById as jest.Mock).mockResolvedValue(null);

			const response = await request(app).post("/api/reports/generate").send({
				auditId: "550e8400-e29b-41d4-a716-446655440000",
				format: "html",
			});

			expect(response.status).toBe(404);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe("Audit not found");
		});

		it("should return 403 for unauthorized access", async () => {
			mockAudit.user_id = "different-user";

			const response = await request(app).post("/api/reports/generate").send({
				auditId: "550e8400-e29b-41d4-a716-446655440000",
				format: "html",
			});

			expect(response.status).toBe(403);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe("Access denied");
		});

		it("should return 400 for incomplete audit", async () => {
			mockAudit.isCompleted.mockReturnValue(false);

			const response = await request(app).post("/api/reports/generate").send({
				auditId: "550e8400-e29b-41d4-a716-446655440000",
				format: "html",
			});

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe("Audit is not completed yet");
		});

		it("should handle report generation errors", async () => {
			(AuditReportService.generateAuditReport as jest.Mock).mockRejectedValue(
				new Error("PDF generation failed")
			);

			const response = await request(app).post("/api/reports/generate").send({
				auditId: "550e8400-e29b-41d4-a716-446655440000",
				format: "pdf",
			});

			expect(response.status).toBe(500);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe("Failed to generate report");
		});
	});

	describe("GET /api/reports/:auditId", () => {
		it("should return report statistics", async () => {
			const mockStats = {
				hasReport: true,
				hasHTMLFile: true,
				hasPDFFile: true,
				reportGeneratedAt: new Date("2024-01-01"),
				fileSizes: {
					html: 2048,
					pdf: 4096,
				},
			};

			(AuditReportService.getReportStatistics as jest.Mock).mockResolvedValue(
				mockStats
			);

			const response = await request(app).get(
				"/api/reports/550e8400-e29b-41d4-a716-446655440000"
			);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.hasReport).toBe(true);
			expect(response.body.data.files.html.available).toBe(true);
			expect(response.body.data.files.pdf.available).toBe(true);
			expect(response.body.data.files.html.size).toBe(2048);
			expect(response.body.data.files.pdf.size).toBe(4096);
		});

		it("should return 404 for non-existent audit", async () => {
			(AuditModel.findById as jest.Mock).mockResolvedValue(null);

			const response = await request(app).get(
				"/api/reports/550e8400-e29b-41d4-a716-446655440000"
			);

			expect(response.status).toBe(404);
			expect(response.body.success).toBe(false);
		});
	});

	describe("GET /api/reports/:auditId/download/:format", () => {
		beforeEach(() => {
			// Mock file system operations
			(fs.pathExists as jest.Mock).mockResolvedValue(true);
			(fs.createReadStream as jest.Mock).mockReturnValue({
				pipe: jest.fn(),
				on: jest.fn((event, callback) => {
					if (event === "error") {
						// Don't trigger error by default
					}
				}),
			});
		});

		it("should download HTML report", async () => {
			const response = await request(app).get(
				"/api/reports/550e8400-e29b-41d4-a716-446655440000/download/html"
			);

			expect(response.status).toBe(200);
			expect(fs.createReadStream).toHaveBeenCalled();
		});

		it("should download PDF report", async () => {
			const response = await request(app).get(
				"/api/reports/550e8400-e29b-41d4-a716-446655440000/download/pdf"
			);

			expect(response.status).toBe(200);
			expect(fs.createReadStream).toHaveBeenCalled();
		});

		it("should return 404 for non-existent file", async () => {
			(fs.pathExists as jest.Mock).mockResolvedValue(false);

			const response = await request(app).get(
				"/api/reports/550e8400-e29b-41d4-a716-446655440000/download/html"
			);

			expect(response.status).toBe(404);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe("HTML report not found");
		});

		it("should return 400 for invalid format", async () => {
			const response = await request(app).get(
				"/api/reports/550e8400-e29b-41d4-a716-446655440000/download/invalid"
			);

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
		});
	});

	describe("PUT /api/reports/:auditId/regenerate", () => {
		it("should regenerate report successfully", async () => {
			const mockReportResult = {
				auditId: "audit-456",
				contractName: "TestContract",
				generatedAt: new Date(),
				html: {
					content: "<html>Regenerated HTML</html>",
					filePath: "/path/to/report.html",
				},
				pdf: {
					buffer: Buffer.from("regenerated pdf"),
					filePath: "/path/to/report.pdf",
					metadata: {
						size: 2048,
						pages: 6,
						generatedAt: new Date(),
					},
				},
				report: {
					report: {
						total_vulnerabilities: 2,
						critical_count: 0,
						high_count: 1,
						medium_count: 1,
						low_count: 0,
						informational_count: 0,
						gas_optimizations: [],
						recommendations: [],
						executive_summary: "Updated summary",
						generated_at: new Date(),
					},
					htmlContent: "<html>Regenerated HTML</html>",
					metadata: {
						auditId: "audit-456",
						contractName: "TestContract",
						generatedAt: new Date(),
						totalPages: 6,
					},
				},
			};

			(AuditReportService.regenerateReport as jest.Mock).mockResolvedValue(
				mockReportResult
			);

			const response = await request(app)
				.put("/api/reports/550e8400-e29b-41d4-a716-446655440000/regenerate")
				.send({
					format: "both",
					reportType: "detailed",
				});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.data.auditId).toBe("audit-456");
			expect(AuditReportService.regenerateReport).toHaveBeenCalledWith(
				"550e8400-e29b-41d4-a716-446655440000",
				{
					format: "both",
					reportType: "detailed",
				}
			);
		});

		it("should handle regeneration errors", async () => {
			(AuditReportService.regenerateReport as jest.Mock).mockRejectedValue(
				new Error("Regeneration failed")
			);

			const response = await request(app)
				.put("/api/reports/550e8400-e29b-41d4-a716-446655440000/regenerate")
				.send({
					format: "html",
				});

			expect(response.status).toBe(500);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe("Failed to regenerate report");
		});
	});

	describe("DELETE /api/reports/:auditId", () => {
		it("should delete report files successfully", async () => {
			(AuditReportService.deleteReportFiles as jest.Mock).mockResolvedValue(
				undefined
			);

			const response = await request(app).delete(
				"/api/reports/550e8400-e29b-41d4-a716-446655440000"
			);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.message).toBe("Report files deleted successfully");
			expect(AuditReportService.deleteReportFiles).toHaveBeenCalledWith(
				"550e8400-e29b-41d4-a716-446655440000",
				"TestContract"
			);
		});

		it("should handle deletion errors", async () => {
			(AuditReportService.deleteReportFiles as jest.Mock).mockRejectedValue(
				new Error("Permission denied")
			);

			const response = await request(app).delete(
				"/api/reports/550e8400-e29b-41d4-a716-446655440000"
			);

			expect(response.status).toBe(500);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toBe("Failed to delete report files");
		});
	});

	describe("Authentication and Authorization", () => {
		it("should require authentication for all endpoints", async () => {
			// Mock authentication failure
			(authenticateToken as jest.Mock).mockImplementation((req, res, next) => {
				res.status(401).json({ error: "Unauthorized" });
			});

			const endpoints = [
				{ method: "post", path: "/api/reports/generate" },
				{
					method: "get",
					path: "/api/reports/550e8400-e29b-41d4-a716-446655440000",
				},
				{
					method: "get",
					path: "/api/reports/550e8400-e29b-41d4-a716-446655440000/download/html",
				},
				{
					method: "put",
					path: "/api/reports/550e8400-e29b-41d4-a716-446655440000/regenerate",
				},
				{
					method: "delete",
					path: "/api/reports/550e8400-e29b-41d4-a716-446655440000",
				},
			];

			for (const endpoint of endpoints) {
				const response = await (request(app) as any)[endpoint.method](
					endpoint.path
				);
				expect(response.status).toBe(401);
			}
		});

		it("should enforce audit ownership", async () => {
			// Mock different user
			mockAudit.user_id = "different-user";

			const endpoints = [
				{
					method: "post",
					path: "/api/reports/generate",
					body: {
						auditId: "550e8400-e29b-41d4-a716-446655440000",
						format: "html",
					},
				},
				{
					method: "get",
					path: "/api/reports/550e8400-e29b-41d4-a716-446655440000",
				},
				{
					method: "put",
					path: "/api/reports/550e8400-e29b-41d4-a716-446655440000/regenerate",
					body: { format: "html" },
				},
				{
					method: "delete",
					path: "/api/reports/550e8400-e29b-41d4-a716-446655440000",
				},
			];

			for (const endpoint of endpoints) {
				const req = (request(app) as any)[endpoint.method](endpoint.path);
				if (endpoint.body) {
					req.send(endpoint.body);
				}
				const response = await req;
				expect(response.status).toBe(403);
				expect(response.body.message).toBe("Access denied");
			}
		});
	});

	describe("Input Validation", () => {
		it("should validate report generation request", async () => {
			const invalidRequests = [
				{ auditId: "invalid", format: "html" }, // Invalid UUID
				{ auditId: "550e8400-e29b-41d4-a716-446655440000", format: "invalid" }, // Invalid format
				{
					auditId: "550e8400-e29b-41d4-a716-446655440000",
					format: "html",
					reportType: "invalid",
				}, // Invalid report type
			];

			for (const invalidRequest of invalidRequests) {
				const response = await request(app)
					.post("/api/reports/generate")
					.send(invalidRequest);

				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
				expect(response.body.message).toBe("Validation failed");
			}
		});

		it("should validate URL parameters", async () => {
			const response = await request(app).get("/api/reports/invalid-uuid");

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
		});
	});
});
