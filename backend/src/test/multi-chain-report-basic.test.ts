import { MultiChainReportGenerator } from "../services/MultiChainReportGenerator";

describe("Multi-Chain Report Generator Basic Tests", () => {
	it("should have the correct class structure", () => {
		expect(MultiChainReportGenerator).toBeDefined();
		expect(typeof MultiChainReportGenerator.generateReport).toBe("function");
	});

	it("should generate basic report structure", async () => {
		const mockAudit = {
			id: "test-audit",
			user_id: "user-123",
			audit_name: "Test Audit",
			platforms: ["ethereum", "solana"],
			contracts: {},
			cross_chain_analysis: false,
			status: "completed" as const,
			results: {},
			cross_chain_results: {},
			created_at: new Date(),
			completed_at: new Date(),
			isCompleted: () => true,
			isFailed: () => false,
			isInProgress: () => false,
			isPending: () => false,
			getDuration: () => 1000,
			getPlatformCount: () => 2,
			getContractCount: () => 2,
			hasPlatform: (platform: string) =>
				["ethereum", "solana"].includes(platform),
			getResultsForPlatform: (platform: string) => ({}),
			getTotalVulnerabilityCount: () => 0,
			getVulnerabilityCountByPlatform: () => ({ ethereum: 0, solana: 0 }),
			getHighestSeverityAcrossPlatforms: () => null,
			toJSON: () => ({
				id: "test-audit",
				user_id: "user-123",
				audit_name: "Test Audit",
				platforms: ["ethereum", "solana"],
				contracts: {},
				cross_chain_analysis: false,
				status: "completed" as const,
				results: {},
				cross_chain_results: {},
				created_at: new Date(),
				completed_at: new Date(),
			}),
			updateStatus: async () => true,
			updateResults: async () => true,
			updateCrossChainResults: async () => true,
		};

		const reportData = {
			audit: mockAudit,
			platformResults: new Map([
				["ethereum", { contractCount: 1 }],
				["solana", { contractCount: 1 }],
			]),
			platformVulnerabilities: new Map([
				["ethereum", []],
				["solana", []],
			]),
		};

		const result = await MultiChainReportGenerator.generateReport(reportData);

		expect(result).toHaveProperty("report");
		expect(result).toHaveProperty("htmlContent");
		expect(result).toHaveProperty("metadata");
		expect(result.report.platform_summary).toHaveLength(2);
		expect(result.htmlContent).toContain("Multi-Blockchain Audit Report");
	});
});
