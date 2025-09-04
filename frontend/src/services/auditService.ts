import { ApiResponse, Audit, AuditReport, PaginatedResponse } from "@/types";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface AuditFilters {
	status?: Audit["status"];
	contractName?: string;
	dateFrom?: string;
	dateTo?: string;
	page?: number;
	limit?: number;
	// Multi-blockchain filters
	platform?: string;
	language?: string;
	auditType?: "single" | "multi" | "cross-chain" | "all";
}

export interface CreateAuditRequest {
	contractId: string;
}

class AuditService {
	private async makeRequest<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<ApiResponse<T>> {
		try {
			// Get the current session token from Supabase
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.access_token;

			const response = await fetch(`${API_BASE_URL}${endpoint}`, {
				...options,
				headers: {
					"Content-Type": "application/json",
					...(token && { Authorization: `Bearer ${token}` }),
					...options.headers,
				},
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error:
						data.error || `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			return {
				success: true,
				data: data.data || data,
			};
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Network error occurred",
			};
		}
	}

	async getUserAudits(
		filters: AuditFilters = {}
	): Promise<ApiResponse<PaginatedResponse<Audit>>> {
		const params = new URLSearchParams();

		if (filters.status) params.append("status", filters.status);
		if (filters.contractName)
			params.append("contractName", filters.contractName);
		if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
		if (filters.dateTo) params.append("dateTo", filters.dateTo);
		if (filters.page) params.append("page", filters.page.toString());
		if (filters.limit) params.append("limit", filters.limit.toString());
		if (filters.platform) params.append("platform", filters.platform);
		if (filters.language) params.append("language", filters.language);
		if (filters.auditType) params.append("auditType", filters.auditType);

		const queryString = params.toString();
		const endpoint = `/api/audits${queryString ? `?${queryString}` : ""}`;

		return this.makeRequest<PaginatedResponse<Audit>>(endpoint);
	}

	async getAudit(id: string): Promise<ApiResponse<Audit>> {
		return this.makeRequest<Audit>(`/api/audits/${id}`);
	}

	async createAudit(
		auditData: CreateAuditRequest
	): Promise<ApiResponse<Audit>> {
		return this.makeRequest<Audit>("/api/audits", {
			method: "POST",
			body: JSON.stringify(auditData),
		});
	}

	async getAuditReport(auditId: string): Promise<ApiResponse<AuditReport>> {
		return this.makeRequest<AuditReport>(`/api/audits/${auditId}/report`);
	}

	async downloadReport(
		auditId: string,
		format: "pdf" | "json" = "pdf"
	): Promise<ApiResponse<Blob>> {
		try {
			// Get the current session token from Supabase
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.access_token;

			const response = await fetch(
				`${API_BASE_URL}/api/audits/${auditId}/report/download?format=${format}`,
				{
					headers: {
						...(token && { Authorization: `Bearer ${token}` }),
					},
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				return {
					success: false,
					error:
						errorData.error ||
						`HTTP ${response.status}: ${response.statusText}`,
				};
			}

			const blob = await response.blob();
			return {
				success: true,
				data: blob,
			};
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Network error occurred",
			};
		}
	}

	async deleteAudit(id: string): Promise<ApiResponse<void>> {
		return this.makeRequest<void>(`/api/audits/${id}`, {
			method: "DELETE",
		});
	}

	// Multi-blockchain audit methods
	async getMultiChainAudits(
		filters: AuditFilters = {}
	): Promise<ApiResponse<PaginatedResponse<any>>> {
		const params = new URLSearchParams();

		if (filters.status) params.append("status", filters.status);
		if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
		if (filters.dateTo) params.append("dateTo", filters.dateTo);
		if (filters.page) params.append("page", filters.page.toString());
		if (filters.limit) params.append("limit", filters.limit.toString());
		if (filters.platform) params.append("platform", filters.platform);
		if (filters.auditType) params.append("auditType", filters.auditType);

		const queryString = params.toString();
		const endpoint = `/api/multi-blockchain/audits${
			queryString ? `?${queryString}` : ""
		}`;

		return this.makeRequest<PaginatedResponse<any>>(endpoint);
	}

	async getMultiChainAudit(id: string): Promise<ApiResponse<any>> {
		return this.makeRequest<any>(`/api/multi-blockchain/audits/${id}`);
	}

	async getAuditStatistics(
		filters: AuditFilters = {}
	): Promise<ApiResponse<any>> {
		const params = new URLSearchParams();

		if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
		if (filters.dateTo) params.append("dateTo", filters.dateTo);
		if (filters.platform) params.append("platform", filters.platform);
		if (filters.language) params.append("language", filters.language);

		const queryString = params.toString();
		const endpoint = `/api/audits/statistics${
			queryString ? `?${queryString}` : ""
		}`;

		return this.makeRequest<any>(endpoint);
	}

	async getPlatformStatistics(): Promise<ApiResponse<any>> {
		return this.makeRequest<any>("/api/multi-blockchain/platforms/statistics");
	}
}

export const auditService = new AuditService();
