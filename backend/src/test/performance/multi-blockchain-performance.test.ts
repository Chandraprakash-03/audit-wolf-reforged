// /**
//  * Performance tests for parallel blockchain analysis processing
//  * Tests scalability, concurrency, and resource utilization
//  */

// import { performance } from "perf_hooks";
// import { MultiChainAnalysisOrchestrator } from "../../services/MultiChainAnalysisOrchestrator";
// import { BlockchainRegistry } from "../../services/BlockchainRegistry";
// import { SolanaAnalyzer } from "../../services/analyzers/SolanaAnalyzer";
// import { CardanoAnalyzer } from "../../services/analyzers/CardanoAnalyzer";
// import { CrossChainAnalyzer } from "../../services/analyzers/CrossChainAnalyzer";
// import {
// 	ContractInput,
// 	MultiChainAnalysisRequest,
// } from "../../types/blockchain";

// // Import test contracts
// import { SOLANA_TEST_CONTRACTS } from "../fixtures/solana-contracts";
// import { CARDANO_TEST_CONTRACTS } from "../fixtures/cardano-contracts";
// import { MOVE_TEST_CONTRACTS } from "../fixtures/move-contracts";
// import { TEST_CONTRACTS } from "../fixtures/contracts";

// // Mock external dependencies for performance testing
// jest.mock("../utils/shellUtils");
// jest.mock("fs/promises");

// describe("Multi-Blockchain Performance Tests", () => {
// 	let orchestrator: MultiChainAnalysisOrchestrator;
// 	let registry: BlockchainRegistry;

// 	beforeAll(() => {
// 		registry = new BlockchainRegistry();
// 		orchestrator = new MultiChainAnalysisOrchestrator(registry);
// 	});

// 	describe("Single Platform Performance", () => {
// 		it("should analyze multiple Solana contracts efficiently", async () => {
// 			const contracts: ContractInput[] = Array.from({ length: 10 }, (_, i) => ({
// 				code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code.replace(
// 					"secure_program",
// 					`secure_program_${i}`
// 				),
// 				filename: `program_${i}.rs`,
// 				platform: "solana",
// 			}));

// 			const request: MultiChainAnalysisRequest = {
// 				contracts,
// 				platforms: ["solana"],
// 				analysisOptions: {
// 					includeAI: false, // Disable AI for performance testing
// 					includeStatic: true,
// 					timeout: 60000,
// 				},
// 				crossChainAnalysis: false,
// 			};

// 			const startTime = performance.now();
// 			const result = await orchestrator.analyzeMultiChain(request);
// 			const endTime = performance.now();

// 			const executionTime = endTime - startTime;

// 			expect(result.success).toBe(true);
// 			expect(result.platformResults.has("solana")).toBe(true);
// 			expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds

// 			console.log(
// 				`Solana batch analysis (10 contracts): ${executionTime.toFixed(2)}ms`
// 			);
// 		});

// 		it("should analyze multiple Cardano contracts efficiently", async () => {
// 			const contracts: ContractInput[] = Array.from({ length: 8 }, (_, i) => ({
// 				code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR.replace(
// 					"validator",
// 					`validator_${i}`
// 				),
// 				filename: `validator_${i}.hs`,
// 				platform: "cardano",
// 			}));

// 			const request: MultiChainAnalysisRequest = {
// 				contracts,
// 				platforms: ["cardano"],
// 				analysisOptions: {
// 					includeAI: false,
// 					includeStatic: true,
// 					timeout: 60000,
// 				},
// 				crossChainAnalysis: false,
// 			};

// 			const startTime = performance.now();
// 			const result = await orchestrator.analyzeMultiChain(request);
// 			const endTime = performance.now();

// 			const executionTime = endTime - startTime;

// 			expect(result.success).toBe(true);
// 			expect(result.platformResults.has("cardano")).toBe(true);
// 			expect(executionTime).toBeLessThan(40000); // Should complete within 40 seconds

// 			console.log(
// 				`Cardano batch analysis (8 contracts): ${executionTime.toFixed(2)}ms`
// 			);
// 		});

