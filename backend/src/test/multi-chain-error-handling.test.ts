// import {
// 	describe,
// 	it,
// 	expect,
// 	beforeEach,
// 	afterEach,
// 	jest,
// } from "@jest/globals";
// import { Request, Response, NextFunction } from "express";
// import {
// 	MultiChainErrorHandler,
// 	PlatformErrorTypes,
// 	createPlatformError,
// 	handleEthereumError,
// 	handleSolanaError,
// 	handleCardanoError,
// 	handleToolError,
// 	handleCrossChainError,
// 	multiChainErrorHandler,
// } from "../middleware/MultiChainErrorHandler";
// import { platformValidationService } from "../services/PlatformValidationService";
// import { analyzerFallbackService } from "../services/AnalyzerFallbackService";
// import { ContractInput } from "../types/blockchain";

// // Mock dependencies
// jest.mock("../utils/logger");
// jest.mock("@sentry/node");

// describe("MultiChainErrorHandler", () => {
// 	let mockReq: Partial<Request>;
// 	let mockRes: Partial<Response>;
// 	let mockNext: NextFunction;

// 	beforeEach(() => {
// 		mockReq = {
// 			headers: { "x-request-id": "test-request-id" },
// 			method: "POST",
// 			originalUrl: "/api/analysis",
// 			ip: "127.0.0.1",
// 			get: jest.fn().mockReturnValue("test-user-agent"),
// 		};
// 		mockRes = {
// 			status: jest.fn().mockReturnThis(),
// 			json: jest.fn(),
// 		};
// 		mockNext = jest.fn();
// 	});

// 	afterEach(() => {
// 		jest.clearAllMocks();
// 	});

// 	describe("Platform Error Creation", () => {
// 		it("should create Ethereum compilation error", () => {
// 			const error = createPlatformError(
// 				"ETHEREUM_COMPILATION_ERROR",
// 				"Solidity compilation failed",
// 				"ethereum",
// 				{ line: 10 }
// 			);

// 			expect(error.code).toBe("ETHEREUM_COMPILATION_ERROR");
// 			expect(error.statusCode).toBe(422);
// 			expect(error.platform).toBe("ethereum");
// 			expect(error.platformSpecificData).toEqual({ line: 10 });
// 			expect(error.retryable).toBe(false);
// 		});

// 		it("should create Solana build error", () => {
// 			const error = createPlatformError(
// 				"ANCHOR_BUILD_FAILED",
// 				"Anchor build failed",
// 				"solana"
// 			);

// 			expect(error.code).toBe("ANCHOR_BUILD_FAILED");
// 			expect(error.statusCode).toBe(422);
// 			expect(error.platform).toBe("solana");
// 			expect(error.retryable).toBe(false);
// 		});

// 		it("should create retryable tool timeout error", () => {
// 			const error = createPlatformError(
// 				"TOOL_EXECUTION_TIMEOUT",
// 				"Tool execution timed out",
// 				"ethereum"
// 			);

// 			expect(error.code).toBe("TOOL_EXECUTION_TIMEOUT");
// 			expect(error.retryable).toBe(true);
// 		});
// 	});

// 	describe("Platform-Specific Error Handling", () => {
// 		it("should handle Ethereum compilation errors", () => {
// 			const originalError = new Error(
// 				"compilation failed: syntax error at line 10"
// 			);
// 			const platformError = handleEthereumError(originalError, {
// 				contract: "test.sol",
// 			});

// 			expect(platformError.code).toBe("ETHEREUM_COMPILATION_ERROR");
// 			expect(platformError.platform).toBe("ethereum");
// 			expect(platformError.message).toContain("compilation failed");
// 			expect(platformError.platformSpecificData?.suggestions).toContain(
// 				"Verify Solidity version compatibility"
// 			);
// 		});

// 		it("should handle Solana Anchor build errors", () => {
// 			const originalError = new Error(
// 				"anchor build failed: missing dependency"
// 			);
// 			const platformError = handleSolanaError(originalError, {
// 				program: "test.rs",
// 			});

// 			expect(platformError.code).toBe("ANCHOR_BUILD_FAILED");
// 			expect(platformError.platform).toBe("solana");
// 			expect(platformError.platformSpecificData?.suggestions).toContain(
// 				"Verify Anchor version compatibility"
// 			);
// 		});

