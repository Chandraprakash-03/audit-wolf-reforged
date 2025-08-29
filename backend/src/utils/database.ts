import { supabase } from "../config/supabase";
import { DatabaseService } from "../services/database";

export interface DatabaseHealthCheck {
	connected: boolean;
	tablesExist: boolean;
	errors: string[];
	timestamp: Date;
}

export class DatabaseUtils {
	/**
	 * Comprehensive database health check
	 */
	static async healthCheck(): Promise<DatabaseHealthCheck> {
		const result: DatabaseHealthCheck = {
			connected: false,
			tablesExist: false,
			errors: [],
			timestamp: new Date(),
		};

		try {
			// Test basic connection
			const { error: connectionError } = await supabase
				.from("users")
				.select("count")
				.limit(1);

			if (connectionError) {
				result.errors.push(`Connection error: ${connectionError.message}`);
				return result;
			}

			result.connected = true;

			// Test all required tables
			const tables = ["users", "contracts", "audits", "vulnerabilities"];
			const tableResults = await Promise.all(
				tables.map(async (table) => {
					try {
						const { error } = await supabase.from(table).select("*").limit(1);
						return { table, exists: !error, error: error?.message };
					} catch (err) {
						return {
							table,
							exists: false,
							error: err instanceof Error ? err.message : "Unknown error",
						};
					}
				})
			);

			const missingTables = tableResults.filter((r) => !r.exists);
			if (missingTables.length > 0) {
				result.errors.push(
					`Missing tables: ${missingTables.map((t) => t.table).join(", ")}`
				);
			} else {
				result.tablesExist = true;
			}
		} catch (error) {
			result.errors.push(
				`Health check failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}

		return result;
	}

	/**
	 * Test database operations with sample data
	 */
	static async testOperations(): Promise<{
		success: boolean;
		errors: string[];
	}> {
		const errors: string[] = [];

		try {
			// Test user operations
			const testUser = await DatabaseService.createUser({
				email: `test-${Date.now()}@example.com`,
				name: "Test User",
				subscription_tier: "free",
				api_credits: 10,
			});

			if (!testUser) {
				errors.push("Failed to create test user");
				return { success: false, errors };
			}

			// Test contract operations
			const testContract = await DatabaseService.createContract({
				user_id: testUser.id,
				name: "Test Contract",
				source_code: "pragma solidity ^0.8.0; contract Test {}",
				compiler_version: "0.8.0",
				file_hash: "test-hash-" + Date.now(),
			});

			if (!testContract) {
				errors.push("Failed to create test contract");
			}

			// Test audit operations
			if (testContract) {
				const testAudit = await DatabaseService.createAudit({
					contract_id: testContract.id,
					user_id: testUser.id,
					status: "pending",
				});

				if (!testAudit) {
					errors.push("Failed to create test audit");
				}

				// Test vulnerability operations
				if (testAudit) {
					const testVulnerability = await DatabaseService.createVulnerability({
						audit_id: testAudit.id,
						type: "best_practice",
						severity: "low",
						title: "Test Vulnerability",
						description: "This is a test vulnerability",
						location: { file: "test.sol", line: 1, column: 1 },
						recommendation: "Fix this test issue",
						confidence: 0.8,
						source: "static",
					});

					if (!testVulnerability) {
						errors.push("Failed to create test vulnerability");
					}
				}
			}

			// Clean up test data (optional - you might want to keep it for debugging)
			// Note: In production, you'd want to clean up test data
		} catch (error) {
			errors.push(
				`Test operations failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}

		return {
			success: errors.length === 0,
			errors,
		};
	}

	/**
	 * Verify database schema matches expected structure
	 */
	static async verifySchema(): Promise<{ valid: boolean; issues: string[] }> {
		const issues: string[] = [];

		try {
			// This is a simplified schema check
			// In a real application, you might want to check column types, constraints, etc.

			const tables = [
				{
					name: "users",
					requiredColumns: [
						"id",
						"email",
						"name",
						"subscription_tier",
						"api_credits",
					],
				},
				{
					name: "contracts",
					requiredColumns: [
						"id",
						"user_id",
						"name",
						"source_code",
						"file_hash",
					],
				},
				{
					name: "audits",
					requiredColumns: ["id", "contract_id", "user_id", "status"],
				},
				{
					name: "vulnerabilities",
					requiredColumns: ["id", "audit_id", "type", "severity", "title"],
				},
			];

			for (const table of tables) {
				try {
					// Try to select the required columns
					const { error } = await supabase
						.from(table.name)
						.select(table.requiredColumns.join(","))
						.limit(1);

					if (error) {
						issues.push(`Table ${table.name}: ${error.message}`);
					}
				} catch (error) {
					issues.push(
						`Table ${table.name} schema check failed: ${
							error instanceof Error ? error.message : "Unknown error"
						}`
					);
				}
			}
		} catch (error) {
			issues.push(
				`Schema verification failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}

		return {
			valid: issues.length === 0,
			issues,
		};
	}

	/**
	 * Get database statistics
	 */
	static async getStats(): Promise<{
		userCount: number;
		contractCount: number;
		auditCount: number;
		vulnerabilityCount: number;
	}> {
		try {
			const [users, contracts, audits, vulnerabilities] = await Promise.all([
				supabase.from("users").select("*", { count: "exact", head: true }),
				supabase.from("contracts").select("*", { count: "exact", head: true }),
				supabase.from("audits").select("*", { count: "exact", head: true }),
				supabase
					.from("vulnerabilities")
					.select("*", { count: "exact", head: true }),
			]);

			return {
				userCount: users.count || 0,
				contractCount: contracts.count || 0,
				auditCount: audits.count || 0,
				vulnerabilityCount: vulnerabilities.count || 0,
			};
		} catch (error) {
			console.error("Failed to get database stats:", error);
			return {
				userCount: 0,
				contractCount: 0,
				auditCount: 0,
				vulnerabilityCount: 0,
			};
		}
	}
}
