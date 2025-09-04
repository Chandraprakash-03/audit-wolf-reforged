import { MultiChainAuditModel } from "../models/MultiChainAudit";
import { PlatformVulnerability, CrossChainAnalysis } from "../types/database";
import {
	MultiChainAnalysisResult,
	CrossChainAnalysisResult,
	AnalysisSummary,
} from "../types/blockchain";
import { DatabaseService } from "./database";

export interface MultiChainReportData {
	audit: MultiChainAuditModel;
	platformResults: Map<string, any>;
	crossChainResults?: CrossChainAnalysisResult;
	platformVulnerabilities: Map<string, PlatformVulnerability[]>;
	crossChainAnalysis?: CrossChainAnalysis;
}

export interface MultiChainReport {
	executive_summary: string;
	platform_summary: PlatformSummary[];
	cross_chain_summary?: CrossChainSummary;
	total_vulnerabilities: number;
	vulnerability_breakdown: VulnerabilityBreakdown;
	platform_comparison: PlatformComparison[];
	recommendations: MultiChainRecommendation[];
	generated_at: Date;
}

export interface PlatformSummary {
	platform: string;
	platform_name: string;
	language: string;
	contract_count: number;
	vulnerability_count: number;
	severity_breakdown: Record<string, number>;
	unique_findings: string[];
	platform_specific_metrics?: Record<string, any>;
}

export interface CrossChainSummary {
	bridge_security_score?: number;
	interoperability_risks: number;
	state_consistency_issues: number;
	cross_chain_recommendations: number;
}

export interface VulnerabilityBreakdown {
	by_platform: Record<string, Record<string, number>>;
	by_severity: Record<string, number>;
	by_type: Record<string, number>;
	platform_unique: Record<string, number>;
	cross_platform: number;
}

export interface PlatformComparison {
	metric: string;
	platforms: Record<string, any>;
	winner?: string;
	analysis: string;
}

export interface MultiChainRecommendation {
	category: string;
	priority: "critical" | "high" | "medium" | "low";
	description: string;
	affected_platforms: string[];
	implementation_guide: string;
	cross_chain_impact?: boolean;
}

export interface GeneratedMultiChainReport {
	report: MultiChainReport;
	htmlContent: string;
	metadata: {
		auditId: string;
		auditName: string;
		platforms: string[];
		generatedAt: Date;
		totalPages: number;
	};
}

export class MultiChainReportGenerator {
	/**
	 * Generate a comprehensive multi-blockchain audit report
	 */
	static async generateReport(
		reportData: MultiChainReportData
	): Promise<GeneratedMultiChainReport> {
		const {
			audit,
			platformResults,
			crossChainResults,
			platformVulnerabilities,
		} = reportData;

		// Generate the structured report data
		const report = this.createMultiChainReport(
			audit,
			platformResults,
			crossChainResults,
			platformVulnerabilities
		);

		// Generate HTML content for PDF conversion
		const htmlContent = this.generateHTMLReport(
			report,
			audit,
			platformResults,
			platformVulnerabilities
		);

		// Calculate estimated pages
		const totalPages = this.estimatePageCount(
			audit.platforms.length,
			report.total_vulnerabilities,
			!!crossChainResults
		);

		return {
			report,
			htmlContent,
			metadata: {
				auditId: audit.id,
				auditName: audit.audit_name,
				platforms: audit.platforms,
				generatedAt: new Date(),
				totalPages,
			},
		};
	}

	/**
	 * Create structured multi-chain audit report data
	 */
	private static createMultiChainReport(
		audit: MultiChainAuditModel,
		platformResults: Map<string, any>,
		crossChainResults?: CrossChainAnalysisResult,
		platformVulnerabilities?: Map<string, PlatformVulnerability[]>
	): MultiChainReport {
		const platformSummaries = this.generatePlatformSummaries(
			audit.platforms,
			platformResults,
			platformVulnerabilities
		);

		const vulnerabilityBreakdown = this.calculateVulnerabilityBreakdown(
			platformSummaries,
			platformVulnerabilities
		);

		const platformComparisons = this.generatePlatformComparisons(
			platformSummaries,
			platformResults
		);

		const recommendations = this.generateRecommendationsData(
			platformSummaries,
			crossChainResults,
			platformVulnerabilities
		);

		const executiveSummary = this.generateExecutiveSummary(
			audit,
			platformSummaries,
			vulnerabilityBreakdown,
			crossChainResults
		);

		const crossChainSummary = crossChainResults
			? this.generateCrossChainSummary(crossChainResults)
			: undefined;

		return {
			executive_summary: executiveSummary,
			platform_summary: platformSummaries,
			cross_chain_summary: crossChainSummary,
			total_vulnerabilities:
				vulnerabilityBreakdown.by_severity.critical +
				vulnerabilityBreakdown.by_severity.high +
				vulnerabilityBreakdown.by_severity.medium +
				vulnerabilityBreakdown.by_severity.low +
				vulnerabilityBreakdown.by_severity.informational,
			vulnerability_breakdown: vulnerabilityBreakdown,
			platform_comparison: platformComparisons,
			recommendations,
			generated_at: new Date(),
		};
	}