// 		it("should handle Cardano Plutus errors", () => {
// 			const originalError = new Error("plutus compilation failed: type error");
// 			const platformError = handleCardanoError(originalError, {
// 				script: "validator.hs",
// 			});

// 			expect(platformError.code).toBe("PLUTUS_CORE_ERROR");
// 			expect(platformError.platform).toBe("cardano");
// 			expect(platformError.platformSpecificData?.suggestions).toContain(
// 				"Verify Plutus Core version compatibility"
// 			);
// 		});

// 		it("should handle tool installation errors", () => {
// 			const originalError = new Error("slither: command not found");
// 			const platformError = handleToolError(
// 				"slither",
// 				"ethereum",
// 				originalError
// 			);

// 			expect(platformError.code).toBe("TOOL_INSTALLATION_MISSING");
// 			expect(platformError.platform).toBe("ethereum");
// 			expect(platformError.toolName).toBe("slither");
// 			expect(platformError.platformSpecificData?.suggestions).toContain(
// 				"Install Slither: pip install slither-analyzer"
// 			);
// 		});

// 		it("should handle cross-chain analysis errors", () => {
// 			const originalError = new Error("Cross-chain bridge analysis failed");
// 			const platforms = ["ethereum", "solana"];
// 			const platformError = handleCrossChainError(originalError, platforms);

// 			expect(platformError.code).toBe("CROSS_CHAIN_ANALYSIS_FAILED");
// 			expect(platformError.platform).toBe("ethereum,solana");
// 			expect(platformError.platformSpecificData?.platforms).toEqual(platforms);
// 		});
// 	});

// 	describe("Error Handler Middleware", () => {
// 		it("should handle platform-specific errors", () => {
// 			const platformError = createPlatformError(
// 				"ETHEREUM_COMPILATION_ERROR",
// 				"Test error",
// 				"ethereum"
// 			);

// 			multiChainErrorHandler(
// 				platformError,
// 				mockReq as Request,
// 				mockRes as Response,
// 				mockNext
// 			);

// 			expect(mockNext).toHaveBeenCalledWith(
// 				expect.objectContaining({
// 					code: "ETHEREUM_COMPILATION_ERROR",
// 					platform: "ethereum",
// 				})
// 			);
// 		});

// 		it("should pass non-platform errors to next handler", () => {
// 			const genericError = new Error("Generic error");

// 			multiChainErrorHandler(
// 				genericError,
// 				mockReq as Request,
// 				mockRes as Response,
// 				mockNext
// 			);

// 			expect(mockNext).toHaveBeenCalledWith(genericError);
// 		});
// 	});

// 	describe("Retry Logic", () => {
// 		it("should retry retryable operations", async () => {
// 			let attempts = 0;
// 			const operation = jest.fn().mockImplementation(() => {
// 				attempts++;
// 				if (attempts < 3) {
// 					throw new Error("Temporary failure");
// 				}
// 				return Promise.resolve("success");
// 			});

// 			const result = await MultiChainErrorHandler.retryAnalysis(
// 				operation,
// 				"ethereum",
// 				3
// 			);

// 			expect(result).toBe("success");
// 			expect(operation).toHaveBeenCalledTimes(3);
// 		});

// 		it("should fail after max retry attempts", async () => {
// 			const operation = jest
// 				.fn()
// 				.mockRejectedValue(new Error("Persistent failure"));

// 			await expect(
// 				MultiChainErrorHandler.retryAnalysis(operation, "ethereum", 2)
// 			).rejects.toThrow("Persistent failure");

// 			expect(operation).toHaveBeenCalledTimes(2);
// 		});

// 		it("should not retry non-retryable errors", async () => {
// 			const operation = jest
// 				.fn()
// 				.mockRejectedValue(
// 					createPlatformError(
// 						"ETHEREUM_COMPILATION_ERROR",
// 						"Syntax error",
// 						"ethereum"
// 					)
// 				);

// 			await expect(
// 				MultiChainErrorHandler.retryAnalysis(operation, "ethereum", 3)
// 			).rejects.toThrow("Syntax error");

