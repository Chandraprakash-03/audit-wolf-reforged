import { MultiChainAuditModel } from "../models/MultiChainAudit";
import { PlatformVulnerability, CrossChainAnalysis } from "../types/database";
import { CrossChainAnalysisResult } from "../types/blockchain";
import {
	MultiChainReportGenerator,
	MultiChainReportData,
	GeneratedMultiChainReport,
} from "./MultiChainReportGenerator";
import { PDFGenerator, PDFOptions, GeneratedPDF } from "./PDFGenerator";
import { DatabaseService } from "./database";
import * as path from "path";
import * as fs from "fs-extra";

export interface MultiChainAuditReportRequest {
	auditId: string;
	format: "html" | "pdf" | "both";
	reportType?: "standard" | "executive" | "detailed";
	includeSourceCode?: boolean;
	includeCrossChain?: boolean;
	platformFilter?: string[]; // Filter specific platforms
	customOptions?: PDFOptions;
}

export interface MultiChainAuditReportResult {
	auditId: string;
	auditName: string;
	platforms: string[];
	html?: {
		content: string;
		filePath?: string;
	};
	pdf?: {
		buffer: Buffer;
		filePath: string;
		metadata: {
			size: number;
			pages: number;
			generatedAt: Date;
		};
	};
	report: GeneratedMultiChainReport;
	generatedAt: Date;
}

export class MultiChainAuditReportService {
	private static readonly REPORTS_DIR = process.env.REPORTS_DIR || "./reports";

	/**
	 * Generate a complete multi-chain audit report
	 */
	static async generateMultiChainAuditReport(
		request: MultiChainAuditReportRequest
	): Promise<MultiChainAuditReportResult> {
		// Validate request
		await this.validateRequest(request);

		// Fetch multi-chain audit data
		const reportData = await this.fetchMultiChainAuditData(
			request.auditId,
			request.platformFilter,
			request.includeCrossChain
		);

		// Generate the report
		const generatedReport = await MultiChainReportGenerator.generateReport(
			reportData
		);

		// Update audit with final report (if needed)
		await reportData.audit.updateResults({
			final_report: generatedReport.report,
			report_generated_at: new Date(),
		});

		const result: MultiChainAuditReportResult = {
			auditId: request.auditId,
			auditName: reportData.audit.audit_name,
			platforms: reportData.audit.platforms,
			report: generatedReport,
			generatedAt: new Date(),
		};

		// Generate HTML if requested
		if (request.format === "html" || request.format === "both") {
			const htmlFilePath = await this.saveHTMLReport(
				request.auditId,
				generatedReport.htmlContent,
				reportData.audit.audit_name
			);

			result.html = {
				content: generatedReport.htmlContent,
				filePath: htmlFilePath,
			};
		}

		// Generate PDF if requested
		if (request.format === "pdf" || request.format === "both") {
			const pdfOptions =
				request.customOptions ||
				this.getMultiChainPDFOptions(request.reportType || "standard");

			const pdfFilePath = this.getPDFFilePath(
				request.auditId,
				reportData.audit.audit_name
			);

			const pdf = await PDFGenerator.generatePDFToFile(
				generatedReport.htmlContent,
				pdfFilePath,
				pdfOptions
			);

			result.pdf = {
				buffer: pdf.buffer,
				filePath: pdfFilePath,
				metadata: pdf.metadata,
			};
		}

		return result;
	}

	/**
	 * Get existing multi-chain report if available
	 */
	static async getExistingMultiChainReport(
		auditId: string
	): Promise<MultiChainAuditReportResult | null> {
		const audit = await MultiChainAuditModel.findById(auditId);
		if (!audit || !audit.results?.final_report) {
			return null;
		}

		// Check if files exist
		const htmlPath = this.getHTMLFilePath(auditId, audit.audit_name);
		const pdfPath = this.getPDFFilePath(auditId, audit.audit_name);

		const result: MultiChainAuditReportResult = {
			auditId,
			auditName: audit.audit_name,
			platforms: audit.platforms,
			report: {
				report: audit.results.final_report,
				htmlContent: "",
				metadata: {
					auditId,
					auditName: audit.audit_name,
					platforms: audit.platforms,
					generatedAt:
						audit.results.report_generated_at ||
						audit.completed_at ||
						new Date(),
					totalPages: 0,
				},
			},
			generatedAt:
				audit.results.report_generated_at || audit.completed_at || new Date(),
		};

		// Add HTML if exists
		if (await fs.pathExists(htmlPath)) {
			const htmlContent = await fs.readFile(htmlPath, "utf-8");
			result.html = {
				content: htmlContent,
				filePath: htmlPath,
			};
		}

		// Add PDF if exists
		if (await fs.pathExists(pdfPath)) {
			const pdfBuffer = await fs.readFile(pdfPath);
			const stats = await fs.stat(pdfPath);

			result.pdf = {
				buffer: pdfBuffer,
				filePath: pdfPath,
				metadata: {
					size: stats.size,
					pages: 0, // Would need to parse PDF to get actual page count
					generatedAt: stats.mtime,
				},
			};
		}

		return result;
	}