// 		it("should handle large contract analysis", async () => {
// 			const largeContract: ContractInput = {
// 				code: SOLANA_TEST_CONTRACTS.LARGE_SOLANA_PROGRAM.code,
// 				filename: "large_program.rs",
// 				platform: "solana",
// 			};

// 			const request: MultiChainAnalysisRequest = {
// 				contracts: [largeContract],
// 				platforms: ["solana"],
// 				analysisOptions: {
// 					includeAI: false,
// 					includeStatic: true,
// 					timeout: 60000,
// 				},
// 				crossChainAnalysis: false,
// 			};

// 			const startTime = performance.now();
// 			const result = await orchestrator.analyzeMultiChain(request);
// 			const endTime = performance.now();

// 			const executionTime = endTime - startTime;

// 			expect(result.success).toBe(true);
// 			expect(executionTime).toBeLessThan(10000); // Large contract should complete within 10 seconds

// 			console.log(`Large contract analysis: ${executionTime.toFixed(2)}ms`);
// 		});
// 	});

// 	describe("Multi-Platform Parallel Processing", () => {
// 		it("should process multiple platforms concurrently", async () => {
// 			const contracts: ContractInput[] = [
// 				{
// 					code: TEST_CONTRACTS.SIMPLE_TOKEN.sourceCode,
// 					filename: "SimpleToken.sol",
// 					platform: "ethereum",
// 				},
// 				{
// 					code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
// 					filename: "secure_program.rs",
// 					platform: "solana",
// 				},
// 				{
// 					code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
// 					filename: "validator.hs",
// 					platform: "cardano",
// 				},
// 			];

// 			const request: MultiChainAnalysisRequest = {
// 				contracts,
// 				platforms: ["ethereum", "solana", "cardano"],
// 				analysisOptions: {
// 					includeAI: false,
// 					includeStatic: true,
// 					timeout: 60000,
// 				},
// 				crossChainAnalysis: false,
// 			};

// 			const startTime = performance.now();
// 			const result = await orchestrator.analyzeMultiChain(request);
// 			const endTime = performance.now();

// 			const executionTime = endTime - startTime;

// 			expect(result.success).toBe(true);
// 			expect(result.platformResults.size).toBe(3);
// 			expect(result.platformResults.has("ethereum")).toBe(true);
// 			expect(result.platformResults.has("solana")).toBe(true);
// 			expect(result.platformResults.has("cardano")).toBe(true);

// 			// Parallel processing should be faster than sequential
// 			expect(executionTime).toBeLessThan(45000); // Should complete within 45 seconds

// 			console.log(
// 				`Multi-platform parallel analysis: ${executionTime.toFixed(2)}ms`
// 			);
// 		});

// 		it("should scale with increasing platform count", async () => {
// 			const platformCounts = [1, 2, 3];
// 			const results: { platforms: number; time: number }[] = [];

// 			for (const platformCount of platformCounts) {
// 				const contracts: ContractInput[] = [];
// 				const platforms: string[] = [];

// 				if (platformCount >= 1) {
// 					contracts.push({
// 						code: TEST_CONTRACTS.SIMPLE_TOKEN.sourceCode,
// 						filename: "SimpleToken.sol",
// 						platform: "ethereum",
// 					});
// 					platforms.push("ethereum");
// 				}

// 				if (platformCount >= 2) {
// 					contracts.push({
// 						code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
// 						filename: "secure_program.rs",
// 						platform: "solana",
// 					});
// 					platforms.push("solana");
// 				}

// 				if (platformCount >= 3) {
// 					contracts.push({
// 						code: CARDANO_TEST_CONTRACTS.VALID_PLUTUS_VALIDATOR,
// 						filename: "validator.hs",
// 						platform: "cardano",
// 					});
// 					platforms.push("cardano");
// 				}

// 				const request: MultiChainAnalysisRequest = {
// 					contracts,
// 					platforms,
// 					analysisOptions: {
// 						includeAI: false,
// 						includeStatic: true,
// 						timeout: 60000,
// 					},
// 					crossChainAnalysis: false,
// 				};

// 				const startTime = performance.now();
// 				const result = await orchestrator.analyzeMultiChain(request);
// 				const endTime = performance.now();

// 				const executionTime = endTime - startTime;

// 				expect(result.success).toBe(true);
// 				expect(result.platformResults.size).toBe(platformCount);

