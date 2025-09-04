import {
	AnalysisResult,
	ContractInput,
	CrossChainAnalysisResult,
	BridgeSecurityResult,
	StateConsistencyResult,
	InteroperabilityRisk,
	CrossChainRecommendation,
	SecurityAssessment,
	ConsistencyIssue,
	PlatformVulnerability,
} from "../../types/blockchain";
import { logger } from "../../utils/logger";
import { AIAnalyzer } from "../AIAnalyzer";

/**
 * CrossChainAnalyzer handles security analysis across multiple blockchain platforms
 * focusing on bridge contracts, state consistency, and interoperability risks
 */
export class CrossChainAnalyzer {
	private aiAnalyzer: AIAnalyzer;

	constructor() {
		this.aiAnalyzer = new AIAnalyzer();
	}

	/**
	 * Perform comprehensive cross-chain analysis
	 */
	async analyzeCrossChain(
		platformResults: Map<string, AnalysisResult>
	): Promise<CrossChainAnalysisResult> {
		logger.info("Starting cross-chain analysis");

		try {
			// Analyze bridge contract security
			const bridgeSecurityAssessment = await this.analyzeBridgeContracts(
				platformResults
			);

			// Analyze state consistency across platforms
			const stateConsistencyAnalysis = await this.analyzeStateConsistency(
				platformResults
			);

			// Identify interoperability risks
			const interoperabilityRisks = await this.identifyInteroperabilityRisks(
				platformResults
			);

			// Generate cross-chain recommendations
			const crossChainRecommendations =
				await this.generateCrossChainRecommendations(
					platformResults,
					interoperabilityRisks
				);

			logger.info("Cross-chain analysis completed successfully");

			return {
				bridgeSecurityAssessment,
				stateConsistencyAnalysis,
				interoperabilityRisks,
				crossChainRecommendations,
			};
		} catch (error) {
			logger.error("Cross-chain analysis failed:", error);
			throw error;
		}
	}

	/**
	 * Analyze bridge contract security across platforms
	 */
	async analyzeBridgeContracts(
		platformResults: Map<string, AnalysisResult>
	): Promise<BridgeSecurityResult> {
		logger.info("Analyzing bridge contract security");

		const bridgeContracts = this.identifyBridgeContracts(platformResults);

		if (bridgeContracts.size === 0) {
			logger.warn("No bridge contracts identified");
			return {
				lockingMechanisms: { score: 0, issues: [], recommendations: [] },
				messagePassing: { score: 0, issues: [], recommendations: [] },
				validatorSets: { score: 0, issues: [], recommendations: [] },
				overallSecurityScore: 0,
			};
		}

		// Analyze locking mechanisms
		const lockingMechanisms = await this.analyzeLockingMechanisms(
			bridgeContracts
		);

		// Analyze message passing security
		const messagePassing = await this.analyzeMessagePassing(bridgeContracts);

		// Analyze validator set security
		const validatorSets = await this.analyzeValidatorSets(bridgeContracts);

		// Calculate overall security score
		const overallSecurityScore = this.calculateBridgeSecurityScore([
			lockingMechanisms,
			messagePassing,
			validatorSets,
		]);

		return {
			lockingMechanisms,
			messagePassing,
			validatorSets,
			overallSecurityScore,
		};
	}

	/**
	 * Analyze state consistency across multiple blockchain deployments
	 */
	async analyzeStateConsistency(
		platformResults: Map<string, AnalysisResult>
	): Promise<StateConsistencyResult> {
		logger.info("Analyzing state consistency across platforms");

		const stateVariables = this.extractStateVariables(platformResults);
		const consistencyIssues = await this.performConsistencyChecks(
			stateVariables
		);

		const recommendations =
			this.generateConsistencyRecommendations(consistencyIssues);

		return {
			potentialInconsistencies: consistencyIssues.filter(
				(issue) => issue.risk > 0.5
			),
			recommendations,
		};
	}