	/**
	 * Regenerate multi-chain report with new options
	 */
	static async regenerateMultiChainReport(
		auditId: string,
		options: Partial<MultiChainAuditReportRequest>
	): Promise<MultiChainAuditReportResult> {
		const request: MultiChainAuditReportRequest = {
			auditId,
			format: options.format || "both",
			reportType: options.reportType || "standard",
			includeSourceCode: options.includeSourceCode || false,
			includeCrossChain: options.includeCrossChain !== false, // Default to true
			platformFilter: options.platformFilter,
			customOptions: options.customOptions,
		};

		return this.generateMultiChainAuditReport(request);
	}

	/**
	 * Generate comparative report across multiple audits
	 */
	static async generateComparativeReport(
		auditIds: string[],
		options: {
			format: "html" | "pdf" | "both";
			reportName: string;
			compareMetrics?: string[];
		}
	): Promise<MultiChainAuditReportResult> {
		if (auditIds.length < 2) {
			throw new Error("At least 2 audits required for comparative analysis");
		}

		// Fetch all audits
		const audits = await Promise.all(
			auditIds.map((id) => MultiChainAuditModel.findById(id))
		);

		const validAudits = audits.filter(
			(audit) => audit !== null
		) as MultiChainAuditModel[];

		if (validAudits.length < 2) {
			throw new Error("At least 2 valid completed audits required");
		}

		// Generate comparative analysis
		const comparativeData = await this.generateComparativeAnalysis(validAudits);

		// Create a synthetic audit for the comparative report
		const syntheticAudit = {
			id: `comparative-${Date.now()}`,
			audit_name: options.reportName,
			platforms: [...new Set(validAudits.flatMap((a) => a.platforms))],
			created_at: new Date(),
		};

		const result: MultiChainAuditReportResult = {
			auditId: syntheticAudit.id,
			auditName: syntheticAudit.audit_name,
			platforms: syntheticAudit.platforms,
			report: {
				report: comparativeData.report,
				htmlContent: comparativeData.htmlContent,
				metadata: {
					auditId: syntheticAudit.id,
					auditName: syntheticAudit.audit_name,
					platforms: syntheticAudit.platforms,
					generatedAt: new Date(),
					totalPages: this.estimateComparativePageCount(validAudits.length),
				},
			},
			generatedAt: new Date(),
		};

		// Generate files if requested
		if (options.format === "html" || options.format === "both") {
			const htmlFilePath = await this.saveHTMLReport(
				syntheticAudit.id,
				comparativeData.htmlContent,
				syntheticAudit.audit_name
			);

			result.html = {
				content: comparativeData.htmlContent,
				filePath: htmlFilePath,
			};
		}

		if (options.format === "pdf" || options.format === "both") {
			const pdfFilePath = this.getPDFFilePath(
				syntheticAudit.id,
				syntheticAudit.audit_name
			);

			const pdf = await PDFGenerator.generatePDFToFile(
				comparativeData.htmlContent,
				pdfFilePath,
				this.getMultiChainPDFOptions("detailed")
			);

			result.pdf = {
				buffer: pdf.buffer,
				filePath: pdfFilePath,
				metadata: pdf.metadata,
			};
		}

		return result;
	}

	/**
	 * Delete multi-chain report files
	 */
	static async deleteMultiChainReportFiles(
		auditId: string,
		auditName: string
	): Promise<void> {
		const htmlPath = this.getHTMLFilePath(auditId, auditName);
		const pdfPath = this.getPDFFilePath(auditId, auditName);

		await Promise.all([
			this.safeDeleteFile(htmlPath),
			this.safeDeleteFile(pdfPath),
		]);
	}

	/**
	 * Get multi-chain report file paths
	 */
	static getMultiChainReportPaths(auditId: string, auditName: string) {
		return {
			html: this.getHTMLFilePath(auditId, auditName),
			pdf: this.getPDFFilePath(auditId, auditName),
			directory: path.join(this.REPORTS_DIR, "multi-chain", auditId),
		};
	}

