import { AnalysisService } from "../services/AnalysisService";
import { DatabaseService } from "../services/database";

// Mock the AI analyzer
jest.mock("../services/AIAnalyzer", () => ({
	AIAnalyzer: jest.fn().mockImplementation(() => ({
		analyzeContract: jest.fn().mockResolvedValue({
			success: true,
			result: {
				vulnerabilities: [
					{
						type: "reentrancy",
						severity: "high",
						description: "Potential reentrancy vulnerability",
						location: {
							file: "contract.sol",
							line: 10,
							column: 1,
						},
						confidence: 0.85,
					},
				],
				recommendations: [
					{
						category: "Security",
						priority: "high",
						description: "Implement reentrancy guard",
						implementation_guide: "Use OpenZeppelin's ReentrancyGuard",
					},
				],
				code_quality: {
					code_quality_score: 75,
					maintainability_index: 80,
					test_coverage_estimate: 60,
				},
				confidence: 0.82,
			},
			executionTime: 5000,
		}),
	})),
}));

// Mock the Slither analyzer
jest.mock("../services/SlitherAnalyzer", () => ({
	SlitherAnalyzer: jest.fn().mockImplementation(() => ({
		analyzeContract: jest.fn().mockResolvedValue({
			success: true,
			vulnerabilities: [],
			errors: [],
			warnings: [],
			executionTime: 3000,
		}),
	})),
}));

// Mock database service
jest.mock("../services/database", () => ({
	DatabaseService: {
		getContractById: jest.fn(),
		createAudit: jest.fn(),
		updateAudit: jest.fn(),
		createVulnerability: jest.fn(),
	},
}));

describe("AI Analysis Integration", () => {
	let analysisService: AnalysisService;

	beforeEach(() => {
		jest.clearAllMocks();
		analysisService = new AnalysisService();
	});

	describe("startAIAnalysis", () => {
		it("should successfully start AI analysis", async () => {
			// Mock database responses
			const mockContract = {
				id: "contract-123",
				user_id: "user-123",
				name: "TestContract",
				source_code: "pragma solidity ^0.8.0; contract Test {}",
				compiler_version: "0.8.0",
				file_hash: "hash123",
				created_at: new Date(),
			};

			const mockAudit = {
				id: "audit-123",
				contract_id: "contract-123",
				user_id: "user-123",
				status: "analyzing" as const,
				created_at: new Date(),
			};

			(DatabaseService.getContractById as jest.Mock).mockResolvedValue(
				mockContract
			);
			(DatabaseService.createAudit as jest.Mock).mockResolvedValue(mockAudit);
			(DatabaseService.updateAudit as jest.Mock).mockResolvedValue(true);
			(DatabaseService.createVulnerability as jest.Mock).mockResolvedValue(
				true
			);

			const result = await analysisService.startAIAnalysis({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "ai",
			});

			expect(result.success).toBe(true);
			expect(result.auditId).toBe("audit-123");
			expect(DatabaseService.getContractById).toHaveBeenCalledWith(
				"contract-123"
			);
			expect(DatabaseService.createAudit).toHaveBeenCalledWith({
				contract_id: "contract-123",
				user_id: "user-123",
				status: "analyzing",
			});
		});

		it("should handle contract not found", async () => {
			(DatabaseService.getContractById as jest.Mock).mockResolvedValue(null);

			const result = await analysisService.startAIAnalysis({
				contractId: "nonexistent-contract",
				userId: "user-123",
				analysisType: "ai",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Contract not found");
		});

		it("should handle access denied", async () => {
			const mockContract = {
				id: "contract-123",
				user_id: "different-user",
				name: "TestContract",
				source_code: "pragma solidity ^0.8.0; contract Test {}",
				compiler_version: "0.8.0",
				file_hash: "hash123",
				created_at: new Date(),
			};

			(DatabaseService.getContractById as jest.Mock).mockResolvedValue(
				mockContract
			);

			const result = await analysisService.startAIAnalysis({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "ai",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Access denied");
		});
	});

	describe("startFullAnalysis", () => {
		it("should successfully start full analysis", async () => {
			// Mock database responses
			const mockContract = {
				id: "contract-123",
				user_id: "user-123",
				name: "TestContract",
				source_code: "pragma solidity ^0.8.0; contract Test {}",
				compiler_version: "0.8.0",
				file_hash: "hash123",
				created_at: new Date(),
			};

			const mockAudit = {
				id: "audit-123",
				contract_id: "contract-123",
				user_id: "user-123",
				status: "analyzing" as const,
				created_at: new Date(),
			};

			(DatabaseService.getContractById as jest.Mock).mockResolvedValue(
				mockContract
			);
			(DatabaseService.createAudit as jest.Mock).mockResolvedValue(mockAudit);
			(DatabaseService.updateAudit as jest.Mock).mockResolvedValue(true);
			(DatabaseService.createVulnerability as jest.Mock).mockResolvedValue(
				true
			);

			const result = await analysisService.startFullAnalysis({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "full",
			});

			expect(result.success).toBe(true);
			expect(result.auditId).toBe("audit-123");
			expect(DatabaseService.getContractById).toHaveBeenCalledWith(
				"contract-123"
			);
			expect(DatabaseService.createAudit).toHaveBeenCalledWith({
				contract_id: "contract-123",
				user_id: "user-123",
				status: "analyzing",
			});
		});
	});

	describe("checkSystemHealth", () => {
		it("should check both Slither and AI system health", async () => {
			// Mock Slither check
			const { SlitherAnalyzer } = require("../services/SlitherAnalyzer");
			SlitherAnalyzer.checkSlitherInstallation = jest.fn().mockResolvedValue({
				installed: true,
				version: "0.9.0",
			});

			// Mock AI check
			const { AIAnalyzer } = require("../services/AIAnalyzer");
			AIAnalyzer.checkConfiguration = jest.fn().mockResolvedValue({
				configured: true,
				availableModels: ["openai/gpt-4o-mini"],
				errors: [],
			});

			const health = await analysisService.checkSystemHealth();

			expect(health.slitherInstalled).toBe(true);
			expect(health.aiConfigured).toBe(true);
			expect(health.systemReady).toBe(true);
			expect(health.errors).toHaveLength(0);
		});

		it("should detect system issues", async () => {
			// Mock Slither failure
			const { SlitherAnalyzer } = require("../services/SlitherAnalyzer");
			SlitherAnalyzer.checkSlitherInstallation = jest.fn().mockResolvedValue({
				installed: false,
				error: "Slither not found",
			});

			// Mock AI failure
			const { AIAnalyzer } = require("../services/AIAnalyzer");
			AIAnalyzer.checkConfiguration = jest.fn().mockResolvedValue({
				configured: false,
				availableModels: [],
				errors: ["API key not configured"],
			});

			const health = await analysisService.checkSystemHealth();

			expect(health.slitherInstalled).toBe(false);
			expect(health.aiConfigured).toBe(false);
			expect(health.systemReady).toBe(false);
			expect(health.errors.length).toBeGreaterThan(0);
		});
	});
});