	/**
	 * Generate platform-specific summaries
	 */
	private static generatePlatformSummaries(
		platforms: string[],
		platformResults: Map<string, any>,
		platformVulnerabilities?: Map<string, PlatformVulnerability[]>
	): PlatformSummary[] {
		return platforms.map((platform) => {
			const result = platformResults.get(platform) || {};
			const vulnerabilities = platformVulnerabilities?.get(platform) || [];

			const severityBreakdown =
				this.calculateSeverityBreakdown(vulnerabilities);
			const uniqueFindings = this.extractUniqueFindings(vulnerabilities);

			return {
				platform,
				platform_name: this.getPlatformDisplayName(platform),
				language: this.getPlatformLanguage(platform),
				contract_count: result.contractCount || 0,
				vulnerability_count: vulnerabilities.length,
				severity_breakdown: severityBreakdown,
				unique_findings: uniqueFindings,
				platform_specific_metrics: result.platformSpecific || {},
			};
		});
	}

	/**
	 * Calculate vulnerability breakdown across platforms
	 */
	private static calculateVulnerabilityBreakdown(
		platformSummaries: PlatformSummary[],
		platformVulnerabilities?: Map<string, PlatformVulnerability[]>
	): VulnerabilityBreakdown {
		const byPlatform: Record<string, Record<string, number>> = {};
		const bySeverity: Record<string, number> = {
			critical: 0,
			high: 0,
			medium: 0,
			low: 0,
			informational: 0,
		};
		const byType: Record<string, number> = {};
		const platformUnique: Record<string, number> = {};

		// Calculate platform-specific breakdowns
		platformSummaries.forEach((summary) => {
			byPlatform[summary.platform] = summary.severity_breakdown;
			platformUnique[summary.platform] = summary.unique_findings.length;

			// Aggregate severity counts
			Object.entries(summary.severity_breakdown).forEach(
				([severity, count]) => {
					bySeverity[severity] = (bySeverity[severity] || 0) + count;
				}
			);
		});

		// Calculate type breakdown
		if (platformVulnerabilities) {
			platformVulnerabilities.forEach((vulnerabilities) => {
				vulnerabilities.forEach((vuln) => {
					byType[vuln.vulnerability_type] =
						(byType[vuln.vulnerability_type] || 0) + 1;
				});
			});
		}

		return {
			by_platform: byPlatform,
			by_severity: bySeverity,
			by_type: byType,
			platform_unique: platformUnique,
			cross_platform: 0, // TODO: Calculate cross-platform vulnerabilities
		};
	}

	/**
	 * Generate platform comparisons
	 */
	private static generatePlatformComparisons(
		platformSummaries: PlatformSummary[],
		platformResults: Map<string, any>
	): PlatformComparison[] {
		const comparisons: PlatformComparison[] = [];

		// Security Score Comparison
		const securityScores: Record<string, number> = {};
		platformSummaries.forEach((summary) => {
			const criticalCount = summary.severity_breakdown.critical || 0;
			const highCount = summary.severity_breakdown.high || 0;
			const totalVulns = summary.vulnerability_count;

			// Simple security score calculation (higher is better)
			securityScores[summary.platform] = Math.max(
				0,
				100 - (criticalCount * 20 + highCount * 10 + totalVulns * 2)
			);
		});

		const bestSecurityPlatform = Object.entries(securityScores).sort(
			([, a], [, b]) => b - a
		)[0]?.[0];

		comparisons.push({
			metric: "Security Score",
			platforms: securityScores,
			winner: bestSecurityPlatform,
			analysis: `${this.getPlatformDisplayName(
				bestSecurityPlatform
			)} shows the highest security score with fewer critical vulnerabilities.`,
		});

		// Vulnerability Density Comparison
		const vulnerabilityDensity: Record<string, number> = {};
		platformSummaries.forEach((summary) => {
			vulnerabilityDensity[summary.platform] =
				summary.contract_count > 0
					? summary.vulnerability_count / summary.contract_count
					: 0;
		});

		const lowestDensityPlatform = Object.entries(vulnerabilityDensity).sort(
			([, a], [, b]) => a - b
		)[0]?.[0];

		comparisons.push({
			metric: "Vulnerability Density",
			platforms: vulnerabilityDensity,
			winner: lowestDensityPlatform,
			analysis: `${this.getPlatformDisplayName(
				lowestDensityPlatform
			)} has the lowest vulnerability density per contract.`,
		});

		return comparisons;
	}

