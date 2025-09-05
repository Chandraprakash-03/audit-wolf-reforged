import { AnalysisService } from "../services/AnalysisService";
import { DatabaseService } from "../services/database";
import { SlitherAnalyzer } from "../services/SlitherAnalyzer";

// Mock dependencies
jest.mock("../services/database");
jest.mock("../services/SlitherAnalyzer");

const mockDatabaseService = DatabaseService as jest.Mocked<
	typeof DatabaseService
>;
const mockSlitherAnalyzer = SlitherAnalyzer as jest.MockedClass<
	typeof SlitherAnalyzer
>;

describe("AnalysisService", () => {
	let analysisService: AnalysisService;
	let mockSlitherInstance: jest.Mocked<SlitherAnalyzer>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mock Slither instance
		mockSlitherInstance = {
			analyzeContract: jest.fn(),
			getContractAST: jest.fn(),
		} as any;

		mockSlitherAnalyzer.mockImplementation(() => mockSlitherInstance);
		mockSlitherAnalyzer.checkSlitherInstallation = jest.fn();

		analysisService = new AnalysisService();
	});

	describe("startStaticAnalysis", () => {
		const mockContract = {
			id: "contract-123",
			user_id: "user-123",
			name: "TestContract",
			source_code: "pragma solidity ^0.8.0; contract Test {}",
			compiler_version: "0.8.0",
			file_hash: "hash123",
			blockchain_platform: "ethereum" as const,
			language: "solidity" as const,
			created_at: new Date(),
		};

		const mockAudit = {
			id: "audit-123",
			contract_id: "contract-123",
			user_id: "user-123",
			status: "analyzing" as const,
			created_at: new Date(),
		};

		it("should start static analysis successfully", async () => {
			mockDatabaseService.getContractById.mockResolvedValue(mockContract);
			mockDatabaseService.createAudit.mockResolvedValue(mockAudit);

			const result = await analysisService.startStaticAnalysis({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(true);
			expect(result.auditId).toBe("audit-123");
			expect(mockDatabaseService.getContractById).toHaveBeenCalledWith(
				"contract-123"
			);
			expect(mockDatabaseService.createAudit).toHaveBeenCalledWith({
				contract_id: "contract-123",
				user_id: "user-123",
				status: "analyzing",
			});
		});

		it("should fail if contract not found", async () => {
			mockDatabaseService.getContractById.mockResolvedValue(null);

			const result = await analysisService.startStaticAnalysis({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Contract not found");
		});

		it("should fail if user doesn't own contract", async () => {
			const otherUserContract = { ...mockContract, user_id: "other-user" };
			mockDatabaseService.getContractById.mockResolvedValue(otherUserContract);

			const result = await analysisService.startStaticAnalysis({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Access denied");
		});

		it("should fail if audit creation fails", async () => {
			mockDatabaseService.getContractById.mockResolvedValue(mockContract);
			mockDatabaseService.createAudit.mockResolvedValue(null);

			const result = await analysisService.startStaticAnalysis({
				contractId: "contract-123",
				userId: "user-123",
				analysisType: "static",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed to create audit record");
		});
	});

	describe("getAnalysisProgress", () => {
		const mockAudit = {
			id: "audit-123",
			contract_id: "contract-123",
			user_id: "user-123",
			status: "analyzing" as const,
			created_at: new Date(),
		};

		it("should return progress for analyzing audit", async () => {
			mockDatabaseService.getAuditById.mockResolvedValue(mockAudit);

			const result = await analysisService.getAnalysisProgress(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(true);
			expect(result.progress).toEqual({
				auditId: "audit-123",
				status: "analyzing",
				progress: 50,
				currentStep: "Running security analysis",
			});
		});

		it("should return progress for completed audit", async () => {
			const completedAudit = { ...mockAudit, status: "completed" as const };
			mockDatabaseService.getAuditById.mockResolvedValue(completedAudit);

			const result = await analysisService.getAnalysisProgress(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(true);
			expect(result.progress?.progress).toBe(100);
			expect(result.progress?.currentStep).toBe("Analysis complete");
		});

		it("should fail if audit not found", async () => {
			mockDatabaseService.getAuditById.mockResolvedValue(null);

			const result = await analysisService.getAnalysisProgress(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Audit not found");
		});

		it("should fail if user doesn't own audit", async () => {
			const otherUserAudit = { ...mockAudit, user_id: "other-user" };
			mockDatabaseService.getAuditById.mockResolvedValue(otherUserAudit);

			const result = await analysisService.getAnalysisProgress(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Access denied");
		});
	});

	describe("getAnalysisResults", () => {
		const mockAudit = {
			id: "audit-123",
			contract_id: "contract-123",
			user_id: "user-123",
			status: "completed" as const,
			static_results: {
				slither_findings: [],
				ast_analysis: [],
				gas_analysis: [],
				complexity: {
					cyclomatic_complexity: 1,
					lines_of_code: 10,
					function_count: 1,
				},
				executionTime: 5000,
			},
			created_at: new Date(),
		};

		const mockVulnerabilities = [
			{
				id: "vuln-1",
				audit_id: "audit-123",
				type: "reentrancy" as const,
				severity: "high" as const,
				title: "Reentrancy vulnerability",
				description: "Potential reentrancy attack",
				location: { file: "test.sol", line: 10, column: 5 },
				recommendation: "Use ReentrancyGuard",
				confidence: 0.9,
				source: "static" as const,
				created_at: new Date(),
			},
			{
				id: "vuln-2",
				audit_id: "audit-123",
				type: "gas_optimization" as const,
				severity: "low" as const,
				title: "Gas optimization",
				description: "Function can be external",
				location: { file: "test.sol", line: 15, column: 2 },
				recommendation: "Mark function as external",
				confidence: 0.8,
				source: "static" as const,
				created_at: new Date(),
			},
		];

		it("should return analysis results successfully", async () => {
			mockDatabaseService.getAuditById.mockResolvedValue(mockAudit);
			mockDatabaseService.getVulnerabilitiesByAuditId.mockResolvedValue(
				mockVulnerabilities
			);

			const result = await analysisService.getAnalysisResults(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(true);
			expect(result.results?.audit).toEqual(mockAudit);
			expect(result.results?.vulnerabilities).toEqual(mockVulnerabilities);
			expect(result.results?.summary).toEqual({
				totalVulnerabilities: 2,
				severityBreakdown: {
					high: 1,
					low: 1,
				},
				executionTime: 5000,
			});
		});

		it("should fail if audit not found", async () => {
			mockDatabaseService.getAuditById.mockResolvedValue(null);

			const result = await analysisService.getAnalysisResults(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Audit not found");
		});

		it("should fail if user doesn't own audit", async () => {
			const otherUserAudit = {
				...mockAudit,
				user_id: "other-user",
			};
			mockDatabaseService.getAuditById.mockResolvedValue(otherUserAudit);

			const result = await analysisService.getAnalysisResults(
				"audit-123",
				"user-123"
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Access denied");
		});
	});

	describe("validateContract", () => {
		const sampleContract = "pragma solidity ^0.8.0; contract Test {}";

		it("should validate contract successfully", async () => {
			const mockAnalysisResult = {
				success: true,
				vulnerabilities: [
					{
						type: "pragma",
						severity: "low" as const,
						title: "Pragma issue",
						description: "Pragma not specified",
						location: { file: "test.sol", line: 1, column: 0 },
						recommendation: "Specify pragma version",
						confidence: 0.8,
						source: "static" as const,
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1000,
			};

			mockSlitherInstance.analyzeContract.mockResolvedValue(mockAnalysisResult);

			const result = await analysisService.validateContract(sampleContract);

			expect(result.success).toBe(true);
			expect(result.isValid).toBe(true);
			expect(result.errors).toEqual([]);
			expect(result.quickScan?.potentialIssues).toBe(1);
			expect(result.quickScan?.estimatedAnalysisTime).toBeGreaterThan(0);
		});

		it("should handle validation errors", async () => {
			const mockAnalysisResult = {
				success: false,
				vulnerabilities: [],
				errors: ["Compilation failed"],
				warnings: [],
				executionTime: 500,
			};

			mockSlitherInstance.analyzeContract.mockResolvedValue(mockAnalysisResult);

			const result = await analysisService.validateContract(sampleContract);

			expect(result.success).toBe(true);
			expect(result.isValid).toBe(false);
			expect(result.errors).toEqual(["Compilation failed"]);
		});

		it("should handle analyzer exceptions", async () => {
			mockSlitherInstance.analyzeContract.mockRejectedValue(
				new Error("Analyzer failed")
			);

			const result = await analysisService.validateContract(sampleContract);

			expect(result.success).toBe(false);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Analyzer failed");
		});
	});

	describe("checkSystemHealth", () => {
		it("should return healthy status when Slither is installed", async () => {
			(
				mockSlitherAnalyzer.checkSlitherInstallation as jest.Mock
			).mockResolvedValue({
				installed: true,
				version: "0.9.6",
			});

			const result = await analysisService.checkSystemHealth();

			expect(result.slitherInstalled).toBe(true);
			expect(result.slitherVersion).toBe("0.9.6");
			expect(result.systemReady).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it("should return unhealthy status when Slither is not installed", async () => {
			(
				mockSlitherAnalyzer.checkSlitherInstallation as jest.Mock
			).mockResolvedValue({
				installed: false,
				error: "Command not found",
			});

			const result = await analysisService.checkSystemHealth();

			expect(result.slitherInstalled).toBe(false);
			expect(result.systemReady).toBe(false);
			expect(result.errors).toContain(
				"Slither not installed: Command not found"
			);
		});
	});

	describe("vulnerability type mapping", () => {
		it("should map Slither types to database enum values correctly", () => {
			// This tests the private method indirectly through the analysis flow
			const service = analysisService as any;

			expect(service.mapVulnerabilityType("reentrancy-eth")).toBe("reentrancy");
			expect(service.mapVulnerabilityType("arbitrary-send")).toBe(
				"access_control"
			);
			expect(service.mapVulnerabilityType("unused-state")).toBe(
				"gas_optimization"
			);
			expect(service.mapVulnerabilityType("pragma")).toBe("best_practice");
			expect(service.mapVulnerabilityType("unknown-type")).toBe(
				"best_practice"
			);
		});
	});

	describe("analysis time estimation", () => {
		it("should estimate analysis time based on contract complexity", () => {
			const service = analysisService as any;

			const simpleContract = "pragma solidity ^0.8.0; contract Test {}";
			const complexContract = `
				pragma solidity ^0.8.0;
				contract ComplexTest {
					function func1() public {}
					function func2() public {}
					function func3() public {}
				}
				contract AnotherContract {
					function func4() public {}
				}
			`;

			const simpleTime = service.estimateAnalysisTime(simpleContract);
			const complexTime = service.estimateAnalysisTime(complexContract);

			expect(complexTime).toBeGreaterThan(simpleTime);
			expect(simpleTime).toBeGreaterThan(0);
		});
	});
});