	/**
	 * Validate multi-chain report generation request
	 */
	private static async validateRequest(
		request: MultiChainAuditReportRequest
	): Promise<void> {
		if (!request.auditId) {
			throw new Error("Audit ID is required");
		}

		if (!["html", "pdf", "both"].includes(request.format)) {
			throw new Error("Invalid format. Must be html, pdf, or both");
		}

		if (
			request.reportType &&
			!["standard", "executive", "detailed"].includes(request.reportType)
		) {
			throw new Error(
				"Invalid report type. Must be standard, executive, or detailed"
			);
		}

		// Check if multi-chain audit exists and is completed
		const audit = await MultiChainAuditModel.findById(request.auditId);
		if (!audit) {
			throw new Error("Multi-chain audit not found");
		}

		if (!audit.isCompleted()) {
			throw new Error("Multi-chain audit is not completed yet");
		}

		// Validate platform filter if provided
		if (request.platformFilter) {
			const invalidPlatforms = request.platformFilter.filter(
				(platform) => !audit.platforms.includes(platform)
			);
			if (invalidPlatforms.length > 0) {
				throw new Error(
					`Invalid platforms in filter: ${invalidPlatforms.join(", ")}`
				);
			}
		}
	}

	/**
	 * Fetch all data needed for multi-chain report generation
	 */
	private static async fetchMultiChainAuditData(
		auditId: string,
		platformFilter?: string[],
		includeCrossChain: boolean = true
	): Promise<MultiChainReportData> {
		const audit = await MultiChainAuditModel.findById(auditId);
		if (!audit) {
			throw new Error("Multi-chain audit not found");
		}

		// Filter platforms if requested
		const targetPlatforms = platformFilter || audit.platforms;

		// Get platform results
		const platformResults = new Map<string, any>();
		targetPlatforms.forEach((platform) => {
			const result = audit.getResultsForPlatform(platform);
			if (result) {
				platformResults.set(platform, result);
			}
		});

		// Get platform vulnerabilities
		const platformVulnerabilities = new Map<string, PlatformVulnerability[]>();
		for (const platform of targetPlatforms) {
			const vulnerabilities =
				await DatabaseService.getPlatformVulnerabilitiesByAudit(
					auditId,
					platform
				);
			platformVulnerabilities.set(platform, vulnerabilities);
		}

		// Get cross-chain results if requested
		let crossChainResults: CrossChainAnalysisResult | undefined;
		let crossChainAnalysis: CrossChainAnalysis | undefined;

		if (includeCrossChain && audit.cross_chain_analysis) {
			crossChainResults = audit.cross_chain_results as CrossChainAnalysisResult;
			crossChainAnalysis =
				(await DatabaseService.getCrossChainAnalysisByAuditId(auditId)) ||
				undefined;
		}

		return {
			audit,
			platformResults,
			crossChainResults,
			platformVulnerabilities,
			crossChainAnalysis,
		};
	}

	/**
	 * Generate comparative analysis across multiple audits
	 */
	private static async generateComparativeAnalysis(
		audits: MultiChainAuditModel[]
	): Promise<{ report: any; htmlContent: string }> {
		// This is a simplified implementation - would need more sophisticated comparison logic
		const comparativeReport = {
			executive_summary: `Comparative analysis of ${audits.length} multi-blockchain audits`,
			audits_compared: audits.length,
			platforms_analyzed: [...new Set(audits.flatMap((a) => a.platforms))],
			total_vulnerabilities: audits.reduce(
				(sum, audit) => sum + audit.getTotalVulnerabilityCount(),
				0
			),
			generated_at: new Date(),
		};

		const htmlContent = this.generateComparativeHTML(audits, comparativeReport);

		return {
			report: comparativeReport,
			htmlContent,
		};
	}

