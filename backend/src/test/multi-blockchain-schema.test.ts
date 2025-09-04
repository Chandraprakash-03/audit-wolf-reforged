import { describe, it, expect } from "@jest/globals";
import {
	BlockchainPlatform,
	MultiChainAudit,
	PlatformVulnerability,
	CrossChainAnalysis,
	ContractDependency,
	CrossChainConfig,
	Contract,
} from "../types/database";

describe("Multi-Blockchain Database Schema Types", () => {
	describe("BlockchainPlatform Interface", () => {
		it("should have all required fields", () => {
			const platform: BlockchainPlatform = {
				id: "ethereum",
				name: "Ethereum",
				supported_languages: ["solidity"],
				file_extensions: [".sol"],
				static_analyzers: {
					slither: { command: "slither", version: ">=0.9.0" },
				},
				ai_models: {
					openai: { models: ["gpt-4"], specialization: ["solidity"] },
				},
				validation_rules: {
					file_size_limit: 1048576,
					max_functions: 100,
				},
				is_active: true,
				created_at: new Date(),
				updated_at: new Date(),
			};

			expect(platform.id).toBe("ethereum");
			expect(platform.supported_languages).toContain("solidity");
			expect(platform.file_extensions).toContain(".sol");
			expect(platform.is_active).toBe(true);
		});
	});

	describe("Contract Interface Extensions", () => {
		it("should support multi-blockchain fields", () => {
			const dependencies: ContractDependency[] = [
				{
					name: "@openzeppelin/contracts",
					version: "4.8.0",
					type: "library",
				},
			];

			const crossChainConfig: CrossChainConfig = {
				target_chains: ["ethereum", "polygon"],
				bridge_contracts: {
					ethereum: "0x123...",
					polygon: "0x456...",
				},
				deployment_order: ["ethereum", "polygon"],
			};

			const contract: Contract = {
				id: "test-contract-123",
				user_id: "user-123",
				name: "MultiChainToken",
				source_code: "pragma solidity ^0.8.0; contract Token {}",
				compiler_version: "0.8.19",
				file_hash: "hash123",
				blockchain_platform: "ethereum",
				language: "solidity",
				dependencies,
				cross_chain_config: crossChainConfig,
				created_at: new Date(),
			};

			expect(contract.blockchain_platform).toBe("ethereum");
			expect(contract.language).toBe("solidity");
			expect(contract.dependencies).toHaveLength(1);
			expect(contract.cross_chain_config?.target_chains).toContain("ethereum");
			expect(contract.cross_chain_config?.target_chains).toContain("polygon");
		});
	});

	describe("MultiChainAudit Interface", () => {
		it("should support multi-platform audits", () => {
			const audit: MultiChainAudit = {
				id: "audit-123",
				user_id: "user-123",
				audit_name: "Cross-Chain DeFi Protocol Audit",
				platforms: ["ethereum", "solana", "polygon"],
				contracts: {
					ethereum: [{ name: "EthToken.sol", code: "contract EthToken {}" }],
					solana: [
						{ name: "SolProgram.rs", code: "use anchor_lang::prelude::*;" },
					],
				},
				cross_chain_analysis: true,
				status: "pending",
				created_at: new Date(),
			};

			expect(audit.platforms).toHaveLength(3);
			expect(audit.platforms).toContain("ethereum");
			expect(audit.platforms).toContain("solana");
			expect(audit.cross_chain_analysis).toBe(true);
			expect(audit.status).toBe("pending");
		});
	});

	describe("PlatformVulnerability Interface", () => {
		it("should support platform-specific vulnerabilities", () => {
			const ethVulnerability: PlatformVulnerability = {
				id: "vuln-123",
				multi_chain_audit_id: "audit-123",
				platform: "ethereum",
				vulnerability_type: "reentrancy",
				severity: "high",
				title: "Reentrancy Attack Vector",
				description: "Contract is vulnerable to reentrancy attacks",
				location: {
					file: "Token.sol",
					line: 42,
					column: 10,
				},
				recommendation: "Use ReentrancyGuard modifier",
				platform_specific_data: {
					evm_specific: true,
					gas_impact: "high",
					affected_functions: ["withdraw", "transfer"],
				},
				confidence: 0.95,
				source: "static",
				created_at: new Date(),
			};

			expect(ethVulnerability.platform).toBe("ethereum");
			expect(ethVulnerability.platform_specific_data?.evm_specific).toBe(true);
		});
	});

	describe("CrossChainAnalysis Interface", () => {
		it("should support cross-chain analysis results", () => {
			const analysis: CrossChainAnalysis = {
				id: "analysis-123",
				multi_chain_audit_id: "audit-123",
				bridge_security_assessment: {
					overall_score: 7.5,
					locking_mechanisms: {
						score: 8,
						issues: [],
					},
				},
				interoperability_risks: {
					risks: [
						{
							type: "bridge_failure",
							severity: "high",
							probability: 0.1,
						},
					],
				},
				created_at: new Date(),
			};

			expect(analysis.bridge_security_assessment?.overall_score).toBe(7.5);
			expect(analysis.interoperability_risks?.risks).toHaveLength(1);
		});
	});
});
