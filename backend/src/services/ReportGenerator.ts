import { AuditModel } from "../models/Audit";
import { ContractModel } from "../models/Contract";
import { VulnerabilityModel } from "../models/Vulnerability";
import { MultiChainAuditModel } from "../models/MultiChainAudit";
import {
	AuditReport,
	GasOptimization,
	SecurityRecommendation,
} from "../types/database";
import { MultiChainReportGenerator } from "./MultiChainReportGenerator";
import { MultiChainAuditReportService } from "./MultiChainAuditReportService";

export interface ReportData {
	audit: AuditModel;
	contract: ContractModel;
	vulnerabilities: VulnerabilityModel[];
}

export interface GeneratedReport {
	report: AuditReport;
	htmlContent: string;
	metadata: {
		auditId: string;
		contractName: string;
		generatedAt: Date;
		totalPages: number;
	};
}

export class ReportGenerator {
	/**
	 * Factory method to determine report type and generate appropriate report
	 */
	static async generateReportForAudit(
		auditId: string,
		format: "html" | "pdf" | "both" = "both"
	): Promise<any> {
		// Check if it's a multi-chain audit
		const multiChainAudit = await MultiChainAuditModel.findById(auditId);
		if (multiChainAudit) {
			return MultiChainAuditReportService.generateMultiChainAuditReport({
				auditId,
				format,
				reportType: "standard",
			});
		}

		// Fall back to single-chain audit
		const audit = await AuditModel.findById(auditId);
		if (!audit) {
			throw new Error("Audit not found");
		}

		const contract = await ContractModel.findById(audit.contract_id);
		if (!contract) {
			throw new Error("Contract not found");
		}

		const vulnerabilities = await VulnerabilityModel.findByAuditId(auditId);

		return this.generateReport({ audit, contract, vulnerabilities });
	}

	/**
	 * Generate a comprehensive audit report
	 */
	static async generateReport(
		reportData: ReportData
	): Promise<GeneratedReport> {
		const { audit, contract, vulnerabilities } = reportData;

		// Generate the structured report data
		const report = this.createAuditReport(audit, vulnerabilities);

		// Generate HTML content for PDF conversion
		const htmlContent = this.generateHTMLReport(
			report,
			contract,
			vulnerabilities
		);

		// Calculate estimated pages (rough estimate based on content)
		const totalPages = this.estimatePageCount(
			vulnerabilities.length,
			report.gas_optimizations.length
		);

		return {
			report,
			htmlContent,
			metadata: {
				auditId: audit.id,
				contractName: contract.name,
				generatedAt: new Date(),
				totalPages,
			},
		};
	}

	/**
	 * Create structured audit report data
	 */
	private static createAuditReport(
		audit: AuditModel,
		vulnerabilities: VulnerabilityModel[]
	): AuditReport {
		const severityCounts = this.calculateSeverityCounts(vulnerabilities);
		const gasOptimizations = this.extractGasOptimizations(audit);
		const recommendations = this.generateRecommendations(
			vulnerabilities,
			audit
		);
		const executiveSummary = this.generateExecutiveSummary(
			severityCounts,
			gasOptimizations.length
		);

		return {
			executive_summary: executiveSummary,
			total_vulnerabilities: vulnerabilities.length,
			critical_count: severityCounts.critical,
			high_count: severityCounts.high,
			medium_count: severityCounts.medium,
			low_count: severityCounts.low,
			informational_count: severityCounts.informational,
			gas_optimizations: gasOptimizations,
			recommendations: recommendations,
			generated_at: new Date(),
		};
	}

	/**
	 * Calculate vulnerability counts by severity
	 */
	private static calculateSeverityCounts(
		vulnerabilities: VulnerabilityModel[]
	) {
		return vulnerabilities.reduce(
			(counts, vuln) => {
				counts[vuln.severity]++;
				return counts;
			},
			{ critical: 0, high: 0, medium: 0, low: 0, informational: 0 }
		);
	}

