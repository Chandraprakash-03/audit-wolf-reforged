/**
 * Test runner for comprehensive multi-blockchain testing
 * Executes all test suites and generates coverage reports
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface TestSuite {
	name: string;
	path: string;
	timeout: number;
	description: string;
}

interface TestResult {
	suite: string;
	passed: boolean;
	duration: number;
	coverage?: number;
	errors?: string[];
}

class MultiBlockchainTestRunner {
	private testSuites: TestSuite[] = [
		{
			name: "Unit Tests - Platform Analyzers",
			path: "src/test/multi-blockchain-comprehensive.test.ts",
			timeout: 300000, // 5 minutes
			description:
				"Tests individual platform analyzers (Solana, Cardano, Move)",
		},
		{
			name: "Integration Tests - Multi-Platform Workflows",
			path: "src/test/integration/multi-blockchain-integration.test.ts",
			timeout: 600000, // 10 minutes
			description: "Tests complete multi-platform analysis workflows",
		},
		{
			name: "Performance Tests - Parallel Processing",
			path: "src/test/performance/multi-blockchain-performance.test.ts",
			timeout: 900000, // 15 minutes
			description: "Tests performance and scalability of parallel analysis",
		},
		{
			name: "Cross-Chain Analysis Tests",
			path: "src/test/cross-chain-analyzer.test.ts",
			timeout: 300000, // 5 minutes
			description: "Tests cross-chain analysis and interoperability detection",
		},
		{
			name: "Solana Analyzer Tests",
			path: "src/test/solana-analyzer.test.ts",
			timeout: 180000, // 3 minutes
			description: "Tests Solana-specific analysis capabilities",
		},
		{
			name: "Cardano Analyzer Tests",
			path: "src/test/cardano-analyzer.test.ts",
			timeout: 180000, // 3 minutes
			description: "Tests Cardano-specific analysis capabilities",
		},
	];

	private results: TestResult[] = [];

	async runAllTests(): Promise<void> {
		console.log("🚀 Starting Multi-Blockchain Comprehensive Test Suite");
		console.log("=".repeat(60));

		const startTime = Date.now();

		for (const suite of this.testSuites) {
			await this.runTestSuite(suite);
		}

		const totalTime = Date.now() - startTime;
		this.generateReport(totalTime);
	}

	private async runTestSuite(suite: TestSuite): Promise<void> {
		console.log(`\n📋 Running: ${suite.name}`);
		console.log(`📝 Description: ${suite.description}`);
		console.log(`⏱️  Timeout: ${suite.timeout / 1000}s`);
		console.log("-".repeat(50));

		const startTime = Date.now();
		let result: TestResult = {
			suite: suite.name,
			passed: false,
			duration: 0,
		};

		try {
			// Run the test suite with Jest
			const command = `npx jest ${suite.path} --verbose --coverage --testTimeout=${suite.timeout}`;

			console.log(`🔄 Executing: ${command}`);

			const output = execSync(command, {
				cwd: process.cwd(),
				encoding: "utf8",
				timeout: suite.timeout,
			});

			result.passed = true;
			result.duration = Date.now() - startTime;

			// Extract coverage information if available
			const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
			if (coverageMatch) {
				result.coverage = parseFloat(coverageMatch[1]);
			}

			console.log(`✅ ${suite.name} - PASSED (${result.duration}ms)`);
			if (result.coverage) {
				console.log(`📊 Coverage: ${result.coverage}%`);
			}
		} catch (error: any) {
			result.passed = false;
			result.duration = Date.now() - startTime;
			result.errors = [error.message];

			console.log(`❌ ${suite.name} - FAILED (${result.duration}ms)`);
			console.log(`💥 Error: ${error.message}`);

			// Extract specific test failures if available
			if (error.stdout) {
				const failureMatch = error.stdout.match(/FAIL\s+(.+)/g);
				if (failureMatch) {
					result.errors = failureMatch;
				}
			}
		}

		this.results.push(result);
	}

	private generateReport(totalTime: number): void {
		console.log("\n" + "=".repeat(60));
		console.log("📊 MULTI-BLOCKCHAIN TEST REPORT");
		console.log("=".repeat(60));

		const passedTests = this.results.filter((r) => r.passed).length;
		const totalTests = this.results.length;
		const successRate = (passedTests / totalTests) * 100;

		console.log(`\n📈 Overall Results:`);
		console.log(
			`   ✅ Passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`
		);
		console.log(`   ⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s`);

		// Average coverage
		const coverageResults = this.results.filter(
			(r) => r.coverage !== undefined
		);
		if (coverageResults.length > 0) {
			const avgCoverage =
				coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) /
				coverageResults.length;
			console.log(`   📊 Average Coverage: ${avgCoverage.toFixed(1)}%`);
		}

		console.log(`\n📋 Detailed Results:`);
		this.results.forEach((result, index) => {
			const status = result.passed ? "✅ PASS" : "❌ FAIL";
			const duration = (result.duration / 1000).toFixed(2);
			const coverage = result.coverage ? ` (${result.coverage}% coverage)` : "";

			console.log(
				`   ${index + 1}. ${status} - ${result.suite} - ${duration}s${coverage}`
			);

			if (result.errors && result.errors.length > 0) {
				result.errors.forEach((error) => {
					console.log(`      💥 ${error}`);
				});
			}
		});

		// Performance metrics
		console.log(`\n⚡ Performance Metrics:`);
		const performanceResult = this.results.find((r) =>
			r.suite.includes("Performance")
		);
		if (performanceResult) {
			if (performanceResult.passed) {
				console.log(
					`   ✅ Performance tests passed - System can handle parallel processing`
				);
			} else {
				console.log(
					`   ⚠️  Performance tests failed - Check system resources and optimization`
				);
			}
		}

		// Integration test results
		const integrationResult = this.results.find((r) =>
			r.suite.includes("Integration")
		);
		if (integrationResult) {
			if (integrationResult.passed) {
				console.log(
					`   ✅ Integration tests passed - End-to-end workflows functional`
				);
			} else {
				console.log(
					`   ⚠️  Integration tests failed - Check API and database connectivity`
				);
			}
		}

		// Recommendations
		console.log(`\n💡 Recommendations:`);

		if (successRate < 100) {
			console.log(
				`   🔧 Fix failing tests before deploying multi-blockchain features`
			);
		}

		if (coverageResults.length > 0) {
			const avgCoverage =
				coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) /
				coverageResults.length;
			if (avgCoverage < 80) {
				console.log(
					`   📈 Increase test coverage to at least 80% (currently ${avgCoverage.toFixed(
						1
					)}%)`
				);
			}
		}

		const slowTests = this.results.filter((r) => r.duration > 60000);
		if (slowTests.length > 0) {
			console.log(
				`   ⚡ Optimize slow test suites: ${slowTests
					.map((t) => t.suite)
					.join(", ")}`
			);
		}

		// Save report to file
		this.saveReportToFile(totalTime);

		console.log(
			`\n📄 Detailed report saved to: test-results/multi-blockchain-test-report.json`
		);
		console.log("=".repeat(60));
	}

	private saveReportToFile(totalTime: number): void {
		const reportDir = path.join(process.cwd(), "test-results");
		if (!fs.existsSync(reportDir)) {
			fs.mkdirSync(reportDir, { recursive: true });
		}

		const report = {
			timestamp: new Date().toISOString(),
			totalTime,
			summary: {
				totalTests: this.results.length,
				passedTests: this.results.filter((r) => r.passed).length,
				failedTests: this.results.filter((r) => !r.passed).length,
				successRate:
					(this.results.filter((r) => r.passed).length / this.results.length) *
					100,
			},
			results: this.results,
			environment: {
				nodeVersion: process.version,
				platform: process.platform,
				arch: process.arch,
				memory: process.memoryUsage(),
			},
		};

		const reportPath = path.join(
			reportDir,
			"multi-blockchain-test-report.json"
		);
		fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

		// Also save a markdown report
		this.saveMarkdownReport(report, reportDir);
	}

	private saveMarkdownReport(report: any, reportDir: string): void {
		const markdownContent = `# Multi-Blockchain Test Report

**Generated:** ${report.timestamp}
**Total Time:** ${(report.totalTime / 1000).toFixed(2)}s

## Summary

- **Total Tests:** ${report.summary.totalTests}
- **Passed:** ${report.summary.passedTests}
- **Failed:** ${report.summary.failedTests}
- **Success Rate:** ${report.summary.successRate.toFixed(1)}%

## Test Results

${report.results
	.map(
		(result: TestResult, index: number) => `
### ${index + 1}. ${result.suite}

- **Status:** ${result.passed ? "✅ PASSED" : "❌ FAILED"}
- **Duration:** ${(result.duration / 1000).toFixed(2)}s
${result.coverage ? `- **Coverage:** ${result.coverage}%` : ""}
${
	result.errors
		? `- **Errors:**\n${result.errors
				.map((e: string) => `  - ${e}`)
				.join("\n")}`
		: ""
}
`
	)
	.join("\n")}

## Environment

- **Node Version:** ${report.environment.nodeVersion}
- **Platform:** ${report.environment.platform}
- **Architecture:** ${report.environment.arch}
- **Memory Usage:** ${JSON.stringify(report.environment.memory, null, 2)}

## Recommendations

${
	report.summary.successRate < 100
		? "- 🔧 Fix failing tests before deploying multi-blockchain features"
		: ""
}
${
	report.results.some((r: TestResult) => r.duration > 60000)
		? "- ⚡ Optimize slow test suites"
		: ""
}
${
	report.results.filter((r: TestResult) => r.coverage !== undefined).length >
		0 &&
	report.results
		.filter((r: TestResult) => r.coverage !== undefined)
		.reduce((sum: number, r: TestResult) => sum + (r.coverage || 0), 0) /
		report.results.filter((r: TestResult) => r.coverage !== undefined).length <
		80
		? "- 📈 Increase test coverage to at least 80%"
		: ""
}
`;

		const markdownPath = path.join(
			reportDir,
			"multi-blockchain-test-report.md"
		);
		fs.writeFileSync(markdownPath, markdownContent);
	}
}

// CLI interface
if (require.main === module) {
	const runner = new MultiBlockchainTestRunner();

	runner.runAllTests().catch((error) => {
		console.error("❌ Test runner failed:", error);
		process.exit(1);
	});
}

export { MultiBlockchainTestRunner };
