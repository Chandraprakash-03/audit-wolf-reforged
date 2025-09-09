// /**
//  * Comprehensive unit tests for multi-blockchain support
//  * Tests platform-specific analyzers and cross-chain functionality
//  */

// import { SolanaAnalyzer } from "../services/analyzers/SolanaAnalyzer";
// import { CardanoAnalyzer } from "../services/analyzers/CardanoAnalyzer";
// import { CrossChainAnalyzer } from "../services/analyzers/CrossChainAnalyzer";
// import { MultiChainAnalysisOrchestrator } from "../services/MultiChainAnalysisOrchestrator";
// import { BlockchainRegistry } from "../services/BlockchainRegistry";
// import { ContractInput, MultiChainAnalysisRequest } from "../types/blockchain";

// // Import test contracts
// import {
// 	SOLANA_TEST_CONTRACTS,
// 	SOLANA_ANALYSIS_EXPECTATIONS,
// } from "./fixtures/solana-contracts";
// import {
// 	CARDANO_TEST_CONTRACTS,
// 	CARDANO_ANALYSIS_EXPECTATIONS,
// } from "./fixtures/cardano-contracts";
// import {
// 	MOVE_TEST_CONTRACTS,
// 	MOVE_ANALYSIS_EXPECTATIONS,
// } from "./fixtures/move-contracts";
// import { TEST_CONTRACTS } from "./fixtures/contracts";

// // Mock external dependencies
// jest.mock("../utils/shellUtils");
// jest.mock("fs/promises");

// describe("Multi-Blockchain Comprehensive Tests", () => {
// 	let solanaAnalyzer: SolanaAnalyzer;
// 	let cardanoAnalyzer: CardanoAnalyzer;
// 	let crossChainAnalyzer: CrossChainAnalyzer;
// 	let orchestrator: MultiChainAnalysisOrchestrator;
// 	let registry: BlockchainRegistry;

// 	beforeEach(() => {
// 		solanaAnalyzer = new SolanaAnalyzer();
// 		cardanoAnalyzer = new CardanoAnalyzer();
// 		crossChainAnalyzer = new CrossChainAnalyzer();
// 		registry = new BlockchainRegistry();
// 		orchestrator = new MultiChainAnalysisOrchestrator(registry);

// 		jest.clearAllMocks();
// 	});

// 	describe("Solana Analyzer Comprehensive Tests", () => {
// 		describe("Secure Contract Analysis", () => {
// 			it("should analyze secure Anchor program without vulnerabilities", async () => {
// 				const contract: ContractInput = {
// 					code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
// 					filename: "secure_program.rs",
// 					platform: "solana",
// 				};

// 				const result = await solanaAnalyzer.analyze([contract]);
// 				const expectations = SOLANA_ANALYSIS_EXPECTATIONS.SECURE_ANCHOR_PROGRAM;

// 				expect(result.success).toBe(expectations.shouldPass);
// 				expect(result.vulnerabilities.length).toBe(
// 					expectations.expectedVulnerabilities
// 				);
// 				expect(result.warnings.length).toBe(
// 					expectations.expectedWarnings.length
// 				);
// 			});

// 			it("should analyze secure native Solana program", async () => {
// 				const contract: ContractInput = {
// 					code: SOLANA_TEST_CONTRACTS.SECURE_NATIVE_PROGRAM.code,
// 					filename: "secure_native.rs",
// 					platform: "solana",
// 				};

// 				const result = await solanaAnalyzer.analyze([contract]);
// 				const expectations = SOLANA_ANALYSIS_EXPECTATIONS.SECURE_NATIVE_PROGRAM;

// 				expect(result.success).toBe(expectations.shouldPass);
// 				expect(result.vulnerabilities.length).toBe(
// 					expectations.expectedVulnerabilities
// 				);
// 			});
// 		});

// 		describe("Vulnerable Contract Analysis", () => {
// 			it("should detect vulnerabilities in vulnerable Anchor program", async () => {
// 				const contract: ContractInput = {
// 					code: SOLANA_TEST_CONTRACTS.VULNERABLE_ANCHOR_PROGRAM.code,
// 					filename: "vulnerable_program.rs",
// 					platform: "solana",
// 				};

// 				const result = await solanaAnalyzer.analyze([contract]);
// 				const expectations =
// 					SOLANA_ANALYSIS_EXPECTATIONS.VULNERABLE_ANCHOR_PROGRAM;

