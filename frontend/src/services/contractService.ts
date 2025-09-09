import { ApiResponse, Contract } from "@/types";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface CreateContractRequest {
	name: string;
	sourceCode: string;
	compilerVersion?: string;
	platforms?: string[];
	crossChainAnalysis?: boolean;
	dependencies?: any[];
}

export interface ContractValidationResponse {
	isValid: boolean;
	errors: string[];
	warnings?: string[];
	metrics?: {
		linesOfCode: number;
		functionCount: number;
		cyclomaticComplexity: number;
	};
}

class ContractService {
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

	async createContract(
		contractData: CreateContractRequest
	): Promise<ApiResponse<Contract>> {
		// Determine platform and language from the platforms array
		const platform = contractData.platforms?.[0] || "ethereum";
		const language = this.getLanguageFromPlatform(platform);

		return this.makeRequest<Contract>("/api/contracts", {
			method: "POST",
			body: JSON.stringify({
				...contractData,
				platform,
				language,
			}),
		});
	}

	async validateContract(
		sourceCode: string,
		platform?: string
	): Promise<ApiResponse<ContractValidationResponse>> {
		const contractPlatform = platform || "ethereum";
		const language = this.getLanguageFromPlatform(contractPlatform);

		return this.makeRequest<ContractValidationResponse>(
			"/api/contracts/validate",
			{
				method: "POST",
				body: JSON.stringify({
					sourceCode,
					platform: contractPlatform,
					language,
				}),
			}
		);
	}

	async getContract(id: string): Promise<ApiResponse<Contract>> {
		return this.makeRequest<Contract>(`/api/contracts/${id}`);
	}

	async getUserContracts(): Promise<ApiResponse<Contract[]>> {
		return this.makeRequest<Contract[]>("/api/contracts");
	}

	async deleteContract(id: string): Promise<ApiResponse<void>> {
		return this.makeRequest<void>(`/api/contracts/${id}`, {
			method: "DELETE",
		});
	}

	async updateContract(
		id: string,
		updates: Partial<CreateContractRequest>
	): Promise<ApiResponse<Contract>> {
		return this.makeRequest<Contract>(`/api/contracts/${id}`, {
			method: "PATCH",
			body: JSON.stringify(updates),
		});
	}

	private getLanguageFromPlatform(platform: string): string {
		switch (platform) {
			case "ethereum":
			case "bsc":
			case "polygon":
				return "solidity";
			case "solana":
				return "rust";
			case "cardano":
				return "haskell";
			case "aptos":
			case "sui":
				return "move";
			default:
				return "solidity";
		}
	}
}

export const contractService = new ContractService();
