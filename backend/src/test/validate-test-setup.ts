/**
 * Validation script to ensure all multi-blockchain tests are properly set up
 */

import * as fs from "fs";
import * as path from "path";

interface ValidationResult {
	file: string;
	exists: boolean;
	hasTests: boolean;
	hasExpectations: boolean;
	errors: string[];
}

class TestSetupValidator {
	private testFiles = [
		"src/test/fixtures/solana-contracts.ts",
		"src/test/fixtures/cardano-contracts.ts",
		"src/test/fixtures/move-contracts.ts",
		"src/test/multi-blockchain-comprehensive.test.ts",
		"src/test/integration/multi-blockchain-integration.test.ts",
		"src/test/performance/multi-blockchain-performance.test.ts",
		"src/test/run-multi-blockchain-tests.ts",
	];

	private requiredExports = {
		"src/test/fixtures/solana-contracts.ts": [
			"SOLANA_TEST_CONTRACTS",
			"SOLANA_ANALYSIS_EXPECTATIONS",
		],
		"src/test/fixtures/cardano-contracts.ts": [
			"CARDANO_TEST_CONTRACTS",
			"CARDANO_ANALYSIS_EXPECTATIONS",
		],
		"src/test/fixtures/move-contracts.ts": [
			"MOVE_TEST_CONTRACTS",
			"MOVE_ANALYSIS_EXPECTATIONS",
		],
	};

	async validateSetup(): Promise<void> {
		console.log("🔍 Validating Multi-Blockchain Test Setup");
		console.log("=".repeat(50));

		const results: ValidationResult[] = [];

		for (const testFile of this.testFiles) {
			const result = await this.validateFile(testFile);
			results.push(result);
		}

		this.generateValidationReport(results);
	}

	private async validateFile(filePath: string): Promise<ValidationResult> {
		const fullPath = path.join(process.cwd(), filePath);
		const result: ValidationResult = {
			file: filePath,
			exists: false,
			hasTests: false,
			hasExpectations: false,
			errors: [],
		};

		// Check if file exists
		if (!fs.existsSync(fullPath)) {
			result.errors.push("File does not exist");
			return result;
		}

		result.exists = true;

		try {
			const content = fs.readFileSync(fullPath, "utf8");

			// Check for test patterns
			if (filePath.includes(".test.ts")) {
				result.hasTests = this.hasTestPatterns(content);
				if (!result.hasTests) {
					result.errors.push("No test patterns found (describe/it blocks)");
				}
			}

			// Check for required exports in fixture files
			if (this.requiredExports[filePath as keyof typeof this.requiredExports]) {
				const requiredExports =
					this.requiredExports[filePath as keyof typeof this.requiredExports];
				const missingExports = requiredExports.filter(
					(exportName) => !content.includes(`export const ${exportName}`)
				);

				if (missingExports.length > 0) {
					result.errors.push(`Missing exports: ${missingExports.join(", ")}`);
				} else {
					result.hasExpectations = true;
				}
			}

			// Validate test contract structure
			if (filePath.includes("contracts.ts")) {
				this.validateContractStructure(content, result);
			}

			// Validate test file structure
			if (filePath.includes(".test.ts")) {
				this.validateTestStructure(content, result);
			}
		} catch (error: any) {
			result.errors.push(`Error reading file: ${error.message}`);
		}

		return result;
	}

	private hasTestPatterns(content: string): boolean {
		return content.includes("describe(") && content.includes("it(");
	}

	private validateContractStructure(
		content: string,
		result: ValidationResult
	): void {
		// Check for required contract properties
		const requiredProperties = [
			"name",
			"code",
			"platform",
			"expectedVulnerabilities",
		];
		const missingProperties = requiredProperties.filter(
			(prop) => !content.includes(`${prop}:`)
		);

		if (missingProperties.length > 0) {
			result.errors.push(
				`Contract structure missing properties: ${missingProperties.join(", ")}`
			);
		}

		// Check for platform diversity
		const platforms = ["solana", "cardano", "move", "ethereum"];
		const foundPlatforms = platforms.filter((platform) =>
			content.includes(`platform: "${platform}"`)
		);

		if (foundPlatforms.length === 0) {
			result.errors.push("No platform specifications found in contracts");
		}
	}