// 				expect(result.success).toBe(expectations.shouldPass);
// 				expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(
// 					expectations.expectedVulnerabilities
// 				);

// 				// Check for specific vulnerability types
// 				const vulnerabilityTypes = result.vulnerabilities.map((v) => v.type);
// 				expectations.vulnerabilityTypes.forEach((expectedType) => {
// 					expect(vulnerabilityTypes).toContain(expectedType);
// 				});

// 				// Check severity levels
// 				const highSeverityVulns = result.vulnerabilities.filter(
// 					(v) => v.severity === "high" || v.severity === "critical"
// 				);
// 				expect(highSeverityVulns.length).toBeGreaterThan(0);
// 			});

// 			it("should detect vulnerabilities in vulnerable native program", async () => {
// 				const contract: ContractInput = {
// 					code: SOLANA_TEST_CONTRACTS.VULNERABLE_NATIVE_PROGRAM.code,
// 					filename: "vulnerable_native.rs",
// 					platform: "solana",
// 				};

// 				const result = await solanaAnalyzer.analyze([contract]);
// 				const expectations =
// 					SOLANA_ANALYSIS_EXPECTATIONS.VULNERABLE_NATIVE_PROGRAM;

// 				expect(result.success).toBe(expectations.shouldPass);
// 				expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(
// 					expectations.expectedVulnerabilities
// 				);

// 				// Check for critical vulnerabilities
// 				const criticalVulns = result.vulnerabilities.filter(
// 					(v) => v.severity === "critical"
// 				);
// 				expect(criticalVulns.length).toBeGreaterThan(0);
// 			});
// 		});

// 		describe("Solana-Specific Security Checks", () => {
// 			it("should detect insecure PDA derivation", async () => {
// 				const contract: ContractInput = {
// 					code: `
// let (pda, _bump) = Pubkey::find_program_address(
//     &[user.key().as_ref()], // Predictable seed
//     &ctx.program_id
// );
// 					`,
// 					filename: "pda_test.rs",
// 					platform: "solana",
// 				};

// 				const vulnerabilities = (solanaAnalyzer as any).checkPDAValidation(
// 					contract
// 				);
// 				expect(vulnerabilities.length).toBeGreaterThan(0);
// 				expect(vulnerabilities[0].type).toBe("insecure-pda-derivation");
// 				expect(vulnerabilities[0].severity).toBe("high");
// 			});

// 			it("should detect missing account owner validation", async () => {
// 				const contract: ContractInput = {
// 					code: `
// let account: &AccountInfo = &accounts[0];
// // Missing owner validation
// let mut data = account.try_borrow_mut_data()?;
// 					`,
// 					filename: "owner_test.rs",
// 					platform: "solana",
// 				};

// 				const vulnerabilities = (solanaAnalyzer as any).checkAccountModel(
// 					contract
// 				);
// 				expect(vulnerabilities.length).toBeGreaterThan(0);
// 				expect(vulnerabilities[0].type).toBe("missing-owner-validation");
// 			});

// 			it("should detect missing signer validation", async () => {
// 				const contract: ContractInput = {
// 					code: `
// pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
//     // Missing signer validation
//     let from_account = &mut ctx.accounts.from_account;
//     from_account.balance -= amount;
//     Ok(())
// }
// 					`,
// 					filename: "signer_test.rs",
// 					platform: "solana",
// 				};

// 				const vulnerabilities = (solanaAnalyzer as any).checkAnchorPatterns(
// 					contract
// 				);
// 				const signerVulns = vulnerabilities.filter(
// 					(v: { type: string; }) => v.type === "anchor-missing-signer"
// 				);
// 				expect(signerVulns.length).toBeGreaterThan(0);
// 			});
// 		});

// 		describe("Performance Testing", () => {
// 			it("should handle large Solana programs efficiently", async () => {
// 				const contract: ContractInput = {
// 					code: SOLANA_TEST_CONTRACTS.LARGE_SOLANA_PROGRAM.code,
// 					filename: "large_program.rs",
// 					platform: "solana",
// 				};

// 				const startTime = Date.now();
// 				const result = await solanaAnalyzer.analyze([contract]);
// 				const executionTime = Date.now() - startTime;

// 				const expectations = SOLANA_ANALYSIS_EXPECTATIONS.LARGE_SOLANA_PROGRAM;
// 				expect(result.success).toBe(expectations.shouldPass);
// 				expect(executionTime).toBeLessThan(expectations.expectedExecutionTime);
// 			});
// 		});

