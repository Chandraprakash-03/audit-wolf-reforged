import request from "supertest";
import { app } from "../index";
import { DatabaseService } from "../services/database";

// Mock dependencies
jest.mock("../services/database");
jest.mock("../services/MultiChainAnalysisOrchestrator");
jest.mock("../config/queue");

describe("Cross-Chain Analysis API", () => {
	let authToken: string;

	beforeAll(async () => {
		// Mock authentication
		authToken = "mock-jwt-token";

		// Mock user authentication
		jest
			.spyOn(require("../middleware/auth"), "authenticateToken")
			.mockImplementation((req: any, res: any, next: any) => {
				req.user = { id: "test-user-id", email: "test@example.com" };
				next();
			});
	});

	describe("POST /api/analysis/cross-chain/start", () => {
		it("should start cross-chain analysis successfully", async () => {
			// Mock MultiChainAnalysisOrchestrator
			const mockOrchestrator = {
				startMultiChainAnalysis: jest.fn().mockResolvedValue({
					success: true,
					multiChainAuditId: "test-audit-id",
					jobId: "test-job-id",
				}),
			};

			jest.doMock("../services/MultiChainAnalysisOrchestrator", () => ({
				MultiChainAnalysisOrchestrator: jest.fn(() => mockOrchestrator),
			}));

			const requestBody = {
				auditName: "Test Cross-Chain Audit",
				platforms: ["ethereum", "solana"],
				contracts: [
					{
						code: "pragma solidity ^0.8.0; contract Test {}",
						filename: "Test.sol",
						platform: "ethereum",
						language: "solidity",
					},
					{
						code: "use anchor_lang::prelude::*; #[program] pub mod test {}",
						filename: "test.rs",
						platform: "solana",
						language: "rust",
					},
				],
				crossChainAnalysis: true,
				analysisOptions: {
					includeStaticAnalysis: true,
					includeAIAnalysis: false,
					severityThreshold: "medium",
				},
			};

			const response = await request(app)
				.post("/api/analysis/cross-chain/start")
				.set("Authorization", `Bearer ${authToken}`)
				.send(requestBody)
				.expect(202);

			expect(response.body.success).toBe(true);
			expect(response.body.message).toBe(
				"Cross-chain analysis started successfully"
			);
			expect(response.body.data.multiChainAuditId).toBe("test-audit-id");
			expect(response.body.data.jobId).toBe("test-job-id");
		});

		it("should validate required fields", async () => {
			const invalidRequestBody = {
				auditName: "", // Invalid: empty name
				platforms: ["ethereum"], // Invalid: only one platform
				contracts: [], // Invalid: no contracts
			};

			const response = await request(app)
				.post("/api/analysis/cross-chain/start")
				.set("Authorization", `Bearer ${authToken}`)
				.send(invalidRequestBody)
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toBe("Validation failed");
			expect(response.body.details).toBeDefined();
			expect(Array.isArray(response.body.details)).toBe(true);
		});

		it("should require authentication", async () => {
			const requestBody = {
				auditName: "Test Cross-Chain Audit",
				platforms: ["ethereum", "solana"],
				contracts: [
					{
						code: "pragma solidity ^0.8.0; contract Test {}",
						filename: "Test.sol",
						platform: "ethereum",
					},
				],
			};

			// Remove authentication mock temporarily
			jest
				.spyOn(require("../middleware/auth"), "authenticateToken")
				.mockImplementation((req: any, res: any, next: any) => {
					res.status(401).json({ error: "Unauthorized" });
				});

			await request(app)
				.post("/api/analysis/cross-chain/start")
				.send(requestBody)
				.expect(401);

			// Restore authentication mock
			jest
				.spyOn(require("../middleware/auth"), "authenticateToken")
				.mockImplementation((req: any, res: any, next: any) => {
					req.user = { id: "test-user-id", email: "test@example.com" };
					next();
				});
		});

		it("should handle orchestrator errors", async () => {
			// Mock MultiChainAnalysisOrchestrator to return error
			const mockOrchestrator = {
				startMultiChainAnalysis: jest.fn().mockResolvedValue({
					success: false,
					error: "Platform validation failed",
				}),
			};

			jest.doMock("../services/MultiChainAnalysisOrchestrator", () => ({
				MultiChainAnalysisOrchestrator: jest.fn(() => mockOrchestrator),
			}));

			const requestBody = {
				auditName: "Test Cross-Chain Audit",
				platforms: ["ethereum", "invalid-platform"],
				contracts: [
					{
						code: "pragma solidity ^0.8.0; contract Test {}",
						filename: "Test.sol",
						platform: "ethereum",
					},
				],
			};

			const response = await request(app)
				.post("/api/analysis/cross-chain/start")
				.set("Authorization", `Bearer ${authToken}`)
				.send(requestBody)
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toBe("Platform validation failed");
		});
	});

	describe("GET /api/analysis/cross-chain/:multiChainAuditId/progress", () => {
		it("should get cross-chain analysis progress", async () => {
			const mockProgress = {
				multiChainAuditId: "test-audit-id",
				status: "analyzing",
				overallProgress: 45,
				platformProgress: new Map([
					["ethereum", 60],
					["solana", 30],
				]),
				currentStep: "Analyzing Solana contracts",
				completedPlatforms: ["ethereum"],
				failedPlatforms: [],
			};

			// Mock MultiChainAnalysisOrchestrator
			const mockOrchestrator = {
				getAnalysisProgress: jest.fn().mockResolvedValue({
					success: true,
					progress: mockProgress,
				}),
			};

			jest.doMock("../services/MultiChainAnalysisOrchestrator", () => ({
				MultiChainAnalysisOrchestrator: jest.fn(() => mockOrchestrator),
			}));

			const response = await request(app)
				.get("/api/analysis/cross-chain/test-audit-id/progress")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toEqual(mockProgress);
		});

		it("should validate audit ID format", async () => {
			const response = await request(app)
				.get("/api/analysis/cross-chain/invalid-uuid/progress")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toBe("Validation failed");
		});

		it("should handle not found audit", async () => {
			// Mock MultiChainAnalysisOrchestrator to return not found
			const mockOrchestrator = {
				getAnalysisProgress: jest.fn().mockResolvedValue({
					success: false,
					error: "Multi-chain audit not found",
				}),
			};

			jest.doMock("../services/MultiChainAnalysisOrchestrator", () => ({
				MultiChainAnalysisOrchestrator: jest.fn(() => mockOrchestrator),
			}));

			const response = await request(app)
				.get(
					"/api/analysis/cross-chain/550e8400-e29b-41d4-a716-446655440000/progress"
				)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toBe("Multi-chain audit not found");
		});
	});

	describe("Integration with CrossChainAnalyzer", () => {
		it("should properly integrate cross-chain analysis flow", async () => {
			// Mock the full flow
			const mockOrchestrator = {
				startMultiChainAnalysis: jest.fn().mockResolvedValue({
					success: true,
					multiChainAuditId: "integration-test-id",
					jobId: "integration-job-id",
				}),
				getAnalysisProgress: jest.fn().mockResolvedValue({
					success: true,
					progress: {
						multiChainAuditId: "integration-test-id",
						status: "completed",
						overallProgress: 100,
						platformProgress: new Map([
							["ethereum", 100],
							["solana", 100],
						]),
						currentStep: "Cross-chain analysis completed",
						completedPlatforms: ["ethereum", "solana"],
						failedPlatforms: [],
					},
				}),
			};

			jest.doMock("../services/MultiChainAnalysisOrchestrator", () => ({
				MultiChainAnalysisOrchestrator: jest.fn(() => mockOrchestrator),
			}));

			// Start analysis
			const startResponse = await request(app)
				.post("/api/analysis/cross-chain/start")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					auditName: "Integration Test Audit",
					platforms: ["ethereum", "solana"],
					contracts: [
						{
							code: "pragma solidity ^0.8.0; contract Bridge { function lock() external {} }",
							filename: "Bridge.sol",
							platform: "ethereum",
							language: "solidity",
						},
						{
							code: "use anchor_lang::prelude::*; #[program] pub mod bridge { pub fn lock() {} }",
							filename: "bridge.rs",
							platform: "solana",
							language: "rust",
						},
					],
					crossChainAnalysis: true,
				})
				.expect(202);

			expect(startResponse.body.success).toBe(true);
			const auditId = startResponse.body.data.multiChainAuditId;

			// Check progress
			const progressResponse = await request(app)
				.get(`/api/analysis/cross-chain/${auditId}/progress`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(progressResponse.body.success).toBe(true);
			expect(progressResponse.body.data.status).toBe("completed");
			expect(progressResponse.body.data.overallProgress).toBe(100);
		});
	});
});
