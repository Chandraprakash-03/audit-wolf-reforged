import { supabase } from "../../config/supabase";
import { TEST_USERS, TEST_CONTRACTS } from "./contracts";
import { ContractModel } from "../../models/Contract";
import { AuditModel } from "../../models/Audit";
import { VulnerabilityModel } from "../../models/Vulnerability";

/**
 * Database seeding utilities for testing
 */

export class DatabaseSeeder {
	/**
	 * Clean all test data from database
	 */
	static async cleanTestData(): Promise<void> {
		console.log("🧹 Cleaning test data...");

		try {
			// Delete in reverse dependency order
			await supabase
				.from("vulnerabilities")
				.delete()
				.like("audit_id", "%test%");
			await supabase.from("audits").delete().like("user_id", "%test%");
			await supabase.from("contracts").delete().like("user_id", "%test%");

			// Delete test users
			for (const user of Object.values(TEST_USERS)) {
				await supabase.from("users").delete().eq("email", user.email);
			}

			console.log("✅ Test data cleaned");
		} catch (error) {
			console.warn("⚠️ Error cleaning test data:", error);
		}
	}

	/**
	 * Seed database with test users
	 */
	static async seedUsers(): Promise<Record<string, string>> {
		console.log("👥 Seeding test users...");

		const userIds: Record<string, string> = {};

		for (const [key, userData] of Object.entries(TEST_USERS)) {
			try {
				// Create user via Supabase Auth
				const { data: authData, error: authError } = await supabase.auth.signUp(
					{
						email: userData.email,
						password: userData.password,
						options: {
							data: {
								name: userData.name,
							},
						},
					}
				);

				if (authError) {
					console.warn(`⚠️ Auth error for ${userData.email}:`, authError);
					continue;
				}

				if (authData.user) {
					// Update user profile in database
					const { error: updateError } = await supabase.from("users").upsert({
						id: authData.user.id,
						email: userData.email,
						name: userData.name,
						subscription_tier: userData.subscription_tier,
						api_credits: userData.api_credits,
					});

					if (updateError) {
						console.warn(
							`⚠️ Profile update error for ${userData.email}:`,
							updateError
						);
					} else {
						userIds[key] = authData.user.id;
						console.log(`✅ Created user: ${userData.email}`);
					}
				}
			} catch (error) {
				console.warn(`⚠️ Error creating user ${userData.email}:`, error);
			}
		}

		return userIds;
	}

	/**
	 * Seed database with test contracts
	 */
	static async seedContracts(
		userIds: Record<string, string>
	): Promise<Record<string, string>> {
		console.log("📄 Seeding test contracts...");

		const contractIds: Record<string, string> = {};
		const testUserId = userIds.TEST_USER;

		if (!testUserId) {
			console.warn("⚠️ No test user found, skipping contract seeding");
			return contractIds;
		}

		for (const [key, contractData] of Object.entries(TEST_CONTRACTS)) {
			// Skip invalid contracts
			if ("shouldFail" in contractData && contractData.shouldFail) continue;

			try {
				const contract = await ContractModel.create({
					user_id: testUserId,
					name: contractData.name,
					source_code: contractData.sourceCode,
					compiler_version: contractData.compilerVersion,
				});

				if (contract) {
					contractIds[key] = contract.id;
					console.log(`✅ Created contract: ${contractData.name}`);
				}
			} catch (error) {
				console.warn(`⚠️ Error creating contract ${contractData.name}:`, error);
			}
		}

		return contractIds;
	}

	/**
	 * Seed database with test audits
	 */
	static async seedAudits(
		userIds: Record<string, string>,
		contractIds: Record<string, string>
	): Promise<Record<string, string>> {
		console.log("🔍 Seeding test audits...");

		const auditIds: Record<string, string> = {};
		const testUserId = userIds.TEST_USER;

		if (!testUserId) {
			console.warn("⚠️ No test user found, skipping audit seeding");
			return auditIds;
		}

		// Create audits for some contracts
		const contractsToAudit = [
			"SIMPLE_TOKEN",
			"VULNERABLE_BANK",
			"INSECURE_OWNERSHIP",
		];

		for (const contractKey of contractsToAudit) {
			const contractId = contractIds[contractKey];
			if (!contractId) continue;

			try {
				const audit = await AuditModel.create({
					contract_id: contractId,
					user_id: testUserId,
					status: "completed",
				});

				if (audit) {
					auditIds[contractKey] = audit.id;
					console.log(
						`✅ Created audit for: ${
							TEST_CONTRACTS[contractKey as keyof typeof TEST_CONTRACTS].name
						}`
					);

					// Seed vulnerabilities for this audit
					await this.seedVulnerabilities(audit.id, contractKey);
				}
			} catch (error) {
				console.warn(`⚠️ Error creating audit for ${contractKey}:`, error);
			}
		}

		return auditIds;
	}