	/**
	 * Extract gas optimizations from audit results
	 */
	private static extractGasOptimizations(audit: AuditModel): GasOptimization[] {
		const gasOptimizations: GasOptimization[] = [];

		// From static analysis results
		if (audit.static_results?.gas_analysis) {
			gasOptimizations.push(...audit.static_results.gas_analysis);
		}

		// From AI analysis results (if any gas-related vulnerabilities)
		if (audit.ai_results?.vulnerabilities) {
			const gasVulns = audit.ai_results.vulnerabilities.filter(
				(v) => v.type === "gas_optimization"
			);
			gasVulns.forEach((vuln) => {
				gasOptimizations.push({
					type: vuln.type,
					description: vuln.description,
					location: vuln.location,
					estimated_savings: this.estimateGasSavings(vuln.description),
				});
			});
		}

		return gasOptimizations;
	}

	/**
	 * Estimate gas savings based on optimization description
	 */
	private static estimateGasSavings(description: string): number {
		// Simple heuristic for gas savings estimation
		const lowerDesc = description.toLowerCase();

		if (lowerDesc.includes("loop") || lowerDesc.includes("iteration"))
			return 500;
		if (lowerDesc.includes("storage") || lowerDesc.includes("sstore"))
			return 2000;
		if (lowerDesc.includes("external call") || lowerDesc.includes("call"))
			return 300;
		if (lowerDesc.includes("memory") || lowerDesc.includes("mstore"))
			return 100;
		if (lowerDesc.includes("constant") || lowerDesc.includes("immutable"))
			return 200;

		return 150; // Default estimate
	}

	/**
	 * Generate security recommendations
	 */
	private static generateRecommendations(
		vulnerabilities: VulnerabilityModel[],
		audit: AuditModel
	): SecurityRecommendation[] {
		const recommendations: SecurityRecommendation[] = [];

		// Add recommendations from AI analysis if available
		if (audit.ai_results?.recommendations) {
			recommendations.push(...audit.ai_results.recommendations);
		}

		// Generate additional recommendations based on vulnerability patterns
		const vulnTypes = new Set(vulnerabilities.map((v) => v.type));

		if (vulnTypes.has("reentrancy")) {
			recommendations.push({
				category: "Reentrancy Protection",
				priority: "high",
				description: "Implement reentrancy guards for all external calls",
				implementation_guide:
					"Use OpenZeppelin's ReentrancyGuard modifier or implement checks-effects-interactions pattern",
			});
		}

		if (vulnTypes.has("access_control")) {
			recommendations.push({
				category: "Access Control",
				priority: "high",
				description: "Implement proper role-based access control",
				implementation_guide:
					"Use OpenZeppelin's AccessControl or Ownable contracts for permission management",
			});
		}

		if (vulnTypes.has("overflow")) {
			recommendations.push({
				category: "Integer Safety",
				priority: "medium",
				description:
					"Use SafeMath library or Solidity 0.8+ built-in overflow protection",
				implementation_guide:
					"Upgrade to Solidity 0.8+ or use OpenZeppelin's SafeMath library for arithmetic operations",
			});
		}

		return recommendations;
	}

	/**
	 * Generate executive summary
	 */
	private static generateExecutiveSummary(
		severityCounts: any,
		gasOptimizationCount: number
	): string {
		const totalVulns = Object.values(severityCounts).reduce(
			(sum: number, count: any) => sum + count,
			0
		);
		const criticalAndHigh = severityCounts.critical + severityCounts.high;

		let summary = `This audit report presents the findings from a comprehensive security analysis of the smart contract. `;

		if (totalVulns === 0) {
			summary += `No security vulnerabilities were identified during the analysis. `;
		} else {
			summary += `A total of ${totalVulns} potential issues were identified, `;

			if (criticalAndHigh > 0) {
				summary += `including ${criticalAndHigh} critical or high-severity vulnerabilities that require immediate attention. `;
			} else {
				summary += `with the majority being medium to low severity issues. `;
			}
		}

		if (gasOptimizationCount > 0) {
			summary += `Additionally, ${gasOptimizationCount} gas optimization opportunities were identified that could reduce transaction costs. `;
		}

		summary += `All findings include detailed descriptions, code locations, and remediation recommendations to help improve the contract's security posture.`;

		return summary;
	}

