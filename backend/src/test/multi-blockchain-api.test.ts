import request from "supertest";
import { app } from "../index";
import { DatabaseService } from "../services/database";
import { BlockchainPlatformModel } from "../models/BlockchainPlatform";
import { MultiChainAuditModel } from "../models/MultiChainAudit";

describe("Multi-Blockchain API Endpoints", () => {
	let authToken: string;
	let userId: string;

	beforeAll(async () => {
		// Create test user and get auth token
		const registerResponse = await request(app)
			.post("/api/auth/register")
			.send({
				email: "multichain@test.com",
				password: "testpassword123",
				name: "Multi Chain Tester",
			});

		authToken = registerResponse.body.data.token;
		userId = registerResponse.body.data.user.id;

		// Ensure blockchain platforms exist
		await DatabaseService.createBlockchainPlatform({
			id: "ethereum",
			name: "Ethereum",
			supported_languages: ["solidity"],
			file_extensions: [".sol"],
			static_analyzers: {},
			ai_models: {},
			validation_rules: {},
			is_active: true,
		});

		await DatabaseService.createBlockchainPlatform({
			id: "solana",
			name: "Solana",
			supported_languages: ["rust"],
			file_extensions: [".rs"],
			static_analyzers: {},
			ai_models: {},
			validation_rules: {},
			is_active: true,
		});
	});

	afterAll(async () => {
		// Clean up test data
		await DatabaseService.deleteUser(userId);
	});

	describe("GET /api/multi-blockchain/platforms", () => {
		it("should return list of blockchain platforms", async () => {
			const response = await request(app)
				.get("/api/multi-blockchain/platforms")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(Array.isArray(response.body.data)).toBe(true);
			expect(response.body.data.length).toBeGreaterThan(0);

			const ethereumPlatform = response.body.data.find(
				(p: any) => p.id === "ethereum"
			);
			expect(ethereumPlatform).toBeDefined();
			expect(ethereumPlatform.name).toBe("Ethereum");
			expect(ethereumPlatform.supported_languages).toContain("solidity");
		});

		it("should filter platforms by active status", async () => {
			const response = await request(app)
				.get("/api/multi-blockchain/platforms?active=true")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.every((p: any) => p.is_active)).toBe(true);
		});

		it("should filter platforms by language", async () => {
			const response = await request(app)
				.get("/api/multi-blockchain/platforms?language=solidity")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(
				response.body.data.every((p: any) =>
					p.supported_languages.includes("solidity")
				)
			).toBe(true);
		});

		it("should require authentication", async () => {
			await request(app).get("/api/multi-blockchain/platforms").expect(401);
		});
	});

	describe("GET /api/multi-blockchain/platforms/:id", () => {
		it("should return specific platform details", async () => {
			const response = await request(app)
				.get("/api/multi-blockchain/platforms/ethereum")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.id).toBe("ethereum");
			expect(response.body.data.name).toBe("Ethereum");
			expect(response.body.data.capabilities).toBeDefined();
		});

		it("should return 404 for non-existent platform", async () => {
			const response = await request(app)
				.get("/api/multi-blockchain/platforms/nonexistent")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("PLATFORM_NOT_FOUND");
		});
	});

	describe("POST /api/multi-blockchain/platforms/detect", () => {
		it("should detect Solidity/Ethereum platform", async () => {
			const solidityCode = `
        pragma solidity ^0.8.0;
        
        contract TestContract {
          function test() public pure returns (uint256) {
            return 42;
          }
        }
      `;

			const response = await request(app)
				.post("/api/multi-blockchain/platforms/detect")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					code: solidityCode,
					filename: "TestContract.sol",
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(Array.isArray(response.body.data)).toBe(true);
			expect(response.body.data.length).toBeGreaterThan(0);

			const topResult = response.body.data[0];
			expect(topResult.platform.id).toBe("ethereum");
			expect(topResult.confidence).toBeGreaterThan(0.5);
			expect(Array.isArray(topResult.matchedPatterns)).toBe(true);
		});

		it("should detect Rust/Solana platform", async () => {
			const rustCode = `
        use anchor_lang::prelude::*;
        
        #[program]
        pub mod test_program {
          use super::*;
          
          pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
            Ok(())
          }
        }
      `;

			const response = await request(app)
				.post("/api/multi-blockchain/platforms/detect")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					code: rustCode,
					filename: "lib.rs",
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.length).toBeGreaterThan(0);

			const topResult = response.body.data[0];
			expect(topResult.platform.id).toBe("solana");
			expect(topResult.confidence).toBeGreaterThan(0.5);
		});

		it("should validate input parameters", async () => {
			const response = await request(app)
				.post("/api/multi-blockchain/platforms/detect")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					code: "", // Empty code should fail validation
				})
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("VALIDATION_ERROR");
		});
	});

	describe("POST /api/multi-blockchain/audits", () => {
		it("should start a multi-chain audit", async () => {
			const auditRequest = {
				auditName: "Test Multi-Chain Audit",
				platforms: ["ethereum", "solana"],
				contracts: [
					{
						code: "pragma solidity ^0.8.0; contract Test {}",
						filename: "Test.sol",
						platform: "ethereum",
					},
					{
						code: "use anchor_lang::prelude::*; #[program] pub mod test {}",
						filename: "lib.rs",
						platform: "solana",
					},
				],
				crossChainAnalysis: true,
				analysisOptions: {
					includeStaticAnalysis: true,
					includeAIAnalysis: false,
				},
			};

			const response = await request(app)
				.post("/api/multi-blockchain/audits")
				.set("Authorization", `Bearer ${authToken}`)
				.send(auditRequest)
				.expect(202);

			expect(response.body.success).toBe(true);
			expect(response.body.data.multiChainAuditId).toBeDefined();
			expect(response.body.data.jobId).toBeDefined();
			expect(response.body.data.platforms).toEqual(["ethereum", "solana"]);
			expect(response.body.data.contractCount).toBe(2);
			expect(response.body.data.crossChainAnalysis).toBe(true);
		});

		it("should validate required fields", async () => {
			const response = await request(app)
				.post("/api/multi-blockchain/audits")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					auditName: "Test",
					// Missing platforms and contracts
				})
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("VALIDATION_ERROR");
		});

		it("should validate platform existence", async () => {
			const response = await request(app)
				.post("/api/multi-blockchain/audits")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					auditName: "Test",
					platforms: ["nonexistent"],
					contracts: [
						{
							code: "test",
							filename: "test.sol",
							platform: "nonexistent",
						},
					],
				})
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("INVALID_PLATFORM");
		});
	});

	describe("GET /api/multi-blockchain/audits", () => {
		let testAuditId: string;

		beforeAll(async () => {
			// Create a test multi-chain audit
			const audit = await MultiChainAuditModel.create({
				user_id: userId,
				audit_name: "Test Audit for Listing",
				platforms: ["ethereum"],
				contracts: { test: "contract" },
				cross_chain_analysis: false,
				status: "completed",
			});
			testAuditId = audit!.id;
		});

		it("should return user's multi-chain audits", async () => {
			const response = await request(app)
				.get("/api/multi-blockchain/audits")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.data).toBeDefined();
			expect(Array.isArray(response.body.data.data)).toBe(true);
			expect(response.body.data.total).toBeGreaterThan(0);
			expect(response.body.data.page).toBe(1);
			expect(response.body.data.limit).toBe(10);

			// Check if our test audit is in the results
			const testAudit = response.body.data.data.find(
				(audit: any) => audit.id === testAuditId
			);
			expect(testAudit).toBeDefined();
			expect(testAudit.summary).toBeDefined();
		});

		it("should support pagination", async () => {
			const response = await request(app)
				.get("/api/multi-blockchain/audits?page=1&limit=5")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.page).toBe(1);
			expect(response.body.data.limit).toBe(5);
		});

		it("should filter by status", async () => {
			const response = await request(app)
				.get("/api/multi-blockchain/audits?status=completed")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(
				response.body.data.data.every(
					(audit: any) => audit.status === "completed"
				)
			).toBe(true);
		});

		it("should filter by platform", async () => {
			const response = await request(app)
				.get("/api/multi-blockchain/audits?platform=ethereum")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(
				response.body.data.data.every((audit: any) =>
					audit.platforms.includes("ethereum")
				)
			).toBe(true);
		});
	});

	describe("GET /api/multi-blockchain/audits/:id", () => {
		let testAuditId: string;

		beforeAll(async () => {
			const audit = await MultiChainAuditModel.create({
				user_id: userId,
				audit_name: "Test Audit Details",
				platforms: ["ethereum", "solana"],
				contracts: { test: "contract" },
				cross_chain_analysis: true,
				status: "completed",
			});
			testAuditId = audit!.id;
		});

		it("should return specific audit details", async () => {
			const response = await request(app)
				.get(`/api/multi-blockchain/audits/${testAuditId}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.id).toBe(testAuditId);
			expect(response.body.data.audit_name).toBe("Test Audit Details");
			expect(response.body.data.platforms).toEqual(["ethereum", "solana"]);
			expect(response.body.data.cross_chain_analysis).toBe(true);
			expect(response.body.data.summary).toBeDefined();
		});

		it("should return 404 for non-existent audit", async () => {
			const fakeId = "00000000-0000-0000-0000-000000000000";
			const response = await request(app)
				.get(`/api/multi-blockchain/audits/${fakeId}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("AUDIT_NOT_FOUND");
		});

		it("should deny access to other user's audits", async () => {
			// Create another user
			const otherUserResponse = await request(app)
				.post("/api/auth/register")
				.send({
					email: "other@test.com",
					password: "testpassword123",
					name: "Other User",
				});

			const otherToken = otherUserResponse.body.data.token;

			const response = await request(app)
				.get(`/api/multi-blockchain/audits/${testAuditId}`)
				.set("Authorization", `Bearer ${otherToken}`)
				.expect(403);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("ACCESS_DENIED");

			// Clean up
			await DatabaseService.deleteUser(otherUserResponse.body.data.user.id);
		});
	});

	describe("GET /api/multi-blockchain/audits/:id/results", () => {
		let completedAuditId: string;

		beforeAll(async () => {
			const audit = await MultiChainAuditModel.create({
				user_id: userId,
				audit_name: "Completed Audit with Results",
				platforms: ["ethereum"],
				contracts: { test: "contract" },
				cross_chain_analysis: false,
				status: "completed",
			});

			// Add mock results
			await audit!.updateResults({
				ethereum: {
					vulnerabilities: [
						{
							id: "test-vuln-1",
							type: "reentrancy",
							severity: "high",
							title: "Test Vulnerability",
							description: "Test description",
						},
					],
					summary: {
						total_vulnerabilities: 1,
						high_count: 1,
					},
				},
			});

			completedAuditId = audit!.id;
		});

		it("should return audit results for completed audit", async () => {
			const response = await request(app)
				.get(`/api/multi-blockchain/audits/${completedAuditId}/results`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.auditId).toBe(completedAuditId);
			expect(response.body.data.results).toBeDefined();
			expect(response.body.data.results.ethereum).toBeDefined();
			expect(response.body.data.results.ethereum.vulnerabilities).toHaveLength(
				1
			);
			expect(response.body.data.summary).toBeDefined();
		});

		it("should filter results by platform", async () => {
			const response = await request(app)
				.get(
					`/api/multi-blockchain/audits/${completedAuditId}/results?platform=ethereum`
				)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(Object.keys(response.body.data.results)).toEqual(["ethereum"]);
		});

		it("should return 400 for non-completed audit", async () => {
			const pendingAudit = await MultiChainAuditModel.create({
				user_id: userId,
				audit_name: "Pending Audit",
				platforms: ["ethereum"],
				contracts: { test: "contract" },
				cross_chain_analysis: false,
				status: "pending",
			});

			const response = await request(app)
				.get(`/api/multi-blockchain/audits/${pendingAudit!.id}/results`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error.code).toBe("AUDIT_NOT_COMPLETED");
		});
	});

	describe("Extended audit endpoints with platform filtering", () => {
		it("should support platform filtering in regular audits endpoint", async () => {
			const response = await request(app)
				.get("/api/audits?platform=ethereum")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			// The response should be filtered by platform
		});
	});

	describe("Extended analysis endpoints with platform support", () => {
		let contractId: string;

		beforeAll(async () => {
			// Create a test contract
			const contractResponse = await request(app)
				.post("/api/contracts")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					name: "Test Contract",
					sourceCode: "pragma solidity ^0.8.0; contract Test {}",
				});

			contractId = contractResponse.body.data.id;
		});

		it("should support platform parameter in analysis start", async () => {
			const response = await request(app)
				.post("/api/analysis/start")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractId,
					analysisType: "static",
					platform: "ethereum",
				})
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.auditId).toBeDefined();
		});
	});
});