	/**
	 * Generate executive summary
	 */
	private static generateExecutiveSummary(
		audit: MultiChainAuditModel,
		platformSummaries: PlatformSummary[],
		vulnerabilityBreakdown: VulnerabilityBreakdown,
		crossChainResults?: CrossChainAnalysisResult
	): string {
		const totalVulns =
			vulnerabilityBreakdown.by_severity.critical +
			vulnerabilityBreakdown.by_severity.high +
			vulnerabilityBreakdown.by_severity.medium +
			vulnerabilityBreakdown.by_severity.low +
			vulnerabilityBreakdown.by_severity.informational;

		const criticalAndHigh =
			vulnerabilityBreakdown.by_severity.critical +
			vulnerabilityBreakdown.by_severity.high;

		let summary = `This multi-blockchain audit report presents comprehensive security analysis across ${
			audit.platforms.length
		} blockchain platforms: ${audit.platforms
			.map((p) => this.getPlatformDisplayName(p))
			.join(", ")}. `;

		if (totalVulns === 0) {
			summary += `No security vulnerabilities were identified across any of the analyzed platforms. `;
		} else {
			summary += `A total of ${totalVulns} potential issues were identified across all platforms, `;

			if (criticalAndHigh > 0) {
				summary += `including ${criticalAndHigh} critical or high-severity vulnerabilities requiring immediate attention. `;
			} else {
				summary += `with the majority being medium to low severity issues. `;
			}
		}

		// Platform-specific insights
		const mostSecurePlatform = platformSummaries.reduce((prev, current) =>
			prev.vulnerability_count < current.vulnerability_count ? prev : current
		);

		if (platformSummaries.length > 1) {
			summary += `${mostSecurePlatform.platform_name} demonstrated the strongest security posture with ${mostSecurePlatform.vulnerability_count} issues identified. `;
		}

		// Cross-chain analysis
		if (crossChainResults) {
			const riskCount = crossChainResults.interoperabilityRisks?.length || 0;
			if (riskCount > 0) {
				summary += `Cross-chain analysis identified ${riskCount} interoperability risks that require attention for secure multi-blockchain deployment. `;
			} else {
				summary += `Cross-chain analysis found no significant interoperability risks between the analyzed platforms. `;
			}
		}

		summary += `This report provides platform-specific findings, comparative analysis, and unified recommendations to enhance security across the entire multi-blockchain ecosystem.`;

		return summary;
	}

	/**
	 * Generate cross-chain summary
	 */
	private static generateCrossChainSummary(
		crossChainResults: CrossChainAnalysisResult
	): CrossChainSummary {
		return {
			bridge_security_score:
				crossChainResults.bridgeSecurityAssessment?.overallSecurityScore,
			interoperability_risks:
				crossChainResults.interoperabilityRisks?.length || 0,
			state_consistency_issues:
				crossChainResults.stateConsistencyAnalysis?.potentialInconsistencies
					?.length || 0,
			cross_chain_recommendations:
				crossChainResults.crossChainRecommendations?.length || 0,
		};
	}

	/**
	 * Generate multi-chain recommendations data
	 */
	private static generateRecommendationsData(
		platformSummaries: PlatformSummary[],
		crossChainResults?: CrossChainAnalysisResult,
		platformVulnerabilities?: Map<string, PlatformVulnerability[]>
	): MultiChainRecommendation[] {
		const recommendations: MultiChainRecommendation[] = [];

		// Cross-platform security recommendations
		const commonVulnTypes = this.findCommonVulnerabilityTypes(
			platformVulnerabilities
		);
		commonVulnTypes.forEach((vulnType) => {
			const affectedPlatforms = this.getPlatformsWithVulnType(
				vulnType,
				platformVulnerabilities
			);

			recommendations.push({
				category: "Cross-Platform Security",
				priority: this.getVulnTypePriority(vulnType),
				description: `${vulnType} vulnerabilities found across multiple platforms`,
				affected_platforms: affectedPlatforms,
				implementation_guide: this.getVulnTypeRemediation(vulnType),
				cross_chain_impact: true,
			});
		});

		// Platform-specific recommendations
		platformSummaries.forEach((summary) => {
			if (summary.vulnerability_count > 0) {
				const topVulnType = summary.unique_findings[0];
				if (topVulnType) {
					recommendations.push({
						category: `${summary.platform_name} Security`,
						priority: "high",
						description: `Address ${topVulnType} issues specific to ${summary.platform_name}`,
						affected_platforms: [summary.platform],
						implementation_guide: this.getPlatformSpecificRemediation(
							summary.platform,
							topVulnType
						),
						cross_chain_impact: false,
					});
				}
			}
		});

		// Cross-chain specific recommendations
		if (crossChainResults) {
			crossChainResults.crossChainRecommendations?.forEach((rec) => {
				recommendations.push({
					category: "Cross-Chain Security",
					priority: rec.priority,
					description: rec.description,
					affected_platforms: rec.platforms,
					implementation_guide: `Implement cross-chain security measures: ${rec.description}`,
					cross_chain_impact: true,
				});
			});
		}

		return recommendations.sort((a, b) => {
			const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
			return priorityOrder[b.priority] - priorityOrder[a.priority];
		});
	}