// 		describe("Error Handling", () => {
// 			it("should handle invalid Rust code gracefully", async () => {
// 				const contract: ContractInput = {
// 					code: SOLANA_TEST_CONTRACTS.INVALID_RUST_CODE.code,
// 					filename: "invalid.rs",
// 					platform: "solana",
// 				};

// 				const result = await solanaAnalyzer.analyze([contract]);
// 				const expectations = SOLANA_ANALYSIS_EXPECTATIONS.INVALID_RUST_CODE;

// 				expect(result.success).toBe(expectations.shouldPass);
// 				expect(result.errors.length).toBeGreaterThan(0);
// 			});
// 		});
// 	});

// 	describe("Cardano Analyzer Comprehensive Tests", () => {
// 		describe("Secure Contract Analysis", () => {
// 			it("should analyze valid Plutus validator without issues", async () => {
// 				const contract: ContractInput = {
// 					code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
// 					filename: "validator.hs",
// 					platform: "cardano",
// 				};

// 				const result = await cardanoAnalyzer.analyze([contract]);
// 				const expectations =
// 					CARDANO_ANALYSIS_EXPECTATIONS.VALID_PLUTUS_VALIDATOR;

// 				expect(result.success).toBe(expectations.shouldPass);
// 				expect(result.vulnerabilities.length).toBe(
// 					expectations.expectedVulnerabilities
// 				);
// 			});

// 			it("should analyze Plutus script with datum correctly", async () => {
// 				const contract: ContractInput = {
// 					code: CARDANO_TEST_CONTRACTS.PLUTUS_SCRIPT_WITH_DATUM,
// 					filename: "vesting.hs",
// 					platform: "cardano",
// 				};

// 				const result = await cardanoAnalyzer.analyze([contract]);
// 				expect(result.success).toBe(true);
// 				expect(result.vulnerabilities.length).toBe(0);
// 			});
// 		});

// 		describe("Vulnerable Contract Analysis", () => {
// 			it("should detect vulnerabilities in vulnerable Plutus validator", async () => {
// 				const contract: ContractInput = {
// 					code: CARDANO_TEST_CONTRACTS.VULNERABLE_PLUTUS_VALIDATOR,
// 					filename: "vulnerable.hs",
// 					platform: "cardano",
// 				};

// 				const result = await cardanoAnalyzer.analyze([contract]);
// 				const expectations =
// 					CARDANO_ANALYSIS_EXPECTATIONS.VULNERABLE_PLUTUS_VALIDATOR;

// 				expect(result.success).toBe(expectations.shouldPass);
// 				expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(
// 					expectations.expectedVulnerabilities
// 				);

// 				// Check for specific vulnerability types
// 				const vulnerabilityTypes = result.vulnerabilities.map((v) => v.type);
// 				expectations.vulnerabilityTypes.forEach((expectedType) => {
// 					expect(vulnerabilityTypes).toContain(expectedType);
// 				});
// 			});

// 			it("should detect unsafe datum handling", async () => {
// 				const contract: ContractInput = {
// 					code: CARDANO_TEST_CONTRACTS.UNSAFE_DATUM_HANDLING,
// 					filename: "unsafe_datum.hs",
// 					platform: "cardano",
// 				};

// 				const result = await cardanoAnalyzer.analyze([contract]);
// 				const expectations =
// 					CARDANO_ANALYSIS_EXPECTATIONS.UNSAFE_DATUM_HANDLING;

// 				expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(
// 					expectations.expectedVulnerabilities
// 				);

// 				const vulnerabilityTypes = result.vulnerabilities.map((v) => v.type);
// 				expectations.vulnerabilityTypes.forEach((expectedType) => {
// 					expect(vulnerabilityTypes).toContain(expectedType);
// 				});
// 			});
// 		});

// 		describe("Cardano-Specific Security Checks", () => {
// 			it("should detect missing ScriptContext usage", async () => {
// 				const contract: ContractInput = {
// 					code: CARDANO_TEST_CONTRACTS.MISSING_CONTEXT_VALIDATOR,
// 					filename: "missing_context.hs",
// 					platform: "cardano",
// 				};

// 				const vulnerabilities = (cardanoAnalyzer as any).checkPlutusPatterns(
// 					contract
// 				);
// 				const contextVulns = vulnerabilities.filter(
// 					(v: { type: string; }) => v.type === "plutus-missing-context"
// 				);
// 				expect(contextVulns.length).toBeGreaterThan(0);
// 			});