	/**
	 * Seed vulnerabilities for an audit
	 */
	static async seedVulnerabilities(
		auditId: string,
		contractKey: string
	): Promise<void> {
		if (contractKey === "VULNERABLE_BANK") {
			await VulnerabilityModel.create({
				audit_id: auditId,
				type: "reentrancy",
				severity: "critical",
				title: "Reentrancy Attack Vulnerability",
				description:
					"The withdraw function is vulnerable to reentrancy attacks because it calls an external contract before updating the balance.",
				location: { line: 11, column: 1, file: "VulnerableBank.sol" },
				recommendation:
					"Use the checks-effects-interactions pattern. Update the balance before making the external call.",
				confidence: 0.95,
				source: "static",
			});
		}

		if (contractKey === "INSECURE_OWNERSHIP") {
			await VulnerabilityModel.create({
				audit_id: auditId,
				type: "access_control",
				severity: "high",
				title: "Missing Access Control in changeOwner",
				description:
					"The changeOwner function lacks proper access control, allowing anyone to change the contract owner.",
				location: { line: 13, column: 1, file: "InsecureOwnership.sol" },
				recommendation:
					"Add a modifier to ensure only the current owner can change ownership.",
				confidence: 0.98,
				source: "static",
			});

			await VulnerabilityModel.create({
				audit_id: auditId,
				type: "access_control",
				severity: "high",
				title: "Missing Access Control in mint",
				description:
					"The mint function lacks access control, allowing anyone to mint new tokens.",
				location: { line: 18, column: 1, file: "InsecureOwnership.sol" },
				recommendation:
					"Add proper access control to restrict minting to authorized addresses only.",
				confidence: 0.97,
				source: "ai",
			});
		}
	}

	/**
	 * Generate mock static analysis results
	 */
	static generateMockStaticResults(contractKey: string): any {
		const contractData =
			TEST_CONTRACTS[contractKey as keyof typeof TEST_CONTRACTS];
		const expectedVulns =
			"expectedVulnerabilities" in contractData
				? contractData.expectedVulnerabilities
				: 0;
		const expectedGasOpts =
			"expectedGasOptimizations" in contractData
				? contractData.expectedGasOptimizations
				: 0;

		return {
			slitherFindings: expectedVulns,
			astAnalysis: {
				functions: Math.floor(Math.random() * 10) + 1,
				complexity: Math.floor(Math.random() * 50) + 10,
				linesOfCode: contractData.sourceCode.split("\n").length,
			},
			gasAnalysis: {
				optimizations: expectedGasOpts,
				estimatedSavings: Math.floor(Math.random() * 10000) + 1000,
			},
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Generate mock AI analysis results
	 */
	static generateMockAIResults(contractKey: string): any {
		const contractData =
			TEST_CONTRACTS[contractKey as keyof typeof TEST_CONTRACTS];
		const expectedVulns =
			"expectedVulnerabilities" in contractData
				? contractData.expectedVulnerabilities
				: 0;

		return {
			vulnerabilities: expectedVulns,
			recommendations: Math.floor(Math.random() * 5) + 1,
			codeQuality: {
				score: Math.floor(Math.random() * 40) + 60, // 60-100
				maintainability: Math.floor(Math.random() * 30) + 70,
				security: Math.floor(Math.random() * 50) + 50,
			},
			confidence: 0.85 + Math.random() * 0.15, // 0.85-1.0
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Generate mock final report
	 */
	static generateMockReport(contractKey: string): any {
		const contractData =
			TEST_CONTRACTS[contractKey as keyof typeof TEST_CONTRACTS];
		const expectedVulns =
			"expectedVulnerabilities" in contractData
				? contractData.expectedVulnerabilities
				: 0;
		const expectedGasOpts =
			"expectedGasOptimizations" in contractData
				? contractData.expectedGasOptimizations
				: 0;

		return {
			report: {
				contract_name: contractData.name,
				total_vulnerabilities: expectedVulns,
				critical_count: contractKey === "VULNERABLE_BANK" ? 1 : 0,
				high_count: contractKey === "INSECURE_OWNERSHIP" ? 2 : 0,
				medium_count: Math.floor(Math.random() * 3),
				low_count: Math.floor(Math.random() * 2),
				informational_count: Math.floor(Math.random() * 3),
				gas_optimizations: Array.from({ length: expectedGasOpts }, (_, i) => ({
					title: `Gas Optimization ${i + 1}`,
					description: `Optimization opportunity ${i + 1}`,
					estimated_savings: Math.floor(Math.random() * 1000) + 100,
				})),
				recommendations: [
					"Follow the checks-effects-interactions pattern",
					"Implement proper access controls",
					"Use OpenZeppelin security libraries",
					"Add comprehensive unit tests",
				],
				executive_summary: `Security audit completed for ${contractData.name}. ${expectedVulns} vulnerabilities found.`,
				generated_at: new Date().toISOString(),
			},
		};
	}

	/**
	 * Seed complete test dataset
	 */
	static async seedAll(): Promise<{
		userIds: Record<string, string>;
		contractIds: Record<string, string>;
		auditIds: Record<string, string>;
	}> {
		console.log("🌱 Starting complete database seeding...");

		// Clean existing test data
		await this.cleanTestData();

		// Seed users
		const userIds = await this.seedUsers();

		// Seed contracts
		const contractIds = await this.seedContracts(userIds);

		// Seed audits
		const auditIds = await this.seedAudits(userIds, contractIds);

		console.log("✅ Database seeding completed");
		console.log(`👥 Users: ${Object.keys(userIds).length}`);
		console.log(`📄 Contracts: ${Object.keys(contractIds).length}`);
		console.log(`🔍 Audits: ${Object.keys(auditIds).length}`);

		return { userIds, contractIds, auditIds };
	}
}

// Export for use in tests
export { TEST_USERS, TEST_CONTRACTS };