	/**
	 * Identify interoperability risks for cross-chain protocols
	 */
	async identifyInteroperabilityRisks(
		platformResults: Map<string, AnalysisResult>
	): Promise<InteroperabilityRisk[]> {
		logger.info("Identifying interoperability risks");

		const risks: InteroperabilityRisk[] = [];

		// Check for platform-specific vulnerabilities that affect interoperability
		risks.push(...this.checkPlatformCompatibilityRisks(platformResults));

		// Check for timing and finality risks
		risks.push(...this.checkTimingAndFinalityRisks(platformResults));

		// Check for economic security risks
		risks.push(...this.checkEconomicSecurityRisks(platformResults));

		// Check for governance and upgrade risks
		risks.push(...this.checkGovernanceRisks(platformResults));

		// Use AI to identify additional risks
		const aiRisks = await this.identifyAIBasedRisks(platformResults);
		risks.push(...aiRisks);

		return risks.sort(
			(a, b) =>
				this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity)
		);
	}

	/**
	 * Generate cross-chain specific recommendations and security assessments
	 */
	async generateCrossChainRecommendations(
		platformResults: Map<string, AnalysisResult>,
		interoperabilityRisks: InteroperabilityRisk[]
	): Promise<CrossChainRecommendation[]> {
		logger.info("Generating cross-chain recommendations");

		const recommendations: CrossChainRecommendation[] = [];

		// Generate recommendations based on identified risks
		for (const risk of interoperabilityRisks) {
			const recommendation = this.generateRiskMitigationRecommendation(risk);
			if (recommendation) {
				recommendations.push(recommendation);
			}
		}

		// Generate general cross-chain best practices
		recommendations.push(
			...this.generateGeneralCrossChainRecommendations(platformResults)
		);

		// Generate platform-specific recommendations
		recommendations.push(
			...this.generatePlatformSpecificRecommendations(platformResults)
		);

		// Use AI to generate additional recommendations
		const aiRecommendations = await this.generateAIBasedRecommendations(
			platformResults,
			interoperabilityRisks
		);
		recommendations.push(...aiRecommendations);

		return recommendations.sort(
			(a, b) =>
				this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority)
		);
	}

	/**
	 * Identify bridge contracts from analysis results
	 */
	private identifyBridgeContracts(
		platformResults: Map<string, AnalysisResult>
	): Map<string, AnalysisResult> {
		const bridgeContracts = new Map<string, AnalysisResult>();

		for (const [platform, result] of platformResults) {
			// Look for bridge-related vulnerabilities or patterns
			const hasBridgePatterns = result.vulnerabilities.some(
				(vuln) =>
					vuln.type.includes("bridge") ||
					vuln.description.toLowerCase().includes("bridge") ||
					vuln.description.toLowerCase().includes("cross-chain") ||
					vuln.description.toLowerCase().includes("lock") ||
					vuln.description.toLowerCase().includes("mint") ||
					vuln.description.toLowerCase().includes("burn")
			);

			if (hasBridgePatterns) {
				bridgeContracts.set(platform, result);
			}
		}

		return bridgeContracts;
	}

	/**
	 * Analyze locking mechanisms in bridge contracts
	 */
	private async analyzeLockingMechanisms(
		bridgeContracts: Map<string, AnalysisResult>
	): Promise<SecurityAssessment> {
		const issues: string[] = [];
		const recommendations: string[] = [];
		let score = 100;

		for (const [platform, result] of bridgeContracts) {
			// Check for common locking mechanism vulnerabilities
			const lockingVulns = result.vulnerabilities.filter(
				(vuln) =>
					vuln.type.includes("lock") ||
					vuln.description.toLowerCase().includes("lock") ||
					vuln.type.includes("access_control")
			);

			for (const vuln of lockingVulns) {
				if (vuln.severity === "critical" || vuln.severity === "high") {
					issues.push(`${platform}: ${vuln.title} - ${vuln.description}`);
					score -= vuln.severity === "critical" ? 30 : 20;
				}
			}

			// Platform-specific locking mechanism checks
			if (platform === "ethereum") {
				// Check for reentrancy in locking functions
				const reentrancyVulns = result.vulnerabilities.filter((vuln) =>
					vuln.type.includes("reentrancy")
				);
				if (reentrancyVulns.length > 0) {
					issues.push(
						`${platform}: Potential reentrancy in locking mechanisms`
					);
					recommendations.push(
						"Implement reentrancy guards for all locking functions"
					);
					score -= 25;
				}
			}

			if (platform === "solana") {
				// Check for PDA security in locking accounts
				const pdaVulns = result.vulnerabilities.filter(
					(vuln) => vuln.type.includes("pda") || vuln.type.includes("account")
				);
				if (pdaVulns.length > 0) {
					issues.push(`${platform}: PDA security issues in locking accounts`);
					recommendations.push("Ensure proper PDA derivation and validation");
					score -= 20;
				}
			}
		}

		// General recommendations
		if (bridgeContracts.size > 0) {
			recommendations.push(
				"Implement multi-signature requirements for large lock amounts",
				"Add time delays for unlock operations",
				"Implement emergency pause mechanisms"
			);
		}

		return {
			score: Math.max(0, score),
			issues,
			recommendations,
		};
	}

	/**
	 * Analyze message passing security
	 */
	private async analyzeMessagePassing(
		bridgeContracts: Map<string, AnalysisResult>
	): Promise<SecurityAssessment> {
		const issues: string[] = [];
		const recommendations: string[] = [];
		let score = 100;

		for (const [platform, result] of bridgeContracts) {
			// Check for message validation vulnerabilities
			const messageVulns = result.vulnerabilities.filter(
				(vuln) =>
					vuln.description.toLowerCase().includes("message") ||
					vuln.description.toLowerCase().includes("signature") ||
					vuln.description.toLowerCase().includes("validation")
			);

			for (const vuln of messageVulns) {
				if (vuln.severity === "critical" || vuln.severity === "high") {
					issues.push(`${platform}: ${vuln.title} - ${vuln.description}`);
					score -= vuln.severity === "critical" ? 25 : 15;
				}
			}
		}

		// Check for replay attack protection
		const hasReplayProtection = Array.from(bridgeContracts.values()).some(
			(result) =>
				result.vulnerabilities.some(
					(vuln) =>
						vuln.description.toLowerCase().includes("nonce") ||
						vuln.description.toLowerCase().includes("replay")
				)
		);

		if (!hasReplayProtection) {
			issues.push("No explicit replay attack protection detected");
			recommendations.push("Implement nonce-based replay protection");
			score -= 20;
		}

		recommendations.push(
			"Implement cryptographic signature verification",
			"Add message ordering and sequencing",
			"Implement timeout mechanisms for message processing"
		);

		return {
			score: Math.max(0, score),
			issues,
			recommendations,
		};
	}

	/**
	 * Analyze validator set security
	 */
	private async analyzeValidatorSets(
		bridgeContracts: Map<string, AnalysisResult>
	): Promise<SecurityAssessment> {
		const issues: string[] = [];
		const recommendations: string[] = [];
		let score = 100;

		// Check for governance and validator management issues
		for (const [platform, result] of bridgeContracts) {
			const governanceVulns = result.vulnerabilities.filter(
				(vuln) =>
					vuln.type.includes("governance") ||
					vuln.type.includes("admin") ||
					vuln.description.toLowerCase().includes("validator")
			);

			for (const vuln of governanceVulns) {
				if (vuln.severity === "critical" || vuln.severity === "high") {
					issues.push(`${platform}: ${vuln.title} - ${vuln.description}`);
					score -= vuln.severity === "critical" ? 20 : 10;
				}
			}
		}

		recommendations.push(
			"Implement decentralized validator selection",
			"Add slashing mechanisms for malicious validators",
			"Implement validator rotation and diversity requirements"
		);

		return {
			score: Math.max(0, score),
			issues,
			recommendations,
		};
	}

	/**
	 * Calculate overall bridge security score
	 */
	private calculateBridgeSecurityScore(
		assessments: SecurityAssessment[]
	): number {
		if (assessments.length === 0) return 0;

		const totalScore = assessments.reduce(
			(sum, assessment) => sum + assessment.score,
			0
		);
		return Math.round(totalScore / assessments.length);
	}

	/**
	 * Extract state variables from platform results
	 */
	private extractStateVariables(
		platformResults: Map<string, AnalysisResult>
	): Map<string, any[]> {
		const stateVariables = new Map<string, any[]>();

		for (const [platform, result] of platformResults) {
			const variables: any[] = [];

			// Extract state-related information from vulnerabilities
			for (const vuln of result.vulnerabilities) {
				if (
					vuln.description.toLowerCase().includes("state") ||
					vuln.description.toLowerCase().includes("storage") ||
					vuln.description.toLowerCase().includes("variable")
				) {
					variables.push({
						type: vuln.type,
						location: vuln.location,
						description: vuln.description,
					});
				}
			}

			stateVariables.set(platform, variables);
		}

		return stateVariables;
	}

	/**
	 * Perform consistency checks across platforms
	 */
	private async performConsistencyChecks(
		stateVariables: Map<string, any[]>
	): Promise<ConsistencyIssue[]> {
		const issues: ConsistencyIssue[] = [];
		const platforms = Array.from(stateVariables.keys());

		// Check for inconsistent state handling patterns
		for (let i = 0; i < platforms.length; i++) {
			for (let j = i + 1; j < platforms.length; j++) {
				const platform1 = platforms[i];
				const platform2 = platforms[j];
				const vars1 = stateVariables.get(platform1) || [];
				const vars2 = stateVariables.get(platform2) || [];

				// Compare state handling patterns
				const inconsistencies = this.compareStateHandling(vars1, vars2);
				for (const inconsistency of inconsistencies) {
					issues.push({
						description: `State handling inconsistency between ${platform1} and ${platform2}: ${inconsistency}`,
						risk: 0.7,
						affectedPlatforms: [platform1, platform2],
					});
				}
			}
		}

		return issues;
	}

	/**
	 * Compare state handling between two platforms
	 */
	private compareStateHandling(vars1: any[], vars2: any[]): string[] {
		const inconsistencies: string[] = [];

		// Simple heuristic-based comparison
		const types1 = new Set(vars1.map((v) => v.type));
		const types2 = new Set(vars2.map((v) => v.type));

		// Check for missing state handling patterns
		for (const type of types1) {
			if (!types2.has(type)) {
				inconsistencies.push(`Missing ${type} handling in second platform`);
			}
		}

		for (const type of types2) {
			if (!types1.has(type)) {
				inconsistencies.push(`Missing ${type} handling in first platform`);
			}
		}

		return inconsistencies;
	}

	/**
	 * Generate consistency recommendations
	 */
	private generateConsistencyRecommendations(
		issues: ConsistencyIssue[]
	): string[] {
		const recommendations: string[] = [];

		if (issues.length > 0) {
			recommendations.push(
				"Implement consistent state synchronization mechanisms",
				"Add cross-chain state validation checks",
				"Implement atomic cross-chain operations where possible",
				"Add monitoring for state divergence detection"
			);
		}

		return recommendations;
	}

	/**
	 * Check platform compatibility risks
	 */
	private checkPlatformCompatibilityRisks(
		platformResults: Map<string, AnalysisResult>
	): InteroperabilityRisk[] {
		const risks: InteroperabilityRisk[] = [];
		const platforms = Array.from(platformResults.keys());

		// Check for incompatible security models
		if (platforms.includes("ethereum") && platforms.includes("solana")) {
			risks.push({
				type: "security_model_mismatch",
				severity: "medium",
				description:
					"Ethereum's account-based model and Solana's account model have different security assumptions",
				affectedPlatforms: ["ethereum", "solana"],
				mitigation:
					"Implement careful state mapping and validation between account models",
			});
		}

		if (platforms.includes("ethereum") && platforms.includes("cardano")) {
			risks.push({
				type: "transaction_model_mismatch",
				severity: "high",
				description:
					"Ethereum's account-based model and Cardano's UTXO model require careful state synchronization",
				affectedPlatforms: ["ethereum", "cardano"],
				mitigation:
					"Implement robust state mapping between account-based and UTXO models",
			});
		}

		return risks;
	}

	/**
	 * Check timing and finality risks
	 */
	private checkTimingAndFinalityRisks(
		platformResults: Map<string, AnalysisResult>
	): InteroperabilityRisk[] {
		const risks: InteroperabilityRisk[] = [];
		const platforms = Array.from(platformResults.keys());

		if (platforms.length > 1) {
			risks.push({
				type: "finality_timing_mismatch",
				severity: "medium",
				description:
					"Different blockchain platforms have varying block times and finality guarantees",
				affectedPlatforms: platforms,
				mitigation:
					"Implement appropriate waiting periods and confirmation requirements for each platform",
			});
		}

		return risks;
	}

	/**
	 * Check economic security risks
	 */
	private checkEconomicSecurityRisks(
		platformResults: Map<string, AnalysisResult>
	): InteroperabilityRisk[] {
		const risks: InteroperabilityRisk[] = [];
		const platforms = Array.from(platformResults.keys());

		if (platforms.length > 1) {
			risks.push({
				type: "economic_security_disparity",
				severity: "high",
				description:
					"Different platforms may have varying levels of economic security and validator incentives",
				affectedPlatforms: platforms,
				mitigation:
					"Implement security thresholds based on the weakest link in the cross-chain system",
			});
		}

		return risks;
	}

	/**
	 * Check governance risks
	 */
	private checkGovernanceRisks(
		platformResults: Map<string, AnalysisResult>
	): InteroperabilityRisk[] {
		const risks: InteroperabilityRisk[] = [];
		const platforms = Array.from(platformResults.keys());

		// Check for governance-related vulnerabilities
		const hasGovernanceVulns = Array.from(platformResults.values()).some(
			(result) =>
				result.vulnerabilities.some(
					(vuln) =>
						vuln.type.includes("governance") ||
						vuln.type.includes("admin") ||
						vuln.type.includes("upgrade")
				)
		);

		if (hasGovernanceVulns) {
			risks.push({
				type: "governance_centralization",
				severity: "high",
				description:
					"Centralized governance mechanisms pose risks to cross-chain protocol security",
				affectedPlatforms: platforms,
				mitigation:
					"Implement decentralized governance with time delays and multi-signature requirements",
			});
		}

		return risks;
	}

	/**
	 * Use AI to identify additional risks
	 */
	private async identifyAIBasedRisks(
		platformResults: Map<string, AnalysisResult>
	): Promise<InteroperabilityRisk[]> {
		try {
			// For now, return empty array as AI analysis would require more complex integration
			// This can be enhanced later with proper AI model integration
			logger.info("AI-based risk analysis not yet implemented");
			return [];
		} catch (error) {
			logger.warn("AI-based risk analysis failed:", error);
			return [];
		}
	}

	/**
	 * Generate risk mitigation recommendation
	 */
	private generateRiskMitigationRecommendation(
		risk: InteroperabilityRisk
	): CrossChainRecommendation | null {
		return {
			category: "risk_mitigation",
			description: risk.mitigation,
			priority:
				risk.severity === "critical" || risk.severity === "high"
					? "high"
					: "medium",
			platforms: risk.affectedPlatforms,
		};
	}

	/**
	 * Generate general cross-chain recommendations
	 */
	private generateGeneralCrossChainRecommendations(
		platformResults: Map<string, AnalysisResult>
	): CrossChainRecommendation[] {
		const platforms = Array.from(platformResults.keys());

		return [
			{
				category: "security",
				description:
					"Implement comprehensive cross-chain monitoring and alerting systems",
				priority: "high",
				platforms,
			},
			{
				category: "testing",
				description:
					"Conduct thorough cross-chain integration testing with various failure scenarios",
				priority: "high",
				platforms,
			},
			{
				category: "documentation",
				description:
					"Document all cross-chain interactions and failure recovery procedures",
				priority: "medium",
				platforms,
			},
		];
	}

	/**
	 * Generate platform-specific recommendations
	 */
	private generatePlatformSpecificRecommendations(
		platformResults: Map<string, AnalysisResult>
	): CrossChainRecommendation[] {
		const recommendations: CrossChainRecommendation[] = [];

		for (const [platform, result] of platformResults) {
			const criticalVulns = result.vulnerabilities.filter(
				(vuln) => vuln.severity === "critical"
			);

			if (criticalVulns.length > 0) {
				recommendations.push({
					category: "platform_security",
					description: `Address ${criticalVulns.length} critical vulnerabilities in ${platform} before cross-chain deployment`,
					priority: "high",
					platforms: [platform],
				});
			}
		}

		return recommendations;
	}

	/**
	 * Generate AI-based recommendations
	 */
	private async generateAIBasedRecommendations(
		platformResults: Map<string, AnalysisResult>,
		risks: InteroperabilityRisk[]
	): Promise<CrossChainRecommendation[]> {
		try {
			// For now, return empty array as AI analysis would require more complex integration
			// This can be enhanced later with proper AI model integration
			logger.info("AI-based recommendation generation not yet implemented");
			return [];
		} catch (error) {
			logger.warn("AI-based recommendation generation failed:", error);
			return [];
		}
	}

	/**
	 * Build AI prompt for cross-chain risk analysis
	 */
	private buildCrossChainRiskAnalysisPrompt(
		platformResults: Map<string, AnalysisResult>
	): string {
		const platforms = Array.from(platformResults.keys()).join(", ");
		const totalVulns = Array.from(platformResults.values()).reduce(
			(sum, result) => sum + result.vulnerabilities.length,
			0
		);

		return `Analyze cross-chain interoperability risks for a multi-blockchain system involving: ${platforms}.

Total vulnerabilities found: ${totalVulns}

Key vulnerability types across platforms:
${this.summarizeVulnerabilityTypes(platformResults)}

Please identify additional interoperability risks that may not be apparent from individual platform analysis, focusing on:
1. Cross-chain message passing vulnerabilities
2. State synchronization risks
3. Economic attack vectors
4. Governance and upgrade risks
5. Platform-specific interaction risks

Format your response as a JSON array of risk objects with: type, severity, description, affectedPlatforms, mitigation.`;
	}

	/**
	 * Build AI prompt for cross-chain recommendations
	 */
	private buildCrossChainRecommendationPrompt(
		platformResults: Map<string, AnalysisResult>,
		risks: InteroperabilityRisk[]
	): string {
		const platforms = Array.from(platformResults.keys()).join(", ");

		return `Generate cross-chain security recommendations for a multi-blockchain system involving: ${platforms}.

Identified risks:
${risks.map((risk) => `- ${risk.type}: ${risk.description}`).join("\n")}

Please provide specific, actionable recommendations for:
1. Mitigating identified cross-chain risks
2. Implementing robust cross-chain security measures
3. Monitoring and incident response procedures
4. Testing and validation strategies

Format your response as a JSON array of recommendation objects with: category, description, priority, platforms.`;
	}

	/**
	 * Summarize vulnerability types across platforms
	 */
	private summarizeVulnerabilityTypes(
		platformResults: Map<string, AnalysisResult>
	): string {
		const typeCount = new Map<string, number>();

		for (const result of platformResults.values()) {
			for (const vuln of result.vulnerabilities) {
				typeCount.set(vuln.type, (typeCount.get(vuln.type) || 0) + 1);
			}
		}

		return Array.from(typeCount.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([type, count]) => `${type}: ${count}`)
			.join(", ");
	}

	/**
	 * Parse AI risks response
	 */
	private parseAIRisksResponse(response: string): InteroperabilityRisk[] {
		try {
			const parsed = JSON.parse(response);
			if (Array.isArray(parsed)) {
				return parsed.filter(this.isValidRisk);
			}
		} catch (error) {
			logger.warn("Failed to parse AI risks response:", error);
		}
		return [];
	}

	/**
	 * Parse AI recommendations response
	 */
	private parseAIRecommendationsResponse(
		response: string
	): CrossChainRecommendation[] {
		try {
			const parsed = JSON.parse(response);
			if (Array.isArray(parsed)) {
				return parsed.filter(this.isValidRecommendation);
			}
		} catch (error) {
			logger.warn("Failed to parse AI recommendations response:", error);
		}
		return [];
	}

	/**
	 * Validate risk object
	 */
	private isValidRisk(risk: any): risk is InteroperabilityRisk {
		return (
			risk &&
			typeof risk.type === "string" &&
			typeof risk.severity === "string" &&
			typeof risk.description === "string" &&
			Array.isArray(risk.affectedPlatforms) &&
			typeof risk.mitigation === "string"
		);
	}

	/**
	 * Validate recommendation object
	 */
	private isValidRecommendation(rec: any): rec is CrossChainRecommendation {
		return (
			rec &&
			typeof rec.category === "string" &&
			typeof rec.description === "string" &&
			typeof rec.priority === "string" &&
			Array.isArray(rec.platforms)
		);
	}

	/**
	 * Get severity weight for sorting
	 */
	private getSeverityWeight(severity: string): number {
		const weights = { critical: 4, high: 3, medium: 2, low: 1 };
		return weights[severity as keyof typeof weights] || 0;
	}

	/**
	 * Get priority weight for sorting
	 */
	private getPriorityWeight(priority: string): number {
		const weights = { high: 3, medium: 2, low: 1 };
		return weights[priority as keyof typeof weights] || 0;
	}
}
