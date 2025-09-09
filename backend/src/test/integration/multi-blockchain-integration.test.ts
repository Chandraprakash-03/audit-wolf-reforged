/**
 * Integration tests for multi-blockchain analysis workflows
 * Tests the complete pipeline from API to database storage
 */

import request from "supertest";
import { app } from "../../index";
import { supabase } from "../../config/supabase";
import { MultiChainAnalysisOrchestrator } from "../../services/MultiChainAnalysisOrchestrator";
import { BlockchainRegistry } from "../../services/BlockchainRegistry";
import { TEST_USERS } from "../fixtures/contracts";
import { SOLANA_TEST_CONTRACTS } from "../fixtures/solana-contracts";
import { CARDANO_TEST_CONTRACTS } from "../fixtures/cardano-contracts";
import { MOVE_TEST_CONTRACTS } from "../fixtures/move-contracts";

describe("Multi-Blockchain Integration Tests", () => {
	let authToken: string;
	let testUserId: string;

	beforeAll(async () => {
		// Create test user and get auth token
		const { data: authData, error: authError } = await supabase.auth.signUp({
			email: TEST_USERS.TEST_USER.email,
			password: TEST_USERS.TEST_USER.password,
		});

		if (authError && !authError.message.includes("already registered")) {
			throw authError;
		}

		const { data: signInData, error: signInError } =
			await supabase.auth.signInWithPassword({
				email: TEST_USERS.TEST_USER.email,
				password: TEST_USERS.TEST_USER.password,
			});

		if (signInError) throw signInError;

		authToken = signInData.session?.access_token || "";
		testUserId = signInData.user?.id || "";
	});

	afterAll(async () => {
		// Clean up test data
		if (testUserId) {
			await supabase
				.from("multi_chain_audits")
				.delete()
				.eq("user_id", testUserId);
			await supabase.from("audits").delete().eq("user_id", testUserId);
			await supabase.from("contracts").delete().eq("user_id", testUserId);
		}
	});

	describe("Multi-Platform Contract Upload", () => {
		it("should upload and validate Solana contracts", async () => {
			const response = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "SecureAnchorProgram",
							code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
							filename: "secure_program.rs",
							platform: "solana",
							language: "rust",
						},
					],
					platforms: ["solana"],
				});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.contracts).toHaveLength(1);
			expect(response.body.contracts[0].platform).toBe("solana");
			expect(response.body.contracts[0].language).toBe("rust");
		});

		it("should upload and validate Cardano contracts", async () => {
			const response = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "ValidPlutusValidator",
							code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
							filename: "validator.hs",
							platform: "cardano",
							language: "haskell",
						},
					],
					platforms: ["cardano"],
				});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.contracts).toHaveLength(1);
			expect(response.body.contracts[0].platform).toBe("cardano");
			expect(response.body.contracts[0].language).toBe("haskell");
		});

		it("should upload and validate Move contracts", async () => {
			const response = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "SecureMoveModule",
							code: MOVE_TEST_CONTRACTS.SECURE_MOVE_MODULE.code,
							filename: "secure_token.move",
							platform: "move",
							language: "move",
						},
					],
					platforms: ["move"],
				});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.contracts).toHaveLength(1);
			expect(response.body.contracts[0].platform).toBe("move");
			expect(response.body.contracts[0].language).toBe("move");
		});

		it("should handle multi-platform upload", async () => {
			const response = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "SolanaProgram",
							code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
							filename: "program.rs",
							platform: "solana",
							language: "rust",
						},
						{
							name: "CardanoValidator",
							code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
							filename: "validator.hs",
							platform: "cardano",
							language: "haskell",
						},
					],
					platforms: ["solana", "cardano"],
				});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.contracts).toHaveLength(2);

			const platforms = response.body.contracts.map((c: any) => c.platform);
			expect(platforms).toContain("solana");
			expect(platforms).toContain("cardano");
		});

		it("should reject invalid platform combinations", async () => {
			const response = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "InvalidContract",
							code: "invalid code",
							filename: "invalid.sol",
							platform: "invalid_platform",
							language: "solidity",
						},
					],
					platforms: ["invalid_platform"],
				});

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain("Unsupported platform");
		});
	});

	describe("Multi-Platform Analysis Workflow", () => {
		it("should perform single-platform analysis", async () => {
			// First upload contracts
			const uploadResponse = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "VulnerableAnchorProgram",
							code: SOLANA_TEST_CONTRACTS.VULNERABLE_ANCHOR_PROGRAM.code,
							filename: "vulnerable.rs",
							platform: "solana",
							language: "rust",
						},
					],
					platforms: ["solana"],
				});

			expect(uploadResponse.status).toBe(200);
			const contractIds = uploadResponse.body.contracts.map((c: any) => c.id);

			// Then start analysis
			const analysisResponse = await request(app)
				.post("/api/multi-blockchain/analyze")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractIds,
					platforms: ["solana"],
					analysisOptions: {
						includeAI: true,
						includeStatic: true,
						timeout: 30000,
					},
					crossChainAnalysis: false,
				});

			expect(analysisResponse.status).toBe(200);
			expect(analysisResponse.body.success).toBe(true);
			expect(analysisResponse.body.auditId).toBeDefined();

			const auditId = analysisResponse.body.auditId;

			// Wait for analysis to complete and check results
			let attempts = 0;
			let analysisComplete = false;

			while (attempts < 10 && !analysisComplete) {
				await new Promise((resolve) => setTimeout(resolve, 2000));

				const statusResponse = await request(app)
					.get(`/api/multi-blockchain/audit/${auditId}/status`)
					.set("Authorization", `Bearer ${authToken}`);

				expect(statusResponse.status).toBe(200);

				if (statusResponse.body.status === "completed") {
					analysisComplete = true;
					expect(statusResponse.body.results).toBeDefined();
					expect(statusResponse.body.results.solana).toBeDefined();
					expect(
						statusResponse.body.results.solana.vulnerabilities.length
					).toBeGreaterThan(0);
				}

				attempts++;
			}

			expect(analysisComplete).toBe(true);
		});

		it("should perform multi-platform analysis", async () => {
			// Upload contracts for multiple platforms
			const uploadResponse = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "VulnerableSolana",
							code: SOLANA_TEST_CONTRACTS.VULNERABLE_ANCHOR_PROGRAM.code,
							filename: "vulnerable_solana.rs",
							platform: "solana",
							language: "rust",
						},
						{
							name: "VulnerableCardano",
							code: CARDANO_TEST_CONTRACTS.VULNERABLE_PLUTUS_VALIDATOR,
							filename: "vulnerable_cardano.hs",
							platform: "cardano",
							language: "haskell",
						},
					],
					platforms: ["solana", "cardano"],
				});

			expect(uploadResponse.status).toBe(200);
			const contractIds = uploadResponse.body.contracts.map((c: any) => c.id);

			// Start multi-platform analysis
			const analysisResponse = await request(app)
				.post("/api/multi-blockchain/analyze")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractIds,
					platforms: ["solana", "cardano"],
					analysisOptions: {
						includeAI: true,
						includeStatic: true,
						timeout: 60000,
					},
					crossChainAnalysis: true,
				});

			expect(analysisResponse.status).toBe(200);
			expect(analysisResponse.body.success).toBe(true);

			const auditId = analysisResponse.body.auditId;

			// Wait for analysis completion
			let attempts = 0;
			let analysisComplete = false;

			while (attempts < 15 && !analysisComplete) {
				await new Promise((resolve) => setTimeout(resolve, 3000));

				const statusResponse = await request(app)
					.get(`/api/multi-blockchain/audit/${auditId}/status`)
					.set("Authorization", `Bearer ${authToken}`);

				if (statusResponse.body.status === "completed") {
					analysisComplete = true;

					// Verify multi-platform results
					expect(statusResponse.body.results.solana).toBeDefined();
					expect(statusResponse.body.results.cardano).toBeDefined();
					expect(statusResponse.body.crossChainResults).toBeDefined();

					// Verify vulnerabilities found on both platforms
					expect(
						statusResponse.body.results.solana.vulnerabilities.length
					).toBeGreaterThan(0);
					expect(
						statusResponse.body.results.cardano.vulnerabilities.length
					).toBeGreaterThan(0);

					// Verify cross-chain analysis
					expect(
						statusResponse.body.crossChainResults.interoperabilityRisks.length
					).toBeGreaterThan(0);
				}

				attempts++;
			}

			expect(analysisComplete).toBe(true);
		});

		it("should handle cross-chain bridge analysis", async () => {
			// Upload bridge contracts for multiple platforms
			const bridgeContracts = [
				{
					name: "EthereumBridge",
					code: `
pragma solidity ^0.8.0;

contract Bridge {
    mapping(bytes32 => bool) public processedMessages;
    
    function lockTokens(uint256 amount, bytes32 targetChain) external {
        // Bridge locking logic with potential vulnerabilities
        processedMessages[keccak256(abi.encode(msg.sender, amount, targetChain))] = true;
    }
    
    function unlockTokens(bytes32 messageHash, uint256 amount) external {
        require(!processedMessages[messageHash], "Already processed");
        processedMessages[messageHash] = true;
        // Unlock logic
    }
}
					`,
					filename: "bridge.sol",
					platform: "ethereum",
					language: "solidity",
				},
				{
					name: "SolanaBridge",
					code: `
use anchor_lang::prelude::*;

#[program]
pub mod bridge {
    use super::*;
    
    pub fn lock_tokens(ctx: Context<LockTokens>, amount: u64, target_chain: String) -> Result<()> {
        // Bridge locking logic
        let bridge_account = &mut ctx.accounts.bridge_account;
        bridge_account.locked_amount += amount;
        Ok(())
    }
    
    pub fn unlock_tokens(ctx: Context<UnlockTokens>, amount: u64) -> Result<()> {
        // Unlock logic with potential issues
        let bridge_account = &mut ctx.accounts.bridge_account;
        bridge_account.locked_amount -= amount;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct LockTokens<'info> {
    #[account(mut)]
    pub bridge_account: Account<'info, BridgeAccount>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UnlockTokens<'info> {
    #[account(mut)]
    pub bridge_account: Account<'info, BridgeAccount>,
    pub user: Signer<'info>,
}

#[account]
pub struct BridgeAccount {
    pub locked_amount: u64,
}
					`,
					filename: "bridge.rs",
					platform: "solana",
					language: "rust",
				},
			];

			const uploadResponse = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: bridgeContracts,
					platforms: ["ethereum", "solana"],
				});

			expect(uploadResponse.status).toBe(200);
			const contractIds = uploadResponse.body.contracts.map((c: any) => c.id);

			// Start cross-chain bridge analysis
			const analysisResponse = await request(app)
				.post("/api/multi-blockchain/analyze")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractIds,
					platforms: ["ethereum", "solana"],
					analysisOptions: {
						includeAI: true,
						includeStatic: true,
						timeout: 60000,
					},
					crossChainAnalysis: true,
					analysisType: "bridge", // Specify bridge analysis
				});

			expect(analysisResponse.status).toBe(200);
			const auditId = analysisResponse.body.auditId;

			// Wait for bridge analysis completion
			let attempts = 0;
			let analysisComplete = false;

			while (attempts < 15 && !analysisComplete) {
				await new Promise((resolve) => setTimeout(resolve, 3000));

				const statusResponse = await request(app)
					.get(`/api/multi-blockchain/audit/${auditId}/status`)
					.set("Authorization", `Bearer ${authToken}`);

				if (statusResponse.body.status === "completed") {
					analysisComplete = true;

					// Verify bridge-specific analysis
					expect(statusResponse.body.crossChainResults).toBeDefined();
					expect(
						statusResponse.body.crossChainResults.bridgeSecurityAssessment
					).toBeDefined();
					expect(
						statusResponse.body.crossChainResults.bridgeSecurityAssessment
							.overallSecurityScore
					).toBeGreaterThanOrEqual(0);

					// Verify bridge-specific vulnerabilities
					const allVulns = [
						...statusResponse.body.results.ethereum.vulnerabilities,
						...statusResponse.body.results.solana.vulnerabilities,
					];

					const bridgeVulns = allVulns.filter(
						(v: any) =>
							v.type.includes("bridge") ||
							v.description.toLowerCase().includes("bridge")
					);
					expect(bridgeVulns.length).toBeGreaterThan(0);
				}

				attempts++;
			}

			expect(analysisComplete).toBe(true);
		});
	});

	describe("Report Generation Integration", () => {
		it("should generate multi-platform PDF report", async () => {
			// First create a completed multi-platform audit
			const uploadResponse = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "TestSolana",
							code: SOLANA_TEST_CONTRACTS.VULNERABLE_ANCHOR_PROGRAM.code,
							filename: "test_solana.rs",
							platform: "solana",
							language: "rust",
						},
						{
							name: "TestCardano",
							code: CARDANO_TEST_CONTRACTS.VULNERABLE_PLUTUS_VALIDATOR,
							filename: "test_cardano.hs",
							platform: "cardano",
							language: "haskell",
						},
					],
					platforms: ["solana", "cardano"],
				});

			const contractIds = uploadResponse.body.contracts.map((c: any) => c.id);

			const analysisResponse = await request(app)
				.post("/api/multi-blockchain/analyze")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractIds,
					platforms: ["solana", "cardano"],
					analysisOptions: {
						includeAI: true,
						includeStatic: true,
						timeout: 60000,
					},
					crossChainAnalysis: true,
				});

			const auditId = analysisResponse.body.auditId;

			// Wait for analysis completion
			let analysisComplete = false;
			let attempts = 0;

			while (attempts < 15 && !analysisComplete) {
				await new Promise((resolve) => setTimeout(resolve, 3000));

				const statusResponse = await request(app)
					.get(`/api/multi-blockchain/audit/${auditId}/status`)
					.set("Authorization", `Bearer ${authToken}`);

				if (statusResponse.body.status === "completed") {
					analysisComplete = true;
				}
				attempts++;
			}

			expect(analysisComplete).toBe(true);

			// Generate PDF report
			const reportResponse = await request(app)
				.get(`/api/multi-blockchain/audit/${auditId}/report`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(reportResponse.headers["content-type"]).toBe("application/pdf");
			expect(reportResponse.body.length).toBeGreaterThan(1000); // PDF should have substantial content
		});

		it("should generate JSON report with multi-platform data", async () => {
			// Use existing audit from previous test or create new one
			const auditsResponse = await request(app)
				.get("/api/multi-blockchain/audits")
				.set("Authorization", `Bearer ${authToken}`);

			expect(auditsResponse.status).toBe(200);
			expect(auditsResponse.body.audits.length).toBeGreaterThan(0);

			const auditId = auditsResponse.body.audits[0].id;

			const jsonReportResponse = await request(app)
				.get(`/api/multi-blockchain/audit/${auditId}/report?format=json`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(jsonReportResponse.body.auditId).toBe(auditId);
			expect(jsonReportResponse.body.platforms).toBeDefined();
			expect(Array.isArray(jsonReportResponse.body.platforms)).toBe(true);
			expect(jsonReportResponse.body.platformResults).toBeDefined();
			expect(jsonReportResponse.body.summary).toBeDefined();
			expect(
				jsonReportResponse.body.summary.totalVulnerabilities
			).toBeGreaterThanOrEqual(0);
		});
	});

	describe("Database Integration", () => {
		it("should store multi-platform audit data correctly", async () => {
			// Create a multi-platform audit
			const uploadResponse = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "DatabaseTestSolana",
							code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
							filename: "db_test.rs",
							platform: "solana",
							language: "rust",
						},
					],
					platforms: ["solana"],
				});

			const contractIds = uploadResponse.body.contracts.map((c: any) => c.id);

			const analysisResponse = await request(app)
				.post("/api/multi-blockchain/analyze")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractIds,
					platforms: ["solana"],
					analysisOptions: {
						includeAI: false, // Faster for database test
						includeStatic: true,
						timeout: 30000,
					},
					crossChainAnalysis: false,
				});

			const auditId = analysisResponse.body.auditId;

			// Wait for completion
			let attempts = 0;
			while (attempts < 10) {
				await new Promise((resolve) => setTimeout(resolve, 2000));

				const statusResponse = await request(app)
					.get(`/api/multi-blockchain/audit/${auditId}/status`)
					.set("Authorization", `Bearer ${authToken}`);

				if (statusResponse.body.status === "completed") {
					break;
				}
				attempts++;
			}

			// Verify database storage
			const { data: auditData, error: auditError } = await supabase
				.from("multi_chain_audits")
				.select("*")
				.eq("id", auditId)
				.single();

			expect(auditError).toBeNull();
			expect(auditData).toBeDefined();
			expect(auditData.platforms).toContain("solana");
			expect(auditData.status).toBe("completed");
			expect(auditData.results).toBeDefined();

			// Verify contract storage
			const { data: contractData, error: contractError } = await supabase
				.from("contracts")
				.select("*")
				.in("id", contractIds);

			expect(contractError).toBeNull();
			expect(contractData).toBeDefined();
			expect(contractData?.length).toBe(1);
			// expect(contractData?[0].blockchain_platform).toBe("solana");
			// expect(contractData?[0].language).toBe("rust");

			// Verify vulnerability storage
			const { data: vulnData, error: vulnError } = await supabase
				.from("platform_vulnerabilities")
				.select("*")
				.eq("multi_chain_audit_id", auditId);

			expect(vulnError).toBeNull();
			if (vulnData && vulnData.length > 0) {
				vulnData.forEach((vuln) => {
					expect(vuln.platform).toBe("solana");
					expect(vuln.vulnerability_type).toBeDefined();
					expect(vuln.severity).toMatch(/^(low|medium|high|critical)$/);
				});
			}
		});

		it("should handle database constraints and relationships", async () => {
			// Test foreign key relationships and constraints
			const { data: userData, error: userError } = await supabase
				.from("users")
				.select("id")
				.eq("id", testUserId)
				.single();

			expect(userError).toBeNull();
			expect(userData).toBeDefined();

			// Test cascade deletion
			const { data: auditsBeforeDelete } = await supabase
				.from("multi_chain_audits")
				.select("id")
				.eq("user_id", testUserId);

			if (auditsBeforeDelete && auditsBeforeDelete.length > 0) {
				const auditId = auditsBeforeDelete[0].id;

				// Delete audit should cascade to vulnerabilities
				const { error: deleteError } = await supabase
					.from("multi_chain_audits")
					.delete()
					.eq("id", auditId);

				expect(deleteError).toBeNull();

				// Verify cascaded deletion
				const { data: vulnsAfterDelete } = await supabase
					.from("platform_vulnerabilities")
					.select("id")
					.eq("multi_chain_audit_id", auditId);

				expect(vulnsAfterDelete).toEqual([]);
			}
		});
	});

	describe("Error Handling and Edge Cases", () => {
		it("should handle timeout scenarios", async () => {
			const uploadResponse = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "TimeoutTest",
							code: SOLANA_TEST_CONTRACTS.LARGE_SOLANA_PROGRAM.code,
							filename: "timeout_test.rs",
							platform: "solana",
							language: "rust",
						},
					],
					platforms: ["solana"],
				});

			const contractIds = uploadResponse.body.contracts.map((c: any) => c.id);

			// Set very short timeout
			const analysisResponse = await request(app)
				.post("/api/multi-blockchain/analyze")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractIds,
					platforms: ["solana"],
					analysisOptions: {
						includeAI: true,
						includeStatic: true,
						timeout: 1000, // Very short timeout
					},
					crossChainAnalysis: false,
				});

			expect(analysisResponse.status).toBe(200);
			const auditId = analysisResponse.body.auditId;

			// Check that timeout is handled gracefully
			await new Promise((resolve) => setTimeout(resolve, 5000));

			const statusResponse = await request(app)
				.get(`/api/multi-blockchain/audit/${auditId}/status`)
				.set("Authorization", `Bearer ${authToken}`);

			// Should either be completed or failed, not stuck
			expect(["completed", "failed", "timeout"]).toContain(
				statusResponse.body.status
			);
		});

		it("should handle invalid contract combinations", async () => {
			const response = await request(app)
				.post("/api/multi-blockchain/analyze")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractIds: ["invalid-id-1", "invalid-id-2"],
					platforms: ["solana", "cardano"],
					analysisOptions: {
						includeAI: true,
						includeStatic: true,
						timeout: 30000,
					},
					crossChainAnalysis: true,
				});

			expect(response.status).toBe(400);
			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain("Contract not found");
		});

		it("should handle platform analyzer failures", async () => {
			// This test would require mocking analyzer failures
			// For now, we'll test the error handling structure
			const uploadResponse = await request(app)
				.post("/api/multi-blockchain/upload")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contracts: [
						{
							name: "ErrorTest",
							code: SOLANA_TEST_CONTRACTS.INVALID_RUST_CODE.code,
							filename: "error_test.rs",
							platform: "solana",
							language: "rust",
						},
					],
					platforms: ["solana"],
				});

			const contractIds = uploadResponse.body.contracts.map((c: any) => c.id);

			const analysisResponse = await request(app)
				.post("/api/multi-blockchain/analyze")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					contractIds,
					platforms: ["solana"],
					analysisOptions: {
						includeAI: false,
						includeStatic: true,
						timeout: 30000,
					},
					crossChainAnalysis: false,
				});

			expect(analysisResponse.status).toBe(200);
			const auditId = analysisResponse.body.auditId;

			// Wait for analysis
			let attempts = 0;
			while (attempts < 10) {
				await new Promise((resolve) => setTimeout(resolve, 2000));

				const statusResponse = await request(app)
					.get(`/api/multi-blockchain/audit/${auditId}/status`)
					.set("Authorization", `Bearer ${authToken}`);

				if (
					statusResponse.body.status !== "pending" &&
					statusResponse.body.status !== "analyzing"
				) {
					// Should handle errors gracefully
					expect(["completed", "failed"]).toContain(statusResponse.body.status);
					if (statusResponse.body.status === "completed") {
						expect(statusResponse.body.errors.length).toBeGreaterThan(0);
					}
					break;
				}
				attempts++;
			}
		});
	});
});
