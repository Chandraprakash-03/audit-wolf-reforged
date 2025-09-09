import { spawn, ChildProcess } from "child_process";
import * as fs from "fs-extra";
import * as tmp from "tmp";
import * as path from "path";

export interface SlitherVulnerability {
	type: string;
	severity: "critical" | "high" | "medium" | "low" | "informational";
	title: string;
	description: string;
	location: {
		file: string;
		line: number;
		column: number;
		length?: number;
	};
	recommendation: string;
	confidence: number;
	source: "static";
	rawOutput?: any;
}

export interface SlitherAnalysisResult {
	success: boolean;
	vulnerabilities: SlitherVulnerability[];
	errors: string[];
	warnings: string[];
	executionTime: number;
	slitherVersion?: string;
}

export interface SlitherConfig {
	timeout: number; // in milliseconds
	maxFileSize: number; // in bytes
	enabledDetectors?: string[];
	disabledDetectors?: string[];
	outputFormat: "json" | "text";
}

export class SlitherAnalyzer {
	private config: SlitherConfig;
	private static readonly DEFAULT_CONFIG: SlitherConfig = {
		timeout: 60000, // 60 seconds
		maxFileSize: 10 * 1024 * 1024, // 10MB
		outputFormat: "json",
		enabledDetectors: [
			"reentrancy-eth",
			"reentrancy-no-eth",
			"reentrancy-unlimited-gas",
			"uninitialized-state",
			"uninitialized-storage",
			"arbitrary-send",
			"controlled-delegatecall",
			"delegatecall-loop",
			"msg-value-loop",
			"tx-origin",
			"assembly",
			"assert-state-change",
			"boolean-equal",
			"dangerous-unary",
			"deprecated-standards",
			"divide-before-multiply",
			"enum-conversion",
			"erc20-interface",
			"erc721-interface",
			"incorrect-equality",
			"locked-ether",
			"mapping-deletion",
			"shadowing-abstract",
			"shadowing-builtin",
			"shadowing-local",
			"shadowing-state",
			"timestamp",
			"tautology",
			"boolean-cst",
			"similar-names",
			"too-many-digits",
			"constable-states",
			"external-function",
			"naming-convention",
			"pragma",
			"solc-version",
			"unused-state",
			"costly-loop",
			"dead-code",
			"reentrancy-benign",
			"reentrancy-events",
			"low-level-calls",
			"missing-zero-check",
			"calls-loop",
			"events-access",
			"events-maths",
			"incorrect-unary",
			"missing-inheritance",
			"redundant-statements",
			"void-cst",
		],
	};

	constructor(config?: Partial<SlitherConfig>) {
		this.config = { ...SlitherAnalyzer.DEFAULT_CONFIG, ...config };
	}

