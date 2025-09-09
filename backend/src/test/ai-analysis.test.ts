import { AIAnalyzer, AIAnalysisOptions } from "../services/AIAnalyzer";
import { config } from "../config";

// Mock the LangChain modules
jest.mock("@langchain/openai", () => ({
	ChatOpenAI: jest.fn().mockImplementation(() => ({
		invoke: jest.fn(),
	})),
}));

jest.mock("@langchain/core/prompts", () => ({
	PromptTemplate: {
		fromTemplate: jest.fn().mockReturnValue({
			format: jest.fn(),
		}),
	},
}));

jest.mock("@langchain/core/output_parsers", () => ({
	StringOutputParser: jest.fn().mockImplementation(() => ({
		parse: jest.fn(),
	})),
}));

jest.mock("@langchain/core/runnables", () => ({
	RunnableSequence: {
		from: jest.fn().mockReturnValue({
			invoke: jest.fn(),
		}),
	},
}));

describe("AIAnalyzer", () => {
	let aiAnalyzer: AIAnalyzer;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		// Create analyzer with test configuration
		aiAnalyzer = new AIAnalyzer({
			timeout: 30000,
			maxTokens: 1000,
			temperature: 0.1,
			models: ["openai/gpt-4o-mini"],
			ensembleThreshold: 0.6,
		});
	});

	describe("analyzeContract", () => {
		const mockContract = `
			pragma solidity ^0.8.0;
			
			contract TestContract {
				mapping(address => uint256) public balances;
				
				function withdraw(uint256 amount) public {
					require(balances[msg.sender] >= amount, "Insufficient balance");
					balances[msg.sender] -= amount;
					payable(msg.sender).transfer(amount);
				}
			}
		`;

		it("should successfully analyze a contract with mocked AI response", async () => {
			// Mock the AI response
			const mockAIResponse = JSON.stringify({
				vulnerabilities: [
					{
						type: "reentrancy",
						severity: "high",
						description:
							"Potential reentrancy vulnerability in withdraw function",
						location: {
							file: "contract.sol",
							line: 8,
							column: 1,
							length: 50,
						},
						confidence: 0.85,
					},
				],
				recommendations: [
					{
						category: "Security",
						priority: "high",
						description: "Implement reentrancy guard",
						implementation_guide: "Use OpenZeppelin's ReentrancyGuard modifier",
					},
				],
				qualityMetrics: {
					code_quality_score: 75,
					maintainability_index: 80,
					test_coverage_estimate: 60,
				},
				confidence: 0.82,
			});

			// Mock the chain invoke method
			const mockChain = {
				invoke: jest.fn().mockResolvedValue(mockAIResponse),
			};

			// Mock RunnableSequence.from to return our mock chain
			const { RunnableSequence } = require("@langchain/core/runnables");
			RunnableSequence.from.mockReturnValue(mockChain);

			const result = await aiAnalyzer.analyzeContract(
				mockContract,
				"TestContract"
			);

			expect(result.success).toBe(true);
			expect(result.result).toBeDefined();
			expect(result.result!.vulnerabilities).toHaveLength(1);
			expect(result.result!.vulnerabilities[0].type).toBe("reentrancy");
			expect(result.result!.vulnerabilities[0].severity).toBe("high");
			expect(result.result!.recommendations).toHaveLength(1);
			expect(result.result!.confidence).toBe(0.82);
			expect(result.executionTime).toBeGreaterThanOrEqual(0);
		});

		it("should handle AI analysis failure gracefully", async () => {
			// Mock the chain to throw an error
			const mockChain = {
				invoke: jest
					.fn()
					.mockRejectedValue(new Error("AI service unavailable")),
			};

			const { RunnableSequence } = require("@langchain/core/runnables");
			RunnableSequence.from.mockReturnValue(mockChain);

			const result = await aiAnalyzer.analyzeContract(
				mockContract,
				"TestContract"
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain(
				"All AI models failed to analyze the contract"
			);
			expect(result.executionTime).toBeGreaterThanOrEqual(0);
		});

		it("should handle malformed AI response", async () => {
			// Mock invalid JSON response
			const mockChain = {
				invoke: jest.fn().mockResolvedValue("Invalid JSON response"),
			};

			const { RunnableSequence } = require("@langchain/core/runnables");
			RunnableSequence.from.mockReturnValue(mockChain);

			const result = await aiAnalyzer.analyzeContract(
				mockContract,
				"TestContract"
			);

			expect(result.success).toBe(true);
			expect(result.result).toBeDefined();
			// Should return empty but valid structure when parsing fails
			expect(result.result!.vulnerabilities).toHaveLength(0);
			expect(result.result!.confidence).toBe(0.1);
		});

		it("should validate and sanitize vulnerability data", async () => {
			// Mock response with invalid data
			const mockAIResponse = JSON.stringify({
				vulnerabilities: [
					{
						type: "invalid_type",
						severity: "invalid_severity",
						description: "",
						location: {
							file: "contract.sol",
							line: "invalid_line",
							column: -1,
						},
						confidence: 2.5, // Invalid confidence > 1
					},
				],
				recommendations: [],
				qualityMetrics: {
					code_quality_score: 150, // Invalid score > 100
					maintainability_index: -10, // Invalid negative score
					test_coverage_estimate: "invalid", // Invalid type
				},
				confidence: 1.5, // Invalid confidence > 1
			});

			const mockChain = {
				invoke: jest.fn().mockResolvedValue(mockAIResponse),
			};

			const { RunnableSequence } = require("@langchain/core/runnables");
			RunnableSequence.from.mockReturnValue(mockChain);

			const result = await aiAnalyzer.analyzeContract(
				mockContract,
				"TestContract"
			);

			expect(result.success).toBe(true);
			expect(result.result).toBeDefined();

			const vuln = result.result!.vulnerabilities[0];
			expect(vuln.type).toBe("best_practice"); // Should default to valid type
			expect(vuln.severity).toBe("low"); // Should default to valid severity
			expect(vuln.location.line).toBe(1); // Should default to valid line
			expect(vuln.location.column).toBe(1); // Should default to valid column
			expect(vuln.confidence).toBeLessThanOrEqual(1); // Should be clamped to 1

			const quality = result.result!.code_quality;
			expect(quality.code_quality_score).toBeLessThanOrEqual(100); // Should be clamped
			expect(quality.maintainability_index).toBeGreaterThanOrEqual(0); // Should be clamped
			expect(quality.test_coverage_estimate).toBeGreaterThanOrEqual(0); // Should be valid number

			expect(result.result!.confidence).toBeLessThanOrEqual(1); // Should be clamped
		});

		it("should apply analysis options correctly", async () => {
			const options: AIAnalysisOptions = {
				includeRecommendations: true,
				includeQualityMetrics: true,
				focusAreas: ["reentrancy", "access control"],
				severityThreshold: "medium",
			};

			const mockAIResponse = JSON.stringify({
				vulnerabilities: [],
				recommendations: [],
				qualityMetrics: {
					code_quality_score: 80,
					maintainability_index: 75,
					test_coverage_estimate: 65,
				},
				confidence: 0.9,
			});

			const mockChain = {
				invoke: jest.fn().mockResolvedValue(mockAIResponse),
			};

			const { RunnableSequence } = require("@langchain/core/runnables");
			RunnableSequence.from.mockReturnValue(mockChain);

			const result = await aiAnalyzer.analyzeContract(
				mockContract,
				"TestContract",
				options
			);

			expect(result.success).toBe(true);
			expect(mockChain.invoke).toHaveBeenCalledWith({
				sourceCode: mockContract,
				contractName: "TestContract",
				focusAreas: "reentrancy, access control",
			});
		});
	});

	describe("checkConfiguration", () => {
		it("should check AI configuration", async () => {
			// Mock successful API test
			const { ChatOpenAI } = require("@langchain/openai");
			const mockModel = {
				invoke: jest.fn().mockResolvedValue("test response"),
			};
			ChatOpenAI.mockImplementation(() => mockModel);

			const result = await AIAnalyzer.checkConfiguration();

			expect(result.configured).toBe(true);
			expect(result.availableModels.length).toBeGreaterThan(0);
			expect(result.errors).toHaveLength(0);
		});

		it("should detect missing API key", async () => {
			// Temporarily clear the API key
			const originalApiKey = config.openRouter.apiKey;
			config.openRouter.apiKey = "";

			const result = await AIAnalyzer.checkConfiguration();

			expect(result.configured).toBe(false);
			expect(result.errors).toContain("OpenRouter API key not configured");

			// Restore API key
			config.openRouter.apiKey = originalApiKey;
		});

		it("should handle API connection failure", async () => {
			// Mock API failure
			const { ChatOpenAI } = require("@langchain/openai");
			const mockModel = {
				invoke: jest.fn().mockRejectedValue(new Error("Connection failed")),
			};
			ChatOpenAI.mockImplementation(() => mockModel);

			const result = await AIAnalyzer.checkConfiguration();

			expect(result.configured).toBe(false);
			expect(
				result.errors.some((error) => error.includes("Connection failed"))
			).toBe(true);
		});
	});

	describe("ensemble analysis", () => {
		it("should combine results from multiple models", async () => {
			// Create analyzer with multiple models
			const multiModelAnalyzer = new AIAnalyzer({
				models: ["deepseek/deepseek-chat-v3.1:free", "moonshotai/kimi-k2:free"],
				ensembleThreshold: 0.5,
			});

			// Mock responses from different models
			const mockResponse1 = JSON.stringify({
				vulnerabilities: [
					{
						type: "reentrancy",
						severity: "high",
						description: "Reentrancy in withdraw",
						location: { file: "contract.sol", line: 8, column: 1 },
						confidence: 0.9,
					},
				],
				recommendations: [],
				qualityMetrics: {
					code_quality_score: 80,
					maintainability_index: 75,
					test_coverage_estimate: 60,
				},
				confidence: 0.85,
			});

			const mockResponse2 = JSON.stringify({
				vulnerabilities: [
					{
						type: "reentrancy",
						severity: "high",
						description: "Reentrancy vulnerability detected",
						location: { file: "contract.sol", line: 8, column: 1 },
						confidence: 0.8,
					},
				],
				recommendations: [],
				qualityMetrics: {
					code_quality_score: 75,
					maintainability_index: 80,
					test_coverage_estimate: 65,
				},
				confidence: 0.8,
			});

			// Mock multiple chains
			let callCount = 0;
			const mockChain = {
				invoke: jest.fn().mockImplementation(() => {
					callCount++;
					return Promise.resolve(
						callCount === 1 ? mockResponse1 : mockResponse2
					);
				}),
			};

			const { RunnableSequence } = require("@langchain/core/runnables");
			RunnableSequence.from.mockReturnValue(mockChain);

			const result = await multiModelAnalyzer.analyzeContract(
				"contract code",
				"TestContract"
			);

			expect(result.success).toBe(true);
			expect(result.modelResponses).toHaveLength(2);
			expect(result.result!.vulnerabilities).toHaveLength(1); // Should combine similar vulnerabilities
			expect(result.result!.confidence).toBeCloseTo(0.825); // Average of 0.85 and 0.8
		});
	});
});