// 			it("should detect eUTXO non-compliance", async () => {
// 				const contract: ContractInput = {
// 					code: CARDANO_TEST_CONTRACTS.EUTXO_NON_COMPLIANT,
// 					filename: "non_compliant.hs",
// 					platform: "cardano",
// 				};

// 				const vulnerabilities = (cardanoAnalyzer as any).checkEUTXOCompliance(
// 					contract
// 				);
// 				expect(vulnerabilities.length).toBeGreaterThan(0);
// 				expect(vulnerabilities[0].type).toBe("cardano-eutxo-compliance");
// 			});

// 			it("should detect partial function usage in Haskell", async () => {
// 				const contract: ContractInput = {
// 					code: CARDANO_TEST_CONTRACTS.HASKELL_MODULE,
// 					filename: "utils.hs",
// 					platform: "cardano",
// 				};

// 				const result = await cardanoAnalyzer.validateContract(contract);
// 				const expectations = CARDANO_ANALYSIS_EXPECTATIONS.HASKELL_MODULE;

// 				expect(result.warnings.length).toBeGreaterThan(0);
// 				expectations.expectedWarnings.forEach((expectedWarning) => {
// 					expect(result.warnings.some((w) => w.includes(expectedWarning))).toBe(
// 						true
// 					);
// 				});
// 			});
// 		});
// 	});

// 	describe("Cross-Chain Analysis Tests", () => {
// 		describe("Bridge Contract Analysis", () => {
// 			it("should analyze cross-chain bridge contracts", async () => {
// 				const platformResults = new Map();

// 				// Mock Ethereum bridge contract result
// 				platformResults.set("ethereum", {
// 					success: true,
// 					vulnerabilities: [
// 						{
// 							type: "bridge_lock",
// 							severity: "high",
// 							title: "Bridge lock vulnerability",
// 							description: "Bridge lock mechanism has security issues",
// 							location: { file: "Bridge.sol", line: 45, column: 10 },
// 							recommendation: "Implement proper locking",
// 							confidence: 0.9,
// 							source: "static",
// 							platform: "ethereum",
// 						},
// 					],
// 					errors: [],
// 					warnings: [],
// 					executionTime: 1500,
// 				});

// 				// Mock Solana bridge program result
// 				platformResults.set("solana", {
// 					success: true,
// 					vulnerabilities: [
// 						{
// 							type: "pda_security",
// 							severity: "medium",
// 							title: "PDA security issue",
// 							description: "PDA derivation could be improved",
// 							location: { file: "bridge.rs", line: 123, column: 15 },
// 							recommendation: "Use more secure PDA seeds",
// 							confidence: 0.8,
// 							source: "static",
// 							platform: "solana",
// 						},
// 					],
// 					errors: [],
// 					warnings: [],
// 					executionTime: 1200,
// 				});

// 				const result = await crossChainAnalyzer.analyzeBridgeContracts(
// 					platformResults
// 				);

// 				expect(result).toBeDefined();
// 				expect(result.overallSecurityScore).toBeGreaterThanOrEqual(0);
// 				expect(result.overallSecurityScore).toBeLessThanOrEqual(100);
// 				expect(result.lockingMechanisms).toBeDefined();
// 				expect(result.messagePassing).toBeDefined();
// 			});

// 			it("should identify interoperability risks", async () => {
// 				const platformResults = new Map();

// 				platformResults.set("ethereum", {
// 					success: true,
// 					vulnerabilities: [],
// 					errors: [],
// 					warnings: [],
// 					executionTime: 1000,
// 				});

// 				platformResults.set("solana", {
// 					success: true,
// 					vulnerabilities: [],
// 					errors: [],
// 					warnings: [],
// 					executionTime: 800,
// 				});

// 				const risks = await crossChainAnalyzer.identifyInteroperabilityRisks(
// 					platformResults
// 				);

// 				expect(Array.isArray(risks)).toBe(true);
// 				expect(risks.length).toBeGreaterThan(0);

// 				// Should identify Ethereum-Solana compatibility risk
// 				const compatibilityRisk = risks.find(
// 					(risk) => risk.type === "security_model_mismatch"
// 				);
// 				expect(compatibilityRisk).toBeDefined();
// 				expect(compatibilityRisk?.affectedPlatforms).toContain("ethereum");
// 				expect(compatibilityRisk?.affectedPlatforms).toContain("solana");
// 			});
// 		});

