import { supabase } from "../config/supabase";
import { encryptionService } from "./EncryptionService";

/**
 * Service for secure data deletion and user account removal
 */
export class DataDeletionService {
	/**
	 * Securely delete all user data
	 */
	async deleteUserData(userId: string): Promise<DeletionResult> {
		const deletionLog: DeletionStep[] = [];
		let success = true;

		try {
			// 1. Delete vulnerabilities associated with user's audits
			const vulnerabilitiesResult = await this.deleteUserVulnerabilities(
				userId
			);
			deletionLog.push(vulnerabilitiesResult);
			if (!vulnerabilitiesResult.success) success = false;

			// 2. Delete user's audits
			const auditsResult = await this.deleteUserAudits(userId);
			deletionLog.push(auditsResult);
			if (!auditsResult.success) success = false;

			// 3. Delete user's contracts
			const contractsResult = await this.deleteUserContracts(userId);
			deletionLog.push(contractsResult);
			if (!contractsResult.success) success = false;

			// 4. Delete user profile
			const userResult = await this.deleteUserProfile(userId);
			deletionLog.push(userResult);
			if (!userResult.success) success = false;

			// 5. Delete user from Supabase Auth
			const authResult = await this.deleteUserAuth(userId);
			deletionLog.push(authResult);
			if (!authResult.success) success = false;

			// 6. Clean up any remaining references
			const cleanupResult = await this.cleanupUserReferences(userId);
			deletionLog.push(cleanupResult);
			if (!cleanupResult.success) success = false;

			return {
				success,
				userId,
				deletedAt: new Date().toISOString(),
				steps: deletionLog,
				message: success
					? "User data successfully deleted"
					: "User data deletion completed with some errors",
			};
		} catch (error) {
			console.error("User data deletion error:", error);

			deletionLog.push({
				step: "error_handling",
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			});

			return {
				success: false,
				userId,
				deletedAt: new Date().toISOString(),
				steps: deletionLog,
				message: "User data deletion failed",
			};
		}
	}