	/**
	 * Helper methods for data processing
	 */
	private static calculateSeverityBreakdown(
		vulnerabilities: PlatformVulnerability[]
	): Record<string, number> {
		return vulnerabilities.reduce(
			(counts, vuln) => {
				counts[vuln.severity] = (counts[vuln.severity] || 0) + 1;
				return counts;
			},
			{ critical: 0, high: 0, medium: 0, low: 0, informational: 0 }
		);
	}

	private static extractUniqueFindings(
		vulnerabilities: PlatformVulnerability[]
	): string[] {
		const typeCount = vulnerabilities.reduce((counts, vuln) => {
			counts[vuln.vulnerability_type] =
				(counts[vuln.vulnerability_type] || 0) + 1;
			return counts;
		}, {} as Record<string, number>);

		return Object.entries(typeCount)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5)
			.map(([type]) => type);
	}

	private static findCommonVulnerabilityTypes(
		platformVulnerabilities?: Map<string, PlatformVulnerability[]>
	): string[] {
		if (!platformVulnerabilities) return [];

		const typesByPlatform = new Map<string, Set<string>>();

		platformVulnerabilities.forEach((vulns, platform) => {
			const types = new Set(vulns.map((v) => v.vulnerability_type));
			typesByPlatform.set(platform, types);
		});

		const allTypes = new Set<string>();
		typesByPlatform.forEach((types) => {
			types.forEach((type) => allTypes.add(type));
		});

		return Array.from(allTypes).filter((type) => {
			let platformCount = 0;
			typesByPlatform.forEach((types) => {
				if (types.has(type)) platformCount++;
			});
			return platformCount > 1; // Found in multiple platforms
		});
	}

	private static getPlatformsWithVulnType(
		vulnType: string,
		platformVulnerabilities?: Map<string, PlatformVulnerability[]>
	): string[] {
		if (!platformVulnerabilities) return [];

		const platforms: string[] = [];
		platformVulnerabilities.forEach((vulns, platform) => {
			if (vulns.some((v) => v.vulnerability_type === vulnType)) {
				platforms.push(platform);
			}
		});
		return platforms;
	}

	private static getVulnTypePriority(
		vulnType: string
	): "critical" | "high" | "medium" | "low" {
		const criticalTypes = ["reentrancy", "overflow", "access_control"];
		const highTypes = ["security", "validation"];
		const mediumTypes = ["best_practice", "optimization"];

		if (criticalTypes.includes(vulnType)) return "critical";
		if (highTypes.includes(vulnType)) return "high";
		if (mediumTypes.includes(vulnType)) return "medium";
		return "low";
	}

	private static getVulnTypeRemediation(vulnType: string): string {
		const remediations: Record<string, string> = {
			reentrancy:
				"Implement reentrancy guards and follow checks-effects-interactions pattern",
			overflow: "Use safe math libraries and proper bounds checking",
			access_control: "Implement proper role-based access control mechanisms",
			security: "Follow platform-specific security best practices",
			validation: "Add comprehensive input validation and sanitization",
		};
		return (
			remediations[vulnType] ||
			"Follow security best practices for this vulnerability type"
		);
	}

	private static getPlatformSpecificRemediation(
		platform: string,
		vulnType: string
	): string {
		const platformRemediations: Record<string, Record<string, string>> = {
			ethereum: {
				reentrancy: "Use OpenZeppelin ReentrancyGuard modifier",
				overflow: "Upgrade to Solidity 0.8+ or use SafeMath library",
			},
			solana: {
				security: "Follow Anchor framework security guidelines",
				validation: "Implement proper account validation in Rust",
			},
			cardano: {
				validation: "Use Plutus validators with proper datum checking",
				security: "Follow eUTXO model security patterns",
			},
		};

		return (
			platformRemediations[platform]?.[vulnType] ||
			`Follow ${this.getPlatformDisplayName(
				platform
			)}-specific security guidelines`
		);
	}

	private static getPlatformDisplayName(platform: string): string {
		const displayNames: Record<string, string> = {
			ethereum: "Ethereum",
			solana: "Solana",
			cardano: "Cardano",
			polygon: "Polygon",
			bsc: "Binance Smart Chain",
			avalanche: "Avalanche",
		};
		return (
			displayNames[platform] ||
			platform.charAt(0).toUpperCase() + platform.slice(1)
		);
	}

	private static getPlatformLanguage(platform: string): string {
		const languages: Record<string, string> = {
			ethereum: "Solidity",
			solana: "Rust",
			cardano: "Plutus",
			polygon: "Solidity",
			bsc: "Solidity",
			avalanche: "Solidity",
		};
		return languages[platform] || "Unknown";
	}

	/**
	 * Estimate page count for multi-chain PDF
	 */
	private static estimatePageCount(
		platformCount: number,
		vulnCount: number,
		hasCrossChain: boolean
	): number {
		// Base pages: cover, executive summary, platform overview
		let pages = 4;

		// Platform summaries: ~1 page per platform
		pages += platformCount;

		// Vulnerabilities: ~2-3 per page
		pages += Math.ceil(vulnCount / 2.5);

		// Platform comparisons: ~2 pages
		pages += 2;

		// Cross-chain analysis if present
		if (hasCrossChain) {
			pages += 3;
		}

		// Recommendations and appendix
		pages += 2;

		return Math.max(pages, 8); // Minimum 8 pages for multi-chain
	}

	/**
	 * Generate HTML content for multi-chain PDF
	 */
	private static generateHTMLReport(
		report: MultiChainReport,
		audit: MultiChainAuditModel,
		platformResults: Map<string, any>,
		platformVulnerabilities?: Map<string, PlatformVulnerability[]>
	): string {
		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Blockchain Audit Report - ${audit.audit_name}</title>
    <style>
        ${this.getMultiChainReportCSS()}
    </style>
</head>
<body>
    ${this.generateMultiChainCoverPage(audit, report)}
    ${this.generateMultiChainExecutiveSummary(report)}
    ${this.generatePlatformOverview(report.platform_summary)}
    ${this.generatePlatformComparison(report.platform_comparison)}
    ${this.generatePlatformDetails(
			report.platform_summary,
			platformVulnerabilities
		)}
    ${
			report.cross_chain_summary
				? this.generateCrossChainAnalysis(report.cross_chain_summary)
				: ""
		}
    ${this.generateMultiChainRecommendations(report.recommendations)}
    ${this.generateMultiChainAppendix(audit, report)}
</body>
</html>`;
	}

	/**
	 * Generate CSS styles for multi-chain report
	 */
	private static getMultiChainReportCSS(): string {
		return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
        }

        .page {
            min-height: 100vh;
            padding: 40px;
            page-break-after: always;
        }

        .page:last-child {
            page-break-after: avoid;
        }

        .cover-page {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .cover-title {
            font-size: 3rem;
            font-weight: bold;
            margin-bottom: 1rem;
        }

        .cover-subtitle {
            font-size: 1.5rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }

        .platform-badges {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 1rem;
            margin: 2rem 0;
        }

        .platform-badge {
            background: rgba(255, 255, 255, 0.2);
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            backdrop-filter: blur(10px);
        }

        h1 {
            font-size: 2.5rem;
            color: #2c3e50;
            margin-bottom: 1.5rem;
            border-bottom: 3px solid #3498db;
            padding-bottom: 0.5rem;
        }

        h2 {
            font-size: 2rem;
            color: #34495e;
            margin: 2rem 0 1rem 0;
            border-left: 4px solid #3498db;
            padding-left: 1rem;
        }

        h3 {
            font-size: 1.5rem;
            color: #2c3e50;
            margin: 1.5rem 0 0.5rem 0;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }

        .summary-card {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 1.5rem;
            text-align: center;
        }

        .summary-number {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }

        .summary-label {
            font-size: 0.9rem;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .platform-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin: 2rem 0;
        }

        .platform-card {
            background: #fff;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .platform-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .platform-name {
            font-size: 1.3rem;
            font-weight: bold;
            color: #2c3e50;
        }

        .platform-language {
            background: #3498db;
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.8rem;
        }

        .platform-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin: 1rem 0;
        }

        .metric {
            text-align: center;
        }

        .metric-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #3498db;
        }

        .metric-label {
            font-size: 0.8rem;
            color: #6c757d;
        }

        .severity-breakdown {
            display: flex;
            justify-content: space-between;
            margin: 1rem 0;
        }

        .severity-item {
            text-align: center;
            flex: 1;
        }

        .severity-count {
            font-weight: bold;
            font-size: 1.2rem;
        }

        .severity-critical { color: #dc3545; }
        .severity-high { color: #fd7e14; }
        .severity-medium { color: #ffc107; }
        .severity-low { color: #28a745; }
        .severity-informational { color: #17a2b8; }

        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .comparison-table th,
        .comparison-table td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }

        .comparison-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }

        .winner {
            background: #d4edda;
            font-weight: bold;
            color: #155724;
        }

        .vulnerability-section {
            margin: 2rem 0;
        }

        .vulnerability {
            background: #fff;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin: 1rem 0;
            overflow: hidden;
        }

        .vulnerability-header {
            padding: 1rem 1.5rem;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .vulnerability-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 0;
        }

        .severity-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            color: white;
        }

        .severity-badge.critical { background: #dc3545; }
        .severity-badge.high { background: #fd7e14; }
        .severity-badge.medium { background: #ffc107; color: #212529; }
        .severity-badge.low { background: #28a745; }
        .severity-badge.informational { background: #17a2b8; }

        .vulnerability-content {
            padding: 1.5rem;
        }

        .cross-chain-section {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            border-radius: 12px;
            padding: 2rem;
            margin: 2rem 0;
        }

        .cross-chain-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 1rem 0;
        }

        .cross-chain-metric {
            background: rgba(255, 255, 255, 0.2);
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
            backdrop-filter: blur(10px);
        }

        .recommendation {
            background: #fff;
            border-left: 4px solid #28a745;
            border-radius: 8px;
            padding: 1.5rem;
            margin: 1rem 0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .recommendation.critical { border-left-color: #dc3545; }
        .recommendation.high { border-left-color: #fd7e14; }
        .recommendation.medium { border-left-color: #ffc107; }
        .recommendation.low { border-left-color: #28a745; }

        .recommendation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .recommendation-title {
            font-weight: 600;
            font-size: 1.1rem;
        }

        .priority-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .priority-badge.critical { background: #dc3545; color: white; }
        .priority-badge.high { background: #fd7e14; color: white; }
        .priority-badge.medium { background: #ffc107; color: #212529; }
        .priority-badge.low { background: #28a745; color: white; }

        .affected-platforms {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin: 0.5rem 0;
        }

        .platform-tag {
            background: #e9ecef;
            padding: 0.25rem 0.5rem;
            border-radius: 10px;
            font-size: 0.8rem;
        }

        @media print {
            .page {
                page-break-after: always;
            }
            
            .platform-card,
            .vulnerability,
            .recommendation {
                page-break-inside: avoid;
            }
        }
        `;
	}

	/**
	 * Generate multi-chain cover page
	 */
	private static generateMultiChainCoverPage(
		audit: MultiChainAuditModel,
		report: MultiChainReport
	): string {
		const platformBadges = audit.platforms
			.map(
				(platform) =>
					`<div class="platform-badge">${this.getPlatformDisplayName(
						platform
					)}</div>`
			)
			.join("");

		return `
        <div class="page cover-page">
            <div class="cover-title">Multi-Blockchain Audit Report</div>
            <div class="cover-subtitle">${audit.audit_name}</div>
            <div class="platform-badges">
                ${platformBadges}
            </div>
            <div class="cover-info">
                <p>Generated on ${report.generated_at.toLocaleDateString()}</p>
                <p>Platforms Analyzed: ${audit.platforms.length}</p>
                <p>Total Vulnerabilities: ${report.total_vulnerabilities}</p>
            </div>
        </div>
        `;
	}

	/**
	 * Generate multi-chain executive summary
	 */
	private static generateMultiChainExecutiveSummary(
		report: MultiChainReport
	): string {
		return `
        <div class="page">
            <h1>Executive Summary</h1>
            <p>${report.executive_summary}</p>
            
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-number">${report.total_vulnerabilities}</div>
                    <div class="summary-label">Total Issues</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${report.platform_summary.length}</div>
                    <div class="summary-label">Platforms</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number severity-critical">${report.vulnerability_breakdown.by_severity.critical}</div>
                    <div class="summary-label">Critical</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number severity-high">${report.vulnerability_breakdown.by_severity.high}</div>
                    <div class="summary-label">High</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number severity-medium">${report.vulnerability_breakdown.by_severity.medium}</div>
                    <div class="summary-label">Medium</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number severity-low">${report.vulnerability_breakdown.by_severity.low}</div>
                    <div class="summary-label">Low</div>
                </div>
            </div>
        </div>
        `;
	}

	/**
	 * Generate platform overview section
	 */
	private static generatePlatformOverview(
		platformSummaries: PlatformSummary[]
	): string {
		const platformCards = platformSummaries
			.map(
				(summary) => `
            <div class="platform-card">
                <div class="platform-header">
                    <div class="platform-name">${summary.platform_name}</div>
                    <div class="platform-language">${summary.language}</div>
                </div>
                <div class="platform-metrics">
                    <div class="metric">
                        <div class="metric-value">${
													summary.contract_count
												}</div>
                        <div class="metric-label">Contracts</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${
													summary.vulnerability_count
												}</div>
                        <div class="metric-label">Issues</div>
                    </div>
                </div>
                <div class="severity-breakdown">
                    <div class="severity-item">
                        <div class="severity-count severity-critical">${
													summary.severity_breakdown.critical || 0
												}</div>
                        <div class="metric-label">Critical</div>
                    </div>
                    <div class="severity-item">
                        <div class="severity-count severity-high">${
													summary.severity_breakdown.high || 0
												}</div>
                        <div class="metric-label">High</div>
                    </div>
                    <div class="severity-item">
                        <div class="severity-count severity-medium">${
													summary.severity_breakdown.medium || 0
												}</div>
                        <div class="metric-label">Medium</div>
                    </div>
                    <div class="severity-item">
                        <div class="severity-count severity-low">${
													summary.severity_breakdown.low || 0
												}</div>
                        <div class="metric-label">Low</div>
                    </div>
                </div>
            </div>
        `
			)
			.join("");

		return `
        <div class="page">
            <h1>Platform Overview</h1>
            <div class="platform-overview">
                ${platformCards}
            </div>
        </div>
        `;
	}

	/**
	 * Generate platform comparison section
	 */
	private static generatePlatformComparison(
		comparisons: PlatformComparison[]
	): string {
		const comparisonTables = comparisons
			.map((comparison) => {
				const rows = Object.entries(comparison.platforms)
					.map(([platform, value]) => {
						const isWinner = platform === comparison.winner;
						return `
                <tr ${isWinner ? 'class="winner"' : ""}>
                    <td>${this.getPlatformDisplayName(platform)}</td>
                    <td>${
											typeof value === "number" ? value.toFixed(2) : value
										}</td>
                </tr>
                `;
					})
					.join("");

				return `
            <h3>${comparison.metric}</h3>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Platform</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <p><strong>Analysis:</strong> ${comparison.analysis}</p>
            `;
			})
			.join("");

		return `
        <div class="page">
            <h1>Platform Comparison</h1>
            ${comparisonTables}
        </div>
        `;
	}

	/**
	 * Generate platform-specific details
	 */
	private static generatePlatformDetails(
		platformSummaries: PlatformSummary[],
		platformVulnerabilities?: Map<string, PlatformVulnerability[]>
	): string {
		const platformSections = platformSummaries
			.map((summary) => {
				const vulnerabilities =
					platformVulnerabilities?.get(summary.platform) || [];
				const topVulnerabilities = vulnerabilities.slice(0, 5); // Show top 5 per platform

				const vulnHTML = topVulnerabilities
					.map(
						(vuln) => `
                <div class="vulnerability">
                    <div class="vulnerability-header">
                        <h4 class="vulnerability-title">${vuln.title}</h4>
                        <span class="severity-badge ${vuln.severity}">${vuln.severity}</span>
                    </div>
                    <div class="vulnerability-content">
                        <p>${vuln.description}</p>
                        <p><strong>Location:</strong> ${vuln.location.file}:${vuln.location.line}</p>
                        <p><strong>Recommendation:</strong> ${vuln.recommendation}</p>
                    </div>
                </div>
            `
					)
					.join("");

				return `
            <div class="vulnerability-section">
                <h2>${summary.platform_name} Detailed Analysis</h2>
                <p>Language: ${summary.language} | Contracts: ${
					summary.contract_count
				} | Issues: ${summary.vulnerability_count}</p>
                ${vulnHTML}
                ${
									vulnerabilities.length > 5
										? `<p><em>... and ${
												vulnerabilities.length - 5
										  } more issues</em></p>`
										: ""
								}
            </div>
            `;
			})
			.join("");

		return `
        <div class="page">
            <h1>Platform-Specific Findings</h1>
            ${platformSections}
        </div>
        `;
	}

	/**
	 * Generate cross-chain analysis section
	 */
	private static generateCrossChainAnalysis(
		crossChainSummary: CrossChainSummary
	): string {
		return `
        <div class="page">
            <div class="cross-chain-section">
                <h1 style="color: white;">Cross-Chain Analysis</h1>
                <div class="cross-chain-metrics">
                    <div class="cross-chain-metric">
                        <div class="metric-value">${
													crossChainSummary.bridge_security_score?.toFixed(1) ||
													"N/A"
												}</div>
                        <div class="metric-label">Bridge Security Score</div>
                    </div>
                    <div class="cross-chain-metric">
                        <div class="metric-value">${
													crossChainSummary.interoperability_risks
												}</div>
                        <div class="metric-label">Interoperability Risks</div>
                    </div>
                    <div class="cross-chain-metric">
                        <div class="metric-value">${
													crossChainSummary.state_consistency_issues
												}</div>
                        <div class="metric-label">Consistency Issues</div>
                    </div>
                    <div class="cross-chain-metric">
                        <div class="metric-value">${
													crossChainSummary.cross_chain_recommendations
												}</div>
                        <div class="metric-label">Recommendations</div>
                    </div>
                </div>
            </div>
        </div>
        `;
	}

	/**
	 * Generate multi-chain recommendations section
	 */
	private static generateMultiChainRecommendations(
		recommendations: MultiChainRecommendation[]
	): string {
		const recHTML = recommendations
			.map((rec) => {
				const platformTags = rec.affected_platforms
					.map(
						(platform) =>
							`<span class="platform-tag">${this.getPlatformDisplayName(
								platform
							)}</span>`
					)
					.join("");

				return `
            <div class="recommendation ${rec.priority}">
                <div class="recommendation-header">
                    <div class="recommendation-title">${rec.category}</div>
                    <span class="priority-badge ${rec.priority}">${
					rec.priority
				}</span>
                </div>
                <p><strong>Description:</strong> ${rec.description}</p>
                <p><strong>Implementation:</strong> ${
									rec.implementation_guide
								}</p>
                <div class="affected-platforms">
                    <strong>Affected Platforms:</strong> ${platformTags}
                </div>
                ${
									rec.cross_chain_impact
										? "<p><em>⚠️ Cross-chain impact detected</em></p>"
										: ""
								}
            </div>
            `;
			})
			.join("");

		return `
        <div class="page">
            <h1>Multi-Chain Recommendations</h1>
            ${recHTML}
        </div>
        `;
	}

	/**
	 * Generate multi-chain appendix
	 */
	private static generateMultiChainAppendix(
		audit: MultiChainAuditModel,
		report: MultiChainReport
	): string {
		return `
        <div class="page">
            <h1>Appendix</h1>
            
            <h2>Audit Information</h2>
            <table class="comparison-table">
                <tr><td><strong>Audit Name</strong></td><td>${
									audit.audit_name
								}</td></tr>
                <tr><td><strong>Platforms</strong></td><td>${audit.platforms.join(
									", "
								)}</td></tr>
                <tr><td><strong>Cross-Chain Analysis</strong></td><td>${
									audit.cross_chain_analysis ? "Yes" : "No"
								}</td></tr>
                <tr><td><strong>Created</strong></td><td>${audit.created_at.toLocaleDateString()}</td></tr>
                <tr><td><strong>Completed</strong></td><td>${
									audit.completed_at?.toLocaleDateString() || "N/A"
								}</td></tr>
            </table>
            
            <h2>Vulnerability Summary by Type</h2>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Vulnerability Type</th>
                        <th>Count</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(report.vulnerability_breakdown.by_type)
											.map(([type, count]) => {
												const percentage =
													report.total_vulnerabilities > 0
														? (
																(count / report.total_vulnerabilities) *
																100
														  ).toFixed(1)
														: "0.0";
												return `
                        <tr>
                            <td>${type}</td>
                            <td>${count}</td>
                            <td>${percentage}%</td>
                        </tr>
                        `;
											})
											.join("")}
                </tbody>
            </table>
            
            <h2>Methodology</h2>
            <p>This multi-blockchain audit was conducted using platform-specific analysis tools and AI models:</p>
            <ul>
                <li><strong>Static Analysis:</strong> Platform-specific tools (Slither for Ethereum, Clippy for Solana, etc.)</li>
                <li><strong>AI Analysis:</strong> Blockchain-specific machine learning models</li>
                <li><strong>Cross-Chain Analysis:</strong> Interoperability and bridge security assessment</li>
                <li><strong>Comparative Analysis:</strong> Security posture comparison across platforms</li>
            </ul>
            
            <p style="margin-top: 2rem; font-size: 0.9rem; color: #6c757d;">
                This report was generated by Audit Wolf - Multi-Blockchain Security Platform
            </p>
        </div>
        `;
	}
}