// 				results.push({ platforms: platformCount, time: executionTime });
// 				console.log(
// 					`${platformCount} platform(s): ${executionTime.toFixed(2)}ms`
// 				);
// 			}

// 			// Verify that parallel processing provides benefits
// 			// Time should not increase linearly with platform count
// 			const timeIncrease = results[2].time / results[0].time;
// 			expect(timeIncrease).toBeLessThan(3); // Should be less than 3x for 3x platforms
// 		});
// 	});

// 	describe("Cross-Chain Analysis Performance", () => {
// 		it("should perform cross-chain analysis efficiently", async () => {
// 			const contracts: ContractInput[] = [
// 				{
// 					code: `
// pragma solidity ^0.8.0;
// contract EthereumBridge {
//     mapping(bytes32 => bool) public processedMessages;
//     function lockTokens(uint256 amount) external {}
// }
// 					`,
// 					filename: "eth_bridge.sol",
// 					platform: "ethereum",
// 				},
// 				{
// 					code: `
// use anchor_lang::prelude::*;
// #[program]
// pub mod solana_bridge {
//     use super::*;
//     pub fn lock_tokens(ctx: Context<LockTokens>, amount: u64) -> Result<()> { Ok(()) }
// }
// #[derive(Accounts)]
// pub struct LockTokens<'info> {
//     pub user: Signer<'info>,
// }
// 					`,
// 					filename: "solana_bridge.rs",
// 					platform: "solana",
// 				},
// 			];

// 			const request: MultiChainAnalysisRequest = {
// 				contracts,
// 				platforms: ["ethereum", "solana"],
// 				analysisOptions: {
// 					includeAI: false,
// 					includeStatic: true,
// 					timeout: 60000,
// 				},
// 				crossChainAnalysis: true,
// 			};

// 			const startTime = performance.now();
// 			const result = await orchestrator.analyzeMultiChain(request);
// 			const endTime = performance.now();

// 			const executionTime = endTime - startTime;

// 			expect(result.success).toBe(true);
// 			expect(result.crossChainResults).toBeDefined();
// 			expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds

// 			console.log(`Cross-chain analysis: ${executionTime.toFixed(2)}ms`);
// 		});

// 		it("should handle complex cross-chain scenarios", async () => {
// 			const contracts: ContractInput[] = [
// 				{
// 					code: TEST_CONTRACTS.COMPLEX_VULNERABLE.sourceCode,
// 					filename: "complex_eth.sol",
// 					platform: "ethereum",
// 				},
// 				{
// 					code: SOLANA_TEST_CONTRACTS.VULNERABLE_ANCHOR_PROGRAM.code,
// 					filename: "complex_solana.rs",
// 					platform: "solana",
// 				},
// 				{
// 					code: CARDANO_TEST_CONTRACTS.VULNERABLE_PLUTUS_VALIDATOR,
// 					filename: "complex_cardano.hs",
// 					platform: "cardano",
// 				},
// 			];

// 			const request: MultiChainAnalysisRequest = {
// 				contracts,
// 				platforms: ["ethereum", "solana", "cardano"],
// 				analysisOptions: {
// 					includeAI: false,
// 					includeStatic: true,
// 					timeout: 120000, // Longer timeout for complex analysis
// 				},
// 				crossChainAnalysis: true,
// 			};

// 			const startTime = performance.now();
// 			const result = await orchestrator.analyzeMultiChain(request);
// 			const endTime = performance.now();

// 			const executionTime = endTime - startTime;

// 			expect(result.success).toBe(true);
// 			expect(result.crossChainResults).toBeDefined();
// 			expect(
// 				result.crossChainResults?.interoperabilityRisks.length
// 			).toBeGreaterThan(0);
// 			expect(executionTime).toBeLessThan(90000); // Should complete within 90 seconds

// 			console.log(
// 				`Complex cross-chain analysis: ${executionTime.toFixed(2)}ms`
// 			);
// 		});
// 	});

// 	describe("Memory and Resource Usage", () => {
// 		it("should handle memory efficiently with large batches", async () => {
// 			const initialMemory = process.memoryUsage();