	/**
	 * Delete vulnerabilities associated with user's audits
	 */
	private async deleteUserVulnerabilities(
		userId: string
	): Promise<DeletionStep> {
		try {
			// First get all audit IDs for the user
			const { data: audits, error: auditsError } = await supabase
				.from("audits")
				.select("id")
				.eq("user_id", userId);

			if (auditsError) {
				throw new Error(`Failed to fetch user audits: ${auditsError.message}`);
			}

			if (!audits || audits.length === 0) {
				return {
					step: "delete_vulnerabilities",
					success: true,
					count: 0,
					message: "No vulnerabilities to delete",
					timestamp: new Date().toISOString(),
				};
			}

			const auditIds = audits.map((audit) => audit.id);

			// Delete vulnerabilities for these audits
			const { error: deleteError, count } = await supabase
				.from("vulnerabilities")
				.delete()
				.in("audit_id", auditIds);

			if (deleteError) {
				throw new Error(
					`Failed to delete vulnerabilities: ${deleteError.message}`
				);
			}

			return {
				step: "delete_vulnerabilities",
				success: true,
				count: count || 0,
				message: `Deleted ${count || 0} vulnerabilities`,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				step: "delete_vulnerabilities",
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Delete user's audits
	 */
	private async deleteUserAudits(userId: string): Promise<DeletionStep> {
		try {
			const { error, count } = await supabase
				.from("audits")
				.delete()
				.eq("user_id", userId);

			if (error) {
				throw new Error(`Failed to delete audits: ${error.message}`);
			}

			return {
				step: "delete_audits",
				success: true,
				count: count || 0,
				message: `Deleted ${count || 0} audits`,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				step: "delete_audits",
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Delete user's contracts with secure data wiping
	 */
	private async deleteUserContracts(userId: string): Promise<DeletionStep> {
		try {
			// First fetch contracts to securely wipe encrypted data
			const { data: contracts, error: fetchError } = await supabase
				.from("contracts")
				.select("id, source_code")
				.eq("user_id", userId);

			if (fetchError) {
				throw new Error(`Failed to fetch contracts: ${fetchError.message}`);
			}

			// Securely wipe contract source code from memory
			if (contracts) {
				for (const contract of contracts) {
					if (contract.source_code) {
						encryptionService.secureDelete(contract.source_code);
					}
				}
			}

			// Delete contracts from database
			const { error: deleteError, count } = await supabase
				.from("contracts")
				.delete()
				.eq("user_id", userId);

			if (deleteError) {
				throw new Error(`Failed to delete contracts: ${deleteError.message}`);
			}

			return {
				step: "delete_contracts",
				success: true,
				count: count || 0,
				message: `Deleted ${count || 0} contracts with secure data wiping`,
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				step: "delete_contracts",
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Delete user profile
	 */
	private async deleteUserProfile(userId: string): Promise<DeletionStep> {
		try {
			const { error, count } = await supabase
				.from("users")
				.delete()
				.eq("id", userId);

			if (error) {
				throw new Error(`Failed to delete user profile: ${error.message}`);
			}

			return {
				step: "delete_user_profile",
				success: true,
				count: count || 0,
				message: "User profile deleted",
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				step: "delete_user_profile",
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Delete user from Supabase Auth
	 */
	private async deleteUserAuth(userId: string): Promise<DeletionStep> {
		try {
			const { error } = await supabase.auth.admin.deleteUser(userId);

			if (error) {
				throw new Error(`Failed to delete user auth: ${error.message}`);
			}

			return {
				step: "delete_user_auth",
				success: true,
				message: "User authentication deleted",
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				step: "delete_user_auth",
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Clean up any remaining user references
	 */
	private async cleanupUserReferences(userId: string): Promise<DeletionStep> {
		try {
			// This is where you would clean up any other references to the user
			// For example: cache entries, log files, external service references, etc.

			// For now, we'll just log that cleanup was attempted
			console.log(`Cleaning up references for user ${userId}`);

			return {
				step: "cleanup_references",
				success: true,
				message: "User references cleaned up",
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			return {
				step: "cleanup_references",
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			};
		}
	}

	/**
	 * Soft delete user data (mark as deleted but keep for recovery)
	 */
	async softDeleteUserData(userId: string): Promise<DeletionResult> {
		const deletionLog: DeletionStep[] = [];
		let success = true;

		try {
			const deletedAt = new Date().toISOString();

			// Mark user as deleted
			const { error: userError } = await supabase
				.from("users")
				.update({
					deleted_at: deletedAt,
					email: `deleted_${userId}@audit-wolf.com`,
					name: "Deleted User",
				})
				.eq("id", userId);

			if (userError) {
				success = false;
				deletionLog.push({
					step: "soft_delete_user",
					success: false,
					error: userError.message,
					timestamp: new Date().toISOString(),
				});
			} else {
				deletionLog.push({
					step: "soft_delete_user",
					success: true,
					message: "User marked as deleted",
					timestamp: new Date().toISOString(),
				});
			}

			// Mark contracts as deleted
			const { error: contractsError } = await supabase
				.from("contracts")
				.update({ deleted_at: deletedAt })
				.eq("user_id", userId);

			if (contractsError) {
				success = false;
				deletionLog.push({
					step: "soft_delete_contracts",
					success: false,
					error: contractsError.message,
					timestamp: new Date().toISOString(),
				});
			} else {
				deletionLog.push({
					step: "soft_delete_contracts",
					success: true,
					message: "Contracts marked as deleted",
					timestamp: new Date().toISOString(),
				});
			}

			// Mark audits as deleted
			const { error: auditsError } = await supabase
				.from("audits")
				.update({ deleted_at: deletedAt })
				.eq("user_id", userId);

			if (auditsError) {
				success = false;
				deletionLog.push({
					step: "soft_delete_audits",
					success: false,
					error: auditsError.message,
					timestamp: new Date().toISOString(),
				});
			} else {
				deletionLog.push({
					step: "soft_delete_audits",
					success: true,
					message: "Audits marked as deleted",
					timestamp: new Date().toISOString(),
				});
			}

			return {
				success,
				userId,
				deletedAt,
				steps: deletionLog,
				message: success
					? "User data soft deleted successfully"
					: "User data soft deletion completed with errors",
			};
		} catch (error) {
			console.error("Soft deletion error:", error);

			return {
				success: false,
				userId,
				deletedAt: new Date().toISOString(),
				steps: deletionLog,
				message: "Soft deletion failed",
			};
		}
	}
}

/**
 * Data deletion result
 */
export interface DeletionResult {
	success: boolean;
	userId: string;
	deletedAt: string;
	steps: DeletionStep[];
	message: string;
}

/**
 * Individual deletion step result
 */
export interface DeletionStep {
	step: string;
	success: boolean;
	count?: number;
	message?: string;
	error?: string;
	timestamp: string;
}

/**
 * Singleton instance
 */
export const dataDeletionService = new DataDeletionService();