// 			expect(operation).toHaveBeenCalledTimes(1);
// 		});
// 	});

// 	describe("Graceful Degradation", () => {
// 		it("should suggest AI fallback for static analysis failures", async () => {
// 			const error = new Error("Static analysis tool failed");
// 			const result = await MultiChainErrorHandler.handleAnalyzerFailure(
// 				"ethereum",
// 				error,
// 				{ enableAIFallback: true }
// 			);

// 			expect(result.shouldContinue).toBe(true);
// 			expect(result.fallbackStrategy).toBe("ai-only");
// 			expect(result.modifiedOptions?.includeStaticAnalysis).toBe(false);
// 			expect(result.modifiedOptions?.includeAIAnalysis).toBe(true);
// 		});

// 		it("should suggest basic validation fallback", async () => {
// 			const error = new Error("All analysis tools failed");
// 			const result = await MultiChainErrorHandler.handleAnalyzerFailure(
// 				"solana",
// 				error,
// 				{ enableBasicValidation: true }
// 			);

// 			expect(result.shouldContinue).toBe(true);
// 			expect(result.fallbackStrategy).toBe("basic-validation");
// 			expect(result.modifiedOptions?.basicValidationOnly).toBe(true);
// 		});

// 		it("should suggest skipping platform when no fallback available", async () => {
// 			const error = new Error("Platform completely unavailable");
// 			const result = await MultiChainErrorHandler.handleAnalyzerFailure(
// 				"cardano",
// 				error,
// 				{ skipPlatform: true }
// 			);

// 			expect(result.shouldContinue).toBe(true);
// 			expect(result.fallbackStrategy).toBe("skip-platform");
// 		});

// 		it("should indicate no fallback when all options disabled", async () => {
// 			const error = new Error("No fallback configured");
// 			const result = await MultiChainErrorHandler.handleAnalyzerFailure(
// 				"ethereum",
// 				error,
// 				{}
// 			);

// 			expect(result.shouldContinue).toBe(false);
// 			expect(result.fallbackStrategy).toBe("none");
// 		});
// 	});
// });

// describe("PlatformValidationService", () => {
// 	const mockContract: ContractInput = {
// 		code: `pragma solidity ^0.8.0;
// contract Test {
//     function test() public pure returns (uint256) {
//         return 42;
//     }
// }`,
// 		filename: "test.sol",
// 		platform: "ethereum",
// 	};

// 	beforeEach(() => {
// 		platformValidationService.clearCache();
// 	});

// 	describe("Contract Validation", () => {
// 		it("should validate Ethereum contract successfully", async () => {
// 			const result = await platformValidationService.validateContract(
// 				mockContract
// 			);

// 			expect(result.isValid).toBe(true);
// 			expect(result.platform).toBe("ethereum");
// 			expect(result.errors).toHaveLength(0);
// 		});

// 		it("should detect validation errors", async () => {
// 			const invalidContract: ContractInput = {
// 				code: "", // Empty code
// 				filename: "empty.sol",
// 				platform: "ethereum",
// 			};

// 			const result = await platformValidationService.validateContract(
// 				invalidContract
// 			);

// 			expect(result.isValid).toBe(false);
// 			expect(result.errors).toContain("Contract code cannot be empty");
// 		});

// 		it("should handle platform detection", async () => {
// 			const contractWithoutPlatform: ContractInput = {
// 				code: mockContract.code,
// 				filename: "test.sol",
// 				platform: "", // No platform specified
// 			};

// 			const result = await platformValidationService.validateContract(
// 				contractWithoutPlatform,
// 				{ enablePlatformDetection: true }
// 			);

// 			expect(result.platform).toBe("ethereum");
// 			expect(result.detectedLanguage).toBe("solidity");
// 			expect(result.confidence).toBeGreaterThan(0);
// 		});

// 		it("should use cached results", async () => {
// 			// First validation
// 			const result1 = await platformValidationService.validateContract(
// 				mockContract
// 			);

// 			// Second validation should use cache
// 			const result2 = await platformValidationService.validateContract(
// 				mockContract
// 			);

// 			expect(result1).toEqual(result2);
// 		});

