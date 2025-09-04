import { CardanoAnalyzer } from "../services/analyzers/CardanoAnalyzer";
import { AnalyzerFactory } from "../services/analyzers/AnalyzerFactory";
import { ContractInput } from "../types/blockchain";
import {
	CARDANO_TEST_CONTRACTS,
	CARDANO_ANALYSIS_EXPECTATIONS,
} from "./fixtures/cardano-contracts";
import { executePwsh } from "../utils/shellUtils";

// Mock the shell utils for consistent testing
jest.mock("../utils/shellUtils");
const mockExecutePwsh = executePwsh as jest.MockedFunction<typeof executePwsh>;

// Mock fs/promises
jest.mock("fs/promises", () => ({
	access: jest.fn().mockResolvedValue(undefined),
	mkdir: jest.fn().mockResolvedValue(undefined),
	writeFile: jest.fn().mockResolvedValue(undefined),
	rm: jest.fn().mockResolvedValue(undefined),
}));

describe("Cardano Integration Tests", () => {
	let analyzer: CardanoAnalyzer;

	beforeEach(() => {
		analyzer = new CardanoAnalyzer();
		jest.clearAllMocks();

		// Mock successful tool installations by default
		mockExecutePwsh
			.mockResolvedValueOnce({
				exitCode: 0,
				stdout:
					"The Glorious Glasgow Haskell Compilation System, version 9.2.8",
				stderr: "",
			})
			.mockResolvedValueOnce({
				exitCode: 0,
				stdout: "cabal-install version 3.6.2.0",
				stderr: "",
			})
			.mockResolvedValueOnce({
				exitCode: 0,
				stdout: "HLint v3.4.1",
				stderr: "",
			});
	});

	describe("AnalyzerFactory Integration", () => {
		it("should create CardanoAnalyzer through factory", () => {
			const cardanoAnalyzer = AnalyzerFactory.getAnalyzer("cardano");
			expect(cardanoAnalyzer).toBeInstanceOf(CardanoAnalyzer);
			expect(cardanoAnalyzer?.platform).toBe("cardano");
		});

		it("should include Cardano in supported platforms", () => {
			const platforms = AnalyzerFactory.getSupportedPlatformsWithAnalyzers();
			const cardanoPlatform = platforms.find((p) => p.platformId === "cardano");

			expect(cardanoPlatform).toBeDefined();
			expect(cardanoPlatform?.hasAnalyzer).toBe(true);
			expect(cardanoPlatform?.isActive).toBe(true);
		});

		it("should validate Cardano analyzer successfully", async () => {
			const validation = await AnalyzerFactory.validateAnalyzer("cardano");
			expect(validation.valid).toBe(true);
			expect(validation.issues).toHaveLength(0);
		});
	});

	describe("Contract Analysis Scenarios", () => {
		beforeEach(() => {
			// Mock HLint to return empty results for most tests
			mockExecutePwsh.mockResolvedValue({
				exitCode: 0,
				stdout: "[]",
				stderr: "",
			});
		});

		it("should analyze valid Plutus validator successfully", async () => {
			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
				filename: "ValidValidator.hs",
				platform: "cardano",
			};

			const result = await analyzer.analyze([contract]);
			const expectations = CARDANO_ANALYSIS_EXPECTATIONS.VALID_PLUTUS_VALIDATOR;

			expect(result.success).toBe(expectations.shouldPass);
			expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(
				expectations.expectedVulnerabilities
			);
			expect(result.executionTime).toBeGreaterThan(0);
			expect(result.platformSpecific).toBeDefined();
			expect(result.platformSpecific?.contractsAnalyzed).toBe(1);
		});

		it("should detect vulnerabilities in vulnerable Plutus validator", async () => {
			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.VULNERABLE_PLUTUS_VALIDATOR,
				filename: "VulnerableValidator.hs",
				platform: "cardano",
			};

			const result = await analyzer.analyze([contract]);
			const expectations =
				CARDANO_ANALYSIS_EXPECTATIONS.VULNERABLE_PLUTUS_VALIDATOR;

			expect(result.success).toBe(true); // Analysis succeeds even with vulnerabilities
			expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(
				expectations.expectedVulnerabilities
			);

			// Check for specific vulnerability types
			const vulnTypes = result.vulnerabilities.map((v) => v.type);
			for (const expectedType of expectations.vulnerabilityTypes) {
				expect(vulnTypes).toContain(expectedType);
			}
		});

		it("should detect missing ScriptContext usage", async () => {
			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.MISSING_CONTEXT_VALIDATOR,
				filename: "MissingContextValidator.hs",
				platform: "cardano",
			};

			const result = await analyzer.analyze([contract]);
			const expectations =
				CARDANO_ANALYSIS_EXPECTATIONS.MISSING_CONTEXT_VALIDATOR;

			expect(result.success).toBe(expectations.shouldPass);
			expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(
				expectations.expectedVulnerabilities
			);

			const contextVulns = result.vulnerabilities.filter(
				(v) => v.type === "plutus-missing-context"
			);
			expect(contextVulns.length).toBeGreaterThan(0);
		});

		it("should analyze Haskell modules and detect partial functions", async () => {
			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.HASKELL_MODULE,
				filename: "CardanoUtils.hs",
				platform: "cardano",
			};

			const result = await analyzer.analyze([contract]);
			const expectations = CARDANO_ANALYSIS_EXPECTATIONS.HASKELL_MODULE;

			expect(result.success).toBe(expectations.shouldPass);

			// Check for partial function warnings
			const partialFunctionWarnings = result.warnings.filter((w) =>
				w.includes("partial function")
			);
			expect(partialFunctionWarnings.length).toBeGreaterThan(0);
		});

		it("should detect unsafe datum handling", async () => {
			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.UNSAFE_DATUM_HANDLING,
				filename: "UnsafeDatumValidator.hs",
				platform: "cardano",
			};

			const result = await analyzer.analyze([contract]);
			const expectations = CARDANO_ANALYSIS_EXPECTATIONS.UNSAFE_DATUM_HANDLING;

			expect(result.success).toBe(expectations.shouldPass);
			expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(
				expectations.expectedVulnerabilities
			);

			const datumVulns = result.vulnerabilities.filter(
				(v) =>
					v.type === "plutus-unsafe-datum" ||
					v.type === "plutus-missing-value-validation"
			);
			expect(datumVulns.length).toBeGreaterThan(0);
		});

		it("should detect eUTXO compliance issues", async () => {
			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.EUTXO_NON_COMPLIANT,
				filename: "NonCompliantValidator.hs",
				platform: "cardano",
			};

			const result = await analyzer.analyze([contract]);
			const expectations = CARDANO_ANALYSIS_EXPECTATIONS.EUTXO_NON_COMPLIANT;

			expect(result.success).toBe(expectations.shouldPass);
			expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(
				expectations.expectedVulnerabilities
			);

			const eutxoVulns = result.vulnerabilities.filter(
				(v) =>
					v.type === "cardano-eutxo-compliance" ||
					v.type === "cardano-utxo-validation"
			);
			expect(eutxoVulns.length).toBeGreaterThan(0);
		});
	});

	describe("HLint Integration", () => {
		it("should parse HLint JSON output correctly", async () => {
			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.HASKELL_MODULE,
				filename: "CardanoUtils.hs",
				platform: "cardano",
			};

			// Mock HLint output with actual suggestions
			mockExecutePwsh.mockResolvedValueOnce({
				exitCode: 0,
				stdout: JSON.stringify([
					{
						hint: "Use head",
						severity: "Warning",
						startLine: 10,
						startColumn: 17,
						endColumn: 24,
						from: "head xs",
						to: "listToMaybe xs",
					},
					{
						hint: "Avoid lambda",
						severity: "Suggestion",
						startLine: 15,
						startColumn: 5,
						endColumn: 20,
						from: "\\x -> f x",
						to: "f",
					},
				]),
				stderr: "",
			});

			const result = await analyzer.analyze([contract]);

			expect(result.success).toBe(true);
			expect(result.vulnerabilities.length).toBeGreaterThan(0);

			const hlintVulns = result.vulnerabilities.filter(
				(v) => v.source === "static" && v.platformSpecificData?.hlintHint
			);
			expect(hlintVulns.length).toBe(2);
			expect(hlintVulns[0].type).toBe("Use head");
			expect(hlintVulns[1].type).toBe("Avoid lambda");
		});

		it("should handle HLint errors gracefully", async () => {
			const contract: ContractInput = {
				code: "invalid haskell syntax {{{",
				filename: "invalid.hs",
				platform: "cardano",
			};

			// Mock HLint failure
			mockExecutePwsh.mockResolvedValueOnce({
				exitCode: 1,
				stdout: "",
				stderr: "Parse error: unexpected token",
			});

			const result = await analyzer.analyze([contract]);

			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe("Multi-Contract Analysis", () => {
		it("should analyze multiple Cardano contracts", async () => {
			const contracts: ContractInput[] = [
				{
					code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
					filename: "ValidValidator.hs",
					platform: "cardano",
				},
				{
					code: CARDANO_TEST_CONTRACTS.HASKELL_MODULE,
					filename: "CardanoUtils.hs",
					platform: "cardano",
				},
			];

			// Mock HLint for each contract
			mockExecutePwsh
				.mockResolvedValueOnce({ exitCode: 0, stdout: "[]", stderr: "" })
				.mockResolvedValueOnce({ exitCode: 0, stdout: "[]", stderr: "" });

			const result = await analyzer.analyze(contracts);

			expect(result.success).toBe(true);
			expect(result.platformSpecific?.contractsAnalyzed).toBe(2);
			expect(result.executionTime).toBeGreaterThan(0);
		});

		it("should continue analysis when one contract fails", async () => {
			const contracts: ContractInput[] = [
				{
					code: "invalid syntax {{{",
					filename: "invalid.hs",
					platform: "cardano",
				},
				{
					code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
					filename: "ValidValidator.hs",
					platform: "cardano",
				},
			];

			const result = await analyzer.analyze(contracts);

			expect(result.success).toBe(false); // Overall failure due to invalid contract
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toContain("Unmatched braces detected");
		});
	});

	describe("Performance and Resource Management", () => {
		it("should handle timeout scenarios", async () => {
			const analyzer = new CardanoAnalyzer({ timeout: 100 }); // Very short timeout

			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
				filename: "ValidValidator.hs",
				platform: "cardano",
			};

			// Mock a slow HLint response
			mockExecutePwsh.mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() => resolve({ exitCode: 0, stdout: "[]", stderr: "" }),
							200
						)
					)
			);

			const result = await analyzer.analyze([contract]);

			// Should handle timeout gracefully
			expect(result.success).toBe(false);
			expect(
				result.errors.some((e) => e.includes("timeout") || e.includes("failed"))
			).toBe(true);
		});

		it("should cleanup temporary files", async () => {
			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
				filename: "ValidValidator.hs",
				platform: "cardano",
			};

			mockExecutePwsh.mockResolvedValue({
				exitCode: 0,
				stdout: "[]",
				stderr: "",
			});

			await analyzer.analyze([contract]);

			// Verify cleanup was called (mocked fs.rm should have been called)
			const fs = require("fs/promises");
			expect(fs.rm).toHaveBeenCalled();
		});
	});

	describe("Error Handling and Edge Cases", () => {
		it("should handle empty contract code", async () => {
			const contract: ContractInput = {
				code: "",
				filename: "empty.hs",
				platform: "cardano",
			};

			const result = await analyzer.analyze([contract]);

			expect(result.success).toBe(false);
			expect(result.errors).toContain("Contract code cannot be empty");
		});

		it("should handle very large contracts", async () => {
			const largeCode = "module Large where\n" + "x = 1\n".repeat(10000);
			const contract: ContractInput = {
				code: largeCode,
				filename: "large.hs",
				platform: "cardano",
			};

			mockExecutePwsh.mockResolvedValue({
				exitCode: 0,
				stdout: "[]",
				stderr: "",
			});

			const result = await analyzer.analyze([contract]);

			expect(result.success).toBe(true);
			expect(result.platformSpecific?.totalLinesOfCode).toBeGreaterThan(10000);
		});

		it("should handle platform mismatch gracefully", async () => {
			const contract: ContractInput = {
				code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
				filename: "ValidValidator.hs",
				platform: "ethereum", // Wrong platform
			};

			const validation = await analyzer.validateContract(contract);

			expect(validation.warnings).toContain(
				"Contract platform 'ethereum' does not match analyzer platform 'cardano'"
			);
		});
	});

	describe("AI Analysis Integration", () => {
		it("should generate appropriate Cardano-specific prompts", () => {
			const plutusCode = CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR;
			const prompt = (analyzer as any).createCardanoAnalysisPrompt(
				plutusCode,
				"validator.hs"
			);

			expect(prompt).toContain("Cardano smart contract security auditor");
			expect(prompt).toContain("Plutus");
			expect(prompt).toContain("UTXO Model Security");
			expect(prompt).toContain("Datum and Redeemer Validation");
			expect(prompt).toContain("Script Context Validation");
			expect(prompt).toContain("Script Efficiency");
			expect(prompt).toContain(plutusCode);
		});

		it("should convert AI vulnerabilities to platform format", () => {
			const aiVuln = {
				type: "utxo-validation",
				severity: "high",
				description: "Missing UTXO validation in validator function",
				location: { line: 10, column: 5 },
				confidence: 0.8,
			};

			const platformVuln = (analyzer as any).convertAIVulnerabilityToPlatform(
				aiVuln,
				"validator.hs"
			);

			expect(platformVuln.type).toBe("utxo-validation");
			expect(platformVuln.severity).toBe("high");
			expect(platformVuln.platform).toBe("cardano");
			expect(platformVuln.source).toBe("ai");
			expect(platformVuln.location.file).toBe("validator.hs");
			expect(platformVuln.recommendation).toContain("UTXO");
		});
	});
});