// 			// Create a large batch of contracts
// 			const contracts: ContractInput[] = Array.from({ length: 20 }, (_, i) => ({
// 				code: TEST_CONTRACTS.SIMPLE_TOKEN.sourceCode.replace(
// 					"SimpleToken",
// 					`Token${i}`
// 				),
// 				filename: `token_${i}.sol`,
// 				platform: "ethereum",
// 			}));

// 			const request: MultiChainAnalysisRequest = {
// 				contracts,
// 				platforms: ["ethereum"],
// 				analysisOptions: {
// 					includeAI: false,
// 					includeStatic: true,
// 					timeout: 120000,
// 				},
// 				crossChainAnalysis: false,
// 			};

// 			const startTime = performance.now();
// 			const result = await orchestrator.analyzeMultiChain(request);
// 			const endTime = performance.now();

// 			const finalMemory = process.memoryUsage();
// 			const executionTime = endTime - startTime;

// 			expect(result.success).toBe(true);
// 			expect(executionTime).toBeLessThan(60000); // Should complete within 60 seconds

// 			// Memory usage should not grow excessively
// 			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
// 			const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

// 			console.log(
// 				`Memory increase for 20 contracts: ${memoryIncreaseMB.toFixed(2)}MB`
// 			);
// 			expect(memoryIncreaseMB).toBeLessThan(500); // Should not use more than 500MB additional memory

// 			// Force garbage collection if available
// 			if (global.gc) {
// 				global.gc();
// 			}
// 		});

// 		it("should clean up resources after analysis", async () => {
// 			const initialMemory = process.memoryUsage();

// 			// Run multiple analysis cycles
// 			for (let i = 0; i < 5; i++) {
// 				const contracts: ContractInput[] = [
// 					{
// 						code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code,
// 						filename: `cycle_${i}.rs`,
// 						platform: "solana",
// 					},
// 				];

// 				const request: MultiChainAnalysisRequest = {
// 					contracts,
// 					platforms: ["solana"],
// 					analysisOptions: {
// 						includeAI: false,
// 						includeStatic: true,
// 						timeout: 30000,
// 					},
// 					crossChainAnalysis: false,
// 				};

// 				const result = await orchestrator.analyzeMultiChain(request);
// 				expect(result.success).toBe(true);
// 			}

// 			// Force garbage collection
// 			if (global.gc) {
// 				global.gc();
// 			}

// 			const finalMemory = process.memoryUsage();
// 			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
// 			const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

// 			console.log(
// 				`Memory increase after 5 cycles: ${memoryIncreaseMB.toFixed(2)}MB`
// 			);
// 			expect(memoryIncreaseMB).toBeLessThan(100); // Should not leak significant memory
// 		});
// 	});

// 	describe("Concurrent Analysis Stress Tests", () => {
// 		it("should handle concurrent analysis requests", async () => {
// 			const concurrentRequests = 5;
// 			const promises: Promise<any>[] = [];

// 			for (let i = 0; i < concurrentRequests; i++) {
// 				const contracts: ContractInput[] = [
// 					{
// 						code: TEST_CONTRACTS.SIMPLE_TOKEN.sourceCode.replace(
// 							"SimpleToken",
// 							`ConcurrentToken${i}`
// 						),
// 						filename: `concurrent_${i}.sol`,
// 						platform: "ethereum",
// 					},
// 				];

// 				const request: MultiChainAnalysisRequest = {
// 					contracts,
// 					platforms: ["ethereum"],
// 					analysisOptions: {
// 						includeAI: false,
// 						includeStatic: true,
// 						timeout: 30000,
// 					},
// 					crossChainAnalysis: false,
// 				};

// 				promises.push(orchestrator.analyzeMultiChain(request));
// 			}

// 			const startTime = performance.now();
// 			const results = await Promise.all(promises);
// 			const endTime = performance.now();

// 			const executionTime = endTime - startTime;

// 			// All requests should succeed
// 			results.forEach((result, index) => {
// 				expect(result.success).toBe(true);
// 				expect(result.platformResults.has("ethereum")).toBe(true);
// 			});

// 			console.log(
// 				`${concurrentRequests} concurrent requests: ${executionTime.toFixed(
// 					2
// 				)}ms`
// 			);
// 			expect(executionTime).toBeLessThan(45000); // Should handle concurrency efficiently
// 		});

