import { ReportGenerator, ReportData } from "../services/ReportGenerator";
import { PDFGenerator } from "../services/PDFGenerator";
import { AuditReportService } from "../services/AuditReportService";
import { AuditModel } from "../models/Audit";
import { ContractModel } from "../models/Contract";
import { VulnerabilityModel } from "../models/Vulnerability";
import { DatabaseService } from "../services/database";
import * as fs from "fs-extra";
import * as path from "path";

// Mock dependencies
jest.mock("../services/database");
jest.mock("../models/Audit");
jest.mock("../models/Contract");
jest.mock("../models/Vulnerability");
jest.mock("fs-extra");
jest.mock("puppeteer");

describe("Report Generation", () => {
	let mockAudit: any;
	let mockContract: any;
	let mockVulnerabilities: any[];
	let reportData: ReportData;

	beforeEach(() => {
		// Mock audit data
		mockAudit = {
			id: "audit-123",
			contract_id: "contract-456",
			user_id: "user-789",
			status: "completed",
			static_results: {
				slither_findings: [
					{
						type: "reentrancy",
						severity: "high",
						description: "Potential reentrancy vulnerability",
						location: { file: "Contract.sol", line: 42, column: 10 },
						confidence: 0.9,
					},
				],
				gas_analysis: [
					{
						type: "loop_optimization",
						description: "Loop can be optimized",
						location: { file: "Contract.sol", line: 25, column: 5 },
						estimated_savings: 500,
					},
				],
				complexity: {
					cyclomatic_complexity: 5,
					lines_of_code: 150,
					function_count: 8,
				},
			},
			ai_results: {
				vulnerabilities: [
					{
						type: "access_control",
						severity: "medium",
						description: "Missing access control",
						location: { file: "Contract.sol", line: 60, column: 15 },
						confidence: 0.8,
					},
				],
				recommendations: [
					{
						category: "Security",
						priority: "high",
						description: "Implement proper access controls",
						implementation_guide: "Use OpenZeppelin AccessControl",
					},
				],
				code_quality: {
					code_quality_score: 7.5,
					maintainability_index: 65,
					test_coverage_estimate: 80,
				},
				confidence: 0.85,
			},
			created_at: new Date("2024-01-01"),
			completed_at: new Date("2024-01-01T01:00:00"),
			updateFinalReport: jest.fn().mockResolvedValue(true),
			isCompleted: jest.fn().mockReturnValue(true),
		};

		// Mock contract data
		mockContract = {
			id: "contract-456",
			user_id: "user-789",
			name: "TestContract",
			source_code:
				"pragma solidity ^0.8.0;\n\ncontract TestContract {\n    function test() public {}\n}",
			compiler_version: "0.8.19",
			file_hash: "abc123def456",
			created_at: new Date("2024-01-01"),
			getComplexityMetrics: jest.fn().mockReturnValue({
				lines_of_code: 150,
				function_count: 8,
				cyclomatic_complexity: 5,
			}),
		};

		// Mock vulnerabilities
		mockVulnerabilities = [
			{
				id: "vuln-1",
				audit_id: "audit-123",
				type: "reentrancy",
				severity: "high",
				title: "Reentrancy Vulnerability",
				description: "Contract is vulnerable to reentrancy attacks",
				location: { file: "Contract.sol", line: 42, column: 10 },
				recommendation: "Use ReentrancyGuard modifier",
				confidence: 0.9,
				source: "static",
				created_at: new Date("2024-01-01"),
				getLocationString: jest.fn().mockReturnValue("Contract.sol:42:10"),
			},
			{
				id: "vuln-2",
				audit_id: "audit-123",
				type: "access_control",
				severity: "medium",
				title: "Missing Access Control",
				description: "Function lacks proper access control",
				location: { file: "Contract.sol", line: 60, column: 15 },
				recommendation: "Add onlyOwner modifier",
				confidence: 0.8,
				source: "ai",
				created_at: new Date("2024-01-01"),
				getLocationString: jest.fn().mockReturnValue("Contract.sol:60:15"),
			},
		];

		reportData = {
			audit: mockAudit,
			contract: mockContract,
			vulnerabilities: mockVulnerabilities,
		};

		// Mock VulnerabilityModel static methods
		(VulnerabilityModel.sortBySeverity as jest.Mock).mockReturnValue(
			mockVulnerabilities
		);
		(VulnerabilityModel.groupBySeverity as jest.Mock).mockReturnValue({
			high: [mockVulnerabilities[0]],
			medium: [mockVulnerabilities[1]],
			low: [],
			critical: [],
			informational: [],
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("ReportGenerator", () => {
		describe("generateReport", () => {
			it("should generate a complete audit report", async () => {
				const result = await ReportGenerator.generateReport(reportData);

				expect(result).toHaveProperty("report");
				expect(result).toHaveProperty("htmlContent");
				expect(result).toHaveProperty("metadata");

				// Check report structure
				expect(result.report.total_vulnerabilities).toBe(2);
				expect(result.report.high_count).toBe(1);
				expect(result.report.medium_count).toBe(1);
				expect(result.report.gas_optimizations).toHaveLength(1);
				expect(result.report.recommendations.length).toBeGreaterThanOrEqual(1);

				// Check HTML content
				expect(result.htmlContent).toContain("<!DOCTYPE html>");
				expect(result.htmlContent).toContain("TestContract");
				expect(result.htmlContent).toContain("Reentrancy Vulnerability");

				// Check metadata
				expect(result.metadata.auditId).toBe("audit-123");
				expect(result.metadata.contractName).toBe("TestContract");
				expect(result.metadata.totalPages).toBeGreaterThan(0);
			});

			it("should handle empty vulnerabilities", async () => {
				const emptyReportData = {
					...reportData,
					vulnerabilities: [],
				};

				const result = await ReportGenerator.generateReport(emptyReportData);

				expect(result.report.total_vulnerabilities).toBe(0);
				expect(result.report.critical_count).toBe(0);
				expect(result.htmlContent).toContain(
					"No security vulnerabilities were identified"
				);
			});

			it("should generate executive summary correctly", async () => {
				const result = await ReportGenerator.generateReport(reportData);

				expect(result.report.executive_summary).toContain("2 potential issues");
				expect(result.report.executive_summary).toContain(
					"1 critical or high-severity"
				);
				expect(result.report.executive_summary).toContain("1 gas optimization");
			});
		});
	});

	describe("PDFGenerator", () => {
		describe("validateHTMLContent", () => {
			it("should validate correct HTML content", () => {
				const validHTML = `
					<!DOCTYPE html>
					<html>
						<head><title>Test</title></head>
						<body><h1>Test Report</h1></body>
					</html>
				`;

				const result = PDFGenerator.validateHTMLContent(validHTML);
				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			it("should detect invalid HTML content", () => {
				const invalidHTML = "<div>Incomplete HTML";

				const result = PDFGenerator.validateHTMLContent(invalidHTML);
				expect(result.isValid).toBe(false);
				expect(result.errors.length).toBeGreaterThan(0);
			});

			it("should detect missing DOCTYPE", () => {
				const htmlWithoutDoctype = "<html><body>Test</body></html>";

				const result = PDFGenerator.validateHTMLContent(htmlWithoutDoctype);
				expect(result.isValid).toBe(false);
				expect(result.errors).toContain("Missing DOCTYPE declaration");
			});
		});

		describe("getOptionsForReportType", () => {
			it("should return correct options for standard report", () => {
				const options = PDFGenerator.getOptionsForReportType("standard");
				expect(options.format).toBe("A4");
				expect(options.margin?.top).toBe("1in");
			});

			it("should return correct options for executive report", () => {
				const options = PDFGenerator.getOptionsForReportType("executive");
				expect(options.margin?.top).toBe("1.5in");
				expect(options.headerTemplate).toContain("Executive Summary");
			});

			it("should return correct options for detailed report", () => {
				const options = PDFGenerator.getOptionsForReportType("detailed");
				expect(options.margin?.top).toBe("0.75in");
				expect(options.headerTemplate).toContain("Detailed Audit Report");
			});
		});

		describe("getPDFMetadata", () => {
			it("should estimate PDF metadata correctly", async () => {
				const htmlContent = "<html><body>".repeat(100) + "</body></html>";

				const metadata = await PDFGenerator.getPDFMetadata(htmlContent);

				expect(metadata.estimatedSize).toBeGreaterThan(0);
				expect(metadata.estimatedPages).toBeGreaterThan(0);
			});
		});
	});

	describe("AuditReportService", () => {
		beforeEach(() => {
			// Mock model methods
			(AuditModel.findById as jest.Mock).mockResolvedValue(mockAudit);
			(ContractModel.findById as jest.Mock).mockResolvedValue(mockContract);
			(VulnerabilityModel.findByAuditId as jest.Mock).mockResolvedValue(
				mockVulnerabilities
			);

			// Mock file system operations
			(fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
			(fs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
			(fs.pathExists as jest.Mock).mockResolvedValue(true);
			(fs.readFile as unknown as jest.Mock).mockResolvedValue(
				Buffer.from("mock file content")
			);
			(fs.stat as unknown as jest.Mock).mockResolvedValue({
				size: 1024,
				mtime: new Date(),
			});
		});

		describe("generateAuditReport", () => {
			it("should generate HTML report successfully", async () => {
				const request = {
					auditId: "audit-123",
					format: "html" as const,
					reportType: "standard" as const,
				};

				const result = await AuditReportService.generateAuditReport(request);

				expect(result.auditId).toBe("audit-123");
				expect(result.contractName).toBe("TestContract");
				expect(result.html).toBeDefined();
				expect(result.html?.content).toContain("<!DOCTYPE html>");
				expect(result.pdf).toBeUndefined();
			});

			it("should generate PDF report successfully", async () => {
				// Mock Puppeteer
				const mockPDF = Buffer.from("mock pdf content");
				const mockPage = {
					setContent: jest.fn().mockResolvedValue(undefined),
					pdf: jest.fn().mockResolvedValue(mockPDF),
					evaluate: jest.fn().mockResolvedValue(1123),
				};
				const mockBrowser = {
					newPage: jest.fn().mockResolvedValue(mockPage),
					close: jest.fn().mockResolvedValue(undefined),
				};

				// Mock puppeteer.launch
				const puppeteer = require("puppeteer");
				puppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);

				const request = {
					auditId: "audit-123",
					format: "pdf" as const,
					reportType: "standard" as const,
				};

				const result = await AuditReportService.generateAuditReport(request);

				expect(result.auditId).toBe("audit-123");
				expect(result.pdf).toBeDefined();
				expect(result.pdf?.buffer).toEqual(mockPDF);
				expect(result.html).toBeUndefined();
			});

			it("should generate both HTML and PDF reports", async () => {
				// Mock Puppeteer
				const mockPDF = Buffer.from("mock pdf content");
				const mockPage = {
					setContent: jest.fn().mockResolvedValue(undefined),
					pdf: jest.fn().mockResolvedValue(mockPDF),
					evaluate: jest.fn().mockResolvedValue(1123),
				};
				const mockBrowser = {
					newPage: jest.fn().mockResolvedValue(mockPage),
					close: jest.fn().mockResolvedValue(undefined),
				};

				const puppeteer = require("puppeteer");
				puppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);

				const request = {
					auditId: "audit-123",
					format: "both" as const,
					reportType: "standard" as const,
				};

				const result = await AuditReportService.generateAuditReport(request);

				expect(result.html).toBeDefined();
				expect(result.pdf).toBeDefined();
				expect(mockAudit.updateFinalReport).toHaveBeenCalled();
			});

			it("should throw error for non-existent audit", async () => {
				(AuditModel.findById as jest.Mock).mockResolvedValue(null);

				const request = {
					auditId: "non-existent",
					format: "html" as const,
				};

				await expect(
					AuditReportService.generateAuditReport(request)
				).rejects.toThrow("Audit not found");
			});

			it("should throw error for incomplete audit", async () => {
				const incompleteAudit = {
					...mockAudit,
					status: "analyzing",
					isCompleted: jest.fn().mockReturnValue(false),
				};
				(AuditModel.findById as jest.Mock).mockResolvedValue(incompleteAudit);

				const request = {
					auditId: "audit-123",
					format: "html" as const,
				};

				await expect(
					AuditReportService.generateAuditReport(request)
				).rejects.toThrow("Audit is not completed yet");
			});
		});

		describe("getExistingReport", () => {
			it("should return existing report if available", async () => {
				mockAudit.final_report = {
					executive_summary: "Test summary",
					total_vulnerabilities: 2,
					critical_count: 0,
					high_count: 1,
					medium_count: 1,
					low_count: 0,
					informational_count: 0,
					gas_optimizations: [],
					recommendations: [],
					generated_at: new Date("2024-01-01"),
				};

				(fs.readFile as unknown as jest.Mock)
					.mockResolvedValueOnce("mock html content")
					.mockResolvedValueOnce(Buffer.from("mock pdf content"));

				const result = await AuditReportService.getExistingReport("audit-123");

				expect(result).toBeDefined();
				expect(result?.auditId).toBe("audit-123");
				expect(result?.html?.content).toBe("mock html content");
				expect(result?.pdf?.buffer).toEqual(Buffer.from("mock pdf content"));
			});

			it("should return null if audit has no report", async () => {
				mockAudit.final_report = null;

				const result = await AuditReportService.getExistingReport("audit-123");

				expect(result).toBeNull();
			});
		});

		describe("getReportStatistics", () => {
			it("should return correct statistics", async () => {
				mockAudit.final_report = {
					generated_at: new Date("2024-01-01"),
				};

				const stats = await AuditReportService.getReportStatistics("audit-123");

				expect(stats.hasReport).toBe(true);
				expect(stats.hasHTMLFile).toBe(true);
				expect(stats.hasPDFFile).toBe(true);
				expect(stats.reportGeneratedAt).toEqual(new Date("2024-01-01"));
				expect(stats.fileSizes.html).toBe(1024);
				expect(stats.fileSizes.pdf).toBe(1024);
			});
		});

		describe("deleteReportFiles", () => {
			it("should delete report files successfully", async () => {
				(fs.unlink as unknown as jest.Mock).mockResolvedValue(undefined);

				await AuditReportService.deleteReportFiles("audit-123", "TestContract");

				expect(fs.unlink).toHaveBeenCalledTimes(2);
			});

			it("should handle file deletion errors gracefully", async () => {
				(fs.pathExists as jest.Mock).mockResolvedValue(true);
				(fs.unlink as unknown as jest.Mock).mockRejectedValue(
					new Error("Permission denied")
				);

				// Should not throw error
				await expect(
					AuditReportService.deleteReportFiles("audit-123", "TestContract")
				).resolves.not.toThrow();
			});
		});
	});

	describe("Integration Tests", () => {
		it("should generate complete report workflow", async () => {
			// Mock all dependencies for full workflow
			const mockPDF = Buffer.from("mock pdf content");
			const mockPage = {
				setContent: jest.fn().mockResolvedValue(undefined),
				pdf: jest.fn().mockResolvedValue(mockPDF),
				evaluate: jest.fn().mockResolvedValue(1123),
			};
			const mockBrowser = {
				newPage: jest.fn().mockResolvedValue(mockPage),
				close: jest.fn().mockResolvedValue(undefined),
			};

			const puppeteer = require("puppeteer");
			puppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);

			// Generate report
			const result = await ReportGenerator.generateReport(reportData);

			// Validate report structure
			expect(result.report.total_vulnerabilities).toBe(2);
			expect(result.report.executive_summary).toContain("2 potential issues");
			expect(result.htmlContent).toContain("TestContract");
			expect(result.htmlContent).toContain("Reentrancy Vulnerability");
			expect(result.htmlContent).toContain("Missing Access Control");

			// Validate HTML structure
			const validation = PDFGenerator.validateHTMLContent(result.htmlContent);
			expect(validation.isValid).toBe(true);

			// Test PDF generation
			const pdf = await PDFGenerator.generatePDF(result.htmlContent);
			expect(pdf.buffer).toEqual(mockPDF);
			expect(pdf.metadata.size).toBeGreaterThan(0);
		});
	});
});