	/**
	 * Estimate page count for PDF
	 */
	private static estimatePageCount(
		vulnCount: number,
		gasOptCount: number
	): number {
		// Base pages: cover, summary, methodology
		let pages = 3;

		// Vulnerabilities: ~2-3 per page depending on complexity
		pages += Math.ceil(vulnCount / 2.5);

		// Gas optimizations: ~3-4 per page
		pages += Math.ceil(gasOptCount / 3.5);

		// Recommendations and appendix
		pages += 2;

		return Math.max(pages, 5); // Minimum 5 pages
	} /**
	 * 
Generate HTML content for PDF conversion
	 */
	private static generateHTMLReport(
		report: AuditReport,
		contract: ContractModel,
		vulnerabilities: VulnerabilityModel[]
	): string {
		const sortedVulns = VulnerabilityModel.sortBySeverity(vulnerabilities);
		const vulnsBySeverity = VulnerabilityModel.groupBySeverity(vulnerabilities);

		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Contract Audit Report - ${contract.name}</title>
    <style>
        ${this.getReportCSS()}
    </style>
</head>
<body>
    ${this.generateCoverPage(contract, report)}
    ${this.generateExecutiveSummaryHTML(report)}
    ${this.generateVulnerabilityOverview(report, vulnsBySeverity)}
    ${this.generateVulnerabilityDetails(sortedVulns)}
    ${this.generateGasOptimizations(report.gas_optimizations)}
    ${this.generateRecommendationsHTML(report.recommendations)}
    ${this.generateAppendix(contract)}
</body>
</html>`;
	}

	/**
	 * Generate CSS styles for the report
	 */
	private static getReportCSS(): string {
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

        .cover-info {
            font-size: 1.1rem;
            opacity: 0.8;
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

        .severity-critical { color: #dc3545; }
        .severity-high { color: #fd7e14; }
        .severity-medium { color: #ffc107; }
        .severity-low { color: #28a745; }
        .severity-informational { color: #17a2b8; }

        .vulnerability {
            background: #fff;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin: 1.5rem 0;
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
            font-size: 1.2rem;
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

        .vulnerability-description {
            margin-bottom: 1rem;
            line-height: 1.7;
        }

        .code-location {
            background: #f1f3f4;
            border: 1px solid #dadce0;
            border-radius: 4px;
            padding: 0.75rem;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            margin: 1rem 0;
        }

        .recommendation {
            background: #e8f5e8;
            border-left: 4px solid #28a745;
            padding: 1rem;
            margin: 1rem 0;
        }

        .recommendation-title {
            font-weight: 600;
            color: #155724;
            margin-bottom: 0.5rem;
        }

        .gas-optimization {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 1.5rem;
            margin: 1rem 0;
        }

        .gas-savings {
            font-weight: bold;
            color: #856404;
            float: right;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }

        .table th,
        .table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }

        .table th {
            background: #f8f9fa;
            font-weight: 600;
        }

        .confidence-score {
            display: inline-block;
            padding: 0.2rem 0.5rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .confidence-high { background: #d4edda; color: #155724; }
        .confidence-medium { background: #fff3cd; color: #856404; }
        .confidence-low { background: #f8d7da; color: #721c24; }

        @media print {
            .page {
                page-break-after: always;
            }
            
            .vulnerability {
                page-break-inside: avoid;
            }
        }
        `;
	}

	/**
	 * Generate cover page HTML
	 */
	private static generateCoverPage(
		contract: ContractModel,
		report: AuditReport
	): string {
		return `
        <div class="page cover-page">
            <div class="cover-title">Smart Contract Audit Report</div>
            <div class="cover-subtitle">${contract.name}</div>
            <div class="cover-info">
                <p>Generated on ${report.generated_at.toLocaleDateString()}</p>
                <p>Contract Hash: ${contract.file_hash.substring(0, 16)}...</p>
                <p>Compiler Version: ${contract.compiler_version}</p>
            </div>
        </div>
        `;
	}

