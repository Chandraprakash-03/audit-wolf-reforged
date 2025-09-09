import { MultiChainReportGenerator } from "../services/MultiChainReportGenerator";
import { MultiChainAuditReportService } from "../services/MultiChainAuditReportService";
import { MultiChainAuditModel } from "../models/MultiChainAudit";
import { PlatformVulnerability } from "../types/database";
import { CrossChainAnalysisResult } from "../types/blockchain";

// Mock dependencies
jest.mock("../services/database");
jest.mock("../models/MultiChainAudit");
jest.mock("../services/PDFGenerator");

describe("Multi-Chain Report Generation", () => {
	let mockMultiChainAudit: any;
	let mockPlatformVulnerabilities: Map<string, PlatformVulnerability[]>;
	let mockPlatformResults: Map<string, any>;
	let mockCrossChainResults: CrossChainAnalysisResult;

	beforeEach(() => {
		// Mock multi-chain audit
		mockMultiChainAudit = {
			id: "multi-audit-123",
			user_id: "user-456",
			audit_name: "DeFi Protocol Multi-Chain Audit",
			platforms: ["ethereum", "solana", "cardano"],
			contracts: {
				ethereum: [
					{ name: "DeFiProtocol.sol", code: "contract DeFiProtocol {}" },
				],
				solana: [
					{ name: "defi_protocol.rs", code: "pub mod defi_protocol {}" },
				],
				cardano: [
					{ name: "DefiProtocol.hs", code: "module DefiProtocol where" },
				],
			},
			cross_chain_analysis: true,
			status: "completed",
			results: {
				ethereum: { vulnerabilities: [], contractCount: 1 },
				solana: { vulnerabilities: [], contractCount: 1 },
				cardano: { vulnerabilities: [], contractCount: 1 },
			},
			cross_chain_results: {},
			created_at: new Date("2024-01-01"),
			completed_at: new Date("2024-01-02"),
			isCompleted: () => true,
			getResultsForPlatform: (platform: string) =>
				mockMultiChainAudit.results[platform],
			getTotalVulnerabilityCount: () => 5,
			getHighestSeverityAcrossPlatforms: () => "high",
		};

		// Mock platform vulnerabilities
		mockPlatformVulnerabilities = new Map([
			[
				"ethereum",
				[
					{
						id: "vuln-eth-1",
						platform: "ethereum",
						vulnerability_type: "reentrancy",
						severity: "high",
						title: "Reentrancy in withdraw function",
						description:
							"The withdraw function is vulnerable to reentrancy attacks",
						location: { file: "DeFiProtocol.sol", line: 45, column: 10 },
						recommendation: "Use reentrancy guard",
						confidence: 0.9,
						source: "static",
						created_at: new Date(),
					} as PlatformVulnerability,
					{
						id: "vuln-eth-2",
						platform: "ethereum",
						vulnerability_type: "access_control",
						severity: "medium",
						title: "Missing access control",
						description: "Admin functions lack proper access control",
						location: { file: "DeFiProtocol.sol", line: 78, column: 5 },
						recommendation: "Add onlyOwner modifier",
						confidence: 0.8,
						source: "ai",
						created_at: new Date(),
					} as PlatformVulnerability,
				],
			],
			[
				"solana",
				[
					{
						id: "vuln-sol-1",
						platform: "solana",
						vulnerability_type: "security",
						severity: "high",
						title: "Insecure PDA derivation",
						description: "Program derived address uses predictable seeds",
						location: { file: "defi_protocol.rs", line: 123, column: 15 },
						recommendation: "Use unpredictable seeds for PDA derivation",
						confidence: 0.85,
						source: "static",
						created_at: new Date(),
					} as PlatformVulnerability,
				],
			],
			[
				"cardano",
				[
					{
						id: "vuln-card-1",
						platform: "cardano",
						vulnerability_type: "validation",
						severity: "medium",
						title: "Insufficient datum validation",
						description:
							"Plutus validator doesn't properly validate datum structure",
						location: { file: "DefiProtocol.hs", line: 67, column: 8 },
						recommendation: "Add comprehensive datum validation",
						confidence: 0.75,
						source: "ai",
						created_at: new Date(),
					} as PlatformVulnerability,
					{
						id: "vuln-card-2",
						platform: "cardano",
						vulnerability_type: "security",
						severity: "low",
						title: "Inefficient UTXO handling",
						description: "UTXO selection could be optimized",
						location: { file: "DefiProtocol.hs", line: 89, column: 12 },
						recommendation: "Implement efficient UTXO selection algorithm",
						confidence: 0.6,
						source: "static",
						created_at: new Date(),
					} as PlatformVulnerability,
				],
			],
		]);

		// Mock platform results
		mockPlatformResults = new Map([
			[
				"ethereum",
				{ contractCount: 1, platformSpecific: { gasOptimizations: 3 } },
			],
			[
				"solana",
				{ contractCount: 1, platformSpecific: { anchorCompliance: true } },
			],
			[
				"cardano",
				{ contractCount: 1, platformSpecific: { plutusEfficiency: 0.8 } },
			],
		]);

		// Mock cross-chain results
		mockCrossChainResults = {
			bridgeSecurityAssessment: {
				lockingMechanisms: { score: 0.8, issues: [], recommendations: [] },
				messagePassing: {
					score: 0.7,
					issues: ["Weak message validation"],
					recommendations: ["Strengthen validation"],
				},
				validatorSets: { score: 0.9, issues: [], recommendations: [] },
				overallSecurityScore: 0.8,
			},
			stateConsistencyAnalysis: {
				potentialInconsistencies: [
					{
						description: "Token balance mismatch between chains",
						risk: 0.6,
						affectedPlatforms: ["ethereum", "solana"],
					},
				],
				recommendations: ["Implement cross-chain state synchronization"],
			},
			interoperabilityRisks: [
				{
					type: "bridge_security",
					severity: "medium",
					description: "Bridge contract lacks multi-signature validation",
					affectedPlatforms: ["ethereum", "solana"],
					mitigation: "Implement multi-signature bridge validation",
				},
			],
			crossChainRecommendations: [
				{
					category: "Bridge Security",
					description: "Implement time-locked withdrawals",
					priority: "high",
					platforms: ["ethereum", "solana"],
				},
			],
		};

		jest.clearAllMocks();
	});

	describe("MultiChainReportGenerator", () => {
		describe("generateReport", () => {
			it("should generate a comprehensive multi-chain report", async () => {
				const reportData = {
					audit: mockMultiChainAudit,
					platformResults: mockPlatformResults,
					crossChainResults: mockCrossChainResults,
					platformVulnerabilities: mockPlatformVulnerabilities,
				};

				const result = await MultiChainReportGenerator.generateReport(
					reportData
				);

				expect(result).toHaveProperty("report");
				expect(result).toHaveProperty("htmlContent");
				expect(result).toHaveProperty("metadata");

				// Check report structure
				expect(result.report.platform_summary).toHaveLength(3);
				expect(result.report.total_vulnerabilities).toBe(5);
				expect(result.report.cross_chain_summary).toBeDefined();
				expect(result.report.platform_comparison).toHaveLength(2); // Security score and vulnerability density

				// Check metadata
				expect(result.metadata.auditId).toBe("multi-audit-123");
				expect(result.metadata.platforms).toEqual([
					"ethereum",
					"solana",
					"cardano",
				]);
				expect(result.metadata.totalPages).toBeGreaterThan(8);
			});

			it("should handle multi-chain report without cross-chain analysis", async () => {
				const reportData = {
					audit: { ...mockMultiChainAudit, cross_chain_analysis: false },
					platformResults: mockPlatformResults,
					platformVulnerabilities: mockPlatformVulnerabilities,
				};

				const result = await MultiChainReportGenerator.generateReport(
					reportData
				);

				expect(result.report.cross_chain_summary).toBeUndefined();
				expect(result.htmlContent).not.toContain("Cross-Chain Analysis");
			});

			it("should generate platform-specific summaries correctly", async () => {
				const reportData = {
					audit: mockMultiChainAudit,
					platformResults: mockPlatformResults,
					platformVulnerabilities: mockPlatformVulnerabilities,
				};

				const result = await MultiChainReportGenerator.generateReport(
					reportData
				);

				const platformSummaries = result.report.platform_summary;

				// Check Ethereum summary
				const ethSummary = platformSummaries.find(
					(p) => p.platform === "ethereum"
				);
				expect(ethSummary).toBeDefined();
				expect(ethSummary!.platform_name).toBe("Ethereum");
				expect(ethSummary!.language).toBe("Solidity");
				expect(ethSummary!.vulnerability_count).toBe(2);
				expect(ethSummary!.severity_breakdown.high).toBe(1);
				expect(ethSummary!.severity_breakdown.medium).toBe(1);

				// Check Solana summary
				const solSummary = platformSummaries.find(
					(p) => p.platform === "solana"
				);
				expect(solSummary).toBeDefined();
				expect(solSummary!.platform_name).toBe("Solana");
				expect(solSummary!.language).toBe("Rust");
				expect(solSummary!.vulnerability_count).toBe(1);
				expect(solSummary!.severity_breakdown.high).toBe(1);

				// Check Cardano summary
				const cardSummary = platformSummaries.find(
					(p) => p.platform === "cardano"
				);
				expect(cardSummary).toBeDefined();
				expect(cardSummary!.platform_name).toBe("Cardano");
				expect(cardSummary!.language).toBe("Plutus");
				expect(cardSummary!.vulnerability_count).toBe(2);
				expect(cardSummary!.severity_breakdown.medium).toBe(1);
				expect(cardSummary!.severity_breakdown.low).toBe(1);
			});

			it("should generate vulnerability breakdown correctly", async () => {
				const reportData = {
					audit: mockMultiChainAudit,
					platformResults: mockPlatformResults,
					platformVulnerabilities: mockPlatformVulnerabilities,
				};

				const result = await MultiChainReportGenerator.generateReport(
					reportData
				);

				const breakdown = result.report.vulnerability_breakdown;

				// Check by severity
				expect(breakdown.by_severity.high).toBe(2);
				expect(breakdown.by_severity.medium).toBe(2);
				expect(breakdown.by_severity.low).toBe(1);

				// Check by platform
				expect(breakdown.by_platform.ethereum.high).toBe(1);
				expect(breakdown.by_platform.ethereum.medium).toBe(1);
				expect(breakdown.by_platform.solana.high).toBe(1);
				expect(breakdown.by_platform.cardano.medium).toBe(1);
				expect(breakdown.by_platform.cardano.low).toBe(1);

				// Check by type
				expect(breakdown.by_type.reentrancy).toBe(1);
				expect(breakdown.by_type.access_control).toBe(1);
				expect(breakdown.by_type.security).toBe(2);
				expect(breakdown.by_type.validation).toBe(1);
			});

			it("should generate platform comparisons", async () => {
				const reportData = {
					audit: mockMultiChainAudit,
					platformResults: mockPlatformResults,
					platformVulnerabilities: mockPlatformVulnerabilities,
				};

				const result = await MultiChainReportGenerator.generateReport(
					reportData
				);

				const comparisons = result.report.platform_comparison;

				expect(comparisons).toHaveLength(2);

				// Check security score comparison
				const securityComparison = comparisons.find(
					(c) => c.metric === "Security Score"
				);
				expect(securityComparison).toBeDefined();
				expect(securityComparison!.winner).toBeDefined();
				expect(securityComparison!.platforms).toHaveProperty("ethereum");
				expect(securityComparison!.platforms).toHaveProperty("solana");
				expect(securityComparison!.platforms).toHaveProperty("cardano");

				// Check vulnerability density comparison
				const densityComparison = comparisons.find(
					(c) => c.metric === "Vulnerability Density"
				);
				expect(densityComparison).toBeDefined();
				expect(densityComparison!.winner).toBeDefined();
			});

			it("should generate multi-chain recommendations", async () => {
				const reportData = {
					audit: mockMultiChainAudit,
					platformResults: mockPlatformResults,
					crossChainResults: mockCrossChainResults,
					platformVulnerabilities: mockPlatformVulnerabilities,
				};

				const result = await MultiChainReportGenerator.generateReport(
					reportData
				);

				const recommendations = result.report.recommendations;

				expect(recommendations.length).toBeGreaterThan(0);

				// Should have cross-platform recommendations for common vulnerability types
				const crossPlatformRec = recommendations.find(
					(r) => r.cross_chain_impact
				);
				expect(crossPlatformRec).toBeDefined();

				// Should have platform-specific recommendations
				const ethRec = recommendations.find(
					(r) =>
						r.affected_platforms.includes("ethereum") && !r.cross_chain_impact
				);
				expect(ethRec).toBeDefined();

				// Should have cross-chain specific recommendations
				const crossChainRec = recommendations.find(
					(r) => r.category === "Cross-Chain Security"
				);
				expect(crossChainRec).toBeDefined();

				// Should be sorted by priority
				const priorities = recommendations.map((r) => r.priority);
				const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
				for (let i = 1; i < priorities.length; i++) {
					expect(priorityOrder[priorities[i - 1]]).toBeGreaterThanOrEqual(
						priorityOrder[priorities[i]]
					);
				}
			});

			it("should generate valid HTML content", async () => {
				const reportData = {
					audit: mockMultiChainAudit,
					platformResults: mockPlatformResults,
					crossChainResults: mockCrossChainResults,
					platformVulnerabilities: mockPlatformVulnerabilities,
				};

				const result = await MultiChainReportGenerator.generateReport(
					reportData
				);

				expect(result.htmlContent).toContain("<!DOCTYPE html>");
				expect(result.htmlContent).toContain("Multi-Blockchain Audit Report");
				expect(result.htmlContent).toContain("DeFi Protocol Multi-Chain Audit");
				expect(result.htmlContent).toContain("Ethereum");
				expect(result.htmlContent).toContain("Solana");
				expect(result.htmlContent).toContain("Cardano");
				expect(result.htmlContent).toContain("Cross-Chain Analysis");
				expect(result.htmlContent).toContain("Platform Comparison");
				expect(result.htmlContent).toContain("Multi-Chain Recommendations");
			});
		});
	});

	describe("MultiChainAuditReportService", () => {
		beforeEach(() => {
			// Mock MultiChainAuditModel
			(MultiChainAuditModel.findById as jest.Mock).mockResolvedValue(
				mockMultiChainAudit
			);
		});

		describe("generateMultiChainAuditReport", () => {
			it("should validate request parameters", async () => {
				const invalidRequest = {
					auditId: "invalid-id",
					format: "invalid" as any,
				};

				await expect(
					MultiChainAuditReportService.generateMultiChainAuditReport(
						invalidRequest
					)
				).rejects.toThrow("Invalid format");
			});

			it("should validate audit exists and is completed", async () => {
				(MultiChainAuditModel.findById as jest.Mock).mockResolvedValue(null);

				const request = {
					auditId: "non-existent-audit",
					format: "html" as const,
				};

				await expect(
					MultiChainAuditReportService.generateMultiChainAuditReport(request)
				).rejects.toThrow("Multi-chain audit not found");
			});

			it("should validate platform filter", async () => {
				const request = {
					auditId: "multi-audit-123",
					format: "html" as const,
					platformFilter: ["ethereum", "invalid-platform"],
				};

				await expect(
					MultiChainAuditReportService.generateMultiChainAuditReport(request)
				).rejects.toThrow("Invalid platforms in filter");
			});
		});

		describe("generateComparativeReport", () => {
			it("should require at least 2 audits", async () => {
				await expect(
					MultiChainAuditReportService.generateComparativeReport(["audit-1"], {
						format: "html",
						reportName: "Comparison",
					})
				).rejects.toThrow("At least 2 audits required");
			});

			it("should validate all audits exist and are completed", async () => {
				const audits = [
					mockMultiChainAudit,
					{ ...mockMultiChainAudit, id: "audit-2", isCompleted: () => false },
				];

				(MultiChainAuditModel.findById as jest.Mock)
					.mockResolvedValueOnce(audits[0])
					.mockResolvedValueOnce(audits[1]);

				await expect(
					MultiChainAuditReportService.generateComparativeReport(
						["audit-1", "audit-2"],
						{ format: "html", reportName: "Comparison" }
					)
				).rejects.toThrow("All audits must be completed");
			});
		});

		describe("getMultiChainReportStatistics", () => {
			it("should return comprehensive statistics", async () => {
				// Mock file system operations
				const mockFs = require("fs-extra");
				mockFs.pathExists = jest.fn().mockResolvedValue(true);
				mockFs.stat = jest
					.fn()
					.mockResolvedValue({ size: 1024, mtime: new Date() });

				const stats =
					await MultiChainAuditReportService.getMultiChainReportStatistics(
						"multi-audit-123"
					);

				expect(stats).toHaveProperty("hasReport");
				expect(stats).toHaveProperty("hasHTMLFile");
				expect(stats).toHaveProperty("hasPDFFile");
				expect(stats).toHaveProperty("platforms");
				expect(stats).toHaveProperty("fileSizes");
				expect(stats.platforms).toEqual(["ethereum", "solana", "cardano"]);
			});
		});
	});

	describe("Integration Tests", () => {
		it("should generate complete multi-chain report with all components", async () => {
			const reportData = {
				audit: mockMultiChainAudit,
				platformResults: mockPlatformResults,
				crossChainResults: mockCrossChainResults,
				platformVulnerabilities: mockPlatformVulnerabilities,
			};

			const result = await MultiChainReportGenerator.generateReport(reportData);

			// Verify all major sections are present
			expect(result.report.executive_summary).toBeTruthy();
			expect(result.report.platform_summary).toHaveLength(3);
			expect(result.report.vulnerability_breakdown).toBeDefined();
			expect(result.report.platform_comparison).toHaveLength(2);
			expect(result.report.recommendations.length).toBeGreaterThan(0);
			expect(result.report.cross_chain_summary).toBeDefined();

			// Verify HTML contains all sections
			expect(result.htmlContent).toContain("Executive Summary");
			expect(result.htmlContent).toContain("Platform Overview");
			expect(result.htmlContent).toContain("Platform Comparison");
			expect(result.htmlContent).toContain("Platform-Specific Findings");
			expect(result.htmlContent).toContain("Cross-Chain Analysis");
			expect(result.htmlContent).toContain("Multi-Chain Recommendations");
			expect(result.htmlContent).toContain("Appendix");

			// Verify metadata is correct
			expect(result.metadata.auditId).toBe("multi-audit-123");
			expect(result.metadata.auditName).toBe("DeFi Protocol Multi-Chain Audit");
			expect(result.metadata.platforms).toEqual([
				"ethereum",
				"solana",
				"cardano",
			]);
			expect(result.metadata.totalPages).toBeGreaterThan(8);
		});
	});
});
