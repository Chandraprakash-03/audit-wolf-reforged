import { DatabaseUtils } from "../utils/database";
import {
	UserModel,
	ContractModel,
	AuditModel,
	VulnerabilityModel,
} from "../models";

/**
 * Simple database test suite
 * Run with: npx ts-node src/test/database.test.ts
 */

async function runDatabaseTests() {
	console.log("🧪 Starting Database Tests...\n");

	// Test 1: Health Check
	console.log("1. Testing database connection and health...");
	const healthCheck = await DatabaseUtils.healthCheck();

	if (healthCheck.connected) {
		console.log("✅ Database connection successful");
	} else {
		console.log("❌ Database connection failed");
		healthCheck.errors.forEach((error) => console.log(`   Error: ${error}`));
	}

	if (healthCheck.tablesExist) {
		console.log("✅ All required tables exist");
	} else {
		console.log("❌ Some tables are missing");
		healthCheck.errors.forEach((error) => console.log(`   Error: ${error}`));
	}

	// Test 2: Schema Verification
	console.log("\n2. Verifying database schema...");
	const schemaCheck = await DatabaseUtils.verifySchema();

	if (schemaCheck.valid) {
		console.log("✅ Database schema is valid");
	} else {
		console.log("❌ Database schema has issues");
		schemaCheck.issues.forEach((issue) => console.log(`   Issue: ${issue}`));
	}

	// Test 3: Database Statistics
	console.log("\n3. Getting database statistics...");
	const stats = await DatabaseUtils.getStats();
	console.log(`📊 Users: ${stats.userCount}`);
	console.log(`📊 Contracts: ${stats.contractCount}`);
	console.log(`📊 Audits: ${stats.auditCount}`);
	console.log(`📊 Vulnerabilities: ${stats.vulnerabilityCount}`);

	// Test 4: Model Operations (only if tables exist)
	if (healthCheck.tablesExist) {
		console.log("\n4. Testing model operations...");

		try {
			// Test User Model
			console.log("   Testing User model...");
			const user = await UserModel.create({
				email: `test-user-${Date.now()}@example.com`,
				name: "Test User",
				subscription_tier: "free",
			});

			if (user) {
				console.log("   ✅ User creation successful");

				// Test Contract Model
				console.log("   Testing Contract model...");
				const contract = await ContractModel.create({
					user_id: user.id,
					name: "Test Contract",
					source_code: `
						pragma solidity ^0.8.0;
						
						contract TestContract {
							uint256 public value;
							
							function setValue(uint256 _value) public {
								value = _value;
							}
							
							function getValue() public view returns (uint256) {
								return value;
							}
						}
					`,
					compiler_version: "0.8.0",
				});

				if (contract) {
					console.log("   ✅ Contract creation successful");

					// Test contract validation
					const validation = contract.validateSolidity();
					console.log(
						`   📋 Contract validation: ${
							validation.isValid ? "Valid" : "Invalid"
						}`
					);
					if (!validation.isValid) {
						validation.errors.forEach((error) =>
							console.log(`      Error: ${error}`)
						);
					}

					// Test complexity metrics
					const metrics = contract.getComplexityMetrics();
					console.log(`   📊 Lines of code: ${metrics.lines_of_code}`);
					console.log(`   📊 Function count: ${metrics.function_count}`);
					console.log(
						`   📊 Cyclomatic complexity: ${metrics.cyclomatic_complexity}`
					);

					// Test Audit Model
					console.log("   Testing Audit model...");
					const audit = await AuditModel.create({
						contract_id: contract.id,
						user_id: user.id,
						status: "pending",
					});

					if (audit) {
						console.log("   ✅ Audit creation successful");

						// Test status updates
						await audit.updateStatus("analyzing");
						console.log("   ✅ Audit status update successful");

						// Test Vulnerability Model
						console.log("   Testing Vulnerability model...");
						const vulnerability = await VulnerabilityModel.create({
							audit_id: audit.id,
							type: "best_practice",
							severity: "medium",
							title: "Test Vulnerability",
							description: "This is a test vulnerability for demonstration",
							location: { file: "TestContract.sol", line: 10, column: 5 },
							recommendation: "Consider implementing proper access controls",
							confidence: 0.85,
							source: "static",
						});

						if (vulnerability) {
							console.log("   ✅ Vulnerability creation successful");
							console.log(`   📊 Risk score: ${vulnerability.getRiskScore()}`);
							console.log(
								`   📍 Location: ${vulnerability.getLocationString()}`
							);
						} else {
							console.log("   ❌ Vulnerability creation failed");
						}

						// Complete the audit
						await audit.updateStatus("completed");
						console.log("   ✅ Audit completion successful");
					} else {
						console.log("   ❌ Audit creation failed");
					}
				} else {
					console.log("   ❌ Contract creation failed");
				}
			} else {
				console.log("   ❌ User creation failed");
			}
		} catch (error) {
			console.log(
				`   ❌ Model operations failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	// Test 5: Operations Test
	console.log("\n5. Running comprehensive operations test...");
	const operationsTest = await DatabaseUtils.testOperations();

	if (operationsTest.success) {
		console.log("✅ All database operations working correctly");
	} else {
		console.log("❌ Some database operations failed");
		operationsTest.errors.forEach((error) => console.log(`   Error: ${error}`));
	}

	console.log("\n🎉 Database tests completed!");

	// Final summary
	const allTestsPassed =
		healthCheck.connected &&
		healthCheck.tablesExist &&
		schemaCheck.valid &&
		operationsTest.success;

	if (allTestsPassed) {
		console.log("\n✅ All tests passed! Database is ready for use.");
	} else {
		console.log("\n❌ Some tests failed. Please check the errors above.");
		console.log(
			"\n📋 If tables are missing, run the SQL migration in Supabase Dashboard:"
		);
		console.log("   File: backend/src/migrations/001_initial_schema.sql");
	}
}

// Run tests if this file is executed directly
if (require.main === module) {
	runDatabaseTests().catch((error) => {
		console.error("❌ Test execution failed:", error);
		process.exit(1);
	});
}

export { runDatabaseTests };
