import { MultiChainAnalysisOrchestrator } from "../services/MultiChainAnalysisOrchestrator";
import { WebSocketService } from "../services/WebSocketService";
import { CrossChainAnalyzer } from "../services/analyzers/CrossChainAnalyzer";
import { AnalyzerFactory } from "../services/analyzers/AnalyzerFactory";
import {
	MultiChainAnalysisRequest,
	ContractInput,
	AnalysisResult,
	CrossChainAnalysisResult,
} from "../types/blockchain";

// Mock WebSocket service
jest.mock("../services/WebSocketService");
jest.mock("../services/database");
jest.mock("../models/MultiChainAudit");
jest.mock("../config/queue");

describe("Cross-Chain Integration Tests", () => {
	let orchestrator: MultiChainAnalysisOrchestrator;
	let mockWebSocketService: jest.Mocked<WebSocketService>;

	beforeEach(() => {
		// Mock WebSocketService properly
		mockWebSocketService = {
			notifyMultiChainProgress: jest.fn(),
			notifyAuditProgress: jest.fn(),
			notifyAuditComplete: jest.fn(),
			notifyError: jest.fn(),
		} as any;
		orchestrator = new MultiChainAnalysisOrchestrator(mockWebSocketService);
	});

	describe("CrossChainAnalyzer Integration", () => {
		it("should create CrossChainAnalyzer instance", () => {
			const crossChainAnalyzer = AnalyzerFactory.getCrossChainAnalyzer();
			expect(crossChainAnalyzer).toBeInstanceOf(CrossChainAnalyzer);
		});

		it("should perform cross-chain analysis with multiple platforms", async () => {
			const crossChainAnalyzer = new CrossChainAnalyzer();

			const platformResults = new Map<string, AnalysisResult>();

			// Mock Ethereum results with bridge-related vulnerabilities
			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "bridge_lock_vulnerability",
						severity: "high",
						title: "Insecure bridge locking mechanism",
						description:
							"The bridge locking function lacks proper access controls and reentrancy protection",
						location: { file: "EthereumBridge.sol", line: 45, column: 10 },
						recommendation:
							"Implement reentrancy guards and multi-signature requirements",
						confidence: 0.9,
						source: "static",
						platform: "ethereum",
					},
					{
						type: "governance_centralization",
						severity: "medium",
						title: "Centralized bridge governance",
						description:
							"Bridge governance is controlled by a single admin address",
						location: { file: "EthereumBridge.sol", line: 78, column: 5 },
						recommendation: "Implement decentralized governance with timelock",
						confidence: 0.8,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1500,
			});

			// Mock Solana results with cross-chain related issues
			platformResults.set("solana", {
				success: true,
				vulnerabilities: [
					{
						type: "pda_bridge_security",
						severity: "high",
						title: "Insecure PDA derivation in bridge program",
						description:
							"Bridge program uses predictable seeds for PDA derivation",
						location: { file: "solana_bridge.rs", line: 123, column: 15 },
						recommendation: "Use unpredictable seeds and proper validation",
						confidence: 0.85,
						source: "static",
						platform: "solana",
					},
					{
						type: "message_validation",
						severity: "medium",
						title: "Insufficient cross-chain message validation",
						description:
							"Cross-chain messages lack proper signature verification",
						location: { file: "solana_bridge.rs", line: 200, column: 8 },
						recommendation: "Implement cryptographic signature verification",
						confidence: 0.75,
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

			// Verify comprehensive cross-chain analysis
			expect(result).toBeDefined();
			expect(result.bridgeSecurityAssessment).toBeDefined();
			expect(result.stateConsistencyAnalysis).toBeDefined();
			expect(result.interoperabilityRisks).toBeDefined();
			expect(result.crossChainRecommendations).toBeDefined();

			// Verify bridge security assessment
			expect(
				result.bridgeSecurityAssessment?.overallSecurityScore
			).toBeGreaterThan(0);
			expect(result.bridgeSecurityAssessment?.lockingMechanisms).toBeDefined();
			expect(result.bridgeSecurityAssessment?.messagePassing).toBeDefined();
			expect(result.bridgeSecurityAssessment?.validatorSets).toBeDefined();

			// Verify interoperability risks include platform compatibility
			expect(result.interoperabilityRisks.length).toBeGreaterThan(0);
			const compatibilityRisk = result.interoperabilityRisks.find(
				(risk) => risk.type === "security_model_mismatch"
			);
			expect(compatibilityRisk).toBeDefined();
			expect(compatibilityRisk?.affectedPlatforms).toContain("ethereum");
			expect(compatibilityRisk?.affectedPlatforms).toContain("solana");

			// Verify recommendations are generated
			expect(result.crossChainRecommendations.length).toBeGreaterThan(0);
			const securityRecommendation = result.crossChainRecommendations.find(
				(rec) => rec.category === "security"
			);
			expect(securityRecommendation).toBeDefined();
		});

		it("should handle Ethereum-Cardano cross-chain analysis", async () => {
			const crossChainAnalyzer = new CrossChainAnalyzer();

			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "state_synchronization",
						severity: "high",
						title: "State synchronization issue",
						description:
							"Account state not properly synchronized with UTXO model",
						location: { file: "EthCardanoBridge.sol", line: 67, column: 12 },
						recommendation: "Implement proper state mapping between models",
						confidence: 0.88,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1400,
			});

			platformResults.set("cardano", {
				success: true,
				vulnerabilities: [
					{
						type: "utxo_validation",
						severity: "medium",
						title: "UTXO validation in cross-chain context",
						description:
							"UTXO validation doesn't account for Ethereum state changes",
						location: { file: "cardano_bridge.hs", line: 89, column: 20 },
						recommendation: "Add cross-chain state validation",
						confidence: 0.82,
						source: "static",
						platform: "cardano",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1600,
			});

			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);

			// Should identify transaction model mismatch
			const modelMismatch = result.interoperabilityRisks.find(
				(risk) => risk.type === "transaction_model_mismatch"
			);
			expect(modelMismatch).toBeDefined();
			expect(modelMismatch?.severity).toBe("high");
			expect(modelMismatch?.affectedPlatforms).toContain("ethereum");
			expect(modelMismatch?.affectedPlatforms).toContain("cardano");

			// Should have state consistency analysis
			expect(
				result.stateConsistencyAnalysis?.potentialInconsistencies
			).toBeDefined();
			expect(result.stateConsistencyAnalysis?.recommendations).toBeDefined();
		});

		it("should generate appropriate recommendations for high-risk scenarios", async () => {
			const crossChainAnalyzer = new CrossChainAnalyzer();

			const platformResults = new Map<string, AnalysisResult>();

			// High-risk scenario with critical vulnerabilities
			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "critical_bridge_exploit",
						severity: "critical",
						title: "Critical bridge exploit vulnerability",
						description: "Bridge contract allows unauthorized fund withdrawal",
						location: { file: "Bridge.sol", line: 25, column: 8 },
						recommendation: "Immediately patch the withdrawal function",
						confidence: 0.95,
						source: "static",
						platform: "ethereum",
					},
					{
						type: "governance_takeover",
						severity: "critical",
						title: "Governance takeover risk",
						description: "Single point of failure in governance system",
						location: { file: "Governance.sol", line: 15, column: 5 },
						recommendation: "Implement multi-signature governance",
						confidence: 0.92,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 1000,
			});

			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);

			// Should generate high-priority recommendations for critical vulnerabilities
			const highPriorityRecs = result.crossChainRecommendations.filter(
				(rec) => rec.priority === "high"
			);
			expect(highPriorityRecs.length).toBeGreaterThan(0);

			// Should include platform-specific security recommendation
			const platformSecurityRec = result.crossChainRecommendations.find(
				(rec) => rec.category === "platform_security"
			);
			expect(platformSecurityRec).toBeDefined();
			expect(platformSecurityRec?.priority).toBe("high");

			// Should identify governance risks
			const governanceRisk = result.interoperabilityRisks.find(
				(risk) => risk.type === "governance_centralization"
			);
			expect(governanceRisk).toBeDefined();
		});

		it("should handle analysis with no bridge contracts", async () => {
			const crossChainAnalyzer = new CrossChainAnalyzer();

			const platformResults = new Map<string, AnalysisResult>();

			// Regular contracts without bridge functionality
			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "access_control",
						severity: "medium",
						title: "Missing access control",
						description: "Function lacks proper access control",
						location: { file: "Token.sol", line: 30, column: 5 },
						recommendation: "Add access control modifiers",
						confidence: 0.8,
						source: "static",
						platform: "ethereum",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 800,
			});

			platformResults.set("solana", {
				success: true,
				vulnerabilities: [
					{
						type: "account_validation",
						severity: "low",
						title: "Account validation issue",
						description: "Account validation could be improved",
						location: { file: "program.rs", line: 45, column: 10 },
						recommendation: "Enhance account validation",
						confidence: 0.7,
						source: "static",
						platform: "solana",
					},
				],
				errors: [],
				warnings: [],
				executionTime: 600,
			});

			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);

			// Bridge security assessment should reflect no bridge contracts
			expect(result.bridgeSecurityAssessment?.overallSecurityScore).toBe(0);

			// Should still identify platform compatibility risks
			expect(result.interoperabilityRisks.length).toBeGreaterThan(0);

			// Should still provide general cross-chain recommendations
			expect(result.crossChainRecommendations.length).toBeGreaterThan(0);
		});

		it("should properly sort risks and recommendations", async () => {
			const crossChainAnalyzer = new CrossChainAnalyzer();

			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: true,
				vulnerabilities: [
					{
						type: "critical_issue",
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

			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);

			// Verify risks are sorted by severity (critical > high > medium > low)
			for (let i = 0; i < result.interoperabilityRisks.length - 1; i++) {
				const currentSeverity = result.interoperabilityRisks[i].severity;
				const nextSeverity = result.interoperabilityRisks[i + 1].severity;

				const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
				const currentWeight = severityWeights[currentSeverity];
				const nextWeight = severityWeights[nextSeverity];

				expect(currentWeight).toBeGreaterThanOrEqual(nextWeight);
			}

			// Verify recommendations are sorted by priority (high > medium > low)
			for (let i = 0; i < result.crossChainRecommendations.length - 1; i++) {
				const currentPriority = result.crossChainRecommendations[i].priority;
				const nextPriority = result.crossChainRecommendations[i + 1].priority;

				const priorityWeights = { high: 3, medium: 2, low: 1 };
				const currentWeight =
					priorityWeights[currentPriority as keyof typeof priorityWeights] || 0;
				const nextWeight =
					priorityWeights[nextPriority as keyof typeof priorityWeights] || 0;

				expect(currentWeight).toBeGreaterThanOrEqual(nextWeight);
			}
		});
	});

	describe("Error Handling", () => {
		it("should handle cross-chain analysis errors gracefully", async () => {
			const crossChainAnalyzer = new CrossChainAnalyzer();

			// Mock platform results that might cause issues
			const platformResults = new Map<string, AnalysisResult>();

			platformResults.set("ethereum", {
				success: false,
				vulnerabilities: [],
				errors: ["Analysis failed due to compilation error"],
				warnings: [],
				executionTime: 0,
			});

			// Should not throw an error even with failed platform analysis
			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);
			expect(result).toBeDefined();
			expect(result.bridgeSecurityAssessment).toBeDefined();
			expect(result.stateConsistencyAnalysis).toBeDefined();
			expect(result.interoperabilityRisks).toBeDefined();
			expect(result.crossChainRecommendations).toBeDefined();
		});
	});

	describe("Performance", () => {
		it("should complete cross-chain analysis within reasonable time", async () => {
			const crossChainAnalyzer = new CrossChainAnalyzer();

			const platformResults = new Map<string, AnalysisResult>();

			// Add multiple platforms with various vulnerabilities
			for (const platform of ["ethereum", "solana", "cardano"]) {
				platformResults.set(platform, {
					success: true,
					vulnerabilities: Array.from({ length: 10 }, (_, i) => ({
						type: `vulnerability_${i}`,
						severity: ["critical", "high", "medium", "low"][i % 4] as any,
						title: `Vulnerability ${i}`,
						description: `Description for vulnerability ${i}`,
						location: {
							file: `contract_${platform}.ext`,
							line: i + 1,
							column: 1,
						},
						recommendation: `Fix vulnerability ${i}`,
						confidence: 0.8,
						source: "static" as const,
						platform,
					})),
					errors: [],
					warnings: [],
					executionTime: 1000,
				});
			}

			const startTime = Date.now();
			const result = await crossChainAnalyzer.analyzeCrossChain(
				platformResults
			);
			const executionTime = Date.now() - startTime;

			expect(result).toBeDefined();
			expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
		});
	});
});
