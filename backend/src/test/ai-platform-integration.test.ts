import { describe, it, expect } from "@jest/globals";
import { platformContextEngine } from "../services/PlatformContextEngine";
import { ContractInput } from "../types/blockchain";

describe("AI Platform Integration", () => {
	describe("Platform Context Integration", () => {
		it("should create platform-specific prompts for different blockchains", () => {
			const ethereumContract: ContractInput = {
				code: "pragma solidity ^0.8.0;\ncontract Test { function withdraw() external {} }",
				filename: "Test.sol",
				platform: "ethereum",
				language: "solidity",
			};

			const solanaContract: ContractInput = {
				code: "use anchor_lang::prelude::*;\n#[program]\npub mod test {}",
				filename: "test.rs",
				platform: "solana",
				language: "rust",
			};

			const cardanoContract: ContractInput = {
				code: "import Plutus.V2.Ledger.Api\nvalidator :: BuiltinData -> BuiltinData -> BuiltinData -> ()",
				filename: "validator.hs",
				platform: "cardano",
				language: "haskell",
			};

			const ethereumPrompt =
				platformContextEngine.createPlatformAnalysisPrompt(ethereumContract);
			const solanaPrompt =
				platformContextEngine.createPlatformAnalysisPrompt(solanaContract);
			const cardanoPrompt =
				platformContextEngine.createPlatformAnalysisPrompt(cardanoContract);

			// Verify each prompt contains platform-specific content
			expect(ethereumPrompt).toContain("Ethereum");
			expect(ethereumPrompt).toContain("Solidity");
			expect(ethereumPrompt).toContain("reentrancy");
			expect(ethereumPrompt).toContain("ReentrancyGuard");

			expect(solanaPrompt).toContain("Solana");
			expect(solanaPrompt).toContain("Anchor");
			expect(solanaPrompt).toContain("PDA");
			expect(solanaPrompt).toContain("account validation");

			expect(cardanoPrompt).toContain("Cardano");
			expect(cardanoPrompt).toContain("Plutus");
			expect(cardanoPrompt).toContain("UTXO");
			expect(cardanoPrompt).toContain("datum");
		});

		it("should map vulnerabilities correctly for each platform", () => {
			// Test Ethereum vulnerability mapping
			const ethereumVulns = [
				{
					type: "reentrancy-eth",
					severity: "high",
					description: "Reentrancy vulnerability",
					location: { file: "test.sol", line: 10, column: 5 },
					confidence: 0.9,
				},
			];

			const mappedEthereum = platformContextEngine.mapVulnerabilities(
				ethereumVulns,
				"ethereum"
			);
			expect(mappedEthereum[0].type).toBe("reentrancy");
			expect(mappedEthereum[0].platform).toBe("ethereum");
			expect(mappedEthereum[0].recommendation).toContain("ReentrancyGuard");

			// Test Solana vulnerability mapping
			const solanaVulns = [
				{
					type: "pda-security",
					severity: "critical",
					description: "PDA security issue",
					location: { file: "program.rs", line: 20, column: 10 },
					confidence: 0.95,
				},
			];

			const mappedSolana = platformContextEngine.mapVulnerabilities(
				solanaVulns,
				"solana"
			);
			expect(mappedSolana[0].type).toBe("security");
			expect(mappedSolana[0].platform).toBe("solana");
			expect(mappedSolana[0].recommendation).toContain("canonical bump seeds");

			// Test Cardano vulnerability mapping
			const cardanoVulns = [
				{
					type: "utxo-validation",
					severity: "high",
					description: "UTXO validation issue",
					location: { file: "validator.hs", line: 15, column: 1 },
					confidence: 0.85,
				},
			];

			const mappedCardano = platformContextEngine.mapVulnerabilities(
				cardanoVulns,
				"cardano"
			);
			expect(mappedCardano[0].type).toBe("security");
			expect(mappedCardano[0].platform).toBe("cardano");
			expect(mappedCardano[0].recommendation).toContain("UTXO validation");
		});

		it("should provide platform-specific recommendations", () => {
			const ethereumVulns = [
				{
					type: "reentrancy",
					severity: "high" as const,
					title: "Reentrancy Issue",
					description: "Reentrancy vulnerability",
					location: { file: "test.sol", line: 10, column: 5 },
					recommendation: "Use reentrancy guard",
					confidence: 0.9,
					source: "ai" as const,
					platform: "ethereum",
				},
			];

			const recommendations = platformContextEngine.getPlatformRecommendations(
				ethereumVulns,
				"ethereum"
			);

			expect(recommendations.length).toBeGreaterThan(0);
			expect(recommendations.some((r) => r.category.includes("Ethereum"))).toBe(
				true
			);
			expect(
				recommendations.some(
					(r) =>
						r.description.includes("ReentrancyGuard") ||
						r.implementation_guide.includes("ReentrancyGuard")
				)
			).toBe(true);
		});

		it("should handle unknown platforms gracefully", () => {
			const unknownContract: ContractInput = {
				code: "some unknown code",
				filename: "unknown.txt",
				platform: "unknown",
				language: "text",
			};

			const prompt =
				platformContextEngine.createPlatformAnalysisPrompt(unknownContract);
			expect(prompt).toContain("smart contract security auditor");
			expect(prompt).toContain("some unknown code");

			const unknownVulns = [
				{
					type: "unknown-type",
					severity: "medium",
					description: "Unknown vulnerability",
					location: { file: "unknown.txt", line: 1, column: 1 },
					confidence: 0.7,
				},
			];

			const mapped = platformContextEngine.mapVulnerabilities(
				unknownVulns,
				"unknown"
			);
			expect(mapped[0].type).toBe("security"); // Should default to 'security'
			expect(mapped[0].platformSpecificData?.mappingUsed).toBe("generic");
		});
	});

	describe("Context Engine Features", () => {
		it("should provide comprehensive security patterns for each platform", () => {
			const ethereumContext =
				platformContextEngine.getPlatformContext("ethereum");
			const solanaContext = platformContextEngine.getPlatformContext("solana");
			const cardanoContext =
				platformContextEngine.getPlatformContext("cardano");

			expect(ethereumContext?.securityPatterns.length).toBeGreaterThan(0);
			expect(solanaContext?.securityPatterns.length).toBeGreaterThan(0);
			expect(cardanoContext?.securityPatterns.length).toBeGreaterThan(0);

			// Verify patterns have required structure
			ethereumContext?.securityPatterns.forEach((pattern) => {
				expect(pattern.name).toBeDefined();
				expect(pattern.description).toBeDefined();
				expect(pattern.severity).toBeDefined();
				expect(pattern.recommendation).toBeDefined();
			});
		});

		it("should include platform-specific best practices", () => {
			const ethereumContext =
				platformContextEngine.getPlatformContext("ethereum");
			const solanaContext = platformContextEngine.getPlatformContext("solana");
			const cardanoContext =
				platformContextEngine.getPlatformContext("cardano");

			// Check for platform-specific practices
			expect(
				ethereumContext?.bestPractices.some((p) =>
					p.includes("ReentrancyGuard")
				)
			).toBe(true);
			expect(
				ethereumContext?.bestPractices.some((p) => p.includes("SafeMath"))
			).toBe(true);

			expect(solanaContext?.bestPractices.some((p) => p.includes("PDA"))).toBe(
				true
			);
			expect(
				solanaContext?.bestPractices.some((p) =>
					p.includes("account ownership")
				)
			).toBe(true);

			expect(
				cardanoContext?.bestPractices.some((p) => p.includes("datum"))
			).toBe(true);
			expect(
				cardanoContext?.bestPractices.some((p) => p.includes("UTXO"))
			).toBe(true);
		});

		it("should provide detailed analysis instructions for each platform", () => {
			const ethereumContext =
				platformContextEngine.getPlatformContext("ethereum");
			const solanaContext = platformContextEngine.getPlatformContext("solana");
			const cardanoContext =
				platformContextEngine.getPlatformContext("cardano");

			expect(ethereumContext?.analysisInstructions).toContain(
				"Reentrancy vulnerabilities"
			);
			expect(ethereumContext?.analysisInstructions).toContain("MEV");
			expect(ethereumContext?.analysisInstructions).toContain(
				"Gas optimization"
			);

			expect(solanaContext?.analysisInstructions).toContain(
				"Account model security"
			);
			expect(solanaContext?.analysisInstructions).toContain("PDA");
			expect(solanaContext?.analysisInstructions).toContain("Compute unit");

			expect(cardanoContext?.analysisInstructions).toContain("UTXO model");
			expect(cardanoContext?.analysisInstructions).toContain("Plutus script");
			expect(cardanoContext?.analysisInstructions).toContain(
				"Datum and redeemer validation"
			);
		});
	});
});
