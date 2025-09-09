import { AuditModel } from "../models/Audit";
import { ContractModel } from "../models/Contract";
import { VulnerabilityModel } from "../models/Vulnerability";
import {
	ReportGenerator,
	ReportData,
	GeneratedReport,
} from "./ReportGenerator";
import { PDFGenerator, PDFOptions, GeneratedPDF } from "./PDFGenerator";
import { DatabaseService } from "./database";
import * as path from "path";
import * as fs from "fs-extra";

export interface AuditReportRequest {
	auditId: string;
	format: "html" | "pdf" | "both";
	reportType?: "standard" | "executive" | "detailed";
	includeSourceCode?: boolean;
	customOptions?: PDFOptions;
}

export interface AuditReportResult {
	auditId: string;
	contractName: string;
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
	report: GeneratedReport;
	generatedAt: Date;
}

export class AuditReportService {
	private static readonly REPORTS_DIR = process.env.REPORTS_DIR || "./reports";

	/**
	 * Generate a complete audit report
	 */
	static async generateAuditReport(
		request: AuditReportRequest
	): Promise<AuditReportResult> {
		// Validate request
		await this.validateRequest(request);

		// Fetch audit data
		const reportData = await this.fetchAuditData(request.auditId);

		// Generate the report
		const generatedReport = await ReportGenerator.generateReport(reportData);

		// Update audit with final report
		await reportData.audit.updateFinalReport(generatedReport.report);

		const result: AuditReportResult = {
			auditId: request.auditId,
			contractName: reportData.contract.name,
			report: generatedReport,
			generatedAt: new Date(),
		};

		// Generate HTML if requested
		if (request.format === "html" || request.format === "both") {
			const htmlFilePath = await this.saveHTMLReport(
				request.auditId,
				generatedReport.htmlContent,
				reportData.contract.name
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
				PDFGenerator.getOptionsForReportType(request.reportType || "standard");

			const pdfFilePath = this.getPDFFilePath(
				request.auditId,
				reportData.contract.name
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
	 * Get existing report if available
	 */
	static async getExistingReport(
		auditId: string
	): Promise<AuditReportResult | null> {
		const audit = await AuditModel.findById(auditId);
		if (!audit || !audit.final_report) {
			return null;
		}

		const contract = await ContractModel.findById(audit.contract_id);
		if (!contract) {
			return null;
		}

		// Check if files exist
		const htmlPath = this.getHTMLFilePath(auditId, contract.name);
		const pdfPath = this.getPDFFilePath(auditId, contract.name);

		const result: AuditReportResult = {
			auditId,
			contractName: contract.name,
			report: {
				report: audit.final_report,
				htmlContent: "",
				metadata: {
					auditId,
					contractName: contract.name,
					generatedAt: audit.final_report.generated_at,
					totalPages: 0,
				},
			},
			generatedAt: audit.final_report.generated_at,
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
	 * Regenerate report with new options
	 */
	static async regenerateReport(
		auditId: string,
		options: Partial<AuditReportRequest>
	): Promise<AuditReportResult> {
		const request: AuditReportRequest = {
			auditId,
			format: options.format || "both",
			reportType: options.reportType || "standard",
			includeSourceCode: options.includeSourceCode || false,
			customOptions: options.customOptions,
		};

		return this.generateAuditReport(request);
	}

	/**
	 * Delete report files
	 */
	static async deleteReportFiles(
		auditId: string,
		contractName: string
	): Promise<void> {
		const htmlPath = this.getHTMLFilePath(auditId, contractName);
		const pdfPath = this.getPDFFilePath(auditId, contractName);

		await Promise.all([
			this.safeDeleteFile(htmlPath),
			this.safeDeleteFile(pdfPath),
		]);
	}

	/**
	 * Get report file paths
	 */
	static getReportPaths(auditId: string, contractName: string) {
		return {
			html: this.getHTMLFilePath(auditId, contractName),
			pdf: this.getPDFFilePath(auditId, contractName),
			directory: path.join(this.REPORTS_DIR, auditId),
		};
	}

	/**
	 * Validate report generation request
	 */
	private static async validateRequest(
		request: AuditReportRequest
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

		// Check if audit exists and is completed
		const audit = await AuditModel.findById(request.auditId);
		if (!audit) {
			throw new Error("Audit not found");
		}

		if (!audit.isCompleted()) {
			throw new Error("Audit is not completed yet");
		}
	}

	/**
	 * Fetch all data needed for report generation
	 */
	private static async fetchAuditData(auditId: string): Promise<ReportData> {
		const audit = await AuditModel.findById(auditId);
		if (!audit) {
			throw new Error("Audit not found");
		}

		const contract = await ContractModel.findById(audit.contract_id);
		if (!contract) {
			throw new Error("Contract not found");
		}

		const vulnerabilities = await VulnerabilityModel.findByAuditId(auditId);

		return {
			audit,
			contract,
			vulnerabilities,
		};
	}

	/**
	 * Save HTML report to file
	 */
	private static async saveHTMLReport(
		auditId: string,
		htmlContent: string,
		contractName: string
	): Promise<string> {
		const filePath = this.getHTMLFilePath(auditId, contractName);

		// Ensure directory exists
		await fs.ensureDir(path.dirname(filePath));

		// Write HTML content
		await fs.writeFile(filePath, htmlContent, "utf-8");

		return filePath;
	}

	/**
	 * Get HTML file path
	 */
	private static getHTMLFilePath(
		auditId: string,
		contractName: string
	): string {
		const sanitizedName = this.sanitizeFileName(contractName);
		return path.join(
			this.REPORTS_DIR,
			auditId,
			`${sanitizedName}_audit_report.html`
		);
	}

	/**
	 * Get PDF file path
	 */
	private static getPDFFilePath(auditId: string, contractName: string): string {
		const sanitizedName = this.sanitizeFileName(contractName);
		return path.join(
			this.REPORTS_DIR,
			auditId,
			`${sanitizedName}_audit_report.pdf`
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
	 * Get report statistics
	 */
	static async getReportStatistics(auditId: string): Promise<{
		hasReport: boolean;
		hasHTMLFile: boolean;
		hasPDFFile: boolean;
		reportGeneratedAt?: Date;
		fileSizes: {
			html?: number;
			pdf?: number;
		};
	}> {
		const audit = await AuditModel.findById(auditId);
		if (!audit) {
			throw new Error("Audit not found");
		}

		const contract = await ContractModel.findById(audit.contract_id);
		if (!contract) {
			throw new Error("Contract not found");
		}

		const htmlPath = this.getHTMLFilePath(auditId, contract.name);
		const pdfPath = this.getPDFFilePath(auditId, contract.name);

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
			hasReport: !!audit.final_report,
			hasHTMLFile: htmlExists,
			hasPDFFile: pdfExists,
			reportGeneratedAt: audit.final_report?.generated_at,
			fileSizes,
		};
	}
}
