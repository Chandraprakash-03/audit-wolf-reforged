import { CrossChainAnalyzer } from "../services/analyzers/CrossChainAnalyzer";
import {
	AnalysisResult,
	PlatformVulnerability,
	CrossChainAnalysisResult,
	InteroperabilityRisk,
	CrossChainRecommendation,
} from "../types/blockchain";

describe("CrossChainAnalyzer", () => {
	let crossChainAnalyzer: CrossChainAnalyzer;

	beforeEach(() => {
		crossChainAnalyzer = new CrossChainAnalyzer();
	});

	describe("analyzeCrossChain", () => {
		it("should perform comprehensive cross-chain analysis", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			// Mock Ethereum analysis result
			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "reentrancy",
						severity: "high",
						title: "Reentrancy vulnerability in lock function",
						description:
							"The lock function is vulnerable to reentrancy attacks",
						location: { file: "Bridge.sol", line: 45, column: 10 },
						recommendation: "Use reentrancy guard",
						confidence: 0.9,
						source: "static",
						platform: "ethereum",
					},
					{
						type: "bridge_security",
						severity: "medium",
						title: "Bridge message validation",
						description: "Bridge message validation could be improved",
						location: { file: "Bridge.sol", line: 78, column: 5 },
						recommendation: "Add signature verification",
						confidence: 0.8,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1500,
			});

			// Mock Solana analysis result
			platformResults.set("solana", {
				success: true,
				vulnerabilities: [
					{
						type: "pda_security",
						severity: "high",
						title: "Insecure PDA derivation",
						description: "PDA derivation uses predictable seeds",
						location: { file: "bridge.rs", line: 123, column: 15 },
						recommendation: "Use unpredictable seeds for PDA derivation",
						confidence: 0.85,
						source: "static",
						platform: "solana",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1200,
			});

			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);

			expect(result).toBeDefined();
			expect(result.bridgeSecurityAssessment).toBeDefined();
			expect(result.stateConsistencyAnalysis).toBeDefined();
			expect(result.interoperabilityRisks).toBeDefined();
			expect(result.crossChainRecommendations).toBeDefined();

			// Verify bridge security assessment
			expect(
				result.bridgeSecurityAssessment?.overallSecurityScore
			).toBeGreaterThanOrEqual(0);
			expect(
				result.bridgeSecurityAssessment?.overallSecurityScore
			).toBeLessThanOrEqual(100);

			// Verify interoperability risks
			expect(Array.isArray(result.interoperabilityRisks)).toBe(true);
			expect(result.interoperabilityRisks.length).toBeGreaterThan(0);

			// Verify recommendations
			expect(Array.isArray(result.crossChainRecommendations)).toBe(true);
			expect(result.crossChainRecommendations.length).toBeGreaterThan(0);
		});

		it("should handle empty platform results", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);

			expect(result).toBeDefined();
			expect(result.bridgeSecurityAssessment?.overallSecurityScore).toBe(0);
			expect(result.interoperabilityRisks).toEqual([]);
			expect(result.crossChainRecommendations.length).toBeGreaterThanOrEqual(0);
		});

		it("should handle single platform results", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);

			expect(result).toBeDefined();
			expect(result.interoperabilityRisks.length).toBe(0);
		});
	});

	describe("analyzeBridgeContracts", () => {
		it("should identify and analyze bridge contracts", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "bridge_lock",
						severity: "high",
						title: "Bridge lock vulnerability",
						description: "Bridge lock mechanism has security issues",
						location: { file: "Bridge.sol", line: 45, column: 10 },
						recommendation: "Implement proper locking",
						confidence: 0.9,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1500,
			});

			const result = await crossChainAnalyzer.analyzeBridgeContracts(
				platformResults
			);

			expect(result).toBeDefined();
			expect(result.overallSecurityScore).toBeGreaterThanOrEqual(0);
			expect(result.overallSecurityScore).toBeLessThanOrEqual(100);
			expect(result.lockingMechanisms).toBeDefined();
			expect(result.messagePassing).toBeDefined();
			expect(result.validatorSets).toBeDefined();
		});

		it("should handle no bridge contracts", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "access_control",
						severity: "medium",
						title: "Access control issue",
						description: "Missing access control",
						location: { file: "Token.sol", line: 25, column: 5 },
						recommendation: "Add access control",
						confidence: 0.8,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			const result = await crossChainAnalyzer.analyzeBridgeContracts(
				platformResults
			);

			expect(result.overallSecurityScore).toBe(0);
		});
	});

	describe("analyzeStateConsistency", () => {
		it("should analyze state consistency across platforms", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "state_variable",
						severity: "medium",
						title: "State variable issue",
						description: "State variable handling issue",
						location: { file: "Contract.sol", line: 30, column: 8 },
						recommendation: "Fix state handling",
						confidence: 0.7,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			platformResults.set("solana", {
				success: true,
				vulnerabilities: [
					{
						type: "storage_issue",
						severity: "low",
						title: "Storage handling",
						description: "Storage handling could be improved",
						location: { file: "program.rs", line: 67, column: 12 },
						recommendation: "Improve storage handling",
						confidence: 0.6,
						source: "static",
						platform: "solana",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 800,
			});

			const result = await crossChainAnalyzer.analyzeStateConsistency(
				platformResults
			);

			expect(result).toBeDefined();
			expect(Array.isArray(result.potentialInconsistencies)).toBe(true);
			expect(Array.isArray(result.recommendations)).toBe(true);
			expect(result.recommendations.length).toBeGreaterThan(0);
		});
	});

	describe("identifyInteroperabilityRisks", () => {
		it("should identify platform compatibility risks", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			platformResults.set("solana", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 800,
			});

			const risks = await crossChainAnalyzer.identifyInteroperabilityRisks(
				platformResults
			);

			expect(Array.isArray(risks)).toBe(true);
			expect(risks.length).toBeGreaterThan(0);

			// Should identify Ethereum-Solana compatibility risk
			const compatibilityRisk = risks.find(
				(risk) => risk.type === "security_model_mismatch"
			);
			expect(compatibilityRisk).toBeDefined();
			expect(compatibilityRisk?.affectedPlatforms).toContain("ethereum");
			expect(compatibilityRisk?.affectedPlatforms).toContain("solana");
		});

		it("should identify Ethereum-Cardano compatibility risks", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			platformResults.set("cardano", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 1200,
			});

			const risks = await crossChainAnalyzer.identifyInteroperabilityRisks(
				platformResults
			);

			const utxoRisk = risks.find(
				(risk) => risk.type === "transaction_model_mismatch"
			);
			expect(utxoRisk).toBeDefined();
			expect(utxoRisk?.severity).toBe("high");
		});

		it("should identify governance risks", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "governance_centralization",
						severity: "high",
						title: "Centralized governance",
						description: "Governance is too centralized",
						location: { file: "Governance.sol", line: 15, column: 5 },
						recommendation: "Decentralize governance",
						confidence: 0.9,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			const risks = await crossChainAnalyzer.identifyInteroperabilityRisks(
				platformResults
			);

			const governanceRisk = risks.find(
				(risk) => risk.type === "governance_centralization"
			);
			expect(governanceRisk).toBeDefined();
		});
	});

	describe("generateCrossChainRecommendations", () => {
		it("should generate recommendations based on risks", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "critical_vuln",
						severity: "critical",
						title: "Critical vulnerability",
						description: "Critical security issue",
						location: { file: "Contract.sol", line: 10, column: 5 },
						recommendation: "Fix immediately",
						confidence: 0.95,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			const interoperabilityRisks: InteroperabilityRisk[] = [
				{
					type: "test_risk",
					severity: "high",
					description: "Test risk description",
					affectedPlatforms: ["ethereum"],
					mitigation: "Test mitigation strategy",
				},
			];

			const recommendations =
				await crossChainAnalyzer.generateCrossChainRecommendations(
					platformResults,
					interoperabilityRisks
				);

			expect(Array.isArray(recommendations)).toBe(true);
			expect(recommendations.length).toBeGreaterThan(0);

			// Should include risk mitigation recommendation
			const riskMitigation = recommendations.find(
				(rec) => rec.category === "risk_mitigation"
			);
			expect(riskMitigation).toBeDefined();

			// Should include platform-specific recommendation for critical vulnerability
			const platformSpecific = recommendations.find(
				(rec) => rec.category === "platform_security"
			);
			expect(platformSpecific).toBeDefined();
			expect(platformSpecific?.priority).toBe("high");
		});

		it("should generate general cross-chain recommendations", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			platformResults.set("solana", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 800,
			});

			const recommendations =
				await crossChainAnalyzer.generateCrossChainRecommendations(
					platformResults,
					[]
				);

			// Should include general recommendations
			const securityRec = recommendations.find(
				(rec) => rec.category === "security"
			);
			expect(securityRec).toBeDefined();

			const testingRec = recommendations.find(
				(rec) => rec.category === "testing"
			);
			expect(testingRec).toBeDefined();

			const docRec = recommendations.find(
				(rec) => rec.category === "documentation"
			);
			expect(docRec).toBeDefined();
		});
	});

	describe("error handling", () => {
		it("should handle analysis errors gracefully", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			// Mock a platform result that might cause issues
			platformResults.set("ethereum", {
				success: false,
				vulnerabilities: [],
				errors: ["Analysis failed"],
				warnings: [],
				executionTime: 0,
			});

			// Should not throw an error
			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);
			expect(result).toBeDefined();
		});
	});

	describe("risk severity sorting", () => {
		it("should sort risks by severity", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			platformResults.set("solana", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 800,
			});

			platformResults.set("cardano", {
				success: true,
				vulnerabilities: [],
				errors: [],
				warnings: [],
				executionTime: 1200,
			});

			const risks = await crossChainAnalyzer.identifyInteroperabilityRisks(
				platformResults
			);

			// Verify risks are sorted by severity (critical > high > medium > low)
			for (let i = 0; i < risks.length - 1; i++) {
				const currentSeverity = risks[i].severity;
				const nextSeverity = risks[i + 1].severity;

				const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
				const currentWeight = severityWeights[currentSeverity];
				const nextWeight = severityWeights[nextSeverity];

				expect(currentWeight).toBeGreaterThanOrEqual(nextWeight);
			}
		});
	});

	describe("recommendation priority sorting", () => {
		it("should sort recommendations by priority", async () => {
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "critical_vuln",
						severity: "critical",
						title: "Critical vulnerability",
						description: "Critical security issue",
						location: { file: "Contract.sol", line: 10, column: 5 },
						recommendation: "Fix immediately",
						confidence: 0.95,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			const interoperabilityRisks: InteroperabilityRisk[] = [
				{
					type: "low_risk",
					severity: "low",
					description: "Low priority risk",
					affectedPlatforms: ["ethereum"],
					mitigation: "Low priority mitigation",
				},
				{
					type: "high_risk",
					severity: "critical",
					description: "High priority risk",
					affectedPlatforms: ["ethereum"],
					mitigation: "High priority mitigation",
				},
			];

			const recommendations =
				await crossChainAnalyzer.generateCrossChainRecommendations(
					platformResults,
					interoperabilityRisks
				);

			// Verify recommendations are sorted by priority (high > medium > low)
			for (let i = 0; i < recommendations.length - 1; i++) {
				const currentPriority = recommendations[i].priority;
				const nextPriority = recommendations[i + 1].priority;

				const priorityWeights = { high: 3, medium: 2, low: 1 };
				const currentWeight =
					priorityWeights[currentPriority as keyof typeof priorityWeights] || 0;
				const nextWeight =
					priorityWeights[nextPriority as keyof typeof priorityWeights] || 0;

				expect(currentWeight).toBeGreaterThanOrEqual(nextWeight);
			}
		});
	});
});
