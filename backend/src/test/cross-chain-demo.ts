#!/usr/bin/env ts-node

/**
 * Cross-Chain Analysis Demonstration
 *
 * This script demonstrates the CrossChainAnalyzer capabilities
 * by analyzing sample contracts from different blockchain platforms.
 */

import { CrossChainAnalyzer } from "../services/analyzers/CrossChainAnalyzer";
import { AnalysisResult, PlatformVulnerability } from "../types/blockchain";

// Sample contract vulnerabilities for demonstration
const createSampleVulnerabilities = (
	platform: string
): PlatformVulnerability[] => {
	const baseVulns: PlatformVulnerability[] = [];

	if (platform === "ethereum") {
		baseVulns.push(
			{
				type: "bridge_reentrancy",
				severity: "critical",
				title: "Reentrancy vulnerability in bridge lock function",
				description:
					"The bridge lock function is vulnerable to reentrancy attacks, allowing attackers to drain funds",
				location: { file: "EthereumBridge.sol", line: 45, column: 10 },
				recommendation:
					"Implement reentrancy guards using OpenZeppelin's ReentrancyGuard",
				confidence: 0.95,
				source: "static",
				platform: "ethereum",
			},
			{
				type: "governance_centralization",
				severity: "high",
				title: "Centralized bridge governance",
				description:
					"Bridge governance is controlled by a single admin address with no timelock",
				location: { file: "EthereumBridge.sol", line: 78, column: 5 },
				recommendation:
					"Implement decentralized governance with multi-signature and timelock",
				confidence: 0.88,
				source: "static",
				platform: "ethereum",
			},
			{
				type: "message_validation",
				severity: "medium",
				title: "Insufficient cross-chain message validation",
				description:
					"Cross-chain messages lack proper cryptographic signature verification",
				location: { file: "EthereumBridge.sol", line: 120, column: 15 },
				recommendation:
					"Implement ECDSA signature verification for all cross-chain messages",
				confidence: 0.82,
				source: "static",
				platform: "ethereum",
			}
		);
	}

	if (platform === "solana") {
		baseVulns.push(
			{
				type: "pda_bridge_security",
				severity: "high",
				title: "Insecure PDA derivation in bridge program",
				description:
					"Bridge program uses predictable seeds for PDA derivation, allowing unauthorized access",
				location: { file: "solana_bridge.rs", line: 123, column: 15 },
				recommendation:
					"Use unpredictable seeds and implement proper PDA validation",
				confidence: 0.9,
				source: "static",
				platform: "solana",
			},
			{
				type: "account_validation",
				severity: "medium",
				title: "Missing account ownership validation",
				description:
					"Bridge program doesn't validate account ownership before processing",
				location: { file: "solana_bridge.rs", line: 200, column: 8 },
				recommendation:
					"Add comprehensive account ownership and signer validation",
				confidence: 0.85,
				source: "static",
				platform: "solana",
			}
		);
	}

	if (platform === "cardano") {
		baseVulns.push(
			{
				type: "utxo_validation",
				severity: "high",
				title: "UTXO validation in cross-chain context",
				description:
					"UTXO validation doesn't properly account for cross-chain state changes",
				location: { file: "cardano_bridge.hs", line: 89, column: 20 },
				recommendation:
					"Implement comprehensive cross-chain state validation for UTXO handling",
				confidence: 0.87,
				source: "static",
				platform: "cardano",
			},
			{
				type: "datum_security",
				severity: "medium",
				title: "Datum validation security issue",
				description:
					"Datum validation lacks proper type checking for cross-chain data",
				location: { file: "cardano_bridge.hs", line: 156, column: 12 },
				recommendation:
					"Add strict type checking and validation for all datum fields",
				confidence: 0.8,
				source: "static",
				platform: "cardano",
			}
		);
	}

	return baseVulns;
};

// Create sample analysis results
const createSampleAnalysisResults = (): Map<string, AnalysisResult> => {
	const results = new Map<string, AnalysisResult>();

	// Ethereum analysis result
	results.set("ethereum", {
		success: true,
		vulnerabilities: createSampleVulnerabilities("ethereum"),
		errors: [],
		warnings: ["Consider upgrading to Solidity 0.8.19 for better security"],
		executionTime: 1500,
	});

	// Solana analysis result
	results.set("solana", {
		success: true,
		vulnerabilities: createSampleVulnerabilities("solana"),
		errors: [],
		warnings: ["Consider using latest Anchor framework version"],
		executionTime: 1200,
	});

	// Cardano analysis result
	results.set("cardano", {
		success: true,
		vulnerabilities: createSampleVulnerabilities("cardano"),
		errors: [],
		warnings: ["Consider optimizing Plutus script efficiency"],
		executionTime: 1600,
	});

	return results;
};