	/**
	 * Analyzes a Solidity contract using Slither
	 */
	async analyzeContract(
		sourceCode: string,
		contractName: string = "Contract"
	): Promise<SlitherAnalysisResult> {
		const startTime = Date.now();
		let tempDir: tmp.DirResult | null = null;
		let slitherProcess: ChildProcess | null = null;

		try {
			// Validate input
			if (!sourceCode || sourceCode.trim().length === 0) {
				throw new Error("Source code cannot be empty");
			}

			if (Buffer.byteLength(sourceCode, "utf8") > this.config.maxFileSize) {
				throw new Error(
					`Contract size exceeds maximum limit of ${this.config.maxFileSize} bytes`
				);
			}

			// Create temporary directory and file
			tempDir = tmp.dirSync({ unsafeCleanup: true });
			const contractPath = path.join(tempDir.name, `${contractName}.sol`);

			// Write contract to temporary file
			await fs.writeFile(contractPath, sourceCode, "utf8");

			// Run Slither analysis
			const slitherResult = await this.runSlitherAnalysis(
				contractPath,
				tempDir.name
			);

			const executionTime = Date.now() - startTime;

			return {
				...slitherResult,
				executionTime,
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			return {
				success: false,
				vulnerabilities: [],
				errors: [error instanceof Error ? error.message : String(error)],
				warnings: [],
				executionTime,
			};
		} finally {
			if (tempDir) {
				try {
					tempDir.removeCallback();
				} catch (cleanupError) {
					console.warn("Failed to cleanup temporary directory:", cleanupError);
				}
			}
		}
	}

	/**
	 * Runs Slither analysis on the contract file
	 */
	private async runSlitherAnalysis(
		contractPath: string,
		workingDir: string
	): Promise<Omit<SlitherAnalysisResult, "executionTime">> {
		return new Promise((resolve) => {
			const args = this.buildSlitherArgs(contractPath);
			const slitherProcess = spawn("slither", args, {
				cwd: workingDir,
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";
			let isResolved = false;

			// Set up timeout
			const timeout = setTimeout(() => {
				if (!isResolved) {
					isResolved = true;
					slitherProcess.kill("SIGTERM");
					resolve({
						success: false,
						vulnerabilities: [],
						errors: ["Analysis timed out"],
						warnings: [],
					});
				}
			}, this.config.timeout);

			// Collect output
			slitherProcess.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			slitherProcess.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			// Handle process completion
			slitherProcess.on("close", (code) => {
				if (!isResolved) {
					isResolved = true;
					clearTimeout(timeout);

					try {
						const result = this.parseSlitherOutput(stdout, stderr, code);
						resolve(result);
					} catch (parseError) {
						resolve({
							success: false,
							vulnerabilities: [],
							errors: [
								`Failed to parse Slither output: ${
									parseError instanceof Error
										? parseError.message
										: String(parseError)
								}`,
							],
							warnings: [],
						});
					}
				}
			});

			slitherProcess.on("error", (error) => {
				if (!isResolved) {
					isResolved = true;
					clearTimeout(timeout);
					resolve({
						success: false,
						vulnerabilities: [],
						errors: [`Slither execution failed: ${error.message}`],
						warnings: [],
					});
				}
			});
		});
	}

	/**
	 * Builds command line arguments for Slither
	 */
	private buildSlitherArgs(contractPath: string): string[] {
		const args = [contractPath];

		// Output format
		if (this.config.outputFormat === "json") {
			args.push("--json", "-");
		}

		// Enabled detectors
		if (
			this.config.enabledDetectors &&
			this.config.enabledDetectors.length > 0
		) {
			args.push("--detect", this.config.enabledDetectors.join(","));
		}

		// Disabled detectors
		if (
			this.config.disabledDetectors &&
			this.config.disabledDetectors.length > 0
		) {
			args.push("--exclude", this.config.disabledDetectors.join(","));
		}

		// Additional flags for better analysis
		args.push("--disable-color");
		args.push("--no-fail-pedantic");

		return args;
	}

	/**
	 * Parses Slither output and converts to standardized format
	 */
	private parseSlitherOutput(
		stdout: string,
		stderr: string,
		exitCode: number | null
	): Omit<SlitherAnalysisResult, "executionTime"> {
		const errors: string[] = [];
		const warnings: string[] = [];
		const vulnerabilities: SlitherVulnerability[] = [];

		// Parse stderr for errors and warnings
		if (stderr) {
			const stderrLines = stderr.split("\n").filter((line) => line.trim());
			for (const line of stderrLines) {
				if (line.toLowerCase().includes("error")) {
					errors.push(line);
				} else if (line.toLowerCase().includes("warning")) {
					warnings.push(line);
				}
			}
		}

		// Parse JSON output if available
		if (this.config.outputFormat === "json" && stdout.trim()) {
			try {
				const jsonOutput = JSON.parse(stdout);
				if (jsonOutput.results && jsonOutput.results.detectors) {
					for (const detector of jsonOutput.results.detectors) {
						const vuln = this.convertSlitherDetectorToVulnerability(detector);
						if (vuln) {
							vulnerabilities.push(vuln);
						}
					}
				}
			} catch (jsonError) {
				// If JSON parsing fails, try to parse text output
				const textVulns = this.parseTextOutput(stdout);
				vulnerabilities.push(...textVulns);
			}
		} else {
			// Parse text output
			const textVulns = this.parseTextOutput(stdout);
			vulnerabilities.push(...textVulns);
		}

		const success = exitCode === 0 || vulnerabilities.length > 0;

		return {
			success,
			vulnerabilities,
			errors,
			warnings,
		};
	}

	/**
	 * Converts Slither detector result to standardized vulnerability format
	 */
	private convertSlitherDetectorToVulnerability(
		detector: any
	): SlitherVulnerability | null {
		try {
			const severity = this.mapSlitherSeverity(detector.impact);
			const location = this.extractLocation(detector.elements);

			return {
				type: detector.check || "unknown",
				severity,
				title: detector.description || "Unknown vulnerability",
				description: detector.markdown || detector.description || "",
				location,
				recommendation: this.generateRecommendation(detector),
				confidence: this.mapSlitherConfidence(detector.confidence),
				source: "static",
				rawOutput: detector,
			};
		} catch (error) {
			console.warn("Failed to convert Slither detector:", error);
			return null;
		}
	}

	/**
	 * Parses text output when JSON is not available
	 */
	private parseTextOutput(output: string): SlitherVulnerability[] {
		const vulnerabilities: SlitherVulnerability[] = [];
		const lines = output.split("\n");

		// Simple text parsing - this is a fallback method
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (
				line.includes("INFO:") ||
				line.includes("WARNING:") ||
				line.includes("ERROR:")
			) {
				const vuln = this.parseTextLine(line);
				if (vuln) {
					vulnerabilities.push(vuln);
				}
			}
		}

		return vulnerabilities;
	}

	/**
	 * Parses a single line of text output
	 */
	private parseTextLine(line: string): SlitherVulnerability | null {
		try {
			// Extract severity
			let severity: SlitherVulnerability["severity"] = "informational";
			if (line.includes("ERROR:")) severity = "high";
			else if (line.includes("WARNING:")) severity = "medium";
			else if (line.includes("INFO:")) severity = "low";

			return {
				type: "text-parsed",
				severity,
				title: line.substring(0, 100),
				description: line,
				location: {
					file: "unknown",
					line: 0,
					column: 0,
				},
				recommendation:
					"Review the identified issue and apply appropriate fixes.",
				confidence: 0.5,
				source: "static",
			};
		} catch (error) {
			return null;
		}
	}

	/**
	 * Maps Slither severity to standardized severity levels
	 */
	private mapSlitherSeverity(impact: string): SlitherVulnerability["severity"] {
		switch (impact?.toLowerCase()) {
			case "high":
				return "critical";
			case "medium":
				return "high";
			case "low":
				return "medium";
			case "informational":
				return "low";
			default:
				return "informational";
		}
	}

	/**
	 * Maps Slither confidence to numeric value
	 */
	private mapSlitherConfidence(confidence: string): number {
		switch (confidence?.toLowerCase()) {
			case "high":
				return 0.9;
			case "medium":
				return 0.7;
			case "low":
				return 0.5;
			default:
				return 0.6;
		}
	}

	/**
	 * Extracts location information from Slither elements
	 */
	private extractLocation(elements: any[]): SlitherVulnerability["location"] {
		if (!elements || elements.length === 0) {
			return {
				file: "unknown",
				line: 0,
				column: 0,
			};
		}

		const firstElement = elements[0];
		if (firstElement.source_mapping) {
			return {
				file: firstElement.source_mapping.filename || "contract.sol",
				line: firstElement.source_mapping.lines?.[0] || 0,
				column: firstElement.source_mapping.starting_column || 0,
				length: firstElement.source_mapping.length,
			};
		}

		return {
			file: "contract.sol",
			line: 0,
			column: 0,
		};
	}

	/**
	 * Generates recommendation based on detector type
	 */
	private generateRecommendation(detector: any): string {
		const detectorType = detector.check?.toLowerCase() || "";

		const recommendations: Record<string, string> = {
			"reentrancy-eth":
				"Use the checks-effects-interactions pattern and consider using ReentrancyGuard.",
			"reentrancy-no-eth": "Ensure state changes occur before external calls.",
			"uninitialized-state": "Initialize all state variables explicitly.",
			"arbitrary-send":
				"Validate recipient addresses and use pull payment patterns.",
			"controlled-delegatecall":
				"Avoid delegatecall with user-controlled data.",
			"tx-origin": "Use msg.sender instead of tx.origin for authorization.",
			timestamp: "Avoid using block.timestamp for critical logic.",
			"locked-ether":
				"Implement a withdrawal function to prevent locked funds.",
			pragma: "Use a specific compiler version pragma.",
			"solc-version": "Use a recent, stable Solidity compiler version.",
			"naming-convention": "Follow Solidity naming conventions.",
			"unused-state": "Remove unused state variables to save gas.",
			"external-function":
				"Mark functions as external if they're not called internally.",
		};

		return (
			recommendations[detectorType] ||
			"Review the identified issue and apply appropriate security measures."
		);
	}

	/**
	 * Checks if Slither is installed and accessible
	 */
	static async checkSlitherInstallation(): Promise<{
		installed: boolean;
		version?: string;
		error?: string;
	}> {
		return new Promise((resolve) => {
			const process = spawn("slither", ["--version"], {
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			process.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			process.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			process.on("close", (code) => {
				if (code === 0) {
					const version = stdout.trim() || stderr.trim();
					resolve({
						installed: true,
						version,
					});
				} else {
					resolve({
						installed: false,
						error: stderr || "Slither not found",
					});
				}
			});

			process.on("error", (error) => {
				resolve({
					installed: false,
					error: error.message,
				});
			});
		});
	}

	/**
	 * Gets AST (Abstract Syntax Tree) for a Solidity contract
	 */
	async getContractAST(
		sourceCode: string,
		contractName: string = "Contract"
	): Promise<{
		success: boolean;
		ast?: any;
		error?: string;
	}> {
		let tempDir: tmp.DirResult | null = null;

		try {
			// Create temporary directory and file
			tempDir = tmp.dirSync({ unsafeCleanup: true });
			const contractPath = path.join(tempDir.name, `${contractName}.sol`);

			// Write contract to temporary file
			await fs.writeFile(contractPath, sourceCode, "utf8");

			// Run Slither with AST output
			const astResult = await this.runSlitherAST(contractPath, tempDir.name);

			return astResult;
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			if (tempDir) {
				try {
					tempDir.removeCallback();
				} catch (cleanupError) {
					console.warn("Failed to cleanup temporary directory:", cleanupError);
				}
			}
		}
	}

	/**
	 * Runs Slither to extract AST information
	 */
	private async runSlitherAST(
		contractPath: string,
		workingDir: string
	): Promise<{
		success: boolean;
		ast?: any;
		error?: string;
	}> {
		return new Promise((resolve) => {
			const args = [contractPath, "--print", "human-summary", "--json", "-"];
			const slitherProcess = spawn("slither", args, {
				cwd: workingDir,
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			const timeout = setTimeout(() => {
				slitherProcess.kill("SIGTERM");
				resolve({
					success: false,
					error: "AST extraction timed out",
				});
			}, this.config.timeout);

			slitherProcess.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			slitherProcess.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			slitherProcess.on("close", (code) => {
				clearTimeout(timeout);

				try {
					if (stdout.trim()) {
						const ast = JSON.parse(stdout);
						resolve({
							success: true,
							ast,
						});
					} else {
						resolve({
							success: false,
							error: stderr || "No AST output received",
						});
					}
				} catch (parseError) {
					resolve({
						success: false,
						error: `Failed to parse AST: ${
							parseError instanceof Error
								? parseError.message
								: String(parseError)
						}`,
					});
				}
			});

			slitherProcess.on("error", (error) => {
				clearTimeout(timeout);
				resolve({
					success: false,
					error: `AST extraction failed: ${error.message}`,
				});
			});
		});
	}
}
