import { supabase } from "./supabase";
import { User, Contract, Audit, Vulnerability } from "../types/database";

export class DatabaseService {
	// User operations (client-side)
	static async getCurrentUser(): Promise<User | null> {
		try {
			const {
				data: { user },
				error,
			} = await supabase.auth.getUser();

			if (error || !user) {
				return null;
			}

			const { data, error: dbError } = await supabase
				.from("users")
				.select("*")
				.eq("id", user.id)
				.single();

			if (dbError) {
				console.error("Error fetching user profile:", dbError);
				return null;
			}

			return data as User;
		} catch (error) {
			console.error("Database error fetching current user:", error);
			return null;
		}
	}

	static async updateUserProfile(updates: {
		name?: string;
		subscription_tier?: "free" | "pro" | "enterprise";
		api_credits?: number;
	}): Promise<User | null> {
		try {
			const {
				data: { user },
				error: authError,
			} = await supabase.auth.getUser();

			if (authError || !user) {
				return null;
			}

			const { data, error } = await supabase
				.from("users")
				.update(updates)
				.eq("id", user.id)
				.select()
				.single();

			if (error) {
				console.error("Error updating user profile:", error);
				return null;
			}

			return data as User;
		} catch (error) {
			console.error("Database error updating user profile:", error);
			return null;
		}
	}

	// Contract operations (client-side)
	static async createContract(contractData: {
		name: string;
		source_code: string;
		compiler_version?: string;
		file_hash: string;
	}): Promise<Contract | null> {
		try {
			const {
				data: { user },
				error: authError,
			} = await supabase.auth.getUser();

			if (authError || !user) {
				throw new Error("User not authenticated");
			}

			const { data, error } = await supabase
				.from("contracts")
				.insert({
					...contractData,
					user_id: user.id,
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

	static async getUserContracts(): Promise<Contract[]> {
		try {
			const {
				data: { user },
				error: authError,
			} = await supabase.auth.getUser();

			if (authError || !user) {
				return [];
			}

			const { data, error } = await supabase
				.from("contracts")
				.select("*")
				.eq("user_id", user.id)
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

	// Audit operations (client-side)
	static async createAudit(contractId: string): Promise<Audit | null> {
		try {
			const {
				data: { user },
				error: authError,
			} = await supabase.auth.getUser();

			if (authError || !user) {
				throw new Error("User not authenticated");
			}

			const { data, error } = await supabase
				.from("audits")
				.insert({
					contract_id: contractId,
					user_id: user.id,
					status: "pending",
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

	static async getUserAudits(): Promise<Audit[]> {
		try {
			const {
				data: { user },
				error: authError,
			} = await supabase.auth.getUser();

			if (authError || !user) {
				return [];
			}

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
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching user audits:", error);
				return [];
			}

			return (data as Audit[]) || [];
		} catch (error) {
			console.error("Database error fetching user audits:", error);
			return [];
		}
	}

	static async getAuditById(id: string): Promise<Audit | null> {
		try {
			const { data, error } = await supabase
				.from("audits")
				.select(
					`
          *,
          contracts (
            id,
            name,
            source_code,
            created_at
          )
        `
				)
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

	// Vulnerability operations (client-side)
	static async getAuditVulnerabilities(
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

	// Real-time subscriptions
	static subscribeToAuditUpdates(
		auditId: string,
		callback: (audit: Audit) => void
	) {
		return supabase
			.channel(`audit-${auditId}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "audits",
					filter: `id=eq.${auditId}`,
				},
				(payload) => {
					callback(payload.new as Audit);
				}
			)
			.subscribe();
	}

	static subscribeToUserAudits(
		userId: string,
		callback: (audit: Audit) => void
	) {
		return supabase
			.channel(`user-audits-${userId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "audits",
					filter: `user_id=eq.${userId}`,
				},
				(payload) => {
					if (
						payload.eventType === "INSERT" ||
						payload.eventType === "UPDATE"
					) {
						callback(payload.new as Audit);
					}
				}
			)
			.subscribe();
	}
}