// 		it("should maintain performance under load", async () => {
// 			const loadTestResults: number[] = [];

// 			// Run multiple load test iterations
// 			for (let iteration = 0; iteration < 3; iteration++) {
// 				const contracts: ContractInput[] = Array.from(
// 					{ length: 5 },
// 					(_, i) => ({
// 						code: SOLANA_TEST_CONTRACTS.SECURE_ANCHOR_PROGRAM.code.replace(
// 							"secure_program",
// 							`load_test_${iteration}_${i}`
// 						),
// 						filename: `load_${iteration}_${i}.rs`,
// 						platform: "solana",
// 					})
// 				);

// 				const request: MultiChainAnalysisRequest = {
// 					contracts,
// 					platforms: ["solana"],
// 					analysisOptions: {
// 						includeAI: false,
// 						includeStatic: true,
// 						timeout: 60000,
// 					},
// 					crossChainAnalysis: false,
// 				};

// 				const startTime = performance.now();
// 				const result = await orchestrator.analyzeMultiChain(request);
// 				const endTime = performance.now();

// 				const executionTime = endTime - startTime;
// 				loadTestResults.push(executionTime);

// 				expect(result.success).toBe(true);
// 				console.log(
// 					`Load test iteration ${iteration + 1}: ${executionTime.toFixed(2)}ms`
// 				);
// 			}

// 			// Performance should remain consistent across iterations
// 			const avgTime =
// 				loadTestResults.reduce((a, b) => a + b, 0) / loadTestResults.length;
// 			const maxDeviation = Math.max(
// 				...loadTestResults.map((time) => Math.abs(time - avgTime))
// 			);
// 			const deviationPercentage = (maxDeviation / avgTime) * 100;

// 			console.log(
// 				`Average time: ${avgTime.toFixed(
// 					2
// 				)}ms, Max deviation: ${deviationPercentage.toFixed(2)}%`
// 			);
// 			expect(deviationPercentage).toBeLessThan(50); // Deviation should be less than 50%
// 		});
// 	});

// 	describe("Timeout and Error Handling Performance", () => {
// 		it("should handle timeouts efficiently", async () => {
// 			const contracts: ContractInput[] = [
// 				{
// 					code: SOLANA_TEST_CONTRACTS.LARGE_SOLANA_PROGRAM.code,
// 					filename: "timeout_test.rs",
// 					platform: "solana",
// 				},
// 			];

// 			const request: MultiChainAnalysisRequest = {
// 				contracts,
// 				platforms: ["solana"],
// 				analysisOptions: {
// 					includeAI: false,
// 					includeStatic: true,
// 					timeout: 1000, // Very short timeout
// 				},
// 				crossChainAnalysis: false,
// 			};

// 			const startTime = performance.now();
// 			const result = await orchestrator.analyzeMultiChain(request);
// 			const endTime = performance.now();

// 			const executionTime = endTime - startTime;

// 			// Should respect timeout and not hang
// 			expect(executionTime).toBeLessThan(5000); // Should timeout quickly
// 			console.log(`Timeout handling: ${executionTime.toFixed(2)}ms`);
// 		});

// 		it("should recover from analyzer failures quickly", async () => {
// 			const contracts: ContractInput[] = [
// 				{
// 					code: "invalid code that will cause analyzer to fail",
// 					filename: "error_test.rs",
// 					platform: "solana",
// 				},
// 			];

// 			const request: MultiChainAnalysisRequest = {
// 				contracts,
// 				platforms: ["solana"],
// 				analysisOptions: {
// 					includeAI: false,
// 					includeStatic: true,
// 					timeout: 30000,
// 				},
// 				crossChainAnalysis: false,
// 			};

// 			const startTime = performance.now();
// 			const result = await orchestrator.analyzeMultiChain(request);
// 			const endTime = performance.now();

// 			const executionTime = endTime - startTime;

// 			// Should handle errors quickly without hanging
// 			expect(executionTime).toBeLessThan(10000); // Should fail fast
// 			console.log(`Error recovery: ${executionTime.toFixed(2)}ms`);
// 		});
// 	});
// });