	/**
	 * Generate HTML for comparative report
	 */
	private static generateComparativeHTML(
		audits: MultiChainAuditModel[],
		report: any
	): string {
		const auditRows = audits
			.map(
				(audit) => `
			<tr>
				<td>${audit.audit_name}</td>
				<td>${audit.platforms.join(", ")}</td>
				<td>${audit.getTotalVulnerabilityCount()}</td>
				<td>${audit.getHighestSeverityAcrossPlatforms() || "None"}</td>
				<td>${audit.created_at.toLocaleDateString()}</td>
			</tr>
		`
			)
			.join("");

		return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Comparative Multi-Blockchain Audit Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Comparative Multi-Blockchain Audit Report</h1>
    <p>Generated on ${report.generated_at.toLocaleDateString()}</p>
    
    <h2>Summary</h2>
    <p>This report compares ${
			report.audits_compared
		} multi-blockchain audits across ${
			report.platforms_analyzed.length
		} different platforms.</p>
    
    <h2>Audit Comparison</h2>
    <table>
        <thead>
            <tr>
                <th>Audit Name</th>
                <th>Platforms</th>
                <th>Total Vulnerabilities</th>
                <th>Highest Severity</th>
                <th>Date</th>
            </tr>
        </thead>
        <tbody>
            ${auditRows}
        </tbody>
    </table>
</body>
</html>`;
	}

	/**
	 * Get PDF options for multi-chain reports
	 */
	private static getMultiChainPDFOptions(
		reportType: "standard" | "executive" | "detailed"
	): PDFOptions {
		const baseOptions = PDFGenerator.getOptionsForReportType(reportType);

		// Customize for multi-chain reports
		return {
			...baseOptions,
			headerTemplate: `
				<div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-top: 0.5in;">
					Multi-Blockchain Security Audit Report
				</div>
			`,
			footerTemplate: `
				<div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-bottom: 0.5in;">
					<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
					<span style="float: right;">Generated by Audit Wolf Multi-Chain Platform</span>
				</div>
			`,
		};
	}

	/**
	 * Save HTML report to file
	 */
	private static async saveHTMLReport(
		auditId: string,
		htmlContent: string,
		auditName: string
	): Promise<string> {
		const filePath = this.getHTMLFilePath(auditId, auditName);

		// Ensure directory exists
		await fs.ensureDir(path.dirname(filePath));

		// Write HTML content
		await fs.writeFile(filePath, htmlContent, "utf-8");

		return filePath;
	}

	/**
	 * Get HTML file path for multi-chain reports
	 */
	private static getHTMLFilePath(auditId: string, auditName: string): string {
		const sanitizedName = this.sanitizeFileName(auditName);
		return path.join(
			this.REPORTS_DIR,
			"multi-chain",
			auditId,
			`${sanitizedName}_multichain_audit_report.html`
		);
	}

	/**
	 * Get PDF file path for multi-chain reports
	 */
	private static getPDFFilePath(auditId: string, auditName: string): string {
		const sanitizedName = this.sanitizeFileName(auditName);
		return path.join(
			this.REPORTS_DIR,
			"multi-chain",
			auditId,
			`${sanitizedName}_multichain_audit_report.pdf`
		);
	}

	/**
	 * Sanitize filename for safe file system operations
	 */
	private static sanitizeFileName(fileName: string): string {
		return fileName
			.replace(/[^a-zA-Z0-9_-]/g, "_")
			.replace(/_+/g, "_")
			.toLowerCase()
			.substring(0, 50);
	}

	/**
	 * Safely delete file without throwing errors
	 */
	private static async safeDeleteFile(filePath: string): Promise<void> {
		try {
			if (await fs.pathExists(filePath)) {
				await fs.unlink(filePath);
			}
		} catch (error) {
			console.warn(`Failed to delete file ${filePath}:`, error);
		}
	}

	/**
	 * Estimate page count for comparative reports
	 */
	private static estimateComparativePageCount(auditCount: number): number {
		// Base pages + pages per audit comparison
		return Math.max(5 + Math.ceil(auditCount * 1.5), 8);
	}

	/**
	 * Get multi-chain report statistics
	 */
	static async getMultiChainReportStatistics(auditId: string): Promise<{
		hasReport: boolean;
		hasHTMLFile: boolean;
		hasPDFFile: boolean;
		reportGeneratedAt?: Date;
		platforms: string[];
		fileSizes: {
			html?: number;
			pdf?: number;
		};
	}> {
		const audit = await MultiChainAuditModel.findById(auditId);
		if (!audit) {
			throw new Error("Multi-chain audit not found");
		}

		const htmlPath = this.getHTMLFilePath(auditId, audit.audit_name);
		const pdfPath = this.getPDFFilePath(auditId, audit.audit_name);

		const [htmlExists, pdfExists] = await Promise.all([
			fs.pathExists(htmlPath),
			fs.pathExists(pdfPath),
		]);

		const fileSizes: { html?: number; pdf?: number } = {};

		if (htmlExists) {
			const htmlStats = await fs.stat(htmlPath);
			fileSizes.html = htmlStats.size;
		}

		if (pdfExists) {
			const pdfStats = await fs.stat(pdfPath);
			fileSizes.pdf = pdfStats.size;
		}

		return {
			hasReport: !!audit.results?.final_report,
			hasHTMLFile: htmlExists,
			hasPDFFile: pdfExists,
			reportGeneratedAt: audit.results?.report_generated_at,
			platforms: audit.platforms,
			fileSizes,
		};
	}
}