	private validateTestStructure(
		content: string,
		result: ValidationResult
	): void {
		// Check for essential test patterns
		const essentialPatterns = [
			"beforeEach(",
			"expect(",
			"toBe(",
			"toHaveLength(",
		];

		const missingPatterns = essentialPatterns.filter(
			(pattern) => !content.includes(pattern)
		);

		if (missingPatterns.length > 0) {
			result.errors.push(
				`Missing test patterns: ${missingPatterns.join(", ")}`
			);
		}

		// Check for async test handling
		if (content.includes("async") && !content.includes("await")) {
			result.errors.push("Async functions found but no await statements");
		}

		// Check for proper error handling in tests
		if (
			!content.includes("try") &&
			!content.includes("catch") &&
			content.includes("throw")
		) {
			result.errors.push("Error throwing found but no error handling");
		}
	}

	private generateValidationReport(results: ValidationResult[]): void {
		console.log("\n📊 Validation Results:");
		console.log("-".repeat(50));

		let totalFiles = results.length;
		let validFiles = 0;
		let filesWithIssues = 0;

		results.forEach((result, index) => {
			const status = result.errors.length === 0 ? "✅" : "❌";
			const fileStatus = result.exists ? "EXISTS" : "MISSING";

			console.log(`${index + 1}. ${status} ${result.file} (${fileStatus})`);

			if (result.errors.length > 0) {
				filesWithIssues++;
				result.errors.forEach((error) => {
					console.log(`   ⚠️  ${error}`);
				});
			} else {
				validFiles++;
			}

			// Show additional info for valid files
			if (result.exists && result.errors.length === 0) {
				const info = [];
				if (result.hasTests) info.push("HAS_TESTS");
				if (result.hasExpectations) info.push("HAS_EXPECTATIONS");
				if (info.length > 0) {
					console.log(`   ℹ️  ${info.join(", ")}`);
				}
			}
		});

		console.log("\n📈 Summary:");
		console.log(`   Total Files: ${totalFiles}`);
		console.log(`   Valid Files: ${validFiles}`);
		console.log(`   Files with Issues: ${filesWithIssues}`);
		console.log(
			`   Success Rate: ${((validFiles / totalFiles) * 100).toFixed(1)}%`
		);

		// Recommendations
		console.log("\n💡 Recommendations:");

		if (filesWithIssues > 0) {
			console.log("   🔧 Fix the issues listed above before running tests");
		}

		const missingFiles = results.filter((r) => !r.exists);
		if (missingFiles.length > 0) {
			console.log("   📁 Create missing test files:");
			missingFiles.forEach((file) => {
				console.log(`      - ${file.file}`);
			});
		}

		const filesWithoutTests = results.filter(
			(r) => r.exists && r.file.includes(".test.ts") && !r.hasTests
		);
		if (filesWithoutTests.length > 0) {
			console.log("   🧪 Add test cases to files without tests:");
			filesWithoutTests.forEach((file) => {
				console.log(`      - ${file.file}`);
			});
		}

		// Package.json validation
		this.validatePackageJsonScripts();

		console.log("\n" + "=".repeat(50));

		if (filesWithIssues === 0) {
			console.log("🎉 All test files are properly set up!");
			console.log("You can now run: npm run test:multi-blockchain");
		} else {
			console.log("⚠️  Please fix the issues above before running tests");
		}
	}

	private validatePackageJsonScripts(): void {
		const packageJsonPath = path.join(process.cwd(), "package.json");

		if (!fs.existsSync(packageJsonPath)) {
			console.log("   ❌ package.json not found");
			return;
		}

		try {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
			const scripts = packageJson.scripts || {};

			const requiredScripts = [
				"test:multi-blockchain",
				"test:multi-blockchain-unit",
				"test:multi-blockchain-integration",
				"test:multi-blockchain-performance",
			];

			const missingScripts = requiredScripts.filter(
				(script) => !scripts[script]
			);

			if (missingScripts.length > 0) {
				console.log("   📦 Missing package.json scripts:");
				missingScripts.forEach((script) => {
					console.log(`      - ${script}`);
				});
			} else {
				console.log("   ✅ All required npm scripts are present");
			}
		} catch (error: any) {
			console.log(`   ❌ Error reading package.json: ${error.message}`);
		}
	}
}

// CLI interface
if (require.main === module) {
	const validator = new TestSetupValidator();

	validator.validateSetup().catch((error) => {
		console.error("❌ Validation failed:", error);
		process.exit(1);
	});
}

export { TestSetupValidator };
