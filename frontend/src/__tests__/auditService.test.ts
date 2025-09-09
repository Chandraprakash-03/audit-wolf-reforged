import { auditService } from "@/services/auditService";

// Mock fetch globally
global.fetch = jest.fn();

// Mock data
const mockAudit = {
	id: "audit-1",
	contract_id: "contract-1",
	user_id: "user-1",
	status: "completed" as const,
	final_report: {
		id: "report-1",
		audit_id: "audit-1",
		executive_summary: "Test summary",
		vulnerabilities: [],
		gas_optimizations: [],
		recommendations: [],
		generated_at: new Date("2024-01-01"),
		total_vulnerabilities: 0,
		critical_count: 0,
		high_count: 0,
		medium_count: 0,
		low_count: 0,
		informational_count: 0,
	},
	created_at: new Date("2024-01-01"),
	completed_at: new Date("2024-01-01"),
};

const mockPaginatedResponse = {
	data: [mockAudit],
	total: 1,
	page: 1,
	limit: 10,
	hasMore: false,
};

describe("AuditService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Clear localStorage
		Object.defineProperty(window, "localStorage", {
			value: {
				getItem: jest.fn(() => "mock-token"),
				setItem: jest.fn(),
				removeItem: jest.fn(),
				clear: jest.fn(),
			},
			writable: true,
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("getUserAudits", () => {
		it("calls correct API endpoint with no filters", async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({ data: mockPaginatedResponse }),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const result = await auditService.getUserAudits();

			expect(global.fetch).toHaveBeenCalledWith(
				"http://localhost:3001/api/audits",
				expect.objectContaining({
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer mock-token",
					}),
				})
			);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockPaginatedResponse);
		});

		it("calls correct API endpoint with filters", async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({ data: mockPaginatedResponse }),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const filters = {
				status: "completed" as const,
				contractName: "TestContract",
				dateFrom: "2024-01-01",
				dateTo: "2024-01-31",
				page: 2,
				limit: 20,
			};

			const result = await auditService.getUserAudits(filters);

			expect(global.fetch).toHaveBeenCalledWith(
				"http://localhost:3001/api/audits?status=completed&contractName=TestContract&dateFrom=2024-01-01&dateTo=2024-01-31&page=2&limit=20",
				expect.objectContaining({
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer mock-token",
					}),
				})
			);

			expect(result.success).toBe(true);
		});

		it("handles API errors gracefully", async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				json: async () => ({ error: "Server error" }),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const result = await auditService.getUserAudits();

			expect(result.success).toBe(false);
			expect(result.error).toBe("Server error");
		});

		it("handles network errors", async () => {
			(global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

			const result = await auditService.getUserAudits();

			expect(result.success).toBe(false);
			expect(result.error).toBe("Network error");
		});
	});

	describe("getAudit", () => {
		it("calls correct API endpoint", async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({ data: mockAudit }),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const result = await auditService.getAudit("audit-1");

			expect(global.fetch).toHaveBeenCalledWith(
				"http://localhost:3001/api/audits/audit-1",
				expect.objectContaining({
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer mock-token",
					}),
				})
			);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockAudit);
		});
	});

	describe("createAudit", () => {
		it("calls correct API endpoint with POST method", async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({ data: mockAudit }),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const auditData = { contractId: "contract-1" };
			const result = await auditService.createAudit(auditData);

			expect(global.fetch).toHaveBeenCalledWith(
				"http://localhost:3001/api/audits",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify(auditData),
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer mock-token",
					}),
				})
			);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockAudit);
		});
	});

	describe("downloadReport", () => {
		it("downloads PDF report successfully", async () => {
			const mockBlob = new Blob(["mock pdf content"], {
				type: "application/pdf",
			});
			const mockResponse = {
				ok: true,
				blob: async () => mockBlob,
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const result = await auditService.downloadReport("audit-1", "pdf");

			expect(global.fetch).toHaveBeenCalledWith(
				"http://localhost:3001/api/audits/audit-1/report/download?format=pdf",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer mock-token",
					}),
				})
			);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockBlob);
		});

		it("handles download errors", async () => {
			const mockResponse = {
				ok: false,
				status: 404,
				statusText: "Not Found",
				json: async () => ({ error: "Report not found" }),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const result = await auditService.downloadReport("audit-1", "pdf");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Report not found");
		});
	});

	describe("deleteAudit", () => {
		it("calls correct API endpoint with DELETE method", async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({}),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const result = await auditService.deleteAudit("audit-1");

			expect(global.fetch).toHaveBeenCalledWith(
				"http://localhost:3001/api/audits/audit-1",
				expect.objectContaining({
					method: "DELETE",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer mock-token",
					}),
				})
			);

			expect(result.success).toBe(true);
		});
	});

	describe("getAuditReport", () => {
		it("calls correct API endpoint for report", async () => {
			const mockReport = {
				id: "report-1",
				audit_id: "audit-1",
				executive_summary: "Test summary",
				vulnerabilities: [],
				gas_optimizations: [],
				recommendations: [],
				generated_at: new Date("2024-01-01"),
				total_vulnerabilities: 0,
				critical_count: 0,
				high_count: 0,
				medium_count: 0,
				low_count: 0,
				informational_count: 0,
			};

			const mockResponse = {
				ok: true,
				json: async () => ({ data: mockReport }),
			};
			(global.fetch as jest.Mock).mockResolvedValue(mockResponse);

			const result = await auditService.getAuditReport("audit-1");

			expect(global.fetch).toHaveBeenCalledWith(
				"http://localhost:3001/api/audits/audit-1/report",
				expect.objectContaining({
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer mock-token",
					}),
				})
			);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(mockReport);
		});
	});
});