// Demonstration function
async function demonstrateCrossChainAnalysis() {
	console.log("🔗 Cross-Chain Security Analysis Demonstration");
	console.log("=".repeat(50));
	console.log();

	// Create CrossChainAnalyzer instance
	const crossChainAnalyzer = new CrossChainAnalyzer();

	// Create sample platform analysis results
	const platformResults = createSampleAnalysisResults();

	console.log("📊 Platform Analysis Results:");
	for (const [platform, result] of platformResults) {
		console.log(`  ${platform.toUpperCase()}:`);
		console.log(`    ✅ Success: ${result.success}`);
		console.log(`    🐛 Vulnerabilities: ${result.vulnerabilities.length}`);
		console.log(`    ⚠️  Warnings: ${result.warnings.length}`);
		console.log(`    ⏱️  Execution Time: ${result.executionTime}ms`);
		console.log();
	}

	console.log("🔍 Starting Cross-Chain Analysis...");
	console.log();

	try {
		// Perform cross-chain analysis
		const startTime = Date.now();
		const crossChainResult = await crossChainAnalyzer.analyzeCrossChain(
			platformResults
		);
		const analysisTime = Date.now() - startTime;

		console.log("✅ Cross-Chain Analysis Completed!");
		console.log(`⏱️  Total Analysis Time: ${analysisTime}ms`);
		console.log();

		// Display Bridge Security Assessment
		console.log("🌉 Bridge Security Assessment:");
		if (crossChainResult.bridgeSecurityAssessment) {
			const bridge = crossChainResult.bridgeSecurityAssessment;
			console.log(
				`  Overall Security Score: ${bridge.overallSecurityScore}/100`
			);
			console.log(
				`  Locking Mechanisms Score: ${bridge.lockingMechanisms.score}/100`
			);
			console.log(
				`  Message Passing Score: ${bridge.messagePassing.score}/100`
			);
			console.log(`  Validator Sets Score: ${bridge.validatorSets.score}/100`);

			if (bridge.lockingMechanisms.issues.length > 0) {
				console.log("  🚨 Locking Mechanism Issues:");
				bridge.lockingMechanisms.issues.forEach((issue) => {
					console.log(`    - ${issue}`);
				});
			}
		}
		console.log();

		// Display State Consistency Analysis
		console.log("🔄 State Consistency Analysis:");
		if (crossChainResult.stateConsistencyAnalysis) {
			const consistency = crossChainResult.stateConsistencyAnalysis;
			console.log(
				`  Potential Inconsistencies: ${consistency.potentialInconsistencies.length}`
			);

			consistency.potentialInconsistencies.forEach((inconsistency, index) => {
				console.log(`    ${index + 1}. ${inconsistency.description}`);
				console.log(
					`       Risk Level: ${(inconsistency.risk * 100).toFixed(1)}%`
				);
				console.log(
					`       Affected Platforms: ${inconsistency.affectedPlatforms.join(
						", "
					)}`
				);
			});

			if (consistency.recommendations.length > 0) {
				console.log("  💡 Recommendations:");
				consistency.recommendations.forEach((rec) => {
					console.log(`    - ${rec}`);
				});
			}
		}
		console.log();

		// Display Interoperability Risks
		console.log("⚠️  Interoperability Risks:");
		crossChainResult.interoperabilityRisks.forEach((risk, index) => {
			const severityEmoji =
				{
					critical: "🔴",
					high: "🟠",
					medium: "🟡",
					low: "🟢",
				}[risk.severity] || "⚪";

			console.log(
				`  ${index + 1}. ${severityEmoji} ${risk.type.toUpperCase()} (${
					risk.severity
				})`
			);
			console.log(`     Description: ${risk.description}`);
			console.log(
				`     Affected Platforms: ${risk.affectedPlatforms.join(", ")}`
			);
			console.log(`     Mitigation: ${risk.mitigation}`);
			console.log();
		});

		// Display Cross-Chain Recommendations
		console.log("💡 Cross-Chain Recommendations:");
		const groupedRecommendations =
			crossChainResult.crossChainRecommendations.reduce((acc, rec) => {
				if (!acc[rec.category]) acc[rec.category] = [];
				acc[rec.category].push(rec);
				return acc;
			}, {} as Record<string, typeof crossChainResult.crossChainRecommendations>);

		for (const [category, recommendations] of Object.entries(
			groupedRecommendations
		)) {
			console.log(`  📂 ${category.toUpperCase()}:`);
			recommendations.forEach((rec) => {
				const priorityEmoji =
					{
						high: "🔴",
						medium: "🟡",
						low: "🟢",
					}[rec.priority] || "⚪";

				console.log(`    ${priorityEmoji} ${rec.description}`);
				console.log(`       Priority: ${rec.priority}`);
				console.log(`       Platforms: ${rec.platforms.join(", ")}`);
			});
			console.log();
		}

		// Summary Statistics
		console.log("📈 Analysis Summary:");
		console.log(`  Total Platforms Analyzed: ${platformResults.size}`);
		console.log(
			`  Total Vulnerabilities Found: ${Array.from(
				platformResults.values()
			).reduce((sum, result) => sum + result.vulnerabilities.length, 0)}`
		);
		console.log(
			`  Bridge Security Score: ${
				crossChainResult.bridgeSecurityAssessment?.overallSecurityScore || 0
			}/100`
		);
		console.log(
			`  Interoperability Risks: ${crossChainResult.interoperabilityRisks.length}`
		);
		console.log(
			`  Cross-Chain Recommendations: ${crossChainResult.crossChainRecommendations.length}`
		);
		console.log(
			`  State Inconsistencies: ${
				crossChainResult.stateConsistencyAnalysis?.potentialInconsistencies
					.length || 0
			}`
		);

		// Risk Distribution
		const riskDistribution = crossChainResult.interoperabilityRisks.reduce(
			(acc, risk) => {
				acc[risk.severity] = (acc[risk.severity] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>
		);

		console.log();
		console.log("🎯 Risk Distribution:");
		Object.entries(riskDistribution).forEach(([severity, count]) => {
			const percentage = (
				(count / crossChainResult.interoperabilityRisks.length) *
				100
			).toFixed(1);
			console.log(`  ${severity.toUpperCase()}: ${count} (${percentage}%)`);
		});
	} catch (error) {
		console.error("❌ Cross-Chain Analysis Failed:", error);
	}

	console.log();
	console.log("🎉 Demonstration Complete!");
}

// Run the demonstration
if (require.main === module) {
	demonstrateCrossChainAnalysis().catch(console.error);
}

export { demonstrateCrossChainAnalysis };
