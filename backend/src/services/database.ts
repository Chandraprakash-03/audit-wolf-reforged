import { supabase } from "../config/supabase";
import { User, Contract, Audit, Vulnerability } from "../types/database";

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
			| "best_practice";
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