// 		describe("State Consistency Analysis", () => {
// 			it("should analyze state consistency across platforms", async () => {
// 				const platformResults = new Map();

// 				platformResults.set("ethereum", {
// 					success: true,
// 					vulnerabilities: [
// 						{
// 							type: "state_variable",
// 							severity: "medium",
// 							title: "State variable issue",
// 							description: "State variable handling issue",
// 							location: { file: "Contract.sol", line: 30, column: 8 },
// 							recommendation: "Fix state handling",
// 							confidence: 0.7,
// 							source: "static",
// 							platform: "ethereum",
// 						},
// 					],
// 					errors: [],
// 					warnings: [],
// 					executionTime: 1000,
// 				});

// 				platformResults.set("cardano", {
// 					success: true,
// 					vulnerabilities: [
// 						{
// 							type: "utxo_handling",
// 							severity: "low",
// 							title: "UTXO handling",
// 							description: "UTXO handling could be improved",
// 							location: { file: "validator.hs", line: 67, column: 12 },
// 							recommendation: "Improve UTXO handling",
// 							confidence: 0.6,
// 							source: "static",
// 							platform: "cardano",
// 						},
// 					],
// 					errors: [],
// 					warnings: [],
// 					executionTime: 1200,
// 				});

// 				const result = await crossChainAnalyzer.analyzeStateConsistency(
// 					platformResults
// 				);

// 				expect(result).toBeDefined();
// 				expect(Array.isArray(result.potentialInconsistencies)).toBe(true);
// 				expect(Array.isArray(result.recommendations)).toBe(true);
// 			});
// 		});
// 	});

// 	describe("Multi-Chain Orchestrator Tests", () => {
// 		describe("Parallel Analysis", () => {
// 			it("should orchestrate analysis across multiple platforms", async () => {
// 				const request: MultiChainAnalysisRequest = {
// 					contracts: [
// 						{
// 							code: TEST_CONTRACTS.SIMPLE_TOKEN.sourceCode,
// 							filename: "SimpleToken.sol",
// 							platform: "ethereum",
// 						},
// 						{
// 							code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
// 							filename: "secure_program.rs",
// 							platform: "solana",
// 						},
// 						{
// 							code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
// 							filename: "validator.hs",
// 							platform: "cardano",
// 						},
// 					],
// 					platforms: ["ethereum", "solana", "cardano"],
// 					analysisOptions: {
// 						includeAI: true,
// 						includeStatic: true,
// 						timeout: 30000,
// 					},
// 					crossChainAnalysis: true,
// 				};

// 				const result = await orchestrator.analyzeMultiChain(request);

// 				expect(result.success).toBe(true);
// 				expect(result.platformResults.size).toBe(3);
// 				expect(result.platformResults.has("ethereum")).toBe(true);
// 				expect(result.platformResults.has("solana")).toBe(true);
// 				expect(result.platformResults.has("cardano")).toBe(true);
// 				expect(result.crossChainResults).toBeDefined();
// 			});

// 			it("should handle partial failures gracefully", async () => {
// 				const request: MultiChainAnalysisRequest = {
// 					contracts: [
// 						{
// 							code: "invalid solidity code",
// 							filename: "invalid.sol",
// 							platform: "ethereum",
// 						},
// 						{
// 							code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
// 							filename: "secure_program.rs",
// 							platform: "solana",
// 						},
// 					],
// 					platforms: ["ethereum", "solana"],
// 					analysisOptions: {
// 						includeAI: true,
// 						includeStatic: true,
// 						timeout: 30000,
// 					},
// 					crossChainAnalysis: false,
// 				};

// 				const result = await orchestrator.analyzeMultiChain(request);

// 				expect(result.success).toBe(true); // Should succeed with partial results
// 				expect(result.platformResults.size).toBe(2);
// 				expect(result.errors.length).toBeGreaterThan(0); // Should have errors from Ethereum
// 			});
// 		});

// 		describe("Performance Testing", () => {
// 			it("should handle concurrent analysis efficiently", async () => {
// 				const contracts = Array.from({ length: 10 }, (_, i) => ({
// 					code: TEST_CONTRACTS.SIMPLE_TOKEN.sourceCode.replace(
// 						"SimpleToken",
// 						`Token${i}`
// 					),
// 					filename: `Token${i}.sol`,
// 					platform: "ethereum",
// 				}));

