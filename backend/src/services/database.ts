import { supabase } from "../config/supabase";
import {
	User,
	Contract,
	Audit,
	Vulnerability,
	BlockchainPlatform,
	MultiChainAudit,
	PlatformVulnerability,
	ContractDependency,
	CrossChainConfig,
	CrossChainAnalysis,
} from "../types/database";

// Export supabase for use in other services
export { supabase };

export class DatabaseService {
	// User operations
	static async createUser(userData: {
		id?: string;
		email: string;
		name: string;
		subscription_tier?: "free" | "pro" | "enterprise";
		api_credits?: number;
	}): Promise<User | null> {
		try {
			const insertData: any = {
				email: userData.email,
				name: userData.name,
				subscription_tier: userData.subscription_tier || "free",
				api_credits: userData.api_credits || 10,
			};

			// If ID is provided, include it in the insert
			if (userData.id) {
				insertData.id = userData.id;
			}

			const { data, error } = await (supabase as any)
				.from("users")
				.insert(insertData)
				.select()
				.single();

			if (error) {
				console.error("Error creating user:", error);
				return null;
			}

			return data as User;
		} catch (error) {
			console.error("Database error creating user:", error);
			return null;
		}
	}

	static async getUserById(id: string): Promise<User | null> {
		try {
			const { data, error } = await supabase
				.from("users")
				.select("*")
				.eq("id", id)
				.single();

			if (error) {
				console.error("Error fetching user:", error);
				return null;
			}

			return data as User;
		} catch (error) {
			console.error("Database error fetching user:", error);
			return null;
		}
	}

	static async updateUser(
		id: string,
		updates: {
			name?: string;
			subscription_tier?: "free" | "pro" | "enterprise";
			api_credits?: number;
		}
	): Promise<User | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("users")
				.update(updates)
				.eq("id", id)
				.select()
				.single();

			if (error) {
				console.error("Error updating user:", error);
				return null;
			}

