import { describe, it, expect, beforeEach } from "@jest/globals";
import {
	PlatformContextEngine,
	platformContextEngine,
} from "../services/PlatformContextEngine";
import { ContractInput, PlatformVulnerability } from "../types/blockchain";

describe("PlatformContextEngine", () => {
	let contextEngine: PlatformContextEngine;

	beforeEach(() => {
		contextEngine = new PlatformContextEngine();
	});

	describe("Platform Context Retrieval", () => {
		it("should return Ethereum context", () => {
			const context = contextEngine.getPlatformContext("ethereum");

			expect(context).toBeDefined();
			expect(context?.platform).toBe("ethereum");
			expect(context?.contextPrompts).toContain(
				"You are analyzing Ethereum/EVM smart contracts written in Solidity."
			);
			expect(context?.bestPractices).toContain(
				"Use ReentrancyGuard from OpenZeppelin for state-changing external calls"
			);
		});

		it("should return Solana context", () => {
			const context = contextEngine.getPlatformContext("solana");

			expect(context).toBeDefined();
			expect(context?.platform).toBe("solana");
			expect(context?.contextPrompts).toContain(
				"You are analyzing Solana programs written in Rust, potentially using the Anchor framework."
			);
			expect(context?.bestPractices).toContain(
				"Always validate account ownership and signers"
			);
		});

		it("should return Cardano context", () => {
			const context = contextEngine.getPlatformContext("cardano");

			expect(context).toBeDefined();
			expect(context?.platform).toBe("cardano");
			expect(context?.contextPrompts).toContain(
				"You are analyzing Cardano smart contracts written in Plutus/Haskell."
			);
			expect(context?.bestPractices).toContain(
				"Validate all datums and redeemers thoroughly"
			);
		});

		it("should return null for unknown platform", () => {
			const context = contextEngine.getPlatformContext("unknown");
			expect(context).toBeNull();
		});
	});

	describe("Platform Analysis Prompt Creation", () => {
		it("should create Ethereum-specific analysis prompt", () => {
			const contract: ContractInput = {
				code: "pragma solidity ^0.8.0;\ncontract Test {}",
				filename: "Test.sol",
				platform: "ethereum",
				language: "solidity",
			};

			const prompt = contextEngine.createPlatformAnalysisPrompt(contract, {
				platform: "ethereum",
				focusAreas: ["reentrancy", "access-control"],
			});

			expect(prompt).toContain("Ethereum");
			expect(prompt).toContain("Solidity");
			expect(prompt).toContain("Reentrancy vulnerabilities");
			expect(prompt).toContain("checks-effects-interactions pattern");
			expect(prompt).toContain("pragma solidity ^0.8.0;");
		});

		it("should create Solana-specific analysis prompt", () => {
			const contract: ContractInput = {
				code: "use anchor_lang::prelude::*;\n#[program]\npub mod test {}",
				filename: "test.rs",
				platform: "solana",
				language: "rust",
			};

			const prompt = contextEngine.createPlatformAnalysisPrompt(contract, {
				platform: "solana",
				focusAreas: ["pda-security", "account-validation"],
			});

			expect(prompt).toContain("Solana");
			expect(prompt).toContain("Anchor");
			expect(prompt).toContain("PDA security");
			expect(prompt).toContain("account validation");
			expect(prompt).toContain("use anchor_lang::prelude::*;");
		});

		it("should create Cardano-specific analysis prompt", () => {
			const contract: ContractInput = {
				code: "import Plutus.V2.Ledger.Api\nvalidator :: BuiltinData -> BuiltinData -> BuiltinData -> ()",
				filename: "validator.hs",
				platform: "cardano",
				language: "haskell",
			};

			const prompt = contextEngine.createPlatformAnalysisPrompt(contract, {
				platform: "cardano",
				focusAreas: ["utxo-validation", "datum-validation"],
			});

			expect(prompt).toContain("Cardano");
			expect(prompt).toContain("Plutus");
			expect(prompt).toContain("UTXO model");
			expect(prompt).toContain("datum validation");
			expect(prompt).toContain("import Plutus.V2.Ledger.Api");
		});

		it("should create generic prompt for unknown platform", () => {
			const contract: ContractInput = {
				code: "some code",
				filename: "contract.txt",
				platform: "unknown",
				language: "text",
			};

			const prompt = contextEngine.createPlatformAnalysisPrompt(contract, {
				platform: "unknown",
			});

			expect(prompt).toContain("smart contract security auditor");
			expect(prompt).toContain("Access control issues");
			expect(prompt).toContain("some code");
		});
	});

	describe("Vulnerability Mapping", () => {
		it("should map Ethereum vulnerabilities correctly", () => {
			const platformVulns = [
				{
					type: "reentrancy-eth",
					severity: "high",
					description: "Reentrancy vulnerability detected",
					location: { file: "test.sol", line: 10, column: 5 },
					confidence: 0.9,
				},
				{
					type: "access-control-missing",
					severity: "medium",
					description: "Missing access control",
					location: { file: "test.sol", line: 15, column: 1 },
					confidence: 0.8,
				},
			];

			const mapped = contextEngine.mapVulnerabilities(
				platformVulns,
				"ethereum"
			);

			expect(mapped).toHaveLength(2);
			expect(mapped[0].type).toBe("reentrancy");
			expect(mapped[0].severity).toBe("high");
			expect(mapped[0].platform).toBe("ethereum");
			expect(mapped[0].platformSpecificData?.originalType).toBe(
				"reentrancy-eth"
			);

			expect(mapped[1].type).toBe("access_control");
			expect(mapped[1].severity).toBe("medium");
			expect(mapped[1].platform).toBe("ethereum");
		});

		it("should map Solana vulnerabilities correctly", () => {
			const platformVulns = [
				{
					type: "pda-security",
					severity: "critical",
					description: "Insecure PDA usage",
					location: { file: "program.rs", line: 20, column: 10 },
					confidence: 0.95,
				},
				{
					type: "account-validation",
					severity: "high",
					description: "Missing account validation",
					location: { file: "program.rs", line: 25, column: 5 },
					confidence: 0.85,
				},
			];

			const mapped = contextEngine.mapVulnerabilities(platformVulns, "solana");

			expect(mapped).toHaveLength(2);
			expect(mapped[0].type).toBe("security");
			expect(mapped[0].severity).toBe("critical");
			expect(mapped[0].platform).toBe("solana");
			expect(mapped[0].recommendation).toContain("canonical bump seeds");

			expect(mapped[1].type).toBe("access_control");
			expect(mapped[1].severity).toBe("high");
			expect(mapped[1].platform).toBe("solana");
		});

		it("should handle unknown vulnerability types with generic mapping", () => {
			const platformVulns = [
				{
					type: "unknown-vulnerability",
					severity: "medium",
					description: "Unknown security issue",
					location: { file: "contract.sol", line: 1, column: 1 },
					confidence: 0.7,
				},
			];

			const mapped = contextEngine.mapVulnerabilities(
				platformVulns,
				"ethereum"
			);

			expect(mapped).toHaveLength(1);
			expect(mapped[0].type).toBe("security"); // Default fallback
			expect(mapped[0].severity).toBe("medium");
			expect(mapped[0].platformSpecificData?.mappingUsed).toBe("generic");
		});
	});

	describe("Platform Recommendations", () => {
		it("should generate Ethereum-specific recommendations", () => {
			const vulnerabilities: PlatformVulnerability[] = [
				{
					type: "reentrancy",
					severity: "high",
					title: "Reentrancy Issue",
					description: "Reentrancy vulnerability",
					location: { file: "test.sol", line: 10, column: 5 },
					recommendation: "Use reentrancy guard",
					confidence: 0.9,
					source: "ai",
					platform: "ethereum",
				},
			];

			const recommendations = contextEngine.getPlatformRecommendations(
				vulnerabilities,
				"ethereum"
			);

			expect(recommendations.length).toBeGreaterThan(0);
			expect(recommendations.some((r) => r.category.includes("Ethereum"))).toBe(
				true
			);
			expect(
				recommendations.some((r) => r.description.includes("ReentrancyGuard"))
			).toBe(true);
		});

		it("should generate Solana-specific recommendations", () => {
			const vulnerabilities: PlatformVulnerability[] = [
				{
					type: "security",
					severity: "high",
					title: "PDA Security Issue",
					description: "PDA security vulnerability",
					location: { file: "program.rs", line: 20, column: 10 },
					recommendation: "Use canonical bump seeds",
					confidence: 0.9,
					source: "ai",
					platform: "solana",
				},
			];

			const recommendations = contextEngine.getPlatformRecommendations(
				vulnerabilities,
				"solana"
			);

			expect(recommendations.length).toBeGreaterThan(0);
			expect(
				recommendations.some((r) => r.description.includes("account ownership"))
			).toBe(true);
			expect(
				recommendations.some((r) =>
					r.description.includes("canonical bump seeds")
				)
			).toBe(true);
		});
	});

	describe("Singleton Instance", () => {
		it("should provide a singleton instance", () => {
			expect(platformContextEngine).toBeDefined();
			expect(platformContextEngine).toBeInstanceOf(PlatformContextEngine);
		});

		it("should return the same instance on multiple calls", () => {
			const instance1 = platformContextEngine;
			const instance2 = platformContextEngine;
			expect(instance1).toBe(instance2);
		});
	});

	describe("Security Patterns", () => {
		it("should include security patterns for each platform", () => {
			const ethereumContext = contextEngine.getPlatformContext("ethereum");
			const solanaContext = contextEngine.getPlatformContext("solana");
			const cardanoContext = contextEngine.getPlatformContext("cardano");

			expect(ethereumContext?.securityPatterns.length).toBeGreaterThan(0);
			expect(solanaContext?.securityPatterns.length).toBeGreaterThan(0);
			expect(cardanoContext?.securityPatterns.length).toBeGreaterThan(0);

			// Check that patterns have required properties
			ethereumContext?.securityPatterns.forEach((pattern) => {
				expect(pattern.name).toBeDefined();
				expect(pattern.description).toBeDefined();
				expect(pattern.severity).toBeDefined();
				expect(pattern.recommendation).toBeDefined();
			});
		});
	});

	describe("Best Practices", () => {
		it("should include comprehensive best practices for each platform", () => {
			const ethereumContext = contextEngine.getPlatformContext("ethereum");
			const solanaContext = contextEngine.getPlatformContext("solana");
			const cardanoContext = contextEngine.getPlatformContext("cardano");

			expect(ethereumContext?.bestPractices.length).toBeGreaterThanOrEqual(5);
			expect(solanaContext?.bestPractices.length).toBeGreaterThanOrEqual(5);
			expect(cardanoContext?.bestPractices.length).toBeGreaterThanOrEqual(5);

			// Check for platform-specific practices
			expect(
				ethereumContext?.bestPractices.some((p) =>
					p.includes("ReentrancyGuard")
				)
			).toBe(true);
			expect(solanaContext?.bestPractices.some((p) => p.includes("PDA"))).toBe(
				true
			);
			expect(
				cardanoContext?.bestPractices.some((p) => p.includes("datum"))
			).toBe(true);
		});
	});
});