// 				const request: MultiChainAnalysisRequest = {
// 					contracts,
// 					platforms: ["ethereum"],
// 					analysisOptions: {
// 						includeAI: false, // Disable AI for performance test
// 						includeStatic: true,
// 						timeout: 60000,
// 					},
// 					crossChainAnalysis: false,
// 				};

// 				const startTime = Date.now();
// 				const result = await orchestrator.analyzeMultiChain(request);
// 				const executionTime = Date.now() - startTime;

// 				expect(result.success).toBe(true);
// 				expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
// 			});
// 		});
// 	});

// 	describe("Integration Tests", () => {
// 		describe("End-to-End Multi-Platform Analysis", () => {
// 			it("should perform complete analysis workflow", async () => {
// 				// Test the complete workflow from contract input to final report
// 				const ethereumContract: ContractInput = {
// 					code: TEST_CONTRACTS.VULNERABLE_BANK.sourceCode,
// 					filename: "VulnerableBank.sol",
// 					platform: "ethereum",
// 				};

// 				const solanaContract: ContractInput = {
// 					code: SOLANA_TEST_CONTRACTS.VULNERABLE_ANCHOR_PROGRAM.code,
// 					filename: "vulnerable_program.rs",
// 					platform: "solana",
// 				};

// 				const cardanoContract: ContractInput = {
// 					code: CARDANO_TEST_CONTRACTS.VULNERABLE_PLUTUS_VALIDATOR,
// 					filename: "vulnerable.hs",
// 					platform: "cardano",
// 				};

// 				const request: MultiChainAnalysisRequest = {
// 					contracts: [ethereumContract, solanaContract, cardanoContract],
// 					platforms: ["ethereum", "solana", "cardano"],
// 					analysisOptions: {
// 						includeAI: true,
// 						includeStatic: true,
// 						timeout: 60000,
// 					},
// 					crossChainAnalysis: true,
// 				};

// 				const result = await orchestrator.analyzeMultiChain(request);

// 				// Verify overall success
// 				expect(result.success).toBe(true);
// 				expect(result.platformResults.size).toBe(3);

// 				// Verify each platform found vulnerabilities
// 				result.platformResults.forEach((platformResult, platform) => {
// 					expect(platformResult.vulnerabilities.length).toBeGreaterThan(0);
// 					platformResult.vulnerabilities.forEach((vuln) => {
// 						expect(vuln.platform).toBe(platform);
// 						expect(vuln.severity).toMatch(/^(low|medium|high|critical)$/);
// 						expect(vuln.type).toBeDefined();
// 						expect(vuln.title).toBeDefined();
// 						expect(vuln.description).toBeDefined();
// 						expect(vuln.recommendation).toBeDefined();
// 					});
// 				});

// 				// Verify cross-chain analysis
// 				expect(result.crossChainResults).toBeDefined();
// 				expect(
// 					result.crossChainResults?.interoperabilityRisks.length
// 				).toBeGreaterThan(0);
// 				expect(
// 					result.crossChainResults?.crossChainRecommendations.length
// 				).toBeGreaterThan(0);

// 				// Verify execution metrics
// 				expect(result.executionTime).toBeGreaterThan(0);
// 				expect(result.totalVulnerabilities).toBeGreaterThan(0);
// 			});
// 		});

// 		describe("Error Recovery and Resilience", () => {
// 			it("should continue analysis when one platform fails", async () => {
// 				const request: MultiChainAnalysisRequest = {
// 					contracts: [
// 						{
// 							code: "completely invalid code that will fail parsing",
// 							filename: "invalid.sol",
// 							platform: "ethereum",
// 						},
// 						{
// 							code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
// 							filename: "secure_program.rs",
// 							platform: "solana",
// 						},
// 					],
// 					platforms: ["ethereum", "solana"],
// 					analysisOptions: {
// 						includeAI: true,
// 						includeStatic: true,
// 						timeout: 30000,
// 					},
// 					crossChainAnalysis: false,
// 				};

// 				const result = await orchestrator.analyzeMultiChain(request);

// 				// Should succeed overall despite one platform failing
// 				expect(result.success).toBe(true);
// 				expect(result.platformResults.has("solana")).toBe(true);
// 				expect(result.errors.length).toBeGreaterThan(0);
// 			});
// 		});
// 	});
// });