// 		it("should handle unsupported platform", async () => {
// 			const unsupportedContract: ContractInput = {
// 				code: "some code",
// 				filename: "test.xyz",
// 				platform: "unsupported",
// 			};

// 			await expect(
// 				platformValidationService.validateContract(unsupportedContract)
// 			).rejects.toThrow("Platform 'unsupported' is not supported");
// 		});
// 	});

// 	describe("Batch Validation", () => {
// 		it("should validate multiple contracts", async () => {
// 			const contracts: ContractInput[] = [
// 				mockContract,
// 				{
// 					code: "use anchor_lang::prelude::*;",
// 					filename: "test.rs",
// 					platform: "solana",
// 				},
// 			];

// 			const result = await platformValidationService.validateContracts(
// 				contracts
// 			);

// 			expect(result.results).toHaveLength(2);
// 			expect(result.summary.total).toBe(2);
// 			expect(result.errors).toHaveLength(0);
// 		});

// 		it("should continue on error when configured", async () => {
// 			const contracts: ContractInput[] = [
// 				mockContract,
// 				{
// 					code: "",
// 					filename: "empty.sol",
// 					platform: "ethereum",
// 				},
// 			];

// 			const result = await platformValidationService.validateContracts(
// 				contracts,
// 				{ continueOnError: true }
// 			);

// 			expect(result.results).toHaveLength(2);
// 			expect(result.summary.valid).toBe(1);
// 			expect(result.summary.invalid).toBe(1);
// 		});
// 	});
// });

// describe("AnalyzerFallbackService", () => {
// 	const mockContracts: ContractInput[] = [
// 		{
// 			code: "pragma solidity ^0.8.0; contract Test {}",
// 			filename: "test.sol",
// 			platform: "ethereum",
// 		},
// 	];

// 	const mockAnalyzer = {
// 		platform: "ethereum",
// 		analyze: jest.fn(),
// 		validateContract: jest.fn(),
// 		checkHealth: jest.fn(),
// 	};

// 	beforeEach(() => {
// 		analyzerFallbackService.clearCache();
// 		jest.clearAllMocks();
// 	});

// 	describe("Fallback Analysis", () => {
// 		it("should use primary analysis when successful", async () => {
// 			const mockResult = {
// 				success: true,
// 				vulnerabilities: [],
// 				errors: [],
// 				warnings: [],
// 				executionTime: 1000,
// 			};

// 			mockAnalyzer.analyze.mockResolvedValue(mockResult);

// 			const result = await analyzerFallbackService.analyzeWithFallback(
// 				mockAnalyzer as any,
// 				mockContracts,
// 				{ includeStaticAnalysis: true }
// 			);

// 			expect(result.fallbackStrategy).toBe("none");
// 			expect(result.degradationLevel).toBe("none");
// 			expect(result.success).toBe(true);
// 			expect(mockAnalyzer.analyze).toHaveBeenCalledTimes(1);
// 		});

// 		it("should fallback to AI analysis when primary fails", async () => {
// 			mockAnalyzer.analyze.mockRejectedValue(
// 				new Error("Static analysis failed")
// 			);

// 			const result = await analyzerFallbackService.analyzeWithFallback(
// 				mockAnalyzer as any,
// 				mockContracts,
// 				{ includeStaticAnalysis: true },
// 				{ enableAIFallback: true }
// 			);

// 			expect(result.fallbackStrategy).toBe("ai-only");
// 			expect(result.degradationLevel).toBe("partial");
// 			expect(result.availableFeatures).toContain("AI Analysis");
// 			expect(result.unavailableFeatures).toContain("Static Analysis Tools");
// 		});

// 		it("should fallback to basic validation when AI fails", async () => {
// 			mockAnalyzer.analyze.mockRejectedValue(new Error("Analysis failed"));

// 			const result = await analyzerFallbackService.analyzeWithFallback(
// 				mockAnalyzer as any,
// 				mockContracts,
// 				{ includeStaticAnalysis: true },
// 				{
// 					enableAIFallback: true,
// 					enableBasicValidation: true,
// 				}
// 			);

// 			expect(result.fallbackStrategy).toBe("basic-validation");
// 			expect(result.degradationLevel).toBe("significant");
// 			expect(result.success).toBe(true);
// 		});