	/**
	 * Generate executive summary HTML
	 */
	private static generateExecutiveSummaryHTML(report: AuditReport): string {
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
                    <div class="summary-number severity-critical">${report.critical_count}</div>
                    <div class="summary-label">Critical</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number severity-high">${report.high_count}</div>
                    <div class="summary-label">High</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number severity-medium">${report.medium_count}</div>
                    <div class="summary-label">Medium</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number severity-low">${report.low_count}</div>
                    <div class="summary-label">Low</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number severity-informational">${report.informational_count}</div>
                    <div class="summary-label">Informational</div>
                </div>
            </div>
        </div>
        `;
	}

	/**
	 * Generate vulnerability overview HTML
	 */
	private static generateVulnerabilityOverview(
		report: AuditReport,
		vulnsBySeverity: Record<string, VulnerabilityModel[]>
	): string {
		const severityOrder = [
			"critical",
			"high",
			"medium",
			"low",
			"informational",
		];

		let overviewHTML = `
        <div class="page">
            <h1>Vulnerability Overview</h1>
            <table class="table">
                <thead>
                    <tr>
                        <th>Severity</th>
                        <th>Count</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
        `;

		severityOrder.forEach((severity) => {
			const count = vulnsBySeverity[severity]?.length || 0;
			const percentage =
				report.total_vulnerabilities > 0
					? ((count / report.total_vulnerabilities) * 100).toFixed(1)
					: "0.0";

			overviewHTML += `
                <tr>
                    <td><span class="severity-badge ${severity}">${severity}</span></td>
                    <td>${count}</td>
                    <td>${percentage}%</td>
                </tr>
            `;
		});

		overviewHTML += `
                </tbody>
            </table>
        </div>
        `;

		return overviewHTML;
	}

	/**
	 * Generate vulnerability details HTML
	 */
	private static generateVulnerabilityDetails(
		vulnerabilities: VulnerabilityModel[]
	): string {
		if (vulnerabilities.length === 0) {
			return `
            <div class="page">
                <h1>Vulnerability Details</h1>
                <p>No vulnerabilities were identified in this audit.</p>
            </div>
            `;
		}

		let detailsHTML = `
        <div class="page">
            <h1>Vulnerability Details</h1>
        `;

		vulnerabilities.forEach((vuln, index) => {
			const confidenceClass =
				vuln.confidence >= 0.8
					? "high"
					: vuln.confidence >= 0.5
					? "medium"
					: "low";

			detailsHTML += `
            <div class="vulnerability">
                <div class="vulnerability-header">
                    <h3 class="vulnerability-title">${vuln.title}</h3>
                    <span class="severity-badge ${vuln.severity}">${
				vuln.severity
			}</span>
                </div>
                <div class="vulnerability-content">
                    <div class="vulnerability-description">
                        ${vuln.description}
                    </div>
                    
                    <div class="code-location">
                        <strong>Location:</strong> ${vuln.getLocationString()}<br>
                        <strong>Source:</strong> ${vuln.source}<br>
                        <strong>Confidence:</strong> 
                        <span class="confidence-score confidence-${confidenceClass}">
                            ${(vuln.confidence * 100).toFixed(0)}%
                        </span>
                    </div>
                    
                    <div class="recommendation">
                        <div class="recommendation-title">Recommendation:</div>
                        ${vuln.recommendation}
                    </div>
                </div>
            </div>
            `;

			// Add page break after every 2-3 vulnerabilities
			if ((index + 1) % 3 === 0 && index < vulnerabilities.length - 1) {
				detailsHTML += `</div><div class="page">`;
			}
		});

		detailsHTML += `</div>`;
		return detailsHTML;
	}

	/**
	 * Generate gas optimizations HTML
	 */
	private static generateGasOptimizations(
		gasOptimizations: GasOptimization[]
	): string {
		if (gasOptimizations.length === 0) {
			return `
            <div class="page">
                <h1>Gas Optimizations</h1>
                <p>No gas optimization opportunities were identified.</p>
            </div>
            `;
		}

		let gasHTML = `
        <div class="page">
            <h1>Gas Optimizations</h1>
            <p>The following optimizations could reduce gas consumption:</p>
        `;

		gasOptimizations.forEach((opt) => {
			gasHTML += `
            <div class="gas-optimization">
                <span class="gas-savings">~${opt.estimated_savings} gas</span>
                <h3>${opt.type}</h3>
                <p>${opt.description}</p>
                <div class="code-location">
                    <strong>Location:</strong> ${opt.location.file}:${opt.location.line}:${opt.location.column}
                </div>
            </div>
            `;
		});

		const totalSavings = gasOptimizations.reduce(
			(sum, opt) => sum + opt.estimated_savings,
			0
		);
		gasHTML += `
            <div style="margin-top: 2rem; padding: 1rem; background: #e8f5e8; border-radius: 8px;">
                <strong>Total Estimated Gas Savings: ~${totalSavings} gas per transaction</strong>
            </div>
        </div>
        `;

		return gasHTML;
	}

	/**
	 * Generate recommendations HTML
	 */
	private static generateRecommendationsHTML(
		recommendations: SecurityRecommendation[]
	): string {
		if (recommendations.length === 0) {
			return `
	        <div class="page">
	            <h1>Security Recommendations</h1>
	            <p>No additional security recommendations at this time.</p>
	        </div>
	        `;
		}

		let recHTML = `
	    <div class="page">
	        <h1>Security Recommendations</h1>
	    `;

		recommendations.forEach((rec) => {
			const priorityColor =
				rec.priority === "high"
					? "#dc3545"
					: rec.priority === "medium"
					? "#ffc107"
					: "#28a745";

			recHTML += `
	        <div class="recommendation" style="border-left-color: ${priorityColor};">
	            <div class="recommendation-title">
	                ${rec.category}
	                <span style="color: ${priorityColor}; font-size: 0.8rem;">[${rec.priority.toUpperCase()}]</span>
	            </div>
	            <p><strong>Description:</strong> ${rec.description}</p>
	            <p><strong>Implementation:</strong> ${rec.implementation_guide}</p>
	        </div>
	        `;
		});

		recHTML += `</div>`;
		return recHTML;
	}

	/**
	 * Generate appendix HTML
	 */
	private static generateAppendix(contract: ContractModel): string {
		const metrics = contract.getComplexityMetrics();

		return `
        <div class="page">
            <h1>Appendix</h1>
            
            <h2>Contract Information</h2>
            <table class="table">
                <tr><td><strong>Contract Name</strong></td><td>${
									contract.name
								}</td></tr>
                <tr><td><strong>File Hash</strong></td><td>${
									contract.file_hash
								}</td></tr>
                <tr><td><strong>Compiler Version</strong></td><td>${
									contract.compiler_version
								}</td></tr>
                <tr><td><strong>Created</strong></td><td>${new Date(
									contract.created_at
								).toLocaleDateString()}</td></tr>
            </table>
            
            <h2>Code Metrics</h2>
            <table class="table">
                <tr><td><strong>Lines of Code</strong></td><td>${
									metrics.lines_of_code
								}</td></tr>
                <tr><td><strong>Function Count</strong></td><td>${
									metrics.function_count
								}</td></tr>
                <tr><td><strong>Cyclomatic Complexity</strong></td><td>${
									metrics.cyclomatic_complexity
								}</td></tr>
            </table>
            
            <h2>Methodology</h2>
            <p>This audit was conducted using a combination of static analysis tools and AI-powered security analysis:</p>
            <ul>
                <li><strong>Static Analysis:</strong> Automated scanning using Slither and custom AST analysis</li>
                <li><strong>AI Analysis:</strong> Machine learning models trained on security vulnerabilities</li>
                <li><strong>Manual Review:</strong> Expert validation of findings and recommendations</li>
            </ul>
            
            <p style="margin-top: 2rem; font-size: 0.9rem; color: #6c757d;">
                This report was generated by Audit Wolf - Smart Contract Security Platform
            </p>
        </div>
        `;
	}
}
