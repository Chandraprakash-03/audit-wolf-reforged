import { SlitherAnalyzer, SlitherConfig } from "../services/SlitherAnalyzer";
import * as fs from "fs-extra";
import * as tmp from "tmp";

// Mock child_process to avoid actual Slither execution in tests
jest.mock("child_process", () => ({
	spawn: jest.fn(),
}));

// Mock fs-extra
jest.mock("fs-extra", () => ({
	writeFile: jest.fn().mockResolvedValue(undefined),
	readFile: jest.fn().mockResolvedValue(""),
}));

// Mock tmp
jest.mock("tmp", () => ({
	dirSync: jest.fn(),
}));

import { spawn } from "child_process";
import { EventEmitter } from "events";

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
const mockDirSync = tmp.dirSync as jest.MockedFunction<typeof tmp.dirSync>;

describe("SlitherAnalyzer", () => {
	let analyzer: SlitherAnalyzer;
	let mockProcess: any;
	let mockTempDir: any;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Create mock process
		mockProcess = new EventEmitter();
		mockProcess.stdout = new EventEmitter();
		mockProcess.stderr = new EventEmitter();
		mockProcess.kill = jest.fn();
		mockProcess.killed = false;

		// Create mock temp directory
		mockTempDir = {
			name: "/tmp/test-dir",
			removeCallback: jest.fn(),
		};

		// Setup default mocks
		mockSpawn.mockReturnValue(mockProcess as any);
		mockDirSync.mockReturnValue(mockTempDir);
		// mockWriteFile is already mocked in the jest.mock call

		// Create analyzer with test config
		const testConfig: Partial<SlitherConfig> = {
			timeout: 5000,
			maxFileSize: 1024 * 1024,
			outputFormat: "json",
		};
		analyzer = new SlitherAnalyzer(testConfig);
	});

	const sampleContract = `
		pragma solidity ^0.8.0;
		contract TestContract {
			uint256 public value;
			function setValue(uint256 _value) public {
				value = _value;
			}
		}
	`;

	describe("analyzeContract", () => {
		it("should successfully analyze a valid contract", async () => {
			const mockSlitherOutput = {
				results: {
					detectors: [
						{
							check: "pragma",
							impact: "informational",
							confidence: "high",
							description: "Pragma version not specified",
							markdown: "Consider specifying pragma version",
							elements: [
								{
									source_mapping: {
										filename: "TestContract.sol",
										lines: [1],
										starting_column: 0,
										length: 20,
									},
								},
							],
						},
					],
				},
			};

			// Setup process to emit successful completion
			setTimeout(() => {
				mockProcess.stdout.emit("data", JSON.stringify(mockSlitherOutput));
				mockProcess.emit("close", 0);
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.success).toBe(true);
			expect(result.vulnerabilities).toHaveLength(1);
			expect(result.vulnerabilities[0].type).toBe("pragma");
			expect(result.vulnerabilities[0].severity).toBe("low");
			expect(result.executionTime).toBeGreaterThan(0);
			expect(mockWriteFile).toHaveBeenCalledWith(
				expect.stringContaining("TestContract.sol"),
				sampleContract,
				"utf8"
			);
		});

		it("should handle empty source code", async () => {
			const result = await analyzer.analyzeContract("", "TestContract");

			expect(result.success).toBe(false);
			expect(result.errors).toContain("Source code cannot be empty");
			expect(result.vulnerabilities).toHaveLength(0);
		});

		it("should handle oversized contracts", async () => {
			const largeContract = "a".repeat(2 * 1024 * 1024); // 2MB

			const result = await analyzer.analyzeContract(
				largeContract,
				"TestContract"
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]).toContain("Contract size exceeds maximum limit");
		});

		it("should handle Slither execution timeout", async () => {
			// Don't emit any events to simulate timeout
			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.success).toBe(false);
			expect(result.errors).toContain("Analysis timed out");
			expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
		}, 10000); // 10 second timeout for this test

		it("should handle Slither execution errors", async () => {
			setTimeout(() => {
				mockProcess.emit("error", new Error("Slither not found"));
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]).toContain(
				"Slither execution failed: Slither not found"
			);
		});

		it("should handle invalid JSON output", async () => {
			setTimeout(() => {
				mockProcess.stdout.emit("data", "invalid json");
				mockProcess.emit("close", 0);
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.success).toBe(true); // Should fallback to text parsing
			expect(result.vulnerabilities).toHaveLength(0);
		});

		it("should parse text output when JSON fails", async () => {
			const textOutput = `
				INFO: TestContract.sol:5:1: Informational issue found
				WARNING: TestContract.sol:10:1: Medium severity issue
				ERROR: TestContract.sol:15:1: High severity issue
			`;

			setTimeout(() => {
				mockProcess.stdout.emit("data", textOutput);
				mockProcess.emit("close", 0);
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.success).toBe(true);
			expect(result.vulnerabilities.length).toBeGreaterThan(0);
		});

		it("should handle stderr warnings and errors", async () => {
			setTimeout(() => {
				mockProcess.stderr.emit("data", "WARNING: Compilation warning\n");
				mockProcess.stderr.emit("data", "ERROR: Compilation error\n");
				mockProcess.stdout.emit("data", '{"results": {"detectors": []}}');
				mockProcess.emit("close", 1);
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.warnings).toContain("WARNING: Compilation warning");
			expect(result.errors).toContain("ERROR: Compilation error");
		});
	});

	describe("checkSlitherInstallation", () => {
		it("should detect installed Slither", async () => {
			const mockVersionProcess: any = new EventEmitter();
			mockVersionProcess.stdout = new EventEmitter();
			mockVersionProcess.stderr = new EventEmitter();

			mockSpawn.mockReturnValue(mockVersionProcess);

			setTimeout(() => {
				mockVersionProcess.stdout.emit("data", "0.9.6\n");
				mockVersionProcess.emit("close", 0);
			}, 100);

			const result = await SlitherAnalyzer.checkSlitherInstallation();

			expect(result.installed).toBe(true);
			expect(result.version).toBe("0.9.6");
		});

		it("should detect missing Slither", async () => {
			const mockVersionProcess: any = new EventEmitter();
			mockVersionProcess.stdout = new EventEmitter();
			mockVersionProcess.stderr = new EventEmitter();

			mockSpawn.mockReturnValue(mockVersionProcess);

			setTimeout(() => {
				mockVersionProcess.emit("error", new Error("Command not found"));
			}, 100);

			const result = await SlitherAnalyzer.checkSlitherInstallation();

			expect(result.installed).toBe(false);
			expect(result.error).toBe("Command not found");
		});
	});

	describe("getContractAST", () => {
		it("should extract AST successfully", async () => {
			const mockAST = {
				contracts: {
					"TestContract.sol": {
						TestContract: {
							functions: ["setValue"],
							variables: ["value"],
						},
					},
				},
			};

			setTimeout(() => {
				mockProcess.stdout.emit("data", JSON.stringify(mockAST));
				mockProcess.emit("close", 0);
			}, 100);

			const result = await analyzer.getContractAST(
				sampleContract,
				"TestContract"
			);

			expect(result.success).toBe(true);
			expect(result.ast).toEqual(mockAST);
		});

		it("should handle AST extraction errors", async () => {
			setTimeout(() => {
				mockProcess.stderr.emit("data", "AST extraction failed");
				mockProcess.emit("close", 1);
			}, 100);

			const result = await analyzer.getContractAST(
				sampleContract,
				"TestContract"
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("AST extraction failed");
		});
	});

	describe("severity mapping", () => {
		it("should map Slither severities correctly", async () => {
			const mockDetectors = [
				{
					check: "test1",
					impact: "high",
					confidence: "high",
					description: "High impact",
					elements: [],
				},
				{
					check: "test2",
					impact: "medium",
					confidence: "medium",
					description: "Medium impact",
					elements: [],
				},
				{
					check: "test3",
					impact: "low",
					confidence: "low",
					description: "Low impact",
					elements: [],
				},
				{
					check: "test4",
					impact: "informational",
					confidence: "high",
					description: "Info",
					elements: [],
				},
			];

			const mockOutput = {
				results: {
					detectors: mockDetectors,
				},
			};

			setTimeout(() => {
				mockProcess.stdout.emit("data", JSON.stringify(mockOutput));
				mockProcess.emit("close", 0);
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.vulnerabilities).toHaveLength(4);
			expect(result.vulnerabilities[0].severity).toBe("critical"); // high -> critical
			expect(result.vulnerabilities[1].severity).toBe("high"); // medium -> high
			expect(result.vulnerabilities[2].severity).toBe("medium"); // low -> medium
			expect(result.vulnerabilities[3].severity).toBe("low"); // informational -> low
		});
	});

	describe("confidence mapping", () => {
		it("should map Slither confidence levels correctly", async () => {
			const mockDetectors = [
				{
					check: "test1",
					impact: "high",
					confidence: "high",
					description: "High confidence",
					elements: [],
				},
				{
					check: "test2",
					impact: "high",
					confidence: "medium",
					description: "Medium confidence",
					elements: [],
				},
				{
					check: "test3",
					impact: "high",
					confidence: "low",
					description: "Low confidence",
					elements: [],
				},
			];

			const mockOutput = {
				results: {
					detectors: mockDetectors,
				},
			};

			setTimeout(() => {
				mockProcess.stdout.emit("data", JSON.stringify(mockOutput));
				mockProcess.emit("close", 0);
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.vulnerabilities).toHaveLength(3);
			expect(result.vulnerabilities[0].confidence).toBe(0.9); // high
			expect(result.vulnerabilities[1].confidence).toBe(0.7); // medium
			expect(result.vulnerabilities[2].confidence).toBe(0.5); // low
		});
	});

	describe("location extraction", () => {
		it("should extract location information correctly", async () => {
			const mockDetector = {
				check: "test",
				impact: "high",
				confidence: "high",
				description: "Test vulnerability",
				elements: [
					{
						source_mapping: {
							filename: "TestContract.sol",
							lines: [10, 11, 12],
							starting_column: 4,
							length: 50,
						},
					},
				],
			};

			const mockOutput = {
				results: {
					detectors: [mockDetector],
				},
			};

			setTimeout(() => {
				mockProcess.stdout.emit("data", JSON.stringify(mockOutput));
				mockProcess.emit("close", 0);
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.vulnerabilities).toHaveLength(1);
			const vuln = result.vulnerabilities[0];
			expect(vuln.location.file).toBe("TestContract.sol");
			expect(vuln.location.line).toBe(10);
			expect(vuln.location.column).toBe(4);
			expect(vuln.location.length).toBe(50);
		});

		it("should handle missing location information", async () => {
			const mockDetector = {
				check: "test",
				impact: "high",
				confidence: "high",
				description: "Test vulnerability",
				elements: [],
			};

			const mockOutput = {
				results: {
					detectors: [mockDetector],
				},
			};

			setTimeout(() => {
				mockProcess.stdout.emit("data", JSON.stringify(mockOutput));
				mockProcess.emit("close", 0);
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.vulnerabilities).toHaveLength(1);
			const vuln = result.vulnerabilities[0];
			expect(vuln.location.file).toBe("unknown");
			expect(vuln.location.line).toBe(0);
			expect(vuln.location.column).toBe(0);
		});
	});

	describe("recommendation generation", () => {
		it("should generate appropriate recommendations", async () => {
			const mockDetectors = [
				{
					check: "reentrancy-eth",
					impact: "high",
					confidence: "high",
					description: "Reentrancy",
					elements: [],
				},
				{
					check: "tx-origin",
					impact: "medium",
					confidence: "high",
					description: "tx.origin usage",
					elements: [],
				},
				{
					check: "unknown-detector",
					impact: "low",
					confidence: "medium",
					description: "Unknown",
					elements: [],
				},
			];

			const mockOutput = {
				results: {
					detectors: mockDetectors,
				},
			};

			setTimeout(() => {
				mockProcess.stdout.emit("data", JSON.stringify(mockOutput));
				mockProcess.emit("close", 0);
			}, 100);

			const result = await analyzer.analyzeContract(
				sampleContract,
				"TestContract"
			);

			expect(result.vulnerabilities).toHaveLength(3);
			expect(result.vulnerabilities[0].recommendation).toContain(
				"checks-effects-interactions"
			);
			expect(result.vulnerabilities[1].recommendation).toContain("msg.sender");
			expect(result.vulnerabilities[2].recommendation).toContain(
				"Review the identified issue"
			);
		});
	});
});