			return data as User;
		} catch (error) {
			console.error("Database error updating user:", error);
			return null;
		}
	}

	// Contract operations
	static async createContract(contractData: {
		user_id: string;
		name: string;
		source_code: string;
		compiler_version?: string;
		file_hash: string;
		blockchain_platform?: string;
		language?: string;
		dependencies?: ContractDependency[];
		cross_chain_config?: CrossChainConfig;
	}): Promise<Contract | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("contracts")
				.insert({
					user_id: contractData.user_id,
					name: contractData.name,
					source_code: contractData.source_code,
					compiler_version: contractData.compiler_version || "0.8.0",
					file_hash: contractData.file_hash,
					blockchain_platform: contractData.blockchain_platform || "ethereum",
					language: contractData.language || "solidity",
					dependencies: contractData.dependencies,
					cross_chain_config: contractData.cross_chain_config,
				})
				.select()
				.single();

			if (error) {
				console.error("Error creating contract:", error);
				return null;
			}

			return data as Contract;
		} catch (error) {
			console.error("Database error creating contract:", error);
			return null;
		}
	}

	static async getContractById(id: string): Promise<Contract | null> {
		try {
			const { data, error } = await supabase
				.from("contracts")
				.select("*")
				.eq("id", id)
				.single();

			if (error) {
				console.error("Error fetching contract:", error);
				return null;
			}

			return data as Contract;
		} catch (error) {
			console.error("Database error fetching contract:", error);
			return null;
		}
	}

	static async getContractsByUserId(userId: string): Promise<Contract[]> {
		try {
			const { data, error } = await supabase
				.from("contracts")
				.select("*")
				.eq("user_id", userId)
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching user contracts:", error);
				return [];
			}

			return (data as Contract[]) || [];
		} catch (error) {
			console.error("Database error fetching user contracts:", error);
			return [];
		}
	}

	// Audit operations
	static async createAudit(auditData: {
		contract_id: string;
		user_id: string;
		status?: "pending" | "analyzing" | "completed" | "failed";
	}): Promise<Audit | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("audits")
				.insert({
					contract_id: auditData.contract_id,
					user_id: auditData.user_id,
					status: auditData.status || "pending",
				})
				.select()
				.single();

			if (error) {
				console.error("Error creating audit:", error);
				return null;
			}

			return data as Audit;
		} catch (error) {
			console.error("Database error creating audit:", error);
			return null;
		}
	}

	static async getAuditById(id: string): Promise<Audit | null> {
		try {
			const { data, error } = await supabase
				.from("audits")
				.select("*")
				.eq("id", id)
				.single();

			if (error) {
				console.error("Error fetching audit:", error);
				return null;
			}

			return data as Audit;
		} catch (error) {
			console.error("Database error fetching audit:", error);
			return null;
		}
	}

	static async updateAudit(
		id: string,
		updates: {
			status?: "pending" | "analyzing" | "completed" | "failed";
			static_results?: any;
			ai_results?: any;
			final_report?: any;
			ipfs_hash?: string;
			blockchain_tx?: string;
			completed_at?: Date;
		}
	): Promise<Audit | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("audits")
				.update(updates)
				.eq("id", id)
				.select()
				.single();

			if (error) {
				console.error("Error updating audit:", error);
				return null;
			}

			return data as Audit;
		} catch (error) {
			console.error("Database error updating audit:", error);
			return null;
		}
	}

	static async getAuditsByUserId(userId: string): Promise<Audit[]> {
		try {
			const { data, error } = await supabase
				.from("audits")
				.select(
					`
          *,
          contracts (
            id,
            name,
            created_at
          )
        `
				)
				.eq("user_id", userId)
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching user audits:", error);
				return [];
			}

			return (data as any[]) || [];
		} catch (error) {
			console.error("Database error fetching user audits:", error);
			return [];
		}
	}

	// Vulnerability operations
	static async createVulnerability(vulnData: {
		audit_id: string;
		type:
			| "reentrancy"
			| "overflow"
			| "access_control"
			| "gas_optimization"
			| "best_practice"
			| "security";
		severity: "critical" | "high" | "medium" | "low" | "informational";
		title: string;
		description: string;
		location: { file: string; line: number; column: number; length?: number };
		recommendation: string;
		confidence: number;
		source: "static" | "ai" | "combined";
	}): Promise<Vulnerability | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("vulnerabilities")
				.insert(vulnData)
				.select()
				.single();

			if (error) {
				console.error("Error creating vulnerability:", error);
				return null;
			}

			return data as Vulnerability;
		} catch (error) {
			console.error("Database error creating vulnerability:", error);
			return null;
		}
	}

	static async getVulnerabilitiesByAuditId(
		auditId: string
	): Promise<Vulnerability[]> {
		try {
			const { data, error } = await supabase
				.from("vulnerabilities")
				.select("*")
				.eq("audit_id", auditId)
				.order("severity", { ascending: false });

			if (error) {
				console.error("Error fetching vulnerabilities:", error);
				return [];
			}

			return (data as Vulnerability[]) || [];
		} catch (error) {
			console.error("Database error fetching vulnerabilities:", error);
			return [];
		}
	}

	// Additional contract operations for multi-blockchain support
	static async getContractsByPlatform(platform: string): Promise<Contract[]> {
		try {
			const { data, error } = await supabase
				.from("contracts")
				.select("*")
				.eq("blockchain_platform", platform)
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching contracts by platform:", error);
				return [];
			}

			return (data as Contract[]) || [];
		} catch (error) {
			console.error("Database error fetching contracts by platform:", error);
			return [];
		}
	}

	static async getContractsByLanguage(language: string): Promise<Contract[]> {
		try {
			const { data, error } = await supabase
				.from("contracts")
				.select("*")
				.eq("language", language)
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching contracts by language:", error);
				return [];
			}

			return (data as Contract[]) || [];
		} catch (error) {
			console.error("Database error fetching contracts by language:", error);
			return [];
		}
	}

	// Blockchain Platform operations
	static async getAllBlockchainPlatforms(): Promise<BlockchainPlatform[]> {
		try {
			const { data, error } = await supabase
				.from("blockchain_platforms")
				.select("*")
				.order("name", { ascending: true });

			if (error) {
				console.error("Error fetching blockchain platforms:", error);
				return [];
			}

			return (data as BlockchainPlatform[]) || [];
		} catch (error) {
			console.error("Database error fetching blockchain platforms:", error);
			return [];
		}
	}

	static async getActiveBlockchainPlatforms(): Promise<BlockchainPlatform[]> {
		try {
			const { data, error } = await supabase
				.from("blockchain_platforms")
				.select("*")
				.eq("is_active", true)
				.order("name", { ascending: true });

			if (error) {
				console.error("Error fetching active blockchain platforms:", error);
				return [];
			}

			return (data as BlockchainPlatform[]) || [];
		} catch (error) {
			console.error(
				"Database error fetching active blockchain platforms:",
				error
			);
			return [];
		}
	}

	static async getBlockchainPlatformById(
		id: string
	): Promise<BlockchainPlatform | null> {
		try {
			const { data, error } = await supabase
				.from("blockchain_platforms")
				.select("*")
				.eq("id", id)
				.single();

			if (error) {
				console.error("Error fetching blockchain platform:", error);
				return null;
			}

			return data as BlockchainPlatform;
		} catch (error) {
			console.error("Database error fetching blockchain platform:", error);
			return null;
		}
	}

	static async createBlockchainPlatform(platformData: {
		id: string;
		name: string;
		supported_languages: string[];
		file_extensions: string[];
		static_analyzers: Record<string, any>;
		ai_models: Record<string, any>;
		validation_rules: Record<string, any>;
		is_active?: boolean;
	}): Promise<BlockchainPlatform | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("blockchain_platforms")
				.insert({
					...platformData,
					is_active: platformData.is_active ?? true,
				})
				.select()
				.single();

			if (error) {
				console.error("Error creating blockchain platform:", error);
				return null;
			}

			return data as BlockchainPlatform;
		} catch (error) {
			console.error("Database error creating blockchain platform:", error);
			return null;
		}
	}

	static async updateBlockchainPlatform(
		id: string,
		updates: Partial<{
			name: string;
			supported_languages: string[];
			file_extensions: string[];
			static_analyzers: Record<string, any>;
			ai_models: Record<string, any>;
			validation_rules: Record<string, any>;
			is_active: boolean;
		}>
	): Promise<BlockchainPlatform | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("blockchain_platforms")
				.update(updates)
				.eq("id", id)
				.select()
				.single();

			if (error) {
				console.error("Error updating blockchain platform:", error);
				return null;
			}

			return data as BlockchainPlatform;
		} catch (error) {
			console.error("Database error updating blockchain platform:", error);
			return null;
		}
	}

	// Multi-chain Audit operations
	static async createMultiChainAudit(auditData: {
		user_id: string;
		audit_name: string;
		platforms: string[];
		contracts: Record<string, any>;
		cross_chain_analysis?: boolean;
		status?: "pending" | "analyzing" | "completed" | "failed";
	}): Promise<MultiChainAudit | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("multi_chain_audits")
				.insert({
					user_id: auditData.user_id,
					audit_name: auditData.audit_name,
					platforms: auditData.platforms,
					contracts: auditData.contracts,
					cross_chain_analysis: auditData.cross_chain_analysis || false,
					status: auditData.status || "pending",
				})
				.select()
				.single();

			if (error) {
				console.error("Error creating multi-chain audit:", error);
				return null;
			}

			return data as MultiChainAudit;
		} catch (error) {
			console.error("Database error creating multi-chain audit:", error);
			return null;
		}
	}

	static async getMultiChainAuditById(
		id: string
	): Promise<MultiChainAudit | null> {
		try {
			const { data, error } = await supabase
				.from("multi_chain_audits")
				.select("*")
				.eq("id", id)
				.single();

			if (error) {
				console.error("Error fetching multi-chain audit:", error);
				return null;
			}

			return data as MultiChainAudit;
		} catch (error) {
			console.error("Database error fetching multi-chain audit:", error);
			return null;
		}
	}

	static async getMultiChainAuditsByUserId(
		userId: string
	): Promise<MultiChainAudit[]> {
		try {
			const { data, error } = await supabase
				.from("multi_chain_audits")
				.select("*")
				.eq("user_id", userId)
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching user multi-chain audits:", error);
				return [];
			}

			return (data as MultiChainAudit[]) || [];
		} catch (error) {
			console.error("Database error fetching user multi-chain audits:", error);
			return [];
		}
	}

	static async getMultiChainAuditsByPlatform(
		platform: string
	): Promise<MultiChainAudit[]> {
		try {
			const { data, error } = await supabase
				.from("multi_chain_audits")
				.select("*")
				.contains("platforms", [platform])
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching multi-chain audits by platform:", error);
				return [];
			}

			return (data as MultiChainAudit[]) || [];
		} catch (error) {
			console.error(
				"Database error fetching multi-chain audits by platform:",
				error
			);
			return [];
		}
	}

	static async updateMultiChainAudit(
		id: string,
		updates: Partial<{
			audit_name: string;
			platforms: string[];
			contracts: Record<string, any>;
			cross_chain_analysis: boolean;
			status: "pending" | "analyzing" | "completed" | "failed";
			results: Record<string, any>;
			cross_chain_results: Record<string, any>;
			completed_at: Date;
		}>
	): Promise<MultiChainAudit | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("multi_chain_audits")
				.update(updates)
				.eq("id", id)
				.select()
				.single();

			if (error) {
				console.error("Error updating multi-chain audit:", error);
				return null;
			}

			return data as MultiChainAudit;
		} catch (error) {
			console.error("Database error updating multi-chain audit:", error);
			return null;
		}
	}

	// Platform Vulnerability operations
	static async createPlatformVulnerability(vulnData: {
		audit_id?: string;
		multi_chain_audit_id?: string;
		platform: string;
		vulnerability_type: string;
		severity: "critical" | "high" | "medium" | "low" | "informational";
		title: string;
		description: string;
		location: Record<string, any>;
		recommendation: string;
		platform_specific_data?: Record<string, any>;
		confidence: number;
		source: "static" | "ai" | "combined";
	}): Promise<PlatformVulnerability | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("platform_vulnerabilities")
				.insert(vulnData)
				.select()
				.single();

			if (error) {
				console.error("Error creating platform vulnerability:", error);
				return null;
			}

			return data as PlatformVulnerability;
		} catch (error) {
			console.error("Database error creating platform vulnerability:", error);
			return null;
		}
	}

	static async getPlatformVulnerabilitiesByAuditId(
		auditId: string
	): Promise<PlatformVulnerability[]> {
		try {
			const { data, error } = await supabase
				.from("platform_vulnerabilities")
				.select("*")
				.eq("audit_id", auditId)
				.order("severity", { ascending: false });

			if (error) {
				console.error(
					"Error fetching platform vulnerabilities by audit:",
					error
				);
				return [];
			}

			return (data as PlatformVulnerability[]) || [];
		} catch (error) {
			console.error(
				"Database error fetching platform vulnerabilities by audit:",
				error
			);
			return [];
		}
	}

	static async getPlatformVulnerabilitiesByAudit(
		auditId: string,
		platform: string
	): Promise<PlatformVulnerability[]> {
		try {
			const { data, error } = await supabase
				.from("platform_vulnerabilities")
				.select("*")
				.or(`audit_id.eq.${auditId},multi_chain_audit_id.eq.${auditId}`)
				.eq("platform", platform)
				.order("severity", { ascending: false });

			if (error) {
				console.error(
					"Error fetching platform vulnerabilities by audit and platform:",
					error
				);
				return [];
			}

			return (data as PlatformVulnerability[]) || [];
		} catch (error) {
			console.error(
				"Database error fetching platform vulnerabilities by audit and platform:",
				error
			);
			return [];
		}
	}

	static async getCrossChainAnalysisByAuditId(
		auditId: string
	): Promise<CrossChainAnalysis | null> {
		try {
			const { data, error } = await supabase
				.from("cross_chain_analysis")
				.select("*")
				.eq("multi_chain_audit_id", auditId)
				.single();

			if (error) {
				if (error.code === "PGRST116") {
					// No rows returned
					return null;
				}
				console.error("Error fetching cross-chain analysis:", error);
				return null;
			}

			return data as CrossChainAnalysis;
		} catch (error) {
			console.error("Database error fetching cross-chain analysis:", error);
			return null;
		}
	}

	static async getPlatformVulnerabilitiesByMultiChainAuditId(
		multiChainAuditId: string
	): Promise<PlatformVulnerability[]> {
		try {
			const { data, error } = await supabase
				.from("platform_vulnerabilities")
				.select("*")
				.eq("multi_chain_audit_id", multiChainAuditId)
				.order("severity", { ascending: false });

			if (error) {
				console.error(
					"Error fetching platform vulnerabilities by multi-chain audit:",
					error
				);
				return [];
			}

			return (data as PlatformVulnerability[]) || [];
		} catch (error) {
			console.error(
				"Database error fetching platform vulnerabilities by multi-chain audit:",
				error
			);
			return [];
		}
	}

	static async getPlatformVulnerabilitiesByPlatform(
		platform: string
	): Promise<PlatformVulnerability[]> {
		try {
			const { data, error } = await supabase
				.from("platform_vulnerabilities")
				.select("*")
				.eq("platform", platform)
				.order("severity", { ascending: false });

			if (error) {
				console.error(
					"Error fetching platform vulnerabilities by platform:",
					error
				);
				return [];
			}

			return (data as PlatformVulnerability[]) || [];
		} catch (error) {
			console.error(
				"Database error fetching platform vulnerabilities by platform:",
				error
			);
			return [];
		}
	}

	// Cross-chain Analysis operations
	static async createCrossChainAnalysis(analysisData: {
		multi_chain_audit_id: string;
		bridge_security_assessment?: Record<string, any>;
		state_consistency_analysis?: Record<string, any>;
		interoperability_risks?: Record<string, any>;
		recommendations?: Record<string, any>;
	}): Promise<CrossChainAnalysis | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("cross_chain_analysis")
				.insert(analysisData)
				.select()
				.single();

			if (error) {
				console.error("Error creating cross-chain analysis:", error);
				return null;
			}

			return data as CrossChainAnalysis;
		} catch (error) {
			console.error("Database error creating cross-chain analysis:", error);
			return null;
		}
	}

	static async getCrossChainAnalysisById(
		id: string
	): Promise<CrossChainAnalysis | null> {
		try {
			const { data, error } = await supabase
				.from("cross_chain_analysis")
				.select("*")
				.eq("id", id)
				.single();

			if (error) {
				console.error("Error fetching cross-chain analysis:", error);
				return null;
			}

			return data as CrossChainAnalysis;
		} catch (error) {
			console.error("Database error fetching cross-chain analysis:", error);
			return null;
		}
	}

	static async getCrossChainAnalysisByMultiChainAuditId(
		multiChainAuditId: string
	): Promise<CrossChainAnalysis | null> {
		try {
			const { data, error } = await supabase
				.from("cross_chain_analysis")
				.select("*")
				.eq("multi_chain_audit_id", multiChainAuditId)
				.single();

			if (error) {
				console.error(
					"Error fetching cross-chain analysis by multi-chain audit:",
					error
				);
				return null;
			}

			return data as CrossChainAnalysis;
		} catch (error) {
			console.error(
				"Database error fetching cross-chain analysis by multi-chain audit:",
				error
			);
			return null;
		}
	}

	static async updateCrossChainAnalysis(
		id: string,
		updates: Partial<{
			bridge_security_assessment: Record<string, any>;
			state_consistency_analysis: Record<string, any>;
			interoperability_risks: Record<string, any>;
			recommendations: Record<string, any>;
		}>
	): Promise<CrossChainAnalysis | null> {
		try {
			const { data, error } = await (supabase as any)
				.from("cross_chain_analysis")
				.update(updates)
				.eq("id", id)
				.select()
				.single();

			if (error) {
				console.error("Error updating cross-chain analysis:", error);
				return null;
			}

			return data as CrossChainAnalysis;
		} catch (error) {
			console.error("Database error updating cross-chain analysis:", error);
			return null;
		}
	}

	static async deleteUser(userId: string): Promise<boolean> {
		try {
			// Delete user's vulnerabilities first (foreign key constraint)
			const { data: auditIds } = await supabase
				.from("audits")
				.select("id")
				.eq("user_id", userId);

			if (auditIds && auditIds.length > 0) {
				const auditIdList = auditIds.map((audit: any) => audit.id);
				await supabase
					.from("vulnerabilities")
					.delete()
					.in("audit_id", auditIdList);
			}

			// Delete user's audits
			await supabase.from("audits").delete().eq("user_id", userId);

			// Delete user's contracts
			await supabase.from("contracts").delete().eq("user_id", userId);

			// Delete user's multi-chain audits
			await supabase.from("multi_chain_audits").delete().eq("user_id", userId);

			// Delete user
			const { error } = await supabase.from("users").delete().eq("id", userId);

			if (error) {
				console.error("Error deleting user:", error);
				return false;
			}

			return true;
		} catch (error) {
			console.error("Database error deleting user:", error);
			return false;
		}
	}

	// Utility operations
	static async healthCheck(): Promise<{ status: string; timestamp: Date }> {
		try {
			const { error } = await supabase.from("users").select("count").limit(1);

			return {
				status: error ? "unhealthy" : "healthy",
				timestamp: new Date(),
			};
		} catch (error) {
			return {
				status: "error",
				timestamp: new Date(),
			};
		}
	}
}