// 		it("should provide minimal analysis as last resort", async () => {
// 			mockAnalyzer.analyze.mockRejectedValue(new Error("Complete failure"));

// 			const result = await analyzerFallbackService.analyzeWithFallback(
// 				mockAnalyzer as any,
// 				mockContracts,
// 				{ includeStaticAnalysis: true },
// 				{
// 					enableAIFallback: false,
// 					enableBasicValidation: false,
// 					enableCachedResults: false,
// 				}
// 			);

// 			expect(result.fallbackStrategy).toBe("minimal");
// 			expect(result.degradationLevel).toBe("minimal");
// 			expect(result.success).toBe(true);
// 			expect(result.warnings).toContain(
// 				"Analysis completed with minimal functionality"
// 			);
// 		});

// 		it("should track all fallback attempts", async () => {
// 			mockAnalyzer.analyze.mockRejectedValue(new Error("Primary failed"));

// 			const result = await analyzerFallbackService.analyzeWithFallback(
// 				mockAnalyzer as any,
// 				mockContracts,
// 				{ includeStaticAnalysis: true }
// 			);

// 			expect(result.attempts).toHaveLength(2); // Primary + AI fallback
// 			expect(result.attempts[0].strategy).toBe("none");
// 			expect(result.attempts[0].success).toBe(false);
// 			expect(result.attempts[1].strategy).toBe("ai-only");
// 			expect(result.attempts[1].success).toBe(true);
// 		});
// 	});

// 	describe("Result Caching", () => {
// 		it("should cache successful analysis results", () => {
// 			const mockResult = {
// 				success: true,
// 				vulnerabilities: [],
// 				errors: [],
// 				warnings: [],
// 				executionTime: 1000,
// 			};

// 			analyzerFallbackService.cacheResult(mockContracts[0], mockResult);

// 			// Verify cache is populated (indirect test through cache stats)
// 			const stats = (analyzerFallbackService as any).getCacheStats?.();
// 			// Note: This would need to be implemented in the actual service
// 		});

// 		it("should clear cache when requested", () => {
// 			const mockResult = {
// 				success: true,
// 				vulnerabilities: [],
// 				errors: [],
// 				warnings: [],
// 				executionTime: 1000,
// 			};

// 			analyzerFallbackService.cacheResult(mockContracts[0], mockResult);
// 			analyzerFallbackService.clearCache();

// 			// Cache should be empty after clearing
// 			expect(() => analyzerFallbackService.clearCache()).not.toThrow();
// 		});
// 	});
// });

// describe("Error Recovery Suggestions", () => {
// 	it("should provide tool installation suggestions", () => {
// 		const error = handleToolError(
// 			"slither",
// 			"ethereum",
// 			new Error("command not found")
// 		);

// 		expect(error.platformSpecificData?.suggestions).toContain(
// 			"Install Slither: pip install slither-analyzer"
// 		);
// 	});

// 	it("should provide platform-specific recovery suggestions", () => {
// 		const ethereumError = handleEthereumError(new Error("compilation failed"));
// 		const solanaError = handleSolanaError(new Error("anchor build failed"));
// 		const cardanoError = handleCardanoError(
// 			new Error("plutus compilation failed")
// 		);

// 		expect(ethereumError.platformSpecificData?.suggestions).toContain(
// 			"Verify Solidity version compatibility"
// 		);
// 		expect(solanaError.platformSpecificData?.suggestions).toContain(
// 			"Verify Anchor version compatibility"
// 		);
// 		expect(cardanoError.platformSpecificData?.suggestions).toContain(
// 			"Verify Plutus Core version compatibility"
// 		);
// 	});

// 	it("should provide cross-chain specific suggestions", () => {
// 		const error = handleCrossChainError(new Error("Bridge analysis failed"), [
// 			"ethereum",
// 			"solana",
// 		]);

// 		expect(error.platformSpecificData?.suggestions).toContain(
// 			"Verify all platform analyzers are available"
// 		);
// 		expect(error.platformSpecificData?.suggestions).toContain(
// 			"Try analyzing platforms individually first"
// 		);
// 	});
// });
