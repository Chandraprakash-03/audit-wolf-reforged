import { describe, it, expect, beforeEach } from "@jest/globals";
import { blockchainRegistry } from "../services/BlockchainRegistry";
import { PlatformDetectionService } from "../services/PlatformDetectionService";
import { PlatformConfigurationService } from "../services/PlatformConfigurationService";
import { AnalyzerFactory } from "../services/analyzers/AnalyzerFactory";
import { EthereumAnalyzer } from "../services/analyzers/EthereumAnalyzer";

describe("Blockchain Abstraction Layer", () => {
	describe("BlockchainRegistry", () => {
		it("should have default platforms registered", () => {
			const platforms = blockchainRegistry.getSupportedPlatforms();
			expect(platforms.length).toBeGreaterThan(0);

			const platformIds = platforms.map((p) => p.id);
			expect(platformIds).toContain("ethereum");
			expect(platformIds).toContain("solana");
			expect(platformIds).toContain("cardano");
		});

		it("should get platform by id", () => {
			const ethereum = blockchainRegistry.getPlatform("ethereum");
			expect(ethereum).toBeDefined();
			expect(ethereum?.name).toBe("Ethereum");
			expect(ethereum?.supportedLanguages).toContain("solidity");
		});

		it("should return undefined for unknown platform", () => {
			const unknown = blockchainRegistry.getPlatform("unknown-platform");
			expect(unknown).toBeUndefined();
		});
	});

	describe("PlatformDetectionService", () => {
		it("should detect Solidity/Ethereum contracts", () => {
			const solidityCode = `
				pragma solidity ^0.8.0;
				
				contract TestContract {
					uint256 public value;
					
					function setValue(uint256 _value) public {
						value = _value;
					}
				}
			`;

			const detection = PlatformDetectionService.detectContractPlatform(
				solidityCode,
				"TestContract.sol"
			);
			expect(detection).toBeDefined();
			expect(detection?.platform.id).toBe("ethereum");
			expect(detection?.confidence).toBeGreaterThan(0.5);
		});

		it("should detect Solana/Rust contracts", () => {
			const rustCode = `
				use anchor_lang::prelude::*;
				
				#[program]
				pub mod test_program {
					use super::*;
					
					pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
						Ok(())
					}
				}
			`;

			const detection = PlatformDetectionService.detectContractPlatform(
				rustCode,
				"test_program.rs"
			);
			expect(detection).toBeDefined();
			expect(detection?.platform.id).toBe("solana");
		});

		it("should detect Cardano/Plutus contracts", () => {
			const plutusCode = `
				import Plutus.V2.Ledger.Api
				import PlutusTx
				
				validator :: BuiltinData -> BuiltinData -> BuiltinData -> ()
				validator _ _ _ = ()
			`;

			const detection = PlatformDetectionService.detectContractPlatform(
				plutusCode,
				"validator.hs"
			);
			expect(detection).toBeDefined();
			expect(detection?.platform.id).toBe("cardano");
		});

		it("should return null for unrecognizable code", () => {
			const unknownCode = 'console.log("hello world");';
			const detection = PlatformDetectionService.detectContractPlatform(
				unknownCode,
				"test.js"
			);
			expect(detection).toBeNull();
		});

		it("should auto-assign platforms to contracts", () => {
			const contracts = [
				{
					code: "pragma solidity ^0.8.0; contract Test {}",
					filename: "Test.sol",
					platform: "",
				},
				{
					code: "use anchor_lang::prelude::*; #[program] pub mod test {}",
					filename: "test.rs",
					platform: "",
				},
			];

			const assigned = PlatformDetectionService.autoAssignPlatforms(contracts);
			expect(assigned[0].platform).toBe("ethereum");
			expect(assigned[1].platform).toBe("solana");
		});
	});

	describe("PlatformConfigurationService", () => {
		it("should get default configuration for ethereum", () => {
			const config =
				PlatformConfigurationService.getDefaultConfiguration("ethereum");
			expect(config).toBeDefined();
			expect(config.analyzers).toBeDefined();
			expect(config.aiModels).toBeDefined();
			expect(config.validationRules).toBeDefined();
		});

		it("should get built-in default for unknown platform", () => {
			const config =
				PlatformConfigurationService.getDefaultConfiguration("unknown");
			expect(config).toBeDefined();
			expect(config.analyzers.default).toBeDefined();
		});
	});

	describe("AnalyzerFactory", () => {
		it("should create Ethereum analyzer", () => {
			const analyzer = AnalyzerFactory.getAnalyzer("ethereum");
			expect(analyzer).toBeDefined();
			expect(analyzer).toBeInstanceOf(EthereumAnalyzer);
		});

		it("should return null for unimplemented platforms", () => {
			const analyzer = AnalyzerFactory.getAnalyzer("solana");
			expect(analyzer).toBeNull();
		});

		it("should return null for unknown platforms", () => {
			const analyzer = AnalyzerFactory.getAnalyzer("unknown");
			expect(analyzer).toBeNull();
		});

		it("should get supported platforms with analyzer info", () => {
			const platforms = AnalyzerFactory.getSupportedPlatformsWithAnalyzers();
			expect(platforms.length).toBeGreaterThan(0);

			const ethereum = platforms.find((p) => p.platformId === "ethereum");
			expect(ethereum).toBeDefined();
			expect(ethereum?.hasAnalyzer).toBe(true);
		});

		it("should get analyzer statistics", () => {
			const stats = AnalyzerFactory.getAnalyzerStatistics();
			expect(stats.totalPlatforms).toBeGreaterThan(0);
			expect(stats.implementedAnalyzers).toBeGreaterThan(0);
			expect(stats.activePlatforms).toBeGreaterThan(0);
		});
	});

	describe("EthereumAnalyzer", () => {
		let analyzer: EthereumAnalyzer;

		beforeEach(() => {
			analyzer = new EthereumAnalyzer();
		});

		it("should validate Solidity contracts", async () => {
			const contract = {
				code: `
					pragma solidity ^0.8.0;
					contract Test {
						uint256 public value;
					}
				`,
				filename: "Test.sol",
				platform: "ethereum",
			};

			const validation = await analyzer.validateContract(contract);
			expect(validation.isValid).toBe(true);
		});

		it("should detect missing pragma", async () => {
			const contract = {
				code: `
					contract Test {
						uint256 public value;
					}
				`,
				filename: "Test.sol",
				platform: "ethereum",
			};

			const validation = await analyzer.validateContract(contract);
			expect(validation.warnings).toContain(
				"Missing pragma solidity directive"
			);
		});

		it("should reject empty contracts", async () => {
			const contract = {
				code: "",
				filename: "Empty.sol",
				platform: "ethereum",
			};

			const validation = await analyzer.validateContract(contract);
			expect(validation.isValid).toBe(false);
			expect(validation.errors).toContain("Contract code cannot be empty");
		});
	});

	describe("Integration Tests", () => {
		it("should detect and validate Ethereum contract end-to-end", async () => {
			const solidityCode = `
				pragma solidity ^0.8.0;
				
				contract SimpleStorage {
					uint256 private storedData;
					
					function set(uint256 x) public {
						storedData = x;
					}
					
					function get() public view returns (uint256) {
						return storedData;
					}
				}
			`;

			// 1. Detect platform
			const detection = PlatformDetectionService.detectContractPlatform(
				solidityCode,
				"SimpleStorage.sol"
			);
			expect(detection).toBeDefined();
			expect(detection?.platform.id).toBe("ethereum");

			// 2. Get analyzer
			const analyzer = AnalyzerFactory.getAnalyzer("ethereum");
			expect(analyzer).toBeDefined();

			// 3. Validate contract
			const contract = {
				code: solidityCode,
				filename: "SimpleStorage.sol",
				platform: "ethereum",
			};

			const validation = await analyzer!.validateContract(contract);
			expect(validation.isValid).toBe(true);
		});

		it("should handle platform mismatch gracefully", () => {
			const solidityCode = "pragma solidity ^0.8.0; contract Test {}";

			const contracts = [
				{
					code: solidityCode,
					filename: "Test.sol",
					platform: "solana", // Wrong platform
				},
			];

			const validation =
				PlatformDetectionService.validatePlatformAssignments(contracts);
			expect(validation.valid).toBe(false);
			expect(validation.issues.length).toBeGreaterThan(0);
		});
	});
});
