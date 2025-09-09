import { describe, it, expect } from "@jest/globals";
import {
	createPlatformError,
	handleEthereumError,
	handleSolanaError,
	handleCardanoError,
	PlatformErrorTypes,
} from "../middleware/MultiChainErrorHandler";

describe("Basic Error Handling", () => {
	describe("Platform Error Creation", () => {
		it("should create platform error with correct properties", () => {
			const error = createPlatformError(
				"ETHEREUM_COMPILATION_ERROR",
				"Test compilation error",
				"ethereum",
				{ line: 10 }
			);

			expect(error.code).toBe("ETHEREUM_COMPILATION_ERROR");
			expect(error.statusCode).toBe(422);
			expect(error.platform).toBe("ethereum");
			expect(error.message).toBe("Test compilation error");
			expect(error.platformSpecificData).toEqual({ line: 10 });
		});

		it("should set retryable flag correctly", () => {
			const retryableError = createPlatformError(
				"TOOL_EXECUTION_TIMEOUT",
				"Timeout error",
				"ethereum"
			);

			const nonRetryableError = createPlatformError(
				"ETHEREUM_COMPILATION_ERROR",
				"Syntax error",
				"ethereum"
			);

			expect(retryableError.retryable).toBe(true);
			expect(nonRetryableError.retryable).toBe(false);
		});
	});

	describe("Platform-Specific Error Handling", () => {
		it("should handle Ethereum errors correctly", () => {
			const compilationError = new Error("compilation failed: syntax error");
			const platformError = handleEthereumError(compilationError);

			expect(platformError.code).toBe("ETHEREUM_COMPILATION_ERROR");
			expect(platformError.platform).toBe("ethereum");
			expect(platformError.message).toContain("compilation failed");
		});

		it("should handle Solana errors correctly", () => {
			const anchorError = new Error("anchor build failed");
			const platformError = handleSolanaError(anchorError);

			expect(platformError.code).toBe("ANCHOR_BUILD_FAILED");
			expect(platformError.platform).toBe("solana");
		});

		it("should handle Cardano errors correctly", () => {
			const plutusError = new Error("plutus compilation failed");
			const platformError = handleCardanoError(plutusError);

			expect(platformError.code).toBe("PLUTUS_CORE_ERROR");
			expect(platformError.platform).toBe("cardano");
		});
	});

	describe("Error Type Definitions", () => {
		it("should have all required platform error types", () => {
			expect(PlatformErrorTypes.ETHEREUM_COMPILATION_ERROR).toBeDefined();
			expect(PlatformErrorTypes.SOLANA_COMPILATION_ERROR).toBeDefined();
			expect(PlatformErrorTypes.CARDANO_COMPILATION_ERROR).toBeDefined();
			expect(PlatformErrorTypes.PLATFORM_NOT_SUPPORTED).toBeDefined();
			expect(PlatformErrorTypes.ANALYZER_UNAVAILABLE).toBeDefined();
		});

		it("should have correct status codes", () => {
			expect(PlatformErrorTypes.ETHEREUM_COMPILATION_ERROR.status).toBe(422);
			expect(PlatformErrorTypes.PLATFORM_NOT_SUPPORTED.status).toBe(400);
			expect(PlatformErrorTypes.ANALYZER_UNAVAILABLE.status).toBe(503);
		});
	});
});
