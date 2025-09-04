import { CardanoAnalyzer } from "../services/analyzers/CardanoAnalyzer";
import { ContractInput } from "../types/blockchain";
import { executePwsh } from "../utils/shellUtils";

// Mock the shell utils
jest.mock("../utils/shellUtils");
const mockExecutePwsh = executePwsh as jest.MockedFunction<typeof executePwsh>;

// Mock fs/promises
jest.mock("fs/promises", () => ({
	access: jest.fn(),
	mkdir: jest.fn(),
	writeFile: jest.fn(),
	rm: jest.fn(),
}));

describe("CardanoAnalyzer", () => {
	let analyzer: CardanoAnalyzer;

	beforeEach(() => {
		analyzer = new CardanoAnalyzer();
		jest.clearAllMocks();
	});

	describe("Platform Detection", () => {
		it("should detect Plutus scripts correctly", () => {
			const plutusCode = `
import Plutus.V2.Ledger.Api
import PlutusTx

validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator _ _ _ = True
`;
			expect((analyzer as any).isPlutusScript(plutusCode)).toBe(true);
		});

		it("should detect Haskell programs correctly", () => {
			const haskellCode = `
module MyModule where

import Data.List

data MyType = MyType Int String

myFunction :: Int -> String
myFunction x = show x
`;
			expect((analyzer as any).isHaskellProgram(haskellCode)).toBe(true);
		});

		it("should not detect non-Cardano code", () => {
			const solidityCode = `
pragma solidity ^0.8.0;

contract MyContract {
    uint256 public value;
}
`;
			expect((analyzer as any).isPlutusScript(solidityCode)).toBe(false);
			expect((analyzer as any).isHaskellProgram(solidityCode)).toBe(false);
		});
	});

	describe("Contract Validation", () => {
		it("should validate Plutus contracts successfully", async () => {
			const contract: ContractInput = {
				code: `
import Plutus.V2.Ledger.Api
import PlutusTx

validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = 
    traceIfFalse "Invalid datum" (checkDatum datum) &&
    traceIfFalse "Invalid context" (checkContext ctx)
  where
    checkDatum _ = True
    checkContext _ = True
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const result = await analyzer.validateContract(contract);
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should detect validation issues in Plutus contracts", async () => {
			const contract: ContractInput = {
				code: `
import Plutus.V2.Ledger.Api

validator :: BuiltinData -> BuiltinData -> Bool
validator datum redeemer = True  -- Missing ScriptContext
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const result = await analyzer.validateContract(contract);
			expect(result.warnings).toContain(
				"Validator function should use ScriptContext for validation"
			);
		});

		it("should detect syntax errors", async () => {
			const contract: ContractInput = {
				code: `
import Plutus.V2.Ledger.Api

validator :: BuiltinData -> BuiltinData -> Bool
validator datum redeemer = (True  -- Unmatched parenthesis
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const result = await analyzer.validateContract(contract);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Unmatched parentheses detected");
		});

		it("should detect partial function usage", async () => {
			const contract: ContractInput = {
				code: `
module MyModule where

myFunction :: [Int] -> Int
myFunction xs = head xs  -- Partial function
`,
				filename: "module.hs",
				platform: "cardano",
			};

			const result = await analyzer.validateContract(contract);
			expect(result.warnings).toContain(
				"Potential use of partial function 'head' detected"
			);
		});
	});

	describe("Health Check", () => {
		it("should pass health check when tools are installed", async () => {
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

			const result = await analyzer.checkHealth();
			expect(result.installed).toBe(true);
			expect(result.version).toContain("GHC");
			expect(result.version).toContain("Cabal");
			expect(result.version).toContain("HLint");
		});

		it("should fail health check when GHC is not installed", async () => {
			mockExecutePwsh.mockRejectedValueOnce(new Error("GHC not found"));

			const result = await analyzer.checkHealth();
			expect(result.installed).toBe(false);
			expect(result.error).toContain("GHC not installed");
		});

		it("should fail health check when Cabal is not installed", async () => {
			mockExecutePwsh
				.mockResolvedValueOnce({
					exitCode: 0,
					stdout:
						"The Glorious Glasgow Haskell Compilation System, version 9.2.8",
					stderr: "",
				})
				.mockRejectedValueOnce(new Error("Cabal not found"));

			const result = await analyzer.checkHealth();
			expect(result.installed).toBe(false);
			expect(result.error).toContain("Cabal not installed");
		});
	});

	describe("Static Analysis", () => {
		it("should run HLint analysis successfully", async () => {
			const contract: ContractInput = {
				code: `
module MyModule where

myFunction :: [Int] -> Int
myFunction xs = head xs
`,
				filename: "module.hs",
				platform: "cardano",
			};

			// Mock HLint output
			mockExecutePwsh.mockResolvedValueOnce({
				exitCode: 0,
				stdout: JSON.stringify([
					{
						hint: "Use head",
						severity: "Warning",
						startLine: 4,
						startColumn: 17,
						endColumn: 24,
						from: "head xs",
						to: "xs !! 0",
					},
				]),
				stderr: "",
			});

			const result = await (analyzer as any).runHLint("/tmp/test", contract);
			expect(result.success).toBe(true);
			expect(result.vulnerabilities).toHaveLength(1);
			expect(result.vulnerabilities[0].type).toBe("Use head");
			expect(result.vulnerabilities[0].severity).toBe("medium");
		});

		it("should handle HLint parsing errors gracefully", async () => {
			const contract: ContractInput = {
				code: "module Test where",
				filename: "test.hs",
				platform: "cardano",
			};

			// Mock invalid JSON output
			mockExecutePwsh.mockResolvedValueOnce({
				exitCode: 0,
				stdout: "invalid json",
				stderr: "",
			});

			const result = await (analyzer as any).runHLint("/tmp/test", contract);
			expect(result.success).toBe(true);
			expect(result.warnings).toContain("Failed to parse HLint output");
		});
	});

	describe("Plutus Pattern Analysis", () => {
		it("should detect missing script context in validators", () => {
			const contract: ContractInput = {
				code: `
validator :: BuiltinData -> BuiltinData -> Bool
validator datum redeemer = True
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const vulnerabilities = (analyzer as any).checkPlutusPatterns(contract);
			expect(vulnerabilities.length).toBeGreaterThanOrEqual(1);

			const contextVulns = vulnerabilities.filter(
				(v: any) => v.type === "plutus-missing-context"
			);
			expect(contextVulns).toHaveLength(1);
			expect(contextVulns[0].severity).toBe("high");
		});

		it("should detect unsafe datum handling", () => {
			const contract: ContractInput = {
				code: `
validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = 
    let myData = datum  -- Using BuiltinData without fromBuiltinData
    in True
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const vulnerabilities = (analyzer as any).checkPlutusPatterns(contract);
			expect(vulnerabilities).toHaveLength(1);
			expect(vulnerabilities[0].type).toBe("plutus-unsafe-datum");
			expect(vulnerabilities[0].severity).toBe("medium");
		});

		it("should detect missing value validation", () => {
			const contract: ContractInput = {
				code: `
validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = 
    let val = getValue ctx  -- Using Value without valueOf
    in True
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const vulnerabilities = (analyzer as any).checkPlutusPatterns(contract);
			expect(vulnerabilities.length).toBeGreaterThanOrEqual(1);

			const valueVulns = vulnerabilities.filter(
				(v: any) => v.type === "plutus-missing-value-validation"
			);
			expect(valueVulns).toHaveLength(1);
			expect(valueVulns[0].severity).toBe("medium");
		});
	});

	describe("Cardano Security Checks", () => {
		it("should validate UTXO handling", () => {
			const contract: ContractInput = {
				code: `
validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = 
    let inputs = txInfoInputs (scriptContextTxInfo ctx)
    in True  -- Missing txOutValue validation
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const vulnerabilities = (analyzer as any).validateUTXOHandling(contract);
			expect(vulnerabilities).toHaveLength(1);
			expect(vulnerabilities[0].type).toBe("cardano-utxo-validation");
			expect(vulnerabilities[0].severity).toBe("medium");
		});

		it("should check datum usage", () => {
			const contract: ContractInput = {
				code: `
validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = 
    let myDatum = datum  -- Using datum without fromBuiltinData
    in True
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const vulnerabilities = (analyzer as any).checkDatumUsage(contract);
			expect(vulnerabilities).toHaveLength(1);
			expect(vulnerabilities[0].type).toBe("cardano-datum-validation");
			expect(vulnerabilities[0].severity).toBe("medium");
		});

		it("should analyze script efficiency", () => {
			const contract: ContractInput = {
				code: `
validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = 
    let result = "hello" ++ " world"  -- Inefficient string concatenation
    in True
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const vulnerabilities = (analyzer as any).analyzePlutusEfficiency(
				contract
			);
			expect(vulnerabilities).toHaveLength(1);
			expect(vulnerabilities[0].type).toBe("cardano-script-efficiency");
			expect(vulnerabilities[0].title).toBe("Inefficient String Concatenation");
		});

		it("should check eUTXO compliance", () => {
			const contract: ContractInput = {
				code: `
validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = True  -- Missing TxInfo usage
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			const vulnerabilities = (analyzer as any).checkEUTXOCompliance(contract);
			expect(vulnerabilities).toHaveLength(1);
			expect(vulnerabilities[0].type).toBe("cardano-eutxo-compliance");
			expect(vulnerabilities[0].severity).toBe("high");
		});
	});

	describe("AI Analysis", () => {
		it("should create Cardano-specific analysis prompt", () => {
			const plutusCode = `
import Plutus.V2.Ledger.Api
validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = True
`;

			const prompt = (analyzer as any).createCardanoAnalysisPrompt(
				plutusCode,
				"validator.hs"
			);

			expect(prompt).toContain("Cardano smart contract security auditor");
			expect(prompt).toContain("Plutus");
			expect(prompt).toContain("UTXO Model Security");
			expect(prompt).toContain("Datum and Redeemer Validation");
			expect(prompt).toContain("Script Context Validation");
			expect(prompt).toContain(plutusCode);
		});

		it("should create Haskell-specific analysis prompt for non-Plutus code", () => {
			const haskellCode = `
module MyModule where
myFunction :: Int -> String
myFunction x = show x
`;

			const prompt = (analyzer as any).createCardanoAnalysisPrompt(
				haskellCode,
				"module.hs"
			);

			expect(prompt).toContain("Haskell");
			expect(prompt).toContain("Type safety and correctness");
			expect(prompt).toContain("Function purity and side effects");
			expect(prompt).toContain(haskellCode);
		});
	});

	describe("Full Analysis Integration", () => {
		it("should perform complete analysis on Plutus contract", async () => {
			const contract: ContractInput = {
				code: `
import Plutus.V2.Ledger.Api
import PlutusTx

validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = 
    traceIfFalse "Invalid datum" (checkDatum datum) &&
    traceIfFalse "Invalid context" (checkContext ctx)
  where
    checkDatum _ = True
    checkContext _ = True
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			// Mock successful tool execution
			mockExecutePwsh.mockResolvedValue({
				exitCode: 0,
				stdout: "[]", // Empty HLint results
				stderr: "",
			});

			const result = await analyzer.analyze([contract]);

			expect(result.success).toBe(true);
			expect(result.executionTime).toBeGreaterThan(0);
			expect(result.platformSpecific).toBeDefined();
			expect(result.platformSpecific?.contractsAnalyzed).toBe(1);
			expect(result.platformSpecific?.analysisTools).toContain("hlint");
			expect(result.platformSpecific?.analysisTools).toContain("plutus-core");
			expect(result.platformSpecific?.analysisTools).toContain(
				"cardano-security-checks"
			);
		});

		it("should handle analysis errors gracefully", async () => {
			const contract: ContractInput = {
				code: "invalid haskell code {{{",
				filename: "invalid.hs",
				platform: "cardano",
			};

			const result = await analyzer.analyze([contract]);

			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(
				result.errors.some((e) => e.includes("Unmatched braces detected"))
			).toBe(true);
		});

		it("should continue with static analysis when AI analysis fails", async () => {
			const contract: ContractInput = {
				code: `
import Plutus.V2.Ledger.Api
validator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
validator datum redeemer ctx = True
`,
				filename: "validator.hs",
				platform: "cardano",
			};

			// Mock successful static analysis but failing AI
			mockExecutePwsh.mockResolvedValue({
				exitCode: 0,
				stdout: "[]",
				stderr: "",
			});

			// Mock AI analyzer to throw error
			const mockAIAnalyzer = {
				analyzeContract: jest.fn().mockRejectedValue(new Error("AI failed")),
			};
			(analyzer as any).aiAnalyzer = mockAIAnalyzer;

			const result = await analyzer.analyze([contract]);

			expect(result.success).toBe(true); // Should succeed with static analysis only
			// The warning should be in the warnings array from the AI analysis failure handling
			expect(
				result.warnings.some(
					(w) => w.includes("AI analysis") || w.includes("static analysis only")
				)
			).toBe(true);
		});
	});

	describe("Recommendations", () => {
		it("should provide Cardano-specific recommendations", () => {
			const recommendation = (analyzer as any).getCardanoRecommendation(
				"utxo-validation",
				"Missing UTXO validation"
			);
			expect(recommendation).toBe(
				"Ensure proper UTXO consumption and creation with value preservation"
			);
		});

		it("should provide HLint-specific recommendations", () => {
			const recommendation = (analyzer as any).getHLintRecommendation(
				"Use head",
				"head xs"
			);
			expect(recommendation).toBe("Consider using: head xs");
		});

		it("should provide default recommendation for unknown types", () => {
			const recommendation = (analyzer as any).getCardanoRecommendation(
				"unknown-type",
				"Unknown issue"
			);
			expect(recommendation).toBe(
				"Review the identified issue and implement appropriate Cardano security best practices"
			);
		});
	});
});
